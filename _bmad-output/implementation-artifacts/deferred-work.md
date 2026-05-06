## Deferred from: code review of 1-4-join-flow-ux-paste-friendly-code-entry (2026-04-29)

- Duplicate normalization tests in `packages/shared/src/room-code.test.ts` and `apps/server/src/room/room-manager.test.ts` — consolidate when convenient to avoid parallel edits.

## Deferred from: code review (2026-04-29)

### `1-1-scaffold-monorepo-shared-protocol-package.md`

- No WebSocket max message size or per-connection limits — MVP scaffold; revisit before public beta or load testing. (`apps/server/src/index.ts`)

- Dev-only `maybeDemoPingWs` opens a socket in `useEffect` without teardown on route unmount — low impact; add `close()` in effect cleanup when the demo evolves.

## Deferred from: code review of 6-4-accessibility-sweep-landmarks-keyboard-loops-contrast (2026-05-06)

- Tabs `aria-controls` missing — no tabpanel elements in this design; architectural constraint prevents fix without adding panels.
- Button CTA variant silently ignores size prop — design decision; needs API doc or type-level enforcement.
- Color swatch buttons in DrawingToolbar shift height on press (btn-sm removed when active) — layout polish, low priority.
- Tabs onChange fires before focus() — React batched update means newly-focused tab has tabIndex=-1 at focus time; minor AT sequencing issue.
