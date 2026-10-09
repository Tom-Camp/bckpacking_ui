// Every write the UI can make. Two kinds:
//
// - Offline-capable edits (PATCH of an existing record): applied to the local cache at once and
//   queued in the outbox; the sync engine sends them when a connection is available.
// - Online-only actions (create/delete): the API assigns IDs and there are no tombstones, so
//   these call the API directly and then apply the response to the local cache.

import { api, call, OfflineError } from '$lib/api/client';
import type {
	ChecklistItemKey,
	ChecklistItemUpdate,
	FoodPlanUpdate,
	GearItem,
	GearItemCreate,
	GearItemUpdate,
	Trip,
	TripCreate,
	TripFoodCreate,
	TripFoodUpdate,
	TripGearCreate,
	TripGearUpdate,
	TripUpdate,
	UserUpdate
} from '$lib/api/types';
import { CHECKLIST_LABELS, checklistReady, shuttleStatusFor } from '$lib/domain/checklist';
import { sync } from '$lib/sync/engine';
import { bumpLocalVersion, enqueuePatch } from '$lib/sync/outbox';
import { db } from './db';
import { gearCategories } from './queries';

const TRIPS = '/api/v1/trips';
const GEAR = '/api/v1/gear';

// ---------------------------------------------------------------------------------------------
// Local cache helpers

async function editTrip(tripId: string, edit: (trip: Trip) => void): Promise<void> {
	const trip = await db.trips.get(tripId);
	if (!trip) throw new Error('Trip not found on this device');
	edit(trip);
	(trip as { checklist_ready: boolean }).checklist_ready = checklistReady(trip.checklist_items);
	await db.trips.put(trip);
}

/** Applies a closet item change to the closet and to every trip that uses the item. */
async function applyGearItem(item: GearItem): Promise<void> {
	await db.gearItems.put(item);
	await db.trips.toCollection().modify((trip) => {
		for (const line of trip.gear_list) {
			if (line.gear_item.id === item.id) line.gear_item = { ...item };
		}
	});
}

/** Drops queued edits for a resource that no longer exists (they would only fail with 404). */
async function dropQueued(pathPrefix: string): Promise<void> {
	await db.outbox
		.filter((e) => e.path === pathPrefix || e.path.startsWith(pathPrefix + '/'))
		.delete();
}

async function queueEdit(
	path: string,
	body: Record<string, unknown>,
	label: string,
	apply: () => Promise<void>
): Promise<void> {
	await db.transaction('rw', [db.trips, db.gearItems, db.outbox], async () => {
		await apply();
		await enqueuePatch(path, body, label);
	});
	void sync();
}

function requireOnline() {
	if (globalThis.navigator && !navigator.onLine) throw new OfflineError();
}

async function online<T>(request: Parameters<typeof call<T>>[0]): Promise<T> {
	requireOnline();
	const data = await call(request);
	bumpLocalVersion();
	return data;
}

// ---------------------------------------------------------------------------------------------
// Offline-capable edits

export function updateChecklistItem(
	tripId: string,
	key: ChecklistItemKey,
	body: ChecklistItemUpdate
) {
	return queueEdit(
		`${TRIPS}/${tripId}/checklist/${key}`,
		body,
		`Checklist: ${CHECKLIST_LABELS[key].label}`,
		() =>
			editTrip(tripId, (trip) => {
				const item = trip.checklist_items.find((i) => i.item === key);
				if (item) Object.assign(item, body);
			})
	);
}

export async function updateTripGear(tripId: string, tripGearId: string, body: TripGearUpdate) {
	const trip = await db.trips.get(tripId);
	const name = trip?.gear_list.find((g) => g.id === tripGearId)?.gear_item.name ?? 'item';
	return queueEdit(`${TRIPS}/${tripId}/gear/${tripGearId}`, body, `Gear: ${name}`, () =>
		editTrip(tripId, (t) => {
			const line = t.gear_list.find((g) => g.id === tripGearId);
			if (line) Object.assign(line, body);
		})
	);
}

export function updateNote(tripId: string, noteId: string, content: string) {
	return queueEdit(`${TRIPS}/${tripId}/notes/${noteId}`, { content }, 'Note', () =>
		editTrip(tripId, (trip) => {
			const note = trip.notes.find((n) => n.id === noteId);
			if (note) note.content = content;
		})
	);
}

export function updateFood(tripId: string, foodId: string, body: TripFoodUpdate) {
	return queueEdit(`${TRIPS}/${tripId}/food-plan/items/${foodId}`, body, 'Food item', () =>
		editTrip(tripId, (trip) => {
			const item = trip.food_plan?.food.find((f) => f.id === foodId);
			if (item) Object.assign(item, body);
		})
	);
}

export function updateFoodPlan(tripId: string, body: FoodPlanUpdate) {
	return queueEdit(`${TRIPS}/${tripId}/food-plan`, body, 'Food targets', () =>
		editTrip(tripId, (trip) => {
			if (trip.food_plan) Object.assign(trip.food_plan, body);
		})
	);
}

export function updateTrip(tripId: string, body: TripUpdate) {
	return queueEdit(`${TRIPS}/${tripId}`, body, 'Trip details', () =>
		editTrip(tripId, (trip) => {
			// Mirror the API: changing trip type updates the shuttle item unless it's done.
			if (body.trip_type && body.trip_type !== trip.trip_type) {
				const shuttle = trip.checklist_items.find((i) => i.item === 'shuttle_scheduled');
				if (shuttle && shuttle.status !== 'done') shuttle.status = shuttleStatusFor(body.trip_type);
			}
			Object.assign(trip, body);
		})
	);
}

