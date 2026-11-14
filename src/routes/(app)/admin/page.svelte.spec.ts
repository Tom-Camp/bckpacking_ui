import { describe, expect, it } from 'vitest';
import { goto } from '$app/navigation';
import type { User } from '$lib/api/types';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { adminUser, user } from '$lib/test/fixtures';
import { setOnline } from '$lib/test/online';
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
});
