<script lang="ts">
	import { requestPasswordReset } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { errorMessage } from '$lib/errors';

	let email = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	// The API's reply, the same whether or not the account exists.
	let sent = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			sent = await requestPasswordReset(email);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Reset password · bckpack.ing</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Reset your password</Card.Title>
		{#if !sent}
			<Card.Description>We’ll email you a link to choose a new password.</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content>
		{#if sent}
			<p role="status" class="text-sm">{sent}</p>
		{:else}
			<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
				<FormError message={error} />
				<div class="grid grid-cols-1 gap-2">
					<Label for="email">Email</Label>
					<Input id="email" type="email" autocomplete="email" required bind:value={email} />
				</div>
				<Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
			</form>
		{/if}
	</Card.Content>
	<Card.Footer class="text-sm text-muted-foreground">
		<a href="/login" class="underline underline-offset-4">Back to sign in</a>
	</Card.Footer>
</Card.Root>
