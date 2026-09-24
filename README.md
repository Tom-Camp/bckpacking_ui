# bckpack.ing UI

Frontend for [`bckpack.ing_api`](../bckpack.ing_api): trip logistics for backpackers (pre-trip
checklist, gear list and pack weight, food plan, notes). It's an **offline-first PWA**. Once you've
signed in on a device, your trips open with no signal, and checklist, packing and edit changes
sync when you're back online.

Built with SvelteKit (SPA mode, Svelte 5), shadcn-svelte, Tailwind v4, Dexie (IndexedDB) and
`@vite-pwa/sveltekit` (Workbox).

## Development

```sh
# 1. API (in ../bckpack.ing_api)
docker compose up -d db
uv run alembic upgrade head
uv run fastapi dev app/main.py        # http://localhost:8000

# 2. UI
npm install
npm run gen:api                        # regenerate src/lib/api/schema.d.ts from the running API
npm run dev                            # http://localhost:5173, /api is proxied to :8000
```

Set `API_TARGET` to point the proxy somewhere other than `http://localhost:8000`. Because of the
proxy, the API needs no CORS changes.

The service worker only exists in production builds. To try offline mode locally:

```sh
npm run build && npm run preview       # http://localhost:4173 (serves build/, proxies /api)
```

Then use DevTools → Network → Offline, and reload.

| Script              | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `npm run check`     | svelte-check / TypeScript                                          |
| `npm run lint`      | Prettier + ESLint                                                  |
| `npm run test:unit` | Vitest: units, weights, food, outbox and sync engine               |
| `npm run test:e2e`  | Playwright against the production build; **needs the API running** |
| `npm run gen:api`   | Regenerate API types after backend schema changes                  |
| `npm run gen:icons` | Regenerate PWA icons from `static/logo.svg`                        |

## How offline works

```
UI ──reads──▶ IndexedDB (Dexie liveQuery)          ◀── pull: GET /users/me, /trips, /gear
 │                                                          (replaces the local cache)
 └─ edits ──▶ optimistic write to IndexedDB + outbox ──▶ flush: PATCHes replayed in order
```

- **App shell.** Workbox precaches every build asset, and navigations fall back to `index.html`,
  so a cold start with no connection works.
- **Data.** `GET /trips` returns every trip fully nested (checklist, gear, food, notes), so one
  request fills the cache. The UI never reads from the network directly.
- **Offline edits** (`src/lib/data/mutations.ts`) are PATCHes of existing records: checklist
  status and details, gear packed/quantity, notes, food items and targets, trip details, and
  closet items. They're applied locally at once and queued in the outbox. Repeated edits to the
  same record are merged into one request. Conflicts resolve as last write wins, the same as the
  API's PATCH semantics.
- **Online-only actions** are creates and deletes, because the API assigns IDs and has no
  tombstones. Their buttons are disabled offline.
- **Sync** (`src/lib/sync/engine.ts`) runs at startup, on reconnect, when the tab regains focus,
  and after each edit:
  - Network or 5xx errors keep the queue and retry later.
  - A 401 keeps the queue and asks you to sign in again. Your cached data stays readable.
  - 404/409/422 drop the edit and list it under "Couldn't sync" in the sync dialog.
  - A pull never overwrites edits that are still queued.
- **Auth.** The JWT is stored in `localStorage` by `src/lib/auth/session.svelte.ts`, the only
  module that knows where it lives. Signing out clears all local data. If a different user signs
  in on the same device, the previous user's local data is cleared.
- **Print.** `/trips/:id/print` renders the whole trip on one page for "Save as PDF". It works
  offline too.

**Install the app to the home screen** for reliable offline use. iOS Safari may clear storage
for sites that aren't installed after about a week without use. The app also requests persistent
storage.

## Deployment

Serve `build/` as static files with **SPA fallback to `index.html`**, and reverse-proxy `/api/` to
the API on the **same origin**. Serve `sw.js`, `index.html` and `manifest.webmanifest` with
`Cache-Control: no-cache`, and `/_app/immutable/*` as immutable. `scripts/serve.js` is a minimal
reference implementation. Any static host with rewrites (Caddy, nginx, …) works.

## Backend follow-ups that would help

- Accept an optional client-supplied `id` on create endpoints so notes, food items and trip gear
  can be **created** offline.
- API_GAPS 7.2: a refresh token in an httpOnly cookie. Only `session.svelte.ts` and
  `api/client.ts` would change.
- API_GAPS 7.3: return 404 instead of 403 for other users' trips. The sync engine already treats
  both as "drop".
