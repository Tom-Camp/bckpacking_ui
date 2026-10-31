<script lang="ts">
	// Test harness: renders `child` inside `layout`, so the child sees the layout's context.
	import type { Component } from 'svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { layout: Layout, child: Child }: { layout: Component<any>; child: Component<any> } =
		$props();
</script>

<Layout><Child /></Layout>
