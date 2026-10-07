import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { user } from '$lib/test/fixtures';
import Page from './+page.svelte';

async function signIn(screen: Awaited<ReturnType<typeof render>>) {
	await screen.getByLabelText('Email').fill('hiker@example.com');
	await screen.getByLabelText('Password').fill('Ridge-Sunrise-Trailhead-2026!');
	await screen.getByRole('button', { name: 'Sign in' }).click();
}

describe('login page', () => {
	it('signs in, caches the profile and goes to the trips list', async () => {
		const me = user();
		const requests = mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => me
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.poll(() => goto).toHaveBeenCalledWith('/');
		expect(requests[0].body).toEqual({
			email: 'hiker@example.com',
			password: 'Ridge-Sunrise-Trailhead-2026!'
		});
		expect(session.token).toBe('jwt-token');
		expect(await db.users.get(me.id)).toEqual(me);
	});

	it('shows the API’s error and stays on the page', async () => {
		mockApi({
			'POST /api/v1/auth/login': () => respond(401, { detail: 'Invalid email or password' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
		await expect.element(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
	});

	it('signs back out and leaves cached data alone when the profile request fails', async () => {
		const previous = user({ id: 'previous-user' });
		await db.users.put(previous);
		await db.outbox.add({
			method: 'PATCH',
			path: '/api/v1/trips/1',
			body: { name: 'Renamed' },
			label: 'Rename trip',
			createdAt: 1,
			attempts: 0
		});
		mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => respond(503, { detail: 'Service unavailable' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
		expect(await db.users.toArray()).toEqual([previous]);
		expect(await db.outbox.count()).toBe(1);
	});

	it('keeps the previous expired session when the profile request fails', async () => {
		session.set('old-token');
		session.markRejected();
		mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => respond(503, { detail: 'Service unavailable' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(session.token).toBe('old-token');
		expect(session.expired).toBe(true);
	});

	it('links to registration', async () => {
		const screen = await render(Page);
		await expect
			.element(screen.getByRole('link', { name: 'Create an account' }))
			.toHaveAttribute('href', '/register');
	});
});