export async function updateGearItem(itemId: string, body: GearItemUpdate) {
	const current = await db.gearItems.get(itemId);
	// Keep the cached label in step with the category until the next pull brings the server's.
	const categories = body.category ? await gearCategories() : [];
	const label = categories.find((c) => c.value === body.category)?.label;
	return queueEdit(`${GEAR}/${itemId}`, body, `Gear: ${current?.name ?? 'item'}`, async () => {
		if (current)
			await applyGearItem({ ...current, ...body, ...(label && { category_label: label }) });
	});
}

// ---------------------------------------------------------------------------------------------
// Online-only actions

export async function createTrip(body: TripCreate): Promise<Trip> {
	const trip = await online(() => api.POST('/api/v1/trips', { body }));
	await db.trips.put(trip);
	return trip;
}

export async function deleteTrip(tripId: string) {
	await online(() =>
		api.DELETE('/api/v1/trips/{trip_id}', { params: { path: { trip_id: tripId } } })
	);
	await db.transaction('rw', db.trips, db.outbox, async () => {
		await db.trips.delete(tripId);
		await dropQueued(`${TRIPS}/${tripId}`);
	});
}

/** The API mints the token, so turning sharing on needs a connection. */
export async function shareTrip(tripId: string): Promise<string> {
	const { share_token } = await online(() =>
		api.POST('/api/v1/trips/{trip_id}/share', { params: { path: { trip_id: tripId } } })
	);
	await editTrip(tripId, (trip) => (trip.share_token = share_token));
	return share_token;
}

/** The API keeps the section toggles when a link is revoked, so the cache does too. */
export async function unshareTrip(tripId: string) {
	await online(() =>
		api.DELETE('/api/v1/trips/{trip_id}/share', { params: { path: { trip_id: tripId } } })
	);
	await editTrip(tripId, (trip) => (trip.share_token = null));
}

export async function addNote(tripId: string, content: string) {
	const note = await online(() =>
		api.POST('/api/v1/trips/{trip_id}/notes', {
			params: { path: { trip_id: tripId } },
			body: { content }
		})
	);
	await editTrip(tripId, (trip) => trip.notes.push(note));
}

export async function deleteNote(tripId: string, noteId: string) {
	await online(() =>
		api.DELETE('/api/v1/trips/{trip_id}/notes/{note_id}', {
			params: { path: { trip_id: tripId, note_id: noteId } }
		})
	);
	await editTrip(tripId, (trip) => (trip.notes = trip.notes.filter((n) => n.id !== noteId)));
	await dropQueued(`${TRIPS}/${tripId}/notes/${noteId}`);
}

export async function addFood(tripId: string, body: TripFoodCreate) {
	const item = await online(() =>
		api.POST('/api/v1/trips/{trip_id}/food-plan/items', {
			params: { path: { trip_id: tripId } },
			body
		})
	);
	await editTrip(tripId, (trip) => trip.food_plan?.food.push(item));
}

export async function deleteFood(tripId: string, foodId: string) {
	await online(() =>
		api.DELETE('/api/v1/trips/{trip_id}/food-plan/items/{food_id}', {
			params: { path: { trip_id: tripId, food_id: foodId } }
		})
	);
	await editTrip(tripId, (trip) => {
		if (trip.food_plan) trip.food_plan.food = trip.food_plan.food.filter((f) => f.id !== foodId);
	});
	await dropQueued(`${TRIPS}/${tripId}/food-plan/items/${foodId}`);
}

export async function addTripGear(tripId: string, body: TripGearCreate) {
	const line = await online(() =>
		api.POST('/api/v1/trips/{trip_id}/gear', { params: { path: { trip_id: tripId } }, body })
	);
	await editTrip(tripId, (trip) => trip.gear_list.push(line));
}

export async function removeTripGear(tripId: string, tripGearId: string) {
	await online(() =>
		api.DELETE('/api/v1/trips/{trip_id}/gear/{trip_gear_id}', {
			params: { path: { trip_id: tripId, trip_gear_id: tripGearId } }
		})
	);
	await editTrip(
		tripId,
		(trip) => (trip.gear_list = trip.gear_list.filter((g) => g.id !== tripGearId))
	);
	await dropQueued(`${TRIPS}/${tripId}/gear/${tripGearId}`);
}

export async function copyGearFrom(tripId: string, sourceTripId: string) {
	const lines = await online(() =>
		api.POST('/api/v1/trips/{trip_id}/gear/copy-from/{source_trip_id}', {
			params: { path: { trip_id: tripId, source_trip_id: sourceTripId } }
		})
	);
	await editTrip(tripId, (trip) => (trip.gear_list = lines));
}

export async function createGearItem(body: GearItemCreate): Promise<GearItem> {
	const item = await online(() => api.POST('/api/v1/gear', { body }));
	await db.gearItems.put(item);
	return item;
}

/** The API archives rather than deletes, so trips that use the item keep it. */
export async function archiveGearItem(itemId: string) {
	await online(() =>
		api.DELETE('/api/v1/gear/{item_id}', { params: { path: { item_id: itemId } } })
	);
	const item = await db.gearItems.get(itemId);
	if (item) await applyGearItem({ ...item, archived_at: new Date().toISOString() });
}

export async function restoreGearItem(itemId: string) {
	const item = await online(() =>
		api.POST('/api/v1/gear/{item_id}/restore', { params: { path: { item_id: itemId } } })
	);
	await applyGearItem(item);
}

export async function updateProfile(body: UserUpdate) {
	const user = await online(() => api.PATCH('/api/v1/users/me', { body }));
	await db.users.put(user);
	return user;
}
