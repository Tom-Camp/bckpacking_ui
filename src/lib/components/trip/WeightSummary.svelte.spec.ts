import { describe, expect, it } from 'vitest';
import { food, gearItem, trip, tripGear, user } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import WeightSummary from './WeightSummary.svelte';

const loaded = trip({
	gear_list: [
		tripGear(gearItem({ weight_g: 1000, kind: 'base' })),
		tripGear(gearItem({ weight_g: 500, kind: 'worn' })),
		tripGear(gearItem({ weight_g: 100, kind: 'consumable' }), { quantity: 2 })
	],
	water_carry_l: 1
});
loaded.food_plan!.food = [food({ weight_g: 100, servings: 1 })];

describe('WeightSummary', () => {
	it('breaks down pack weight in the user’s units', async () => {
		const screen = await renderApp(WeightSummary, { trip: loaded }, { units: 'metric' });

		// base 1000 + consumable 200 + food 100 + water 1000
		await expect.element(screen.getByText('2.3 kg')).toBeVisible();
		for (const [label, value] of [
			['Base weight', '1 kg'],
			['Consumables', '200 g'],
			['Food', '100 g'],
			['Water', '1 kg']
		]) {
			await expect
				.element(screen.getByText(label).element().nextElementSibling as HTMLElement)
				.toHaveTextContent(value);
		}
		await expect.element(screen.getByText('Worn 500 g · Skin-out 2.8 kg')).toBeVisible();
	});

	it('shows pack weight as a share of body weight when known', async () => {
		const screen = await renderApp(
			WeightSummary,
			{ trip: loaded },
			{ user: user({ body_weight_g: 46_000 }) }
		);
		await expect.element(screen.getByText('5.0% of body weight')).toBeVisible();
	});

	it('omits body-weight share without a body weight', async () => {
		const screen = await renderApp(WeightSummary, { trip: loaded });
		await expect.element(screen.getByText(/of body weight/)).not.toBeInTheDocument();
	});
});
