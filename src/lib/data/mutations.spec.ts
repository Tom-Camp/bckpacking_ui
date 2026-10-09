import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/sync/engine', () => ({ sync: vi.fn() }));

const { db, clearLocalData, GEAR_CATEGORIES_KEY, setMeta } = await import('./db');
const m = await import('./mutations');
const { gearCategories, gearItem, trip, tripGear } = await import('$lib/test/fixtures');
const { mockApi, respond } = await import('$lib/test/api');
const { OfflineError } = await import('$lib/api/client');

beforeEach(async () => {
	await clearLocalData();
});

describe('offline edits', () => {
	it('applies checklist changes locally, recomputes readiness and queues a PATCH', async () => {
		await db.trips.put(trip());

		await m.updateChecklistItem('trip-1', 'permit', { status: 'done' });
		await m.updateChecklistItem('trip-1', 'shuttle_scheduled', { status: 'not_applicable' });

		const t = await db.trips.get('trip-1');
		expect(t?.checklist_items.find((i) => i.item === 'permit')?.status).toBe('done');
		expect(t?.checklist_ready).toBe(true);
		const queued = await db.outbox.orderBy('seq').toArray();
		expect(queued.map((e) => e.path)).toEqual([
			'/api/v1/trips/trip-1/checklist/permit',
			'/api/v1/trips/trip-1/checklist/shuttle_scheduled'
		]);
	});

	it('mirrors the shuttle rule when the trip type changes, unless the shuttle is done', async () => {
		await db.trips.put(trip());

		await m.updateTrip('trip-1', { trip_type: 'loop' });
		let t = await db.trips.get('trip-1');
		expect(t?.trip_type).toBe('loop');
		expect(t?.checklist_items.find((i) => i.item === 'shuttle_scheduled')?.status).toBe(
			'not_applicable'
		);

		await m.updateChecklistItem('trip-1', 'shuttle_scheduled', { status: 'done' });
		await m.updateTrip('trip-1', { trip_type: 'point-to-point' });
		t = await db.trips.get('trip-1');
		expect(t?.checklist_items.find((i) => i.item === 'shuttle_scheduled')?.status).toBe('done');
	});

	it('marks gear packed', async () => {
		const line = tripGear(gearItem());
		await db.trips.put(trip({ gear_list: [line] }));

		await m.updateTripGear('trip-1', line.id, { packed: true });

		expect((await db.trips.get('trip-1'))?.gear_list[0].packed).toBe(true);
		const [entry] = await db.outbox.toArray();
		expect(entry.body).toEqual({ packed: true });
		expect(entry.label).toBe('Gear: Tent');
	});

	it('propagates closet edits to every trip using the item', async () => {
		const item = gearItem();
		await db.gearItems.put(item);
		await setMeta(GEAR_CATEGORIES_KEY, gearCategories);
		await db.trips.bulkPut([
			trip({ id: 'a', gear_list: [tripGear(item)] }),
			trip({ id: 'b', gear_list: [tripGear(item)] })
		]);

		await m.updateGearItem(item.id, { weight_g: 900, category: 'sleep' });

		for (const id of ['a', 'b']) {
			const g = (await db.trips.get(id))?.gear_list[0].gear_item;
			expect(g?.weight_g).toBe(900);
			expect(g?.category).toBe('sleep');
			expect(g?.category_label).toBe('Sleep');
		}
	});
});

describe('online-only actions', () => {
	it('refuse to run offline', async () => {
		vi.stubGlobal('navigator', { onLine: false });
		await expect(m.addNote('trip-1', 'hello')).rejects.toThrow(/connection/);
		await expect(m.shareTrip('trip-1')).rejects.toBeInstanceOf(OfflineError);
		await expect(m.unshareTrip('trip-1')).rejects.toBeInstanceOf(OfflineError);
		vi.unstubAllGlobals();
	});

	it('save the share token from the API and clear it when sharing stops', async () => {
		vi.stubGlobal('navigator', { onLine: true });
		await db.trips.put(trip({ share_gear: true, share_emergency_contact: true }));
		const requests = mockApi({
			'POST /api/v1/trips/trip-1/share': () => ({ share_token: 'tok' }),
			'DELETE /api/v1/trips/trip-1/share': () => respond(204)
		});

		expect(await m.shareTrip('trip-1')).toBe('tok');
		expect((await db.trips.get('trip-1'))?.share_token).toBe('tok');

		await m.unshareTrip('trip-1');
		expect(await db.trips.get('trip-1')).toMatchObject({
			share_token: null,
			share_gear: true,
			share_food: false,
			share_checklist: false,
			share_emergency_contact: true
		});
		expect(requests.map((r) => r.route)).toEqual([
			'POST /api/v1/trips/trip-1/share',
			'DELETE /api/v1/trips/trip-1/share'
		]);
		vi.unstubAllGlobals();
	});
});
