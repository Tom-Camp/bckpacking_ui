import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goto, replaceState } from '$app/navigation';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import { setRoute } from '$lib/test/route';
import Page from './+page.svelte';

beforeEach(() => {
	setRoute('/trips/trip-1', { id: 'trip-1' });
});

describe('trip page', () => {
	it('says when the trip is not on this device', async () => {
		const screen = await renderApp(Page);
		await expect.element(screen.getByRole('heading', { name: 'Trip not found' })).toBeVisible();
	});

	it('shows the trip with its to-do count and overview', async () => {
		await db.trips.put(trip({ emergency_contact: 'Sam 555-0100' }));
		const screen = await renderApp(Page);

		await expect.element(screen.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();
		await expect.element(screen.getByRole('tab', { name: 'Checklist 2' })).toBeVisible();
		await expect.element(screen.getByText('Sam 555-0100')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'Print' }))
			.toHaveAttribute('href', '/trips/trip-1/print');
	});

	it('opens the tab named in the URL and records tab changes', async () => {
		await db.trips.put(trip());
		setRoute('/trips/trip-1?tab=checklist', { id: 'trip-1' });
		const screen = await renderApp(Page);

		await expect.element(screen.getByTestId('checklist-permit')).toBeVisible();
		await screen.getByRole('tab', { name: 'Food' }).click();
		await expect.element(screen.getByText('Daily targets')).toBeVisible();
		expect(String(vi.mocked(replaceState).mock.calls.at(-1)?.[0])).toBe(
			'http://localhost/trips/trip-1?tab=food'
		);
	});

	it('edits the trip offline', async () => {
		await db.trips.put(trip());
		const screen = await renderApp(Page);
		await screen.getByRole('button', { name: 'Edit' }).click();

		await screen.getByLabelText('Trip name').fill('Art Loeb Trail');
		await screen.getByRole('button', { name: 'Save' }).click();

		await expect.element(screen.getByRole('heading', { name: 'Art Loeb Trail' })).toBeVisible();
		expect((await db.outbox.toArray())[0]).toMatchObject({ path: '/api/v1/trips/trip-1' });
	});

	it('deletes the trip after confirmation and returns to the list', async () => {
		await db.trips.put(trip());
		mockApi({ 'DELETE /api/v1/trips/trip-1': () => respond(204) });
		const screen = await renderApp(Page);

		await screen.getByRole('button', { name: 'Delete trip' }).click();
		await expect.element(screen.getByText('Delete Art Loeb?')).toBeVisible();
		await screen.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect.poll(() => goto).toHaveBeenCalledWith('/', { replaceState: true });
		expect(await db.trips.get('trip-1')).toBeUndefined();
	});
});
