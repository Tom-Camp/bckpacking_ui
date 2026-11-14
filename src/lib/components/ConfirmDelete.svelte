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
		open = $bindable(false),
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
		/** Bind to open the dialog from elsewhere, e.g. a menu item. */
		open?: boolean;
		/** The trigger button's content. Without it there is no trigger; open it with `open`. */
		children?: Snippet;
	} = $props();
</script>

{#if children}
	<OnlineButton {variant} {size} aria-label={label} onclick={() => (open = true)}>
		{@render children()}
	</OnlineButton>
{/if}

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
