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
	import { createGearItem, updateGearItem } from '$lib/data/mutations';
	import { errorMessage } from '$lib/errors';

	let {
		open = $bindable(false),
		item,
		categories
	}: {
		open: boolean;
		/** Editing (works offline) vs creating (needs a connection). */
		item?: GearItem;
		categories: string[];
	} = $props();

	const app = getAppContext();

	const KIND_LABELS: Record<GearKind, string> = {
		base: 'Base (carried)',
		worn: 'Worn (not in pack weight)',
		consumable: 'Consumable (fuel, sunscreen…)'
	};
	const SUGGESTED = [
		'shelter',
		'sleep',
		'kitchen',
		'water',
		'clothing',
		'navigation',
		'first aid',
		'repair',
		'hygiene',
		'electronics'
	];
	const categoryOptions = $derived([...new Set([...categories, ...SUGGESTED])].sort());

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
			name: item?.name ?? '',
			category: item?.category ?? '',
			weight_g: item?.weight_g ?? null,
			kind: item?.kind ?? 'base',
			notes: item?.notes ?? ''
		};
		error = null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		const body = {
			name: form.name.trim(),
			category: form.category.trim().toLowerCase(),
			weight_g: form.weight_g ?? 0,
			kind: form.kind,
			notes: form.notes.trim() || null
		};
		try {
			if (item) await updateGearItem(item.id, body);
			else await createGearItem(body);
			open = false;
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
					<Input id="gear-category" required list="gear-categories" bind:value={form.category} />
					<datalist id="gear-categories">
						{#each categoryOptions as c (c)}<option value={c}></option>{/each}
					</datalist>
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
					<OnlineButton type="submit" disabled={busy}>Add to closet</OnlineButton>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
