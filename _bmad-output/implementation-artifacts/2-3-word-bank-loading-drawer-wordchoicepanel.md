# Story 2.3: Word bank loading & drawer WordChoicePanel

Status: done

## Story

As the drawer,
I want three curated choices pulled from bundled words data,
So that every round feels fresh but fair (FR6, `data/words.json`, UX-DR6).

## Acceptance Criteria

1. **Given** `WORDS_PATH` / `data/words.json` available at server startup **when** the match enters `choosingWord` **then** the server samples three distinct words and sends a **drawer-only** `wordChoiceOffer` (Zod-validated) with a 3-tuple of strings plus `matchRoundIndex` and `phaseDeadlineMs`.
2. **Given** the drawer client **when** the user picks one option **then** the client sends `chooseWord` with `choiceIndex` 0–2; the server validates actor, phase, and index, sets the round secret word, cancels the word-choice deadline timer, and broadcasts `matchPhase` `drawing` with round deadline (selection locks before drawing).
3. **Given** the word-choice timer expires **when** no pick arrived **then** the server auto-selects the first offered word and enters `drawing` (no stalled rounds).
4. **Web:** Drawer sees `WordChoicePanel` (cards/buttons, `data-testid="word-choice-panel"`), loading state while `choosingWord` before offer arrives, and inline error + retry only for **failed `chooseWord` protocol errors** (re-send); non-drawers do not receive word text.
5. **Tests:** Shared schema round-trip for new command/event; server integration — after `choosingWord`, drawer receives `wordChoiceOffer`; `chooseWord` advances to `drawing` before full word-choice duration; vitest + tsc + web build pass.

## Tasks / Subtasks

- [x] **Shared protocol** (AC: 1, 2)
  - [x] Add `wordChoiceOffer` server event; add `chooseWord` client command; extend tests in `schemas.test.ts`.
- [x] **Server word bank** (AC: 1, 3)
  - [x] `word-bank.ts`: load JSON array from `WORDS_PATH` or default `data/words.json`; minimum 3 words; inject into `RoomManager`.
  - [x] `Room`: `roundWordOptions`, `roundSecretWord`, `wordChoiceTimerHandle`; refactor `scheduleMatchFlow` for early drawing + timeout fallback.
- [x] **Handler** (AC: 2)
  - [x] `handleClientCommand` → `chooseWord` branch; `RoomManager.chooseWord`.
- [x] **Web** (AC: 4)
  - [x] `WordChoicePanel.tsx`; `serializeChooseWordCommand`; hooks handle `wordChoiceOffer`, expose `chooseWord`.
  - [x] `LobbyHostPage` / `JoinRoomClient`: render panel when local player is drawer and phase `choosingWord`.
- [x] **Data** (AC: 1)
  - [x] Populate `data/words.json` with enough sample words for dev/CI.

## Dev Notes

- Drawer-only offer avoids leaking words to guessers (FR6 / UX-DR6).
- Do not advance match phases from client except `chooseWord` during `choosingWord`.
- **File hints:** `packages/shared/src/schemas.ts`, `apps/server/src/room/room-manager.ts`, `apps/server/src/room/room.ts`, `apps/server/src/create-game-server.ts`, `apps/web/src/lib/ws-client.ts`, `apps/web/src/features/match/components/WordChoicePanel.tsx`.

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented drawer-only `wordChoiceOffer`, `chooseWord`, word bank loader, match timer refactor with early drawing + auto first-word on timeout. Web: `WordChoicePanel`, host/guest hooks, protocol error copy. Rebuild `@skribbl/shared` before server tests (`dist` consumes new schema).

### File List

- `data/words.json`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/words/word-bank.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/create-game-server.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room/room-manager.test.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/web/src/features/match/components/WordChoicePanel.tsx`

### Change Log

- 2026-04-29: Story 2.3 implementation + review artifact.

## References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 2.3]
- [Source: _bmad-output/planning-artifacts/epics.md — UX-DR6]
