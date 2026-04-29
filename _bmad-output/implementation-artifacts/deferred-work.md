## Deferred from: code review (2026-04-29)

### `1-1-scaffold-monorepo-shared-protocol-package.md`

- No WebSocket max message size or per-connection limits — MVP scaffold; revisit before public beta or load testing. (`apps/server/src/index.ts`)

- Dev-only `maybeDemoPingWs` opens a socket in `useEffect` without teardown on route unmount — low impact; add `close()` in effect cleanup when the demo evolves.
