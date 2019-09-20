# rx-api ✨

Reactive API system for `redux-observable`.

## Features

What does rx-api give you:

- Access to all your APIs through redux actions
- Consistent API state structure without the boilerplate
- Imbued with the power of RxJS

What does rx-api not do:

- Specific implementation of how to handle API responses

## Dependencies

1. rxjs
2. redux
3. redux-observable

## Installation

### Basic setup

1. Create an API epic

```js
import { createApiEpic } from 'rx-api';

export const getGames = createApiEpic(
	'games/all', // identifier
	callApi => callApi({ url: 'https://api.com/games', method: 'GET' }),
);
```

2. Register the epic with redux-observable and create the reducer

```js
import { createApiReducer } from 'rx-api';
import { createStore, combineReducers } from 'redux';
import { createEpicMiddleware, combineEpics } from 'redux-observable';

import { getGames } from './epics';

const epicMiddleware = createEpicMiddleware();

const apiReducerKey = 'rx-api';

export const store = createStore(
	combineReducers({
		// A: Add the reducer, ensure you pass the key
		[apiReducerKey]: createApiReducer(apiReducerKey),
	}),
	applyMiddleware(
		epicMiddleware,
	),
);

// B: Register your api epics
epicMiddleware.run(getGames);
```

3. Call that epic


```js
import { useDispatch } from 'redux';

import { getGames } from './epics';

const Component = () => {
	const dispatch = useDispatch();

	dispatch(getGames.fetch());
};
```

### Storing API results in state

```js
import { getGames } from './epics';

function gameReducer(state, action) {
	if (action.type === getGames.success) {
		const ajaxResult = action.payload.result;
		return {
			...state,
			games: ajaxResult.response.games,
		};
	}
}
```

### Retrieving API call status

```js
import { useSelector, useDispatch } from 'redux';
import { useSelectApiStatus } from 'rx-api'; // Or selectApiStatus if you use selectors

import { getGames } from './epics';

const Component = () => {
	const status = useSelectApiStatus(getGames.id);
	const games = useSelector(state => state.game.games);
	const dispatch = useDispatch();

	// Call the API
	dispatch(getGames.fetch());

	// Show the results
	if (status.pending) {
		return `Pending... (${status.progress * 100}%)`;
	} else if (status.error) {
		return `Error occured during getGames: ${error}`;
	}

	return games;
};
```

### Passing data to epic

```js
export const getGamesById = createApiEpic(
	'games/by_id', // identifier
	(callApi, options) => callApi({ url: `https://api.com/games/${options.id}`, method: 'GET' }),
);

// Fetch example
dispatch(getGamesById.fetch({ id: 1337 }));
```

### Epic-level callbacks

```js
import { merge } from 'rxjs';
import { tap, ignoreElements } from 'rxjs/operators';

export const getGamesById = createApiEpic(
	'games/by_id', // identifier
	(callApi, options) => callApi({ url: `https://api.com/games/${options.id}`, method: 'GET' }),
	({ success$, error$, cancel$, progress$ }) => merge(
		success$.pipe(
			// -> in: getGamesById.success action
			tap(action => console.info('API call successful', action)),
			ignoreElements(), // -> out: nothing, Ensure we don't duplicate our action
		),
		error$.pipe(
			// -> in: getGamesById.error action
			tap(action => console.info('API call error', action)),
			ignoreElements(), // -> out: nothing, Ensure we don't duplicate our action
		),
		progress$.pipe(
			// -> in: getGamesById.progress action
			tap(action => console.info('API call progress update', action)),
			ignoreElements(), // -> out: nothing, Ensure we don't duplicate our action
		),
		cancel$.pipe(
			// -> in: getGamesById.cancel action
			tap(action => console.info('API call canceled', action)),
			ignoreElements(), // -> out: nothing, Ensure we don't duplicate our action
		),
	),
);
```

### Action-level callbacks

```js
dispatch(
	getGamesById.fetch(
		{ id: 1337 },
		({ success$ }) => success$.pipe(
			// [...] etc. See epic-level callbacks.
		),
	),
);
```

# Advanced

### Setting up authorized API routes

We can create a wrapper for createApiEpic that injects authorization headers on every action created with it as such:

```js
export const createAuthorizedApiEpic = (id, handler, getCBStream) => {
	// Return the original createApiEpic
	return createApiEpic(
		id,
		// Wrap the handler
		(callApi, options = {}, state) => {
			// Select the access token from redux
			const accessToken = selectAccessToken(state);

			// Return the original handler
			return handler(callApi, options, state).pipe(
				map(action => {
					// Inject authorization header in any callApi actions
					if (action.type === callApi.type) {
						return {
							...action,
							payload: {
								...(action.payload || {}),
								headers: {
									...(action.payload.headers || {}),
									Authorization: `Bearer ${accessToken}`,
								},
							},
						};
					}

					// Pass through any other actions directly
					return action;
				}),
			);
		};
		getCBStream,
	);
};
```

### Set up automatic token refreshing

Expanding on the above:

```js
// Create an apiEpic for refreshing authorization tokens
export const refreshAuth = createApiEpic(
	'session/refresh',
	(callApi, { refreshToken }) => callApi({
		url: 'https://api.com/authorization',
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refreshToken }),
	}),
	({ success$ }) => (
		success$.pipe(
			switchMap(({ payload: { result: { response } } }) => (
				of(
					setAccessToken({ accessToken: response.access_token }),
					setTokenTTL({ ttl: response.ttl }),
				)
			)),
		)
	),
);

// Expanded createAuthorizedApiEpic that calls refreshAuth if necessary before handling the original action
export const createAuthorizedApiEpic = (id, handler, getCBStream) => {
	const authorizedHandler = (callApi, options = {}, state) => {
		// Helper method to create callApi based on access token
		const createCallApi = accessToken => (
			// Execute original handler, and pipe the result
			handler(callApi, options, state).pipe(
				// Adjust resulting action if necessary
				map(action => {
					if (action.type === callApi.type) {
						// Inject authorization header
						return {
							...action,
							payload: {
								...(action.payload || {}),
								headers: {
									...(action.payload.headers || {}),
									Authorization: `Bearer ${accessToken}`,
								},
							},
						};
					}

					// Pass through any other actions directly
					return action;
				}),
			)
		);

		const expires = selectTokenExpires(state);
		if (expires < Date.now()) {
			const refreshToken = selectRefreshToken(state);

			// Refresh before handling original api request
			return of(
				refreshAuth.fetch(
					{ refreshToken },
					({ success$ }) => (
						success$.pipe(
							switchMap(({ payload: { result: { response } } }) => createCallApi(response.access_token)),
						)
					),
				),
			);
		}

		// No refreshing necessary
		const accessToken = selectAccessToken(state);
		return createCallApi(accessToken);
	};

	return createApiEpic(id, authorizedHandler, getCBStream);
};

```
