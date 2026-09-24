<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import BackpackIcon from '@lucide/svelte/icons/backpack';
	import MountainIcon from '@lucide/svelte/icons/mountain';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import TentIcon from '@lucide/svelte/icons/tent';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { setAppContext } from '$lib/app-context';
	import { session } from '$lib/auth/session.svelte';
	import SyncBadge from '$lib/components/SyncBadge.svelte';
	import { live } from '$lib/data/live.svelte';
	import { currentUser } from '$lib/data/queries';
	import { startSync } from '$lib/sync/engine';
	import { syncStatus } from '$lib/sync/status.svelte';
	import { cn } from '$lib/utils';

	let { children } = $props();

	// Signed in means "has a token", even an expired one: cached data stays readable offline,
	// and only syncing needs a fresh sign-in.
	$effect(() => {
		if (!session.signedIn) void goto('/login', { replaceState: true });
	});

	$effect(() => {
		if (session.signedIn) return startSync();
	});

	const me = live(currentUser);
	setAppContext({
		get user() {
			return me.current;
		},
		get units() {
			return me.current?.measurements ?? 'imperial';
		}
	});

	const nav = [
		{ href: '/', label: 'Trips', icon: TentIcon },
		{ href: '/gear', label: 'Gear closet', icon: BackpackIcon },
		{ href: '/settings', label: 'Settings', icon: SettingsIcon }
	];

	const isActive = (href: string) =>
		href === '/'
			? page.url.pathname === '/' || page.url.pathname.startsWith('/trips')
			: page.url.pathname.startsWith(href);
</script>

{#if session.signedIn}
	<div class="flex min-h-svh flex-col">
		<header class="sticky top-0 z-20 border-b bg-background/95 backdrop-blur print:hidden">
			<div class="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
				<a href="/" class="mr-2 flex items-center gap-2 font-semibold">
					<MountainIcon class="size-5" />
					<span class="hidden sm:inline">bckpack.ing</span>
				</a>
				<nav class="flex items-center gap-1">
					{#each nav as item (item.href)}
						<a
							href={item.href}
							class={cn(
								'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
								isActive(item.href) && 'bg-muted text-foreground'
							)}
						>
							<item.icon class="size-4" />
							<span class="hidden sm:inline">{item.label}</span>
						</a>
					{/each}
				</nav>
				<div class="ml-auto">
					<SyncBadge />
				</div>
			</div>
			{#if !syncStatus.online}
				<div
					class="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100"
				>
					<WifiOffIcon class="size-3.5" />
					Offline: showing saved data. Checklist, packing and edits will sync when you’re back online.
				</div>
			{:else if syncStatus.blocked === 'auth'}
				<div class="bg-muted px-4 py-1.5 text-center text-xs">
					Session expired. <a href="/login" class="underline">Sign in</a> to sync your changes.
				</div>
			{/if}
		</header>
		<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}
