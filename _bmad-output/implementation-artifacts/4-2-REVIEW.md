---
status: resolved
scope: story-4-2-guess-adjudication
depth: standard
files_reviewed: 6
critical: 0
warning: 0
info: 0
total: 0
---

# Code review: Story 4.2 (guess adjudication & spoiler-safe broadcasts)

**Resolved (2026-05-01):** WR-01 — client composer validates with `sanitizeChatMessage` + `assertChatMessageLength`, removed `maxLength={600}`, inline error. WR-02 — `lineForCorrectGuess` uses `revealedWord?.trim()`. IN-01 — `chatMessageErrorDetail()` maps `UNKNOWN_ROOM`, `NO_DRAWER`, `NOT_IN_MATCH`, `NO_DRAWING_START`, `INTERNAL`. IN-02 — secret compared via `normalizeGuessText(sanitizeChatMessage(secret))`. IN-03 — no code change (process note only).

**Scope:** Files from `4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts.md` plus server adjudication in `room-manager.ts` (referenced by AC but omitted from story file list).

**Verification:** `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, shared build — passed after fixes.

---

## Summary

Server adjudication matches FR20/FR21: drawing phase + secret required for exact match; `normalizeGuessText` on message and secret; drawer path avoids scoring and masks with `—`; duplicate awards mask with `•••`; `chatCorrectGuess` gates `revealedWord` by recipient. Client `lineForCorrectGuess` respects server facts. No critical security regressions found in reviewed paths.

---

### WR-01 — Chat input `maxLength` vs server grapheme cap *(fixed)*

**Location:** `apps/web/src/features/match/components/MatchChatPanel.tsx` (composer `maxLength={600}`)

**Issue:** Server enforces `CHAT_MESSAGE_MAX_GRAPHEMES` (200) after `sanitizeChatMessage`. The UI allows up to 600 code units, so users can compose long messages that reliably fail with `CHAT_TOO_LONG` only after send.

**Fix:** Align client cap with server policy (e.g. 200 graphemes or a conservative character cap plus server error copy), or show live grapheme count.

---

### WR-02 — `revealedWord` whitespace-only handling *(fixed)*

**Location:** `apps/web/src/features/match/components/MatchChatPanel.tsx` — `lineForCorrectGuess`

**Issue:** Only `""` is treated as absent; a whitespace-only `revealedWord` (should not happen if server only sends real words) would render as `Alex guessed:    ` instead of falling through to `censoredAnnouncement`.

**Fix:** Treat falsy/whitespace-only as absent, e.g. `const w = ev.revealedWord?.trim(); if (w) return ...`.

---

### IN-01 — Generic chat errors for award failures *(fixed)*

**Location:** `apps/server/src/protocol/handlers/handle-client-command.ts` — `chatMessage` branch

**Issue:** If `applyChatMessage` returns `{ ok: false }` from `applyCorrectGuessAward` with codes like `NOT_IN_MATCH`, `NO_DRAWING_START`, or `UNKNOWN_ROOM`, the user sees the generic “Message could not be sent.” string.

**Suggestion:** Map stable codes to specific messages where it aids debugging/support (optional).

---

### IN-02 — Secret not passed through `sanitizeChatMessage` *(fixed)*

**Location:** `apps/server/src/room/room-manager.ts` — `applyChatMessage` (secret vs `sanitized`)

**Issue:** User text is `sanitizeChatMessage` then `normalizeGuessText`; the secret uses `normalizeGuessText(secret)` only. For trusted word-bank strings this matches the story; exotic content in the bank could theoretically diverge from sanitized user input.

**Suggestion:** Document invariant (“word bank is plain text”) or normalize secret through the same sanitizer if the bank format ever widens.

---

### IN-03 — Story file list vs review surface

**Location:** Story “File List” vs implementation

**Issue:** The story’s file list omits `room-manager.ts` and `handle-client-command.ts`, which are central to AC1–AC5. Future reviews should include them explicitly for traceability.

---

## Positive notes

- Integration coverage for lobby bypass, FR21 omission, duplicate guess masking, and drawer secret fan-out is strong.
- `broadcastPlayerChatWithPerRecipientText` keeps a single spoiler-differentiation primitive; `broadcastCorrectGuess` correctly computes `mayReveal` from guesser, drawer, and awarded set.
- Shared `normalizeGuessText` + NFKC tests align with FR20.

---

## Residual risk

Race or phase transition between validation and award is unlikely in single-threaded Node processing but not formally exercised in tests; accept for MVP.
