<script lang="ts">
	import MountainIcon from '@lucide/svelte/icons/mountain';

	let { children } = $props();
</script>

<main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
	<a href="/" class="flex items-center gap-2 text-lg font-semibold">
		<MountainIcon class="size-6" />
		bckpack.ing
	</a>
	<div class="w-full max-w-sm">
		{@render children()}
	</div>
</main>
