<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import type { Trip } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import { TRIP_TYPE_LABELS } from '$lib/domain/checklist';
	import { formatDateRange, tripDays } from '$lib/domain/food';
	import { formatDistance, formatElevation, formatVolume } from '$lib/domain/units';
	import Notes from './Notes.svelte';
	import WeightSummary from './WeightSummary.svelte';

	let { trip }: { trip: Trip } = $props();

	const app = getAppContext();
	const dates = $derived.by(() => {
		const range = formatDateRange(trip.start_date, trip.end_date);
		const days = tripDays(trip);
		return range && days ? `${range} (${days} day${days > 1 ? 's' : ''})` : range;
	});

	const details = $derived(
		[
			['Dates', dates],
			['Type', TRIP_TYPE_LABELS[trip.trip_type]],
			['Area', trip.area],
			[trip.trip_type === 'point-to-point' ? 'Start trailhead' : 'Trailhead', trip.start_trailhead],
			['End trailhead', trip.trip_type === 'point-to-point' ? trip.end_trailhead : null],
			[
				'Distance',
				trip.total_distance_m !== null ? formatDistance(trip.total_distance_m, app.units) : null
			],
			[
				'Elevation gain',
				trip.elevation_gain_m !== null ? formatElevation(trip.elevation_gain_m, app.units) : null
			],
			['Water carry', formatVolume(trip.water_carry_l)]
		].filter((row): row is [string, string] => !!row[1])
	);
</script>

<div class="grid grid-cols-1 gap-6">
	{#if trip.emergency_contact}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
		>
			<p class="font-medium">Emergency contact</p>
			<p class="whitespace-pre-wrap">{trip.emergency_contact}</p>
		</div>
	{/if}

	<dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
		{#each details as [label, value] (label)}
			<div>
				<dt class="text-muted-foreground">{label}</dt>
				<dd class="font-medium">{value}</dd>
			</div>
		{/each}
		{#if trip.map_link}
			<div>
				<dt class="text-muted-foreground">Map</dt>
				<dd>
					<a
						href={trip.map_link}
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1 font-medium underline underline-offset-4"
					>
						Open map <ExternalLinkIcon class="size-3.5" />
					</a>
				</dd>
			</div>
		{/if}
	</dl>

	{#if trip.description}
		<p class="text-sm whitespace-pre-wrap">{trip.description}</p>
	{/if}

	<WeightSummary {trip} />
	<Notes {trip} />
</div>
