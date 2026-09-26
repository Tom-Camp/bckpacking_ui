import { describe, expect, it } from 'vitest';
import { db } from '$lib/data/db';
import { syncStatus } from '$lib/sync/status.svelte';
import { gearItem, trip, tripGear } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

describe('trips page', () => {
	it('invites creating a first trip', async () => {
		const screen = await renderApp(Page);
		await expect.element(screen.getByText('No trips yet')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'New trip' }))
			.toHaveAttribute('href', '/trips/new');
	});

	it('lists saved trips newest first with readiness and pack weight', async () => {
		const ready = trip({
			id: 'trip-2',
			name: 'Linville Gorge',
			trip_type: 'loop',
			created_at: '2026-02-01T00:00:00Z',
			checklist_ready: true,
			gear_list: [tripGear(gearItem({ weight_g: 1000 }))]
		});
		await db.trips.bulkPut([trip(), ready]);
		const screen = await renderApp(Page, {}, { units: 'metric' });

		const cards = screen.getByRole('link', { name: /Art Loeb|Linville Gorge/ });
		await expect.element(cards.first()).toHaveTextContent('Linville Gorge');
		await expect.element(cards.first()).toHaveAttribute('href', '/trips/trip-2');
		await expect.element(cards.first()).toHaveTextContent(/Loop.*Ready.*Pack 1 kg/);
		await expect.element(cards.nth(1)).toHaveTextContent(/Pisgah.*Aug 26 – Aug 28, 2026/);
		await expect.element(cards.nth(1)).toHaveTextContent(/Point to point.*2 to do/);
	});

	it('cannot start a new trip offline', async () => {
		syncStatus.online = false;
		const screen = await renderApp(Page);
		const newTrip = screen.getByRole('link', { name: 'New trip' });
		await expect.element(newTrip).toHaveAttribute('aria-disabled', 'true');
		await expect.element(newTrip).not.toHaveAttribute('href');
	});
});
