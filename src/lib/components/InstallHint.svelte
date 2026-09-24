<script lang="ts">
	import { onMount } from 'svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	// Installing to the home screen is what makes offline access dependable: iOS Safari may
	// clear storage for sites that aren't installed after about a week without use.

	const DISMISS_KEY = 'bckpack.install-hint-dismissed';

	interface InstallPromptEvent extends Event {
		prompt(): Promise<void>;
	}

	let visible = $state(false);
	let installPrompt = $state<InstallPromptEvent | null>(null);
	const isIos = /iphone|ipad|ipod/i.test(globalThis.navigator?.userAgent ?? '');

	onMount(() => {
		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
		let dismissed = false;
		try {
			dismissed = localStorage.getItem(DISMISS_KEY) === '1';
		} catch {
			// ignore
		}
		visible = !standalone && !dismissed;

		const onPrompt = (e: Event) => {
			e.preventDefault();
			installPrompt = e as InstallPromptEvent;
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		return () => window.removeEventListener('beforeinstallprompt', onPrompt);
	});

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			// ignore
		}
	}

	async function install() {
		await installPrompt?.prompt();
		dismiss();
	}
</script>

{#if visible}
	<Card.Root class="border-dashed">
		<Card.Header>
			<Card.Title class="flex items-center gap-2 text-base">
				<DownloadIcon class="size-4" /> Install for the trail
			</Card.Title>
			<Card.Description>
				{#if installPrompt}
					Install bckpack.ing so your trips open with no signal at the trailhead.
				{:else if isIos}
					In Safari, tap Share → <strong>Add to Home Screen</strong>. Installed, your trips stay
					available with no signal.
				{:else}
					Use your browser’s “Install app” or “Add to Home screen” option so your trips open with no
					signal.
				{/if}
			</Card.Description>
			<Card.Action>
				<Button variant="ghost" size="icon-sm" onclick={dismiss} aria-label="Dismiss">
					<XIcon />
				</Button>
			</Card.Action>
		</Card.Header>
		{#if installPrompt}
			<Card.Footer>
				<Button size="sm" onclick={install}>Install app</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
{/if}
