<script lang="ts">
	// Landing page for the emailed reset link, `/reset-password#<token>`. The token is in the
	// fragment, so it never reaches the static server's logs. A successful reset doesn't sign in
	// or touch local data: `login()` already clears the cache if a different user signs in.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/client';
	import { resetPassword } from '$lib/auth/actions';
	import {
		isTooLong,
		TOO_LONG_MESSAGE,
		type PasswordStrength as Strength
	} from '$lib/auth/password-strength';
	import FormError from '$lib/components/FormError.svelte';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { errorMessage } from '$lib/errors';

	const token = page.url.hash.slice(1);

	let passwords = $state({ next: '', confirm: '' });
	let error = $state<string | null>(null);
	let busy = $state(false);
	let strength = $state<Strength | null>(null);
	// Set on a 400: the link is used, expired or wrong, so the form is no use.
	let expired = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (passwords.next !== passwords.confirm) {
			error = 'Passwords don’t match.';
			return;
		}
		if (strength && !strength.ok) {
			error = strength.message;
			return;
		}
		// zxcvbn may not have loaded (e.g. offline); still catch what bcrypt can't take.
		if (isTooLong(passwords.next)) {
			error = TOO_LONG_MESSAGE;
			return;
		}
		busy = true;
		error = null;
		try {
			await resetPassword(token, passwords.next);
			// replaceState keeps the token out of history.
			await goto('/login?reset=1', { replaceState: true });
		} catch (e) {
			// A 422 (weak password) leaves the link usable, so the form stays.
			if (e instanceof ApiError && e.status === 400) expired = true;
			else error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Choose a new password · bckpack.ing</title></svelte:head>

<Card.Root>
	{#if !token || expired}
		<Card.Header>
			<Card.Title>
				{!token ? 'This reset link is incomplete' : 'This reset link is invalid or has expired'}
			</Card.Title>
			<Card.Description>
				{!token
					? 'Copy the whole link from the email, or request a new one.'
					: 'Reset links work once and expire after a while.'}
			</Card.Description>
		</Card.Header>
		<Card.Footer class="text-sm text-muted-foreground">
			<a href="/forgot-password" class="underline underline-offset-4">Request a new link</a>
		</Card.Footer>
	{:else}
		<Card.Header>
			<Card.Title>Choose a new password</Card.Title>
		</Card.Header>
		<Card.Content>
			<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
				<FormError message={error} />
				<div class="grid grid-cols-1 gap-2">
					<Label for="new-password">New password</Label>
					<Input
						id="new-password"
						type="password"
						autocomplete="new-password"
						required
						aria-invalid={strength ? !strength.ok : undefined}
						bind:value={passwords.next}
					/>
					<PasswordStrength password={passwords.next} bind:strength />
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="confirm-password">Confirm new password</Label>
					<Input
						id="confirm-password"
						type="password"
						autocomplete="new-password"
						required
						bind:value={passwords.confirm}
					/>
				</div>
				<Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</Button>
			</form>
		</Card.Content>
	{/if}
</Card.Root>
