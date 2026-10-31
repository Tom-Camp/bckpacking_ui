import type { GearCategoryOption, GearItem, Trip, User } from '$lib/api/types';
import { categoryOptions } from '$lib/domain/gear';
import { db, GEAR_CATEGORIES_KEY, getMeta } from './db';

// Query functions for `live()`. The UI only ever reads from IndexedDB; sync keeps it fresh.

export function allTrips(): Promise<Trip[]> {
	return db.trips.orderBy('created_at').reverse().toArray();
}

export function tripById(id: string): Promise<Trip | undefined> {
	return db.trips.get(id);
}

export async function gearCloset(): Promise<GearItem[]> {
	const items = await db.gearItems.toArray();
	return items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** The API's gear categories as of the last sync, or the bundled list before the first one. */
export async function gearCategories(): Promise<GearCategoryOption[]> {
	return categoryOptions(await getMeta<GearCategoryOption[]>(GEAR_CATEGORIES_KEY));
}

export function currentUser(): Promise<User | undefined> {
	return db.users.toCollection().first();
}

export function pendingEdits() {
	return db.outbox.orderBy('seq').toArray();
}

export function failedEdits() {
	return db.failed.reverse().toArray();
}
