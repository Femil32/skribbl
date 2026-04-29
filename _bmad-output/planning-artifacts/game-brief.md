---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/brainstorming-session-2026-04-24.md'
documentCounts:
  brainstorming: 1
  research: 0
  notes: 0
workflowType: 'game-brief'
lastStep: 8
project_name: 'skribbl'
user_name: 'Femil'
date: '2026-04-24'
game_name: 'Skribbl'
status: 'complete'
---

# Game Brief: Skribbl

**Date:** 2026-04-24
**Author:** Femil
**Status:** Complete — Ready for GDD Development

---

## Executive Summary

**Skribbl** is a browser-based real-time multiplayer draw-and-guess party game where players take turns drawing words while others race to guess correctly in a live chat.

**Target Audience:** Recruiters, hiring managers, and fellow developers evaluating Femil's portfolio — plus casual gamers looking for a quick social game.

**Core Pillars:** Real-Time Sync, Social Fun, Clean Architecture

**Key Differentiators:** Production-grade code quality, full-stack technical showcase (WebSocket, Canvas API, game state management), and polished micro-interactions that elevate perceived quality.

**Platform:** Web (Desktop browsers) — instant access, zero install.

**Success Vision:** A portfolio centerpiece that demonstrates real-time multiplayer engineering, interactive frontend mastery, and thoughtful game feel — playable, polished, and code-reviewable.

---

## Game Vision

### Core Concept

A real-time multiplayer Pictionary-style web game where one player draws a secret word on a shared canvas while others race to guess it in chat — showcasing full-stack engineering through WebSocket communication, Canvas API rendering, and scalable room-based architecture.

### Elevator Pitch

**Skribbl** drops you into a room with friends where one player draws and everyone else types guesses as fast as they can. It's simple, it's social, and it's built from scratch with production-grade WebSocket architecture, real-time canvas sync, and a polished UI — the kind of project that makes hiring managers stop scrolling.

### Vision Statement

Create a multiplayer game that's genuinely fun to play and technically impressive to review. Every line of code should demonstrate engineering maturity — clean separation of concerns, scalable patterns, real-time state management — while the game itself delivers the quick-hit dopamine of competitive guessing and the creative joy of drawing under pressure. This is the project that proves full-stack capability in a single URL.

---

## Target Market

### Primary Audience

**Technical recruiters, hiring managers, and senior engineers** evaluating Femil's portfolio.

**Demographics:**
- Tech industry professionals, ages 25–45
- Familiar with web technologies
- Looking for evidence of full-stack capability, code quality, and architectural thinking
- Engage with portfolio projects for 2–5 minutes max

**What They're Looking For:**
- Clean, well-structured codebase
- Real-time multiplayer architecture (WebSocket)
- Interactive frontend (Canvas API)
- Production-ready patterns (error handling, scalability, state management)

### Secondary Audience

**Casual gamers and friends** who want a quick, fun draw-and-guess session.

- Ages 13–35, browser gamers
- Play in short 10–20 minute sessions
- Value simplicity — no accounts, no installs, just a link and go
- Motivated by social fun, friendly competition, and creative expression

### Market Context

The draw-and-guess genre is well-established with proven demand:

**Similar Successful Games:**

| Game | Key Strength | Monthly Visits |
|------|-------------|---------------|
| **Skribbl.io** | Simplicity, instant play, custom word lists | ~30M+ |
| **Gartic.io** | Polish, large rooms (50+), themed dictionaries | ~20M+ |
| **Drawize** | Team modes, professional events, advanced tools | ~2M+ |

**Market Opportunity:**
This is a portfolio project, not a commercial product. The market validation is already done — the genre works. The opportunity is to demonstrate that Femil can build a production-quality version of a proven concept from scratch, with clean architecture and thoughtful UX polish.

---

## Game Fundamentals

### Core Gameplay Pillars

1. **Real-Time Sync** — Every stroke, every guess, every score update happens instantly across all connected players. Latency and desync are the enemies. If it doesn't feel live, it doesn't work.

2. **Social Fun** — The game exists to create moments of laughter, competition, and creative chaos between friends. Mechanics serve social interaction, not the other way around.

3. **Clean Architecture** — The codebase is as much a deliverable as the game itself. Every system should be readable, maintainable, and demonstrably scalable. No shortcuts that sacrifice code quality for speed.

