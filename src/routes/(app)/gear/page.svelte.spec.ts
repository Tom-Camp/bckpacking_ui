import { describe, expect, it } from 'vitest';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { gearItem } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Page from './+page.svelte';

const tent = gearItem({ name: 'Tent', category: 'shelter', weight_g: 1000 });
const stove = gearItem({ name: 'Stove', category: 'kitchen', weight_g: 85, notes: 'Canister' });
const oldTarp = gearItem({
	name: 'Old tarp',
	category: 'shelter',
	archived_at: '2026-01-01T00:00:00Z'
});

async function setup() {
	await db.gearItems.bulkPut([tent, stove, oldTarp]);
	return renderApp(Page, {}, { units: 'metric' });
}

describe('gear closet page', () => {
	it('explains an empty closet', async () => {
		const screen = await renderApp(Page);
		await expect.element(screen.getByText(/Your closet is empty/)).toBeVisible();
	});

	it('groups gear by category and hides archived items until asked', async () => {
		const screen = await setup();

		const headings = screen.getByRole('heading', { level: 2 });
		await expect.element(headings.first()).toHaveTextContent('kitchen');
		await expect.element(headings.nth(1)).toHaveTextContent('shelter');
		await expect.element(screen.getByText('85 g')).toBeVisible();
		await expect.element(screen.getByText('Old tarp')).not.toBeInTheDocument();

		await screen.getByLabelText('Show archived').click();
		await expect.element(screen.getByText('Old tarp')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Restore Old tarp' })).toBeVisible();
	});

	it('searches names, categories and notes', async () => {
		const screen = await setup();
		await screen.getByPlaceholder('Search gear').fill('canister');

		await expect.element(screen.getByText('Stove')).toBeVisible();
		await expect.element(screen.getByText('Tent')).not.toBeInTheDocument();
	});

	it('archives and restores through the API', async () => {
		const restored = { ...oldTarp, archived_at: null };
		mockApi({
			[`DELETE /api/v1/gear/${tent.id}`]: () => respond(204),
			[`POST /api/v1/gear/${oldTarp.id}/restore`]: () => restored
		});
		const screen = await setup();

		await screen.getByRole('button', { name: 'Archive Tent' }).click();
		await expect.poll(async () => (await db.gearItems.get(tent.id))?.archived_at).toBeTruthy();

		await screen.getByLabelText('Show archived').click();
		await screen.getByRole('button', { name: 'Restore Old tarp' }).click();
		await expect.poll(async () => (await db.gearItems.get(oldTarp.id))?.archived_at).toBeNull();
	});

	it('opens the gear dialog to add or edit', async () => {
		const screen = await setup();
		await screen.getByRole('button', { name: 'New gear' }).click();
		await expect.element(screen.getByRole('heading', { name: 'New gear' })).toBeVisible();
		await screen.getByRole('button', { name: 'Close', exact: true }).click();

		await screen.getByRole('button', { name: /^Stove/ }).click();
		await expect.element(screen.getByRole('heading', { name: 'Edit gear' })).toBeVisible();
		await expect.element(screen.getByLabelText('Name')).toHaveValue('Stove');
	});
});
