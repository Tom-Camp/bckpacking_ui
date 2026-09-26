<script lang="ts">
	// Test harness: provides what the (app) layout and root layout give every component.
	import type { Component } from 'svelte';
	import type { Unit, User } from '$lib/api/types';
	import { setAppContext } from '$lib/app-context';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let {
		component: Inner,
		props = {},
		user,
		units = 'imperial'
	}: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		component: Component<any>;
		props?: Record<string, unknown>;
		user?: User;
		units?: Unit;
	} = $props();

	setAppContext({
		get user() {
			return user;
		},
		get units() {
			return units;
		}
	});
</script>

<Tooltip.Provider>
	<Inner {...props} />
</Tooltip.Provider>