**Pillar Priority:** When pillars conflict, prioritize: Real-Time Sync > Social Fun > Clean Architecture. (A beautifully architected game that lags is worse than a slightly messy game that feels instant.)

### Primary Mechanics

| Mechanic | Player Action | Pillar Served |
|----------|--------------|---------------|
| **Draw** | Select tools (colors, brush sizes, eraser, fill, clear), draw on canvas | Real-Time Sync, Social Fun |
| **Guess** | Type guesses in chat, get instant feedback (correct/close/wrong) | Social Fun |
| **Choose Word** | Drawer picks 1 of 3 random words (easy/medium/hard) | Social Fun |
| **Score** | Points awarded based on guess speed; drawer earns based on correct guesses | Social Fun |
| **Create/Join Room** | Create a room with shareable link/code, join via URL | Clean Architecture |
| **Rotate** | Turns cycle through all players across N rounds | Real-Time Sync |

**Core Loop:** Join Room → Lobby → Start Game → [Choose Word → Draw/Guess → Score → Rotate Drawer] × Rounds → End-Game Scoreboard → Play Again

### Player Experience Goals

| Emotion | When It Happens | How It's Designed |
|---------|----------------|-------------------|
| **Competitive Thrill** | Racing to guess before others | Speed-based scoring, visible guess attempts |
| **Creative Pressure** | Drawing with a ticking timer | 80s countdown, color-shifting timer |
| **"Aha!" Delight** | Letter hints click into place | Progressive hint reveals |
| **Social Connection** | Laughing at bad drawings, celebrating guesses | Chat messages, correct-guess celebrations |
| **Satisfaction** | Winning a round or the game | Score animations, final leaderboard |

**Emotional Journey:** Anticipation (waiting for turn) → Pressure (drawing/guessing under time) → Relief/Celebration (correct guess) → Competitive Drive (scoreboard comparison) → Satisfaction (end-game results)

---

## Scope and Constraints

### Target Platforms

**Primary:** Web (Desktop browsers — Chrome, Firefox, Safari, Edge)
**Secondary:** None for v1. Mobile-responsive layout is a stretch goal, but touch drawing is deferred.

### Development Timeline

Solo developer project. Core functionality is the priority — polish can be iterated.

### Budget Considerations

**Budget:** $0 — self-funded portfolio project.

- **Hosting:** Free tier options (Vercel/Railway for frontend, Railway/Render for WebSocket server)
- **Assets:** No purchased assets — procedurally generated avatars, CSS-based UI
- **Tools:** Open-source stack only
- **Domain:** Optional — can demo from free hosting URL

### Team Resources

**Team:** Solo developer (Femil)

- **Roles Covered:** Design, frontend, backend, DevOps
- **Skills:** JavaScript/TypeScript, Node.js, React/Next.js, WebSocket, Canvas API
- **Availability:** Part-time (portfolio project alongside other work)

**Skill Gaps:**
- Game-specific UX polish (mitigation: study Skribbl.io closely, iterate)
- Advanced Canvas performance optimization (mitigation: keep drawing tools simple)

### Technical Constraints

- **No user authentication** — name + avatar only (reduces complexity, faster onboarding)
- **WebSocket server required** — real-time is non-negotiable, must handle room state
- **Browser Canvas API** — 2D drawing, no WebGL required
- **Free hosting** — must work within free tier limits (connection limits, cold starts)
- **No database** — game state is ephemeral (in-memory on server), no persistence needed for v1

---

## Reference Framework

### Inspiration Games

**Skribbl.io**
- **Taking:** Core draw-and-guess loop, 3-word choice for drawer, letter hints, speed-based scoring, private rooms
- **Not Taking:** Dated UI/UX, lack of visual feedback on guesses, no real "game feel" polish

**Gartic.io**
- **Taking:** Smoother visual polish, cleaner chat interface, responsive feel
- **Not Taking:** Complex themed dictionaries, large room support (50+ players), social features

**Jackbox Party Packs (Drawful)**
- **Taking:** The energy of social deduction drawing games, emphasis on fun > fidelity
- **Not Taking:** Phone-as-controller model, monetization, complex round structures

### Competitive Analysis

**Direct Competitors:**

| Competitor | Strength | Weakness |
|-----------|----------|----------|
| **Skribbl.io** | Industry standard, instant familiarity | Basic UI, no game feel polish, stale design |
| **Gartic.io** | Large player base, polished feel | Feature-heavy, no standout differentiation |
| **Drawize** | Team modes, professional events | Overly complex for casual play |

