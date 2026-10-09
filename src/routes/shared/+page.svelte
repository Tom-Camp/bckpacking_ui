<script lang="ts">
	// Public, read-only view of a shared trip. Outside (app), so it needs no sign-in and doesn't
	// start sync. The token lives in the URL fragment, which never reaches a server; it is sent
	// only in the X-Share-Token header. The trip is held in component state and never cached in
	// Dexie: it isn't the viewer's trip.
	import { page } from '$app/state';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import MountainIcon from '@lucide/svelte/icons/mountain';
	import { ApiError, call, OfflineError, publicApi } from '$lib/api/client';
	import type { SharedTrip, Unit } from '$lib/api/types';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { live } from '$lib/data/live.svelte';
	import { currentUser } from '$lib/data/queries';
	import {
		CHECKLIST_LABELS,
		sortChecklist,
		STATUS_LABELS,
		TRIP_TYPE_LABELS
	} from '$lib/domain/checklist';
	import { dayLabel, formatDateRange, MEAL_LABELS, planByDay, tripDays } from '$lib/domain/food';
	import { groupByCategory } from '$lib/domain/gear';
	import { formatDistance, formatElevation, formatVolume, formatWeight } from '$lib/domain/units';
	import { gearLineWeight, summarizeWeights } from '$lib/domain/weights';
	import { errorMessage } from '$lib/errors';

	const UNITS_KEY = 'shared-units';

	const token = $derived(page.url.hash.slice(1));

	let trip = $state<SharedTrip | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);

	// Only the latest request may update the page.
	let generation = 0;

	/** A background refresh keeps the trip on screen, and ignores being offline. */
	async function load(current: string, background = false) {
		const id = ++generation;
		if (!background) {
			trip = null;
			error = null;
			loading = true;
		}
		try {
			const data = await call(() =>
				publicApi.GET('/api/v1/shared/trip', { headers: { 'X-Share-Token': current } })
			);
			if (id !== generation) return;
			trip = data;
			error = null;
		} catch (e) {
			if (id !== generation || (background && e instanceof OfflineError)) return;
			trip = null;
			if (e instanceof ApiError && e.status === 404)
				error = 'This link is no longer valid. The owner may have stopped sharing it.';
			else if (e instanceof OfflineError) error = 'You’re offline. Connect to view this trip.';
			else error = errorMessage(e);
		} finally {
			if (id === generation) loading = false;
		}
	}

	$effect(() => {
		const current = token;
		if (current) void load(current);
		else {
			generation++;
			trip = null;
			error = null;
		}
	});

	// The owner may change what's shared while this tab is open: refetch on coming back to it.
	function refresh() {
		if (token && document.visibilityState === 'visible') void load(token, true);
	}

	// The response doesn't carry the owner's unit preference: use the viewer's own, if they're
	// signed in on this device, unless they've picked one here.
	const me = live(currentUser);
	let chosen = $state<Unit | null>(readUnits());
	const units = $derived<Unit>(chosen ?? me.current?.measurements ?? 'imperial');

	function readUnits(): Unit | null {
		try {
			const v = localStorage.getItem(UNITS_KEY);
			return v === 'imperial' || v === 'metric' ? v : null;
		} catch {
			return null;
		}
	}

	function chooseUnits(value: string) {
		if (value !== 'imperial' && value !== 'metric') return;
		chosen = value;
		try {
			localStorage.setItem(UNITS_KEY, value);
		} catch {
			// Storage unavailable (private mode); the choice lasts for this page only.
		}
	}

	const dates = $derived.by(() => {
		if (!trip) return null;
		const range = formatDateRange(trip.start_date, trip.end_date);
		const days = tripDays(trip);
		return range && days ? `${range} (${days} day${days > 1 ? 's' : ''})` : range;
	});

	const details = $derived(
		trip
			? [
					['Dates', dates],
					['Type', TRIP_TYPE_LABELS[trip.trip_type]],
					[
						trip.trip_type === 'point-to-point' ? 'Start trailhead' : 'Trailhead',
						trip.start_trailhead
					],
					['End trailhead', trip.trip_type === 'point-to-point' ? trip.end_trailhead : null],
					[
						'Distance',
						trip.total_distance_m !== null ? formatDistance(trip.total_distance_m, units) : null
					],
					[
						'Elevation gain',
						trip.elevation_gain_m !== null ? formatElevation(trip.elevation_gain_m, units) : null
					],
					['Water carry', formatVolume(trip.water_carry_l)]
				].filter((row): row is [string, string] => !!row[1])
			: []
	);

	const gearGroups = $derived(
		trip?.gear_list ? groupByCategory(trip.gear_list, (l) => l.gear_item, []) : []
	);
	const weights = $derived(
		trip ? summarizeWeights({ ...trip, gear_list: trip.gear_list ?? [] }) : null
	);
	const days = $derived(trip?.food_plan ? planByDay(trip, trip.food_plan) : []);
	const todo = $derived(trip?.checklist_items?.filter((i) => i.status === 'todo').length ?? 0);
