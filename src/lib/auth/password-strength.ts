// Mirrors the API's password check (app/schemas/user.py). The Python `zxcvbn` package is a
// port of this same library, so scores match what the API will accept or reject.

export const MIN_SCORE = 3;
export const MAX_PASSWORD_BYTES = 72; // bcrypt limit

export interface PasswordStrength {
	/** 0 (guessable) – 4 (very strong). */
	score: 0 | 1 | 2 | 3 | 4;
	ok: boolean;
	/** Why the password is rejected, phrased like the API's error. Null when ok. */
	message: string | null;
}

type Zxcvbn = typeof import('zxcvbn');
let loading: Promise<Zxcvbn> | undefined;

/** zxcvbn ships ~800 KB of dictionaries, so only load it where a password is being chosen. */
export function loadZxcvbn(): Promise<Zxcvbn> {
	loading ??= import('zxcvbn').then((m) => m.default);
	return loading;
}

export function evaluate(zxcvbn: Zxcvbn, password: string): PasswordStrength {
	if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
		return {
			score: 0,
			ok: false,
			message: `Password is too long (${MAX_PASSWORD_BYTES} bytes max).`
		};
	}
	const { score, feedback } = zxcvbn(password);
	if (score >= MIN_SCORE) return { score, ok: true, message: null };
	const message = feedback.warning || feedback.suggestions[0] || 'Password is too weak';
	return { score, ok: false, message };
}
