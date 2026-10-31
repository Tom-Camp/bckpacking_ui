import { expect, type Page } from '@playwright/test';
import { markVerified } from './db';

/** Registers through the UI, verifies the email in the database, signs in and lands on Trips. */
export async function registerAndSignIn(page: Page, username: string, password: string) {
	const email = `${username}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByText('Check your inbox')).toBeVisible();

	await markVerified(email);

	await page.getByRole('link', { name: 'Sign in' }).click();
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Trips' })).toBeVisible();
}
