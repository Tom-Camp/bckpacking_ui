import { describe, expect, it } from 'vitest';
import { evaluate, loadZxcvbn } from './password-strength';

describe('evaluate', async () => {
	const zxcvbn = await loadZxcvbn();

	it('rejects common passwords with zxcvbn feedback', () => {
		const result = evaluate(zxcvbn, 'password123');
		expect(result.ok).toBe(false);
		expect(result.score).toBeLessThan(3);
		expect(result.message).toBeTruthy();
	});

	it('accepts a long passphrase', () => {
		const result = evaluate(zxcvbn, 'correct horse battery staple trailhead');
		expect(result).toEqual({ score: 4, ok: true, message: null });
	});

	it('rejects passwords over 72 bytes', () => {
		const result = evaluate(zxcvbn, 'é'.repeat(37));
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/too long/);
	});
});
