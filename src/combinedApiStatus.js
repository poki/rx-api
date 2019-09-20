const combinedApiStatus = (...statusses) => {
	const result = {
		done: true,
		pending: false,
		error: null,
	};

	statusses.forEach(status => {
		result.done = result.done && status.done; // All statusses need to be done
		result.pending = result.pending || status.pending; // Any status needs to be pending
		result.error = result.error || status.error; // Any status needs to have an error
	});

	return result;
};

export default combinedApiStatus;
