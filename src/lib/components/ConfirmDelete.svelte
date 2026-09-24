<script lang="ts">
	import type { Snippet } from 'svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import type { ButtonSize, ButtonVariant } from '$lib/components/ui/button';
	import { attempt } from '$lib/errors';

	let {
		title,
		description,
		confirmLabel = 'Delete',
		onconfirm,
		variant = 'ghost',
		size = 'icon-sm',
		label,
		children
	}: {
		title: string;
		description?: string;
		confirmLabel?: string;
		onconfirm: () => Promise<unknown>;
		variant?: ButtonVariant;
		size?: ButtonSize;
		/** Accessible name for icon-only triggers. */
		label?: string;
		children: Snippet;
	} = $props();

	let open = $state(false);
</script>

<OnlineButton {variant} {size} aria-label={label} onclick={() => (open = true)}>
	{@render children()}
</OnlineButton>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			{#if description}
				<AlertDialog.Description>{description}</AlertDialog.Description>
			{/if}
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={async () => {
					if (await attempt(onconfirm)) open = false;
				}}
			>
				{confirmLabel}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
