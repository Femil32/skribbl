# Implementation Readiness Assessment Report

**Date:** 2026-05-05
**Project:** skribbl

---

## Step 1: Document Discovery

### Documents Inventoried

**GDD:**
- `_bmad-output/planning-artifacts/gdd.md` (11KB, 2026-04-29)

**Architecture:**
- `_bmad-output/game-architecture.md` (full architecture doc — lives at project root, not planning-artifacts)

**Epics & Stories:**
- `_bmad-output/planning-artifacts/epics.md` (41KB, 2026-05-05) ✅ provided as argument

**UX Design:**
- `_bmad-output/planning-artifacts/ux-design-specification.md` (38KB, 2026-04-29)

**Supporting:**
- `_bmad-output/planning-artifacts/prd.md` (15KB, 2026-04-29)
- `_bmad-output/project-context.md` (loaded as persistent fact)

**No duplicates found. No sharded versions detected.**

---

## GDD Analysis

### Functional Requirements (from PRD, referenced by GDD)

FR1: A player can create a new private room and receive a shareable link/code.
FR2: A player can join a room via a shareable link or code.
FR3: A player can enter a display name and choose an avatar before joining.
FR4: The host can start the game when at least 2 players are in the room.
FR5: The system automatically assigns the "Drawer" role to players in a round-robin format.
FR6: The current Drawer can select one word from a choice of 3 randomized words.
FR7: The system enforces an 80-second timer per drawing round.
FR8: The system automatically skips the turn if the timer expires before all players guess correctly.
FR9: The system reveals partial letter hints to guessers over time.
FR10: The system tracks and calculates scores based on how quickly a player guessed the word.
FR11: The system displays a final scoreboard at the end of all rounds.
FR12: The Drawer can draw freehand strokes on the canvas.
FR13: The Drawer can select different stroke colors.
FR14: The Drawer can select different stroke thicknesses.
FR15: The Drawer can use an eraser tool to remove strokes.
FR16: The Drawer can use a fill tool to color enclosed areas.
FR17: The Drawer can clear the entire canvas with a single action.
FR18: The system broadcasts drawing strokes to all guessers in real time.
FR19: Players can send text messages to a real-time room chat.
FR20: The system detects if a chat message exactly matches the target word.
FR21: The system prevents the exact word guess from being broadcasted to players who haven't guessed it.
FR22: The system awards points to the guesser and the Drawer when a correct guess is made.
FR23: The system notifies all players in the chat when a player successfully guesses the word.
FR24: (Growth) The system identifies close guesses and provides a "You're close!" feedback message privately to the guesser.
FR25: A player can reconnect to an active game session without losing their score or identity.
FR26: The system transmits the current canvas state and chat history to a reconnecting player.
FR27: The system marks disconnected players in the UI to notify active players.

**Total FRs: 27**

### Non-Functional Requirements

NFR-P1: Drawing strokes must be broadcasted to all connected room peers within 100ms under normal network conditions.
NFR-P2: The HTML5 Canvas must render incoming and outgoing strokes at a consistent 60 FPS on modern hardware.
NFR-P3: Coordinate data for strokes must be batched (~50ms intervals) to prevent network congestion.
NFR-S1: Server must reliably handle at least 8 active connections per room without measurable latency degradation.
NFR-S2: Backend must support 100 concurrent rooms on a standard single-core server instance.
NFR-SEC1: A player cannot join or observe a private room without the exact, randomly generated connection code/link.
NFR-SEC2: All chat inputs and player names must be aggressively sanitized to prevent XSS attacks.
NFR-U1: Drawing canvas must accurately map both standard mouse events and touch events.
NFR-O1: WebSocket connection failures and room join errors must surface clear, user-facing messages without exposing internal stack traces.
NFR-O2: Server-side logging must be sufficient to diagnose room/state issues during development and demo.

**Total NFRs: 10**

### GDD Completeness Assessment

