<script lang="ts">
	import { GEAR_KINDS, type GearItem, type GearKind } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import FormError from '$lib/components/FormError.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import UnitInput from '$lib/components/UnitInput.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { live } from '$lib/data/live.svelte';
	import { createGearItem, updateGearItem } from '$lib/data/mutations';
	import { gearCategories } from '$lib/data/queries';
	import { isGearCategory } from '$lib/domain/gear';
	import { errorMessage } from '$lib/errors';

	let {
		open = $bindable(false),
		item,
		name = '',
		oncreated
	}: {
		open: boolean;
		/** Editing (works offline) vs creating (needs a connection). */
		item?: GearItem;
		/** Prefills the name when creating. */
		name?: string;
		/** Runs after a new item is saved to the closet and the dialog closes. */
		oncreated?: (item: GearItem) => void;
	} = $props();

	const app = getAppContext();

	const KIND_LABELS: Record<GearKind, string> = {
		base: 'Base (carried)',
		worn: 'Worn (not in pack weight)',
		consumable: 'Consumable (fuel, sunscreen…)'
	};
	const categories = live(gearCategories);
	const categoryOptions = $derived(categories.current ?? []);
	const selectedCategory = $derived(categoryOptions.find((c) => c.value === form.category));

	let form = $state({
		name: '',
		category: '',
		weight_g: null as number | null,
		kind: 'base' as GearKind,
		notes: ''
	});
	let error = $state<string | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (!open) return;
		form = {
			name: item?.name ?? name,
			category: item?.category ?? '',
			weight_g: item?.weight_g ?? null,
			kind: item?.kind ?? 'base',
			notes: item?.notes ?? ''
		};
		error = null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		// Also catches items saved before categories became an enum (e.g. "kitchen").
		const category = form.category;
		if (!isGearCategory(category, categoryOptions)) {
			error = 'Choose a category.';
			return;
		}
		busy = true;
		error = null;
		const body = {
			name: form.name.trim(),
			category,
			weight_g: form.weight_g ?? 0,
			kind: form.kind,
			notes: form.notes.trim() || null
		};
		try {
			if (item) {
				await updateGearItem(item.id, body);
				open = false;
			} else {
				const created = await createGearItem(body);
				open = false;
				oncreated?.(created);
			}
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{item ? 'Edit gear' : 'New gear'}</Dialog.Title>
			{#if item}
				<Dialog.Description>Changes apply to every trip that uses this item.</Dialog.Description>
			{/if}
		</Dialog.Header>
		<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
			<FormError message={error} />
			<div class="grid grid-cols-1 gap-2">
				<Label for="gear-name">Name</Label>
				<Input id="gear-name" required bind:value={form.name} />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid grid-cols-1 gap-2">
					<Label for="gear-category">Category</Label>
					<Select.Root type="single" bind:value={form.category}>
						<Select.Trigger id="gear-category" class="w-full" disabled={!categoryOptions.length}>
							{selectedCategory?.label ??
								(categoryOptions.length ? 'Choose…' : 'Categories load on next sync')}
						</Select.Trigger>
						<Select.Content>
							{#each categoryOptions as c (c.value)}
								<Select.Item value={c.value} label={c.label} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="gear-weight">Weight (each)</Label>
					<UnitInput
						id="gear-weight"
						measure="gear-weight"
						units={app.units}
						required
						bind:value={form.weight_g}
					/>
				</div>
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label>Kind</Label>
				<Select.Root type="single" bind:value={form.kind}>
					<Select.Trigger class="w-full">{KIND_LABELS[form.kind]}</Select.Trigger>
					<Select.Content>
						{#each GEAR_KINDS as k (k)}
							<Select.Item value={k} label={KIND_LABELS[k]} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label for="gear-notes">Notes</Label>
				<Textarea id="gear-notes" rows={2} bind:value={form.notes} />
			</div>
			<Dialog.Footer>
				{#if item}
					<Button type="submit" disabled={busy}>Save</Button>
				{:else}
					<OnlineButton type="submit" disabled={busy}>
						{oncreated ? 'Add to closet & trip' : 'Add to closet'}
					</OnlineButton>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
