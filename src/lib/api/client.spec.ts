import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '$lib/auth/session.svelte';
import { ApiError, authedFetch, call, describeDetail, OfflineError } from './client';

describe('describeDetail', () => {
	it('passes a string through', () => {
		expect(describeDetail('Trip not found')).toBe('Trip not found');
	});

	it('names the field for each validation error, without the "body" prefix', () => {
		expect(
			describeDetail([
				{ loc: ['body', 'name'], msg: 'String should have at least 1 character' },
				{ loc: ['body', 'food', 0, 'kcal'], msg: 'Input should be a valid integer' },
				{ loc: ['body'], msg: 'Field required' },
				{ msg: 'Something else' }
			])
		).toBe(
			'name: String should have at least 1 character; food.0.kcal: Input should be a valid integer; Field required; Something else'
		);
	});

	it.each([[undefined], [null], [42], [{ message: 'nope' }]])(
		'returns undefined for %o',
		(detail) => {
			expect(describeDetail(detail)).toBeUndefined();
		}
	);
});

describe('call', () => {
	const ok = (data: unknown) => ({ data, response: new Response(null, { status: 200 }) });

	it('returns the data', async () => {
		expect(await call(async () => ok({ id: 't' }))).toEqual({ id: 't' });
	});

	it('turns a network failure into OfflineError', async () => {
		await expect(
			call(async () => {
				throw new TypeError('Failed to fetch');
			})
		).rejects.toBeInstanceOf(OfflineError);
	});

	it('rethrows other errors as they are', async () => {
		const error = new RangeError('bug');
		await expect(
			call(async () => {
				throw error;
			})
		).rejects.toBe(error);
	});

	it('throws ApiError with the status and the API’s detail', async () => {
		const promise = call(async () => ({
			error: { detail: 'Trip not found' },
			response: new Response(null, { status: 404 })
		}));
		await expect(promise).rejects.toBeInstanceOf(ApiError);
		await expect(promise).rejects.toMatchObject({ status: 404, message: 'Trip not found' });
	});
});

describe('authedFetch', () => {
	beforeEach(() => {
		session.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends the bearer token and marks the session rejected on 401', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
		vi.stubGlobal('fetch', fetchMock);
		session.set('tok');

		await authedFetch('http://localhost/api/v1/trips');

		const [request] = fetchMock.mock.calls[0] as unknown as [Request];
		expect(request.headers.get('Authorization')).toBe('Bearer tok');
		expect(session.rejected).toBe(true);
	});

	it('leaves the session alone on other errors', async () => {
		vi.stubGlobal('fetch', async () => new Response(null, { status: 403 }));
		session.set('tok');

		await authedFetch('http://localhost/api/v1/trips');

		expect(session.rejected).toBe(false);
	});
});
