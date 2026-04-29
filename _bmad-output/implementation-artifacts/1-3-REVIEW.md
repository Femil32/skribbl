---
status: resolved
phase: "1.3"
story_file: "_bmad-output/implementation-artifacts/1-3-create-flow-ux-shareable-link-copy-feedback.md"
depth: standard
files_reviewed: 14
critical: 0
warning: 0
info: 0
total: 0
---

# Code Review: Story 1.3 — Create-flow UX (shareable link & copy feedback)

**Update:** Findings from the initial review were addressed in code (clipboard error propagation, exhaustive `switch`, ignore late `error` after lobby, deterministic invite URL without empty-origin fallback).

---

## Original findings (fixed)

| Id | Topic | Resolution |
|----|--------|------------|
| WR-01 | Copy `catch` discarded real rejection | `catch (err) { setCopyError(clipboardFailureMessage(err)); }` in `LobbyHostPage.tsx` |
| IN-01 | No `default` + `never` on server events | `default: { const _exhaustive: never = parsed.data; return _exhaustive; }` in `use-host-create-room.ts` |
| IN-02 | `error` after `roomCreated` clobbered lobby | Early `return` in `case "error"` when `reachedLobbyRef.current` |
| IN-03 | Empty-origin invite URL fallback | `publicOrigin = resolvePublicWebOrigin() \|\| window.location.origin`; `buildRoomInviteUrl` only when origin non-empty; else relative `/join?code=` |

**Verification:** `pnpm --filter @skribbl/web typecheck` and `pnpm --filter @skribbl/web test` pass after changes.

---

## Original report body (archived)

<details>
<summary>Expand pre-fix write-up</summary>

Scope: files listed in story **File List** (excluding `sprint-status.yaml`).

### WR-01 — Copy failure path dropped `NotAllowedError`

Fixed by passing the caught error into `clipboardFailureMessage`.

### IN-01 — Exhaustive switch

Fixed with `default` + `never` assignment on `parsed.data`.

### IN-02 — Late `error` event

Fixed by ignoring `error` when lobby already reached.

### IN-03 — Origin-less URL

Fixed by merging `window.location.origin` before building URL and using relative path only when no origin exists.

</details>
