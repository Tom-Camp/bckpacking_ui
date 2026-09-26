import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormError from './FormError.svelte';

describe('FormError', () => {
	it('shows the message as an alert', async () => {
		const screen = await render(FormError, { message: 'Email already registered' });
		await expect.element(screen.getByRole('alert')).toHaveTextContent('Email already registered');
	});

	it('renders nothing without a message', async () => {
		const screen = await render(FormError, { message: null });
		expect(screen.container.querySelector('[role="alert"]')).toBeNull();
	});
});
