import type { ChecklistItem, ChecklistItemKey, ChecklistStatus, TripType } from '$lib/api/types';

export const CHECKLIST_LABELS: Record<ChecklistItemKey, { label: string; hint: string }> = {
	permit: { label: 'Permit', hint: 'Obtained, or n/a if none is required' },
	water_sources: { label: 'Water sources', hint: 'Known and reliable for this season' },
	resupply_points: { label: 'Resupply points', hint: 'Planned or n/a' },
	shuttle_scheduled: { label: 'Shuttle scheduled', hint: 'Needed for point-to-point trips' },
	weather_checked: { label: 'Weather checked', hint: 'Forecast reviewed close to departure' },
	cell_coverage: { label: 'Cell coverage', hint: 'Know where you will and won’t have signal' },
	offline_map: { label: 'Offline map', hint: 'Downloaded to your phone or printed' },
	fire_restrictions: { label: 'Fire restrictions', hint: 'Checked with the land manager' },
	route_shared: { label: 'Route shared', hint: 'Someone at home has your plan' }
};

export const CHECKLIST_ORDER = Object.keys(CHECKLIST_LABELS) as ChecklistItemKey[];

export const STATUS_LABELS: Record<ChecklistStatus, string> = {
	todo: 'To do',
	done: 'Done',
	not_applicable: 'N/A'
};

export function sortChecklist<T extends Pick<ChecklistItem, 'item'>>(items: T[]): T[] {
	return [...items].sort(
		(a, b) => CHECKLIST_ORDER.indexOf(a.item) - CHECKLIST_ORDER.indexOf(b.item)
	);
}

/** Mirrors the API's `checklist_ready`: nothing left to do. */
export function checklistReady(items: Pick<ChecklistItem, 'status'>[]): boolean {
	return items.every((i) => i.status !== 'todo');
}

/** Mirrors the API: loops and out-and-backs need no shuttle. */
export function shuttleStatusFor(tripType: TripType): ChecklistStatus {
	return tripType === 'point-to-point' ? 'todo' : 'not_applicable';
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
	loop: 'Loop',
	'out-and-back': 'Out and back',
	'point-to-point': 'Point to point'
};
