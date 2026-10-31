import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/sync/engine', () => ({ sync: vi.fn() }));

const { EMAIL_NOT_VERIFIED, isUnverified, register } = await import('./actions');
const { session } = await import('./session.svelte');
const { ApiError, OfflineError } = await import('$lib/api/client');
const { mockApi, respond } = await import('$lib/test/api');

describe('register', () => {
	it('creates the account without signing in', async () => {
		const requests = mockApi({
			'POST /api/v1/auth/register': () => respond(201, { message: 'Check your email' })
		});

		await register({ email: 'sam@example.com', username: 'sam', password: 'pw' });

		expect(requests.map((r) => r.route)).toEqual(['POST /api/v1/auth/register']);
		expect(session.signedIn).toBe(false);
	});
});

describe('isUnverified', () => {
	it('matches the API’s 403 for an unverified account', () => {
		expect(EMAIL_NOT_VERIFIED).toBe('Email not verified');
		expect(isUnverified(new ApiError(403, 'Email not verified'))).toBe(true);
	});

	it.each([
		['another 403', new ApiError(403, 'Account suspended')],
		['the same detail with another status', new ApiError(401, 'Email not verified')],
		['a validation error', new ApiError(403, [{ msg: 'Email not verified' }])],
		['an offline error', new OfflineError()],
		['a plain error', new Error('Email not verified')]
	])('ignores %s', (_, error) => {
		expect(isUnverified(error)).toBe(false);
	});
});
