<script lang="ts">
	// Asks the API to send another verification link. Online-only and outside the sync engine.
	import { resendVerification } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import { errorMessage } from '$lib/errors';

	let { email, label = 'Resend email' }: { email: string; label?: string } = $props();

	let busy = $state(false);
	let sent = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function resend() {
		busy = true;
		sent = null;
		error = null;
		try {
			sent = await resendVerification(email);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="grid grid-cols-1 gap-2">
	<FormError message={error} />
	{#if sent}
		<p role="status" class="text-sm text-muted-foreground">{sent}</p>
	{/if}
	<Button type="button" variant="outline" disabled={busy || !email} onclick={resend}>
		{busy ? 'Sending…' : label}
	</Button>
</div>
