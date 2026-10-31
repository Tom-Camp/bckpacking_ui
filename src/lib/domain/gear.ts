import type { GearCategory, GearCategoryOption } from '$lib/api/types';

// Categories come from `GET /gear/categories`, cached on each pull. Until a pull has cached them,
// the bundled list below stands in so gear can still be edited offline.

// A `Record` so that a new `GearCategory` from the API fails `npm run check` until it's added here.
const FALLBACK_LABELS: Record<GearCategory, string> = {
	clothing: 'Clothing',
	cooking_water: 'Cooking & Water',
	misc: 'Miscellaneous',
	navigation_safety: 'Navigation & Safety',
	shelter: 'Shelter',
	sleep: 'Sleep'
};

export const FALLBACK_CATEGORIES: GearCategoryOption[] = Object.entries(FALLBACK_LABELS).map(
	([value, label]) => ({ value: value as GearCategory, label })
);

/** The cached server list when there is one, otherwise the bundled fallback. */
export function categoryOptions(cached: GearCategoryOption[] | undefined): GearCategoryOption[] {
	return cached?.length ? cached : FALLBACK_CATEGORIES;
}

/** A gear item's category fields; `category` may be a pre-enum value still in the cache. */
type CategorySource = { category: string; category_label?: string };

export function isGearCategory(
	value: string,
	options: GearCategoryOption[]
): value is GearCategory {
	return options.some((o) => o.value === value);
}

/**
 * How to show an item's category. Items cached before categories became an enum may still hold
 * an old free-text value (e.g. "kitchen"); those count as misc. While the list is still loading
 * (`options` is empty), the item's own `category_label` is used.
 */
export function categoryOption(
	item: CategorySource,
	options: GearCategoryOption[]
): { value: string; label: string } {
	return (
		options.find((o) => o.value === item.category) ??
		options.find((o) => o.value === 'misc') ?? {
			value: item.category,
			label: item.category_label ?? item.category
		}
	);
}

/** Groups entries by category, ordered by label. */
export function groupByCategory<T>(
	entries: T[],
	itemOf: (entry: T) => CategorySource,
	options: GearCategoryOption[]
): { category: { value: string; label: string }; entries: T[] }[] {
	const groups = new Map<string, { category: { value: string; label: string }; entries: T[] }>();
	for (const entry of entries) {
		const category = categoryOption(itemOf(entry), options);
		let group = groups.get(category.value);
		if (!group) groups.set(category.value, (group = { category, entries: [] }));
		group.entries.push(entry);
	}
	return [...groups.values()].sort((a, b) => a.category.label.localeCompare(b.category.label));
}
