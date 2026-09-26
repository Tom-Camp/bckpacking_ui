import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { renderApp } from '$lib/test/render';
import { syncStatus } from '$lib/sync/status.svelte';
import OnlineButton from './OnlineButton.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>New trip</span>' }));

describe('OnlineButton', () => {
	it('is enabled while online', async () => {
		const screen = await renderApp(OnlineButton, { children });
		await expect.element(screen.getByRole('button', { name: 'New trip' })).toBeEnabled();
	});

	it('is disabled with an explanation while offline', async () => {
		syncStatus.online = false;
		const screen = await renderApp(OnlineButton, { children });

		const button = screen.getByRole('button', { name: 'New trip' });
		await expect.element(button).toBeDisabled();
		await screen.getByText('New trip').hover({ force: true });
		await expect.element(screen.getByText('Requires a connection').first()).toBeInTheDocument();
	});

	it('respects its own disabled prop while online', async () => {
		const screen = await renderApp(OnlineButton, { children, disabled: true });
		await expect.element(screen.getByRole('button', { name: 'New trip' })).toBeDisabled();
	});
});
