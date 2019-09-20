import combinedApiStatus from '../combinedApiStatus';

describe('combinedApiStatus', () => {
	test('Expect a single status to resolve to the same status', () => {
		const input1 = { done: true, pending: false, error: 'yea' };

		expect(combinedApiStatus(input1)).toEqual(input1);

		const input2 = { done: false, pending: true, error: null };

		expect(combinedApiStatus(input2)).toEqual(input2);
	});

	test('Expect result status to have an error if one of all inputs has an error, in case of multiple errors we expect the first one', () => {
		const input1 = { done: true, pending: false, error: 'yea' };
		const input2 = { done: false, pending: true, error: null };

		expect(combinedApiStatus(input1, input2)).toEqual(expect.objectContaining({
			error: 'yea',
		}));

		const input3 = { done: true, pending: false, error: 'yea' };
		const input4 = { done: false, pending: true, error: null };
		const input5 = { done: true, pending: false, error: 'boooi' };

		expect(combinedApiStatus(input3, input4, input5)).toEqual(expect.objectContaining({
			error: 'yea',
		}));
	});

	test('Expect result status to be done only if all inputs are done', () => {
		const input1 = { done: true, pending: false, error: 'yea' };
		const input2 = { done: false, pending: true, error: null };

		expect(combinedApiStatus(input1, input2)).toEqual(expect.objectContaining({
			done: false,
		}));

		const input3 = { done: true, pending: false, error: 'yea' };
		const input4 = { done: true, pending: false, error: null };
		const input5 = { done: true, pending: false, error: 'boooi' };

		expect(combinedApiStatus(input3, input4, input5)).toEqual(expect.objectContaining({
			done: true,
		}));
	});

	test('Expect result status to be pending as long as at least one input is pending', () => {
		const input1 = { done: true, pending: false, error: 'yea' };
		const input2 = { done: false, pending: true, error: null };

		expect(combinedApiStatus(input1, input2)).toEqual(expect.objectContaining({
			pending: true,
		}));

		const input3 = { done: true, pending: false, error: 'yea' };
		const input4 = { done: true, pending: false, error: null };
		const input5 = { done: true, pending: false, error: 'boooi' };

		expect(combinedApiStatus(input3, input4, input5)).toEqual(expect.objectContaining({
			pending: false,
		}));
	});
});
