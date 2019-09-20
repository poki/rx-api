import {
	actionPrefix,
	clearAllStatuses,
} from './actions';

export const defaultState = {
	done: false,
	error: null,
	pending: false,
};

export default function apiReducer(state = {}, action) {
	const parts = action.type.split('/');
	const type = parts.slice(0, 2).join('/');
	const id = parts.slice(2).join('/');

	if (type === `${actionPrefix}/fetch`) {
		return {
			...state,
			[id]: {
				...state[id],
				done: false,
				error: null,
				pending: true,
				progress: 0,
				progressEvent: null,
			},
		};
	}

	if (type === `${actionPrefix}/error`) {
		return {
			...state,
			[id]: {
				...state[id],
				done: true,
				error: action.payload.error,
				pending: false,
				progress: 1,
			},
		};
	}

	if (type === `${actionPrefix}/success`) {
		return {
			...state,
			[id]: {
				...state[id],
				done: true,
				error: action.payload.error,
				pending: false,
				progress: 1,
			},
		};
	}

	if (type === `${actionPrefix}/progress`) {
		return {
			...state,
			[id]: {
				...state[id],
				progress: action.payload.progress.loaded / action.payload.progress.total,
				progressEvent: action.payload.progress,
			},
		};
	}

	if (action.type === clearAllStatuses.type) {
		return {};
	}

	return state;
}
