# Story 2.5: Progressive letter hints cadence

Status: done

## Story

As a guesser,
I want hints revealed on a fixed cadence,
so that stalemates shrink (FR9, UX-DR18 hint rows).

## Acceptance Criteria

1. **Server-owned cadence (FR9):** **Given** phase `drawing` with a locked `roundSecretWord` **when** time advances **then** the server emits **discrete** hint events on a **fixed interval** derived from config (new resolver in `apps/server/src/config/game.ts`, e.g. `HINT_CADENCE_MS` with a documented default such as **8 000** ms, clamped similarly to other ms envs). **No** client may request or fabricate hints; hint progress is **not** recomputed independently on the client.
2. **Letter reveal rules:** **Given** the secret word **when** hints tick **then** each tick reveals **at most one** new character position among **alphabetic** `A–Z / a–z` (normalize matching rules with future Epic 4 guessing: treat hints as previews of **display** characters; **do not** reveal punctuation or whitespace slots—they may remain visible as separators if the UX shows word shape). Multi-word phrases keep **spaces** visible in the masked string from the **first** hint onward. **If** fewer letter slots exist than ticks before round end **then** emitting stops once all letters are revealed; **if** cadence implies more ticks than letters **then** extra timers simply no-op (already fully revealed).
3. **Deterministic ordering server-side:** **Given** a round **when** hints are scheduled **then** **which letter position** reveals next is **chosen once** when entering `drawing` (e.g. shuffle of eligible indices with a RNG seeded **deterministically** from stable inputs such as `room.id + matchRoundIndex + normalized secret`, or stable sort if product prefers alphabetical—**pick one approach**, document it, and stick to it for the MVP). Ordering must **not** depend on wall-clock jitter between clients—only emitted events matter.
4. **Wire contract:** Extend `@skribbl/shared` `serverEventSchema` / `ServerEvent` with a new discriminant (name suggestion: **`drawingHintTick`**) including at minimum: `roomId`, `matchRoundIndex` (non-negative int), **`hintIndex`** (0-based tick counter), **`maskedWord`** (`string`, safe to render—replacement char like `_` or `●` documented), and **`totalLetters`** or **`revealedLetterCount`** so UI can show progress consistently. **`serializeServerEvent`** must validate the shape (already calls `parse`—schema change propagates automatically).
5. **Timer hygiene:** Hint timers are registered alongside the drawing-round timer (`lockWordAndBeginDrawing` / `timeouts` array pattern in `RoomManager`) **and** are cleared whenever `clearMatchTimers` runs or drawing ends (same guarantees as Story 2.4 drawing timeout). Epic 4 hook: documenting where early correct-guess will clear timers is mandatory (reuse existing **`clearMatchTimers`** / drawing-end path—hints must not fire after phase leaves `drawing`).
6. **Client persistence & ordering:** **`use-host-create-room`** and **`use-guest-join-room`** (and any shared WS reducer if introduced) append parsed `drawingHintTicks` **in phase** `drawing`: drop events for **`roomId` / `matchRoundIndex`** mismatches; **replace** hints when transitioning to a new drawing round (`matchPhase` changes `matchRoundIndex` or leaves `drawing` → clear hint feed). Lobby state typing should gain an explicit hint list or **latest-mask + history** pattern—prefer **bounded history list** (`MAX_HINT_ROWS` optional, e.g. cap at letter count). Exhaustive **`switch`/handler** routing must satisfy project TS exhaustive-discriminant norms.
7. **UX as system/hint rows (UX-DR18):** During `drawing`, render hints in match UI inside a **`aside`**/`section` modeled as chat-style rows: **muted** background/text vs player chat (future Epic 4), fixed **prefix label** (“Hint”) per UX spec typography, **`tabular-nums`** where indices shown, avoid leaking drawer-only data. Drawer may hide this block or see it—prefer **suppress for drawer only** (`localPlayerId === drawerPlayerId`) to reduce noise while keeping wire traffic simple (**optional** UX note—if implemented, spell it in Tasks).
8. **Tests:** Extend **`apps/server/src/room-ws.integration.test.ts`** with **`vi.useFakeTimers()`** proving: entering `drawing` schedules hints; advancing fake time yields **monotonically increasing** `hintIndex` and **eventually** stationary `maskedWord` when fully revealed; leaving `drawing` via round end (**or teardown**) causes **no further** ticks. Add **Vitest unit tests** for pure hint/mask-building helpers (**package choice:** `packages/shared` if purely string/math with **no Node APIs**, otherwise `apps/server`). Run **`pnpm --filter @skribbl/shared test`**, **`pnpm --filter @skribbl/server test`**, **`pnpm --filter @skribbl/web test`** (where applicable), **`pnpm -r exec tsc --noEmit`**, **`pnpm --filter @skribbl/web build`**.

