/**
 * The value, if it's an absolute http(s) URL, else null. Bind `href`s to this, never to raw
 * user data: the API checks `map_link` now, but old data and queued offline edits skip that.
 */
export function safeHttpUrl(value: string | null): string | null {
	if (!value) return null;
	// `URL` also reads `https:example.com`, `https:///example.com` and `http:\\example.com` as
	// `https://example.com/`, but the API (`urlsplit`) finds no host in them and returns 422.
	if (!/^https?:\/\/(?![/\\])/i.test(value.trim())) return null;
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:' ? value : null;
	} catch {
		return null;
	}
}
