export const actionPrefix = 'rx-api';

export function createActionCreator(label) {
	const type = `${actionPrefix}/${label}`;
	const actionCreator = payload => ({ type, payload });
	actionCreator.type = type;
	return actionCreator;
}

export const clearAllStatuses = createActionCreator('api/clear_all_statuses');
