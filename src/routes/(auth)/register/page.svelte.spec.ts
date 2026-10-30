import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import Page from './+page.svelte';

async function fill(screen: Awaited<ReturnType<typeof render>>, password: string) {
	await screen.getByLabelText('First name').fill('Sam');
	await screen.getByLabelText('Username').fill('sam_hikes');
	await screen.getByLabelText('Email').fill('sam@example.com');
	await screen.getByLabelText('Password').fill(password);
}

describe('register page', () => {
	it('warns about a weak password and does not submit it', async () => {
		const requests = mockApi({});
		const screen = await render(Page);
		await fill(screen, 'password123');

		await expect.element(screen.getByText(/^Very weak — /)).toBeVisible();
		await expect.element(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
		await screen.getByRole('button', { name: 'Create account' }).click();

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(requests).toEqual([]);
	});

	it('creates the account and asks the user to check their inbox, without signing in', async () => {
		const requests = mockApi({
			'POST /api/v1/auth/register': () =>
				respond(201, {
					message: 'Registration successful. Check your email to verify your account.'
				})
		});
		const screen = await render(Page);
		await fill(screen, 'Ridge-Sunrise-Trailhead-2026!');
		await expect.element(screen.getByText('Very strong')).toBeVisible();
		await screen.getByRole('button', { name: 'Create account' }).click();

		await expect.element(screen.getByText('Check your inbox')).toBeVisible();
		await expect.element(screen.getByText('sam@example.com')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Sign in' }))
			.toHaveAttribute('href', '/login');
		expect(requests).toEqual([
			{
				route: 'POST /api/v1/auth/register',
				body: {
					email: 'sam@example.com',
					username: 'sam_hikes',
					password: 'Ridge-Sunrise-Trailhead-2026!',
					first_name: 'Sam',
					last_name: null
				}
			}
		]);
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
		expect(await db.users.count()).toBe(0);
	});

	it('resends the verification email to the address entered', async () => {
		const requests = mockApi({
			'POST /api/v1/auth/register': () => respond(201, { message: 'ok' }),
			'POST /api/v1/auth/resend-verification': () =>
				respond(202, { message: 'If that account needs verifying, we’ve sent a new link.' })
		});
		const screen = await render(Page);
		await fill(screen, 'Ridge-Sunrise-Trailhead-2026!');
		await screen.getByRole('button', { name: 'Create account' }).click();
		await screen.getByRole('button', { name: 'Resend email' }).click();

		await expect
			.element(screen.getByRole('status'))
			.toHaveTextContent('If that account needs verifying, we’ve sent a new link.');
		expect(requests[1]).toEqual({
			route: 'POST /api/v1/auth/resend-verification',
			body: { email: 'sam@example.com' }
		});
	});

	it('shows the API’s error when registration is rejected', async () => {
		mockApi({
			'POST /api/v1/auth/register': () => respond(409, { detail: 'Email already registered' })
		});
		const screen = await render(Page);
		await fill(screen, 'Ridge-Sunrise-Trailhead-2026!');
		await screen.getByRole('button', { name: 'Create account' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Email already registered');
		expect(goto).not.toHaveBeenCalled();
	});
});
