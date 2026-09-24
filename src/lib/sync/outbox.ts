import { db } from '$lib/data/db';

/** The outbox entry currently being sent; it must not be merged into. */
let inFlightSeq: number | null = null;

/** Bumped on every local write so a pull that started earlier doesn't overwrite it. */
let localVersion = 0;

export function claimInFlight(seq: number | null) {
	inFlightSeq = seq;
}

export function bumpLocalVersion() {
	localVersion++;
}

export function getLocalVersion() {
	return localVersion;
}

/**
 * Queues a PATCH. Consecutive edits to the same resource collapse into one request (later
 * fields win), unless the earlier one is already on the wire. Call inside a `db.outbox`
 * rw transaction together with the optimistic local write.
 */
export async function enqueuePatch(
	path: string,
	body: Record<string, unknown>,
	label: string
): Promise<void> {
	bumpLocalVersion();
	const last = await db.outbox.where('path').equals(path).last();
	if (last?.seq !== undefined && last.seq !== inFlightSeq) {
		await db.outbox.update(last.seq, { body: { ...last.body, ...body }, label });
		return;
	}
	await db.outbox.add({
		method: 'PATCH',
		path,
		body,
		label,
		createdAt: Date.now(),
		attempts: 0
	});
}
