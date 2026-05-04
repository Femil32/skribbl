---
status: remediated
scope: story-6-4-accessibility
depth: standard
files_reviewed: 13
critical: 0
warning: 0
info: 0
total: 0
gsd_phase: none
note: Prior WR/IN items addressed in repo (2026-05-04). GSD phase wiring still N/A without .planning.
---

# Code review: Story 6.4 — Accessibility sweep

## Summary

Story 6.4 implementation meets the accessibility baseline: complementary chat `aside`, labelled regions, native `<dialog>` clear confirm, skip link, Vitest coverage for landmarks and dialog behavior.

**Verification:** `pnpm typecheck` (workspace) and `pnpm --filter @skribbl/web test --run` pass.

---

## Remediation log

| Prior ID | Resolution |
|----------|------------|
| WR-01 | `MatchSkipToChatLink` renders **before** `LobbyConnectionBanner` in `LobbyHostPage` and `JoinRoomClient` match shells. |
| WR-02 | Dialog polyfill keeps an **open stack**; document `keydown` for Escape is attached only while polyfilled modals are open. |
| WR-03 | **`pnpm --filter @skribbl/web test:a11y`** runs landmark + drawing-toolbar dialog tests; full Lighthouse on live match shell remains manual when game server runs. |
| WR-04 | Polyfill **`showModal`** focuses first tabbable control; **`DrawingToolbar`** test asserts Cancel receives focus after opening clear dialog. |
| IN-01 | Removed redundant **`aria-live`** from chat `<ol role="log">`. |
| TS / Biome | Form controls use **`useId`**; avatar pickers use **`fieldset`/`legend`**; join **`raw`** avoids non-null assertion. |

---

## Next steps (optional)

- Run Lighthouse accessibility on `/`, `/join`, and a loaded match when WS + room are available.
- Use GSD `/gsd-code-review <phase>` once `.planning` phases exist.
