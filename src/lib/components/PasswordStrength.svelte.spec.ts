import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PasswordStrength from './PasswordStrength.svelte';

describe('PasswordStrength', () => {
	it('shows nothing for an empty password', async () => {
		const screen = await render(PasswordStrength, { password: '' });
		expect(screen.container.textContent?.trim()).toBe('');
	});

	it('warns about a weak password with zxcvbn feedback', async () => {
		const screen = await render(PasswordStrength, { password: 'password123' });
		await expect.element(screen.getByText(/Very weak — /)).toBeVisible();
	});

	it('accepts a strong passphrase', async () => {
		const props = $state({ password: 'correct horse battery staple trailhead', strength: null });
		const screen = await render(PasswordStrength, props);
		await expect.element(screen.getByText('Very strong')).toBeVisible();
		expect(props.strength).toMatchObject({ ok: true, score: 4 });
	});
});