## Tasks / Subtasks

- [x] **Config & constants** (AC 1–2): Add `DEFAULT_HINT_CADENCE_MS`, `resolveHintCadenceMs()` (`HINT_CADENCE_MS` env clamp e.g. 2 000–60 000), document interplay with **`ROUND_MS`** (hint budget ≈ `(ROUND_MS − margin) / cadence`).
- [x] **Pure hint engine** (AC 2–3): Implement `eligibleLetterIndices`, mask builder (`maskedWord` string), deterministic shuffle (or documented ordering), incremental reveal state machine callable from `RoomManager` tick scheduler.
- [x] **`RoomManager` scheduling** (AC 1, 5): Inside `lockWordAndBeginDrawing` after word lock, enqueue `Math.min(eligibleLetters, maxTicks)` timeouts on `timeouts` array each firing `broadcastDrawingHintTick`. Guard every callback: stale room, phase !== `drawing`, round index mismatch (`close over roundIndex`).
- [x] **`@skribbl/shared` schema + types** (AC 4): Add `drawingHintTick` variant; export inferred type if useful; grep for exhaustive `switch` on `ServerEvent` / tooling and update (**web host/guest handlers**, **`handle-server-message`** if split, **`serializeServerEvent` consumers** none beyond schema—verify).
- [x] **Client state & UI** (AC 6–7): Lobby match surfaces (`LobbyHostPage`, `JoinRoomClient`) embed a **`MatchHintFeed`**/`ChatHintPanel` sibling near roster/canvas—not only dev `GamePage`—so real sessions see hints. Persist rows from WS; **`data-testid`** for automation (e.g. `drawing-hint-row-${hintIndex}` or list container `{match-hint-feed}`).
- [x] **Edge / regression** (AC 5, 8): Drawer-only **`wordChoiceOffer`** pattern must remain—hints never sent during `choosingWord`. Drawer must **not** leak secret via malformed mask (masked string derives only from authoritative positions).
- [x] **Docs & story record** (AC 8): Update this artifact’s completion notes + file list on implementation; **`sprint-status.yaml`** flipped to **`done`** only after **`dev-story` + review** workflows (creator sets **`ready-for-dev`**).

## Dev Notes

### Epic context (Epic 2)

Episode order: … **2.4** countdown → **this story** → ~~2.6 scoring~~ ~~2.7 scoreboard~~ (already shipped). Depends on **`drawing`** phase timers, **`roundSecretWord`** after word pick, **`matchRoundIndex`** in broadcasts. Hint behavior is orthogonal to ~~2.6~~ score math unless future stories couple them.

### Previous story intelligence (2.4)

- **`phaseDeadlineMs`** flows through **`matchPhase`**; countdown lives in **`PhaseBar`** / **`WordChoicePanel`**—hints are **additive** surfaces; reuse **`globals.css`** `@theme` tokens for muted “system” tint where sensible.
- **Timer patterns:** **`matchTimersByRoomId`** + **`timeouts`** array on round start mirror drawing end timeout—hints **must reuse** same structure so **`clearMatchTimers`** tears down everything.

### Anti-reinvention / scope control

| Do | Don’t |
|----|-------|
| New **`drawingHintTick`** event + lobby hint list UI | Duplicate timer infrastructure outside `timeouts`/`clearMatchTimers` |
| Reuse **`roundSecretWord`**, **`Room`** fields sparingly (`hintState` ephemeral per drawing phase acceptable) | Add **`sendChat`** / guess adjudication (Epic 4—stub comments only if needed for timer hook) |

### Architecture compliance (`_bmad-output/game-architecture.md` + `_bmad-output/project-context.md`)

- Authority: server emits facts; `@skribbl/shared` validates wire JSON (**Zod 4.x**—no duplicate schemas).
- Two-process topology unchanged; MVP still **no** DB.
- Mentioned doc lines list `hintTick` / chat paths—implement **`drawingHintTick`** now; converge naming with future **`chat`** events when Epic 4 lands (consider prefix **`drawing*`** vs generic **`hintTick`** vs **`hintTick`** in architecture glossary—prefer **`drawingHintTick`** collision-free).

### File structure (expected touchpoints)

