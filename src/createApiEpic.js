import { empty, of, merge, Subject } from 'rxjs';
import { catchError, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
import xhr2 from 'xhr2';

import {
	createActionCreator,
} from './actions';

export default function createApiEpic(id, handler, getCBStream) {
	const defaultState = {
		session: {},
	};

	const fetch = (options, _getCBStream) => createActionCreator(`fetch/${id}`)({ options, getCBStream: _getCBStream });

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
		const fetchType = fetch().type;

		return merge(
			// apiFetch actions
			action$.pipe(
				filter(action => action.type === fetchType),
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
					const actionCbStream$ = fetchAction && fetchAction.payload && fetchAction.payload.getCBStream ? fetchAction.payload.getCBStream(streams) : empty();

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
							switchMap(result => of(success({ result, options: fetchAction && fetchAction.payload ? fetchAction.payload.options : undefined }))),
							catchError(result => of(error({ result, options: fetchAction && fetchAction.payload ? fetchAction.payload.options : undefined }))),
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
	epic.fetch = fetch;
	epic.id = id;

	return epic;
}