</script>

<svelte:document onvisibilitychange={refresh} />
<svelte:window onfocus={refresh} />

<svelte:head>
	<title>{trip?.name ?? 'Shared trip'} · bckpack.ing</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet empty()}
	<p class="text-sm text-muted-foreground">Nothing added yet.</p>
{/snippet}

<div class="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-6 print:p-0">
	{#if !token}
		<div class="grid gap-2">
			<h1 class="text-xl font-semibold">This link isn’t complete</h1>
			<p class="text-sm text-muted-foreground">
				Ask the person who shared it to send the whole link again.
			</p>
		</div>
	{:else if error}
		<div class="grid gap-2">
			<h1 class="text-xl font-semibold">Can’t show this trip</h1>
			<p class="text-sm text-muted-foreground">{error}</p>
		</div>
	{:else if loading || !trip}
		<div class="grid grid-cols-1 gap-4" aria-label="Loading">
			<Skeleton class="h-10 w-2/3" />
			<Skeleton class="h-64" />
		</div>
	{:else}
		{@const t = trip}
		<header class="flex flex-col gap-3 sm:flex-row sm:items-start">
			<div class="min-w-0 flex-1">
				<h1 class="text-2xl font-semibold tracking-tight">{t.name}</h1>
				{#if t.area}<p class="text-sm text-muted-foreground">{t.area}</p>{/if}
				<p class="text-sm text-muted-foreground">Shared by {t.owner.username}</p>
			</div>
			<ToggleGroup.Root
				type="single"
				variant="outline"
				size="sm"
				value={units}
				onValueChange={chooseUnits}
				class="print:hidden"
				aria-label="Units"
			>
				<ToggleGroup.Item value="imperial" class="px-3">Imperial</ToggleGroup.Item>
				<ToggleGroup.Item value="metric" class="px-3">Metric</ToggleGroup.Item>
			</ToggleGroup.Root>
		</header>

		{#if t.emergency_contact !== null}
			<section
				class="break-inside-avoid rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
			>
				<h2 class="font-medium">Emergency contact</h2>
				<p class="whitespace-pre-wrap">{t.emergency_contact}</p>
			</section>
		{/if}

		<section class="grid gap-4">
			<dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
				{#each details as [label, value] (label)}
					<div>
						<dt class="text-muted-foreground">{label}</dt>
						<dd class="font-medium">{value}</dd>
					</div>
				{/each}
				{#if t.map_link}
					<div>
						<dt class="text-muted-foreground">Map</dt>
						<dd>
							<a
								href={t.map_link}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 font-medium break-all underline underline-offset-4"
							>
								Open map <ExternalLinkIcon class="size-3.5 print:hidden" />
							</a>
							<span class="hidden break-all print:inline">{t.map_link}</span>
						</dd>
					</div>
				{/if}
			</dl>
			{#if t.description}<p class="text-sm whitespace-pre-wrap">{t.description}</p>{/if}
		</section>

		{#if t.checklist_items !== null}
			<section class="grid break-inside-avoid gap-2">
				<h2 class="border-b pb-1 text-lg font-semibold">
					Checklist
					{#if t.checklist_items.length}
						<span class="ml-1 text-sm font-normal text-muted-foreground">
							· {t.checklist_ready ? 'Ready' : `${todo} to do`}
						</span>
					{/if}
				</h2>
				{#if t.checklist_items.length}
					<ul class="grid gap-1 text-sm">
						{#each sortChecklist(t.checklist_items) as item (item.item)}
							<li class="flex justify-between gap-4">
								<span>{CHECKLIST_LABELS[item.item].label}</span>
								<span class={item.status === 'todo' ? 'font-medium' : 'text-muted-foreground'}
									>{STATUS_LABELS[item.status]}</span
								>
							</li>
						{/each}
					</ul>
				{:else}
					{@render empty()}
				{/if}
			</section>
		{/if}

		{#if t.gear_list !== null && weights}
			<section class="grid gap-3">
				<h2 class="border-b pb-1 text-lg font-semibold">Gear</h2>
				{#if t.gear_list.length}
					<p class="text-sm">
						Base <b class="tabular-nums">{formatWeight(weights.base_g, units)}</b>
						· Consumables
						<b class="tabular-nums">{formatWeight(weights.consumable_g, units)}</b>
						· Worn <b class="tabular-nums">{formatWeight(weights.worn_g, units)}</b>
					</p>
					<div class="grid gap-4 sm:grid-cols-2">
						{#each gearGroups as { category, entries: lines } (category.value)}
							<div class="break-inside-avoid">
								<h3 class="mb-1 text-sm font-semibold">{category.label}</h3>
								<ul class="grid gap-1 text-sm">
									{#each lines as line, i (i)}
										<li class="flex gap-2">
											<span class="font-mono" aria-label={line.packed ? 'Packed' : 'Not packed'}
												>{line.packed ? '[x]' : '[ ]'}</span
											>
											<span class="min-w-0 flex-1 break-words">
												{line.gear_item.name}{line.quantity > 1 ? ` ×${line.quantity}` : ''}
												{#if line.gear_item.kind !== 'base'}<i class="text-muted-foreground"
														>({line.gear_item.kind})</i
													>{/if}
											</span>
											<span class="tabular-nums">{formatWeight(gearLineWeight(line), units)}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				{:else}
					{@render empty()}
				{/if}
			</section>
		{/if}

		{#if t.food_plan !== null}
			{@const plan = t.food_plan}
			<section class="grid gap-3">
				<h2 class="border-b pb-1 text-lg font-semibold">Food</h2>
				{#if plan.food.length}
					<p class="text-sm text-muted-foreground">
						Daily target {plan.target_kcal_per_day.toLocaleString()} kcal · {formatWeight(
							plan.target_food_g_per_day,
							units
						)}
					</p>
					{#each days as d (d.day)}
						<div class="break-inside-avoid text-sm">
							<h3 class="font-semibold">
								{dayLabel(d.day, t.start_date)}
								<span class="font-normal text-muted-foreground">
									· {Math.round(d.kcal).toLocaleString()} / {plan.target_kcal_per_day.toLocaleString()}
									kcal · {formatWeight(d.weight_g, units)} / {formatWeight(
										plan.target_food_g_per_day,
										units
									)}
								</span>
							</h3>
							{#each d.meals.filter((m) => m.items.length) as m (m.meal)}
								<p>
									<b>{MEAL_LABELS[m.meal]}:</b>
									{m.items
										.map((f) => (f.servings !== 1 ? `${f.name} ×${f.servings}` : f.name))
										.join(', ')}
								</p>
							{/each}
						</div>
					{/each}
				{:else}
					{@render empty()}
				{/if}
			</section>
		{/if}
	{/if}

	<footer class="mt-auto border-t pt-4 text-sm text-muted-foreground print:hidden">
		<a href="/" class="inline-flex items-center gap-2 underline underline-offset-4">
			<MountainIcon class="size-4" /> Plan your own trips on bckpack.ing
		</a>
	</footer>
</div>
