import { api, call } from '$lib/api/client';
import type { UserCreate } from '$lib/api/types';
import { clearLocalData, db, requestPersistentStorage } from '$lib/data/db';
import { sync } from '$lib/sync/engine';
import { session } from './session.svelte';

export async function login(email: string, password: string): Promise<void> {
	const { access_token } = await call(() =>
		api.POST('/api/v1/auth/login', { body: { email, password } })
	);
	const previous = { token: session.token, rejected: session.rejected };
	session.set(access_token);

	// Keep cached data (and queued edits) when the same user signs back in after the token
	// expired; wipe it if someone else signs in on this device.
	let me;
	try {
		me = await call(() => api.GET('/api/v1/users/me'));
	} catch (e) {
		// Without the profile we can't tell whose cache this is, so put the old session back
		// rather than leave the new token next to someone else's queued edits.
		if (previous.token === null) session.clear();
		else {
			session.set(previous.token);
			if (previous.rejected) session.markRejected();
		}
		throw e;
	}
	const cached = await db.users.toCollection().first();
	if (cached && cached.id !== me.id) await clearLocalData();
	await db.users.put(me);

	void requestPersistentStorage();
	void sync();
}

export async function register(body: UserCreate): Promise<void> {
	await call(() => api.POST('/api/v1/auth/register', { body }));
	await login(body.email, body.password);
}

export async function logout(): Promise<void> {
	session.clear();
	await clearLocalData();
}
