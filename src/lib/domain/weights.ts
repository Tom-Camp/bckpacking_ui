import type { GearItem, Trip, TripFood, TripGear } from '$lib/api/types';

export interface WeightSummary {
	/** Carried gear that isn't consumed: the classic "base weight". */
	base_g: number;
	/** Worn on the body; excluded from pack weight. */
	worn_g: number;
	/** Consumable gear (fuel, sunscreen…); in pack weight, not base weight. */
	consumable_g: number;
	food_g: number;
	water_g: number;
	/** base + consumable + food + water. */
	pack_g: number;
	/** Pack weight + worn: everything leaving the trailhead. */
	skin_out_g: number;
	/** Pack weight as % of body weight, when body weight is known. */
	body_pct: number | null;
}

export function gearLineWeight(
	line: Pick<TripGear, 'quantity'> & { gear_item: Pick<GearItem, 'weight_g'> }
): number {
	return line.gear_item.weight_g * line.quantity;
}

/** The fields `summarizeWeights` reads, so the owner's trips and shared trips both fit. */
export interface WeighableTrip {
	gear_list: (Pick<TripGear, 'quantity'> & { gear_item: Pick<GearItem, 'weight_g' | 'kind'> })[];
	food_plan: { food: Pick<TripFood, 'servings' | 'weight_g'>[] } | null;
	water_carry_l: Trip['water_carry_l'];
}

export function summarizeWeights(trip: WeighableTrip, bodyWeightG?: number | null): WeightSummary {
	let base_g = 0;
	let worn_g = 0;
	let consumable_g = 0;
	for (const line of trip.gear_list) {
		const w = gearLineWeight(line);
		if (line.gear_item.kind === 'worn') worn_g += w;
		else if (line.gear_item.kind === 'consumable') consumable_g += w;
		else base_g += w;
	}
	const food_g = (trip.food_plan?.food ?? []).reduce((sum, f) => sum + f.servings * f.weight_g, 0);
	const water_g = trip.water_carry_l * 1000;
	const pack_g = base_g + consumable_g + food_g + water_g;
	return {
		base_g,
		worn_g,
		consumable_g,
		food_g,
		water_g,
		pack_g,
		skin_out_g: pack_g + worn_g,
		body_pct: bodyWeightG ? (pack_g / bodyWeightG) * 100 : null
	};
}
