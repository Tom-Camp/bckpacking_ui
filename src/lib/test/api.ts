import { vi } from 'vitest';

type Handler = (body: unknown, request: Request) => unknown;

/** A handler's return value becomes a JSON 200 response; return `respond(...)` for others. */
export class Respond {
	constructor(
		public status: number,
		public body: unknown = {}
	) {}
}

export const respond = (status: number, body: unknown = {}) => new Respond(status, body);

/**
 * Replaces `fetch` with a fake API. Routes are `'METHOD /path'`; anything unmatched fails the
 * request with 404 so a missing route shows up as an error in the test. Returns the requests
 * made, in order, with their parsed JSON bodies.
 */
export function mockApi(routes: Record<string, Handler>) {
	const requests: { route: string; body: unknown }[] = [];
	vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		const route = `${request.method} ${new URL(request.url).pathname}`;
		const text = await request.text();
		const body = text ? JSON.parse(text) : undefined;
		requests.push({ route, body });
		const handler = routes[route];
		const result = handler
			? await handler(body, request)
			: respond(404, { detail: `No mock for ${route}` });
		const response = result instanceof Respond ? result : respond(200, result);
		const { status } = response;
		return new Response(status === 204 ? null : JSON.stringify(response.body), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	return requests;
}
