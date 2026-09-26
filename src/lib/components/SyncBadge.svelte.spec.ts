import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { db } from '$lib/data/db';
import { sync } from '$lib/sync/engine';
import { syncStatus } from '$lib/sync/status.svelte';
import SyncBadge from './SyncBadge.svelte';

const badge = (screen: Awaited<ReturnType<typeof render>>) => screen.getByTestId('sync-badge');

describe('SyncBadge', () => {
	it.each([
		[{}, 'Synced'],
		[{ pending: 2 }, '2 pending'],
		[{ failed: 1 }, '1 not synced'],
		[{ syncing: true }, 'Syncing…'],
		[{ blocked: 'auth' as const }, 'Sign in to sync'],
		[{ online: false }, 'Offline'],
		[{ online: false, pending: 3 }, 'Offline · 3 pending']
	])('labels %o as “%s”', async (status, label) => {
		Object.assign(syncStatus, status);
		const screen = await render(SyncBadge);
		await expect.element(badge(screen)).toHaveTextContent(label);
	});

	it('lists queued edits and syncs on request', async () => {
		await db.outbox.add({
			method: 'PATCH',
			path: '/api/v1/trips/t/checklist/permit',
			body: { status: 'done' },
			label: 'Checklist: Permit',
			createdAt: Date.now(),
			attempts: 0
		});
		const screen = await render(SyncBadge);
		await badge(screen).click();

		await expect.element(screen.getByText('Waiting to sync (1)')).toBeVisible();
		await expect.element(screen.getByText('Checklist: Permit')).toBeVisible();
		await screen.getByRole('button', { name: 'Sync now' }).click();
		expect(sync).toHaveBeenCalled();
	});

	it('shows rejected edits and lets the user dismiss them', async () => {
		await db.failed.add({
			method: 'PATCH',
			path: '/api/v1/trips/t/notes/n',
			body: { content: 'x' },
			label: 'Note',
			createdAt: Date.now(),
			attempts: 1,
			status: 404,
			error: 'Note not found',
			failedAt: Date.now()
		});
		const screen = await render(SyncBadge);
		await badge(screen).click();

		await expect.element(screen.getByText('Couldn’t sync')).toBeVisible();
		await expect.element(screen.getByText(': Note not found')).toBeVisible();
		await screen.getByRole('button', { name: 'Dismiss' }).click();
		await expect.element(screen.getByText('Couldn’t sync')).not.toBeInTheDocument();
		expect(await db.failed.count()).toBe(0);
	});

	it('explains an expired session and cannot sync offline', async () => {
		Object.assign(syncStatus, { blocked: 'auth' });
		const screen = await render(SyncBadge);
		await badge(screen).click();
		await expect.element(screen.getByText(/Your session expired/)).toBeVisible();

		syncStatus.online = false;
		await expect.element(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled();
	});
});
