# Story 4.1: ChatPanel composer & realtime history

Status: done

<!-- Backfilled via gds-create-story (2026-04-30). Implementation landed; sprint-status already epic-4 / 4-1 done. Ultimate context engine analysis completed — comprehensive developer guide for continuity and audits. -->

## Story

As guessers,

I want a scrollable transcript with labeled composer affordances,

So that guessing stays fast (FR19, UX-DR7).

## Acceptance Criteria

1. **Given** match chat UI **when** messages arrive **then** player rows vs system rows visually differ per UX patterns (**UX-DR18**): player lines use `senderDisplayName:` prefix and alignment by self vs others; system lines use `System ·` prefix, smaller italic muted text; correct-guess rows use success styling and optional pulse banner (**UX-DR11** partial).
2. **Given** the composer **when** the user interacts **then** it remains keyboard reachable: labeled control (`sr-only` + `htmlFor`), `data-testid="chat-composer-input"` (**UX-DR15**), submit via form; canvas drawing stays pointer-primary elsewhere (**UX-DR13** partial).
3. **Given** WebSocket disconnected **when** match UI still shows chat **then** composer is disabled and pairs with transport gating (`disabled={transport !== "live"}`) alongside ConnectionBanner semantics on parent pages (**UX-DR7**).
4. **Given** realtime feed growth **when** events stream in **then** the message list stays scrollable (`overflow-y-auto`, bounded `max-h`), auto-scrolls to tail on new items (`feed.length`), and feed is bounded client-side (`MAX_CHAT_FEED = 400`) to avoid unbounded memory.
5. **Given** wire protocol **when** client sends guesses **then** commands use **`chatMessage`** via **`serializeChatMessageCommand`** (Zod-validated in **`@skribbl/shared`**); server emits **`chatPlayerMessage`**, **`chatSystemMessage`** (if used), **`chatCorrectGuess`** — panel consumes only these Epic 4 event shapes.

## Tasks / Subtasks

- [x] **Shared protocol (`@skribbl/shared`)** — `chatMessage` client command; `chatPlayerMessage`, `chatSystemMessage`, `chatCorrectGuess` server events; `sanitizeChatMessage` / `assertChatMessageLength`; tests in `schemas.test.ts`, `chat-text.test.ts`.
- [x] **Server** — `handle-client-command.ts` `chatMessage` → `roomManager.applyChatMessage`; structured errors (`BAD_ROOM`, `CHAT_EMPTY`, `CHAT_TOO_LONG`, `WRONG_PHASE`, `GUESSER_IS_DRAWER`, …); fan-out via `broadcastPlayerChatWithPerRecipientText` (spoiler-aware text per recipient where adjudication requires).
- [x] **Client — `MatchChatPanel` (`apps/web/src/features/match/components/MatchChatPanel.tsx`)** — `MatchChatFeedEvent` extract type; scrollable `<ol role="log">`; composer form; pulse banner for last `chatCorrectGuess` with `motion-reduce:animate-none`; landmarks (`aria-labelledby`, `section`).
- [x] **Client — transport integration** — `use-host-create-room.ts` and `use-guest-join-room.ts`: maintain `chatFeed`, append parsed server events, reset feed on room/match boundaries as implemented; `sendChat` → `serializeChatMessageCommand`.
- [x] **Client — shell** — `LobbyHostPage.tsx`, `JoinRoomClient.tsx`: grid places **`MatchChatPanel`** beside **`MatchDrawingColumn`** (Direction 1); pass `localPlayerId`, `feed`, `onSend`, `disabled`.
- [x] **Tests** — Server integration tests for chat (`room-ws.integration.test.ts`); extend Playwright smoke if repo requires chat composer (`data-testid`).

## Dev Notes

### Architecture compliance

- **Server-authoritative chat:** Client sends **intent** (`chatMessage`); server sanitizes, phase-checks, adjudicates guess (Story 4.2+), emits **facts** as row events — never infer correct guesses purely on client ([Source: `_bmad-output/game-architecture.md` — Authority, API pattern]).
- **Single protocol source:** All shapes in `packages/shared/src/schemas.ts` only; `serializeClientCommand` / `safeParseServerEvent` patterns on web ([Source: `_bmad-output/project-context.md`]).
- **Hints vs chat:** Progressive hints are **`drawingHintTick`** + **`MatchHintFeed`**, not mixed into chat transcript — UX “hint rows” in chat = system-style rows + separate hint feed; do notStuff raw secret into chat client state.

### Developer guardrails / file map

