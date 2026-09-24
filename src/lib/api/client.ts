import createClient from 'openapi-fetch';
import { session } from '$lib/auth/session.svelte';
import type { paths } from './schema';

const origin = () => globalThis.location?.origin ?? 'http://localhost';

/** Absolute URL for an API path (the API is same-origin: Vite proxy in dev, reverse proxy in prod). */
export function apiUrl(path: string): string {
	return new URL(path, origin()).toString();
}

/** fetch that adds the bearer token and flags the session when the API rejects it. */
export async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const request = new Request(input, init);
	const token = session.token;
	if (token) request.headers.set('Authorization', `Bearer ${token}`);
	const response = await fetch(request);
	if (response.status === 401 && token) session.markRejected();
	return response;
}

export const api = createClient<paths>({
	baseUrl: origin(),
	fetch: (request) => authedFetch(request)
});

export class ApiError extends Error {
	constructor(
		public status: number,
		public detail: unknown
	) {
		super(describeDetail(detail) ?? `Request failed (${status})`);
	}
}

/** Thrown by online-only actions when there is no connection. */
export class OfflineError extends Error {
	constructor() {
		super('This action needs a connection.');
	}
}

/** Turns FastAPI's `detail` (string or validation array) into a readable message. */
export function describeDetail(detail: unknown): string | undefined {
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail)) {
		return detail
			.map((d) => {
				const field = Array.isArray(d?.loc)
					? d.loc.filter((p: unknown) => p !== 'body').join('.')
					: '';
				return field ? `${field}: ${d.msg}` : d?.msg;
			})
			.filter(Boolean)
			.join('; ');
	}
	return undefined;
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Returns `data` or throws an ApiError carrying the API's `detail`. */
export function unwrap<T>(result: Result<T>): T {
	if (result.error !== undefined || !result.response.ok) {
		const detail = (result.error as { detail?: unknown } | undefined)?.detail;
		throw new ApiError(result.response.status, detail);
	}
	return result.data as T;
}

/** Wraps network failures (fetch TypeError) as OfflineError. */
export async function call<T>(request: () => Promise<Result<T>>): Promise<T> {
	let result: Result<T>;
	try {
		result = await request();
	} catch (e) {
		if (e instanceof TypeError) throw new OfflineError();
		throw e;
	}
	return unwrap(result);
}
