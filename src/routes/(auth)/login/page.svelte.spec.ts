import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { session } from '$lib/auth/session.svelte';
import { db, GEAR_CATEGORIES_KEY, setMeta } from '$lib/data/db';
import { enqueuePatch } from '$lib/sync/outbox';
import { mockApi, respond } from '$lib/test/api';
import { gearItem, trip, user } from '$lib/test/fixtures';
import { setRoute } from '$lib/test/route';
import Page from './+page.svelte';

async function signIn(screen: Awaited<ReturnType<typeof render>>) {
	await screen.getByLabelText('Email').fill('hiker@example.com');
	await screen.getByLabelText('Password').fill('Ridge-Sunrise-Trailhead-2026!');
	await screen.getByRole('button', { name: 'Sign in' }).click();
}

describe('login page', () => {
	beforeEach(() => setRoute('/login'));

	it('signs in, caches the profile and goes to the trips list', async () => {
		const me = user();
		const requests = mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => me
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.poll(() => goto).toHaveBeenCalledWith('/');
		expect(requests[0].body).toEqual({
			email: 'hiker@example.com',
			password: 'Ridge-Sunrise-Trailhead-2026!'
		});
		expect(session.token).toBe('jwt-token');
		expect(await db.users.get(me.id)).toEqual(me);
	});

	it('shows the API’s error and stays on the page', async () => {
		mockApi({
			'POST /api/v1/auth/login': () => respond(401, { detail: 'Invalid email or password' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
		await expect.element(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
	});

	it('offers to resend the verification email when the account isn’t verified', async () => {
		const requests = mockApi({
			'POST /api/v1/auth/login': () => respond(403, { detail: 'Email not verified' }),
			'POST /api/v1/auth/resend-verification': () =>
				respond(202, { message: 'If that account needs verifying, we’ve sent a new link.' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Verify your email before signing in.');
		await screen.getByRole('button', { name: 'Resend verification email' }).click();

		await expect
			.element(screen.getByRole('status'))
			.toHaveTextContent('If that account needs verifying, we’ve sent a new link.');
		expect(requests[1]).toEqual({
			route: 'POST /api/v1/auth/resend-verification',
			body: { email: 'hiker@example.com' }
		});
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
	});

	it('shows other 403s as they are, without a resend button', async () => {
		mockApi({ 'POST /api/v1/auth/login': () => respond(403, { detail: 'Account suspended' }) });
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Account suspended');
		await expect
			.element(screen.getByRole('button', { name: 'Resend verification email' }))
			.not.toBeInTheDocument();
	});

	it('shows a friendly message for a rate limit without a JSON body', async () => {
		vi.stubGlobal(
			'fetch',
			async () => new Response('<html>429 Too Many Requests</html>', { status: 429 })
		);
		const screen = await render(Page);
		await signIn(screen);

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Too many requests, try again in a minute');
	});

	it('confirms a just-verified email', async () => {
		setRoute('/login?verified=1');
		const screen = await render(Page);

		await expect.element(screen.getByText('Email verified. Sign in to continue.')).toBeVisible();
	});

	it('shows no verified notice by default', async () => {
		const screen = await render(Page);

		await expect
			.element(screen.getByText('Email verified.', { exact: false }))
			.not.toBeInTheDocument();
	});

	it('signs back out and leaves cached data alone when the profile request fails', async () => {
		const previous = user({ id: 'previous-user' });
		await db.users.put(previous);
		await db.outbox.add({
			method: 'PATCH',
			path: '/api/v1/trips/1',
			body: { name: 'Renamed' },
			label: 'Rename trip',
			createdAt: 1,
			attempts: 0
		});
		mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => respond(503, { detail: 'Service unavailable' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(goto).not.toHaveBeenCalled();
		expect(session.signedIn).toBe(false);
		expect(await db.users.toArray()).toEqual([previous]);
		expect(await db.outbox.count()).toBe(1);
	});

	it('keeps the previous expired session when the profile request fails', async () => {
		session.set('old-token');
		session.markRejected();
		mockApi({
			'POST /api/v1/auth/login': () => ({ access_token: 'jwt-token', token_type: 'bearer' }),
			'GET /api/v1/users/me': () => respond(503, { detail: 'Service unavailable' })
		});
		const screen = await render(Page);
		await signIn(screen);

		await expect.element(screen.getByRole('alert')).toBeVisible();
		expect(session.token).toBe('old-token');
		expect(session.expired).toBe(true);
	});

	describe('with data already on the device', () => {
		function mockSignIn(me: ReturnType<typeof user>) {
			mockApi({
				'POST /api/v1/auth/login': () => ({ access_token: 'new-token', token_type: 'bearer' }),
				'GET /api/v1/users/me': () => me
			});
		}

		it('wipes everything when a different user signs in', async () => {
			await db.users.put(user({ id: 'user-a' }));
			await db.trips.put(trip({ user_id: 'user-a' }));
			await db.gearItems.put(gearItem());
			await enqueuePatch('/api/v1/trips/trip-1', { name: 'Edited offline' }, 'Trip details');
			await db.failed.add({
				method: 'PATCH',
				path: '/api/v1/trips/trip-1',
				body: { name: 'Lost' },
				label: 'Trip details',
				createdAt: 1,
				attempts: 1,
				status: 404,
				error: 'Not found',
				failedAt: 2
			});
			await setMeta(GEAR_CATEGORIES_KEY, []);
			const userB = user({ id: 'user-b', email: 'other@example.com' });
			mockSignIn(userB);

			const screen = await render(Page);
			await signIn(screen);
			await expect.poll(() => goto).toHaveBeenCalledWith('/');

			expect(await db.users.toArray()).toEqual([userB]);
			for (const table of db.tables.filter((t) => t.name !== 'users')) {
				expect(await table.count(), table.name).toBe(0);
			}
			expect(session.token).toBe('new-token');
		});

		it('keeps cached data and queued edits when the same user signs back in', async () => {
			await db.users.put(user({ id: 'user-a', first_name: 'Stale' }));
			const cachedTrip = trip({ user_id: 'user-a' });
			await db.trips.put(cachedTrip);
			await enqueuePatch('/api/v1/trips/trip-1', { name: 'Edited offline' }, 'Trip details');
			session.set('old-token');
			session.markRejected();
			const userA = user({ id: 'user-a', first_name: 'Fresh' });
			mockSignIn(userA);

			const screen = await render(Page);
			await signIn(screen);
			await expect.poll(() => goto).toHaveBeenCalledWith('/');

			expect(await db.trips.toArray()).toEqual([cachedTrip]);
			const outbox = await db.outbox.toArray();
			expect(outbox).toHaveLength(1);
			expect(outbox[0]).toMatchObject({
				method: 'PATCH',
				path: '/api/v1/trips/trip-1',
				body: { name: 'Edited offline' }
			});
			expect(await db.users.toArray()).toEqual([userA]);
			expect(session.token).toBe('new-token');
			expect(session.expired).toBe(false);
		});

		it('keeps data when no user is cached', async () => {
			const strayTrip = trip();
			await db.trips.put(strayTrip);
			mockSignIn(user({ id: 'user-b' }));

			const screen = await render(Page);
			await signIn(screen);
			await expect.poll(() => goto).toHaveBeenCalledWith('/');

			expect(await db.trips.toArray()).toEqual([strayTrip]);
		});
	});

	it('links to registration', async () => {
		const screen = await render(Page);
		await expect
			.element(screen.getByRole('link', { name: 'Create an account' }))
			.toHaveAttribute('href', '/register');
	});
});
