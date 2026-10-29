/**
 * The value, if it's an absolute http(s) URL, else null. Bind `href`s to this, never to raw
 * user data: the API checks `map_link` now, but old data and queued offline edits skip that.
 */
export function safeHttpUrl(value: string | null): string | null {
	if (!value) return null;
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:' ? value : null;
	} catch {
		return null;
	}
}
