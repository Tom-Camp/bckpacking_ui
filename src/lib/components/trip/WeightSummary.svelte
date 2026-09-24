<script lang="ts">
	import type { Trip } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import * as Card from '$lib/components/ui/card';
	import { formatWeight } from '$lib/domain/units';
	import { summarizeWeights } from '$lib/domain/weights';

	let { trip }: { trip: Trip } = $props();

	const app = getAppContext();
	const w = $derived(summarizeWeights(trip, app.user?.body_weight_g));

	const rows = $derived([
		{ label: 'Base weight', value: w.base_g, hint: 'Gear you carry, excluding consumables' },
		{ label: 'Consumables', value: w.consumable_g },
		{ label: 'Food', value: w.food_g },
		{ label: 'Water', value: w.water_g }
	]);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-base">Pack weight</Card.Title>
		<Card.Description>
			<span class="text-2xl font-semibold text-foreground">{formatWeight(w.pack_g, app.units)}</span
			>
			{#if w.body_pct !== null}
				<span class="ml-2">{w.body_pct.toFixed(1)}% of body weight</span>
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
			{#each rows as row (row.label)}
				<div>
					<dt class="text-muted-foreground" title={row.hint}>{row.label}</dt>
					<dd class="font-medium tabular-nums">{formatWeight(row.value, app.units)}</dd>
				</div>
			{/each}
		</dl>
		<p class="mt-3 text-xs text-muted-foreground">
			Worn {formatWeight(w.worn_g, app.units)} · Skin-out {formatWeight(w.skin_out_g, app.units)}
		</p>
	</Card.Content>
</Card.Root>
