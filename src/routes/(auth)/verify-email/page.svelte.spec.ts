import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { mockApi, respond } from '$lib/test/api';
import { setRoute } from '$lib/test/route';
import Page from './+page.svelte';

describe('verify email page', () => {
	it('posts the token once and goes to sign in', async () => {
		setRoute('/verify-email#tok-123');
		const requests = mockApi({ 'POST /api/v1/auth/verify-email': () => respond(204) });
		await render(Page);

		await expect.poll(() => goto).toHaveBeenCalledWith('/login?verified=1', { replaceState: true });
		expect(requests).toEqual([
			{ route: 'POST /api/v1/auth/verify-email', body: { token: 'tok-123' } }
		]);
	});

	it('shows that it is verifying while the request runs', async () => {
		setRoute('/verify-email#tok-123');
		mockApi({ 'POST /api/v1/auth/verify-email': () => new Promise(() => {}) });
		const screen = await render(Page);

		await expect.element(screen.getByText('Verifying…')).toBeVisible();
		expect(goto).not.toHaveBeenCalled();
	});

	it('offers a new link when the token is invalid or expired', async () => {
		setRoute('/verify-email#old-token');
		const requests = mockApi({
			'POST /api/v1/auth/verify-email': () =>
				respond(400, { detail: 'This verification link is invalid or has expired' }),
			'POST /api/v1/auth/resend-verification': () =>
				respond(202, { message: 'If that account needs verifying, we’ve sent a new link.' })
		});
		const screen = await render(Page);

		await expect.element(screen.getByText('This link is invalid or has expired')).toBeVisible();
		await screen.getByLabelText('Email').fill('sam@example.com');
		await screen.getByRole('button', { name: 'Send a new link' }).click();

		await expect
			.element(screen.getByRole('status'))
			.toHaveTextContent('If that account needs verifying, we’ve sent a new link.');
		expect(requests[1]).toEqual({
			route: 'POST /api/v1/auth/resend-verification',
			body: { email: 'sam@example.com' }
		});
		expect(goto).not.toHaveBeenCalled();
	});

	it('shows other errors', async () => {
		setRoute('/verify-email#tok-123');
		mockApi({
			'POST /api/v1/auth/verify-email': () => respond(503, { detail: 'Service unavailable' })
		});
		const screen = await render(Page);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
		expect(goto).not.toHaveBeenCalled();
	});

	it('makes no request without a token', async () => {
		setRoute('/verify-email');
		const requests = mockApi({});
		const screen = await render(Page);

		await expect.element(screen.getByText('This verification link is incomplete')).toBeVisible();
		expect(requests).toEqual([]);
		expect(goto).not.toHaveBeenCalled();
	});
});
