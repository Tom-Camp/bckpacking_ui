// The only module that knows where the access token is stored. When the API adds a refresh
// token in an httpOnly cookie (API_GAPS 7.2), only this file and `api/client.ts` need to change.

const TOKEN_KEY = 'bckpack.token';

function readToken(): string | null {
	try {
		return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
	} catch {
		return null;
	}
}

function tokenExpiry(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
	} catch {
		return null;
	}
}

class Session {
	token = $state<string | null>(readToken());
	/** Set when the API rejects the token (401) before its `exp` passes. */
	rejected = $state(false);

	get signedIn(): boolean {
		return this.token !== null;
	}

	/** True when requests would fail auth. Cached data stays readable; only syncing needs sign-in. */
	get expired(): boolean {
		if (!this.token) return true;
		if (this.rejected) return true;
		const exp = tokenExpiry(this.token);
		return exp !== null && exp <= Date.now();
	}

	set(token: string) {
		this.token = token;
		this.rejected = false;
		try {
			globalThis.localStorage?.setItem(TOKEN_KEY, token);
		} catch {
			// Storage unavailable (private mode); the token lives for this tab only.
		}
	}

	clear() {
		this.token = null;
		this.rejected = false;
		try {
			globalThis.localStorage?.removeItem(TOKEN_KEY);
		} catch {
			// ignore
		}
	}

	markRejected() {
		this.rejected = true;
	}
}

export const session = new Session();
