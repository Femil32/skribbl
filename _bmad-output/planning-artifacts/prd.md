---
project_name: 'skribbl'
user_name: 'Femil'
date: '2026-04-24'
workflowType: 'create-prd'
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments: 
  - '_bmad-output/planning-artifacts/game-brief.md'
  - '_bmad-output/planning-artifacts/brainstorming-session-2026-04-24.md'
documentCounts:
  gdd: 0
  brief: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: 'Web Game / Browser Game'
  domain: 'Gaming (Multiplayer Draw-and-Guess)'
  complexity: 'Medium'
  projectContext: 'Greenfield'
status: 'complete'
prdWorkflowCompleted: '2026-04-29'
---

# Product Requirements Document (PRD)

## 1. Executive Summary

Skribbl is a real-time, browser-based multiplayer draw-and-guess game designed to serve as a high-fidelity technical portfolio piece. The game challenges players to draw words under pressure while others race to guess them in a live chat. Operating without user accounts or installs, Skribbl targets instant-access playability, serving both casual gamers and technical recruiters evaluating full-stack engineering proficiency.

### What Makes This Special

Unlike legacy commercial competitors optimizing purely for user acquisition, Skribbl optimizes for code-as-portfolio and reviewability. Its core differentiator lies in its production-grade architecture and micro-interaction polish. Demonstrating real-time WebSocket communication, smooth Canvas API rendering, and elegant state management, the product provides a technical showcase disguised as an engaging social party game.

### Project Classification

- **Project Type:** Web Game / Browser Game
- **Domain:** Gaming (Multiplayer Draw-and-Guess)
- **Complexity:** Medium (Requires Real-time WebSocket and Canvas rendering)
- **Project Context:** Greenfield

### Design principles

Aligned with discovery and brainstorming themes:

- **Real-time first:** WebSocket-powered canvas sync is the primary technical demonstration; lobby, scoring, and chat exist to support that loop.
- **Simplicity over scope:** Features earn inclusion only if they serve the core draw–guess–score experience; defer nice-to-haves that do not.
- **Feel over flash:** Micro-interactions (timer urgency, guess feedback, stroke quality) signal craft without expanding MVP scope—they map mainly to Growth/Vision unless promoted explicitly.

## 2. Product Goals & Success Metrics

### User Success

- Players experience instant, lag-free drawing replication (<100ms latency) that feels completely live.
- Game setup is frictionless, with players joining a room and starting a game in under 15 seconds.
- Players feel a mix of creative pressure and social connection, laughing at drawings and racing to guess answers correctly.

### Business (Portfolio) Success

- Generates meaningful interview conversations with technical recruiters and engineering managers.
- Serves as a definitive proof point of full-stack engineering capability (specifically WebSocket and Canvas API proficiency).
- Reaches "feature complete" MVP status within the allocated development timebox.

### Technical Success

- Codebase is production-ready, clean, well-documented, and passes rigorous self-review against modern style guides.
- Client-server architecture handles state management gracefully without race conditions during turn rotation or guessing.
- Real-time communication is efficient, using stroke batching to minimize WebSocket payload size.

### Measurable Outcomes

- **Latency:** Drawing actions replicate to all clients in <100ms.
- **Capacity:** Reliably supports 2–8 concurrent players per room without degradation.
- **Completion:** 100% of the 12 defined MVP features are fully implemented and bug-free.
- **Quality:** Passes a structured code review checklist tailored for senior engineering standards.

## 3. User Personas & Journeys

### Persona 1: The Casual Host (Primary User)
**Name:** Alex
**Situation:** Hanging out with friends on a Discord call, looking for a quick browser game to play together.
**Goal:** Wants to start a game instantly without making anyone sign up.
**Journey:**
- **Opening Scene:** Alex lands on the Skribbl homepage. It's clean and immediately asks for a nickname and avatar selection.
- **Rising Action:** Alex creates a private room. They instantly get a short, copyable invite link and drop it into Discord. Friends click the link and pop into the lobby in real-time.
- **Climax:** The game starts. Alex is chosen to draw first, picks "Octopus," and starts sketching. The stroke rendering is buttery smooth. Friends are frantically typing in the chat.
- **Resolution:** A friend guesses correctly, triggering a flash of green and a score update. The round ends, and everyone is laughing at the drawing on the scoreboard.

