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

	it('links to registration', async () => {
		const screen = await render(Page);
		await expect
			.element(screen.getByRole('link', { name: 'Create an account' }))
			.toHaveAttribute('href', '/register');
	});
});
