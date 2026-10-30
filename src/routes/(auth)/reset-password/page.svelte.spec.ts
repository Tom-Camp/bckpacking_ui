import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { mockApi, respond } from '$lib/test/api';
import { setRoute } from '$lib/test/route';
import Page from './+page.svelte';

const PASSWORD = 'Ridge-Sunrise-Trailhead-2026!';

async function renderWithToken(hash = '#reset-tok') {
	setRoute(`/reset-password${hash}`);
	return render(Page);
}

async function choose(screen: Awaited<ReturnType<typeof render>>, next: string, confirm = next) {
	await screen.getByLabelText('New password', { exact: true }).fill(next);
	await screen.getByLabelText('Confirm new password').fill(confirm);
	await screen.getByRole('button', { name: 'Set new password' }).click();
}

describe('reset password page', () => {
	it('shows an incomplete link without a token and makes no request', async () => {
		const requests = mockApi({});
		const screen = await renderWithToken('');

		await expect.element(screen.getByText('This reset link is incomplete')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Request a new link' }))
			.toHaveAttribute('href', '/forgot-password');
		await expect.element(screen.getByLabelText('Confirm new password')).not.toBeInTheDocument();
		expect(requests).toEqual([]);
	});

	it('doesn’t submit passwords that don’t match', async () => {
		const requests = mockApi({});
		const screen = await renderWithToken();
		await choose(screen, PASSWORD, `${PASSWORD}x`);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Passwords don’t match.');
		expect(requests).toEqual([]);
	});

	it('doesn’t submit a weak password', async () => {
		const requests = mockApi({});
		const screen = await renderWithToken();
		await screen.getByLabelText('New password', { exact: true }).fill('password123');
		await expect.element(screen.getByText(/^Very weak — /)).toBeVisible();
		await screen.getByLabelText('Confirm new password').fill('password123');
		await screen.getByRole('button', { name: 'Set new password' }).click();

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(requests).toEqual([]);
	});

	it('posts the token and password, then goes to sign in without signing in', async () => {
		const requests = mockApi({ 'POST /api/v1/auth/reset-password': () => respond(204) });
		const screen = await renderWithToken();
		await choose(screen, PASSWORD);

		await expect.poll(() => goto).toHaveBeenCalledWith('/login?reset=1', { replaceState: true });
		expect(requests).toEqual([
			{
				route: 'POST /api/v1/auth/reset-password',
				body: { token: 'reset-tok', password: PASSWORD }
			}
		]);
		expect(session.signedIn).toBe(false);
	});

	it('offers a new link when the token is invalid or expired', async () => {
		mockApi({
			'POST /api/v1/auth/reset-password': () =>
				respond(400, { detail: 'This reset link is invalid or has expired' })
		});
		const screen = await renderWithToken();
		await choose(screen, PASSWORD);

		await expect
			.element(screen.getByText('This reset link is invalid or has expired'))
			.toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Request a new link' }))
			.toHaveAttribute('href', '/forgot-password');
		expect(goto).not.toHaveBeenCalled();
	});

	it('shows the API’s 422 and keeps the form so another password can be tried', async () => {
		let attempt = 0;
		const requests = mockApi({
			'POST /api/v1/auth/reset-password': () =>
				++attempt === 1
					? respond(422, {
							detail: [{ loc: ['body', 'password'], msg: 'Password is too weak' }]
						})
					: respond(204)
		});
		const screen = await renderWithToken();
		await choose(screen, PASSWORD);

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('password: Password is too weak');
		await expect.element(screen.getByRole('button', { name: 'Set new password' })).toBeEnabled();

		await choose(screen, `${PASSWORD}-again`);
		await expect.poll(() => goto).toHaveBeenCalledWith('/login?reset=1', { replaceState: true });
		expect(requests.map((r) => (r.body as { token: string }).token)).toEqual([
			'reset-tok',
			'reset-tok'
		]);
	});
});