| Area | Paths |
|------|-------|
| Config | `apps/server/src/config/game.ts` |
| Room / orchestration | `apps/server/src/room/room-manager.ts`, **`room.ts`** (optional transient hint fields) |
| Protocol | **`packages/shared/src/schemas.ts`**; **`packages/shared/src/index.ts`** exports if new helpers live in shared |
| Pure helpers tests | **`packages/shared/src/hint-mask*.test.ts`** *or* `apps/server/src/...test.ts` |
| Integration tests | `apps/server/src/room-ws.integration.test.ts` |
| Client | `apps/web/src/features/lobby/components/LobbyHostPage.tsx`, `apps/web/src/app/join/JoinRoomClient.tsx` |
| Client hooks | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| UI component (new) | e.g. `apps/web/src/features/match/components/MatchHintFeed.tsx` (**PascalCase** file) |

### UX reference

- **`_bmad-output/planning-artifacts/ux-design-specification.md`**: Hint rows muted vs player chat; prefixes; Density (§ chat); **`UX-DR18`** scannability. Match shell Direction 1 favors chat column—for current lobby cards, vertically stack hints **below** **`PhaseBar`** / above canvas if space allows (document layout choice briefly in Dev Agent Record).

### GDD excerpt

Mechanics specify **Letters revealed over time** to reduce stalemates ([Source: `_bmad-output/planning-artifacts/gdd.md` — Game Mechanics / Hints]). Core loop names **progressive letter hints**.

### Known gaps / follow-ups

- **Late join / reconnect** may miss prior ticks—Epic 5 snapshot/replay deferred; MVP may **only** hydrate latest mask if replay added later (note in Completion Notes).
- **`GamePage` dev scaffold** `/game`: optional parity if team wants hints there—**below** **`chat-region`** stub or skip (production path is lobby/join flows).

### Project context rules (abbrev.)

- Serialize through **`serializeServerEvent`**, parse through **`safeParseServerEvent`**.
- **DaisyUI + Tailwind**; **`tabular-nums`** where numbers dominate.
- **Vitest** for server/shared; exhaustive discriminant handling in handlers.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.5
- `_bmad-output/planning-artifacts/gdd.md` — Hints mechanic
- `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR18, chat/system/hint typography
- `_bmad-output/game-architecture.md` — chat/hints subsystem mapping
- `_bmad-output/implementation-artifacts/2-4-drawing-phase-countdown-timer-driven-round-end.md` — timer precedent
- `apps/server/src/room/room-manager.ts` — `lockWordAndBeginDrawing`, **`clearMatchTimers`**
- `packages/shared/src/schemas.ts` — `serverEventSchema`
- `_bmad-output/project-context.md` — stack + anti-patterns

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

—

### Completion Notes List

- Server-owned **`drawingHintTick`** cadence (`HINT_CADENCE_MS`, default **8000** ms; clamp **2000–60000**): budget `floor((ROUND_MS − HINT_SCHEDULE_BEFORE_ROUND_END_MS) / cadence)` with **500** ms margin; at most **one** letter reveal per tick; ordering is deterministic Fisher–Yates over eligible indices via seed `roomId:matchRoundIndex:normalized(secret)` (`hintRevealOrderSeed` + `shuffleIndicesDeterministic` in `@skribbl/shared`).
- Masking: **`●` (U+25CF)** (`HINT_MASK_CHAR`) for unrevealed A–z letters; spaces and punctuation always visible in **`maskedWord`**.
- **`lockWordAndBeginDrawing`**: queues hint timeouts on the shared **`timeouts`** array; **`drawingEnd`** clears **all** pending match timers (`clearTimeout` + `length = 0`) before scheduling inter-round / **`matchEnded`** timers so orphaned hint callbacks cannot run after **`drawing`**.
- Client: **`use-host-create-room`** / **`use-guest-join-room`** append **`drawingHintTick`** only while `phase === "drawing"` with matching **`roomId` / `matchRoundIndex`**; clear **`drawingHintRows`** on lobby, round bump, or non-drawing phase. **`MatchHintFeed`** (**`match-hint-feed`**, **`drawing-hint-row-*`**) suppressed for drawer (`localPlayerId === drawerPlayerId`).
- MVP gap (noted): late join / reconnect may miss earlier ticks until Epic 5 replay.

### File List

- `apps/server/src/config/game.ts`
- `apps/server/src/config/game.test.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `packages/shared/src/hint-mask.ts`
- `packages/shared/src/hint-mask.test.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/features/match/components/MatchHintFeed.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`

## Change Log

- 2026-04-30 — Implemented progressive **`drawingHintTick`** protocol, **`RoomManager`** scheduling + drawing-end timer teardown, **`@skribbl/shared`** mask helpers/tests, lobby hint UI (**`MatchHintFeed`**), Vitest integration + **`resolveHintCadenceMs`** tests.

## Story completion status

Implementation complete pending human code review (**`review`** workflow); move **`sprint-status.yaml`** **`2-5`** to **`done`** after **`code-review`** confirms.
