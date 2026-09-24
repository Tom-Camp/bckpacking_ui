<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { getAppContext } from '$lib/app-context';
	import InstallHint from '$lib/components/InstallHint.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { live } from '$lib/data/live.svelte';
	import { allTrips } from '$lib/data/queries';
	import { TRIP_TYPE_LABELS } from '$lib/domain/checklist';
	import { formatDateRange } from '$lib/domain/food';
	import { formatWeight } from '$lib/domain/units';
	import { summarizeWeights } from '$lib/domain/weights';

	const app = getAppContext();
	const trips = live(allTrips);
</script>

<svelte:head><title>Trips · bckpack.ing</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-semibold tracking-tight">Trips</h1>
		<OnlineButton href="/trips/new">
			<PlusIcon /> New trip
		</OnlineButton>
	</div>

	<InstallHint />

	{#if trips.loading && !trips.current}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<Skeleton class="h-36" />
			<Skeleton class="h-36" />
		</div>
	{:else if !trips.current?.length}
		<Card.Root>
			<Card.Header>
				<Card.Title>No trips yet</Card.Title>
				<Card.Description>
					Create a trip to get a pre-trip checklist, a gear list with pack weight, and a food plan.
				</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each trips.current as trip (trip.id)}
				{@const weights = summarizeWeights(trip, app.user?.body_weight_g)}
				{@const dates = formatDateRange(trip.start_date, trip.end_date)}
				<a href="/trips/{trip.id}" class="group">
					<Card.Root class="h-full transition-colors group-hover:border-foreground/30">
						<Card.Header>
							<Card.Title>{trip.name}</Card.Title>
							<Card.Description class="flex flex-wrap gap-x-3 gap-y-1">
								{#if trip.area}
									<span class="flex items-center gap-1"
										><MapPinIcon class="size-3.5" />{trip.area}</span
									>
								{/if}
								{#if dates}
									<span class="flex items-center gap-1"
										><CalendarIcon class="size-3.5" />{dates}</span
									>
								{/if}
							</Card.Description>
						</Card.Header>
						<Card.Content class="flex flex-row flex-wrap items-center gap-2 text-sm">
							<Badge variant="outline">{TRIP_TYPE_LABELS[trip.trip_type]}</Badge>
							{#if trip.checklist_ready}
								<Badge variant="secondary"><CircleCheckIcon /> Ready</Badge>
							{:else}
								<Badge variant="outline">
									{trip.checklist_items.filter((i) => i.status === 'todo').length} to do
								</Badge>
							{/if}
							<span class="ml-auto text-muted-foreground">
								Pack {formatWeight(weights.pack_g, app.units)}
							</span>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