GDD is complete and well-scoped. FRs enumerated in PRD, cross-referenced from GDD. All mechanics have clear implementation guidance. Growth scope (FR24) properly isolated.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | Epic/Story | Status |
|----|-----------|--------|
| FR1 | Epic 1 — Story 1.2, 1.3 | ✓ Covered |
| FR2 | Epic 1 — Story 1.4 | ✓ Covered |
| FR3 | Epic 1 — Story 1.5 | ✓ Covered |
| FR4 | Epic 1 — Story 1.6 | ✓ Covered |
| FR5 | Epic 2 — Story 2.2 | ✓ Covered |
| FR6 | Epic 2 — Story 2.3 | ✓ Covered |
| FR7 | Epic 2 — Story 2.4 | ✓ Covered |
| FR8 | Epic 2 — Story 2.4 | ✓ Covered |
| FR9 | Epic 2 — Story 2.5 | ✓ Covered |
| FR10 | Epic 2 — Story 2.6 | ✓ Covered |
| FR11 | Epic 2 — Story 2.7 | ✓ Covered |
| FR12 | Epic 3 — Story 3.3 | ✓ Covered |
| FR13 | Epic 3 — Story 3.5 | ✓ Covered |
| FR14 | Epic 3 — Story 3.5 | ✓ Covered |
| FR15 | Epic 3 — Story 3.6 | ✓ Covered |
| FR16 | Epic 3 — Story 3.6 | ✓ Covered |
| FR17 | Epic 3 — Story 3.6 | ✓ Covered |
| FR18 | Epic 3 — Story 3.4 | ✓ Covered |
| FR19 | Epic 4 — Story 4.1 | ✓ Covered |
| FR20 | Epic 4 — Story 4.2 | ✓ Covered |
| FR21 | Epic 4 — Story 4.2 | ✓ Covered |
| FR22 | Epic 4 — Story 4.3 | ✓ Covered |
| FR23 | Epic 4 — Story 4.4 | ✓ Covered |
| FR24 | Epic 7 (Growth — deferred) | ⚠️ Intentionally deferred |
| FR25 | Epic 5 — Story 5.1 | ✓ Covered |
| FR26 | Epic 5 — Story 5.2 | ✓ Covered |
| FR27 | Epic 5 — Story 5.3 | ✓ Covered |

### Missing Requirements

None. All MVP FRs (FR1–FR23, FR25–FR27) fully covered. FR24 deliberately deferred to Growth Epic 7.

### Coverage Statistics

- Total GDD FRs: 27
- FRs covered in epics: 26 MVP + 1 Growth deferred
- MVP coverage: **100%**

---

## UX Alignment Assessment

### UX Document Status

**Found:** `_bmad-output/planning-artifacts/ux-design-specification.md` (38KB, 2026-04-29, status: complete)

### UX ↔ GDD Alignment

| UX Requirement | GDD Support | Status |
|---|---|---|
| Direction 1 desktop split (canvas left, chat right) | GDD specifies desktop-first responsive layout | ✓ Aligned |
| Cyan accent system (Direction 5) | GDD art direction: clean modern Tailwind/DaisyUI | ✓ Aligned |
| Timer semantic progression (healthy→urgent→critical) | GDD: 80s timer, fixed tension arc | ✓ Aligned |
| Tailwind/DaisyUI design system | GDD and stack spec explicitly require same | ✓ Aligned |
| Anti-spoiler chat (FR21 UX rules) | GDD: exact match detection, spoiler-safe broadcast | ✓ Aligned |
| Reconnect recovery UX | GDD FR25–FR27 resilience goals | ✓ Aligned |
| Direction 8 softer radii on lobby/scoreboard | GDD art direction: clean, modern — partially implied | ⚠️ Minor: not explicitly required by GDD, but not conflicting |
| Spectator mode | GDD: explicitly Out of Scope | ✓ Aligned (both exclude) |

### UX ↔ Architecture Alignment

