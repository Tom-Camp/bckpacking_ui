// Client-rendered SPA: the static shell is cached by the service worker and all data comes
// from IndexedDB, so the app opens with no connection.
export const ssr = false;
export const prerender = false;