### Persona 2: The Disconnected Player (Edge Case)
**Name:** Sam
**Situation:** Playing the game on a spotty Wi-Fi connection.
**Goal:** Wants to seamlessly rejoin the game after dropping out, without losing their score.
**Journey:**
- **Opening Scene:** Sam is mid-game, currently trying to guess what Alex is drawing.
- **Rising Action:** Sam's Wi-Fi drops. The WebSocket connection severs. The server notices and grays out Sam's avatar in the player list but keeps their score intact in memory.
- **Climax:** Sam reconnects 15 seconds later. The client re-establishes the WebSocket connection. The server instantly sends down the current Canvas state, timer, and chat history.
- **Resolution:** Sam's screen populates with the in-progress drawing immediately, and they resume guessing without missing a beat.

### Persona 3: The Technical Recruiter (Secondary User/Reviewer)
**Name:** Jordan
**Situation:** Reviewing a candidate's portfolio. Has 5 minutes to evaluate technical competence.
**Goal:** Wants to see if the candidate can build responsive, well-architected real-time applications.
**Journey:**
- **Opening Scene:** Jordan clicks the Skribbl link from the candidate's resume. They immediately open Chrome DevTools to inspect the Network tab.
- **Rising Action:** Jordan joins a room and opens a second incognito window to simulate another player. They draw in window A and watch it appear in window B.
- **Climax:** Jordan notices the WebSocket messages are batched efficiently and latency is minimal. They check the UI's reaction to window resizing and note the clean React component structure in the React DevTools.
- **Resolution:** Impressed by the crisp execution and smooth Canvas API handling, Jordan clicks the prominent "View Source Code" link in the footer to evaluate the backend architecture.

### Journey Requirements Summary
- **Room Management:** Frictionless room creation, short link generation, and real-time lobby state broadcasting.
- **Real-Time Canvas:** High-performance, batched stroke broadcasting via WebSockets to ensure smooth drawing across all clients.
- **Resiliency:** Robust reconnect logic that preserves player identity (via session tokens) and instantly hydrates the client with the current game state.
- **Portfolio Polish:** Easily discoverable links to the GitHub repository and an aggressively optimized UI that holds up to technical scrutiny.

## 4. Scope & Features

### MVP - Minimum Viable Product

- Real-time drawing sync via WebSocket
- Room creation with shareable link/code
- 3-word selection for drawer
- Timer with auto-skip (80 seconds)
- Score tracking per round
- Round rotation (everyone draws)
- Drawing tools (colors, sizes, eraser, fill, clear)
- Chat with guess detection
- Letter hints over time
- Lobby/waiting room
- End-game scoreboard
- Player name + avatar (no auth required)

### Growth Features (Post-MVP Polish)

- Close guess feedback in chat ("Almost!")
- Timer color changes (green → yellow → red)
- Correct guess flash animations
- Undo last stroke functionality
- Drawing cursor changes based on selected tool
- Smooth stroke rendering (bezier curves)

### Vision (Future)

- Custom word lists and multi-language support
- User accounts, persistent leaderboards, and auth
- Spectator mode and replay/save drawings
- Mobile touch drawing support
- Sound effects and advanced particle animations

## Domain-Specific Requirements

### Compliance & Regulatory
- **Moderation:** While not strictly regulated, the game must ensure that user-generated content (both chat and drawings) can be controlled by the host, as it may be played by all ages or streamed on platforms like Twitch (TOS compliance).
- **Data Privacy:** Because the game relies on ephemeral, anonymous sessions, it naturally complies with GDPR/CCPA by not storing personally identifiable information (PII).

### Technical Constraints
- **Low-Latency Communication:** WebSockets must be used for real-time bi-directional communication. HTTP polling is insufficient for the sub-100ms drawing replication requirement.
- **Canvas Optimization:** The HTML5 Canvas API must be optimized to handle hundreds of coordinates per second without dropping frames (e.g., using `requestAnimationFrame` and path batching).
- **Network Resilience:** The architecture must handle sudden client disconnects and gracefully purge inactive connections to prevent memory leaks on the Node.js server.

### Risk Mitigations
- **Payload Bloat:** If coordinate data isn't compressed, the server may choke on high traffic. *Mitigation:* Send batched array buffers instead of verbose JSON payloads for drawing events.
- **State Desync:** Clients joining mid-round might have an empty canvas. *Mitigation:* The server must keep the current round's Canvas history in memory and transmit it as an initialization payload to late-joiners.

## 5. Functional Requirements

### Game Lobby & Room Management
- FR1: A player can create a new private room and receive a shareable link/code.
- FR2: A player can join a room via a shareable link or code.
- FR3: A player can enter a display name and choose an avatar before joining.
- FR4: The host can start the game when at least 2 players are in the room.

### Gameplay & Turn Management
- FR5: The system automatically assigns the "Drawer" role to players in a round-robin format.
- FR6: The current Drawer can select one word from a choice of 3 randomized words.
- FR7: The system enforces an 80-second timer per drawing round.
- FR8: The system automatically skips the turn if the timer expires before all players guess correctly.
- FR9: The system reveals partial letter hints to guessers over time.
- FR10: The system tracks and calculates scores based on how quickly a player guessed the word.
- FR11: The system displays a final scoreboard at the end of all rounds.