| UX Requirement | Architecture Support | Status |
|---|---|---|
| UX-DR1: Theme tokens (CSS vars/Tailwind) | Architecture: Tailwind/DaisyUI specified | ✓ Supported |
| UX-DR2: Responsive split layout | Architecture: Next.js App Router, responsive breakpoints | ✓ Supported |
| UX-DR3: DrawingCanvas + ResizeObserver | Architecture: Canvas 2D, coordinate mapping rules | ✓ Supported |
| UX-DR4–DR10: All game UI components | Architecture: feature folders, component structure | ✓ Supported |
| UX-DR11: Toast feedback | Architecture: React patterns, no architectural blocker | ✓ Supported |
| UX-DR13: WCAG AA accessibility | Architecture: no conflicting requirements | ✓ Supported |
| UX-DR14: prefers-reduced-motion | Architecture: no conflicting requirements | ✓ Supported |
| UX-DR15: data-testid hooks | Architecture: Playwright E2E spec | ✓ Supported |
| Performance (60 FPS, <100ms) | Architecture: NFR-P1–P3 enforced server+client | ✓ Supported |

### UX-DR Coverage in Epics

All 18 UX-DRs (UX-DR1–UX-DR18) are distributed across Epics 1–6 stories. Epics doc confirms: "UX-DR1–UX-DR18 addressed across Epics 1–6."

### Warnings

⚠️ **Minor:** UX spec references "Direction 8 softer radii on lobby/end-game screens" as a potential influence. No story explicitly targets this. It's a styling detail that can be applied ad-hoc during implementation without a dedicated story — low risk.

⚠️ **Minor:** UX spec mentions optional SFX (correct guess, tick/tock) as Growth/deferred. No story tracks this. Confirmed deferred by GDD. No action needed.

---

## Epic Quality Review

### Epic Structure Validation

| Epic | Title | Player-Centric? | Independent? | Verdict |
|------|-------|----------------|-------------|---------|
| Epic 1 | Party lobby & shareable rooms | ✓ Yes | ✓ Yes (foundation) | ✓ Pass |
| Epic 2 | Match rhythm — turns, timer, words & standings | ✓ Yes | ✓ Builds on Epic 1 only | ⚠️ See Story 2.6 issue |
| Epic 3 | Drawing pipeline & synced strokes | ✓ Yes | ✓ Builds on Epics 1–2 | ✓ Pass |
| Epic 4 | Chat guesses & secrecy | ✓ Yes | ✓ Builds on Epics 1–3 | ✓ Pass |
| Epic 5 | Session resilience & recovery | ✓ Yes | ✓ Builds on Epics 1–4 | ✓ Pass |
| Epic 6 | Portfolio shell & UX polish pass | ⚠️ Reviewer-centric title, not player-centric | ✓ Cross-cutting polish | 🟡 Minor |
| Epic 7 | Near-miss guess whisper | ✓ Yes | ✓ Deferred Growth | ✓ Pass |
| Epic 8 | Production Lobby — Persistence, Settings & Player Management | ✓ Yes | ⚠️ Conflicts with MVP in-memory arch | 🟠 See below |

---

### 🔴 Critical Violations

#### C1: Story 2.6 — Forward Dependency on Epic 4

**Story:** 2.6 Score rules & running totals (Epic 2)
**Violation:** AC reads: *"Given correct guess events from Epic 4 pipeline"*
**Problem:** Story 2.6 sits in Epic 2 but its acceptance criteria explicitly depend on the Epic 4 chat/guess pipeline being implemented. Story 2.6 **cannot be verified** until Epic 4 is complete — a forward dependency that breaks epic independence.
**Impact:** Implementation will get confused when testing scoring in Epic 2 without Epic 4. Devs may skip testing or discover the gap mid-sprint.
**Recommended Fix:** Split Story 2.6 into two parts:
- 2.6a (Epic 2): Define scoring rules as pure functions with unit tests using mocked guess events — no Epic 4 dependency
- 2.6b (Epic 4, or Story 4.3): Wire live guess events to scoring functions — backward dep on 2.6a is fine

---

### 🟠 Major Issues

#### M1: Story 1.1 — Technical Infrastructure Story (Greenfield Exception)

