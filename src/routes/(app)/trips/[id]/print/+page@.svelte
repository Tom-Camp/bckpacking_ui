<script lang="ts">
	// Print-friendly single page with everything for the trail. Reads from IndexedDB, so it works
	// offline; "Save as PDF" in the print dialog gives a file to keep. Uses the root layout (@)
	// so the app header and nav aren't printed.
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { Button } from '$lib/components/ui/button';
	import { live } from '$lib/data/live.svelte';
	import { currentUser, gearCategories, tripById } from '$lib/data/queries';
	import {
		CHECKLIST_LABELS,
		sortChecklist,
		STATUS_LABELS,
		TRIP_TYPE_LABELS
	} from '$lib/domain/checklist';
	import { groupByCategory } from '$lib/domain/gear';
	import { dayLabel, formatDateRange, MEAL_LABELS, planByDay } from '$lib/domain/food';
	import { formatDistance, formatElevation, formatVolume, formatWeight } from '$lib/domain/units';
	import { gearLineWeight, summarizeWeights } from '$lib/domain/weights';

	const trip = live(
		(id) => tripById(id),
		() => page.params.id ?? ''
	);
	const me = live(currentUser);
	const categories = live(gearCategories);
	const units = $derived(me.current?.measurements ?? 'imperial');

	const t = $derived(trip.current);
	const weights = $derived(t ? summarizeWeights(t, me.current?.body_weight_g) : null);
	const gearGroups = $derived(
		t ? groupByCategory(t.gear_list, (l) => l.gear_item, categories.current ?? []) : []
	);
	const days = $derived(t ? planByDay(t, t.food_plan) : []);
</script>

<svelte:head><title>{t?.name ?? 'Trip'} (print) · bckpack.ing</title></svelte:head>

<div class="mx-auto max-w-3xl p-6 text-sm print:max-w-none print:p-0">
	<div class="mb-6 flex items-center gap-2 print:hidden">
		<Button variant="ghost" size="sm" href="/trips/{page.params.id}"><ArrowLeftIcon /> Back</Button>
		<Button class="ml-auto" onclick={() => window.print()}
			><PrinterIcon /> Print / Save as PDF</Button
		>
	</div>

	{#if !t}
		<p>{trip.loading ? 'Loading…' : 'Trip not found on this device.'}</p>
	{:else}
		<header class="mb-4 border-b pb-3">
			<h1 class="text-2xl font-bold">{t.name}</h1>
			<p class="text-muted-foreground">
				{[t.area, formatDateRange(t.start_date, t.end_date), TRIP_TYPE_LABELS[t.trip_type]]
					.filter(Boolean)
					.join(' · ')}
			</p>
		</header>

		{#if t.emergency_contact}
			<section class="mb-4 break-inside-avoid rounded border-2 border-black p-3">
				<h2 class="font-bold uppercase">Emergency contact</h2>
				<p class="whitespace-pre-wrap">{t.emergency_contact}</p>
			</section>
		{/if}

		<section class="mb-4 grid break-inside-avoid grid-cols-2 gap-x-6 gap-y-1">
			{#if t.start_trailhead}<p>
					<b>{t.trip_type === 'point-to-point' ? 'Start' : 'Trailhead'}:</b>
					{t.start_trailhead}
				</p>{/if}
			{#if t.trip_type === 'point-to-point' && t.end_trailhead}<p>
					<b>End:</b>
					{t.end_trailhead}
				</p>{/if}
			{#if t.total_distance_m !== null}<p>
					<b>Distance:</b>
					{formatDistance(t.total_distance_m, units)}
				</p>{/if}
			{#if t.elevation_gain_m !== null}<p>
					<b>Elevation gain:</b>
					{formatElevation(t.elevation_gain_m, units)}
				</p>{/if}
			<p><b>Water carry:</b> {formatVolume(t.water_carry_l)}</p>
			{#if t.map_link}<p class="col-span-2 break-all"><b>Map:</b> {t.map_link}</p>{/if}
		</section>

		{#if t.description}<p class="mb-4 whitespace-pre-wrap">{t.description}</p>{/if}

		<section class="mb-6 break-inside-avoid">
			<h2 class="mb-2 border-b text-lg font-bold">Pre-trip checklist</h2>
			<ul class="grid grid-cols-1 gap-1">
				{#each sortChecklist(t.checklist_items) as item (item.id)}
					<li class="flex gap-2">
						<span class="font-mono"
							>{item.status === 'done'
								? '[x]'
								: item.status === 'not_applicable'
									? '[–]'
									: '[ ]'}</span
						>
						<span>
							<b>{CHECKLIST_LABELS[item.item].label}</b>
							<span class="text-muted-foreground">({STATUS_LABELS[item.status]})</span>
							{#if item.details}: {item.details}{/if}
						</span>
					</li>
				{/each}
			</ul>
		</section>

		{#if weights}
			<section class="mb-6 break-inside-avoid">
				<h2 class="mb-2 border-b text-lg font-bold">Weight</h2>
				<p>
					<b>Pack {formatWeight(weights.pack_g, units)}</b>
					{#if weights.body_pct !== null}({weights.body_pct.toFixed(1)}% body weight){/if}
					· Base {formatWeight(weights.base_g, units)} · Consumables {formatWeight(
						weights.consumable_g,
						units
					)} · Food {formatWeight(weights.food_g, units)} · Water {formatWeight(
						weights.water_g,
						units
					)} · Worn
					{formatWeight(weights.worn_g, units)}
				</p>
			</section>
		{/if}

		{#if t.gear_list.length}
			<section class="mb-6">
				<h2 class="mb-2 border-b text-lg font-bold">Gear</h2>
				<div class="columns-2 gap-6">
					{#each gearGroups as { category, entries: lines } (category.value)}
						<div class="mb-3 break-inside-avoid">
							<h3 class="font-semibold">{category.label}</h3>
							<ul>
								{#each lines as line (line.id)}
									<li class="flex gap-2">
										<span class="font-mono">{line.packed ? '[x]' : '[ ]'}</span>
										<span class="flex-1">
											{line.gear_item.name}{line.quantity > 1 ? ` ×${line.quantity}` : ''}
											{#if line.gear_item.kind !== 'base'}<i>({line.gear_item.kind})</i>{/if}
										</span>
										<span class="tabular-nums">{formatWeight(gearLineWeight(line), units)}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if t.food_plan?.food.length}
			<section class="mb-6">
				<h2 class="mb-2 border-b text-lg font-bold">Food</h2>
				{#each days as d (d.day)}
					<div class="mb-3 break-inside-avoid">
						<h3 class="font-semibold">
							{dayLabel(d.day, t.start_date)}
							<span class="font-normal text-muted-foreground">
								· {Math.round(d.kcal).toLocaleString()} kcal · {formatWeight(d.weight_g, units)}
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
			</section>
		{/if}

		{#if t.notes.length}
			<section class="mb-6">
				<h2 class="mb-2 border-b text-lg font-bold">Notes</h2>
				{#each t.notes as note (note.id)}
					<p class="mb-2 break-inside-avoid whitespace-pre-wrap">{note.content}</p>
				{/each}
			</section>
		{/if}
	{/if}
</div>

<style>
	@media print {
		@page {
			margin: 1.5cm;
		}
		:global(body) {
			background: white !important;
			color: black !important;
		}
	}
</style>
