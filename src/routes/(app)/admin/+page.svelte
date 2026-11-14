<script lang="ts">
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { goto } from '$app/navigation';
	import { api, ApiError, call } from '$lib/api/client';
	import type { User } from '$lib/api/types';
	import { getAppContext } from '$lib/app-context';
	import FormError from '$lib/components/FormError.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import {
		formatTimestamp,
		fullName,
		ROLE_LABELS,
		STATUS_LABELS,
		USER_FILTERS,
		userListQuery,
		type UserFilter
	} from '$lib/domain/admin';
	import { errorMessage } from '$lib/errors';
	import { syncStatus } from '$lib/sync/status.svelte';
	import UserActions from './UserActions.svelte';

	// Admin data is online-only: it lives in component state, never in IndexedDB. Other users'
	// records don't belong in the offline cache, and `pull()` would replace them anyway.
	const app = getAppContext();

	// The profile loads from IndexedDB, so the role is unknown until it does.
	const isAdmin = $derived(app.user?.role === 'admin');

	// Cosmetic: the API enforces the role on every admin route.
	$effect(() => {
		if (app.user && !isAdmin) void goto('/', { replaceState: true });
	});

	let filter = $state<UserFilter>('all');
	let users = $state<User[] | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);
	// The cached role is stale (e.g. the user was demoted). Stop asking.
	let lostAccess = $state(false);
	// The outcome of the last row action that didn't go to plan.
	let actionError = $state<string | null>(null);
	let actionNotice = $state<string | null>(null);

	function replaceUser(updated: User) {
		actionError = actionNotice = null;
		users = users?.map((u) => (u.id === updated.id ? updated : u)) ?? null;
	}

	function removeUser(id: string) {
		users = users?.filter((u) => u.id !== id) ?? null;
	}

	function actionFailed(target: User, e: unknown) {
		actionError = actionNotice = null;
		if (e instanceof ApiError && e.status === 404) {
			removeUser(target.id);
			actionNotice = `${target.username} no longer exists.`;
		} else if (e instanceof ApiError && e.status === 403) lostAccess = true;
		else actionError = errorMessage(e);
	}

	// Refetches when the filter changes or the connection comes back.
	$effect(() => {
		if (!isAdmin || !syncStatus.online || lostAccess) return;
		const query = userListQuery(filter);
		let current = true;
		loading = true;
		error = actionError = actionNotice = null;
		call(() => api.GET('/api/v1/admin/users', { params: { query } }))
			.then((data) => {
				if (current) users = data;
			})
			.catch((e) => {
				if (!current) return;
				if (e instanceof ApiError && e.status === 403) lostAccess = true;
				else error = errorMessage(e);
			})
			.finally(() => {
				if (current) loading = false;
			});
		return () => {
			current = false;
		};
	});
</script>

<svelte:head><title>Admin · bckpack.ing</title></svelte:head>

{#if isAdmin}
	<div class="grid gap-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Users</h1>
				<p class="text-sm text-muted-foreground">Everyone with an account, oldest first.</p>
			</div>
			{#if syncStatus.online && !lostAccess}
				<ToggleGroup.Root
					type="single"
					variant="outline"
					value={filter}
					onValueChange={(v) => v && (filter = v as UserFilter)}
					aria-label="Filter by status"
				>
					{#each USER_FILTERS as option (option.value)}
						<ToggleGroup.Item value={option.value} class="px-4">{option.label}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			{/if}
		</div>

		{#if lostAccess}
			<Alert.Root>
				<Alert.Description>You no longer have admin access.</Alert.Description>
			</Alert.Root>
		{:else if !syncStatus.online}
			<Alert.Root>
				<WifiOffIcon />
				<Alert.Description>
					Admin needs a connection. The user list will load when you’re back online.
				</Alert.Description>
			</Alert.Root>
		{:else}
			<FormError message={error ?? actionError} />
			{#if actionNotice}
				<Alert.Root>
					<Alert.Description>{actionNotice}</Alert.Description>
				</Alert.Root>
			{/if}
			{#if users === null}
				{#if loading}
					<p class="text-sm text-muted-foreground">Loading users…</p>
				{/if}
			{:else if users.length === 0}
				<p class="text-sm text-muted-foreground">No users match this filter.</p>
			{:else}
				<div class="overflow-x-auto rounded-lg border" aria-busy={loading}>
					<table class="w-full text-sm">
						<thead class="bg-muted/50 text-left text-xs text-muted-foreground">
							<tr>
								<th class="px-3 py-2 font-medium">User</th>
								<th class="px-3 py-2 font-medium">Email</th>
								<th class="px-3 py-2 font-medium">Role</th>
								<th class="px-3 py-2 font-medium">Status</th>
								<th class="px-3 py-2 font-medium">Email verified</th>
								<th class="px-3 py-2 font-medium">Last login</th>
								<th class="px-3 py-2 font-medium">Joined</th>
								<th class="px-3 py-2"><span class="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each users as u (u.id)}
								{@const name = fullName(u)}
								<tr class="border-t" data-testid="admin-user-row">
									<td class="px-3 py-2">
										<div class="font-medium">{u.username}</div>
										{#if name}<div class="text-xs text-muted-foreground">{name}</div>{/if}
									</td>
									<td class="px-3 py-2 break-all">{u.email}</td>
									<td class="px-3 py-2 whitespace-nowrap">{ROLE_LABELS[u.role]}</td>
									<td class="px-3 py-2">
										<Badge variant={u.status === 'blocked' ? 'destructive' : 'secondary'}>
											{STATUS_LABELS[u.status]}
										</Badge>
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										{formatTimestamp(u.email_verified_at) ?? 'Not verified'}
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										{formatTimestamp(u.last_login, { time: true }) ?? 'Never'}
									</td>
									<td class="px-3 py-2 whitespace-nowrap">{formatTimestamp(u.created_at)}</td>
									<td class="px-3 py-1 text-right">
										<UserActions
											user={u}
											self={u.id === app.user?.id}
											onupdate={replaceUser}
											ondelete={() => {
												actionError = actionNotice = null;
												removeUser(u.id);
											}}
											onerror={(e) => actionFailed(u, e)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
{/if}
