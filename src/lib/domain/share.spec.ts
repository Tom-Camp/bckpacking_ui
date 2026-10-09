import { describe, expect, it } from 'vitest';
import { shareUrl } from './share';

describe('shareUrl', () => {
	it('puts the token in the fragment, not the path', () => {
		const url = new URL(shareUrl('https://bckpack.ing', 'abc'));
		expect(url.toString()).toBe('https://bckpack.ing/shared#abc');
		expect(url.pathname).toBe('/shared');
		expect(url.hash).toBe('#abc');
	});
});
