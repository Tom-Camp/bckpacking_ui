<script lang="ts">
	import type { ChecklistItem, ChecklistStatus, Trip } from '$lib/api/types';
	import { Input } from '$lib/components/ui/input';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { updateChecklistItem } from '$lib/data/mutations';
	import { CHECKLIST_LABELS, sortChecklist, STATUS_LABELS } from '$lib/domain/checklist';
	import { attempt } from '$lib/errors';
	import { cn } from '$lib/utils';

	let { trip }: { trip: Trip } = $props();

	const items = $derived(sortChecklist(trip.checklist_items));
	const remaining = $derived(items.filter((i) => i.status === 'todo').length);
	const STATUSES: ChecklistStatus[] = ['todo', 'done', 'not_applicable'];

	function setStatus(item: ChecklistItem, status: string) {
		if (!status || status === item.status) return;
		void attempt(() =>
			updateChecklistItem(trip.id, item.item, { status: status as ChecklistStatus })
		);
	}

	function saveDetails(item: ChecklistItem, value: string) {
		const details = value.trim() || null;
		if (details === item.details) return;
		void attempt(() => updateChecklistItem(trip.id, item.item, { details }));
	}
</script>

<div class="grid grid-cols-1 gap-4">
	<p class="text-sm text-muted-foreground">
		{#if remaining === 0}
			Everything is done or not applicable. You’re ready to go.
		{:else}
			{remaining} of {items.length} still to do. Changes save on this device and sync when you’re online.
		{/if}
	</p>

	<ul class="grid grid-cols-1 divide-y rounded-lg border">
		{#each items as item (item.id)}
			{@const meta = CHECKLIST_LABELS[item.item]}
			<li
				class="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
				data-testid="checklist-{item.item}"
			>
				<div>
					<p class={cn('font-medium', item.status !== 'todo' && 'text-muted-foreground')}>
						{meta.label}
					</p>
					<p class="text-xs text-muted-foreground">{meta.hint}</p>
				</div>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					value={item.status}
					onValueChange={(v) => setStatus(item, v)}
					aria-label="{meta.label} status"
				>
					{#each STATUSES as s (s)}
						<ToggleGroup.Item value={s} class="px-3 text-xs">{STATUS_LABELS[s]}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
				<Input
					class="h-8 text-sm sm:col-span-2"
					placeholder="Add details"
					value={item.details ?? ''}
					onchange={(e) => saveDetails(item, e.currentTarget.value)}
				/>
			</li>
		{/each}
	</ul>
</div>
