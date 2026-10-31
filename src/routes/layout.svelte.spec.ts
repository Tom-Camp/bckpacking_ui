import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from 'svelte-sonner';
import Layout from './+layout.svelte';

const registerSW = vi.hoisted(() => vi.fn());
vi.mock('virtual:pwa-info', () => ({
	pwaInfo: { webManifest: { linkTag: '<link rel="manifest" href="/manifest.webmanifest">' } }
}));
vi.mock('virtual:pwa-register', () => ({ registerSW }));

describe('root layout', () => {
	it('renders the page with the web manifest and registers the service worker', async () => {
		const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
		const screen = await render(Layout, { children });

		await expect.element(screen.getByText('Page content')).toBeVisible();
		expect(document.head.querySelector('link[rel="manifest"]')).not.toBeNull();
		await expect
			.poll(() => registerSW)
			.toHaveBeenCalledWith(expect.objectContaining({ immediate: true }));
	});

	it('offers a reload when a new version is ready', async () => {
		const updateSW = vi.fn();
		registerSW.mockReturnValue(updateSW);
		const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
		const screen = await render(Layout, { children });
		await expect.poll(() => registerSW).toHaveBeenCalled();

		registerSW.mock.calls[0][0].onNeedRefresh();
		await screen.getByRole('button', { name: 'Reload' }).click();
		expect(updateSW).toHaveBeenCalledWith(true);
		toast.dismiss();
	});
});
