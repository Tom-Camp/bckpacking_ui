import { describe, expect, it } from 'vitest';
import { goto } from '$app/navigation';
import type { User } from '$lib/api/types';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { adminUser, user } from '$lib/test/fixtures';
import { setNavigatorOnline, setOnline } from '$lib/test/online';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

const ROUTE = 'GET /api/v1/admin/users';

const me = adminUser();
const hiker = user({
	id: 'user-2',
	username: 'hiker',
	email: 'hiker@example.com',
	first_name: 'Sam',
	last_name: 'Ridge',
	last_login: '2026-03-04T15:30:00Z',
	email_verified_at: '2026-01-02T00:00:00Z'
});
const blocked = user({
	id: 'user-3',
	username: 'spammer',
	email: 'spam@example.com',
	status: 'blocked'
});

/** Mocks the list route, answering by `?status=`, and records each status asked for. */
function mockUsers(all: User[] = [me, hiker, blocked]) {
	const statuses: (string | null)[] = [];
	const requests = mockApi({
		[ROUTE]: (_body, request) => {
			const status = new URL(request.url).searchParams.get('status');
			statuses.push(status);
			return status ? all.filter((u) => u.status === status) : all;
		}
	});
	return { requests, statuses };
}

describe('admin page', () => {
	it('lists every user from the admin API', async () => {
		const { statuses } = mockUsers();
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByText('spam@example.com')).toBeVisible();
		await expect.poll(() => screen.getByTestId('admin-user-row').elements()).toHaveLength(3);
		const row = (username: string) =>
			screen.getByTestId('admin-user-row').filter({ hasText: username });
		await expect.element(row('hiker').getByText('Sam Ridge', { exact: true })).toBeVisible();
		await expect.element(row('hiker').getByText('Active', { exact: true })).toBeVisible();
		await expect.element(row('admin').getByText('Admin', { exact: true })).toBeVisible();
		// The blocked user has never logged in or verified their email.
		await expect.element(row('spammer').getByText('Blocked', { exact: true })).toBeVisible();
		await expect.element(row('spammer').getByText('Not verified', { exact: true })).toBeVisible();
		await expect.element(row('spammer').getByText('Never', { exact: true })).toBeVisible();
		await expect.element(row('hiker').getByText('Never', { exact: true })).not.toBeInTheDocument();
		expect(statuses).toEqual([null]);
		expect(goto).not.toHaveBeenCalled();
	});

	it('keeps admin data out of IndexedDB', async () => {
		mockUsers();
		const screen = await renderApp(Page, {}, { user: me });
		await expect.element(screen.getByText('spam@example.com')).toBeVisible();

		expect(await db.users.count()).toBe(0);
	});

	it('asks the API for the chosen status', async () => {
		const { statuses } = mockUsers();
		const screen = await renderApp(Page, {}, { user: me });
		await expect.element(screen.getByText('hiker@example.com')).toBeVisible();

		await screen.getByRole('radio', { name: 'Blocked' }).click();

		await expect.poll(() => statuses).toEqual([null, 'blocked']);
		await expect.element(screen.getByText('hiker@example.com')).not.toBeInTheDocument();
		await expect.element(screen.getByText('spam@example.com')).toBeVisible();

		await screen.getByRole('radio', { name: 'All' }).click();
		await expect.poll(() => statuses).toEqual([null, 'blocked', null]);
		await expect.element(screen.getByText('hiker@example.com')).toBeVisible();
	});

	it('sends a non-admin home without asking the admin API', async () => {
		const { requests } = mockUsers();
		const screen = await renderApp(Page, {}, { user: user() });

		await expect.poll(() => goto).toHaveBeenCalledWith('/', { replaceState: true });
		expect(requests).toEqual([]);
		expect(screen.container.textContent).not.toContain('Users');
	});

	it('waits for the profile before deciding', async () => {
		const { requests } = mockUsers();
		await renderApp(Page, {}, { user: undefined });

		// Give effects a chance to run.
		await new Promise((r) => setTimeout(r, 50));
		expect(goto).not.toHaveBeenCalled();
		expect(requests).toEqual([]);
	});

	it('needs a connection, and loads once it comes back', async () => {
		const { requests } = mockUsers();
		setOnline(false);
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByText(/Admin needs a connection/)).toBeVisible();
		expect(requests).toEqual([]);

		setOnline(true);
		await expect.element(screen.getByText('hiker@example.com')).toBeVisible();
		expect(requests.map((r) => r.route)).toEqual([ROUTE]);
	});

	it('stops asking after a 403', async () => {
		const requests = mockApi({ [ROUTE]: () => respond(403, { detail: 'Admin access required' }) });
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByText('You no longer have admin access.')).toBeVisible();
		expect(screen.getByRole('radio', { name: 'Blocked' }).query()).toBeNull();

		// Reconnecting doesn't retry.
		setOnline(false);
		setOnline(true);
		await new Promise((r) => setTimeout(r, 50));
		expect(requests).toHaveLength(1);
	});

	it('shows other errors from the API', async () => {
		mockApi({ [ROUTE]: () => respond(500, { detail: 'Database unavailable' }) });
		const screen = await renderApp(Page, {}, { user: me });

		await expect.element(screen.getByText('Database unavailable')).toBeVisible();
	});

	describe('row actions', () => {
		const USER_PATH = `/api/v1/admin/users/${hiker.id}`;

		/** The list plus whatever action routes a test needs. */
		function mockActions(routes: Parameters<typeof mockApi>[0] = {}) {
			return mockApi({ [ROUTE]: () => [me, hiker, blocked], ...routes });
		}

		async function setup(routes: Parameters<typeof mockApi>[0] = {}) {
			const requests = mockActions(routes);
			const screen = await renderApp(Page, {}, { user: me });
			await expect.element(screen.getByText('hiker@example.com')).toBeVisible();
			const row = (username: string) =>
				screen.getByTestId('admin-user-row').filter({ hasText: username });
			const menu = (username: string) =>
				screen.getByRole('button', { name: `Actions for ${username}` });
			const sent = () => requests.filter((r) => r.route !== ROUTE);
			return { screen, requests, row, menu, sent };
		}

		it('suspends a user after confirming', async () => {
			const { screen, row, menu, sent } = await setup({
				[`PATCH ${USER_PATH}/suspend`]: () => ({ ...hiker, status: 'blocked' })
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Suspend…' }).click();
			await expect.element(screen.getByRole('alertdialog')).toMatchTextContent(/Suspend hiker\?/);
			expect(sent()).toEqual([]);

			await screen.getByRole('button', { name: 'Suspend', exact: true }).click();
			await expect.element(row('hiker').getByText('Blocked', { exact: true })).toBeVisible();
			expect(sent()).toEqual([{ route: `PATCH ${USER_PATH}/suspend`, body: undefined }]);
			// The row was replaced, not refetched.
			await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
		});

		it('restores a blocked user', async () => {
			const { screen, row, menu, sent } = await setup({
				[`PATCH /api/v1/admin/users/${blocked.id}/approve`]: () => ({
					...blocked,
					status: 'active'
				})
			});

			await menu('spammer').click();
			await expect
				.element(screen.getByRole('menuitem', { name: 'Suspend…' }))
				.not.toBeInTheDocument();
			await screen.getByRole('menuitem', { name: 'Restore' }).click();

			await expect.element(row('spammer').getByText('Active', { exact: true })).toBeVisible();
			expect(sent().map((r) => r.route)).toEqual([
				`PATCH /api/v1/admin/users/${blocked.id}/approve`
			]);
		});

		it('changes a user’s role, offering only user and admin', async () => {
			const { screen, row, menu, sent } = await setup({
				[`PATCH ${USER_PATH}/role`]: (body) => ({ ...hiker, ...(body as object) })
			});

			await menu('hiker').click();
			expect(screen.getByRole('menuitem', { name: 'Make user' }).query()).toBeNull();
			expect(screen.getByRole('menuitem', { name: /unauthenticated/i }).query()).toBeNull();
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();

			await expect.element(row('hiker').getByText('Admin', { exact: true })).toBeVisible();
			expect(sent()).toEqual([{ route: `PATCH ${USER_PATH}/role`, body: { role: 'admin' } }]);

			await menu('hiker').click();
			await expect.element(screen.getByRole('menuitem', { name: 'Make user' })).toBeVisible();
		});

		it('deletes a user after confirming, and cancelling sends nothing', async () => {
			const { screen, row, menu, sent } = await setup({
				[`DELETE ${USER_PATH}`]: () => respond(204)
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Delete…' }).click();
			await expect
				.element(screen.getByRole('alertdialog'))
				.toMatchTextContent(/all of their trips and gear.*can’t be undone/);
			await screen.getByRole('button', { name: 'Cancel' }).click();
			await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
			expect(sent()).toEqual([]);

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Delete…' }).click();
			await screen.getByRole('button', { name: 'Delete', exact: true }).click();

			await expect.element(row('hiker')).not.toBeInTheDocument();
			await expect.poll(() => screen.getByTestId('admin-user-row').elements()).toHaveLength(2);
			expect(sent().map((r) => r.route)).toEqual([`DELETE ${USER_PATH}`]);
		});

		it('disables actions on the admin’s own row', async () => {
			const { screen, menu } = await setup();

			await expect.element(menu('admin')).toBeDisabled();
			await expect.element(menu('hiker')).toBeEnabled();
			await menu('admin').hover({ force: true });
			await expect
				.element(screen.getByText('You can’t change your own account').first())
				.toBeInTheDocument();
		});

		it('disables actions offline and sends nothing', async () => {
			const { screen, menu, sent } = await setup();

			setOnline(false);
			// The list stays hidden offline, so check the menu before the alert replaces it.
			await expect.element(screen.getByText(/Admin needs a connection/)).toBeVisible();
			expect(menu('hiker').query()).toBeNull();
			expect(sent()).toEqual([]);
		});

		it('sends nothing if the connection drops before the UI notices', async () => {
			const { screen, menu, sent } = await setup();

			await menu('hiker').click();
			setNavigatorOnline(false);
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();

			await expect.element(screen.getByText(/You’re offline/)).toBeVisible();
			expect(sent()).toEqual([]);
		});

		it('removes the row with a message when the user is already gone', async () => {
			const { screen, row, menu } = await setup({
				[`PATCH ${USER_PATH}/role`]: () => respond(404, { detail: 'User not found' })
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();

			await expect.element(screen.getByText('hiker no longer exists.')).toBeVisible();
			await expect.element(row('hiker')).not.toBeInTheDocument();
		});

		it('shows the lost-access state on a 403', async () => {
			const { screen, menu } = await setup({
				[`PATCH ${USER_PATH}/role`]: () => respond(403, { detail: 'Admin access required' })
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();

			await expect.element(screen.getByText('You no longer have admin access.')).toBeVisible();
			expect(screen.getByText('hiker@example.com').query()).toBeNull();
		});

		it('shows other errors inline', async () => {
			const { screen, row, menu } = await setup({
				[`PATCH ${USER_PATH}/role`]: () => respond(400, { detail: 'Cannot change your own role' })
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();

			await expect.element(screen.getByText('Cannot change your own role')).toBeVisible();
			await expect.element(row('hiker').getByText('User', { exact: true })).toBeVisible();
		});

		it('keeps action results out of IndexedDB', async () => {
			const { screen, row, menu } = await setup({
				[`PATCH ${USER_PATH}/role`]: (body) => ({ ...hiker, ...(body as object) })
			});

			await menu('hiker').click();
			await screen.getByRole('menuitem', { name: 'Make admin' }).click();
			await expect.element(row('hiker').getByText('Admin', { exact: true })).toBeVisible();

			expect(await db.users.count()).toBe(0);
		});
	});
});