**Competitor Strengths:** Massive existing player bases, years of iteration, SEO dominance.

**Competitor Weaknesses:** All have dated codebases, minimal UX innovation in years, no open-source/portfolio-ready implementations. None are designed to impress technically — they're designed to acquire users.

### Key Differentiators

1. **Code-as-Portfolio** — The codebase IS the product. Clean architecture, documented patterns, and reviewable code are first-class features. No competitor optimizes for this.
2. **Micro-Interaction Polish** — Timer color transitions, correct-guess celebrations, close-guess feedback, cursor tool changes — small details that signal engineering maturity.
3. **Modern Tech Stack** — Built with current best practices (TypeScript, modern React patterns, structured WebSocket protocol) — not legacy PHP/jQuery.
4. **Zero-Friction Entry** — No accounts, no installs, no ads. Share a link, start playing.

**Unique Value Proposition:** The only Skribbl-style game built specifically to showcase production-grade full-stack engineering — playable AND reviewable.

---

## Content Framework

### World and Setting

**Setting:** Abstract/minimal — no narrative world. The "world" is a clean, modern game UI with a shared canvas. The aesthetic is the setting.

**Atmosphere:** Playful, energetic, slightly competitive. Think: game night with friends, not esports arena.

### Narrative Approach

**Approach:** Minimal/None — pure gameplay. Story is emergent through social interaction (the funny drawings, the clutch guesses, the trash talk in chat).

**Story Delivery:** N/A — no scripted narrative elements.

### Content Volume

**Word Lists:**
- ~300–500 words for v1, categorized by difficulty (easy/medium/hard)
- Curated for drawability — words that produce interesting drawings, not abstract concepts

**Game Sessions:**
- 3 rounds per game (configurable by host)
- ~80 seconds per drawing turn
- Full game session: ~10–15 minutes

**Replayability:** Driven by social dynamics and word randomization. Different players = different experience every time.

---

## Art and Audio Direction

### Visual Style

**Style:** Clean, modern 2D — flat design with subtle depth cues (shadows, layering). Think: Notion meets game UI. Not cartoony, not corporate — approachable and polished.

**Color Palette:**
- Dark mode primary (easier on eyes, modern feel)
- Vibrant accent colors for interactive elements (drawing tools, correct guesses, timer states)
- High contrast between canvas (white) and UI (dark)

**References:**
- Skribbl.io (layout structure)
- Figma/Notion (UI polish and spacing)
- Discord (chat interface feel)

**Animation:**
- Smooth transitions on state changes (round start/end, score updates)
- Timer color gradient (green → yellow → red)
- Correct guess celebration flash
- Canvas tool selection feedback

### Audio Style

**v1:** No audio. Deferred to post-v1 polish phase.

**Future consideration:** Minimal SFX (timer tick, correct guess chime, round transition). No music — players will have their own.

### Production Approach

- **UI:** Custom CSS — no heavy UI frameworks. Tailwind or vanilla CSS for maximum control
- **Canvas:** HTML5 Canvas API with quadratic bezier smoothing for strokes
- **Avatars:** Procedurally generated or simple emoji/initial-based avatars
- **Icons:** SVG-based tool icons (brush, eraser, fill, color picker)
- **No external asset dependencies** — everything built in-code

---

## Risk Assessment

### Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebSocket complexity exceeds estimate | Medium | High | Start with simplest protocol, iterate. Use Socket.io for abstraction |
| Canvas drawing feels choppy | Medium | High | Implement bezier smoothing early, test with real users |
| Free hosting limits block demo | Low | High | Architect for Dockerized deployment, keep multiple hosting options |
| Scope creep into "nice-to-have" features | High | Medium | Strict MVP enforcement — 12 must-haves only |
| Solo dev burnout | Medium | Medium | Timebox sessions, celebrate milestones |

### Technical Challenges

1. **Real-time canvas sync** — Transmitting drawing data efficiently over WebSocket without visible lag. Must optimize stroke batching and minimize payload size.
2. **Room state management** — Handling player join/leave, turn rotation, scoring, and game lifecycle on the server without race conditions.
3. **Canvas undo/redo** — Stroke-based undo requires maintaining drawing history (deferred to nice-to-have).
4. **Cross-browser Canvas rendering** — Ensuring consistent drawing experience across Chrome, Firefox, Safari.

