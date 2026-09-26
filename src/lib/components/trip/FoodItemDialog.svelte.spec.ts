import { describe, expect, it } from 'vitest';
import { db } from '$lib/data/db';
import { mockApi } from '$lib/test/api';
import { food, trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import FoodItemDialog from './FoodItemDialog.svelte';

describe('FoodItemDialog', () => {
	it('adds food for the chosen day and meal', async () => {
		const t = trip();
		await db.trips.put(t);
		const created = food({ name: 'Ramen', day: 2, meal_type: 'dinner' });
		const requests = mockApi({ 'POST /api/v1/trips/trip-1/food-plan/items': () => created });
		const screen = await renderApp(
			FoodItemDialog,
			{ open: true, trip: t, days: 3, day: 2, meal: 'dinner' },
			{ units: 'metric' }
		);

		await expect.element(screen.getByRole('heading', { name: 'Add food' })).toBeVisible();
		await expect.element(screen.getByText('Day 2 (Aug 27)')).toBeVisible();
		await screen.getByLabelText('Name').fill(' Ramen ');
		await screen.getByLabelText('Servings').fill('2');
		await screen.getByLabelText('Weight').fill('85');
		await screen.getByLabelText('Calories').fill('380');
		await screen.getByRole('button', { name: 'Add', exact: true }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(requests[0].body).toEqual({
			day: 2,
			meal_type: 'dinner',
			name: 'Ramen',
			servings: 2,
			weight_g: 85,
			kcal: 380
		});
		expect((await db.trips.get('trip-1'))?.food_plan?.food).toEqual([created]);
	});

	it('lets the user move food to another day and meal', async () => {
		const t = trip();
		await db.trips.put(t);
		const requests = mockApi({ 'POST /api/v1/trips/trip-1/food-plan/items': () => food() });
		const screen = await renderApp(FoodItemDialog, { open: true, trip: t, days: 3 });

		await screen.getByText('Day 1 (Aug 26)').click();
		await screen.getByRole('option', { name: 'Day 3 (Aug 28)' }).click();
		await screen.getByText('Breakfast').click();
		await screen.getByRole('option', { name: 'Snacks' }).click();
		await screen.getByLabelText('Name').fill('Trail mix');
		await screen.getByLabelText('Weight').fill('4');
		await screen.getByRole('button', { name: 'Add', exact: true }).click();

		await expect.poll(() => requests[0]?.body).toMatchObject({ day: 3, meal_type: 'snack' });
	});

	it('edits existing food offline', async () => {
		const item = food({ name: 'Oatmeal', servings: 1 });
		const t = trip();
		t.food_plan!.food = [item];
		await db.trips.put(t);
		const screen = await renderApp(FoodItemDialog, { open: true, trip: t, days: 3, item });

		await expect.element(screen.getByRole('heading', { name: 'Edit food' })).toBeVisible();
		await expect.element(screen.getByLabelText('Name')).toHaveValue('Oatmeal');
		await screen.getByLabelText('Servings').fill('2');
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect((await db.trips.get('trip-1'))?.food_plan?.food[0].servings).toBe(2);
		expect((await db.outbox.toArray())[0].path).toBe(
			`/api/v1/trips/trip-1/food-plan/items/${item.id}`
		);
	});
});
