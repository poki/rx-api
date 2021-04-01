import { empty, of, merge, Subject } from 'rxjs';
import { catchError, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
import xhr2 from 'xhr2';
import objectHash from 'object-hash';

import {
	createActionCreator,
} from './actions';

const cache = {};

export default function createApiEpic(id, handler, getCBStream, options = {}) {
	const { cacheSeconds = 0 } = options;

	const doCache = cacheSeconds > 0;

	const defaultState = {
		session: {},
	};

	const attemptFetch = (options, _getCBStream) => createActionCreator(`attemptFetch/${id}`)({ options, getCBStream: _getCBStream });

	const fetch = createActionCreator(`fetch/${id}`);
	const cancel = createActionCreator(`cancel/${id}`);
	const error = createActionCreator(`error/${id}`);
	const progress = createActionCreator(`progress/${id}`);
	const success = createActionCreator(`success/${id}`);
	const callApi = createActionCreator(`call/${id}`);

	const epic = (action$, state$ = { value: defaultState }) => {
		const cancel$ = action$.pipe(filter(action => action.type === cancel.type));
		const success$ = action$.pipe(filter(action => action.type === success.type));
		const error$ = action$.pipe(filter(action => action.type === error.type));
		const progress$ = action$.pipe(filter(action => action.type === progress.type));

		const streams = { cancel$, success$, error$, progress$ };

		const epicCbStream$ = getCBStream ? getCBStream(streams) : empty();

		return merge(
			// attemptFetch actions
			action$.pipe(
				filter(action => action.type === attemptFetch().type),
				switchMap(action => {
					const cacheKey = objectHash({ type: action.type, options: action.payload.options });
					const cacheInfo = cache[cacheKey];
					if (doCache && cacheInfo && (Date.now() - cacheInfo.time) < (cacheSeconds * 1000)) {
						// We're still within the cache period, immediately go to success
						return of(success({ result: cacheInfo.result, options: action.payload.options, fromCache: true }));
					}

					// Otherwise just go and fetch!
					return of(fetch({ ...action.payload, cacheKey }));
				}),
			),
			// apiFetch actions
			action$.pipe(
				filter(action => action.type === fetch.type),
				switchMap(action => {
					const callApiCreator = payload => of({
						...callApi(payload),
						// Ensure when creating the callApi action that the original fetchAction is attached
						__fetchAction: action,
					});

					callApiCreator.type = callApi.type;

					return handler(
						callApiCreator,
						action.payload ? action.payload.options : {},
						state$.value,
					).pipe(
						takeUntil(cancel$),
					);
				}),
			),
			// callApi actions
			action$.pipe(
				filter(action => action.type === callApi.type),
				switchMap(action => {
					const progressSubscriber$ = new Subject();
					const fetchAction = action.__fetchAction;
					const actionCbStream$ = fetchAction.payload.getCBStream ? fetchAction.payload.getCBStream(streams) : empty();

					return merge(
						// Action callback stream
						actionCbStream$,
						// Epic callback stream
						epicCbStream$,
						// Handle progress
						progressSubscriber$.pipe(
							map(p => progress({ progress: p })),
							catchError(() => empty()),
						),
						// Handle request
						ajax({
							...action.payload,
							createXHR: () => new (typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest : xhr2)(),
							crossDomain: true,
							progressSubscriber: progressSubscriber$,
						}).pipe(
							switchMap(result => {
								// Set cache
								if (doCache) {
									cache[fetchAction.payload.cacheKey] = {
										time: Date.now(),
										result,
									};
								}

								return of(success({ result, options: fetchAction.payload.options, fromCache: false }));
							}),
							catchError(result => of(error({ result, options: fetchAction.payload.options }))),
						),
					).pipe(
						takeUntil(cancel$),
					);
				}),
			),
		);
	};

	epic.success = success;
	epic.progress = progress;
	epic.cancel = cancel;
	epic.error = error;
	epic.fetch = attemptFetch;
	epic.id = id;

	return epic;
}
