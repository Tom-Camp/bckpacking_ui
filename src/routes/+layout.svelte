<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { pwaInfo } from 'virtual:pwa-info';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';

	onMount(async () => {
		if (!pwaInfo) return;
		const { registerSW } = await import('virtual:pwa-register');
		const updateSW = registerSW({
			immediate: true,
			onNeedRefresh() {
				toast('A new version is available', {
					duration: Number.POSITIVE_INFINITY,
					action: { label: 'Reload', onClick: () => updateSW(true) }
				});
			},
			onOfflineReady() {
				toast.success('Ready to use offline');
			}
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static manifest link from the PWA plugin -->
	{@html webManifestLink}
</svelte:head>

<ModeWatcher />
<Toaster richColors position="top-center" />
<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>
