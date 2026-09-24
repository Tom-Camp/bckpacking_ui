<script lang="ts">
	import type { Unit } from '$lib/api/types';
	import { Input } from '$lib/components/ui/input';
	import { fromInput, inputUnit, toInput, type Measure } from '$lib/domain/units';

	// A number input that shows the user's unit but binds the canonical value (g, m).
	let {
		value = $bindable(),
		measure,
		units,
		id,
		required = false,
		min = 0
	}: {
		value: number | null | undefined;
		measure: Measure;
		units: Unit;
		id?: string;
		required?: boolean;
		min?: number;
	} = $props();

	const unit = $derived(inputUnit(measure, units));

	// Local display value so typing isn't disturbed by rounding on the way back.
	let display = $state<number | null>(null);
	let lastValue: number | null | undefined = undefined;
	let lastUnits: Unit | undefined = undefined;

	$effect.pre(() => {
		if (value !== lastValue || units !== lastUnits) {
			display = toInput(value, measure, units);
			lastValue = value;
			lastUnits = units;
		}
	});

	function oninput() {
		const next = fromInput(display, measure, units);
		lastValue = next;
		value = next;
	}
</script>

<div class="relative">
	<Input
		{id}
		type="number"
		inputmode="decimal"
		step="any"
		{min}
		{required}
		class="pr-12"
		bind:value={display}
		{oninput}
	/>
	<span
		class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
	>
		{unit.label}
	</span>
</div>
