## What and why

<!-- What changed and why, in a few sentences. Bullet the notable changes
if there are several. -->

closes #

## Contract and sync impact

<!-- API: OpenAPI changes (routes, schemas, fields), changes to the nested
`GET /trips` shape, status code changes. UI: the API branch or PR this
depends on, whether a new edit is offline-capable or online-only.
Write "None" if neither applies. -->

## Testing

<!-- New or changed tests, and anything checked by hand. -->

## Checklist

- [ ] Branch is `bu-<n>-<slug>` from `develop` and the issue's acceptance criteria are met
- [ ] Every write goes through `data/mutations.ts`; new edits are classed as offline-capable (PATCH + outbox) or online-only (`OnlineButton`)
- [ ] Local derived fields are recomputed so the cache matches what the API would return
- [ ] `schema.d.ts` was regenerated with `npm run gen:api`, not hand-edited, and new aliases are in `types.ts`
- [ ] No `{@html}` with user data; the JWT stays inside `session.svelte.ts`
- [ ] Tests added (`*.spec.ts` for logic, `*.svelte.spec.ts` for components); `npm run check`, `npm run lint` and `npx vitest --run` pass
- [ ] Any API change this depends on has landed on the target branch, so e2e passes
