import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import type { Trip } from '$lib/api/types';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { gearItem, trip, tripGear } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import GearList from './GearList.svelte';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const tent = gearItem({ name: 'Tent', category: 'shelter', weight_g: 1000 });
const stakes = gearItem({ name: 'Stakes', category: 'shelter', weight_g: 10 });
const jacket = gearItem({ name: 'Jacket', category: 'clothing', weight_g: 300, kind: 'worn' });
const stove = gearItem({ name: 'Stove', category: 'cooking_water', weight_g: 85 });

const tentLine = tripGear(tent, { packed: true });
const stakesLine = tripGear(stakes, { quantity: 6 });
const jacketLine = tripGear(jacket);

async function setup(t: Trip = trip({ gear_list: [tentLine, stakesLine, jacketLine] })) {
	await db.gearItems.bulkPut([tent, stakes, jacket, stove]);
	await db.trips.put(t);
	return renderApp(GearList, { trip: t }, { units: 'metric' });
}

describe('GearList', () => {
	it('groups gear by category with weights and packing progress', async () => {
		const screen = await setup();

		await expect.element(screen.getByText('1 of 3 packed')).toBeVisible();
		const headings = screen.getByRole('heading', { level: 3 }).elements();
		expect(headings.map((h) => h.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'Clothing 0 g',
			'Shelter 1.06 kg'
		]);
		await expect.element(screen.getByText('worn, not in pack weight')).toBeVisible();
		await expect.element(screen.getByTestId('gear-Stakes')).toHaveTextContent(/6.*60 g/);
	});

	it('points to the closet when the list is empty', async () => {
		const screen = await setup(trip());
		await expect.element(screen.getByText(/No gear yet/)).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Copy from trip' })).toBeDisabled();
	});

	it('marks gear packed offline', async () => {
		const screen = await setup();
		await screen.getByRole('checkbox', { name: 'Packed Stakes' }).click();

		await expect
			.poll(
				async () =>
					(await db.trips.get('trip-1'))?.gear_list.find((l) => l.id === stakesLine.id)?.packed
			)
			.toBe(true);
		expect((await db.outbox.toArray())[0]).toMatchObject({
			path: `/api/v1/trips/trip-1/gear/${stakesLine.id}`,
			body: { packed: true }
		});
	});

	it('changes quantity but not below one', async () => {
		const screen = await setup();
		const tentRow = screen.getByTestId('gear-Tent');
		await expect.element(tentRow.getByRole('button', { name: 'Fewer' })).toBeDisabled();

		await screen.getByTestId('gear-Stakes').getByRole('button', { name: 'Fewer' }).click();
		await expect
			.poll(
				async () =>
					(await db.trips.get('trip-1'))?.gear_list.find((l) => l.id === stakesLine.id)?.quantity
			)
			.toBe(5);
	});

	it('adds gear from the closet, hiding what is already on the trip', async () => {
		const added = tripGear(stove);
		const requests = mockApi({ 'POST /api/v1/trips/trip-1/gear': () => added });
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();

		const dialog = screen.getByRole('dialog');
		await expect.element(dialog.getByRole('button', { name: /Stove/ })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /Tent/ })).not.toBeInTheDocument();
		await dialog.getByPlaceholder('Search').fill('cooking');
		await dialog.getByRole('button', { name: /Stove/ }).click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.gear_list.map((l) => l.gear_item.name))
			.toContain('Stove');
		expect(requests[0].body).toEqual({ gear_item_id: stove.id, quantity: 1, packed: false });
	});

	it('says so when everything in the closet is already on the trip', async () => {
		const screen = await setup(
			trip({ gear_list: [tentLine, stakesLine, jacketLine, tripGear(stove)] })
		);
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await expect.element(screen.getByText('No more items to add.')).toBeVisible();
	});

	it('creates new gear in the closet and adds it to the trip', async () => {
		const created = gearItem({ name: 'Filter', category: 'cooking_water', weight_g: 85 });
		const requests = mockApi({
			'POST /api/v1/gear': () => created,
			'POST /api/v1/trips/trip-1/gear': () => tripGear(created)
		});
		const screen = await setup();
		await screen.getByRole('button', { name: 'New gear' }).click();

		await screen.getByLabelText('Name').fill('Filter');
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Cooking & Water' }).click();
		await screen.getByLabelText('Weight (each)').fill('85');
		await screen.getByRole('button', { name: 'Add to closet & trip' }).click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.gear_list.map((l) => l.gear_item.name))
			.toContain('Filter');
		expect(requests.map((r) => r.route)).toEqual([
			'POST /api/v1/gear',
			'POST /api/v1/trips/trip-1/gear'
		]);
		expect(requests[1].body).toEqual({ gear_item_id: created.id, quantity: 1, packed: false });
		expect(await db.gearItems.get(created.id)).toEqual(created);
		expect(toast.success).toHaveBeenCalledWith('Added Filter');
	});

	it('offers to create what a closet search did not find, with the name filled in', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await screen.getByPlaceholder('Search').fill(' Bear can ');
		await screen.getByRole('button', { name: 'Create “Bear can”' }).click();

		await expect.element(screen.getByRole('heading', { name: 'New gear' })).toBeVisible();
		await expect.element(screen.getByLabelText('Name')).toHaveValue('Bear can');
		await expect.element(screen.getByPlaceholder('Search')).not.toBeInTheDocument();
	});

	it('offers to create a name that only partly matches closet items', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		const dialog = screen.getByRole('dialog');

		await dialog.getByPlaceholder('Search').fill('stov');
		await expect.element(dialog.getByRole('button', { name: /^Stove/ })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: 'Create “stov”' })).toBeVisible();

		await dialog.getByPlaceholder('Search').fill(' STOVE ');
		await expect.element(dialog.getByRole('button', { name: /^Stove/ })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /^Create/ })).not.toBeInTheDocument();
	});

	it('says gear is already on the trip instead of offering to create it', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		const dialog = screen.getByRole('dialog');
		await dialog.getByPlaceholder('Search').fill('tent');

		await expect.element(dialog.getByText('Tent is already on this trip.')).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /^Create/ })).not.toBeInTheDocument();
	});

	it('points to the closet for archived gear instead of offering to create it', async () => {
		const tarp = gearItem({ name: 'Tarp', archived_at: '2026-01-01T00:00:00Z' });
		await db.gearItems.put(tarp);
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		const dialog = screen.getByRole('dialog');
		await dialog.getByPlaceholder('Search').fill('Tarp');

		await expect.element(dialog.getByText(/Tarp is archived/)).toBeVisible();
		await expect
			.element(dialog.getByRole('link', { name: 'gear closet' }))
			.toHaveAttribute('href', '/gear');
		await expect.element(dialog.getByRole('button', { name: /^Create/ })).not.toBeInTheDocument();
	});

	it('clears the closet search after creating gear from it', async () => {
		const created = gearItem({ name: 'Bear can', category: 'cooking_water', weight_g: 800 });
		mockApi({
			'POST /api/v1/gear': () => created,
			'POST /api/v1/trips/trip-1/gear': () => tripGear(created)
		});
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await screen.getByPlaceholder('Search').fill('Bear can');
		await screen.getByRole('button', { name: 'Create “Bear can”' }).click();
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Cooking & Water' }).click();
		await screen.getByLabelText('Weight (each)').fill('800');
		await screen.getByRole('button', { name: 'Add to closet & trip' }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();

		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await expect.element(screen.getByPlaceholder('Search')).toHaveValue('');
	});

	it('clears the closet search when the dialog is closed', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await screen.getByPlaceholder('Search').fill('stove');
		await screen.getByRole('button', { name: 'Close', exact: true }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();

		await screen.getByRole('button', { name: 'Add from closet' }).click();
		await expect.element(screen.getByPlaceholder('Search')).toHaveValue('');
	});

	it('keeps the new closet item when adding it to the trip fails', async () => {
		const created = gearItem({ name: 'Filter', category: 'cooking_water', weight_g: 85 });
		mockApi({
			'POST /api/v1/gear': () => created,
			'POST /api/v1/trips/trip-1/gear': () => respond(500, { detail: 'Server error' })
		});
		const screen = await setup();
		await screen.getByRole('button', { name: 'New gear' }).click();
		await screen.getByLabelText('Name').fill('Filter');
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Cooking & Water' }).click();
		await screen.getByLabelText('Weight (each)').fill('85');
		await screen.getByRole('button', { name: 'Add to closet & trip' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect
			.poll(() => vi.mocked(toast.error).mock.calls.at(-1)?.[0])
			.toMatch(/^Filter is in your closet but wasn’t added to this trip\./);
		expect(await db.gearItems.get(created.id)).toEqual(created);
		expect((await db.trips.get('trip-1'))?.gear_list).toHaveLength(3);
	});

	it('copies the gear list from another trip', async () => {
		const other = trip({ id: 'trip-2', name: 'Linville Gorge', gear_list: [tripGear(stove)] });
		await db.trips.put(other);
		const copied = [tentLine, tripGear(stove)];
		mockApi({ 'POST /api/v1/trips/trip-1/gear/copy-from/trip-2': () => copied });
		const screen = await setup(trip({ gear_list: [tentLine] }));

		await screen.getByRole('button', { name: 'Copy from trip' }).click();
		const copy = screen.getByRole('button', { name: 'Copy gear' });
		await expect.element(copy).toBeDisabled();
		await screen.getByText('Choose a trip').click();
		await screen.getByRole('option', { name: 'Linville Gorge' }).click();
		await copy.click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect((await db.trips.get('trip-1'))?.gear_list).toHaveLength(2);
	});

	it('removes gear from the trip after confirmation', async () => {
		mockApi({ [`DELETE /api/v1/trips/trip-1/gear/${jacketLine.id}`]: () => respond(204) });
		const screen = await setup();
		await screen.getByRole('button', { name: 'Remove Jacket' }).click();
		await expect.element(screen.getByText('It stays in your gear closet.')).toBeVisible();
		await screen.getByRole('button', { name: 'Remove', exact: true }).click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.gear_list.map((l) => l.gear_item.name))
			.toEqual(['Tent', 'Stakes']);
	});
});
