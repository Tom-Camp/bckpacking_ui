<script lang="ts">
	import { TRIP_TYPES, type Trip, type TripCreate, type TripType } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import FormError from '$lib/components/FormError.svelte';
	import UnitInput from '$lib/components/UnitInput.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { TRIP_TYPE_LABELS } from '$lib/domain/checklist';
	import { errorMessage } from '$lib/errors';

	let {
		trip,
		submitLabel,
		onsubmit,
		oncancel
	}: {
		trip?: Trip;
		submitLabel: string;
		onsubmit: (body: TripCreate) => Promise<void>;
		oncancel?: () => void;
	} = $props();

	const app = getAppContext();

	// Seeded once from `trip`; the form owns its state after that.
	const initial = (() => trip)();
	let form = $state({
		name: initial?.name ?? '',
		description: initial?.description ?? '',
		area: initial?.area ?? '',
		trip_type: (initial?.trip_type ?? 'loop') as TripType,
		start_date: initial?.start_date ?? '',
		end_date: initial?.end_date ?? '',
		start_trailhead: initial?.start_trailhead ?? '',
		end_trailhead: initial?.end_trailhead ?? '',
		total_distance_m: initial?.total_distance_m ?? null,
		elevation_gain_m: initial?.elevation_gain_m ?? null,
		water_carry_l: initial?.water_carry_l ?? 0,
		map_link: initial?.map_link ?? '',
		emergency_contact: initial?.emergency_contact ?? ''
	});
	let error = $state<string | null>(null);
	let busy = $state(false);

	const blank = (s: string) => (s.trim() === '' ? null : s.trim());

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (form.start_date && form.end_date && form.end_date < form.start_date) {
			error = 'End date must be on or after the start date.';
			return;
		}
		busy = true;
		error = null;
		try {
			await onsubmit({
				name: form.name.trim(),
				description: blank(form.description),
				area: blank(form.area),
				trip_type: form.trip_type,
				start_date: form.start_date || null,
				end_date: form.end_date || null,
				start_trailhead: blank(form.start_trailhead),
				end_trailhead: form.trip_type === 'point-to-point' ? blank(form.end_trailhead) : null,
				total_distance_m: form.total_distance_m,
				elevation_gain_m: form.elevation_gain_m,
				water_carry_l: form.water_carry_l ?? 0,
				map_link: blank(form.map_link),
				emergency_contact: blank(form.emergency_contact)
			});
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<form class="grid grid-cols-1 gap-5" onsubmit={submit}>
	<FormError message={error} />

	<div class="grid grid-cols-1 gap-2">
		<Label for="name">Trip name</Label>
		<Input id="name" required placeholder="Art Loeb Trail" bind:value={form.name} />
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="grid grid-cols-1 gap-2">
			<Label for="area">Area</Label>
			<Input id="area" placeholder="Pisgah National Forest" bind:value={form.area} />
		</div>
		<div class="grid grid-cols-1 gap-2">
			<Label for="type">Trip type</Label>
			<Select.Root type="single" bind:value={form.trip_type}>
				<Select.Trigger id="type" class="w-full">{TRIP_TYPE_LABELS[form.trip_type]}</Select.Trigger>
				<Select.Content>
					{#each TRIP_TYPES as t (t)}
						<Select.Item value={t} label={TRIP_TYPE_LABELS[t]} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid grid-cols-1 gap-2">
			<Label for="start">Start date</Label>
			<Input id="start" type="date" bind:value={form.start_date} />
		</div>
		<div class="grid grid-cols-1 gap-2">
			<Label for="end">End date</Label>
			<Input id="end" type="date" min={form.start_date || undefined} bind:value={form.end_date} />
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="grid grid-cols-1 gap-2">
			<Label for="start-th"
				>{form.trip_type === 'point-to-point' ? 'Start trailhead' : 'Trailhead'}</Label
			>
			<Input id="start-th" bind:value={form.start_trailhead} />
		</div>
		{#if form.trip_type === 'point-to-point'}
			<div class="grid grid-cols-1 gap-2">
				<Label for="end-th">End trailhead</Label>
				<Input id="end-th" bind:value={form.end_trailhead} />
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-3 gap-4">
		<div class="grid grid-cols-1 gap-2">
			<Label for="distance">Distance</Label>
			<UnitInput
				id="distance"
				measure="distance"
				units={app.units}
				bind:value={form.total_distance_m}
			/>
		</div>
		<div class="grid grid-cols-1 gap-2">
			<Label for="elevation">Elevation gain</Label>
			<UnitInput
				id="elevation"
				measure="elevation"
				units={app.units}
				bind:value={form.elevation_gain_m}
			/>
		</div>
		<div class="grid grid-cols-1 gap-2">
			<Label for="water">Water carry</Label>
			<div class="relative">
				<Input
					id="water"
					type="number"
					inputmode="decimal"
					step="0.1"
					min="0"
					class="pr-8"
					bind:value={form.water_carry_l}
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
					>L</span
				>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-2">
		<Label for="emergency">Emergency contact</Label>
		<Input
			id="emergency"
			placeholder="Name, phone, when to call for help"
			bind:value={form.emergency_contact}
		/>
	</div>

	<div class="grid grid-cols-1 gap-2">
		<Label for="map">Map link</Label>
		<Input id="map" type="url" placeholder="https://" bind:value={form.map_link} />
	</div>

	<div class="grid grid-cols-1 gap-2">
		<Label for="description">Description</Label>
		<Textarea id="description" rows={3} bind:value={form.description} />
	</div>

	<div class="flex gap-2">
		<Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
		{#if oncancel}
			<Button variant="ghost" onclick={oncancel}>Cancel</Button>
		{/if}
	</div>
</form>
