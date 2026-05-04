# Story 7.1: Close guess proximity feedback (Growth)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created (2026-05-04). -->

## Story

As a struggling guesser,

I want subtle private encouragement when my guess is nearly correct,

So frustration drops without widening MVP scope or spoiling the word for others (FR24).

## Acceptance Criteria

1. **Given** a match in **`drawing`** phase with an active secret word **when** a non-drawer sends **`chatMessage`** whose normalized text is **not** an exact match (reuse **`normalizeGuessText`** after **`sanitizeChatMessage`**) **and** a server-side proximity heuristic says “close” **then** **only that sender’s** WebSocket receives a new server event (not a public chat row) with a **fixed, spoiler-safe** message (e.g. “You’re close!”) — **no** `revealedWord`, **no** distance value exposed to the client ([Source: `_bmad-output/planning-artifacts/epics.md` §Epic 7 Story 7.1; FR24; `project-context.md` anti-spoiler]).
2. **Given** the same round **when** another player or the drawer observes traffic **then** they **never** receive the proximity event and **never** see any extra chat line attributable to proximity (verify with integration test: two sockets, one hint) ([Source: FR21/FR24 tension — private feedback only]).
3. **Given** the drawer or a player not in the active guesser role / wrong phase **when** they chat **then** proximity feedback is **not** evaluated or emitted (drawer already knows the word; avoid leaking difficulty) ([Source: `_bmad-output/planning-artifacts/epics.md` Story 7.1 “Growth” intent]).
4. **Given** repeated “almost” guesses **when** the user sends many messages in one round **then** hints are **rate-limited** per player per drawing phase (configurable cap + optional cooldown in **`apps/server/src/config/game.ts`**) so chat cannot spam private toasts or hot-loop the server ([Source: NFR-P3 / sensible server behavior]).
5. **Given** reconnect / **`roomHydrate`** **when** the client replays **`chatTail`** **then** proximity hints are **not** part of hydrate payloads (ephemeral UX only — do **not** add to **`hydrateChatTailWireSchema`**) ([Source: `packages/shared/src/schemas.ts` §`hydrateChatTailWireSchema`; Story 5.2 patterns]).
6. **Given** `prefers-reduced-motion: reduce` **when** the client shows proximity encouragement **then** use **static** or short-lived non-pulsing emphasis consistent with Story **6.5** (`MatchChatPanel` / `PhaseCountdownChip` patterns: `motion-reduce` or `matchMedia`) ([Source: `_bmad-output/implementation-artifacts/6-5-reduced-motion-variants-testids-responsive-qa.md`]).
7. **Given** optional observability **when** enabled via env (e.g. `CLOSE_GUESS_HINT_LOG=1` or reuse an existing debug flag pattern) **then** the server may emit a **structured pino** log line without chat body or secret (e.g. `roomId`, `matchRoundIndex`, `playerId` only) — default **off** in production mental model ([Source: `_bmad-output/project-context.md` §Performance/Logging; epics “metrics tracked optionally”]).

## Tasks / Subtasks

