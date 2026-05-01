# Story 4.4: Correct-guess fan-out messaging & UX beats

Status: done

<!-- gds-create-story (2026-05-01). Ultimate context engine analysis completed — comprehensive developer guide created. Brownfield: `chatCorrectGuess` wire + `MatchChatPanel` pulse banner already exist; dev-story should prove FR23/UX-DR11/DR14 end-to-end and close any “unmistakable celebration” gaps without breaking spoiler or scoring paths. -->

## Story

As the room,

I want unmistakable announcements when someone nails it,

So celebrations stay readable (FR23, UX-DR11).

## Acceptance Criteria

1. **Given** a **`chatCorrectGuess`** event **when** any client renders match chat **then** the transcript includes a **success-styled row** whose text comes **only** from server fields via **`lineForCorrectGuess`** (**`revealedWord`** when present, else **`censoredAnnouncement`**) — **no** local inference of the secret (FR21/Story 4.2 AC6 remains intact).
2. **Given** the same **when** the UI emphasizes the moment **then** feedback is **noticeable and non-blocking**: it **must not** sit in a layer that **permanently covers** **`PhaseBar`**, timer, or **chat composer** — on desktop split, **`PhaseBar`** lives **above** the canvas/chat grid ([Source: **`LobbyHostPage.tsx`**, **`JoinRoomClient.tsx`**]); celebration chrome stays **inside** **`MatchChatPanel`** (or other agreed non-overlay region), consistent with UX-DR11.
3. **Given** **`prefers-reduced-motion`** **when** celebration animation runs **then** strong motion paths are **gated** (e.g. Tailwind **`motion-safe:`** / **`motion-reduce:`** on pulse or substitute **static** emphasis — opacity/border/icon per **`ux-design-specification.md`** motion guidance and UX-DR14).
4. **Given** back-to-back **`chatCorrectGuess`** events **when** each arrives **then** each celebration is **readable** (e.g. banner text updates, timer resets, transcript rows remain distinct) — **no** stuck global overlay and **no** unbounded duplicate chrome beyond existing **`MAX_CHAT_FEED`** behavior.
5. **Given** host and guest surfaces **when** comparing layouts **then** **parity**: both **`LobbyHostPage`** and **`JoinRoomClient`** wire **`MatchChatPanel`** the same way so celebrations behave identically for all roles.

## Tasks / Subtasks

