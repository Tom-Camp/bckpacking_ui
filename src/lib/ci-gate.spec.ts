import { describe, expect, it } from 'vitest';

// Intentionally failing test for #30: proves the required status checks block merging.
// This branch must never be merged.
describe('CI gate', () => {
	it('fails on purpose', () => {
		expect(1).toBe(2);
	});
});
