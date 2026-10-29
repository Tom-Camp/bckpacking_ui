import { syncStatus } from '$lib/sync/status.svelte';

// The app reads "online" in two places: `syncStatus.online` drives the UI (OnlineButton, the
// sync badge) and `navigator.onLine` guards online-only mutations (`requireOnline`). Tests set
// both through `setOnline`, so they never depend on the host's network or flip only one.
// `onLine` is a getter on Navigator.prototype; an own property on `navigator` shadows it.
let online = true;
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

/** Sets what both the UI and the mutation layer see. The test setup resets it to online. */
export function setOnline(value: boolean) {
	online = value;
	syncStatus.online = value;
}

/**
 * Changes only what the mutation layer sees, for the race where the connection drops before
 * the UI notices. Most tests want `setOnline`.
 */
export function setNavigatorOnline(value: boolean) {
	online = value;
}
