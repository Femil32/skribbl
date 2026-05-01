# Story 4.2: Guess adjudication — exact match & spoiler-safe broadcasts

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. Brownfield: core server + shared logic already landed in dc342eb; dev-story should verify AC, close gaps, extend tests. -->

## Story

As participants,

I want correct guesses detected centrally without leaking secrets,

So fairness holds (FR20, FR21).

## Acceptance Criteria

1. **Given** chat ingress with server-side normalization (`sanitizeChatMessage`, length limits) **when** guess comparison runs **then** equality uses **case- and whitespace-insensitive** exact match against the active round secret (`normalizeGuessText` on both user text and secret) per FR20 — no fuzzy or substring match in MVP.
2. **Given** drawing phase with a locked secret **when** a **non-drawer** sends a chat message that matches the secret **then** the server adjudicates once per guesser scoring rules (delegates to `applyCorrectGuessAward`); on success emits **`chatCorrectGuess`** with **`censoredAnnouncement`**; includes **`revealedWord`** only for recipients who may know the word (guesser, drawer, already-awarded guessers in that drawing phase) per FR21.
3. **Given** the same **when** that guesser **already** received a correct-guess award this drawing **then** the server does **not** re-award; fans out **`chatPlayerMessage`** with **per-recipient `text`**: plaintext for sender, drawer, and already-awarded guessers; **`•••`** for players still guessing (spoiler-safe).
4. **Given** drawing phase **when** the **drawer** types the exact secret **then** the server does **not** score the drawer as a guesser; fans out **`chatPlayerMessage`** with per-recipient text: plaintext for sender + already-awarded guessers; **`—`** (or equivalent obfuscation) for others — never broadcast raw secret to spoiler-vulnerable recipients.
5. **Given** wrong phase or no secret **when** chat is sent **then** messages are normal chat only — **no** guess adjudication or `chatCorrectGuess` side effects (only `drawing` + `roundSecretWord` path compares).
6. **Given** wire protocol **when** clients render results **then** they use **server facts only** (`chatPlayerMessage.text`, `chatCorrectGuess.revealedWord` optional, `censoredAnnouncement`) — never infer correct word from local-only state.

## Tasks / Subtasks

