import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Trip } from '$lib/api/types';
import { db } from '$lib/data/db';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Checklist from './Checklist.svelte';

async function setup(t: Trip = trip()) {
	await db.trips.put(t);
	return renderApp(Checklist, { trip: t });
}

describe('Checklist', () => {
	it('lists items in checklist order with what is left to do', async () => {
		const screen = await setup();
		await expect.element(screen.getByText('2 of 2 still to do.', { exact: false })).toBeVisible();
		const labels = screen
			.getByRole('listitem')
			.elements()
			.map((li) => li.dataset.testid);
		expect(labels).toEqual(['checklist-permit', 'checklist-shuttle_scheduled']);
	});

	it('says the trip is ready when nothing is left to do', async () => {
		const t = trip();
		for (const item of t.checklist_items) item.status = 'done';
		const screen = await setup(t);
		await expect.element(screen.getByText(/You’re ready to go/)).toBeVisible();
	});

	it('saves a status change on the device and queues it for sync', async () => {
		const screen = await setup();
		await screen.getByTestId('checklist-permit').getByText('Done').click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.checklist_items[0].status)
			.toBe('done');
		const [queued] = await db.outbox.toArray();
		expect(queued).toMatchObject({
			path: '/api/v1/trips/trip-1/checklist/permit',
			body: { status: 'done' },
			label: 'Checklist: Permit'
		});
	});

	it('saves details when the field loses focus', async () => {
		const screen = await setup();
		const details = screen.getByTestId('checklist-permit').getByPlaceholder('Add details');
		await details.fill('  Ranger station, pick up Friday ');
		await userEvent.tab();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.checklist_items[0].details)
			.toBe('Ranger station, pick up Friday');
	});
});