### Market Risks

- **Not a commercial product** — market risk is effectively zero. The "market" is portfolio reviewers.
- **Genre saturation** — mitigated by positioning as a technical showcase, not a competitor to existing games.

### Mitigation Strategies

1. **Prototype first:** Build WebSocket + Canvas sync proof-of-concept before full implementation
2. **Incremental delivery:** Get the core loop working end-to-end, then polish
3. **Test with friends:** Real multiplayer testing early and often
4. **Code review mindset:** Write code as if it's being reviewed in a technical interview

---

## Success Criteria

### MVP Definition

The MVP is the minimum required to demonstrate a complete, playable multiplayer draw-and-guess game:

**MVP Features (12 must-haves from brainstorming):**

1. ✅ Real-time drawing sync via WebSocket
2. ✅ Room creation with shareable link/code
3. ✅ 3-word selection for drawer
4. ✅ Timer with auto-skip (80 seconds)
5. ✅ Score tracking per round
6. ✅ Round rotation (every player draws)
7. ✅ Drawing tools (colors, sizes, eraser, fill, clear)
8. ✅ Chat with guess auto-detection
9. ✅ Letter hints over time
10. ✅ Lobby/waiting room
11. ✅ End-game scoreboard
12. ✅ Player name + avatar

**MVP is NOT:**
- Custom word lists
- Mobile touch support
- Sound effects
- User accounts
- Persistent leaderboards

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Playability** | Full game loop works with 2–8 players | Manual testing with friends |
| **Code Quality** | Clean, documented, reviewable codebase | Self-review against style guide |
| **Real-Time Feel** | Drawing appears on other screens in <100ms | Performance testing |
| **Portfolio Impact** | Generates interview conversations | Qualitative feedback |
| **Completion** | All 12 MVP features working | Feature checklist |

### Launch Goals

1. **Deployed and accessible** via a public URL
2. **README** with architecture overview, tech stack, and setup instructions
3. **Clean Git history** with meaningful commits
4. **Playable demo** that works reliably for 2+ concurrent players
5. **Code quality** that passes self-review and demonstrates production patterns

---

## Next Steps

### Immediate Actions

1. **Create PRD** → Define detailed requirements from this brief (`gds-create-prd`)
2. **Architecture Design** → Plan tech stack, system design, and data flow (`gds-game-architecture`)
3. **Prototype** → WebSocket + Canvas sync proof-of-concept (validate the hardest technical risk first)
4. **Implementation** → Build MVP features incrementally, starting with the core loop

### Research Needs

- WebSocket protocol design for real-time drawing (stroke batching, delta updates)
- Canvas API performance optimization (bezier smoothing, efficient redraw)
- Free hosting options that support persistent WebSocket connections
- Word list curation (drawability scoring)

### Open Questions

1. **Tech stack decision:** Next.js + Socket.io? Or vanilla Node.js + raw WebSocket?
2. **Deployment target:** Vercel + separate WebSocket server? Or unified deployment on Railway/Render?
3. **State management:** Server-authoritative game state or client-side with server validation?
4. **Drawing protocol:** Send individual points, or batch strokes? How to handle fill tool sync?

---

## Appendices

### A. Research Summary

**Competitive Landscape (April 2026):**
- Skribbl.io remains the genre leader (~30M+ monthly visits), valued for simplicity
- Gartic.io is the polished alternative with larger room support
- Drawize targets structured events (team building, classrooms)
- No competitor optimizes for code quality or portfolio presentation
- The genre is mature but innovation has stalled — all major players have similar feature sets

### B. Stakeholder Input

**Primary Stakeholder:** Femil (solo developer)
- Goal: Portfolio showcase project
- Constraint: Part-time development, $0 budget
- Priority: Code quality and architecture over feature count

### C. References

- [Brainstorming Session (2026-04-24)](./_bmad-output/planning-artifacts/brainstorming-session-2026-04-24.md)
- [Skribbl.io](https://skribbl.io) — Primary reference game
- [Gartic.io](https://gartic.io) — Polish reference
- [Drawize](https://drawize.com) — Feature comparison

---

_This Game Brief serves as the foundational input for Game Design Document (GDD) creation._

_Next Steps: Use the `gds-create-prd` or `gds-create-gdd` workflow to create detailed design documentation._
