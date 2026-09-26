<script lang="ts">
	import { onMount } from 'svelte';
	import { evaluate, loadZxcvbn, type PasswordStrength } from '$lib/auth/password-strength';
	import { cn } from '$lib/utils';

	let {
		password,
		strength = $bindable(null)
	}: {
		password: string;
		/** Null until zxcvbn has loaded or while the password is empty. */
		strength?: PasswordStrength | null;
	} = $props();

	let zxcvbn = $state<Awaited<ReturnType<typeof loadZxcvbn>> | null>(null);

	onMount(() => {
		// If the chunk fails to load (e.g. offline), fall back to the API's check on submit.
		loadZxcvbn().then(
			(z) => (zxcvbn = z),
			() => {}
		);
	});

	$effect(() => {
		strength = zxcvbn && password ? evaluate(zxcvbn, password) : null;
	});

	const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
	const COLORS = [
		'bg-destructive',
		'bg-destructive',
		'bg-amber-500',
		'bg-green-600',
		'bg-green-600'
	];
</script>

{#if strength}
	<div class="grid grid-cols-1 gap-1" aria-live="polite">
		<div class="grid grid-cols-4 gap-1" aria-hidden="true">
			{#each { length: 4 } as _, i (i)}
				<div
					class={cn(
						'h-1 rounded-full transition-colors',
						i < Math.max(strength.score, 1) ? COLORS[strength.score] : 'bg-muted'
					)}
				></div>
			{/each}
		</div>
		<p class={cn('text-xs', strength.ok ? 'text-muted-foreground' : 'text-destructive')}>
			{LABELS[strength.score]}{strength.message ? ` — ${strength.message}` : ''}
		</p>
	</div>
{/if}