- [x] **Audit current vs AC** (AC: #1–#5) — Trace **`chatCorrectGuess`** handling in **`use-host-create-room.ts`** and **`use-guest-join-room.ts`** into **`MatchChatPanel`**; confirm **`lineForCorrectGuess`** and **pulse banner** **`useEffect`** ([`MatchChatPanel.tsx`](../../apps/web/src/features/match/components/MatchChatPanel.tsx)) satisfy readability and layout constraints; adjust copy/styling/**`aria-live`** only if AC gaps appear (avoid second conflicting live region).
- [x] **Reduced-motion pass** (AC: #3) — Verify or extend Tailwind classes so reduced-motion users get **clear static** emphasis; if banner duration feels long under reduced motion, shorten timeout **only** when **`prefers-reduced-motion`** (match **`PhaseBar`** / Story 2.4 patterns).
- [x] **Optional accessibility polish** (AC: #2, UX spec) — If contrast relies on green alone, add **non-color cue** (icon or “Correct guess” label prefix) **without** leaking **`revealedWord`** to spoiler-safe clients.
- [x] **Tests** (AC: #1, #3–#5) — Extend **`MatchChatPanel.test.tsx`**: banner appears on last feed event; **`motion-reduce:animate-none`** (or equivalent) present on animated nodes; **`lineForCorrectGuess`** cases stay exhaustive. Add RTL or snapshot coverage only if needed for banner timing.
- [x] **Regression guard** — Do **not** change **`packages/shared`** **`chatCorrectGuess`** shape for MVP unless PM accepts schema churn; **do not** move scoring or **`censoredAnnouncement`** generation into the web app (server remains authoritative for fan-out strings).

## Dev Notes

### Brownfield state (read before coding)

- **Server fan-out already implements FR23 at the wire level:** **`broadcastCorrectGuess`** in **`apps/server/src/room/room-manager.ts`** emits per-recipient **`chatCorrectGuess`** with optional **`revealedWord`** ([Source: **`packages/shared/src/schemas.ts`**]).
- **Client already has partial “UX beats”:** **`MatchChatPanel`** shows a **~3.6s** top **`pulseBanner`** on latest **`chatCorrectGuess`**, success rows in the **`role="log"`** list, **`motion-safe:animate-pulse`** + **`motion-reduce:animate-none`** on the banner ([Source: **`MatchChatPanel.tsx`**]).
- **Treat Story 4.4 as polish + verification** unless audit finds AC failures — align behavior with **UX-DR11** (non-blocking, doesn’t obscure canvas/toolbar) and **UX-DR14** (reduced motion).

### Architecture compliance

- **Server-authoritative strings:** Keep **`censoredAnnouncement`** and **`revealedWord`** policy in **`room-manager`** / shared helpers — UI only renders facts ([Source: **`project-context.md`**]).
- **Single protocol source:** Any new optional UI-only fields still go through **`@skribbl/shared`** if they cross the wire; **omit** unless PRD expands scope ([Source: **4.3 optional PO question** on inline point deltas]).
- **Layout:** Match shell is **classic split** (canvas + chat column); **`PhaseBar`** is **not** inside the chat card — verify on **narrow** breakpoints that chat **max-height** and banner **shrink-0** still leave composer usable (AC #2).

### Developer guardrails / file map

| Concern | Location |
|--------|----------|
| Correct-guess row + banner UX | **`apps/web/src/features/match/components/MatchChatPanel.tsx`** |
| Unit tests | **`apps/web/src/features/match/components/MatchChatPanel.test.tsx`** |
| Event demux + feed | **`apps/web/src/features/lobby/hooks/use-host-create-room.ts`**, **`use-guest-join-room.ts`** — **`case "chatCorrectGuess"`** |
| Host/guest page layout | **`apps/web/src/features/lobby/components/LobbyHostPage.tsx`**, **`apps/web/src/app/join/JoinRoomClient.tsx`** |
| Wire schema | **`packages/shared/src/schemas.ts`** — **`chatCorrectGuess`** |
| Server broadcast | **`apps/server/src/room/room-manager.ts`** — **`broadcastCorrectGuess`**, **`applyChatMessage`** |

### EPIC 4 cross-story context

- **4.1** — Transcript + composer; 4.4 must **not** break **`chatPlayerMessage`** / **`chatSystemMessage`** row patterns.
- **4.2** — Adjudication + spoiler-safe **`revealedWord`** rules; **never** bypass **`lineForCorrectGuess`** with local state.
- **4.3** — Scores update via **`lobbyRoster`** before **`chatCorrectGuess`**; celebration UX may **surface** new totals **only** from roster-driven UI (e.g. **`PhaseBar`** scores) — optional inline “+N points” in chat is **out of scope** unless schema extended.

### Previous story intelligence (4.3)

- **Ordering invariant:** **`broadcastLobbyRoster`** runs inside **`applyCorrectGuessAward`** before **`chatCorrectGuess`** — UI beats should assume **scores already fresh** when celebration shows ([Source: **`4-3-score-awards-drawer-bonuses-wiring.md`**]).
- **Structured logging:** **`correct_guess_award`** is for operators — do not duplicate in UI; use **player-visible** strings from events only.

### Git intelligence

- **`97fcbaf` / `c10c4cb`** — Guess adjudication + **`chatCorrectGuess`** ([Epic 4.2]).
- **`a43c127` / `5c5dab7`** — Score awards + logging ([Story 4.3]).

### Latest tech / versions

- Re-verify pins in **`_bmad-output/project-context.md`** (Next ~16.x, React ~19.x, Tailwind + DaisyUI) before adding deps; prefer **CSS-only** celebration (**`@media (prefers-reduced-motion)`** via Tailwind **`motion-*`**) over animation libraries.

### Project Context Rules (extract)

- Parse **all** WS JSON through **`@skribbl/shared`** Zod; **no** parallel message shapes in **`apps/web`**.
- **`pnpm`** workspaces; **`@skribbl/shared`** sole wire authority.
- **Anti-spoiler:** chat display must follow server per-recipient payloads only.
- **Testing:** Vitest for **`MatchChatPanel`**; keep tests fast — avoid pulling **Playwright** into this story unless E2E gap is explicit.

### References

- [Source: **`_bmad-output/planning-artifacts/epics.md`** — Epic 4, Story 4.4, FR23]
- [Source: **`_bmad-output/planning-artifacts/prd.md`** — FR23]
- [Source: **`_bmad-output/planning-artifacts/ux-design-specification.md`** — Feedback/motion, classic split layout]
- [Source: **`_bmad-output/planning-artifacts/epics.md`** — UX-DR11, UX-DR14]
- [Source: **`_bmad-output/implementation-artifacts/4-2-guess-adjudication-exact-match-spoiler-safe-broadcasts.md`**]
- [Source: **`_bmad-output/implementation-artifacts/4-1-chatpanel-composer-realtime-history.md`**]

## Dev Agent Record

### Agent Model Used

Cursor agent (composer)

### Debug Log References

-

### Completion Notes List

- **Audit:** Confirmed **`use-host-create-room`** and **`use-guest-join-room`** append **`chatCorrectGuess`** into **`chatFeed`** symmetrically (**`slice(-MAX_CHAT_FEED)`**). **`LobbyHostPage`** / **`JoinRoomClient`** pass the same **`MatchChatPanel`** props under match flow; parity AC met (guest **`matchEnded`** wrapper is layout-only outside the chat card).
- **UX:** Exported dwell constants **`CORRECT_GUESS_BANNER_MS` (3600)** and **`CORRECT_GUESS_BANNER_MS_REDUCED_MOTION` (2200)**; **`matchMedia("(prefers-reduced-motion: reduce)")`** selects shorter dwell. Banner + transcript rows include **`✓`** (**`aria-hidden`**) so success is not color-only; **`lineForCorrectGuess`** unchanged for transcript **`span`** text (AC #1 server-only strings preserved).
- **Tests:** Added RTL coverage for banner, **`motion-safe:` / `motion-reduce:`** classes, dwell timings under fake timers, back-to-back feed updates; enabled **`@testing-library/jest-dom`** in **`vitest.setup.ts`** for matchers.

### File List

- `apps/web/src/features/match/components/MatchChatPanel.tsx`
- `apps/web/src/features/match/components/MatchChatPanel.test.tsx`
- `apps/web/vitest.setup.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Resolved] Pulse banner stuck when feed tail moved off `chatCorrectGuess` — fixed 2026-05-02: clear `pulseBanner` when the latest feed event is not `chatCorrectGuess`; regression test in `MatchChatPanel.test.tsx`.

---

## Questions / clarifications (optional — for product owner)

- Should **`chatCorrectGuess`** carry **optional `guesserPointsAwarded` / `drawerAssistAwarded`** for inline celebration copy, or is **roster + PhaseBar** sufficient for MVP? (Deferred from Story 4.3.)

---

## Change Log

- **2026-05-02** — Story 4.4 implemented: reduced-motion dwell, check icon cue, **`MatchChatPanel`** tests + jest-dom Vitest matchers; **`@skribbl/shared`** unchanged; sprint → **`review`**.
- **2026-05-02** — GDS code review: 0 `decision_needed`, 0 `patch`, 1 `defer` (pre-existing pulse banner / feed edge case), 2 dismissed (duplicate `aria-live` concern pre-dates this diff; narrow-viewport AC2 called out in completion notes). Status → **`done`**; sprint synced.
- **2026-05-02** — Post-review fix: pulse banner clears when feed tail is no longer `chatCorrectGuess` (code review defer closed).