**Story:** 1.1 Scaffold monorepo & shared protocol package
**Issue:** Delivers no direct player value — it's a developer setup story.
**Mitigation:** Epics doc explicitly acknowledges this under "Bootstrap / Epic 1 Story 1 relevance." This is an accepted greenfield exception. The monorepo scaffold is prerequisite for all subsequent stories. **No action required** but noted for awareness.

#### M2: Story 2.1 — Technical State Machine Story

**Story:** 2.1 Match state machine skeleton & server timers
**Issue:** "Skeleton" framing suggests infrastructure, not player experience. ACs verify server-side behavior only — no player-observable outcomes articulated. A player cannot benefit from "server phase transitions" without the UI layers from Stories 2.2–2.7.
**Verdict:** Acceptable as a foundational story but ACs should ideally include at least one player-observable outcome (e.g., client receives phase broadcast). Currently ACs are purely server-side.
**Recommendation:** Add one AC: *"And connected clients receive typed phase-transition broadcasts they can render."*

#### M3: Epic 8 — Redis Dependency Conflicts with MVP In-Memory Architecture

**Issue:** Epics 1–7 are built on the architectural requirement: *"MVP ephemeral in-memory rooms — no MongoDB/ORM unless requirements change."* Epic 8 introduces Redis (Upstash or ioredis) as a persistent storage layer — a significant architectural shift.
**Risks:**
- Story 8.1 implementation touches `apps/server/lib/redis/client.ts` — a new module not referenced in Epics 1–7 architecture
- If a developer implements Epic 8 alongside Epics 1–7, they must refactor room state from in-memory Map to Redis — that refactor has no story
- No explicit migration/refactor story from in-memory → Redis room state
**Recommendation:** Add Story 8.0 (or note in 8.1): *"Refactor room manager from in-memory Map to Redis-backed store, maintaining API contract for existing handlers."* This is the missing bridge story.

#### M4: Story 3.1 — "Scaffold" Delivers Limited Standalone Player Value

**Story:** 3.1 Direction 1 match shell — canvas column + chat column scaffold
**Issue:** Title contains "scaffold" — ACs confirm it reserves landmark regions but doesn't deliver chat or canvas functionality. Player landing on this screen sees empty layout regions. This is technically a layout story, not a feature story.
**Verdict:** Acceptable as prerequisites go, but it should be noted that Epic 3 cannot deliver any observable player value until Stories 3.2–3.4 are also done. Sprint planning should treat 3.1+3.2+3.3+3.4 as a single deliverable batch for any demo.

---

### 🟡 Minor Concerns

#### mn1: Epic 6 Title is Reviewer-Centric, Not Player-Centric

"Portfolio shell & UX polish pass" signals portfolio positioning over player experience. The contents (accessibility, error boundaries, responsive QA) do serve players — the title just doesn't reflect that. Cosmetic issue; no functional impact.

#### mn2: Late-Join Behavior Not Explicitly Specced

GDD states: *"MVP may restrict joins to lobby phase only."* No story has an AC that explicitly gates or handles mid-game join attempts. Story 1.4 covers join-flow but only for lobby phase. What happens if someone tries to join via a link after the match starts? No story covers the error case.
**Recommendation:** Add AC to Story 1.4: *"And if room is in match-active phase, join attempt returns error with reason 'Game in progress.'"*

#### mn3: NFR-S1 / NFR-S2 Have No Dedicated Verification Story

NFR-S1 (8 players/room) and NFR-S2 (100 concurrent rooms) are mentioned in Story 1.2 AC as "caps honor configured MAX_PLAYERS toward NFR-S1" — a proxy, not a real test. No story includes a load/capacity test.
**Verdict:** Acceptable for MVP portfolio scope — these are aspirational targets. But flag for post-launch: no story will formally verify these NFRs during implementation.

#### mn4: Story 8.1 ACs are Primarily Technical

Most Story 8.1 ACs describe Redis client implementation details (adapters, TTL, env vars) rather than player-observable outcomes. The player benefit is real (identity persists) but buried under technical verification steps.
**Verdict:** Functional, but ACs could be improved. Low priority.

