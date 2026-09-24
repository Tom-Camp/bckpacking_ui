<script lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { syncStatus } from '$lib/sync/status.svelte';

	// A button for actions the API must perform live (creating or deleting records).
	// Disabled with an explanation while offline.
	let { disabled, children, ...rest }: ButtonProps = $props();
</script>

{#if syncStatus.online}
	<Button {disabled} {...rest}>{@render children?.()}</Button>
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span {...props} class="inline-flex">
					<Button disabled {...rest}>{@render children?.()}</Button>
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>Requires a connection</Tooltip.Content>
	</Tooltip.Root>
{/if}
