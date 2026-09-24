import type { GearItem, Trip, TripGear } from '$lib/api/types';

const ts = '2026-01-01T00:00:00Z';

export function gearItem(overrides: Partial<GearItem> = {}): GearItem {
	return {
		id: crypto.randomUUID(),
		name: 'Tent',
		category: 'shelter',
		weight_g: 1000,
		kind: 'base',
		notes: null,
		archived_at: null,
		created_at: ts,
		updated_at: ts,
		...overrides
	};
}

export function tripGear(item: GearItem, overrides: Partial<TripGear> = {}): TripGear {
	return {
		id: crypto.randomUUID(),
		trip_id: 'trip-1',
		gear_item: item,
		quantity: 1,
		packed: false,
		created_at: ts,
		updated_at: ts,
		...overrides
	};
}

export function trip(overrides: Partial<Trip> = {}): Trip {
	const id = overrides.id ?? 'trip-1';
	return {
		id,
		user_id: 'user-1',
		name: 'Art Loeb',
		description: null,
		area: 'Pisgah',
		trip_type: 'point-to-point',
		start_date: '2026-08-26',
		end_date: '2026-08-28',
		start_trailhead: null,
		end_trailhead: null,
		total_distance_m: null,
		elevation_gain_m: null,
		water_carry_l: 0,
		map_link: null,
		emergency_contact: null,
		food_plan: {
			id: 'plan-1',
			trip_id: id,
			target_kcal_per_day: 2700,
			target_food_g_per_day: 794,
			food: [],
			created_at: ts,
			updated_at: ts
		},
		gear_list: [],
		checklist_items: (['permit', 'shuttle_scheduled'] as const).map((item) => ({
			id: crypto.randomUUID(),
			item,
			status: 'todo' as const,
			details: null,
			trip_id: id,
			created_at: ts,
			updated_at: ts
		})),
		notes: [],
		created_at: ts,
		updated_at: ts,
		checklist_ready: false,
		...overrides
	};
}
