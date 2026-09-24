import type { FoodPlan, Meal, Trip, TripFood } from '$lib/api/types';
import { MEALS } from '$lib/api/types';

/** Parses an API date ("2026-08-26") as a local calendar date, avoiding UTC day shifts. */
export function parseDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function formatDate(
	iso: string,
	opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
	return parseDate(iso).toLocaleDateString(undefined, opts);
}

/** "Aug 26 – 28, 2026"-style range; tolerates missing dates. */
export function formatDateRange(start: string | null, end: string | null): string | null {
	const long: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
	if (start && end)
		return `${formatDate(start, { month: 'short', day: 'numeric' })} – ${formatDate(end, long)}`;
	if (start) return formatDate(start, long);
	return null;
}

/** Inclusive number of days, or null when either date is missing. */
export function tripDays(trip: Pick<Trip, 'start_date' | 'end_date'>): number | null {
	if (!trip.start_date || !trip.end_date) return null;
	const ms = parseDate(trip.end_date).getTime() - parseDate(trip.start_date).getTime();
	return Math.round(ms / 86_400_000) + 1;
}

/** "Day 1 (Aug 26)" when the start date is known, else "Day 1". */
export function dayLabel(day: number, startDate: string | null): string {
	if (!startDate) return `Day ${day}`;
	const date = parseDate(startDate);
	date.setDate(date.getDate() + day - 1);
	return `Day ${day} (${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
}

export interface DayPlan {
	day: number;
	meals: { meal: Meal; items: TripFood[] }[];
	kcal: number;
	weight_g: number;
}

/** Groups food by day and meal, covering every trip day even if it has no food yet. */
export function planByDay(
	trip: Pick<Trip, 'start_date' | 'end_date'>,
	plan: FoodPlan | null
): DayPlan[] {
	const food = plan?.food ?? [];
	const lastFoodDay = food.reduce((max, f) => Math.max(max, f.day), 0);
	const days = Math.max(tripDays(trip) ?? 0, lastFoodDay, 1);
	return Array.from({ length: days }, (_, i) => {
		const day = i + 1;
		const items = food.filter((f) => f.day === day);
		return {
			day,
			meals: MEALS.map((meal) => ({
				meal,
				items: items
					.filter((f) => f.meal_type === meal)
					.sort((a, b) => a.name.localeCompare(b.name))
			})),
			kcal: items.reduce((s, f) => s + f.servings * f.kcal, 0),
			weight_g: items.reduce((s, f) => s + f.servings * f.weight_g, 0)
		};
	});
}

export const MEAL_LABELS: Record<Meal, string> = {
	breakfast: 'Breakfast',
	lunch: 'Lunch',
	dinner: 'Dinner',
	snack: 'Snacks'
};
