import { expect, test } from '@playwright/test';

// Needs the API running on localhost:8000 (the preview server proxies /api to it).

test('a share link shows the chosen sections to a signed-out viewer until it is revoked', async ({
	page,
	browser
}) => {
	const stamp = Date.now();

	await page.goto('/register');
	await page.getByLabel('Username').fill(`share_${stamp}`);
	await page.getByLabel('Email').fill(`share_${stamp}@example.com`);
	await page.getByLabel('Password').fill('Ridge-Sunrise-Trailhead-2026!');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Trips' })).toBeVisible();

	await page.getByRole('link', { name: 'Gear closet' }).click();
	await page.getByRole('button', { name: 'New gear' }).click();
	await page.getByLabel('Name').fill('Tent');
	await page.getByLabel('Category').click();
	await page.getByRole('option', { name: 'Shelter' }).click();
	await page.getByLabel('Weight (each)').fill('32');
	await page.getByRole('button', { name: 'Add to closet' }).click();
	await expect(page.getByText('2 lb')).toBeVisible();

	await page.getByRole('link', { name: 'Trips' }).click();
	await page.getByRole('link', { name: 'New trip' }).click();
	await page.getByLabel('Trip name').fill('Art Loeb');
	await page.getByLabel('Emergency contact').fill('Sam 555-0100');
	await page.getByRole('button', { name: 'Create trip' }).click();
	await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);

	await page.getByRole('tab', { name: 'Gear' }).click();
	await page.getByRole('button', { name: 'Add from closet' }).click();
	await page.getByRole('button', { name: /Tent/ }).click();
	await page.keyboard.press('Escape');

	// Share with the gear list only.
	await page.getByRole('button', { name: 'Share' }).click();
	await page.getByRole('button', { name: 'Create link' }).click();
	const link = page.getByLabel('Share link');
	await expect(link).toHaveValue(/\/shared#.+/);
	const url = await link.inputValue();
	// The toggle is an offline-capable edit: wait for sync to send it.
	const synced = page.waitForResponse(
		(r) => r.request().method() === 'PATCH' && /\/api\/v1\/trips\/[^/]+$/.test(r.url()) && r.ok()
	);
	await page.getByRole('checkbox', { name: 'Gear list' }).click();
	await synced;

	// A viewer with no session or cached data.
	const viewer = await browser.newContext();
	const shared = await viewer.newPage();
	await shared.goto(url);
	await expect(shared.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();
	await expect(shared.getByText('Tent')).toBeVisible();
	await expect(shared.getByText('Sam 555-0100')).toHaveCount(0);

	// Revoke; the link stops working.
	await page.getByRole('button', { name: 'Stop sharing' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Stop sharing' }).click();
	await expect(link).toHaveCount(0);

	await shared.reload();
	await expect(shared.getByText(/This link is no longer valid/)).toBeVisible();
	await viewer.close();
});