- [x] **Audit server adjudication** (AC: #1–#5) — `apps/server/src/room/room-manager.ts` `applyChatMessage`, `broadcastPlayerChatWithPerRecipientText`, `broadcastCorrectGuess`; confirm `normalizeGuessText` / `sanitizeChatMessage` ordering matches shared docs.
- [x] **Audit shared normalization** (AC: #1) — `packages/shared/src/chat-text.ts` (`normalizeGuessText`, `assertChatMessageLength`); extend `chat-text.test.ts` if edge cases missing (unicode NFKC, multi-space, empty-after-normalize).
- [x] **Audit client rendering** (AC: #6) — `MatchChatPanel.tsx` `lineForCorrectGuess`: must use `censoredAnnouncement` when `revealedWord` absent; never substitute local secret.
- [x] **Tests** — Keep/grow `apps/server/src/room-ws.integration.test.ts`: existing **`chatCorrectGuess omits revealedWord for players still guessing (FR21)`**; add cases if gaps: duplicate guess **`•••`** to spectator, drawer exact-word **`—`** to non-privileged, whitespace/case variant of secret, non-drawing chat bypasses adjudication.
- [x] **Cross-story** — Do not fork scoring: awards stay in `applyCorrectGuessAward` / roster broadcast (Story 4.3 may refine ledger messaging only). Do not break round-end when all guessers awarded (`allNonDrawerGuessersAwarded` + transition).

## Dev Notes

### Brownfield state (read before coding)

- **Large portions of this story already exist** from `dc342eb` (`feat(epic-4): implement chat functionality for real-time interaction`): `applyChatMessage` exact-match branch, spoiler-safe fan-out, `broadcastCorrectGuess` optional `revealedWord`.
- **Dev-story scope:** treat as **verification + gap fill** — prove every acceptance criterion with a test or explicit code path comment where policy is non-obvious; avoid rewriting working fan-out without cause.

### Architecture compliance

- **Server-authoritative:** Client sends **`chatMessage`** intent only; server emits **`chatPlayerMessage`** / **`chatCorrectGuess`** facts ([Source: `_bmad-output/project-context.md` — Engine rules, anti-spoiler]).
- **Single protocol source:** Event/command shapes only in `packages/shared/src/schemas.ts`; parse client-side with `safeParseServerEvent` patterns ([Source: `_bmad-output/project-context.md`]).
- **Structured errors:** Chat failures use stable codes from `handle-client-command.ts` (`CHAT_EMPTY`, `CHAT_TOO_LONG`, `WRONG_PHASE`, `GUESSER_IS_DRAWER`, `BAD_ROOM`, …) — extend only with new **documented** codes if needed.

### Developer guardrails / file map

| Concern | Location |
|--------|----------|
| Adjudication + broadcasts | `apps/server/src/room/room-manager.ts` — `applyChatMessage`, `broadcastPlayerChatWithPerRecipientText`, `broadcastCorrectGuess` |
| Command entry | `apps/server/src/protocol/handlers/handle-client-command.ts` — `chatMessage` |
| Normalization + sanitization | `packages/shared/src/chat-text.ts` |
| Schema + FR21 docs on optional field | `packages/shared/src/schemas.ts` — `chatCorrectGuess` |
| Chat UI spoiler-safe display | `apps/web/src/features/match/components/MatchChatPanel.tsx` — `lineForCorrectGuess` |
| Feed wiring | `use-host-create-room.ts`, `use-guest-join-room.ts` — `chatCorrectGuess` / `chatPlayerMessage` cases |

### EPIC 4 cross-story context

- **4.1** — Transcript + composer; consumes the events this story guarantees.
- **4.3** — Score awards / drawer bonuses; `applyCorrectGuessAward` already invoked on successful first match — do not move scoring into UI.
- **4.4** — Celebration UX beats (pulse, motion-reduce); partial in `MatchChatPanel`; don’t block 4.2 on polish unless AC conflicts.

### UX / product notes

- **FR21 obfuscation strings:** Current implementation uses **`•••`**, **`—`**, and templated **`censoredAnnouncement`** (`${senderName} guessed the word!`). If `ux-design-specification.md` prescribes different copy, align in **one** place (prefer server-generated strings for consistency).
- **UX-DR11 / DR18** — Correct-guess rows vs player rows: `chatCorrectGuess` renders as success-styled line; player duplicate-guess uses normal player row with masked text.

### Previous story intelligence (4.1)

- `broadcastPlayerChatWithPerRecipientText` is the **only** primitive for spoiler-differentiated `chatPlayerMessage` payloads — reuse; don’t add a second fan-out path.
- Hooks maintain bounded `chatFeed` (`MAX_CHAT_FEED`); adjudication must not spam unbounded synthetic events.
- Drawer cannot score as guesser: enforced before award path ([Source: `_bmad-output/implementation-artifacts/4-1-chatpanel-composer-realtime-history.md`]).

### Git intelligence

- `dc342eb` — Epic 4 chat: `room-manager` chat pipeline, `MatchChatPanel`, hooks, shared schemas.

### Latest tech / versions

- Re-verify pins in root / workspace `package.json` and `_bmad-output/project-context.md` (Next ~16.x, React ~19.x, Zod 4.x, `ws` 8.x) before changing dependencies.

### Project Context Rules (extract)

- Parse **all** WS JSON through shared Zod; invalid → structured **`error`** with stable **`code`**.
- **`pnpm`** workspaces; **`@skribbl/shared`** is sole wire-type authority.
- **Anti-spoiler:** Do not expose secret in client-derived state; follow server per-recipient rules ([Source: `_bmad-output/project-context.md`]).
- **Testing:** Vitest server/shared integration; prefer real WS paths for adjudication regressions.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.2, FR20–FR21]
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Guessing / exact match / hide spoiler]
- [Source: `_bmad-output/game-architecture.md` — Chat & guessing]
- [Source: `_bmad-output/implementation-artifacts/4-1-chatpanel-composer-realtime-history.md` — prior file map and protocol]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Verified `applyChatMessage`: sanitize → length → `normalizeGuessText` on message and secret only when `phase === "drawing"` and secret set; drawer branch uses `—`; duplicate award uses `•••`; `broadcastCorrectGuess` gates `revealedWord` per recipient (guesser, drawer, already awarded).
- Extended `chat-text.test.ts` (NFKC fullwidth Latin, multi-space collapse, empty-after-normalize via trim).
- Exported `lineForCorrectGuess` and added `MatchChatPanel.test.tsx` for AC6 (censored vs revealed).
- Integration tests: lobby chat no `chatCorrectGuess`; duplicate guess masks spectator `•••`; drawer secret masks spectator `—`; existing uppercase/spacing guess path unchanged.

### File List

- `_bmad-output/implementation-artifacts/4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts.md`
- `packages/shared/src/chat-text.test.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `apps/web/src/features/match/components/MatchChatPanel.tsx`
- `apps/web/src/features/match/components/MatchChatPanel.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-05-01** — Story authored via `gds-create-story 4-2`; status `ready-for-dev`.
- **2026-05-01** — Dev story complete: tests + audits; status `review`; sprint entry `4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts` → `review`.
- **2026-05-01** — Code review addressed (composer grapheme parity, `lineForCorrectGuess` trim, chat error mapping, secret sanitize before compare); status `done`; sprint → `done`.

---

## Questions / clarifications (optional — for product owner)

- Should the **first** correct guess also emit a **`chatPlayerMessage`** line (in addition to `chatCorrectGuess`), or is celebration-only event acceptable? Current server emits **`chatCorrectGuess`** only on award success.
