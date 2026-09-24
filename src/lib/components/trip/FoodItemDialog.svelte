<script lang="ts">
	import { MEALS, type Meal, type Trip, type TripFood } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import FormError from '$lib/components/FormError.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import UnitInput from '$lib/components/UnitInput.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { addFood, updateFood } from '$lib/data/mutations';
	import { dayLabel, MEAL_LABELS } from '$lib/domain/food';
	import { errorMessage } from '$lib/errors';

	let {
		open = $bindable(false),
		trip,
		days,
		item,
		day = 1,
		meal = 'breakfast'
	}: {
		open: boolean;
		trip: Trip;
		days: number;
		/** Editing an existing item (works offline) vs adding a new one (needs a connection). */
		item?: TripFood;
		day?: number;
		meal?: Meal;
	} = $props();

	const app = getAppContext();

	let form = $state({
		day: '1',
		meal_type: 'breakfast' as Meal,
		name: '',
		servings: 1,
		weight_g: 0 as number | null,
		kcal: 0
	});
	let error = $state<string | null>(null);
	let busy = $state(false);

	// Reset the form each time the dialog opens.
	$effect(() => {
		if (!open) return;
		form = {
			day: String(item?.day ?? day),
			meal_type: item?.meal_type ?? meal,
			name: item?.name ?? '',
			servings: item?.servings ?? 1,
			weight_g: item?.weight_g ?? null,
			kcal: item?.kcal ?? 0
		};
		error = null;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		const body = {
			day: Number(form.day),
			meal_type: form.meal_type,
			name: form.name.trim(),
			servings: form.servings,
			weight_g: form.weight_g ?? 0,
			kcal: form.kcal
		};
		try {
			if (item) await updateFood(trip.id, item.id, body);
			else await addFood(trip.id, body);
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
			<Dialog.Title>{item ? 'Edit food' : 'Add food'}</Dialog.Title>
			<Dialog.Description>Weight and calories are per serving.</Dialog.Description>
		</Dialog.Header>
		<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
			<FormError message={error} />
			<div class="grid grid-cols-1 gap-2">
				<Label for="food-name">Name</Label>
				<Input id="food-name" required placeholder="Oatmeal packet" bind:value={form.name} />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid grid-cols-1 gap-2">
					<Label>Day</Label>
					<Select.Root type="single" bind:value={form.day}>
						<Select.Trigger class="w-full"
							>{dayLabel(Number(form.day), trip.start_date)}</Select.Trigger
						>
						<Select.Content>
							{#each Array.from({ length: days }, (_, i) => i + 1) as d (d)}
								<Select.Item value={String(d)} label={dayLabel(d, trip.start_date)} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label>Meal</Label>
					<Select.Root type="single" bind:value={form.meal_type}>
						<Select.Trigger class="w-full">{MEAL_LABELS[form.meal_type]}</Select.Trigger>
						<Select.Content>
							{#each MEALS as m (m)}
								<Select.Item value={m} label={MEAL_LABELS[m]} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			<div class="grid grid-cols-3 gap-3">
				<div class="grid grid-cols-1 gap-2">
					<Label for="servings">Servings</Label>
					<Input
						id="servings"
						type="number"
						inputmode="decimal"
						step="any"
						min="0.01"
						required
						bind:value={form.servings}
					/>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="food-weight">Weight</Label>
					<UnitInput
						id="food-weight"
						measure="food-weight"
						units={app.units}
						required
						bind:value={form.weight_g}
					/>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="kcal">Calories</Label>
					<Input
						id="kcal"
						type="number"
						inputmode="numeric"
						min="0"
						step="any"
						required
						bind:value={form.kcal}
					/>
				</div>
			</div>
			<Dialog.Footer>
				{#if item}
					<Button type="submit" disabled={busy}>Save</Button>
				{:else}
					<OnlineButton type="submit" disabled={busy}>Add</OnlineButton>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
