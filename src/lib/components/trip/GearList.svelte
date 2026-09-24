<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { Trip, TripGear } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Progress } from '$lib/components/ui/progress';
	import * as Select from '$lib/components/ui/select';
	import { live } from '$lib/data/live.svelte';
	import { addTripGear, copyGearFrom, removeTripGear, updateTripGear } from '$lib/data/mutations';
	import { allTrips, gearCloset } from '$lib/data/queries';
	import { formatWeight } from '$lib/domain/units';
	import { gearLineWeight } from '$lib/domain/weights';
	import { attempt } from '$lib/errors';
	import { cn } from '$lib/utils';
	import WeightSummary from './WeightSummary.svelte';

	let { trip }: { trip: Trip } = $props();

	const app = getAppContext();
	const closet = live(gearCloset);
	const trips = live(allTrips);

	const groups = $derived.by(() => {
		const byCategory: Record<string, TripGear[]> = {};
		for (const line of trip.gear_list) (byCategory[line.gear_item.category] ??= []).push(line);
		return Object.entries(byCategory)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, lines]) => ({
				category,
				lines: lines.sort((a, b) => a.gear_item.name.localeCompare(b.gear_item.name)),
				weight: lines.reduce((s, l) => s + (l.gear_item.kind === 'worn' ? 0 : gearLineWeight(l)), 0)
			}));
	});
	const packed = $derived(trip.gear_list.filter((l) => l.packed).length);

	// Add-from-closet dialog
	let addOpen = $state(false);
	let search = $state('');
	const onTrip = $derived(new Set(trip.gear_list.map((l) => l.gear_item.id)));
	const available = $derived(
		(closet.current ?? []).filter(
			(i) =>
				!i.archived_at &&
				!onTrip.has(i.id) &&
				`${i.name} ${i.category}`.toLowerCase().includes(search.toLowerCase())
		)
	);

	// Copy-from-trip dialog
	let copyOpen = $state(false);
	let copySource = $state('');
	const otherTrips = $derived(
		(trips.current ?? []).filter((t) => t.id !== trip.id && t.gear_list.length)
	);

	function setQuantity(line: TripGear, quantity: number) {
		if (quantity < 1) return;
		void attempt(() => updateTripGear(trip.id, line.id, { quantity }));
	}
</script>

<div class="grid grid-cols-1 gap-4">
	<WeightSummary {trip} />

	<div class="flex flex-wrap items-center gap-2">
		<div class="mr-auto grid min-w-40 flex-1 gap-1">
			<span class="text-sm text-muted-foreground">{packed} of {trip.gear_list.length} packed</span>
			<Progress value={packed} max={Math.max(trip.gear_list.length, 1)} />
		</div>
		<OnlineButton
			variant="outline"
			size="sm"
			onclick={() => (copyOpen = true)}
			disabled={!otherTrips.length}
		>
			<CopyIcon /> Copy from trip
		</OnlineButton>
		<OnlineButton size="sm" onclick={() => (addOpen = true)}>
			<PlusIcon /> Add gear
		</OnlineButton>
	</div>

	{#if !trip.gear_list.length}
		<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
			No gear yet. Add items from your <a href="/gear" class="underline">gear closet</a>, or copy
			the list from another trip.
		</p>
	{/if}

	{#each groups as group (group.category)}
		<section class="grid grid-cols-1 gap-1">
			<h3 class="flex items-baseline justify-between px-1 text-sm font-medium">
				<span class="capitalize">{group.category}</span>
				<span class="text-xs font-normal text-muted-foreground tabular-nums">
					{formatWeight(group.weight, app.units)}
				</span>
			</h3>
			<ul class="grid grid-cols-1 divide-y rounded-lg border">
				{#each group.lines as line (line.id)}
					<li class="flex items-center gap-3 px-3 py-2" data-testid="gear-{line.gear_item.name}">
						<Checkbox
							checked={line.packed}
							onCheckedChange={(packed) =>
								attempt(() => updateTripGear(trip.id, line.id, { packed }))}
							aria-label="Packed {line.gear_item.name}"
						/>
						<div class="min-w-0 flex-1">
							<p
								class={cn('truncate text-sm', line.packed && 'text-muted-foreground line-through')}
							>
								{line.gear_item.name}
							</p>
							{#if line.gear_item.kind !== 'base' || line.gear_item.archived_at}
								<p class="truncate text-xs text-muted-foreground">
									{[
										line.gear_item.kind === 'worn' && 'worn, not in pack weight',
										line.gear_item.kind === 'consumable' && 'consumable',
										line.gear_item.archived_at && 'archived in closet'
									]
										.filter(Boolean)
										.join(' · ')}
								</p>
							{/if}
						</div>
						<div class="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Fewer"
								disabled={line.quantity <= 1}
								onclick={() => setQuantity(line, line.quantity - 1)}
							>
								<MinusIcon />
							</Button>
							<span class="w-5 text-center text-sm tabular-nums">{line.quantity}</span>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="More"
								onclick={() => setQuantity(line, line.quantity + 1)}
							>
								<PlusIcon />
							</Button>
						</div>
						<span class="w-16 text-right text-sm text-muted-foreground tabular-nums">
							{formatWeight(gearLineWeight(line), app.units)}
						</span>
						<ConfirmDelete
							label="Remove {line.gear_item.name}"
							title="Remove {line.gear_item.name} from this trip?"
							description="It stays in your gear closet."
							confirmLabel="Remove"
							onconfirm={() => removeTripGear(trip.id, line.id)}
						>
							<Trash2Icon />
						</ConfirmDelete>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<Dialog.Root bind:open={addOpen}>
	<Dialog.Content class="max-h-[85svh] overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>Add from gear closet</Dialog.Title>
			<Dialog.Description>
				Need something new? Add it to your <a href="/gear" class="underline">gear closet</a> first.
			</Dialog.Description>
		</Dialog.Header>
		<Input placeholder="Search" bind:value={search} />
		<ul class="-mx-2 grid max-h-[50svh] gap-0.5 overflow-y-auto">
			{#each available as item (item.id)}
				<li>
					<button
						class="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
						onclick={() =>
							attempt(
								() => addTripGear(trip.id, { gear_item_id: item.id, quantity: 1, packed: false }),
								`Added ${item.name}`
							)}
					>
						<span>
							{item.name}
							<span class="text-xs text-muted-foreground capitalize">· {item.category}</span>
						</span>
						<span class="text-muted-foreground tabular-nums"
							>{formatWeight(item.weight_g, app.units)}</span
						>
					</button>
				</li>
			{:else}
				<li class="px-2 py-4 text-center text-sm text-muted-foreground">No more items to add.</li>
			{/each}
		</ul>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={copyOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Copy gear from another trip</Dialog.Title>
			<Dialog.Description
				>Items already on this trip are kept; archived items are skipped.</Dialog.Description
			>
		</Dialog.Header>
		<Select.Root type="single" bind:value={copySource}>
			<Select.Trigger class="w-full">
				{otherTrips.find((t) => t.id === copySource)?.name ?? 'Choose a trip'}
			</Select.Trigger>
			<Select.Content>
				{#each otherTrips as t (t.id)}
					<Select.Item value={t.id} label={t.name} />
				{/each}
			</Select.Content>
		</Select.Root>
		<Dialog.Footer>
			<OnlineButton
				disabled={!copySource}
				onclick={async () => {
					if (await attempt(() => copyGearFrom(trip.id, copySource), 'Gear copied'))
						copyOpen = false;
				}}
			>
				Copy gear
			</OnlineButton>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
