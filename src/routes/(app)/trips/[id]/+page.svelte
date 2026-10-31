<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import Checklist from '$lib/components/trip/Checklist.svelte';
	import FoodPlan from '$lib/components/trip/FoodPlan.svelte';
	import GearList from '$lib/components/trip/GearList.svelte';
	import Overview from '$lib/components/trip/Overview.svelte';
	import ShareDialog from '$lib/components/trip/ShareDialog.svelte';
	import TripForm from '$lib/components/trip/TripForm.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';
	import { live } from '$lib/data/live.svelte';
	import { deleteTrip, updateTrip } from '$lib/data/mutations';
	import { tripById } from '$lib/data/queries';

	const trip = live(
		(id) => tripById(id),
		() => page.params.id ?? ''
	);

	const TABS = ['overview', 'checklist', 'gear', 'food'] as const;
	type Tab = (typeof TABS)[number];
	const initialTab = page.url.searchParams.get('tab') as Tab | null;
	let tab = $state<Tab>(initialTab && TABS.includes(initialTab) ? initialTab : 'overview');

	function selectTab(value: string) {
		tab = value as Tab;
		const url = new URL(page.url);
		url.searchParams.set('tab', value);
		replaceState(url, {});
	}

	let editOpen = $state(false);
	let shareOpen = $state(false);
	const todo = $derived(
		trip.current?.checklist_items.filter((i) => i.status === 'todo').length ?? 0
	);
</script>

<svelte:head><title>{trip.current?.name ?? 'Trip'} · bckpack.ing</title></svelte:head>

{#if trip.loading && !trip.current}
	<div class="grid grid-cols-1 gap-4"><Skeleton class="h-10 w-2/3" /><Skeleton class="h-64" /></div>
{:else if !trip.current}
	<div class="grid grid-cols-1 gap-3">
		<h1 class="text-xl font-semibold">Trip not found</h1>
		<p class="text-sm text-muted-foreground">
			It may have been deleted, or hasn’t synced to this device yet.
		</p>
		<div><Button variant="outline" href="/">Back to trips</Button></div>
	</div>
{:else}
	{@const t = trip.current}
	<div class="grid grid-cols-1 gap-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start">
			<div class="flex min-w-0 flex-1 items-start gap-2">
				<Button variant="ghost" size="icon-sm" href="/" aria-label="All trips"
					><ArrowLeftIcon /></Button
				>
				<div class="min-w-0">
					<h1 class="text-2xl font-semibold tracking-tight">{t.name}</h1>
					{#if t.area}<p class="text-sm text-muted-foreground">{t.area}</p>{/if}
				</div>
			</div>
			<div class="flex gap-2 pl-10 sm:pl-0">
				<Button variant="outline" size="sm" href="/trips/{t.id}/print">
					<PrinterIcon /> Print
				</Button>
				<Button variant="outline" size="sm" onclick={() => (shareOpen = true)}>
					<Share2Icon /> Share
				</Button>
				<Button variant="outline" size="sm" onclick={() => (editOpen = true)}>
					<PencilIcon /> Edit
				</Button>
				<ConfirmDelete
					size="sm"
					variant="outline"
					label="Delete trip"
					title="Delete {t.name}?"
					description="This deletes the trip with its checklist, gear list, food plan and notes. Gear closet items are kept."
					onconfirm={async () => {
						await deleteTrip(t.id);
						await goto('/', { replaceState: true });
					}}
				>
					<Trash2Icon />
				</ConfirmDelete>
			</div>
		</div>

		<Tabs.Root value={tab} onValueChange={selectTab}>
			<Tabs.List class="w-full sm:w-fit">
				<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
				<Tabs.Trigger value="checklist">
					Checklist
					{#if todo}<Badge variant="secondary" class="ml-1">{todo}</Badge>{/if}
				</Tabs.Trigger>
				<Tabs.Trigger value="gear">Gear</Tabs.Trigger>
				<Tabs.Trigger value="food">Food</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="overview" class="pt-4"><Overview trip={t} /></Tabs.Content>
			<Tabs.Content value="checklist" class="pt-4"><Checklist trip={t} /></Tabs.Content>
			<Tabs.Content value="gear" class="pt-4"><GearList trip={t} /></Tabs.Content>
			<Tabs.Content value="food" class="pt-4"><FoodPlan trip={t} /></Tabs.Content>
		</Tabs.Root>
	</div>

	<ShareDialog bind:open={shareOpen} trip={t} />

	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content class="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
			<Dialog.Header>
				<Dialog.Title>Edit trip</Dialog.Title>
				<Dialog.Description
					>Changes save on this device and sync when you’re online.</Dialog.Description
				>
			</Dialog.Header>
			{#key editOpen}
				<TripForm
					trip={t}
					submitLabel="Save"
					onsubmit={async (body) => {
						await updateTrip(t.id, body);
						editOpen = false;
					}}
					oncancel={() => (editOpen = false)}
				/>
			{/key}
		</Dialog.Content>
	</Dialog.Root>
{/if}
