import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Layout from './+layout.svelte';

describe('auth layout', () => {
	it('frames the page with a link home', async () => {
		const children = createRawSnippet(() => ({ render: () => '<p>Sign in form</p>' }));
		const screen = await render(Layout, { children });

		await expect.element(screen.getByText('Sign in form')).toBeVisible();
		await expect
			.element(screen.getByRole('link', { name: 'bckpack.ing' }))
			.toHaveAttribute('href', '/');
	});
});
