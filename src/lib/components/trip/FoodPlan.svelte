<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { Meal, Trip, TripFood } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import UnitInput from '$lib/components/UnitInput.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { deleteFood, updateFoodPlan } from '$lib/data/mutations';
	import { dayLabel, MEAL_LABELS, planByDay } from '$lib/domain/food';
	import { formatWeight } from '$lib/domain/units';
	import { attempt } from '$lib/errors';
	import { cn } from '$lib/utils';
	import FoodItemDialog from './FoodItemDialog.svelte';

	let { trip }: { trip: Trip } = $props();

	const app = getAppContext();
	const plan = $derived(trip.food_plan);
	const days = $derived(planByDay(trip, plan));

	let dialogOpen = $state(false);
	let editing = $state<TripFood | undefined>();
	let newDay = $state(1);
	let newMeal = $state<Meal>('breakfast');

	function add(day: number, meal: Meal) {
		editing = undefined;
		newDay = day;
		newMeal = meal;
		dialogOpen = true;
	}

	function edit(item: TripFood) {
		editing = item;
		dialogOpen = true;
	}

	// Target inputs save when changed (offline-capable).
	let targetFoodG = $state<number | null>(null);
	let storedFoodG: number | null | undefined;
	$effect.pre(() => {
		const stored = plan?.target_food_g_per_day ?? null;
		if (stored !== storedFoodG) {
			storedFoodG = stored;
			targetFoodG = stored;
		}
	});

	function pct(value: number, target: number) {
		return target > 0 ? Math.round((value / target) * 100) : 0;
	}
</script>

{#if !plan}
	<p class="text-sm text-muted-foreground">This trip has no food plan.</p>
{:else}
	<div class="grid grid-cols-1 gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Daily targets</Card.Title>
			</Card.Header>
			<Card.Content class="grid grid-cols-2 gap-4">
				<div class="grid grid-cols-1 gap-2">
					<Label for="target-kcal">Calories per day</Label>
					<Input
						id="target-kcal"
						type="number"
						inputmode="numeric"
						min="0"
						value={plan.target_kcal_per_day}
						onchange={(e) => {
							const v = Number(e.currentTarget.value);
							if (v >= 0) void attempt(() => updateFoodPlan(trip.id, { target_kcal_per_day: v }));
						}}
					/>
				</div>
				<div
					class="grid grid-cols-1 gap-2"
					onfocusout={() => {
						if (targetFoodG !== null && targetFoodG !== plan.target_food_g_per_day)
							void attempt(() => updateFoodPlan(trip.id, { target_food_g_per_day: targetFoodG! }));
					}}
				>
					<Label for="target-weight">Food weight per day</Label>
					<UnitInput
						id="target-weight"
						measure="food-weight"
						units={app.units}
						bind:value={targetFoodG}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		{#each days as d (d.day)}
			{@const kcalPct = pct(d.kcal, plan.target_kcal_per_day)}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">{dayLabel(d.day, trip.start_date)}</Card.Title>
					<Card.Description class="tabular-nums">
						<span class={cn(kcalPct < 90 && d.kcal > 0 && 'text-amber-600')}>
							{Math.round(d.kcal).toLocaleString()} / {plan.target_kcal_per_day.toLocaleString()} kcal
						</span>
						· {formatWeight(d.weight_g, app.units)} / {formatWeight(
							plan.target_food_g_per_day,
							app.units
						)}
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid grid-cols-1 gap-3">
					{#each d.meals as m (m.meal)}
						<div class="grid grid-cols-1 gap-1">
							<div class="flex items-center justify-between">
								<h4 class="text-sm font-medium">{MEAL_LABELS[m.meal]}</h4>
								<OnlineButton
									variant="ghost"
									size="icon-xs"
									aria-label="Add {MEAL_LABELS[m.meal]}"
									onclick={() => add(d.day, m.meal)}
								>
									<PlusIcon />
								</OnlineButton>
							</div>
							{#if m.items.length}
								<ul class="grid grid-cols-1 divide-y rounded-md border text-sm">
									{#each m.items as f (f.id)}
										<li class="flex items-center gap-2 px-2 py-1.5">
											<button
												class="min-w-0 flex-1 truncate text-left hover:underline"
												onclick={() => edit(f)}
											>
												{f.name}
												{#if f.servings !== 1}<span class="text-muted-foreground"
														>× {f.servings}</span
													>{/if}
											</button>
											<span class="text-muted-foreground tabular-nums">
												{Math.round(f.kcal * f.servings)} kcal · {formatWeight(
													f.weight_g * f.servings,
													app.units
												)}
											</span>
											<ConfirmDelete
												size="icon-xs"
												label="Delete {f.name}"
												title="Delete {f.name}?"
												onconfirm={() => deleteFood(trip.id, f.id)}
											>
												<Trash2Icon />
											</ConfirmDelete>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<FoodItemDialog
		bind:open={dialogOpen}
		{trip}
		days={days.length}
		item={editing}
		day={newDay}
		meal={newMeal}
	/>
{/if}
