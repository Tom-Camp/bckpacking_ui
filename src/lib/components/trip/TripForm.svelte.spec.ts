import { describe, expect, it, vi } from 'vitest';
import type { TripCreate } from '$lib/api/types';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import TripForm from './TripForm.svelte';

describe('TripForm', () => {
	it('submits a normalised trip in API units', async () => {
		const onsubmit = vi.fn(async (_body: TripCreate) => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });

		await screen.getByLabelText('Trip name').fill('  Art Loeb ');
		await screen.getByLabelText('Area').fill('Pisgah');
		await screen.getByLabelText('Start date').fill('2026-08-26');
		await screen.getByLabelText('End date').fill('2026-08-28');
		await screen.getByLabelText('Trailhead').fill('Davidson River');
		await screen.getByLabelText('Distance').fill('30');
		await screen.getByLabelText('Water carry').fill('2');
		await screen.getByLabelText('Emergency contact').fill('Sam 555-0100');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		expect(onsubmit).toHaveBeenCalledOnce();
		const body = onsubmit.mock.calls[0][0];
		expect(body).toMatchObject({
			name: 'Art Loeb',
			description: null,
			area: 'Pisgah',
			trip_type: 'loop',
			start_date: '2026-08-26',
			end_date: '2026-08-28',
			start_trailhead: 'Davidson River',
			end_trailhead: null,
			elevation_gain_m: null,
			water_carry_l: 2,
			map_link: null,
			emergency_contact: 'Sam 555-0100'
		});
		expect(body.total_distance_m).toBeCloseTo(30 * 1609.344);
	});

	it('asks for an end trailhead only on point-to-point trips', async () => {
		const onsubmit = vi.fn(async (_body: TripCreate) => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await expect.element(screen.getByLabelText('End trailhead')).not.toBeInTheDocument();

		await screen.getByText('Loop').click();
		await screen.getByRole('option', { name: 'Point to point' }).click();
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByLabelText('Start trailhead').fill('Davidson River');
		await screen.getByLabelText('End trailhead').fill('Camp Daniel Boone');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		expect(onsubmit.mock.calls[0][0]).toMatchObject({
			trip_type: 'point-to-point',
			start_trailhead: 'Davidson River',
			end_trailhead: 'Camp Daniel Boone'
		});
	});

	it('won’t save a blank name', async () => {
		const onsubmit = vi.fn(async () => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await screen.getByLabelText('Trip name').fill('   ');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent("Name can't be blank.");
		expect(onsubmit).not.toHaveBeenCalled();
	});

	it('rejects an end date before the start date', async () => {
		const onsubmit = vi.fn(async () => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByLabelText('Start date').fill('2026-08-28');
		// `min` would block the browser's own validation; bypass it to reach the form's check.
		(screen.getByLabelText('End date').element() as HTMLInputElement).removeAttribute('min');
		await screen.getByLabelText('End date').fill('2026-08-26');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('End date must be on or after the start date.');
		expect(onsubmit).not.toHaveBeenCalled();
	});

	it('rejects a map link that isn’t http(s)', async () => {
		const onsubmit = vi.fn(async () => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByLabelText('Map link').fill('ftp://example.com/map');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Map link must start with http:// or https://');
		expect(onsubmit).not.toHaveBeenCalled();
	});

	it('rejects a map link the API would, even though the browser can parse it', async () => {
		const onsubmit = vi.fn(async (_body: TripCreate) => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByLabelText('Map link').fill('https:example.com');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Map link must start with http:// or https://');
		expect(onsubmit).not.toHaveBeenCalled();
	});

	it('submits a trimmed https map link', async () => {
		const onsubmit = vi.fn(async (_body: TripCreate) => {});
		const screen = await renderApp(TripForm, { submitLabel: 'Create trip', onsubmit });
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByLabelText('Map link').fill(' https://caltopo.com/m/abc ');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		expect(onsubmit.mock.calls[0][0].map_link).toBe('https://caltopo.com/m/abc');
	});

	it('shows an error from saving', async () => {
		const screen = await renderApp(TripForm, {
			submitLabel: 'Create trip',
			onsubmit: async () => {
				throw new Error('This action needs a connection.');
			}
		});
		await screen.getByLabelText('Trip name').fill('Art Loeb');
		await screen.getByRole('button', { name: 'Create trip' }).click();

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('This action needs a connection.');
		await expect.element(screen.getByRole('button', { name: 'Create trip' })).toBeEnabled();
	});

	it('starts from an existing trip and can be cancelled', async () => {
		const oncancel = vi.fn();
		const screen = await renderApp(
			TripForm,
			{
				trip: trip({ name: 'Art Loeb', total_distance_m: 10_000 }),
				submitLabel: 'Save',
				onsubmit: async () => {},
				oncancel
			},
			{ units: 'metric' }
		);

		await expect.element(screen.getByLabelText('Trip name')).toHaveValue('Art Loeb');
		await expect.element(screen.getByLabelText('Start trailhead')).toBeVisible();
		await expect.element(screen.getByLabelText('Distance')).toHaveValue(10);
		await screen.getByRole('button', { name: 'Cancel' }).click();
		expect(oncancel).toHaveBeenCalledOnce();
	});
});
