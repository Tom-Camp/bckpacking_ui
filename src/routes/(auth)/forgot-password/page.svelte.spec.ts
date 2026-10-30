import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { mockApi, respond } from '$lib/test/api';
import Page from './+page.svelte';

const NEUTRAL = 'If an account exists for that email, we’ve sent a reset link.';

async function requestLink(email = 'hiker@example.com') {
	const screen = await render(Page);
	await screen.getByLabelText('Email').fill(email);
	await screen.getByRole('button', { name: 'Send reset link' }).click();
	return screen;
}

describe('forgot password page', () => {
	it('posts the email and shows the API’s neutral message', async () => {
		const requests = mockApi({
			'POST /api/v1/auth/forgot-password': () => respond(202, { message: NEUTRAL })
		});
		const screen = await requestLink();

		await expect.element(screen.getByRole('status')).toHaveTextContent(NEUTRAL);
		await expect
			.element(screen.getByRole('button', { name: 'Send reset link' }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('link', { name: 'Back to sign in' }))
			.toHaveAttribute('href', '/login');
		expect(requests).toEqual([
			{ route: 'POST /api/v1/auth/forgot-password', body: { email: 'hiker@example.com' } }
		]);
	});

	it('shows the same message for an unknown address', async () => {
		mockApi({ 'POST /api/v1/auth/forgot-password': () => respond(202, { message: NEUTRAL }) });
		const screen = await requestLink('nobody@example.com');

		await expect.element(screen.getByRole('status')).toHaveTextContent(NEUTRAL);
	});

	it('shows an error when the request can’t reach the API', async () => {
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('Failed to fetch');
		});
		const screen = await requestLink();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('You’re offline. This needs a connection.');
		await expect.element(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
	});

	it('shows a rate limit without a JSON body readably', async () => {
		vi.stubGlobal(
			'fetch',
			async () => new Response('<html>429 Too Many Requests</html>', { status: 429 })
		);
		const screen = await requestLink();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Too many requests, try again in a minute');
	});

	it('shows nginx’s JSON rate limit message', async () => {
		mockApi({
			'POST /api/v1/auth/forgot-password': () =>
				respond(429, { detail: 'Too many attempts. Try again in a minute.' })
		});
		const screen = await requestLink();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Too many attempts. Try again in a minute.');
	});
});
