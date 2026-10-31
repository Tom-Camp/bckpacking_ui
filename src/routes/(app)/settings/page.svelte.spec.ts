import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { syncStatus } from '$lib/sync/status.svelte';
import { mockApi, respond } from '$lib/test/api';
import { trip, user } from '$lib/test/fixtures';
import { setNavigatorOnline, setOnline } from '$lib/test/online';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PASSWORD_ROUTE = 'POST /api/v1/users/me/password';
const STRONG = 'lantern-ridge-trail-mix-42';

type Screen = Awaited<ReturnType<typeof renderApp>>;

async function fillPasswords(screen: Screen, next = STRONG, confirm = next) {
	await screen.getByLabelText('Current password').fill('old-pass');
	await screen.getByLabelText('New password').fill(next);
	await screen.getByLabelText('Confirm new password').fill(confirm);
}

const me = user({
	username: 'hiker',
	first_name: 'Sam',
	body_weight_g: 72_500,
	measurements: 'metric'
});

describe('settings page', () => {
	it('fills the form from the profile', async () => {
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByText('hiker@example.com')).toBeVisible();
		await expect.element(screen.getByLabelText('Username')).toHaveValue('hiker');
		await expect.element(screen.getByLabelText('First name')).toHaveValue('Sam');
		await expect.element(screen.getByLabelText('Body weight')).toHaveValue(72.5);
	});

	it('saves the profile through the API', async () => {
		const requests = mockApi({
			'PATCH /api/v1/users/me': (body) => ({ ...me, ...(body as object) })
		});
		const screen = await renderApp(Page, {}, { user: me });

		await screen.getByLabelText('Last name').fill('  Ridge ');
		await screen.getByText('Imperial (lb, mi)').click();
		await expect.element(screen.getByText('lb', { exact: true })).toBeVisible();
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect
			.poll(() => requests[0]?.body)
			.toMatchObject({
				username: 'hiker',
				first_name: 'Sam',
				last_name: 'Ridge',
				measurements: 'imperial'
			});
		expect((requests[0].body as { body_weight_g: number }).body_weight_g).toBeCloseTo(72_500, -2);
		await expect.poll(async () => (await db.users.get(me.id))?.last_name).toBe('Ridge');
	});

	it('leaves the password fields alone when saving the profile', async () => {
		const requests = mockApi({ 'PATCH /api/v1/users/me': () => me });
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen);
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.poll(() => toast.success).toHaveBeenCalledWith('Profile saved');
		expect(requests.map((r) => r.route)).toEqual(['PATCH /api/v1/users/me']);
		await expect.element(screen.getByLabelText('New password')).toHaveValue(STRONG);
	});

	it('changes the password and clears the form', async () => {
		session.set('jwt-token');
		const requests = mockApi({ [PASSWORD_ROUTE]: () => respond(204) });
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen);
		await screen.getByRole('button', { name: 'Change password' }).click();

		await expect.poll(() => toast.success).toHaveBeenCalledWith('Password changed');
		expect(requests[0].body).toEqual({ current_password: 'old-pass', new_password: STRONG });
		for (const label of ['Current password', 'New password', 'Confirm new password'])
			await expect.element(screen.getByLabelText(label)).toHaveValue('');
		expect(session.signedIn).toBe(true);
	});

	it('shows a wrong current password without asking to sign in again', async () => {
		session.set('jwt-token');
		mockApi({
			[PASSWORD_ROUTE]: () => respond(400, { detail: 'Current password is incorrect' })
		});
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen);
		await screen.getByRole('button', { name: 'Change password' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Current password is incorrect');
		expect(session.rejected).toBe(false);
		expect(session.expired).toBe(false);
		expect(goto).not.toHaveBeenCalled();
	});

	it('shows the API’s reason for rejecting the new password', async () => {
		mockApi({
			[PASSWORD_ROUTE]: () =>
				respond(422, {
					detail: [{ loc: ['body', 'new_password'], msg: 'Password is too weak' }]
				})
		});
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen);
		await screen.getByRole('button', { name: 'Change password' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('new_password: Password is too weak');
	});

	it('won’t send a new password that doesn’t match its confirmation', async () => {
		const requests = mockApi({ [PASSWORD_ROUTE]: () => respond(204) });
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen, STRONG, `${STRONG}!`);
		await screen.getByRole('button', { name: 'Change password' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('New passwords don’t match.');
		expect(requests).toEqual([]);
	});

	it('needs a connection to change the password', async () => {
		setOnline(false);
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
	});

	it('explains, rather than sends, when the connection drops before the UI notices', async () => {
		const requests = mockApi({ [PASSWORD_ROUTE]: () => respond(204) });
		const screen = await renderApp(Page, {}, { user: me });
		await fillPasswords(screen);
		setNavigatorOnline(false);
		await screen.getByRole('button', { name: 'Change password' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('You’re offline. This needs a connection.');
		expect(requests).toEqual([]);
	});

	it('signs out, wiping this device', async () => {
		session.set('jwt-token');
		await db.trips.put(trip());
		const screen = await renderApp(Page, {}, { user: me });
		await screen.getByRole('button', { name: 'Sign out' }).click();

		await expect.poll(() => goto).toHaveBeenCalledWith('/login', { replaceState: true });
		expect(session.signedIn).toBe(false);
		expect(await db.trips.count()).toBe(0);
	});

	it('warns before signing out with unsynced changes', async () => {
		syncStatus.pending = 2;
		const screen = await renderApp(Page, {}, { user: me });
		await screen.getByRole('button', { name: 'Sign out' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toMatchTextContent('2 change(s) haven’t synced yet');
		expect(goto).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: 'Sign out' }).click();
		await expect.poll(() => goto).toHaveBeenCalledWith('/login', { replaceState: true });
	});
});
