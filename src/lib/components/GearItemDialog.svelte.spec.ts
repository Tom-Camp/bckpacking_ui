import { describe, expect, it, vi } from 'vitest';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { gearItem, trip, tripGear } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import GearItemDialog from './GearItemDialog.svelte';

describe('GearItemDialog', () => {
	it('creates a closet item through the API', async () => {
		const created = gearItem({ name: 'Stove', category: 'kitchen', weight_g: 85, kind: 'base' });
		const requests = mockApi({ 'POST /api/v1/gear': () => created });
		const screen = await renderApp(
			GearItemDialog,
			{ open: true, categories: [] },
			{ units: 'metric' }
		);

		await expect.element(screen.getByRole('heading', { name: 'New gear' })).toBeVisible();
		await screen.getByLabelText('Name').fill('  Stove ');
		await screen.getByLabelText('Category').fill('Kitchen');
		await screen.getByLabelText('Weight (each)').fill('85');
		await screen.getByText('Base (carried)').click();
		await screen.getByRole('option', { name: 'Consumable (fuel, sunscreen…)' }).click();
		await screen.getByRole('button', { name: 'Add to closet' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(requests).toHaveLength(1);
		expect(requests[0].body).toEqual({
			name: 'Stove',
			category: 'kitchen',
			weight_g: 85,
			kind: 'consumable',
			notes: null
		});
		expect(await db.gearItems.get(created.id)).toEqual(created);
	});

	it('prefills the name and hands the created item to oncreated', async () => {
		const created = gearItem({ name: 'Bear can', category: 'kitchen', weight_g: 1000 });
		mockApi({ 'POST /api/v1/gear': () => created });
		const oncreated = vi.fn();
		const screen = await renderApp(GearItemDialog, {
			open: true,
			categories: [],
			name: 'Bear can',
			oncreated
		});

		await expect.element(screen.getByLabelText('Name')).toHaveValue('Bear can');
		await screen.getByLabelText('Category').fill('kitchen');
		await screen.getByLabelText('Weight (each)').fill('35');
		await screen.getByRole('button', { name: 'Add to closet & trip' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(oncreated).toHaveBeenCalledExactlyOnceWith(created);
	});

	it('shows the API’s error and stays open', async () => {
		mockApi({ 'POST /api/v1/gear': () => respond(422, { detail: 'Name already used' }) });
		const screen = await renderApp(GearItemDialog, { open: true, categories: [] });

		await screen.getByLabelText('Name').fill('Tent');
		await screen.getByLabelText('Category').fill('shelter');
		await screen.getByLabelText('Weight (each)').fill('32');
		await screen.getByRole('button', { name: 'Add to closet' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Name already used');
		await expect.element(screen.getByRole('dialog')).toBeVisible();
	});

	it('edits an item offline and updates trips that use it', async () => {
		const item = gearItem({ name: 'Tent', weight_g: 1000 });
		await db.gearItems.put(item);
		await db.trips.put(trip({ gear_list: [tripGear(item)] }));
		const screen = await renderApp(
			GearItemDialog,
			{ open: true, item, categories: ['shelter'] },
			{ units: 'metric' }
		);

		await expect.element(screen.getByText('Changes apply to every trip')).toBeVisible();
		await expect.element(screen.getByLabelText('Name')).toHaveValue('Tent');
		await screen.getByLabelText('Name').fill('Tarp');
		await screen.getByLabelText('Weight (each)').fill('400');
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(await db.gearItems.get(item.id)).toMatchObject({ name: 'Tarp', weight_g: 400 });
		expect((await db.trips.get('trip-1'))?.gear_list[0].gear_item.name).toBe('Tarp');
		expect(await db.outbox.count()).toBe(1);
	});
});
