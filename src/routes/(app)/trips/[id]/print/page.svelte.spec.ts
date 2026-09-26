import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { db } from '$lib/data/db';
import { food, gearItem, note, trip, tripGear, user } from '$lib/test/fixtures';
import { setRoute } from '$lib/test/route';
import Page from './+page@.svelte';

beforeEach(() => {
	setRoute('/trips/trip-1/print', { id: 'trip-1' });
});

describe('print page', () => {
	it('says when the trip is not on this device', async () => {
		const screen = await render(Page);
		await expect.element(screen.getByText('Trip not found on this device.')).toBeVisible();
	});

	it('prints everything needed on the trail in the user’s units', async () => {
		const t = trip({
			emergency_contact: 'Sam 555-0100',
			start_trailhead: 'Davidson River',
			end_trailhead: 'Camp Daniel Boone',
			water_carry_l: 2,
			gear_list: [
				tripGear(gearItem({ name: 'Tent', weight_g: 1000 }), { packed: true }),
				tripGear(gearItem({ name: 'Stakes', weight_g: 10 }), { quantity: 6 })
			],
			notes: [note({ content: 'Water at mile 4' })]
		});
		t.checklist_items[0].status = 'done';
		t.checklist_items[0].details = 'Picked up';
		t.food_plan!.food = [food({ name: 'Oatmeal', servings: 2 })];
		await db.trips.put(t);
		await db.users.put(user({ measurements: 'metric' }));
		const screen = await render(Page);

		await expect.element(screen.getByRole('heading', { name: 'Art Loeb', level: 1 })).toBeVisible();
		await expect
			.element(screen.getByText('Pisgah · Aug 26 – Aug 28, 2026 · Point to point'))
			.toBeVisible();
		await expect.element(screen.getByText('Sam 555-0100')).toBeVisible();
		await expect.element(screen.getByText('Start: Davidson River')).toBeVisible();
		await expect.element(screen.getByText('End: Camp Daniel Boone')).toBeVisible();
		await expect.element(screen.getByText('[x]').first()).toBeVisible();
		await expect.element(screen.getByText(/Permit\s*\(Done\)\s*: Picked up/)).toBeVisible();
		await expect.element(screen.getByText(/Pack 3.26 kg/)).toBeVisible();
		await expect.element(screen.getByText(/Stakes ×6/)).toBeVisible();
		await expect.element(screen.getByText('Oatmeal ×2')).toBeVisible();
		await expect.element(screen.getByText('Water at mile 4')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Back' }))
			.toHaveAttribute('href', '/trips/trip-1');
	});

	it('leaves out empty sections', async () => {
		await db.trips.put(trip());
		const screen = await render(Page);

		await expect.element(screen.getByRole('heading', { name: 'Pre-trip checklist' })).toBeVisible();
		for (const section of ['Gear', 'Food', 'Notes', 'Emergency contact'])
			await expect.element(screen.getByRole('heading', { name: section })).not.toBeInTheDocument();
	});
});
