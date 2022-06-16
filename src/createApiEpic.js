import { empty, of, merge, Subject } from 'rxjs';
import { catchError, filter, map, mergeMap, switchMap, takeUntil } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
import objectHash from 'object-hash';

import {
	createActionCreator,
} from './actions';

const cache = {};

export default function createApiEpic(id, handler, getCBStream, options = {}) {
	const { cacheSeconds = 0, cacheKey: overrideCacheKey, allowParallel = false } = options;

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

	const mapOperator = allowParallel ? mergeMap : switchMap;

	const epic = (action$, state$ = { value: defaultState }) => {
		const cancel$ = action$.pipe(filter(action => action.type === cancel.type));
		const success$ = action$.pipe(filter(action => action.type === success.type));
		const error$ = action$.pipe(filter(action => action.type === error.type));
		const progress$ = action$.pipe(filter(action => action.type === progress.type));

		const streams = { cancel$, success$, error$, progress$ };

		const epicCbStream$ = getCBStream ? getCBStream(streams) : empty();
		const attemptFetchType = attemptFetch().type;

		return merge(
			// attemptFetch actions
			action$.pipe(
				filter(action => action.type === attemptFetchType),
				mapOperator(action => {
					const actionCbStream$ = action.payload.getCBStream ? action.payload.getCBStream(streams) : empty();

					let cacheKey = id;
					let nextAction;

					if (doCache) {
						cacheKey = overrideCacheKey || objectHash({ type: action.type, options: action.payload.options });
						const cacheInfo = cache[cacheKey];
						if (cacheInfo && (Date.now() - cacheInfo.time) < (cacheSeconds * 1000)) {
							// We're still within the cache period, immediately go to success
							nextAction = of(success({ result: cacheInfo.result, options: action.payload.options, fromCache: true, state$ }));
						}
					}

					if (!nextAction) {
						// Otherwise just go and fetch!
						nextAction = of(fetch({ ...action.payload, cacheKey }));
					}

					return merge(
						// Listen to the action callback stream
						actionCbStream$.pipe(
							// As soon as a new attemptFetch is done, unsubscribe to any still subscribed action cb streams
							// to avoid duplicate handling
							takeUntil(action$.pipe(
								filter(action => action.type === attemptFetchType),
							)),
						),
						// And emit the next action
						nextAction,
					);
				}),
			),
			// apiFetch actions
			action$.pipe(
				filter(action => action.type === fetch.type),
				mapOperator(action => {
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
				mapOperator(action => {
					const progressSubscriber$ = new Subject();
					const fetchAction = action.__fetchAction;

					return merge(
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
							createXHR: () => new XMLHttpRequest(),
							crossDomain: true,
							progressSubscriber: progressSubscriber$,
						}).pipe(
							mapOperator(result => {
								// Set cache
								if (doCache) {
									cache[fetchAction.payload.cacheKey] = {
										time: Date.now(),
										result,
									};
								}

								return of(success({ result, options: fetchAction.payload.options, fromCache: false, state$ }));
							}),
							catchError(result => of(error({ result, options: fetchAction.payload.options, state$ }))),
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
