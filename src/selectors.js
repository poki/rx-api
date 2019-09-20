import { useSelector } from 'react-redux';

import { defaultState } from './reducer';

let stateKey = 'rxapi';

export const setStateKey = key => {
	stateKey = key;
};

const getState = state => {
	if (!state[stateKey]) throw new Error(`Failed to get rxapi state: key '${stateKey}' does not exist. Did you create the reducer correctly? (See README.md)`);
	return state[stateKey];
};

/* Selectors */
export const selectApiStatus = (state, id) => getState(state)[id] || defaultState;

/* Hooks */
export const useSelectApiStatus = id => useSelector(state => selectApiStatus(state, id));