### Drawing Capabilities (Canvas)
- FR12: The Drawer can draw freehand strokes on the canvas.
- FR13: The Drawer can select different stroke colors.
- FR14: The Drawer can select different stroke thicknesses.
- FR15: The Drawer can use an eraser tool to remove strokes.
- FR16: The Drawer can use a fill tool to color enclosed areas.
- FR17: The Drawer can clear the entire canvas with a single action.
- FR18: The system broadcasts drawing strokes to all guessers in real time.

### Chat & Guessing System
- FR19: Players can send text messages to a real-time room chat.
- FR20: The system detects if a chat message exactly matches the target word.
- FR21: The system prevents the exact word guess from being broadcasted to players who haven't guessed it.
- FR22: The system awards points to the guesser and the Drawer when a correct guess is made.
- FR23: The system notifies all players in the chat when a player successfully guesses the word.
- FR24: (Growth) The system identifies close guesses and provides a "You're close!" feedback message privately to the guesser.

### Resiliency & State Recovery
- FR25: A player can reconnect to an active game session without losing their score or identity.
- FR26: The system transmits the current canvas state and chat history to a reconnecting player.
- FR27: The system marks disconnected players in the UI to notify active players.

## Web Game Specific Requirements

### Project-Type Overview
Skribbl functions as a Single Page Application (SPA) with heavy real-time components. It must be accessible instantly without downloads, relying entirely on modern browser APIs (WebSockets and Canvas).

### Browser Matrix
- **Supported:** Chrome (latest), Firefox (latest), Safari (latest), Edge (latest).
- **Graceful Degradation:** If WebSockets fail to connect, present a clean error screen guiding the user to check their corporate firewall or VPN settings.

### Performance Targets
- **Time to Interactive (TTI):** < 1.5 seconds.
- **Canvas Rendering:** 60 FPS target for drawing strokes to avoid "jagged" lines.
- **WebSocket Latency:** < 100ms round-trip from drawing to displaying on peers.

### Responsive Design
- The game layout must scale seamlessly across Desktop, Tablet, and Mobile viewports.
- The Canvas element specifically needs a dynamic coordinate scaling system to map coordinates recorded on a 1920x1080 display to a 375x667 mobile display accurately.

## 6. Non-Functional Requirements

### Performance
- **NFR-P1 (WebSocket Latency):** Drawing strokes must be broadcasted to all connected room peers within 100 milliseconds under normal network conditions.
- **NFR-P2 (Rendering Framerate):** The HTML5 Canvas must render incoming and outgoing strokes at a consistent 60 frames per second on modern hardware to prevent visual stuttering.
- **NFR-P3 (Payload Efficiency):** Coordinate data for strokes must be batched (e.g., sending an array of points every 50ms instead of firing an event per pixel) to prevent network congestion.

### Scalability
- **NFR-S1 (Room Capacity):** The server must reliably handle at least 8 active connections per room without measurable degradation in broadcast latency.
- **NFR-S2 (Concurrency):** The backend architecture (e.g., Node.js + Socket.io) must be capable of supporting 100 concurrent rooms on a standard single-core server instance.

### Security
- **NFR-SEC1 (Room Isolation):** A player cannot join or observe a private room without the exact, randomly generated connection code/link.
- **NFR-SEC2 (Input Sanitization):** All chat inputs and player names must be aggressively sanitized to prevent XSS attacks when rendered in the UI.

### Usability & Accessibility
- **NFR-U1 (Cross-Device Input):** The drawing canvas must accurately map both standard mouse events (mousedown/mousemove) and touch events (touchstart/touchmove) to support desktop and mobile devices.

### Reliability & Operations (Portfolio)

- **NFR-O1 (Observable failures):** WebSocket connection failures and room join errors must surface clear, user-facing messages without exposing internal stack traces.
- **NFR-O2 (Debuggability):** Server-side logging must be sufficient to diagnose room/state issues during development and demo without persistent production-grade observability being a blocker for MVP.

## 7. Document status

| Field | Value |
| --- | --- |
| Workflow | `bmad-create-prd` (BMad Method) |
| Inputs | Game brief, brainstorming session (2026-04-24) |
| PRD workflow completed | 2026-04-29 |
| Traceability | Functional requirements FR1–FR27; non-functional NFR-P/S/SEC/U/O |

This PRD is **complete** and ready for validation (`bmad-validate-prd`), UX specification (`bmad-create-ux-design` / game UX via GDS), technical/game architecture, and epic/story breakdown.
