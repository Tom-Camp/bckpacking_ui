import { describe, expect, it } from 'vitest';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { syncStatus } from '$lib/sync/status.svelte';
import { mockApi } from '$lib/test/api';
import { trip, user } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

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
			.toHaveTextContent('2 change(s) haven’t synced yet');
		expect(goto).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: 'Sign out' }).click();
		await expect.poll(() => goto).toHaveBeenCalledWith('/login', { replaceState: true });
	});
});
