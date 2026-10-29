import { beforeEach, describe, expect, it } from 'vitest';
import { session } from './session.svelte';

/** An unsigned JWT with the given payload, base64url-encoded like the API's. */
const jwt = (payload: object) =>
	['header', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s;

beforeEach(() => {
	session.clear();
});

describe('session', () => {
	it('is signed out and expired with no token', () => {
		expect(session.signedIn).toBe(false);
		expect(session.expired).toBe(true);
	});

	it('reads `exp` from a base64url payload', () => {
		// '~~~???' encodes to '-' and '_', which plain atob rejects.
		session.set(jwt({ sub: '~~~???', exp: inSeconds(3600) }));
		expect(session.signedIn).toBe(true);
		expect(session.expired).toBe(false);

		session.set(jwt({ sub: '~~~???', exp: inSeconds(-60) }));
		expect(session.signedIn).toBe(true);
		expect(session.expired).toBe(true);
	});

	it.each([
		['a token without exp', jwt({ sub: 'user-1' })],
		['a non-numeric exp', jwt({ exp: 'soon' })],
		['a malformed token', 'not-a-jwt'],
		['a payload that isn’t JSON', 'header.bm90IGpzb24.sig']
	])('leaves %s to the API to judge', (_case, token) => {
		session.set(token);
		expect(session.expired).toBe(false);
	});

	it('stays expired after a 401 until a new token is set', () => {
		session.set(jwt({ exp: inSeconds(3600) }));
		session.markRejected();
		expect(session.rejected).toBe(true);
		expect(session.expired).toBe(true);
		expect(session.signedIn).toBe(true);

		session.set(jwt({ exp: inSeconds(3600) }));
		expect(session.rejected).toBe(false);
		expect(session.expired).toBe(false);
	});

	it('forgets the token and the rejection when cleared', () => {
		session.set(jwt({ exp: inSeconds(3600) }));
		session.markRejected();
		session.clear();
		expect(session.token).toBeNull();
		expect(session.rejected).toBe(false);
		expect(session.signedIn).toBe(false);
	});
});
