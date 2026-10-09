import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import { db } from '$lib/data/db';
import { syncStatus } from '$lib/sync/status.svelte';
import { mockApi, respond } from '$lib/test/api';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import ShareDialog from './ShareDialog.svelte';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const LINK = `${location.origin}/shared#tok`;

async function renderDialog(overrides: Parameters<typeof trip>[0] = {}) {
	const t = trip(overrides);
	await db.trips.put(t);
	return { screen: await renderApp(ShareDialog, { open: true, trip: t }) };
}

describe('ShareDialog', () => {
	it('creates a link and saves the token', async () => {
		const requests = mockApi({ 'POST /api/v1/trips/trip-1/share': () => ({ share_token: 'tok' }) });
		const { screen } = await renderDialog();

		await screen.getByRole('button', { name: 'Create link' }).click();

		await expect.poll(async () => (await db.trips.get('trip-1'))?.share_token).toBe('tok');
		expect(requests.map((r) => r.route)).toEqual(['POST /api/v1/trips/trip-1/share']);
	});

	it('copies the link, and falls back to selecting it when the clipboard fails', async () => {
		const writeText = vi
			.spyOn(navigator.clipboard, 'writeText')
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('denied'));
		const { screen } = await renderDialog({ share_token: 'tok' });

		await expect.element(screen.getByLabelText('Share link')).toHaveValue(LINK);
		await screen.getByRole('button', { name: 'Copy' }).click();
		await expect.poll(() => toast.success).toHaveBeenCalledWith('Link copied');
		expect(writeText).toHaveBeenCalledWith(LINK);

		await screen.getByRole('button', { name: 'Copy' }).click();
		await expect.poll(() => toast.error).toHaveBeenCalledOnce();
		writeText.mockRestore();
	});

	it('queues section toggles as trip PATCHes without calling the API', async () => {
		const requests = mockApi({});
		const { screen } = await renderDialog();

		await screen.getByRole('checkbox', { name: 'Gear list' }).click();

		await expect.poll(async () => (await db.trips.get('trip-1'))?.share_gear).toBe(true);
		const [entry] = await db.outbox.toArray();
		expect(entry).toMatchObject({ path: '/api/v1/trips/trip-1', body: { share_gear: true } });
		expect(requests).toEqual([]);
	});

	it('warns that the emergency contact is public, and says when there is none', async () => {
		const { screen } = await renderDialog();
		await expect
			.element(screen.getByText(/Anyone with the link will see this phone number or name/))
			.toBeVisible();
		await expect.element(screen.getByText(/None set on this trip/)).toBeVisible();
	});

	it('keeps toggles and Copy working offline but disables link changes', async () => {
		syncStatus.online = false;
		const { screen } = await renderDialog({ share_token: 'tok' });

		await expect.element(screen.getByRole('button', { name: 'Stop sharing' })).toBeDisabled();
		await expect.element(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
		await expect.element(screen.getByText(/reach the link once you’re back online/)).toBeVisible();
		await screen.getByRole('checkbox', { name: 'Food plan' }).click();
		await expect.poll(async () => (await db.trips.get('trip-1'))?.share_food).toBe(true);
	});

	it('says toggles wait for sign-in when the session has expired', async () => {
		syncStatus.blocked = 'auth';
		const { screen } = await renderDialog({ share_token: 'tok' });

		await expect.element(screen.getByText(/Your session expired/)).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'sign in again' }))
			.toHaveAttribute('href', '/login');
		await screen.getByRole('checkbox', { name: 'Checklist status' }).click();
		await expect.poll(async () => await db.outbox.count()).toBe(1);
	});

	it('shows no session warning while sync is working', async () => {
		const { screen } = await renderDialog();
		await expect.element(screen.getByText('Gear list')).toBeVisible();
		await expect.element(screen.getByText(/Your session expired/)).not.toBeInTheDocument();
	});

	it('disables Create link offline', async () => {
		syncStatus.online = false;
		const { screen } = await renderDialog();
		await expect.element(screen.getByRole('button', { name: 'Create link' })).toBeDisabled();
	});

	it('stops sharing after confirmation and keeps the section toggles', async () => {
		const requests = mockApi({ 'DELETE /api/v1/trips/trip-1/share': () => respond(204) });
		const { screen } = await renderDialog({ share_token: 'tok', share_gear: true });

		await screen.getByRole('button', { name: 'Stop sharing' }).click();
		await expect.element(screen.getByText('Stop sharing this trip?')).toBeVisible();
		await screen.getByRole('button', { name: 'Stop sharing' }).last().click();

		await expect.poll(async () => (await db.trips.get('trip-1'))?.share_token).toBeNull();
		expect(await db.trips.get('trip-1')).toMatchObject({ share_gear: true, share_food: false });
		expect(requests.map((r) => r.route)).toEqual(['DELETE /api/v1/trips/trip-1/share']);
	});
});
