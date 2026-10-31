import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import InstallHint from './InstallHint.svelte';

describe('InstallHint', () => {
	it('suggests installing, with browser-menu instructions by default', async () => {
		const screen = await render(InstallHint);
		await expect.element(screen.getByText('Install for the trail')).toBeVisible();
		await expect.element(screen.getByText(/“Install app” or “Add to Home screen”/)).toBeVisible();
	});

	it('stays dismissed once closed', async () => {
		const screen = await render(InstallHint);
		await screen.getByRole('button', { name: 'Dismiss' }).click();
		await expect.element(screen.getByText('Install for the trail')).not.toBeInTheDocument();
		expect(localStorage.getItem('bckpack.install-hint-dismissed')).toBe('1');

		const again = await render(InstallHint);
		expect(again.container.textContent?.trim()).toBe('');
	});

	it('offers the browser install prompt when one is available', async () => {
		const screen = await render(InstallHint);
		const prompt = vi.fn(async () => {});
		window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt }));

		await screen.getByRole('button', { name: 'Install app' }).click();
		expect(prompt).toHaveBeenCalledOnce();
		await expect.element(screen.getByText('Install for the trail')).not.toBeInTheDocument();
	});
});
