import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { page as browser } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { startSync } from '$lib/sync/engine';
import { syncStatus } from '$lib/sync/status.svelte';
import { user } from '$lib/test/fixtures';
import InLayout from '$lib/test/InLayout.svelte';
import { setRoute } from '$lib/test/route';
import UnitsProbe from '$lib/test/UnitsProbe.svelte';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));

beforeEach(() => {
	setRoute('/gear');
});

describe('app layout', () => {
	it('sends signed-out visitors to the login page', async () => {
		const screen = await render(Layout, { children });

		await expect.poll(() => goto).toHaveBeenCalledWith('/login', { replaceState: true });
		expect(screen.container.textContent).not.toContain('Page content');
		expect(startSync).not.toHaveBeenCalled();
	});

	it('shows the app shell and starts syncing when signed in', async () => {
		// Nav labels are only shown from the `sm` breakpoint up.
		await browser.viewport(1024, 768);
		session.set('jwt-token');
		const screen = await render(Layout, { children });

		await expect.element(screen.getByText('Page content')).toBeVisible();
		await expect.element(screen.getByTestId('sync-badge')).toBeVisible();
		await expect.element(screen.getByRole('link', { name: 'Gear closet' })).toHaveClass('bg-muted');
		await expect.element(screen.getByRole('link', { name: 'Trips' })).not.toHaveClass('bg-muted');
		expect(startSync).toHaveBeenCalledOnce();
		expect(goto).not.toHaveBeenCalled();
	});

	it('explains offline mode and an expired session', async () => {
		session.set('jwt-token');
		syncStatus.online = false;
		const screen = await render(Layout, { children });
		await expect.element(screen.getByText(/Offline: showing saved data/)).toBeVisible();

		syncStatus.online = true;
		syncStatus.blocked = 'auth';
		await expect.element(screen.getByText(/Session expired/)).toBeVisible();
	});

	it('provides the cached profile’s units to pages', async () => {
		session.set('jwt-token');
		const screen = await render(InLayout, { layout: Layout, child: UnitsProbe });
		await expect.element(screen.getByTestId('units')).toHaveTextContent('imperial');

		await db.users.put(user({ measurements: 'metric' }));
		await expect.element(screen.getByTestId('units')).toHaveTextContent('metric');
	});
});
