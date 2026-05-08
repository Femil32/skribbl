## Deferred from: code review of 1-4-join-flow-ux-paste-friendly-code-entry (2026-04-29)

- Duplicate normalization tests in `packages/shared/src/room-code.test.ts` and `apps/server/src/room/room-manager.test.ts` — consolidate when convenient to avoid parallel edits.

## Deferred from: code review (2026-04-29)

### `1-1-scaffold-monorepo-shared-protocol-package.md`

- No WebSocket max message size or per-connection limits — MVP scaffold; revisit before public beta or load testing. (`apps/server/src/index.ts`)

- Dev-only `maybeDemoPingWs` opens a socket in `useEffect` without teardown on route unmount — low impact; add `close()` in effect cleanup when the demo evolves.

## Deferred from: code review of 8-0-migrate-room-manager-from-in-memory-map-to-redis-backed-store (2026-05-08)

- D-1: Read path (getRoom/joinRoom) reads only in-memory — Redis is write-only. Design decision per completion notes; read-back hydration scoped to future story.
- D-2: Server restart loses all rooms; orphaned Redis keys persist until TTL. Known limitation of write-through architecture.
- D-3: `generateUniqueCode` only checks in-process map — code collision risk if process restarts before Redis TTL expires. Requires async Redis check; out of scope for this story. (`room-manager.ts:978`)
- D-4: In-flight `writeRoomToRedis` promise can race with `deleteRoomFromRedis`, resurrecting a deleted key with no TTL. Requires fully async write path to fix properly.
- D-5: `canvasPhaseLog` is process-local — post-restart hydrate would produce integrity mismatch. Not introduced by this story.
- D-6: Match timers are ephemeral — no restart recovery path. Not introduced by this story.
- D-7: `joinRoom` (lobby phase) uses `ROOM_TTL_ACTIVE_S` (2h) instead of `ROOM_TTL_IDLE_S` (30min) for TTL. Minor: abandoned lobbies expire slower than intended.
- D-8: `room-by-id` `set`+`expire` non-atomic — same root cause as P-2; will be resolved if pipeline is added.

## Deferred from: code review of 6-4-accessibility-sweep-landmarks-keyboard-loops-contrast (2026-05-06)

- Tabs `aria-controls` missing — no tabpanel elements in this design; architectural constraint prevents fix without adding panels.
- Button CTA variant silently ignores size prop — design decision; needs API doc or type-level enforcement.
- Color swatch buttons in DrawingToolbar shift height on press (btn-sm removed when active) — layout polish, low priority.
- Tabs onChange fires before focus() — React batched update means newly-focused tab has tabIndex=-1 at focus time; minor AT sequencing issue.
