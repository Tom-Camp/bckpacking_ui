class SyncStatus {
	online = $state(globalThis.navigator?.onLine ?? true);
	syncing = $state(false);
	/** Queued edits not yet accepted by the API. */
	pending = $state(0);
	/** Edits the API rejected (see `db.failed`). */
	failed = $state(0);
	lastSyncedAt = $state<number | null>(null);
	/** Why the last sync attempt stopped early, if it did. */
	blocked = $state<'offline' | 'auth' | 'server' | null>(null);
}

export const syncStatus = new SyncStatus();
