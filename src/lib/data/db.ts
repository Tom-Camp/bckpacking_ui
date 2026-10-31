import { Dexie, type Table } from 'dexie';
import type { GearItem, Trip, User } from '$lib/api/types';

/** A queued PATCH made while offline (or not yet flushed). Replayed in `seq` order. */
export interface OutboxEntry {
	seq?: number;
	method: 'PATCH';
	/** Concrete API path, e.g. `/api/v1/trips/<id>/checklist/permit`. */
	path: string;
	body: Record<string, unknown>;
	/** Short human description for the sync UI, e.g. "Checklist: Permit". */
	label: string;
	createdAt: number;
	attempts: number;
	lastError?: string;
}

/** An outbox entry the API rejected (404/409/422). Kept so the user can see what was lost. */
export interface FailedEntry extends Omit<OutboxEntry, 'seq'> {
	id?: number;
	status: number;
	error: string;
	failedAt: number;
}

export interface MetaRow {
	key: string;
	value: unknown;
}

export class BckpackDB extends Dexie {
	trips!: Table<Trip, string>;
	gearItems!: Table<GearItem, string>;
	users!: Table<User, string>;
	outbox!: Table<OutboxEntry, number>;
	failed!: Table<FailedEntry, number>;
	meta!: Table<MetaRow, string>;

	constructor(name = 'bckpacking') {
		super(name);
		this.version(1).stores({
			trips: 'id, created_at',
			gearItems: 'id, category',
			users: 'id',
			outbox: '++seq, path',
			failed: '++id',
			meta: 'key'
		});
	}
}

export const db = new BckpackDB();

/** Meta key holding the API's `GearCategoryOption[]`, refreshed on every pull. */
export const GEAR_CATEGORIES_KEY = 'gearCategories';

export async function getMeta<T>(key: string): Promise<T | undefined> {
	return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
	await db.meta.put({ key, value });
}

/** Wipes everything cached on this device (logout or a different user signing in). */
export async function clearLocalData(): Promise<void> {
	await db.transaction('rw', db.tables, async () => {
		await Promise.all(db.tables.map((t) => t.clear()));
	});
}

/** Asks the browser not to evict our IndexedDB data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
	try {
		if (!navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
