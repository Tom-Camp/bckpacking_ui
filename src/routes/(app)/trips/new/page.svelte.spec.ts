import { describe, expect, it } from 'vitest';
import { goto } from '$app/navigation';
import { db } from '$lib/data/db';
import { mockApi } from '$lib/test/api';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

describe('new trip page', () => {
	it('creates the trip and opens it', async () => {
		const created = trip({ id: 'trip-9', name: 'Art Loeb' });
		const requests = mockApi({ 'POST /api/v1/trips': () => created });
		const screen = await renderApp(Page);

		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect.poll(() => goto).toHaveBeenCalledWith('/trips/trip-9', { replaceState: true });
		expect(requests[0].body).toMatchObject({ name: 'Art Loeb' });
		expect(await db.trips.get('trip-9')).toEqual(created);
	});
});
