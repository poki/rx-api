import { clearAllStatuses } from './src/actions';
import reducer from './src/reducer';
import { useSelectApiStatus, selectApiStatus, setStateKey } from './src/selectors';
import createApiEpic from './src/createApiEpic';

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
