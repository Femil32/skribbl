# Story 2.5: Progressive letter hints cadence

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

## Story

As a guesser,
I want hints revealed on a fixed cadence,
So stalemates shrink (FR9, UX-DR18 hint rows).

## Acceptance Criteria

1. **Server authority & cadence:** **Given** phase **`drawing`** with a locked **`roundSecretWord`** **when** time advances **then** the server emits hint updates on a **fixed interval** (wall-clock-driven `setInterval` / chained `setTimeout` ticks — same pattern family as drawing/word-choice timers in `RoomManager`) until the round ends or hints are exhausted. **Cadence** must be configurable via env with a documented default (add **`resolveHintTickMs()`** next to **`resolveRoundMs()`** in `apps/server/src/config/game.ts`, e.g. default **10 000** ms, sensible clamp range **3 000–60 000** ms). No client-side invention of hint timing.

2. **Hint content (partial letters):** **Given** the secret word **when** a hint tick fires **then** each emitted payload reveals **strictly more information than the previous** (classic progression: start from a masked string matching word length — non-letters may be shown verbatim — and reveal additional letter positions each tick). **Do not** broadcast the full plaintext word in the first tick unless the word length is 1 (edge case). Stop scheduling further hint ticks when all non-space positions are revealed or when leaving **`drawing`**.

3. **Wire protocol (`@skribbl/shared`):** **Given** a new server→client event **then** it is defined **only** in `packages/shared/src/schemas.ts` (Zod discriminated union on `type`), exported types, **`serializeServerEvent`** / **`safeParseServerEvent`** paths stay valid. Suggested shape (adjust names if needed, but keep one event type for “hint snapshot”):

   - **`type: "letterHint"`** (or equivalent) including **`roomId`**, **`matchRoundIndex`** (nonnegative int), **`hintIndex`** (0-based tick counter), **`maskedWord`** (string — user-visible mask with revealed letters / spaces punctuation as per your pure helper), **`occurredAtMs`** (optional **number** — server timestamp for ordering/debug).

   Reconnect/late join: late joiners only see hints **after** they connect unless you also add snapshot replay (Epic 5) — **for 2.5**, document gap: clients see hints from events received while connected (matches “reproducible across clients” for simultaneously connected peers).

4. **Reproducibility across clients:** **Given** two connected guessers **when** hints emit **then** both receive the **same ordered sequence** of hint events for that round (single broadcaster fan-out per tick). Ordering follows TCP/WS delivery order per socket; payload alone must not depend on client PRNG.

5. **Timer hygiene:** **Given** phase transitions out of **`drawing`** **when** timers are cleared **then** hint timers are cleared alongside existing **`clearMatchTimers`** / drawing-timeout logic — **no orphaned ticks** firing in **`roundResult`** or **`choosingWord`**.

6. **UI — hint rows (UX-DR18):** **Given** hint events **when** the match shell renders **then** hints appear as **distinct rows** from normal chat (Epic 4 chat pipe **not** required yet): implement a **`LetterHintFeed`** (or similarly named) component **consistent with UX spec** — muted / secondary typography, fixed **prefix** such as **`Hint:`** or **`Hint ·`** per UX consistency patterns (`_bmad-output/planning-artifacts/ux-design-specification.md` § Feedback Patterns / chat row differentiation). **Guessers:** show feed; **Drawer:** either hide hints or show same rows without spoiling mechanics (preferred: **hide hint feed for current drawer** — they already know the word — keeps canvas column clean).

7. **Regression tests:** **`pnpm --filter @skribbl/server test`** — integration or unit coverage proving: entering **`drawing`** schedules at least one hint tick when word length > masked start; clearing phase clears hints; **`pnpm --filter @skribbl/shared test`** if pure mask/reveal helpers live in shared; **`pnpm --filter @skribbl/web test`** for presentational formatting if extracted; **`pnpm -r exec tsc --noEmit`** and **`pnpm --filter @skribbl/web build`**.

## Tasks / Subtasks

- [x] **Protocol** (AC: 3, 4)
  - [x] Add Zod variant + inferred type; rebuild/re-export consumption in web/server.
- [x] **Pure hint progression** (AC: 2)
  - [x] Implement deterministic progression helper(s) (server-side unit-tested; optionally mirrored tests in shared if exported).
- [x] **Room state & timers** (AC: 1, 5)
  - [x] Extend `Room` / `RoomManager`: hint timer handles tracked with existing match timer arrays; start hints inside **`lockWordAndBeginDrawing`**; clear on teardown.
- [x] **Fan-out** (AC: 4)
  - [x] Broadcast hint event to all sockets in room (reuse iteration patterns from **`broadcastMatchPhase`**).
- [x] **Web UI** (AC: 6)
  - [x] Extend **`use-host-create-room`** / **`use-guest-join-room`**: handle new **`switch`** arm (`typescript-exhaustive-switch` — handle **every** `ServerEvent` variant).
  - [x] Store rolling hint history or latest snapshot per UX preference (append-only list reads better for “hint lines”).
  - [x] Wire **`LetterHintFeed`** into **`LobbyHostPage`** / **`JoinRoomClient`** for **`drawing`** phase visibility region (temporary placement until Epic 3.1 chat column lands — note relocation in Dev Notes).
- [x] **Tests & verification** (AC: 7)

## Dev Notes

### Epic context (Epic 2)

Epic 2 covers match rhythm through scoreboard (2.1–2.7). **Dependencies:** **2.4 done** — **`phaseDeadlineMs`**, **`timer-display`**, **`PhaseBar`** / **`WordChoicePanel`** timers exist. **2.6** will consume scoring; **Epic 4** adds chat guesses — **this story establishes hint plumbing without requiring `sendChat`.**

### Architecture compliance

