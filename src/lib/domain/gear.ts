import type { GearCategory, GearCategoryOption } from '$lib/api/types';

// Categories come from `GET /gear/categories`, cached on each pull. `options` is that cached
// list, which is empty until the first pull.

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
 * an old free-text value (e.g. "kitchen"); those count as misc. Before the list is cached, the
 * item's own `category_label` is used.
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
