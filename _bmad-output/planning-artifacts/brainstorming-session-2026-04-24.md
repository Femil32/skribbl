---
title: 'Game Brainstorming Session'
date: '2026-04-24'
author: 'Femil'
version: '1.0'
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
mode: 'yolo'
---

# Game Brainstorming Session

## Session Info

- **Date:** 2026-04-24
- **Facilitator:** Game Designer Agent
- **Participant:** Femil

---

## Brainstorming Approach

**Selected Mode:** YOLO (facilitator-driven, all techniques)
**Project Purpose:** Portfolio project — basic functionality, production-ready code
**Reference Game:** Skribbl.io (multiplayer draw-and-guess)

**Techniques Used:**
1. Core Loop Design
2. MDA Framework
3. Player Fantasy Mining
4. Remix an Existing Game
5. Constraint-Based Creativity
6. Spectator Experience Design
7. Verbs Before Nouns
8. Game Feel Playground

**Focus Areas:** Real-time multiplayer, canvas drawing, chat guessing, scoring, rooms
**Deferred:** Custom word lists, multi-language, advanced moderation

---

## Ideas Generated

### [Core Loop #1]: Draw-Guess-Score Loop
_Core Loop_: Player joins room → waits for turn → draws chosen word on canvas OR guesses by typing in chat → points awarded by speed → drawer rotates → repeat for N rounds → winner declared
_Novelty_: Classic Skribbl loop — proven, portfolio-friendly, real-time WebSocket showcase

### [Mechanics #2]: Three-Word Choice
_Core Loop_: Drawer is presented 3 random words of varying difficulty, picks one, then draws within a time limit
_Novelty_: Choice adds agency — drawer picks based on confidence, creating implicit difficulty selection

### [Mechanics #3]: Speed-Based Scoring
_Core Loop_: Guessers earn more points for faster guesses. Drawer earns points proportional to how many players guess correctly
_Novelty_: Creates dual incentive — guessers race each other, drawer is motivated to draw clearly

### [Mechanics #4]: Progressive Letter Hints
_Core Loop_: As timer counts down, random letters of the word are revealed to help guessers
_Novelty_: Prevents stalemates, creates "aha!" moments as hints click into place

### [Mechanics #5]: Room Creation with Shareable Link
_Core Loop_: Player creates a room, gets a unique link/code, shares with friends to join
_Novelty_: Portfolio demo value — shows real multiplayer room management architecture

### [Mechanics #6]: Lobby/Waiting Room
_Core Loop_: Players gather in lobby before game starts, see avatars/names, host starts when ready
_Novelty_: Visual proof of multiplayer — multiple players visible before game begins

### [UX #7]: Drawing Toolset
_Core Loop_: Drawer uses color palette, brush sizes, eraser, fill bucket, and clear canvas to create drawings
_Novelty_: Rich enough to enable creativity, simple enough to not overwhelm — portfolio shows canvas API mastery

### [UX #8]: Real-Time Canvas Sync
_Core Loop_: Every stroke drawn appears instantly on all other players' screens via WebSocket
_Novelty_: The technical centerpiece — smooth real-time sync is the most impressive portfolio element

### [UX #9]: Chat with Guess Detection
_Core Loop_: Players type guesses in chat. System auto-detects correct answers, shows "X guessed the word!" without revealing the answer to others
_Novelty_: Intelligent message handling — correct guesses hidden, close guesses highlighted

### [UX #10]: Player Identity (Name + Avatar)
_Core Loop_: Before joining, player sets a display name and picks/generates an avatar
_Novelty_: Minimal identity system without auth overhead — keeps it portfolio-light

### [UX #11]: End-Game Scoreboard
_Core Loop_: After all rounds complete, display final rankings with scores, highlight winner
_Novelty_: Satisfying conclusion — gives closure to the game session

### [Feel #12]: Timer Visual Feedback
_Core Loop_: Timer changes color as time runs out — green → yellow → red — creating visual urgency
_Novelty_: Small polish that shows attention to game feel and UX design

### [Feel #13]: Correct Guess Flash
_Core Loop_: When someone guesses correctly, a green flash/highlight appears on their chat message
_Novelty_: Instant positive feedback — celebrates the moment

### [Feel #14]: "Close Guess" Feedback
_Core Loop_: When a guess is close to the answer, show "Almost!" or highlight in yellow
_Novelty_: Reduces frustration, encourages continued guessing, shows string-matching sophistication

