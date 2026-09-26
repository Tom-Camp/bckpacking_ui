// Setup for component tests (the `client` Vitest project, running in Chromium).
//
// Components read and write the real IndexedDB, which is wiped before each test. What leaves
// the browser is replaced: the sync engine (no background requests), SvelteKit's router, and
// `fetch` (see `mockApi` in ./api.ts).

import '../../routes/layout.css';
import { afterEach, beforeEach, vi } from 'vitest';
import { session } from '$lib/auth/session.svelte';
import { clearLocalData } from '$lib/data/db';
import { syncStatus } from '$lib/sync/status.svelte';

vi.mock('$lib/sync/engine', () => ({
	sync: vi.fn(async () => {}),
	startSync: vi.fn(() => () => {})
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(async () => {}),
	replaceState: vi.fn()
}));

// Tests set `page.params` / `page.url` before rendering a route.
vi.mock('$app/state', () => ({
	page: { params: {} as Record<string, string>, url: new URL('http://localhost/') }
}));

beforeEach(async () => {
	await clearLocalData();
	localStorage.clear();
	session.clear();
	Object.assign(syncStatus, {
		online: true,
		syncing: false,
		pending: 0,
		failed: 0,
		lastSyncedAt: null,
		blocked: null
	});
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});
