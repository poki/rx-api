import { clearAllStatuses } from './actions';
import reducer from './reducer';
import { useSelectApiStatus, selectApiStatus, setStateKey } from './selectors';
import createApiEpic from './createApiEpic';

const createApiReducer = key => {
	setStateKey(key);
	return reducer;
};

export {
	createApiReducer,
	createApiEpic,

	// Actions
	clearAllStatuses,

	// Selectors
	selectApiStatus,
	useSelectApiStatus,
};
