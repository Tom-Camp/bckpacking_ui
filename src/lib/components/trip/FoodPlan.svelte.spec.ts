import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Trip } from '$lib/api/types';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { food, trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import FoodPlan from './FoodPlan.svelte';

const oatmeal = food({ name: 'Oatmeal', day: 1, meal_type: 'breakfast', kcal: 400, weight_g: 100 });
const ramen = food({
	name: 'Ramen',
	day: 2,
	meal_type: 'dinner',
	kcal: 380,
	weight_g: 85,
	servings: 2
});

async function setup(t: Trip = trip()) {
	t.food_plan?.food.push(oatmeal, ramen);
	await db.trips.put(t);
	return renderApp(FoodPlan, { trip: t }, { units: 'metric' });
}

describe('FoodPlan', () => {
	it('explains when the trip has no food plan', async () => {
		const screen = await renderApp(FoodPlan, { trip: trip({ food_plan: null }) });
		await expect.element(screen.getByText('This trip has no food plan.')).toBeVisible();
	});

	it('shows each trip day with totals against the targets', async () => {
		const screen = await setup();

		for (const day of ['Day 1 (Aug 26)', 'Day 2 (Aug 27)', 'Day 3 (Aug 28)'])
			await expect.element(screen.getByText(day)).toBeVisible();
		await expect.element(screen.getByText('400 / 2,700 kcal')).toBeVisible();
		await expect.element(screen.getByText('760 / 2,700 kcal')).toBeVisible();
		await expect.element(screen.getByText('Ramen')).toBeVisible();
		await expect.element(screen.getByText('× 2')).toBeVisible();
		await expect.element(screen.getByText('760 kcal · 170 g')).toBeVisible();
	});

	it('saves daily targets offline', async () => {
		const screen = await setup();
		await screen.getByLabelText('Calories per day').fill('3000');
		await userEvent.tab();
		await screen.getByLabelText('Food weight per day').fill('900');
		await userEvent.tab();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.food_plan)
			.toMatchObject({ target_kcal_per_day: 3000, target_food_g_per_day: 900 });
		const [queued] = await db.outbox.toArray();
		expect(queued.body).toEqual({ target_kcal_per_day: 3000, target_food_g_per_day: 900 });
	});

	it('opens the add dialog preset to the day and meal', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Add Lunch' }).nth(1).click();

		await expect.element(screen.getByRole('heading', { name: 'Add food' })).toBeVisible();
		const dialog = screen.getByRole('dialog');
		await expect.element(dialog.getByText('Day 2 (Aug 27)')).toBeVisible();
		await expect.element(dialog.getByText('Lunch')).toBeVisible();
	});

	it('opens food for editing when clicked', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'Oatmeal', exact: true }).click();

		await expect.element(screen.getByRole('heading', { name: 'Edit food' })).toBeVisible();
		await expect.element(screen.getByLabelText('Name')).toHaveValue('Oatmeal');
	});

	it('deletes food after confirmation', async () => {
		mockApi({
			[`DELETE /api/v1/trips/trip-1/food-plan/items/${oatmeal.id}`]: () => respond(204)
		});
		const screen = await setup();
		await screen.getByRole('button', { name: 'Delete Oatmeal' }).click();
		await screen.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect
			.poll(async () => (await db.trips.get('trip-1'))?.food_plan?.food.map((f) => f.name))
			.toEqual(['Ramen']);
	});
});