- **Authority:** Only server reads **`roundSecretWord`** for hint generation; never emit plaintext secret in logs at **info** level.
- **Contracts:** Single source of truth **`@skribbl/shared`** for **`ServerEvent`** — update **`serializeServerEvent`** tests implicitly via schema parse round-trip.
- **Match timers:** Follow **`clearMatchTimers`** patterns established for drawing/word-choice (**`apps/server/src/room/room-manager.ts`**).

### File structure (expected touchpoints)

| Area | Path |
|------|------|
| Config | `apps/server/src/config/game.ts` — `resolveHintTickMs()` (+ env doc in server README if exists) |
| Room aggregate | `apps/server/src/room/room.ts` — optional fields for hint scheduler state |
| Room logic | `apps/server/src/room/room-manager.ts` — **`lockWordAndBeginDrawing`**, timer clearing |
| Protocol | `packages/shared/src/schemas.ts` |
| Web hooks | `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts` |
| UI | New feature component under `apps/web/src/features/match/components/` (e.g. **`LetterHintFeed.tsx`**); consume from **`LobbyHostPage.tsx`**, **`JoinRoomClient.tsx`** |
| Styles | Prefer `@theme` / DaisyUI semantic tokens — align hint secondary styling with UX **accent** guidance |

### Library / stack

Next.js App Router, React 19, Tailwind + DaisyUI, Zod 4.x in **`@skribbl/shared`**, Vitest — unchanged from prior epic-2 stories.

### Previous story intelligence (2.4)

- **`phaseDeadlineMs`** merged in **`matchPhase`** — preserve when adding hint state.
- **`PhaseCountdownChip`** / **`timer-display.ts`** — reuse spacing/tokens for visual harmony beside hint feed.
- Exhaustive **`switch`** on **`parsed.data.type`** — adding **`letterHint`** must compile cleanly (eslint exhaustive switch).

### Git intelligence (recent)

Epic 2 commits follow **`feat(epic-2):`** conventional commits; **`room-ws.integration.test.ts`** exercises **`matchPhase`** ordering — extend with hint assertions.

### Latest tech notes

- Hint ticks should use **same fake-timer discipline** as **`room-ws.integration.test.ts`** for deterministic CI.

### Project Context Rules

From **`_bmad-output/project-context.md`**:

- All wire payloads through **`@skribbl/shared`** Zod schemas; invalid payloads → **`error`** with stable **`code`** (hints apply to outbound **`ServerEvent`** parsing on clients).
- Server-authoritative gameplay; **`typescript-exhaustive-switch`** on **`RoomPhase`** / **`ServerEvent`** unions in handlers.
- Do **not** duplicate protocol enums outside **`packages/shared`**.
- **`pnpm --filter @skribbl/<pkg>`** for package-scoped scripts.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.5]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR9]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR7 / UX-DR18, Feedback Patterns § Info/hints]
- [Source: `_bmad-output/game-architecture.md` — authoritative match / chat-adjacent systems]
- [Source: `apps/server/src/room/room-manager.ts` — **`lockWordAndBeginDrawing`**, **`clearMatchTimers`**]
- [Source: `packages/shared/src/schemas.ts` — **`serverEventSchema`**]
- [Source: `_bmad-output/implementation-artifacts/2-4-drawing-phase-countdown-timer-driven-round-end.md` — timer integration patterns]

### Implementation warnings

- **ChatPanel scaffold (Epic 3.1)** is **not** in repo yet — ship **`LetterHintFeed`** as a narrow slice that can migrate into ChatPanel history later without renaming UX semantics (hint vs player rows).
- **Anti-spoiler:** Confirm masked strings never equal full secret until intentional final reveal tick; drawer UI hides feed if implemented.

## Dev Agent Record

### Agent Model Used

Cursor agent (user session)

### Debug Log References

### Completion Notes List

- **`letterHint` protocol** — Zod discriminator + client hooks with exhaustive **`switch`**; append-only **`letterHints`** cleared when **`matchPhase.phase !== "drawing"`** or round advances.
- **Pure progression** — `packages/shared/src/letter-hint-progression.ts`; ASCII `[A-Za-z]` slots revealed left‑to‑right; single-letter word shows on first emission; multi-letter first emission is fully masked underscores (non‑letters verbatim).
- **Server cadence** — chained **`setTimeout`** every **`resolveHintTickMs()`** defaults **10 000** ms (**`HINT_TICK_MS`** env **3000–60000**); handles stored on **`Room.letterHintTimerHandles`** and cleared in **`clearMatchTimers`**, at **`drawing`** → **`roundResult`**, and before a new **`lockWordAndBeginDrawing`**.
- **`LetterHintFeed`** — muted monospace rows prefixed **`Hint ·`**; **`showGuessersOnly`** hides strip for drawer (matches UX).
- **Reconnect / snapshot gap (AC3):** Implemented behavior matches spec for already-connected sockets; late join mid-round still receives **`matchPhase`** but does **not** get prior **`letterHint`** events until Epic 5 snapshot/replay (**no server change in 2.5**).
- **Verification:** Ran **`pnpm --filter @skribbl/shared test`**, **`pnpm --filter @skribbl/server test`**, **`pnpm --filter @skribbl/web test`**, **`pnpm -r exec tsc --noEmit`**, **`pnpm --filter @skribbl/web build`**.

### File List

- `packages/shared/src/schemas.test.ts`
- `packages/shared/src/letter-hint-progression.ts`
- `packages/shared/src/letter-hint-progression.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/config/game.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/match/components/LetterHintFeed.tsx`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-29:** Story authored (`gds-create-story`) — ready-for-dev.
- **2026-04-29:** Implemented progressive letter hints (protocol, timers, UI, tests); status **`review`** — `gds-dev-story`.
