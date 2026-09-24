<script lang="ts">
	import { goto } from '$app/navigation';
	import TripForm from '$lib/components/trip/TripForm.svelte';
	import { createTrip } from '$lib/data/mutations';
</script>

<svelte:head><title>New trip · bckpack.ing</title></svelte:head>

<div class="mx-auto grid max-w-2xl gap-6">
	<h1 class="text-2xl font-semibold tracking-tight">New trip</h1>
	<TripForm
		submitLabel="Create trip"
		onsubmit={async (body) => {
			const trip = await createTrip(body);
			await goto(`/trips/${trip.id}`, { replaceState: true });
		}}
		oncancel={() => history.back()}
	/>
</div>
