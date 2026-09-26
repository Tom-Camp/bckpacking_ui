import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '$lib/test/render';
import ConfirmDelete from './ConfirmDelete.svelte';

const children = createRawSnippet(() => ({ render: () => '<span>x</span>' }));

async function setup(onconfirm: () => Promise<unknown>) {
	const screen = await renderApp(ConfirmDelete, {
		title: 'Delete Tent?',
		description: 'It stays in your gear closet.',
		confirmLabel: 'Remove',
		label: 'Remove Tent',
		onconfirm,
		children
	});
	await screen.getByRole('button', { name: 'Remove Tent' }).click();
	return screen;
}

describe('ConfirmDelete', () => {
	it('asks before running the action', async () => {
		const onconfirm = vi.fn(async () => {});
		const screen = await setup(onconfirm);

		await expect.element(screen.getByRole('alertdialog')).toHaveTextContent('Delete Tent?');
		await expect.element(screen.getByText('It stays in your gear closet.')).toBeVisible();
		expect(onconfirm).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: 'Remove', exact: true }).click();
		expect(onconfirm).toHaveBeenCalledOnce();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
	});

	it('does nothing when cancelled', async () => {
		const onconfirm = vi.fn(async () => {});
		const screen = await setup(onconfirm);

		await screen.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(onconfirm).not.toHaveBeenCalled();
	});

	it('stays open when the action fails', async () => {
		const screen = await setup(async () => {
			throw new Error('Server error');
		});

		await screen.getByRole('button', { name: 'Remove', exact: true }).click();
		await expect.element(screen.getByRole('alertdialog')).toBeVisible();
	});
});
