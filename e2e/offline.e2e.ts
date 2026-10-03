import { expect, test } from '@playwright/test';

// Needs the API running on localhost:8000 (the preview server proxies /api to it).

test('trip data opens offline and offline edits sync on reconnect', async ({ page, context }) => {
	const stamp = Date.now();
	const password = 'Ridge-Sunrise-Trailhead-2026!';

	// Register (logs in automatically)
	await page.goto('/register');
	await page.getByLabel('Username').fill(`e2e_${stamp}`);
	await page.getByLabel('Email').fill(`e2e_${stamp}@example.com`);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Trips' })).toBeVisible();

	// Gear closet item
	await page.getByRole('link', { name: 'Gear closet' }).click();
	await page.getByRole('button', { name: 'New gear' }).click();
	await page.getByLabel('Name').fill('Tent');
	await page.getByLabel('Category').click();
	await page.getByRole('option', { name: 'Shelter' }).click();
	await page.getByLabel('Weight (each)').fill('32');
	await page.getByRole('button', { name: 'Add to closet' }).click();
	await expect(page.getByText('2 lb')).toBeVisible();

	// Trip with that gear
	await page.getByRole('link', { name: 'Trips' }).click();
	await page.getByRole('link', { name: 'New trip' }).click();
	await page.getByLabel('Trip name').fill('Art Loeb');
	await page.getByLabel('Start date').fill('2026-08-26');
	await page.getByLabel('End date').fill('2026-08-28');
	await page.getByLabel('Emergency contact').fill('Sam 555-0100');
	await page.getByRole('button', { name: 'Create trip' }).click();
	await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
	const tripId = page.url().split('/').pop()!;

	await page.getByRole('tab', { name: 'Gear' }).click();
	await page.getByRole('button', { name: 'Add from closet' }).click();
	await page.getByRole('button', { name: /Tent/ }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('gear-Tent')).toBeVisible();

	// Make sure the service worker controls the page before going offline.
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();

	// --- Offline: cold reload is served by the service worker, data by IndexedDB
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();
	await expect(page.getByText('Offline: showing saved data')).toBeVisible();

	await page.getByRole('tab', { name: 'Overview' }).click();
	await expect(page.getByText('Sam 555-0100')).toBeVisible();

	await page.getByRole('tab', { name: 'Checklist' }).click();
	await page.getByTestId('checklist-permit').getByText('Done', { exact: true }).click();

	await page.getByRole('tab', { name: 'Gear' }).click();
	await page.getByRole('checkbox', { name: 'Packed Tent' }).click();

	await expect(page.getByTestId('sync-badge')).toContainText('2 pending');

	// Online-only actions are disabled
	await expect(page.getByRole('button', { name: 'Add from closet' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'New gear' })).toBeDisabled();

	// The print view works offline too
	await page.goto(`/trips/${tripId}/print`);
	await expect(page.getByRole('heading', { name: 'Pre-trip checklist' })).toBeVisible();
	await expect(page.getByText('[x]').first()).toBeVisible();
	await page.goBack();

	// --- Back online: the outbox drains
	await context.setOffline(false);
	await expect(page.getByTestId('sync-badge')).toContainText('Synced', { timeout: 15_000 });

	const token = await page.evaluate(() => localStorage.getItem('bckpack.token'));
	const res = await page.request.get(`/api/v1/trips/${tripId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const trip = await res.json();
	expect(trip.checklist_items.find((i: { item: string }) => i.item === 'permit').status).toBe(
		'done'
	);
	expect(trip.gear_list[0].packed).toBe(true);
});
