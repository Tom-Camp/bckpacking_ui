import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { G_PER_OZ } from '$lib/domain/units';
import UnitInput from './UnitInput.svelte';

describe('UnitInput', () => {
	it('shows the canonical value in the user’s unit', async () => {
		const screen = await render(UnitInput, {
			value: 10 * G_PER_OZ,
			measure: 'gear-weight',
			units: 'imperial'
		});
		await expect.element(screen.getByRole('spinbutton')).toHaveValue(10);
		await expect.element(screen.getByText('oz')).toBeVisible();
	});

	it('converts typed values back to the canonical unit', async () => {
		const props = $state({
			value: null as number | null | undefined,
			measure: 'body-weight' as const,
			units: 'metric' as const
		});
		const screen = await render(UnitInput, props);
		await expect.element(screen.getByText('kg')).toBeVisible();

		await screen.getByRole('spinbutton').fill('72.5');
		expect(props.value).toBe(72_500);
	});

	it('re-displays the value when the unit system changes', async () => {
		const props = $state({
			value: 1000,
			measure: 'distance' as const,
			units: 'metric' as 'metric' | 'imperial'
		});
		const screen = await render(UnitInput, props);
		await expect.element(screen.getByRole('spinbutton')).toHaveValue(1);

		props.units = 'imperial';
		await expect.element(screen.getByText('mi')).toBeVisible();
		await expect.element(screen.getByRole('spinbutton')).toHaveValue(0.6);
	});
});
