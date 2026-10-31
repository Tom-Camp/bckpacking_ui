<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PackagePlusIcon from '@lucide/svelte/icons/package-plus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import type { GearItem, Trip, TripGear } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import GearItemDialog from '$lib/components/GearItemDialog.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Progress } from '$lib/components/ui/progress';
	import * as Select from '$lib/components/ui/select';
	import { live } from '$lib/data/live.svelte';
	import { addTripGear, copyGearFrom, removeTripGear, updateTripGear } from '$lib/data/mutations';
	import { allTrips, gearCategories, gearCloset } from '$lib/data/queries';
	import { categoryOption, groupByCategory } from '$lib/domain/gear';
	import { formatWeight } from '$lib/domain/units';
	import { gearLineWeight } from '$lib/domain/weights';
	import { attempt, errorMessage } from '$lib/errors';
	import { cn } from '$lib/utils';
	import WeightSummary from './WeightSummary.svelte';

	let { trip }: { trip: Trip } = $props();

	const app = getAppContext();
	const closet = live(gearCloset);
	const trips = live(allTrips);
	const categories = live(gearCategories);

	const groups = $derived.by(() => {
		return groupByCategory(trip.gear_list, (l) => l.gear_item, categories.current ?? []).map(
			({ category, entries: lines }) => ({
				category,
				lines: lines.sort((a, b) => a.gear_item.name.localeCompare(b.gear_item.name)),
				weight: lines.reduce((s, l) => s + (l.gear_item.kind === 'worn' ? 0 : gearLineWeight(l)), 0)
			})
		);
	});
	const packed = $derived(trip.gear_list.filter((l) => l.packed).length);

	// Add-from-closet dialog
	let addOpen = $state(false);
	let search = $state('');
	const categoryLabel = (i: GearItem) => categoryOption(i, categories.current ?? []).label;
	const onTrip = $derived(new Set(trip.gear_list.map((l) => l.gear_item.id)));
	const query = $derived(search.trim());
	const available = $derived(
		(closet.current ?? []).filter(
			(i) =>
				!i.archived_at &&
				!onTrip.has(i.id) &&
				`${i.name} ${categoryLabel(i)}`.toLowerCase().includes(query.toLowerCase())
		)
	);
	// Closet items named exactly what was searched, including ones the list hides. Offering to
	// create one of those would make a duplicate, so say where it is instead.
	const exact = $derived(
		query
			? (closet.current ?? []).filter((i) => i.name.trim().toLowerCase() === query.toLowerCase())
			: []
	);
	const hiddenMatch = $derived.by(() => {
		if (!exact.length || exact.some((i) => available.includes(i))) return undefined;
		const item = exact.find((i) => onTrip.has(i.id));
		return item
			? { item, reason: 'on-trip' as const }
			: { item: exact[0], reason: 'archived' as const };
	});

	function setAddOpen(open: boolean) {
		addOpen = open;
		if (!open) search = '';
	}

	// New-gear dialog: creates the closet item, then adds it to this trip
	let newOpen = $state(false);
	let newName = $state('');

	function openNew(name = '') {
		newName = name;
		setAddOpen(false);
		newOpen = true;
	}

	async function addNewToTrip(item: GearItem) {
		try {
			await addTripGear(trip.id, { gear_item_id: item.id, quantity: 1, packed: false });
			toast.success(`Added ${item.name}`);
		} catch (e) {
			// The closet item exists, so it can still be added from the closet later.
			toast.error(
				`${item.name} is in your closet but wasn’t added to this trip. ${errorMessage(e)}`
			);
		}
	}

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
			size="icon-sm"
			aria-label="Copy from trip"
			title="Copy from trip"
			onclick={() => (copyOpen = true)}
			disabled={!otherTrips.length}
		>
			<CopyIcon />
		</OnlineButton>
		<OnlineButton variant="outline" size="sm" onclick={() => openNew()}>
			<PackagePlusIcon /> New gear
		</OnlineButton>
		<OnlineButton size="sm" onclick={() => (addOpen = true)}>
			<PlusIcon /> Add from closet
		</OnlineButton>
	</div>

	{#if !trip.gear_list.length}
		<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
			No gear yet. Add items from your <a href="/gear" class="underline">gear closet</a>, create new
			gear, or copy the list from another trip.
		</p>
	{/if}

	{#each groups as group (group.category.value)}
		<section class="grid grid-cols-1 gap-1">
			<h3 class="flex items-baseline justify-between px-1 text-sm font-medium">
				<span>{group.category.label}</span>
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

<Dialog.Root bind:open={() => addOpen, setAddOpen}>
	<Dialog.Content class="max-h-[85svh] overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>Add from gear closet</Dialog.Title>
			<Dialog.Description>
				Not there? Search for it and create it, and it’s added to your closet too.
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
							<span class="text-xs text-muted-foreground">· {categoryLabel(item)}</span>
						</span>
						<span class="text-muted-foreground tabular-nums"
							>{formatWeight(item.weight_g, app.units)}</span
						>
					</button>
				</li>
			{/each}
			{#if hiddenMatch?.reason === 'on-trip'}
				<li class="px-2 py-4 text-center text-sm text-muted-foreground">
					{hiddenMatch.item.name} is already on this trip.
				</li>
			{:else if hiddenMatch}
				<li class="px-2 py-4 text-center text-sm text-muted-foreground">
					{hiddenMatch.item.name} is archived. Restore it in your
					<a href="/gear" class="underline">gear closet</a> to add it.
				</li>
			{:else if query && !exact.length}
				<li>
					<button
						class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
						onclick={() => openNew(query)}
					>
						<PackagePlusIcon class="size-4" /> Create “{query}”
					</button>
				</li>
			{:else if !available.length}
				<li class="px-2 py-4 text-center text-sm text-muted-foreground">No more items to add.</li>
			{/if}
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

<GearItemDialog bind:open={newOpen} name={newName} oncreated={addNewToTrip} />
