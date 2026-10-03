import { describe, expect, it } from 'vitest';
import { gearCategories, gearItem, trip, tripGear } from '$lib/test/fixtures';
import { checklistReady, shuttleStatusFor } from './checklist';
import { dayLabel, planByDay, tripDays } from './food';
import { categoryOption, groupByCategory, isGearCategory } from './gear';
import { formatDistance, formatWeight, fromInput, G_PER_OZ, toInput } from './units';
import { summarizeWeights } from './weights';

describe('units', () => {
	it('formats weights in oz below a pound and lb above', () => {
		expect(formatWeight(G_PER_OZ * 12, 'imperial')).toBe('12 oz');
		expect(formatWeight(907.18474, 'imperial')).toBe('2 lb');
		expect(formatWeight(350, 'metric')).toBe('350 g');
		expect(formatWeight(2410, 'metric')).toBe('2.41 kg');
	});

	it('round-trips input values through canonical units', () => {
		const g = fromInput(10, 'gear-weight', 'imperial');
		expect(g).toBeCloseTo(283.495, 2);
		expect(toInput(g, 'gear-weight', 'imperial')).toBe(10);
		expect(fromInput(12.4, 'distance', 'imperial')).toBeCloseTo(19955.87, 1);
		expect(fromInput(null, 'distance', 'metric')).toBeNull();
		expect(toInput(null, 'elevation', 'metric')).toBeNull();
	});

	it('formats distance', () => {
		expect(formatDistance(1609.344 * 12.4, 'imperial')).toBe('12.4 mi');
		expect(formatDistance(20000, 'metric')).toBe('20 km');
	});
});

describe('weights', () => {
	it('excludes worn from pack weight and consumables from base weight', () => {
		const t = trip({
			water_carry_l: 2,
			gear_list: [
				tripGear(gearItem({ weight_g: 1000, kind: 'base' })),
				tripGear(gearItem({ weight_g: 200, kind: 'base' }), { quantity: 2 }),
				tripGear(gearItem({ weight_g: 500, kind: 'worn' })),
				tripGear(gearItem({ weight_g: 300, kind: 'consumable' }))
			]
		});
		t.food_plan!.food = [
			{
				id: 'f',
				day: 1,
				name: 'Oats',
				meal_type: 'breakfast',
				servings: 2,
				weight_g: 100,
				kcal: 400,
				planner_id: 'p',
				created_at: '',
				updated_at: ''
			}
		];

		const w = summarizeWeights(t, 80_000);
		expect(w.base_g).toBe(1400);
		expect(w.worn_g).toBe(500);
		expect(w.consumable_g).toBe(300);
		expect(w.food_g).toBe(200);
		expect(w.water_g).toBe(2000);
		expect(w.pack_g).toBe(1400 + 300 + 200 + 2000);
		expect(w.skin_out_g).toBe(w.pack_g + 500);
		expect(w.body_pct).toBeCloseTo((3900 / 80_000) * 100);
	});

	it('omits body weight % when body weight is unknown', () => {
		expect(summarizeWeights(trip(), null).body_pct).toBeNull();
	});
});

describe('food', () => {
	it('counts trip days inclusively', () => {
		expect(tripDays(trip())).toBe(3);
		expect(tripDays(trip({ end_date: null }))).toBeNull();
	});

	it('labels days from the start date without timezone shifts', () => {
		expect(dayLabel(1, '2026-08-26')).toMatch(/^Day 1 \(Aug 26\)$/);
		expect(dayLabel(3, '2026-08-30')).toMatch(/^Day 3 \(Sep 1\)$/);
		expect(dayLabel(2, null)).toBe('Day 2');
	});

	it('covers every trip day and totals servings', () => {
		const t = trip();
		t.food_plan!.food = [
			{
				id: 'a',
				day: 2,
				name: 'Wrap',
				meal_type: 'lunch',
				servings: 1.5,
				weight_g: 100,
				kcal: 300,
				planner_id: 'p',
				created_at: '',
				updated_at: ''
			}
		];
		const days = planByDay(t, t.food_plan);
		expect(days).toHaveLength(3);
		expect(days[1].kcal).toBe(450);
		expect(days[1].weight_g).toBe(150);
		expect(days[1].meals.find((m) => m.meal === 'lunch')?.items).toHaveLength(1);
		expect(days[0].kcal).toBe(0);
	});
});

describe('checklist', () => {
	it('is ready when nothing is left to do', () => {
		expect(checklistReady([{ status: 'done' }, { status: 'not_applicable' }])).toBe(true);
		expect(checklistReady([{ status: 'done' }, { status: 'todo' }])).toBe(false);
	});

	it('needs a shuttle only for point-to-point trips', () => {
		expect(shuttleStatusFor('point-to-point')).toBe('todo');
		expect(shuttleStatusFor('loop')).toBe('not_applicable');
		expect(shuttleStatusFor('out-and-back')).toBe('not_applicable');
	});
});

describe('gear categories', () => {
	const options = gearCategories;

	it('looks up labels and files unknown categories under misc', () => {
		expect(categoryOption({ category: 'cooking_water' }, options).label).toBe('Cooking & Water');
		expect(categoryOption({ category: 'kitchen' }, options)).toEqual({
			value: 'misc',
			label: 'Miscellaneous'
		});
		expect(isGearCategory('shelter', options)).toBe(true);
		expect(isGearCategory('kitchen', options)).toBe(false);
	});

	it('uses the item’s own label before the list is cached', () => {
		expect(
			categoryOption({ category: 'cooking_water', category_label: 'Cooking & Water' }, [])
		).toEqual({ value: 'cooking_water', label: 'Cooking & Water' });
		expect(categoryOption({ category: 'kitchen' }, [])).toEqual({
			value: 'kitchen',
			label: 'kitchen'
		});
		expect(isGearCategory('shelter', [])).toBe(false);
	});

	it('groups by category, ordered by label', () => {
		const items = [
			gearItem({ name: 'Tent', category: 'shelter' }),
			gearItem({ name: 'Stove', category: 'cooking_water' }),
			gearItem({ name: 'Bivy', category: 'shelter' })
		];
		const groups = groupByCategory(items, (i) => i, options);
		expect(groups.map((g) => [g.category.label, g.entries.map((i) => i.name)])).toEqual([
			['Cooking & Water', ['Stove']],
			['Shelter', ['Tent', 'Bivy']]
		]);
	});
});