- [x] **Protocol — `@skribbl/shared` (AC: #1, #5)**  
  - [x] Add a **`serverEventSchema`** variant, e.g. `chatCloseGuessHint`, with fields: `roomId`, `matchRoundIndex` (nonnegative int), `message` (constant allowed on server — still validate max length), optional `id`/`ts` if you align with other chat events.  
  - [x] Export inferred type and extend **client** `safeParseServerEvent` tests in `packages/shared/src/schemas.test.ts`.  
  - [x] **Do not** extend **`hydrateChatTailWireSchema`** for this event.

- [x] **Pure heuristic + config (AC: #1, #4)**  
  - [x] Implement edit-distance (or length-normalized distance) on **`normalizeGuessText`** outputs in **`packages/shared`** **or** a colocated `apps/server` pure helper **only if** you keep tests shared — prefer **`@skribbl/shared`** pure function + **`packages/shared/src/*.test.ts`** so server and tests share one implementation (**avoid new npm deps** unless justified in Dev Notes).  
  - [x] Gate “close” with guards: min/max word length, max distance or max ratio, reject if guess length wildly divergent, skip if exact match path already taken.  
  - [x] Add **`resolveCloseGuess…`** knobs in **`apps/server/src/config/game.ts`** (thresholds, max hints per player per drawing phase, cooldown ms).

- [x] **Server — `RoomManager.applyChatMessage` (AC: #1–#5)**  
  - [x] After the existing exact-match branch fails, **only if** `inDrawing`, sender ≠ drawer, secret present, and not a case that should stay silent: compute closeness; if true and rate limit allows, **`sendEvent(ws, …)`** unicast (existing private helper ~`sendEvent` in `room-manager.ts`).  
  - [x] Still run the normal **`broadcastPlayerChatWithPerRecipientText`** path for the actual chat line (proximity is additive, not a substitute for chat).  
  - [x] Track per-room/per-round/per-player hint state on `Room` or a small side map cleared on phase transitions (mirror how awards/timer state is scoped).

- [x] **Client — WS demux + UI (AC: #1, #2, #6)**  
  - [x] Handle `chatCloseGuessHint` in **`useHostCreateRoom`** and **`useGuestJoinRoom`** (`apps/web/src/features/lobby/hooks/*.ts`) with **exhaustive** `switch` / typed narrowing when extending the big `onmessage` handler ([Source: workspace TypeScript exhaustive switch rule]).  
  - [x] Surface UX in **`MatchChatPanel`** (local ephemeral banner/toast state, **not** `chatFeed`) or a tiny sibling component; ensure **`data-testid`** for stable tests (optional: `close-guess-hint` region).  
  - [x] Vitest: reduced-motion branch mirrors **6.5** patterns.

- [x] **Tests (AC: #1–#4)**  
  - [x] **`apps/server`**: unit tests for heuristic edges (empty, very long, unicode/NFKC parity with **`normalizeGuessText`**).  
  - [x] **`apps/server` integration** (pattern: `room-ws.integration.test.ts`): guest sends near-miss → receives hint event; other peer does **not**; drawer never receives hint.  
  - [x] **`apps/web`**: component or hook test that a parsed `chatCloseGuessHint` shows the whisper UI once.

- [x] **Verify**  
  - [x] `pnpm --filter @skribbl/shared test` + `pnpm --filter @skribbl/server test` + `pnpm --filter @skribbl/web test` (or repo-standard equivalents).  
  - [x] `pnpm -r exec tsc --noEmit` or per-package `typecheck` as documented.

## Dev Notes

### Epic / product context

- **Epic 7** is the **Growth** bucket; **FR24** was intentionally deferred from MVP ([Source: `_bmad-output/planning-artifacts/epics.md` Overview FR list, Epic 7 sections]).
- This story **extends Epic 4’s** chat path without changing exact-match semantics (`applyChatMessage` already centralizes adjudication) ([Source: `apps/server/src/room/room-manager.ts` `applyChatMessage`]).

### Brownfield anchors (do not reinvent)

| Layer | Existing pattern | Use for 7.1 |
|--------|------------------|-------------|
| Guess normalization | `normalizeGuessText` in `@skribbl/shared` (`chat-text.ts`) | Same normalization for distance inputs |
| Chat ingress | `RoomManager.applyChatMessage` | Insert proximity branch **after** exact-match logic; preserve spoiler-safe fan-out for real chat lines |
| Unicast server events | `sendEvent(ws, event)` in `room-manager.ts` | Hint goes **only** to submitting socket |
| Client chat | `MatchChatPanel` + `chatFeed` for public rows | Keep hint **out** of `feed`; ephemeral local state only |
| Motion | Story **6.5** | Reuse `prefers-reduced-motion` handling for any pulse |

### Architecture compliance

- **Authority:** Proximity decision is **server-only**; client never computes distance against a secret ([Source: `_bmad-output/project-context.md` §Engine-Specific Rules]).
- **Wire types:** All payloads in **`@skribbl/shared`** Zod schemas — **no** duplicate event types in apps ([Source: `project-context.md` §Critical Don't-Miss]).
- **Security:** Fixed copy on the wire; never echo user’s guess or secret in the hint event; continue sanitizing chat as today (NFR-SEC2).

### Library / tech note

- Prefer a **small in-repo** Levenshtein / restricted edit distance implementation with **O(n·m)** bounds and early bail for large strings (chat grapheme cap already limits input) rather than adding dependencies. If you document a package choice, align with maintainers and pin version ([Source: `project-context.md` §Technology Stack]).

### Project Context Rules (extract)

- Monorepo: **`pnpm --filter @skribbl/{web,server,shared}`**; one canonical protocol in **`@skribbl/shared`**.
- Testing: Vitest server/shared; client tests for UI; invalid Zod → structured errors ([Source: `_bmad-output/project-context.md`]).
- **Do not** leak spoilers: parity with Epic 4’s `chatCorrectGuess` / per-recipient chat masking philosophy.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 7, Story 7.1, FR24]
- [Source: `_bmad-output/game-architecture.md` — authoritative server, WS protocol]
- [Source: `_bmad-output/project-context.md` — stack, testing, anti-patterns]
- [Source: `packages/shared/src/schemas.ts` — `clientCommandSchema` / `serverEventSchema`]
- [Source: `apps/server/src/room/room-manager.ts` — `applyChatMessage`, `sendEvent`]
- [Source: `apps/web/src/features/match/components/MatchChatPanel.tsx` — chat UX patterns]

## Previous story intelligence (Epic 6)

- Story **6.5** established **reduced-motion** expectations and **deterministic `data-testid`** hooks on match surfaces; any new proximity UI should follow the same Tailwind **`motion-safe` / `motion-reduce`** approach and add tests similar to **`MatchChatPanel.test.tsx`** ([Source: `_bmad-output/implementation-artifacts/6-5-reduced-motion-variants-testids-responsive-qa.md`]).

## Git intelligence (recent patterns)

- Recent work is **Epic 6** polish: themed UI, error boundary, landing/health, accessibility/motion/QA (`feat(story-6.x)` commits). Story **7.1** is the first **protocol + gameplay-adjacent** change after that wave — expect touches in **`packages/shared`** and **`room-manager.ts`**, not just web-only.

## Completion status (workflow)

- **done** — code review complete (`7.1-REVIEW.md`); IN-01–IN-03 follow-ups landed; tests green (2026-05-04).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- `@skribbl/shared` consumers use `dist/`; `pnpm --filter @skribbl/shared build` required after new exports before server typecheck/tests pick up `evaluateCloseGuessTier`.

### Completion Notes List

- Added `chatCloseGuessHint` server event + bounded Levenshtein heuristic in `@skribbl/shared` (`close-guess.ts`), env-driven game config (`CLOSE_GUESS_*`), rate-limited unicast hints in `applyChatMessage`, ephemeral `closeGuessHint` state in lobby hooks, whisper banner in `MatchChatPanel` (`data-testid="close-guess-hint"`), integration + unit tests. Optional `CLOSE_GUESS_HINT_LOG=1` structured pino log (no secret/message body).

### File List

- `packages/shared/src/close-guess.ts`
- `packages/shared/src/close-guess.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/schemas.test.ts`
- `apps/server/src/config/game.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/close-guess.server.test.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/match/components/MatchChatPanel.tsx`
- `apps/web/src/features/match/components/MatchChatPanel.test.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-05-05:** Story 7.1 — close guess proximity feedback: protocol, heuristic, server unicast + rate limit, client whisper UI, tests; sprint status → review.
- **2026-05-04:** Review follow-ups (roster guard, three-player AC2 test, hint-off short-circuit); sprint status → done; epic-7 → done.

---

## Questions / clarifications (non-blocking)

_Product owner can tweak thresholds or copy before ship; sensible defaults should be shipped in config._

1. **Exact distance metric:** Levenshtein vs. Damerau-Levenshtein vs. length-normalized ratio — pick one, document in server config with examples in tests.
2. **Hint copy:** Single global string vs. two tiers (“Close!” / “Very close!”) **without** revealing numeric distance — if two tiers, still spoiler-safe.
