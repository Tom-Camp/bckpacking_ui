import { describe, expect, it, vi } from 'vitest';
import type { GearCategory } from '$lib/api/types';
import { db, GEAR_CATEGORIES_KEY } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { gearItem, trip, tripGear } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import GearItemDialog from './GearItemDialog.svelte';

describe('GearItemDialog', () => {
	it('creates a closet item through the API', async () => {
		const created = gearItem({
			name: 'Stove',
			category: 'cooking_water',
			weight_g: 85,
			kind: 'base'
		});
		const requests = mockApi({ 'POST /api/v1/gear': () => created });
		const screen = await renderApp(GearItemDialog, { open: true }, { units: 'metric' });

		await expect.element(screen.getByRole('heading', { name: 'New gear' })).toBeVisible();
		await screen.getByLabelText('Name').fill('  Stove ');
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Cooking & Water' }).click();
		await screen.getByLabelText('Weight (each)').fill('85');
		await screen.getByText('Base (carried)').click();
		await screen.getByRole('option', { name: 'Consumable (fuel, sunscreen…)' }).click();
		await screen.getByRole('button', { name: 'Add to closet' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(requests).toHaveLength(1);
		expect(requests[0].body).toEqual({
			name: 'Stove',
			category: 'cooking_water',
			weight_g: 85,
			kind: 'consumable',
			notes: null
		});
		expect(await db.gearItems.get(created.id)).toEqual(created);
	});

	it('prefills the name and hands the created item to oncreated', async () => {
		const created = gearItem({ name: 'Bear can', category: 'cooking_water', weight_g: 1000 });
		mockApi({ 'POST /api/v1/gear': () => created });
		const oncreated = vi.fn();
		const screen = await renderApp(GearItemDialog, {
			open: true,
			name: 'Bear can',
			oncreated
		});

		await expect.element(screen.getByLabelText('Name')).toHaveValue('Bear can');
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Cooking & Water' }).click();
		await screen.getByLabelText('Weight (each)').fill('35');
		await screen.getByRole('button', { name: 'Add to closet & trip' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(oncreated).toHaveBeenCalledExactlyOnceWith(created);
	});

	it('shows the API’s error and stays open', async () => {
		mockApi({ 'POST /api/v1/gear': () => respond(422, { detail: 'Name already used' }) });
		const screen = await renderApp(GearItemDialog, { open: true });

		await screen.getByLabelText('Name').fill('Tent');
		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Shelter' }).click();
		await screen.getByLabelText('Weight (each)').fill('32');
		await screen.getByRole('button', { name: 'Add to closet' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Name already used');
		await expect.element(screen.getByRole('dialog')).toBeVisible();
	});

	it('edits an item offline and updates trips that use it', async () => {
		const item = gearItem({ name: 'Tent', weight_g: 1000 });
		await db.gearItems.put(item);
		await db.trips.put(trip({ gear_list: [tripGear(item)] }));
		const screen = await renderApp(GearItemDialog, { open: true, item }, { units: 'metric' });

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

	it('requires a category before creating', async () => {
		const requests = mockApi({});
		const screen = await renderApp(GearItemDialog, { open: true });

		await screen.getByLabelText('Name').fill('Tent');
		await screen.getByLabelText('Weight (each)').fill('32');
		await screen.getByRole('button', { name: 'Add to closet' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Choose a category.');
		expect(requests).toHaveLength(0);
	});

	it('makes an item with a pre-enum category pick a valid one', async () => {
		const item = gearItem({ name: 'Trowel', category: 'hygiene' as GearCategory });
		await db.gearItems.put(item);
		const screen = await renderApp(GearItemDialog, { open: true, item });

		await expect.element(screen.getByLabelText('Category')).toHaveTextContent('Choose…');
		await screen.getByRole('button', { name: 'Save' }).click();
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Choose a category.');

		await screen.getByLabelText('Category').click();
		await screen.getByRole('option', { name: 'Miscellaneous' }).click();
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(await db.gearItems.get(item.id)).toMatchObject({
			category: 'misc',
			category_label: 'Miscellaneous'
		});
	});

	it('offers the categories cached from the API', async () => {
		await db.meta.put({
			key: GEAR_CATEGORIES_KEY,
			value: [{ value: 'sleep', label: 'Sleep system' }]
		});
		const screen = await renderApp(GearItemDialog, { open: true });

		await screen.getByLabelText('Category').click();
		await expect.element(screen.getByRole('option', { name: 'Sleep system' })).toBeVisible();
		expect(screen.getByRole('option').elements()).toHaveLength(1);
	});

	it('edits an item offline before the category list is cached', async () => {
		await db.meta.delete(GEAR_CATEGORIES_KEY);
		const item = gearItem({ name: 'Tent', category: 'shelter', weight_g: 1000 });
		await db.gearItems.put(item);
		const screen = await renderApp(GearItemDialog, { open: true, item }, { units: 'metric' });

		await expect.element(screen.getByLabelText('Category')).toHaveTextContent('Shelter');
		await screen.getByLabelText('Weight (each)').fill('900');
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(await db.gearItems.get(item.id)).toMatchObject({ weight_g: 900 });
		expect(await db.outbox.toArray()).toMatchObject([
			{ path: `/api/v1/gear/${item.id}`, body: { weight_g: 900, category: 'shelter' } }
		]);
	});
});
