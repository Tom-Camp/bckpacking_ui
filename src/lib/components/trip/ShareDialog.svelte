<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';
	import type { Trip } from '$lib/api/types';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import FormError from '$lib/components/FormError.svelte';
	import OnlineButton from '$lib/components/OnlineButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { shareTrip, unshareTrip, updateTrip } from '$lib/data/mutations';
	import { SHARE_SECTIONS, shareUrl } from '$lib/domain/share';
	import { attempt, errorMessage } from '$lib/errors';
	import { syncStatus } from '$lib/sync/status.svelte';

	let { open = $bindable(false), trip }: { open: boolean; trip: Trip } = $props();

	let error = $state<string | null>(null);
	let busy = $state(false);
	let linkInput = $state<HTMLInputElement | null>(null);

	const url = $derived(trip.share_token ? shareUrl(location.origin, trip.share_token) : null);

	$effect(() => {
		if (open) error = null;
	});

	async function run(action: () => Promise<unknown>) {
		busy = true;
		error = null;
		try {
			await action();
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Link copied');
		} catch {
			linkInput?.select();
			toast.error('Couldn’t copy the link. Select it and copy it by hand.');
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90svh] overflow-y-auto sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Share trip</Dialog.Title>
			<Dialog.Description>
				Anyone with the link can see this trip’s details without signing in.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid grid-cols-1 gap-5">
			{#if url}
				<div class="grid grid-cols-1 gap-2">
					<Label for="share-link">Share link</Label>
					<div class="flex gap-2">
						<Input
							id="share-link"
							readonly
							value={url}
							bind:ref={linkInput}
							onfocus={(e) => e.currentTarget.select()}
						/>
						<Button variant="outline" onclick={copy}><CopyIcon /> Copy</Button>
					</div>
				</div>
			{/if}

			<fieldset class="grid grid-cols-1 gap-3">
				<legend class="mb-1 text-sm font-medium">What the link shows</legend>
				<p class="text-sm text-muted-foreground">
					Always shared: trip name, dates, area, trailheads, distance, map link and description.
				</p>
				{#each SHARE_SECTIONS as section (section.key)}
					<div class="flex items-start gap-3">
						<Checkbox
							id={section.key}
							class="mt-0.5"
							checked={trip[section.key]}
							onCheckedChange={(checked) =>
								attempt(() => updateTrip(trip.id, { [section.key]: checked }))}
						/>
						<div class="grid gap-1">
							<Label for={section.key}>{section.label}</Label>
							{#if section.key === 'share_emergency_contact'}
								<p class="text-sm text-muted-foreground">
									Anyone with the link will see this phone number or name.
									{#if !trip.emergency_contact}None set on this trip.{/if}
								</p>
							{/if}
						</div>
					</div>
				{/each}
				{#if !syncStatus.online}
					<p class="text-sm text-muted-foreground">
						Changes save on this device and reach the link once you’re back online.
					</p>
				{:else if syncStatus.blocked === 'auth'}
					<p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
						Your session expired. Changes save on this device and reach the link after you
						<a class="underline underline-offset-4" href="/login">sign in again</a>.
					</p>
				{/if}
			</fieldset>

			<FormError message={error} />
		</div>

		<Dialog.Footer>
			{#if url}
				<ConfirmDelete
					variant="outline"
					size="default"
					title="Stop sharing this trip?"
					description="The current link stops working. Sharing again creates a new link."
					confirmLabel="Stop sharing"
					onconfirm={() => run(() => unshareTrip(trip.id))}
				>
					Stop sharing
				</ConfirmDelete>
			{:else}
				<OnlineButton disabled={busy} onclick={() => run(() => shareTrip(trip.id))}>
					Create link
				</OnlineButton>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