#### mn5: "Partial" FR Coverage Labels Not Tracked to Completion

Stories 3.3 (FR12 partial) and 3.4 (FR18 partial) use "partial" labels. This is intentional (client-side vs server-side split) but could mislead future readers into thinking the FR was only half-implemented. Recommend removing "partial" qualifier from FR references once implementation confirms full coverage.

---

### Best Practices Compliance Summary

| Epic | Player Value | Independent | Story Sized | No Fwd Deps | Clear ACs | FR Traced |
|------|-------------|------------|------------|------------|----------|----------|
| Epic 1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 2 | ✓ | ✓ | ✓ | ❌ Story 2.6 | ⚠️ Story 2.1 | ✓ |
| Epic 3 | ✓ | ✓ | ⚠️ Story 3.1 | ✓ | ✓ | ✓ |
| Epic 4 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 5 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 6 | ⚠️ Title | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 7 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Epic 8 | ✓ | ⚠️ Redis arch | ✓ | ✓ | ⚠️ Story 8.1 | ✓ |

---

## Summary and Recommendations

### Overall Readiness Status

**⚠️ NEEDS WORK — Conditionally Ready**

Core Epics 1–7 are well-structured with 100% FR coverage and strong UX/architecture alignment. One critical forward dependency must be fixed before implementation. Epic 8 requires an architectural bridge story before it can be cleanly implemented on top of Epics 1–7.

---

### Critical Issues Requiring Immediate Action

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| C1 | 🔴 Critical | Story 2.6 AC depends on "Epic 4 pipeline" — forward dependency | Split into 2.6a (pure scoring logic, Epic 2) + 2.6b (wired to guess events, Epic 4) |
| M3 | 🟠 Major | Epic 8 has no bridge story for in-memory → Redis room state migration | Add Story 8.0: "Migrate room manager from in-memory Map to Redis-backed store" |
| mn2 | 🟡 Minor | Late-join after match starts — no AC covers this GDD-specified edge case | Add AC to Story 1.4 for match-active phase join rejection |

---

### Recommended Next Steps

1. **Fix Story 2.6 forward dependency (C1)** — Split scoring story before starting Sprint 2. Scoring logic as pure functions (2.6a) in Epic 2, integration wiring (2.6b) in Epic 4 alongside Story 4.3.

2. **Add Story 8.0 Redis migration bridge (M3)** — Before implementing any Epic 8 story, add an explicit story that refactors `RoomManager` from in-memory Map to Redis-backed store while keeping all handler APIs stable.

3. **Add late-join gate AC to Story 1.4 (mn2)** — One-line AC addition. Prevents implementation gap discovered during testing.

4. **Treat Stories 3.1–3.4 as a single sprint batch (M4)** — Epic 3 has no shippable increment until canvas pipeline is complete. Plan accordingly; don't demo after 3.1 alone.

5. **Add one player-observable AC to Story 2.1 (M2)** — "And connected clients receive typed phase-transition broadcasts" — ensures state machine isn't purely server-internal with no client verification path.

6. **Proceed with Epics 1–7 implementation order as written** — Epic sequencing (1→2→3→4→5→6) is correct and dependency ordering is clean except for C1. After the split fix, all stories are independently completable.

---

### Issue Count by Severity

| Severity | Count | Must Fix Before Impl? |
|----------|-------|----------------------|
| 🔴 Critical | 1 | Yes |
| 🟠 Major | 4 | 2 of 4 (C1 split + Story 8.0 bridge) |
| 🟡 Minor | 5 | No — can fix in-flight |

---

### Final Note

Planning artifacts are **high quality** overall. GDD, Architecture, UX Spec, and Epics are internally consistent with strong cross-document traceability. FR1–FR27 are fully mapped. UX-DR1–DR18 are fully addressed. The identified issues are **specific and fixable** — not systemic planning failures.

**Assessed by:** Claude Code (GDS Implementation Readiness workflow)
**Date:** 2026-05-05
**Report file:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-05.md`