| Concern | Location |
|--------|----------|
| Chat UI | `apps/web/src/features/match/components/MatchChatPanel.tsx` |
| Hint feed (related, not duplicate) | `apps/web/src/features/match/components/MatchHintFeed.tsx`, `features/lobby/lib/drawing-hint-rows.ts` |
| Send command helper | `apps/web/src/lib/ws-client.ts` → `serializeChatMessageCommand` |
| Host WS state | `apps/web/src/features/lobby/hooks/use-host-create-room.ts` (`MAX_CHAT_FEED`, `chatFeed`, `sendChat`) |
| Guest WS state | `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` (mirror host) |
| Command dispatch | `apps/server/src/protocol/handlers/handle-client-command.ts` |
| Room logic / broadcast | `apps/server/src/room/room-manager.ts` (`applyChatMessage`, `broadcastPlayerChatWithPerRecipientText`, `broadcastCorrectGuess`) |
| Sanitization | `packages/shared/src/chat-text.ts` |

### Cross-epic context (Epic 4)

- **4.2** — Exact match + spoiler-safe per-recipient text (`•••` / censored paths) builds on the same broadcast helpers.
- **4.3** — Score awards hook from adjudication inside `applyChatMessage` / award helpers — do not fork scoring from UI.
- **4.4** — Correct-guess UX beats (`chatCorrectGuess`, pulse banner, `prefers-reduced-motion`) extend this panel; keep PhaseBar unobstructed.

### UX compliance

- **UX-DR7** — Scrollable list + fixed composer; disable when not live.
- **UX-DR13** — Full keyboard path for composer; document canvas as pointer-primary in architecture/UX, not in this component.
- **UX-DR16/Direction 1** — Chat column width bands match `LobbyHostPage` / `JoinRoomClient` grid (`lg:grid-cols-[1fr_minmax(280px,340px)]`).
- **UX-DR18** — Player vs system typography conventions implemented as described in acceptance criteria.

### Previous story intelligence (3.6)

- Op-log canvas work is independent: chat does **not** use `seq`; avoid coupling transcript to canvas replay buffers.
- Sticky error/Result patterns on server — chat uses same `sendProtocolError` style as canvas commands.

### Git intelligence

- Recent Epic 4 implementation commit: `dc342eb` — `feat(epic-4): implement chat functionality for real-time interaction` (touch `MatchChatPanel`, hooks, server `applyChatMessage`, shared schemas).

### Latest tech / versions

- Stack pins: Next **16.2.4**, React **19.2.5**, **ws 8.20.0**, **Zod 4.3.6** — re-verify against `project-context.md` before CI lock changes.

### Project Context Rules (extract)

- Parse **all** WS JSON through shared Zod; invalid → structured **`error`** with stable **`code`**.
- **`pnpm`** workspaces; features under `apps/web/src/features/*`; **`use client`** only where WebSocket/DOM interaction demands it.
- **Anti-spoiler:** Do not expose secret word in client-only state; follow server broadcasts for reveal rules ([Source: `_bmad-output/project-context.md`]).
- **Testing:** Vitest server/shared; Playwright smoke for two-client flows — prioritize real WS.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.1, UX-DR7/DR13/DR18]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Chat density, landmarks, keyboard]
- [Source: `_bmad-output/game-architecture.md` — Chat & guessing system, command/event pattern]
- [Source: `_bmad-output/implementation-artifacts/3-6-eraser-fill-clear-semantics-via-op-log.md` — prior art / op-log isolation]

## Dev Agent Record

### Agent Model Used

_gds-create-story workflow (backfill)_

### Debug Log References

- `gds-dev-story` activation: `_bmad/scripts/resolve_customization.py` not present in repo; proceeded with inlined workflow defaults.

### Completion Notes List

- Implementation verified in repo: `MatchChatPanel`, host/guest hooks, `room-manager` chat pipeline, shared `chatMessage` / chat events.
- 2026-05-01: Re-verified acceptance criteria against `MatchChatPanel.tsx`, hooks, and shared/server modules; ran full `pnpm test` (shared + server + web) — all passing. Synced `sprint-status.yaml` `4-1` → `done`, `epic-4` → `in-progress`.

### File List

- `apps/web/src/features/match/components/MatchChatPanel.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/server/src/room/room-manager.ts`
- `packages/shared/src/schemas.ts`, `chat-text.ts`, tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-05-01** — GDS dev-story verification pass: full test suite green; sprint `development_status` aligned for story `4-1`.

---

## Questions / clarifications (optional)

_None — epic and story already shipped; artifact is for documentation and future regressions._
