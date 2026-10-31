<script lang="ts">
	// Landing page for the emailed verification link, `/verify-email#<token>`. The token is in
	// the fragment, so it never reaches the static server's logs, and it's posted from JS, so a
	// mail client's link prefetcher (which doesn't run scripts) can't use it up.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/client';
	import { verifyEmail } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import ResendVerification from '$lib/components/ResendVerification.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { errorMessage } from '$lib/errors';

	type State = 'verifying' | 'incomplete' | 'expired' | 'error';

	const token = page.url.hash.slice(1);

	let status = $state<State>(token ? 'verifying' : 'incomplete');
	let error = $state<string | null>(null);
	let email = $state('');

	// Once, on mount: an $effect could re-run and post the token again.
	onMount(async () => {
		if (!token) return;
		try {
			await verifyEmail(token);
			await goto('/login?verified=1', { replaceState: true });
		} catch (e) {
			if (e instanceof ApiError && e.status === 400) status = 'expired';
			else {
				status = 'error';
				error = errorMessage(e);
			}
		}
	});
</script>

<svelte:head><title>Verify email · bckpack.ing</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>
			{#if status === 'verifying'}
				Verifying…
			{:else if status === 'incomplete'}
				This verification link is incomplete
			{:else if status === 'expired'}
				This link is invalid or has expired
			{:else}
				Couldn’t verify your email
			{/if}
		</Card.Title>
		{#if status === 'incomplete'}
			<Card.Description>Copy the whole link from the email, or request a new one.</Card.Description>
		{:else if status === 'expired'}
			<Card.Description>Enter your email and we’ll send a new link.</Card.Description>
		{/if}
	</Card.Header>
	{#if status !== 'verifying'}
		<Card.Content class="grid grid-cols-1 gap-4">
			<FormError message={error} />
			<div class="grid grid-cols-1 gap-2">
				<Label for="email">Email</Label>
				<Input id="email" type="email" autocomplete="email" bind:value={email} />
			</div>
			<ResendVerification {email} label="Send a new link" />
		</Card.Content>
		<Card.Footer class="text-sm text-muted-foreground">
			Already verified? <a href="/login" class="ml-1 underline underline-offset-4">Sign in</a>
		</Card.Footer>
	{/if}
</Card.Root>
