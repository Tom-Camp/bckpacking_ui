import { liveQuery } from 'dexie';
import { toast } from 'svelte-sonner';
import { api, apiUrl, authedFetch, call, describeDetail } from '$lib/api/client';
import { session } from '$lib/auth/session.svelte';
import { db, GEAR_CATEGORIES_KEY, getMeta, setMeta, type OutboxEntry } from '$lib/data/db';
import { claimInFlight, getLocalVersion } from './outbox';
import { syncStatus } from './status.svelte';

export type FlushResult = 'done' | 'offline' | 'auth' | 'server';

/** Replays queued PATCHes oldest-first. Stops at the first entry that can't be sent yet. */
export async function flush(): Promise<FlushResult> {
	for (;;) {
		let entry: OutboxEntry | undefined;
		// Claiming inside an outbox transaction serialises with enqueuePatch, so no edit is
		// merged into an entry after we've read its body.
		await db.transaction('rw', db.outbox, async () => {
			entry = await db.outbox.orderBy('seq').first();
			claimInFlight(entry?.seq ?? null);
		});
		if (!entry || entry.seq === undefined) return 'done';
		const seq = entry.seq;

		try {
			let response: Response;
			try {
				response = await authedFetch(apiUrl(entry.path), {
					method: entry.method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(entry.body)
				});
			} catch {
				await db.outbox.update(seq, { attempts: entry.attempts + 1, lastError: 'offline' });
				return 'offline';
			}

			if (response.ok) {
				await db.outbox.delete(seq);
				continue;
			}
			if (response.status === 401) return 'auth';
			if (response.status >= 500 || response.status === 408 || response.status === 429) {
				await db.outbox.update(seq, {
					attempts: entry.attempts + 1,
					lastError: `HTTP ${response.status}`
				});
				return 'server';
			}

			// 403/404/409/422: the change can never succeed (e.g. the record was deleted on
			// another device). Drop it; the next pull restores the server's version.
			const body = await response.json().catch(() => null);
			const error = describeDetail(body?.detail) ?? `HTTP ${response.status}`;
			const { seq: _seq, ...rest } = entry;
			await db.transaction('rw', db.outbox, db.failed, async () => {
				await db.failed.add({ ...rest, status: response.status, error, failedAt: Date.now() });
				await db.outbox.delete(seq);
			});
			toast.error(`Couldn't sync "${entry.label}"`, { description: error });
		} finally {
			claimInFlight(null);
		}
	}
}

/**
 * Replaces the local cache with the server's data. Returns false (without writing) if local
 * edits happened while fetching, so they aren't overwritten; the caller retries.
 */
export async function pull(): Promise<boolean> {
	const versionAtStart = getLocalVersion();
	const [me, trips, gear, categories] = await Promise.all([
		call(() => api.GET('/api/v1/users/me')),
		call(() => api.GET('/api/v1/trips')),
		call(() => api.GET('/api/v1/gear', { params: { query: { include_archived: true } } })),
		call(() => api.GET('/api/v1/gear/categories'))
	]);

	return db.transaction('rw', [db.trips, db.gearItems, db.users, db.outbox, db.meta], async () => {
		if (getLocalVersion() !== versionAtStart || (await db.outbox.count()) > 0) return false;
		await Promise.all([db.trips.clear(), db.gearItems.clear(), db.users.clear()]);
		await Promise.all([
			db.trips.bulkPut(trips),
			db.gearItems.bulkPut(gear),
			db.users.put(me),
			setMeta(GEAR_CATEGORIES_KEY, categories)
		]);
		const now = Date.now();
		await setMeta('lastSyncedAt', now);
		syncStatus.lastSyncedAt = now;
		return true;
	});
}

let running: Promise<void> | null = null;
let rerun = false;

/** Flush then pull. Concurrent calls coalesce into one extra pass. */
export function sync(): Promise<void> {
	if (running) {
		rerun = true;
		return running;
	}
	running = (async () => {
		do {
			rerun = false;
			await syncOnce();
		} while (rerun);
	})().finally(() => {
		running = null;
	});
	return running;
}

async function syncOnce(): Promise<void> {
	if (!session.signedIn) return;
	if (session.expired) {
		syncStatus.blocked = 'auth';
		return;
	}
	syncStatus.syncing = true;
	try {
		const result = await flush();
		if (result !== 'done') {
			syncStatus.blocked = result;
			return;
		}
		const pulled = await pull();
		if (!pulled) rerun = true;
		syncStatus.blocked = null;
	} catch (e) {
		const status = (e as { status?: number }).status;
		syncStatus.blocked = status === 401 ? 'auth' : status ? 'server' : 'offline';
	} finally {
		syncStatus.syncing = false;
	}
}

const RETRY_MS = 60_000;

/** Wires sync to connectivity, tab focus and a retry timer. Returns a cleanup function. */
export function startSync(): () => void {
	const onOnline = () => {
		syncStatus.online = true;
		void sync();
	};
	const onOffline = () => {
		syncStatus.online = false;
	};
	const onVisible = () => {
		if (document.visibilityState === 'visible') void sync();
	};
	window.addEventListener('online', onOnline);
	window.addEventListener('offline', onOffline);
	document.addEventListener('visibilitychange', onVisible);
	const timer = setInterval(() => {
		if (syncStatus.pending > 0 || syncStatus.blocked) void sync();
	}, RETRY_MS);

	const pending = liveQuery(() => db.outbox.count()).subscribe((n) => (syncStatus.pending = n));
	const failed = liveQuery(() => db.failed.count()).subscribe((n) => (syncStatus.failed = n));
	void getMeta<number>('lastSyncedAt').then((t) => (syncStatus.lastSyncedAt = t ?? null));

	void sync();

	return () => {
		window.removeEventListener('online', onOnline);
		window.removeEventListener('offline', onOffline);
		document.removeEventListener('visibilitychange', onVisible);
		clearInterval(timer);
		pending.unsubscribe();
		failed.unsubscribe();
	};
}
