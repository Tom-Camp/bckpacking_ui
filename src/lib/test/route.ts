import { page } from '$app/state';

/** Points the mocked `$app/state` page at a URL (see setup-client.ts). */
export function setRoute(path: string, params: Record<string, string> = {}) {
	Object.assign(page, { url: new URL(path, 'http://localhost/'), params });
}
