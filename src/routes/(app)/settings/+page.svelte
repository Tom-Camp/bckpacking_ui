<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Unit } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import { logout } from '$lib/auth/actions';
	import FormError from '$lib/components/FormError.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import UnitInput from '$lib/components/UnitInput.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { updateProfile } from '$lib/data/mutations';
	import { errorMessage } from '$lib/errors';
	import { syncStatus } from '$lib/sync/status.svelte';
	import { toast } from 'svelte-sonner';

	const app = getAppContext();

	let form = $state({
		username: '',
		first_name: '',
		last_name: '',
		measurements: 'imperial' as Unit,
		body_weight_g: null as number | null
	});
	let loadedFor: string | undefined;
	let error = $state<string | null>(null);
	let busy = $state(false);

	// Seed the form once the profile loads from IndexedDB.
	$effect.pre(() => {
		const user = app.user;
		if (!user || loadedFor === user.id) return;
		loadedFor = user.id;
		form = {
			username: user.username,
			first_name: user.first_name ?? '',
			last_name: user.last_name ?? '',
			measurements: user.measurements,
			body_weight_g: user.body_weight_g ?? null
		};
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;
		try {
			await updateProfile({
				username: form.username.trim(),
				first_name: form.first_name.trim() || null,
				last_name: form.last_name.trim() || null,
				measurements: form.measurements,
				body_weight_g: form.body_weight_g
			});
			toast.success('Profile saved');
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	let confirmLogout = $state(false);
	async function signOut() {
		await logout();
		await goto('/login', { replaceState: true });
	}
</script>

<svelte:head><title>Settings · bckpack.ing</title></svelte:head>

<div class="mx-auto grid max-w-xl gap-6">
	<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Profile</Card.Title>
			<Card.Description>{app.user?.email}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="grid grid-cols-1 gap-4" onsubmit={submit}>
				<FormError message={error} />
				<div class="grid grid-cols-1 gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						required
						pattern={'[a-zA-Z0-9_\\-]{3,30}'}
						bind:value={form.username}
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="grid grid-cols-1 gap-2">
						<Label for="first">First name</Label>
						<Input id="first" bind:value={form.first_name} />
					</div>
					<div class="grid grid-cols-1 gap-2">
						<Label for="last">Last name</Label>
						<Input id="last" bind:value={form.last_name} />
					</div>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label>Units</Label>
					<ToggleGroup.Root
						type="single"
						variant="outline"
						value={form.measurements}
						onValueChange={(v) => v && (form.measurements = v as Unit)}
					>
						<ToggleGroup.Item value="imperial" class="px-4">Imperial (lb, mi)</ToggleGroup.Item>
						<ToggleGroup.Item value="metric" class="px-4">Metric (kg, km)</ToggleGroup.Item>
					</ToggleGroup.Root>
				</div>
				<div class="grid grid-cols-1 gap-2">
					<Label for="body-weight">Body weight</Label>
					<UnitInput
						id="body-weight"
						measure="body-weight"
						units={form.measurements}
						bind:value={form.body_weight_g}
					/>
					<p class="text-xs text-muted-foreground">
						Optional. Used to show pack weight as a % of body weight.
					</p>
				</div>
				<div><OnlineButton type="submit" disabled={busy}>Save</OnlineButton></div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Sign out</Card.Title>
			<Card.Description>Signing out removes your trips from this device.</Card.Description>
		</Card.Header>
		<Card.Content class="grid grid-cols-1 gap-3">
			{#if confirmLogout && syncStatus.pending}
				<FormError
					message="{syncStatus.pending} change(s) haven’t synced yet and will be lost if you sign out now."
				/>
			{/if}
			<div>
				{#if confirmLogout || !syncStatus.pending}
					<Button variant="destructive" onclick={signOut}>Sign out</Button>
				{:else}
					<Button variant="destructive" onclick={() => (confirmLogout = true)}>Sign out</Button>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>
