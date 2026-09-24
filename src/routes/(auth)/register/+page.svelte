<script lang="ts">
	import { goto } from '$app/navigation';
	import { register } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { errorMessage } from '$lib/errors';

	// Mirrors the API's rules so most mistakes are caught before a round trip. Password
	// strength (zxcvbn score ≥ 3) is checked by the API and reported back.
	const USERNAME_PATTERN = '[a-zA-Z0-9_\\-]{3,30}';

	let form = $state({ email: '', username: '', password: '', first_name: '', last_name: '' });
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (new TextEncoder().encode(form.password).length > 72) {
			error = 'Password is too long (72 bytes max).';
			return;
		}
		busy = true;
		error = null;
		try {
			await register({
				...form,
				first_name: form.first_name || null,
				last_name: form.last_name || null
			});
			await goto('/');
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Create account · bckpack.ing</title></svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Create an account</Card.Title>
	</Card.Header>
	<Card.Content>
		<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
			<FormError message={error} />
			<div class="grid grid-cols-2 gap-3">
				<div class="grid grid-cols-1 gap-2">
					<Label for="first">First name</Label>
					<Input id="first" autocomplete="given-name" bind:value={form.first_name} />
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="last">Last name</Label>
					<Input id="last" autocomplete="family-name" bind:value={form.last_name} />
				</div>
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label for="username">Username</Label>
				<Input
					id="username"
					autocomplete="username"
					required
					pattern={USERNAME_PATTERN}
					title="3–30 letters, numbers, _ or -"
					bind:value={form.username}
				/>
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label for="email">Email</Label>
				<Input id="email" type="email" autocomplete="email" required bind:value={form.email} />
			</div>
			<div class="grid grid-cols-1 gap-2">
				<Label for="password">Password</Label>
				<Input
					id="password"
					type="password"
					autocomplete="new-password"
					required
					bind:value={form.password}
				/>
				<p class="text-xs text-muted-foreground">
					Use a long passphrase; weak passwords are rejected.
				</p>
			</div>
			<Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
		</form>
	</Card.Content>
	<Card.Footer class="text-sm text-muted-foreground">
		Have an account? <a href="/login" class="ml-1 underline underline-offset-4">Sign in</a>
	</Card.Footer>
</Card.Root>
