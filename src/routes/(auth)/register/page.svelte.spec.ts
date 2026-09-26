import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { mockApi, respond } from '$lib/test/api';
import { user } from '$lib/test/fixtures';
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

	it('creates the account, signs in and goes to the trips list', async () => {
		const me = user({ username: 'sam_hikes', email: 'sam@example.com', first_name: 'Sam' });
		const requests = mockApi({
			'POST /api/v1/auth/register': () => respond(201, me),
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => me
		});
		const screen = await render(Page);
		await fill(screen, 'Ridge-Sunrise-Trailhead-2026!');
		await expect.element(screen.getByText('Very strong')).toBeVisible();
		await screen.getByRole('button', { name: 'Create account' }).click();

		await expect.poll(() => goto).toHaveBeenCalledWith('/');
		expect(requests[0]).toEqual({
			route: 'POST /api/v1/auth/register',
			body: {
				email: 'sam@example.com',
				username: 'sam_hikes',
				password: 'Ridge-Sunrise-Trailhead-2026!',
				first_name: 'Sam',
				last_name: null
			}
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
