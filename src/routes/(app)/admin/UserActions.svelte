<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { api, call, OfflineError } from '$lib/api/client';
	import type { User, UserRole } from '$lib/api/types';
	import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ASSIGNABLE_ROLES, ROLE_LABELS } from '$lib/domain/admin';
	import { syncStatus } from '$lib/sync/status.svelte';

	// Admin actions are online-only and never touch IndexedDB: the page swaps in the API's
	// response (or drops the row) and reports failures through `onerror`.
	let {
		user,
		self,
		onupdate,
		ondelete,
		onerror
	}: {
		user: User;
		/** The signed-in admin's own row. The API refuses every action on it. */
		self: boolean;
		onupdate: (user: User) => void;
		ondelete: () => void;
		onerror: (error: unknown) => void;
	} = $props();

	let busy = $state(false);
	let confirmSuspend = $state(false);
	let confirmDelete = $state(false);

	const disabledReason = $derived(
		self ? 'You can’t change your own account' : !syncStatus.online ? 'Requires a connection' : null
	);
	const path = $derived({ params: { path: { user_id: user.id } } });

	/** Runs one request. Never throws, so a confirm dialog closes whatever the outcome. */
	async function run(request: () => Promise<void>) {
		if (busy) return;
		busy = true;
		try {
			// The UI can lag behind the connection dropping; don't send anything offline.
			if (globalThis.navigator && !navigator.onLine) throw new OfflineError();
			await request();
		} catch (e) {
			onerror(e);
		} finally {
			busy = false;
		}
	}

	const suspend = () =>
		run(async () =>
			onupdate(await call(() => api.PATCH('/api/v1/admin/users/{user_id}/suspend', path)))
		);

	const restore = () =>
		run(async () =>
			onupdate(await call(() => api.PATCH('/api/v1/admin/users/{user_id}/approve', path)))
		);

	const setRole = (role: UserRole) =>
		run(async () =>
			onupdate(
				await call(() =>
					api.PATCH('/api/v1/admin/users/{user_id}/role', { ...path, body: { role } })
				)
			)
		);

	const remove = () =>
		run(async () => {
			await call(() => api.DELETE('/api/v1/admin/users/{user_id}', path));
			ondelete();
		});
</script>

{#snippet trigger(props: Record<string, unknown> = {})}
	<Button
		{...props}
		variant="ghost"
		size="icon-sm"
		disabled={!!disabledReason || busy}
		aria-label="Actions for {user.username}"
	>
		<EllipsisIcon />
	</Button>
{/snippet}

{#if disabledReason}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span {...props} class="inline-flex">{@render trigger()}</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{disabledReason}</Tooltip.Content>
	</Tooltip.Root>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				{@render trigger(props)}
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			{#if user.status === 'blocked'}
				<DropdownMenu.Item onSelect={restore}>Restore</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Item onSelect={() => (confirmSuspend = true)}>Suspend…</DropdownMenu.Item>
			{/if}
			{#each ASSIGNABLE_ROLES.filter((r) => r !== user.role) as role (role)}
				<DropdownMenu.Item onSelect={() => setRole(role)}>
					Make {ROLE_LABELS[role].toLowerCase()}
				</DropdownMenu.Item>
			{/each}
			<DropdownMenu.Separator />
			<DropdownMenu.Item variant="destructive" onSelect={() => (confirmDelete = true)}>
				Delete…
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

<ConfirmDelete
	bind:open={confirmSuspend}
	title="Suspend {user.username}?"
	description="They can’t use their account until you restore it. Their trips and gear are kept."
	confirmLabel="Suspend"
	onconfirm={suspend}
/>

<ConfirmDelete
	bind:open={confirmDelete}
	title="Delete {user.username}?"
	description="This deletes their account along with all of their trips and gear. It can’t be undone."
	confirmLabel="Delete"
	onconfirm={remove}
/>
