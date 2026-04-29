## Deferred from: code review of 1-4-join-flow-ux-paste-friendly-code-entry (2026-04-29)

- Duplicate normalization tests in `packages/shared/src/room-code.test.ts` and `apps/server/src/room/room-manager.test.ts` — consolidate when convenient to avoid parallel edits.

## Deferred from: code review (2026-04-29)

### `1-1-scaffold-monorepo-shared-protocol-package.md`

- No WebSocket max message size or per-connection limits — MVP scaffold; revisit before public beta or load testing. (`apps/server/src/index.ts`)

- Dev-only `maybeDemoPingWs` opens a socket in `useEffect` without teardown on route unmount — low impact; add `close()` in effect cleanup when the demo evolves.