### [Feel #15]: Drawing Cursor Changes
_Core Loop_: Cursor changes based on selected tool — crosshair for brush, paint bucket icon for fill, etc.
_Novelty_: Small detail that elevates perceived quality

### [Feel #16]: Smooth Stroke Rendering
_Core Loop_: Use quadratic bezier curves or similar smoothing for drawn lines instead of raw pixel points
_Novelty_: Professional-quality drawing experience — not choppy like amateur implementations

---

## Themes and Patterns

1. **Real-Time is King** — The WebSocket-powered real-time sync (drawing, chat, scoring) is the portfolio centerpiece
2. **Simplicity Over Features** — Every feature earns its place by being essential to the core loop
3. **Feel Over Flash** — Small polish (timer colors, cursor changes, guess feedback) > flashy features
4. **Multiplayer Architecture** — Room management, player state, turn rotation showcase backend skills
5. **Canvas Mastery** — Drawing tools and smooth rendering showcase frontend skills

## Promising Combinations

- **Real-time sync + Smooth rendering** = The hero demo moment (someone draws, everyone sees it instantly and smoothly)
- **Chat guess detection + Close guess feedback** = Intelligent UX that shows algorithmic thinking
- **Room system + Lobby** = Full multiplayer lifecycle visible in portfolio
- **Timer + Hints + Scoring** = Complete game tension arc without complexity

---

## Scope Summary

### ✅ Must Have (v1)
| Feature | Category |
|---|---|
| Real-time drawing sync via WebSocket | Core |
| Room creation with shareable link/code | Core |
| 3-word selection for drawer | Core |
| Timer with auto-skip | Core |
| Score tracking per round | Core |
| Round rotation (everyone draws) | Core |
| Drawing tools (colors, sizes, eraser, fill, clear) | UX |
| Chat with guess detection | UX |
| Letter hints over time | UX |
| Lobby/waiting room | UX |
| End-game scoreboard | UX |
| Player name + avatar | UX |

### 🟡 Nice to Have (v1 polish)
| Feature | Category |
|---|---|
| Close guess feedback | Feel |
| Timer color changes | Feel |
| Correct guess flash | Feel |
| Undo last stroke | UX |
| Drawing cursor changes | Feel |
| Smooth stroke rendering | Feel |

### ⏸️ Deferred (post-v1)
| Feature | Category |
|---|---|
| Custom word lists | Feature |
| Multi-language support | Feature |
| Vote-kick/moderation | Feature |
| User accounts/auth | Feature |
| Persistent leaderboards | Feature |
| Spectator mode | Feature |
| Replay/save drawings | Feature |
| Mobile touch drawing | UX |
| Sound effects | Feel |
| Animations/particles | Feel |

---

## Session Summary

### Most Promising Concept

**Top Pick: Real-Time Multiplayer Skribbl Clone**
A browser-based draw-and-guess game with WebSocket-powered real-time canvas sync, room management, and chat-based guessing. This is the ideal portfolio piece because it demonstrates full-stack mastery: real-time communication (WebSocket), interactive frontend (Canvas API), game state management (turns, scoring, rounds), and scalable architecture (room-based multiplayer).

### Key Insights

1. **The real-time canvas sync IS the portfolio hero** — smooth, instant drawing replication across players is the single most impressive technical demonstration
2. **12 must-have features cover the full game loop** — nothing missing, nothing excess
3. **Production-ready architecture matters more than feature count** — clean code, proper separation of concerns, scalable patterns
4. **Small polish items (timer colors, guess feedback) punch above their weight** — they signal attention to detail in a portfolio context
5. **No auth needed** — name + avatar is sufficient identity for a portfolio game

### Recommended Next Steps

1. **Create Game Brief** → Formalize the concept into a structured vision document (`gds-create-game-brief`)
2. **Create PRD** → Define detailed requirements for implementation (`gds-create-prd`)
3. **Architecture Design** → Plan the tech stack and system architecture (`gds-game-architecture`)
4. **Implementation** → Build it with clean, scalable, production-ready code

---

## Session Complete

**Date:** 2026-04-24
**Participant:** Femil

### Output

This brainstorming session generated:

- 16 raw ideas across 4 categories (Core, Mechanics, UX, Feel)
- 1 focused game concept (Skribbl clone)
- 5 emerging themes
- 4 promising feature combinations
- Clear v1 scope with 12 must-haves, 6 nice-to-haves, 10 deferred

### Document Status

Status: Complete
Steps Completed: [1, 2, 3, 4]

