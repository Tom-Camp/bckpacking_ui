<script lang="ts">
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { db } from '$lib/data/db';
	import { live } from '$lib/data/live.svelte';
	import { failedEdits, pendingEdits } from '$lib/data/queries';
	import { sync } from '$lib/sync/engine';
	import { syncStatus } from '$lib/sync/status.svelte';

	let open = $state(false);
	const pending = live(pendingEdits);
	const failed = live(failedEdits);

	const label = $derived.by(() => {
		if (!syncStatus.online)
			return syncStatus.pending ? `Offline · ${syncStatus.pending} pending` : 'Offline';
		if (syncStatus.syncing) return 'Syncing…';
		if (syncStatus.blocked === 'auth') return 'Sign in to sync';
		if (syncStatus.pending) return `${syncStatus.pending} pending`;
		if (syncStatus.failed) return `${syncStatus.failed} not synced`;
		return 'Synced';
	});

	function ago(t: number | null): string {
		if (!t) return 'never';
		const minutes = Math.round((Date.now() - t) / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		return new Date(t).toLocaleString();
	}
</script>

<Button variant="ghost" size="sm" onclick={() => (open = true)} data-testid="sync-badge">
	{#if !syncStatus.online}
		<CloudOffIcon />
	{:else if syncStatus.syncing}
		<RefreshCwIcon class="animate-spin" />
	{:else if syncStatus.blocked || syncStatus.failed}
		<TriangleAlertIcon class="text-amber-600" />
	{:else}
		<CloudIcon />
	{/if}
	<span class="text-xs">{label}</span>
</Button>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Sync</Dialog.Title>
			<Dialog.Description>
				Your trips are saved on this device. Last synced {ago(syncStatus.lastSyncedAt)}.
			</Dialog.Description>
		</Dialog.Header>

		{#if syncStatus.blocked === 'auth'}
			<p class="text-sm">
				Your session expired. <a class="underline" href="/login">Sign in</a> to send your changes.
			</p>
		{/if}

		<section class="grid grid-cols-1 gap-2">
			<h3 class="text-sm font-medium">Waiting to sync ({pending.current?.length ?? 0})</h3>
			{#if pending.current?.length}
				<ul class="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
					{#each pending.current as entry (entry.seq)}
						<li>{entry.label}</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Nothing waiting.</p>
			{/if}
		</section>

		{#if failed.current?.length}
			<section class="grid grid-cols-1 gap-2">
				<h3 class="text-sm font-medium">Couldn’t sync</h3>
				<p class="text-xs text-muted-foreground">
					The server rejected these, usually because the item was changed or deleted on another
					device. The server’s version is shown in the app.
				</p>
				<ul class="grid grid-cols-1 gap-1 text-sm">
					{#each failed.current as entry (entry.id)}
						<li><span class="font-medium">{entry.label}</span>: {entry.error}</li>
					{/each}
				</ul>
				<Button variant="outline" size="sm" onclick={() => db.failed.clear()}>Dismiss</Button>
			</section>
		{/if}

		<Dialog.Footer>
			<Button disabled={!syncStatus.online || syncStatus.syncing} onclick={() => sync()}>
				Sync now
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
