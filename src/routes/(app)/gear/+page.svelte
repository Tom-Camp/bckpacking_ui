<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { GearItem } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import GearItemDialog from '$lib/components/GearItemDialog.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { live } from '$lib/data/live.svelte';
	import { archiveGearItem, restoreGearItem } from '$lib/data/mutations';
	import { gearCategories, gearCloset } from '$lib/data/queries';
	import { categoryOption, groupByCategory } from '$lib/domain/gear';
	import { formatWeight } from '$lib/domain/units';
	import { attempt } from '$lib/errors';
	import { cn } from '$lib/utils';

	const app = getAppContext();
	const closet = live(gearCloset);
	const categories = live(gearCategories);

	let showArchived = $state(false);
	let search = $state('');
	let dialogOpen = $state(false);
	let editing = $state<GearItem | undefined>();

	const groups = $derived.by(() => {
		const q = search.toLowerCase();
		const label = (i: GearItem) => categoryOption(i, categories.current ?? []).label;
		const items = (closet.current ?? []).filter(
			(i) =>
				(showArchived || !i.archived_at) &&
				`${i.name} ${label(i)} ${i.notes ?? ''}`.toLowerCase().includes(q)
		);
		return groupByCategory(items, (i) => i, categories.current ?? []);
	});

	function open(item?: GearItem) {
		editing = item;
		dialogOpen = true;
	}
</script>

<svelte:head><title>Gear closet · bckpack.ing</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Gear closet</h1>
			<p class="text-sm text-muted-foreground">Everything you own, reused across trips.</p>
		</div>
		<OnlineButton onclick={() => open()}><PlusIcon /> New gear</OnlineButton>
	</div>

	<div class="flex flex-wrap items-center gap-4">
		<Input class="max-w-xs" placeholder="Search gear" bind:value={search} />
		<div class="flex items-center gap-2">
			<Checkbox id="archived" bind:checked={showArchived} />
			<Label for="archived">Show archived</Label>
		</div>
	</div>

	{#if closet.current && !closet.current.length}
		<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
			Your closet is empty. Add your tent, sleeping bag, stove… then pick items for each trip.
		</p>
	{/if}

	{#each groups as { category, entries } (category.value)}
		<section class="grid grid-cols-1 gap-1">
			<h2 class="px-1 text-sm font-medium">{category.label}</h2>
			<ul class="grid grid-cols-1 divide-y rounded-lg border">
				{#each entries as item (item.id)}
					<li class="flex items-center gap-3 px-3 py-2">
						<button class="min-w-0 flex-1 text-left" onclick={() => open(item)}>
							<p
								class={cn(
									'truncate text-sm hover:underline',
									item.archived_at && 'text-muted-foreground'
								)}
							>
								{item.name}
								{#if item.kind !== 'base'}<Badge variant="outline" class="ml-1">{item.kind}</Badge
									>{/if}
								{#if item.archived_at}<Badge variant="secondary" class="ml-1">archived</Badge>{/if}
							</p>
							{#if item.notes}<p class="truncate text-xs text-muted-foreground">
									{item.notes}
								</p>{/if}
						</button>
						<span class="text-sm text-muted-foreground tabular-nums"
							>{formatWeight(item.weight_g, app.units)}</span
						>
						{#if item.archived_at}
							<OnlineButton
								variant="ghost"
								size="icon-sm"
								aria-label="Restore {item.name}"
								onclick={() => attempt(() => restoreGearItem(item.id), `Restored ${item.name}`)}
							>
								<ArchiveRestoreIcon />
							</OnlineButton>
						{:else}
							<OnlineButton
								variant="ghost"
								size="icon-sm"
								aria-label="Archive {item.name}"
								onclick={() => attempt(() => archiveGearItem(item.id), `Archived ${item.name}`)}
							>
								<ArchiveIcon />
							</OnlineButton>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<GearItemDialog bind:open={dialogOpen} item={editing} />
