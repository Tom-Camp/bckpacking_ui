import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SharedTrip } from '$lib/api/types';
import { session } from '$lib/auth/session.svelte';
import { db } from '$lib/data/db';
import { mockApi, respond } from '$lib/test/api';
import { setRoute } from '$lib/test/route';
import Page from './+page.svelte';

const ROUTE = 'GET /api/v1/shared/trip';

function sharedTrip(overrides: Partial<SharedTrip> = {}): SharedTrip {
	return {
		name: 'Art Loeb',
		description: 'Ridge walk',
		area: 'Pisgah',
		trip_type: 'point-to-point',
		start_date: '2026-08-26',
		end_date: '2026-08-28',
		start_trailhead: 'Davidson River',
		end_trailhead: 'Daniel Boone',
		total_distance_m: 48280,
		elevation_gain_m: null,
		water_carry_l: 2,
		map_link: null,
		owner: { username: 'hiker' },
		gear_list: null,
		food_plan: null,
		checklist_items: null,
		emergency_contact: null,
		checklist_ready: null,
		...overrides
	};
}

const everySection: Partial<SharedTrip> = {
	emergency_contact: 'Sam 555-0100',
	gear_list: [
		{
			gear_item: {
				name: 'Tent',
				category: 'shelter',
				category_label: 'Shelter',
				weight_g: 1000,
				kind: 'base'
			},
			quantity: 1,
			packed: true
		},
		{
			gear_item: {
				name: 'Rain jacket',
				category: 'clothing',
				category_label: 'Clothing',
				weight_g: 300,
				kind: 'worn'
			},
			quantity: 1,
			packed: false
		}
	],
	food_plan: {
		target_kcal_per_day: 2700,
		target_food_g_per_day: 794,
		food: [{ day: 1, name: 'Oats', meal_type: 'breakfast', servings: 1, weight_g: 100, kcal: 400 }]
	},
	checklist_items: [
		{ item: 'shuttle_scheduled', status: 'todo' },
		{ item: 'permit', status: 'done' }
	],
	checklist_ready: false
};

async function renderShared(trip: SharedTrip, hash = '#tok') {
	setRoute(`/shared${hash}`);
	const headers: Headers[] = [];
	const requests = mockApi({
		[ROUTE]: (_body, request) => {
			headers.push(request.headers);
			return trip;
		}
	});
	const screen = await render(Page);
	return { screen, requests, headers };
}

describe('shared trip page', () => {
	it('sends the token in a header and never the session’s JWT', async () => {
		session.set('owner-jwt');
		const { screen, headers } = await renderShared(sharedTrip());

		await expect.element(screen.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();
		expect(headers).toHaveLength(1);
		expect(headers[0].get('X-Share-Token')).toBe('tok');
		expect(headers[0].has('Authorization')).toBe(false);
	});

	it('shows core details only when no section is shared, and caches nothing', async () => {
		const { screen } = await renderShared(sharedTrip());

		await expect.element(screen.getByText('Shared by hiker')).toBeVisible();
		await expect.element(screen.getByText('Davidson River')).toBeVisible();
		await expect.element(screen.getByText('Ridge walk')).toBeVisible();
		for (const name of ['Emergency contact', 'Checklist', 'Gear', 'Food'])
			await expect.element(screen.getByRole('heading', { name })).not.toBeInTheDocument();
		expect(await db.trips.count()).toBe(0);
	});

	it('shows every shared section', async () => {
		const { screen } = await renderShared(sharedTrip(everySection));

		await expect.element(screen.getByText('Sam 555-0100')).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: 'Shelter' })).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: 'Clothing' })).toBeVisible();
		await expect.element(screen.getByText('Rain jacket')).toBeVisible();
		await expect.element(screen.getByText(/Base 2\.2 lb/)).toBeVisible();
		await expect.element(screen.getByText(/Worn 10\.6 oz/)).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: /^Day 1/ })).toBeVisible();
		await expect.element(screen.getByText('Oats')).toBeVisible();
		await expect
			.element(screen.getByRole('heading', { name: /Checklist · 1 to do/ }))
			.toBeVisible();
		await expect.element(screen.getByText('Permit')).toBeVisible();
		await expect.element(screen.getByText('Done')).toBeVisible();
		expect(await db.trips.count()).toBe(0);
	});

	it('says when a shared section is empty', async () => {
		const { screen } = await renderShared(
			sharedTrip({ gear_list: [], checklist_items: [], checklist_ready: true })
		);

		await expect.element(screen.getByRole('heading', { name: 'Gear' })).toBeVisible();
		await expect.element(screen.getByText('Nothing added yet.').first()).toBeVisible();
		expect(screen.getByText('Nothing added yet.').elements()).toHaveLength(2);
	});

	it('refetches when the tab comes back, picking up newly shared sections', async () => {
		const { screen } = await renderShared(sharedTrip());
		await expect.element(screen.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();

		const requests = mockApi({ [ROUTE]: () => sharedTrip({ emergency_contact: 'Sam 555-0100' }) });
		document.dispatchEvent(new Event('visibilitychange'));

		await expect.element(screen.getByText('Sam 555-0100')).toBeVisible();
		expect(requests).toHaveLength(1);
	});

	it('keeps the trip on screen when a refresh finds no connection', async () => {
		const { screen } = await renderShared(sharedTrip());
		await expect.element(screen.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();

		vi.stubGlobal('fetch', async () => {
			throw new TypeError('Failed to fetch');
		});
		window.dispatchEvent(new Event('focus'));

		await new Promise((r) => setTimeout(r, 50));
		await expect.element(screen.getByRole('heading', { name: 'Art Loeb' })).toBeVisible();
	});

	it('says when the link has been revoked', async () => {
		setRoute('/shared#gone');
		mockApi({ [ROUTE]: () => respond(404, { detail: 'Not found' }) });
		const screen = await render(Page);

		await expect.element(screen.getByText(/This link is no longer valid/)).toBeVisible();
	});

	it('makes no request when the link has no token', async () => {
		const { screen, requests } = await renderShared(sharedTrip(), '');

		await expect
			.element(screen.getByRole('heading', { name: 'This link isn’t complete' }))
			.toBeVisible();
		expect(requests).toEqual([]);
	});

	it('switches units and remembers the choice', async () => {
		const { screen } = await renderShared(sharedTrip());

		await expect.element(screen.getByText('30 mi')).toBeVisible();
		await screen.getByRole('radio', { name: 'Metric' }).click();
		await expect.element(screen.getByText('48.3 km')).toBeVisible();
		expect(localStorage.getItem('shared-units')).toBe('metric');
	});
});
