import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

const { db, clearLocalData } = await import('$lib/data/db');
const { session } = await import('$lib/auth/session.svelte');
const { enqueuePatch } = await import('./outbox');
const { flush, pull } = await import('./engine');
const { trip } = await import('$lib/test/fixtures');
const { gearCategories } = await import('$lib/data/queries');

const json = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
	await clearLocalData();
	session.set('header.payload.sig');
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('enqueuePatch', () => {
	it('coalesces edits to the same resource and keeps others separate', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		await enqueuePatch('/api/v1/trips/t/gear/g', { packed: true }, 'Gear');
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { details: 'Picked up' }, 'Permit');

		const entries = await db.outbox.orderBy('seq').toArray();
		expect(entries).toHaveLength(2);
		expect(entries[0].body).toEqual({ status: 'done', details: 'Picked up' });
		expect(entries[1].path).toBe('/api/v1/trips/t/gear/g');
	});
});

describe('flush', () => {
	it('sends queued edits in order and empties the outbox', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		await enqueuePatch('/api/v1/trips/t/gear/g', { packed: true }, 'Gear');
		fetchMock.mockResolvedValue(json(200));

		expect(await flush()).toBe('done');
		expect(await db.outbox.count()).toBe(0);
		const [first, second] = fetchMock.mock.calls.map(([req]) => req as Request);
		expect(new URL(first.url).pathname).toBe('/api/v1/trips/t/checklist/permit');
		expect(first.method).toBe('PATCH');
		expect(first.headers.get('Authorization')).toBe('Bearer header.payload.sig');
		expect(await first.json()).toEqual({ status: 'done' });
		expect(new URL(second.url).pathname).toBe('/api/v1/trips/t/gear/g');
	});

	it('keeps edits queued when the network is down', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

		expect(await flush()).toBe('offline');
		const [entry] = await db.outbox.toArray();
		expect(entry.attempts).toBe(1);
	});

	it('keeps edits queued on server errors and auth failures', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		fetchMock.mockResolvedValueOnce(json(503)).mockResolvedValueOnce(json(401));

		expect(await flush()).toBe('server');
		expect(await flush()).toBe('auth');
		expect(await db.outbox.count()).toBe(1);
		expect(session.expired).toBe(true);
	});

	it('moves rejected edits to the failed list and carries on', async () => {
		await enqueuePatch('/api/v1/trips/gone/notes/n', { content: 'x' }, 'Note');
		await enqueuePatch('/api/v1/trips/t/gear/g', { packed: true }, 'Gear');
		fetchMock
			.mockResolvedValueOnce(json(404, { detail: 'Note not found' }))
			.mockResolvedValueOnce(json(200));

		expect(await flush()).toBe('done');
		expect(await db.outbox.count()).toBe(0);
		const [failed] = await db.failed.toArray();
		expect(failed.status).toBe(404);
		expect(failed.error).toBe('Note not found');
	});
});

describe('pull', () => {
	const categories = [{ value: 'shelter', label: 'Shelter (server)' }];

	function mockServer() {
		fetchMock.mockImplementation(async (req: Request) => {
			const path = new URL(req.url).pathname;
			if (path === '/api/v1/users/me') return json(200, { id: 'user-1', measurements: 'imperial' });
			if (path === '/api/v1/trips') return json(200, [trip({ id: 'server-trip' })]);
			if (path === '/api/v1/gear') return json(200, []);
			if (path === '/api/v1/gear/categories') return json(200, categories);
			return json(404);
		});
	}

	it('replaces the local cache with server data', async () => {
		await db.trips.put(trip({ id: 'deleted-elsewhere' }));
		mockServer();

		expect(await pull()).toBe(true);
		expect((await db.trips.toArray()).map((t) => t.id)).toEqual(['server-trip']);
		expect(await db.users.get('user-1')).toBeDefined();
		expect(await gearCategories()).toEqual(categories);
	});

	it('does not overwrite local edits that are still queued', async () => {
		await db.trips.put(trip({ id: 'local-trip' }));
		await enqueuePatch('/api/v1/trips/local-trip', { name: 'Renamed' }, 'Trip');
		mockServer();

		expect(await pull()).toBe(false);
		expect(await db.trips.get('local-trip')).toBeDefined();
	});
});
