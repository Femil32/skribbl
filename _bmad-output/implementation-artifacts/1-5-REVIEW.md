---
status: resolved
scope: story-1-5-lobby-identity
depth: standard
files_reviewed: 16
critical: 0
warning: 0
info: 0
total: 0
resolution_date: '2026-04-29'
reviewed_paths:
  - packages/shared/src/player-identity.ts
  - packages/shared/src/player-identity.test.ts
  - packages/shared/src/schemas.ts
  - packages/shared/src/schemas.test.ts
  - packages/shared/src/index.ts
  - apps/server/src/room/lobby-session.ts
  - apps/server/src/room/room-manager.ts
  - apps/server/src/room/room-manager.test.ts
  - apps/server/src/protocol/handlers/handle-client-command.ts
  - apps/server/src/room-ws.integration.test.ts
  - apps/web/src/lib/ws-client.ts
  - apps/web/src/features/lobby/lib/protocol-error-message.ts
  - apps/web/src/features/lobby/hooks/use-host-create-room.ts
  - apps/web/src/features/lobby/hooks/use-guest-join-room.ts
  - apps/web/src/features/lobby/components/LobbyHostPage.tsx
  - apps/web/src/app/join/JoinRoomClient.tsx
---

# Code review: Story 1.5 — Lobby identity (nickname & avatar presets)

## Resolution (2026-04-29)

Prior findings from the standard-depth review are **addressed**:

| Id | Resolution |
|----|------------|
| WR-01 | `useGuestJoinRoom` exposes optional `protocolCode` on `error` state; `JoinRoomClient` routes `protocolErrId` via `aria-describedby` to room code vs nickname vs avatar group by `error.code`. |
| IN-01 | Renamed **`NICKNAME_MAX_GRAPHEMES`** everywhere (typo fix). |
| IN-02 | Host and guest lobby forms validate length with **`countGraphemes(sanitizeDisplayName(trimmed))`** aligned with the server. |
| IN-03 | **`sanitizeDisplayName`** prepends mapping of line/paragraph separators (including tab) to spaces before tag stripping and control stripping. |
| IN-04 | **`room-ws.integration.test.ts`** asserts **`INVALID_AVATAR`** (forced handler path) and **`NICKNAME_TOO_LONG`** on **`createRoom`**. |

The narrative findings below are kept for history.

---

## Archived findings (pre-fix)

### WR-01 — Guest form: nickname-related protocol errors wired to room code `aria-describedby`

Fixed as above.

### IN-01 — Public constant typo

Fixed: `NICKNAME_MAX_GRAPHEMES`.

### IN-02 — Client length check vs server length check

Fixed: shared `sanitizeDisplayName` + grapheme count on lobby forms.

### IN-03 — Tab separator between tokens

Fixed: `normalizeLineLikeSeparatorsToSpaces` / leading whitespace normalization in `sanitizeDisplayName`.

### IN-04 — Integration test coverage gaps

Fixed: new Vitest cases for `INVALID_AVATAR` and `NICKNAME_TOO_LONG`.
