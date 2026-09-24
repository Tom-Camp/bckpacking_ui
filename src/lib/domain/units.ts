import type { Unit } from '$lib/api/types';

// The API stores grams, metres and litres. These helpers convert for display and input only.

export const G_PER_OZ = 28.349523125;
export const G_PER_LB = 453.59237;
export const M_PER_MI = 1609.344;
export const M_PER_FT = 0.3048;

/** What kind of quantity a form field holds; picks the input unit for each system. */
export type Measure = 'gear-weight' | 'body-weight' | 'food-weight' | 'distance' | 'elevation';

interface InputUnit {
	label: string;
	/** Canonical value = input value × factor. */
	factor: number;
	/** Decimal places to show in an input. */
	decimals: number;
}

const INPUT_UNITS: Record<Measure, Record<Unit, InputUnit>> = {
	'gear-weight': {
		imperial: { label: 'oz', factor: G_PER_OZ, decimals: 1 },
		metric: { label: 'g', factor: 1, decimals: 0 }
	},
	'food-weight': {
		imperial: { label: 'oz', factor: G_PER_OZ, decimals: 1 },
		metric: { label: 'g', factor: 1, decimals: 0 }
	},
	'body-weight': {
		imperial: { label: 'lb', factor: G_PER_LB, decimals: 1 },
		metric: { label: 'kg', factor: 1000, decimals: 1 }
	},
	distance: {
		imperial: { label: 'mi', factor: M_PER_MI, decimals: 1 },
		metric: { label: 'km', factor: 1000, decimals: 1 }
	},
	elevation: {
		imperial: { label: 'ft', factor: M_PER_FT, decimals: 0 },
		metric: { label: 'm', factor: 1, decimals: 0 }
	}
};

export function inputUnit(measure: Measure, system: Unit): InputUnit {
	return INPUT_UNITS[measure][system];
}

/** Canonical value → number for an input field (rounded to the unit's precision). */
export function toInput(
	canonical: number | null | undefined,
	measure: Measure,
	system: Unit
): number | null {
	if (canonical === null || canonical === undefined) return null;
	const u = inputUnit(measure, system);
	return round(canonical / u.factor, u.decimals);
}

/** Input field value → canonical value for the API. */
export function fromInput(
	value: number | null | undefined,
	measure: Measure,
	system: Unit
): number | null {
	if (value === null || value === undefined || Number.isNaN(value)) return null;
	return value * inputUnit(measure, system).factor;
}

export function round(n: number, decimals: number): number {
	const f = 10 ** decimals;
	return Math.round(n * f) / f;
}

const fmt = (n: number, decimals: number) =>
	n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });

/** Grams → "12.3 oz" / "2.41 lb" or "350 g" / "2.41 kg". */
export function formatWeight(grams: number, system: Unit): string {
	if (system === 'imperial') {
		const oz = grams / G_PER_OZ;
		return oz < 16 ? `${fmt(oz, 1)} oz` : `${fmt(grams / G_PER_LB, 2)} lb`;
	}
	return grams < 1000 ? `${fmt(grams, 0)} g` : `${fmt(grams / 1000, 2)} kg`;
}

export function formatDistance(metres: number, system: Unit): string {
	return system === 'imperial' ? `${fmt(metres / M_PER_MI, 1)} mi` : `${fmt(metres / 1000, 1)} km`;
}

export function formatElevation(metres: number, system: Unit): string {
	return system === 'imperial' ? `${fmt(metres / M_PER_FT, 0)} ft` : `${fmt(metres, 0)} m`;
}

export function formatVolume(litres: number): string {
	return `${fmt(litres, 1)} L`;
}
