import { clearAllStatuses } from './actions';
import reducer from './reducer';
import { useSelectApiStatus, selectApiStatus, setStateKey } from './selectors';
import createApiEpic from './createApiEpic';
import combinedApiStatus from './combinedApiStatus';

const createApiReducer = key => {
	setStateKey(key);
	return reducer;
};

export {
	combinedApiStatus,
	createApiReducer,
	createApiEpic,

	// Actions
	clearAllStatuses,

	// Selectors
	selectApiStatus,
	useSelectApiStatus,
};
