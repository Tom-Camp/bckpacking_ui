import { describe, expect, it } from 'vitest';
import { trip } from '$lib/test/fixtures';
import { renderApp } from '$lib/test/render';
import Overview from './Overview.svelte';

const detail = (screen: Awaited<ReturnType<typeof renderApp>>, label: string) =>
	screen.getByText(label, { exact: true }).element().nextElementSibling;

describe('Overview', () => {
	it('shows the trip details in the user’s units', async () => {
		const t = trip({
			trip_type: 'point-to-point',
			start_trailhead: 'Davidson River',
			end_trailhead: 'Camp Daniel Boone',
			total_distance_m: 30_000,
			elevation_gain_m: 2_000,
			water_carry_l: 2,
			map_link: 'https://example.com/map',
			emergency_contact: 'Sam 555-0100',
			description: 'Ridge walk'
		});
		const screen = await renderApp(Overview, { trip: t });

		await expect.element(screen.getByText('Sam 555-0100')).toBeVisible();
		expect(detail(screen, 'Dates')).toHaveTextContent('Aug 26 – Aug 28, 2026 (3 days)');
		expect(detail(screen, 'Type')).toHaveTextContent('Point to point');
		expect(detail(screen, 'Area')).toHaveTextContent('Pisgah');
		expect(detail(screen, 'Start trailhead')).toHaveTextContent('Davidson River');
		expect(detail(screen, 'End trailhead')).toHaveTextContent('Camp Daniel Boone');
		expect(detail(screen, 'Distance')).toHaveTextContent('18.6 mi');
		expect(detail(screen, 'Elevation gain')).toHaveTextContent('6,562 ft');
		expect(detail(screen, 'Water carry')).toHaveTextContent('2 L');
		await expect
			.element(screen.getByRole('link', { name: 'Open map' }))
			.toHaveAttribute('href', 'https://example.com/map');
		await expect.element(screen.getByText('Ridge walk')).toBeVisible();
	});

	it('leaves out what the trip doesn’t have', async () => {
		const t = trip({ trip_type: 'loop', area: null, start_date: null, end_date: null });
		const screen = await renderApp(Overview, { trip: t });

		await expect.element(screen.getByText('Type', { exact: true })).toBeVisible();
		for (const label of [
			'Dates',
			'Area',
			'Trailhead',
			'End trailhead',
			'Distance',
			'Emergency contact'
		])
			await expect.element(screen.getByText(label, { exact: true })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('link', { name: 'Open map' })).not.toBeInTheDocument();
	});

	it('includes the pack weight and notes', async () => {
		const screen = await renderApp(Overview, { trip: trip() });
		await expect.element(screen.getByText('Pack weight')).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: 'Notes' })).toBeVisible();
	});
});
