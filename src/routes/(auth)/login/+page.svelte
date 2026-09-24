<script lang="ts">
	import { goto } from '$app/navigation';
	import { login } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { errorMessage } from '$lib/errors';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			await login(email, password);
			await goto('/');
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in · bckpack.ing</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Sign in</Card.Title>
		<Card.Description
			>Plan trips here. Your data stays on your phone for the trail.</Card.Description
		>
	</Card.Header>
	<Card.Content>
		<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
			<FormError message={error} />
			<div class="grid grid-cols-1 gap-2">
				<Label for="email">Email</Label>
				<Input id="email" type="email" autocomplete="email" required bind:value={email} />
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
				/>
			</div>
			<Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
		</form>
	</Card.Content>
	<Card.Footer class="text-sm text-muted-foreground">
		New here? <a href="/register" class="ml-1 underline underline-offset-4">Create an account</a>
	</Card.Footer>
</Card.Root>
