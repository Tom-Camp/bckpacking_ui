import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

const { db, clearLocalData, getMeta } = await import('$lib/data/db');
const { session } = await import('$lib/auth/session.svelte');
const { bumpLocalVersion, enqueuePatch } = await import('./outbox');
const { flush, pull, sync } = await import('./engine');
const { syncStatus } = await import('./status.svelte');
const { trip } = await import('$lib/test/fixtures');
const { gearCategories } = await import('$lib/data/queries');

const json = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: Mock<(req: Request) => Promise<Response>>;

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

	it('starts a new entry when the last one for the path is on the wire', async () => {
		const path = '/api/v1/trips/t/checklist/permit';
		await enqueuePatch(path, { status: 'done' }, 'Permit');
		const bodies: unknown[] = [];
		fetchMock.mockImplementation(async (req: Request) => {
			bodies.push(await req.json());
			if (bodies.length === 1) await enqueuePatch(path, { details: 'Picked up' }, 'Permit');
			return json(200);
		});

		expect(await flush()).toBe('done');
		expect(bodies).toEqual([{ status: 'done' }, { details: 'Picked up' }]);
		expect(await db.outbox.count()).toBe(0);
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
		expect(session.rejected).toBe(true);
		expect(session.expired).toBe(true);
	});

	it.each([408, 429])('keeps edits queued on %i, like a server error', async (status) => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		fetchMock.mockResolvedValueOnce(json(status));

		expect(await flush()).toBe('server');
		const [entry] = await db.outbox.toArray();
		expect(entry).toMatchObject({ attempts: 1, lastError: `HTTP ${status}` });
		expect(await db.failed.count()).toBe(0);
	});

	it('keeps edits queued while the account is suspended (403)', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		await enqueuePatch('/api/v1/trips/t/gear/g', { packed: true }, 'Gear');
		fetchMock.mockResolvedValue(json(403, { detail: 'Account suspended' }));

		expect(await flush()).toBe('suspended');
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(await db.outbox.count()).toBe(2);
		expect(await db.failed.count()).toBe(0);
		expect(session.expired).toBe(false);
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

	it('writes nothing if an online-only action lands while fetching', async () => {
		await db.trips.put(trip({ id: 'just-created' }));
		mockServer();
		const serve = fetchMock.getMockImplementation()!;
		fetchMock.mockImplementation(async (req: Request) => {
			if (new URL(req.url).pathname === '/api/v1/trips') bumpLocalVersion();
			return serve(req);
		});

		expect(await pull()).toBe(false);
		expect((await db.trips.toArray()).map((t) => t.id)).toEqual(['just-created']);
		expect(await db.users.count()).toBe(0);
		expect(await getMeta('lastSyncedAt')).toBeUndefined();
	});
});

describe('sync', () => {
	/** A server with nothing on it that counts sync passes (one `GET /users/me` each). */
	function mockServer(onTrips: () => void = () => {}) {
		const passes = { count: 0 };
		fetchMock.mockImplementation(async (req: Request) => {
			const path = new URL(req.url).pathname;
			if (path === '/api/v1/users/me') {
				passes.count++;
				return json(200, { id: 'user-1', measurements: 'imperial' });
			}
			if (path === '/api/v1/trips') {
				onTrips();
				return json(200, []);
			}
			return json(200, []);
		});
		return passes;
	}

	beforeEach(() => {
		syncStatus.blocked = null;
	});

	it('coalesces concurrent calls into one extra pass', async () => {
		const passes = mockServer();

		await Promise.all([sync(), sync(), sync()]);

		expect(passes.count).toBe(2);
	});

	it('runs again when the pull was skipped for a local write', async () => {
		let bumped = false;
		const passes = mockServer(() => {
			if (!bumped) bumpLocalVersion();
			bumped = true;
		});

		await sync();

		expect(passes.count).toBe(2);
		expect(await getMeta('lastSyncedAt')).toBeDefined();
	});

	it('sends nothing while the session is expired', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		session.markRejected();

		await sync();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(syncStatus.blocked).toBe('auth');
		expect(await db.outbox.count()).toBe(1);
	});

	it('reports a suspended account from the flush or the pull', async () => {
		await enqueuePatch('/api/v1/trips/t/checklist/permit', { status: 'done' }, 'Permit');
		fetchMock.mockImplementation(async () => json(403, { detail: 'Account suspended' }));
		await sync();
		expect(syncStatus.blocked).toBe('suspended');

		await db.outbox.clear();
		syncStatus.blocked = null;
		await sync();
		expect(syncStatus.blocked).toBe('suspended');
	});
});
