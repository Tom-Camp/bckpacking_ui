import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/sync/engine', () => ({ sync: vi.fn() }));

const { db, clearLocalData, GEAR_CATEGORIES_KEY, setMeta } = await import('./db');
const m = await import('./mutations');
const { food, gearCategories, gearItem, note, trip, tripGear } = await import('$lib/test/fixtures');
const { enqueuePatch } = await import('$lib/sync/outbox');
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

	it('edits a note', async () => {
		const n = note({ id: 'n1', content: 'Old' });
		await db.trips.put(trip({ notes: [n] }));

		await m.updateNote('trip-1', 'n1', 'Shuttle at 7');

		expect((await db.trips.get('trip-1'))?.notes[0].content).toBe('Shuttle at 7');
		const [entry] = await db.outbox.toArray();
		expect(entry).toMatchObject({
			method: 'PATCH',
			path: '/api/v1/trips/trip-1/notes/n1',
			body: { content: 'Shuttle at 7' },
			label: 'Note'
		});
	});

	it('edits a food item', async () => {
		const t = trip();
		t.food_plan!.food = [food({ id: 'f1', servings: 1 })];
		await db.trips.put(t);

		await m.updateFood('trip-1', 'f1', { servings: 2, kcal: 450 });

		expect((await db.trips.get('trip-1'))?.food_plan?.food[0]).toMatchObject({
			servings: 2,
			kcal: 450
		});
		const [entry] = await db.outbox.toArray();
		expect(entry).toMatchObject({
			path: '/api/v1/trips/trip-1/food-plan/items/f1',
			body: { servings: 2, kcal: 450 },
			label: 'Food item'
		});
	});

	it('edits the food targets', async () => {
		await db.trips.put(trip());

		await m.updateFoodPlan('trip-1', { target_kcal_per_day: 3000 });

		expect((await db.trips.get('trip-1'))?.food_plan).toMatchObject({
			target_kcal_per_day: 3000,
			target_food_g_per_day: 794
		});
		const [entry] = await db.outbox.toArray();
		expect(entry).toMatchObject({
			path: '/api/v1/trips/trip-1/food-plan',
			body: { target_kcal_per_day: 3000 },
			label: 'Food targets'
		});
	});
});

describe('deletes drop queued edits for the removed record', () => {
	const T = '/api/v1/trips/trip-1';
	// `n10`/`f10`/`g10` share a prefix with the deleted ids but must survive.
	const QUEUED = [
		T,
		`${T}/notes/n1`,
		`${T}/notes/n10`,
		`${T}/food-plan/items/f1`,
		`${T}/food-plan/items/f10`,
		`${T}/gear/g1`,
		`${T}/gear/g10`,
		'/api/v1/trips/trip-2'
	];
	const queued = async () => (await db.outbox.orderBy('seq').toArray()).map((e) => e.path);

	beforeEach(async () => {
		vi.stubGlobal('navigator', { onLine: true });
		const t = trip({
			notes: [note({ id: 'n1' }), note({ id: 'n10' })],
			gear_list: [tripGear(gearItem(), { id: 'g1' }), tripGear(gearItem(), { id: 'g10' })]
		});
		t.food_plan!.food = [food({ id: 'f1' }), food({ id: 'f10' })];
		await db.trips.bulkPut([t, trip({ id: 'trip-2' })]);
		for (const path of QUEUED) await enqueuePatch(path, { x: 1 }, 'Edit');
		return () => vi.unstubAllGlobals();
	});

	it('deleteTrip drops everything under the trip', async () => {
		mockApi({ [`DELETE ${T}`]: () => respond(204) });
		await m.deleteTrip('trip-1');

		expect(await db.trips.get('trip-1')).toBeUndefined();
		expect(await queued()).toEqual(['/api/v1/trips/trip-2']);
	});

	it.each([
		['deleteNote', () => m.deleteNote('trip-1', 'n1'), `${T}/notes/n1`],
		['deleteFood', () => m.deleteFood('trip-1', 'f1'), `${T}/food-plan/items/f1`],
		['removeTripGear', () => m.removeTripGear('trip-1', 'g1'), `${T}/gear/g1`]
	])('%s drops only its own path', async (_name, remove, path) => {
		mockApi({ [`DELETE ${path}`]: () => respond(204) });
		await remove();

		expect(await queued()).toEqual(QUEUED.filter((p) => p !== path));
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

	it('archive a closet item in every trip that uses it', async () => {
		vi.stubGlobal('navigator', { onLine: true });
		const item = gearItem();
		await db.gearItems.put(item);
		await db.trips.bulkPut([
			trip({ id: 'a', gear_list: [tripGear(item)] }),
			trip({ id: 'b', gear_list: [tripGear(item)] })
		]);
		mockApi({ [`DELETE /api/v1/gear/${item.id}`]: () => respond(204) });

		await m.archiveGearItem(item.id);

		expect((await db.gearItems.get(item.id))?.archived_at).toEqual(expect.any(String));
		for (const id of ['a', 'b'])
			expect((await db.trips.get(id))?.gear_list[0].gear_item.archived_at).toEqual(
				expect.any(String)
			);
		vi.unstubAllGlobals();
	});
});
