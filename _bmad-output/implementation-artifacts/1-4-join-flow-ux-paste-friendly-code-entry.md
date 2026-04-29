# Story 1.4: Join-flow UX — paste-friendly code entry

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a guest,
I want to paste or type a room code with validation feedback,
so that mistyped invites recover gracefully (FR2, UX-DR12).

## Acceptance Criteria

1. **Given** the join experience (`/join`, with optional `?code=` from an invite link) **when** the guest connects to the game WebSocket and sends **`joinRoom`** with a code **then** the client uses the same **normalization spirit** as the server (strip whitespace, strip non-alphanumeric separators, uppercase) before send **and** handles **`roomJoined`** by moving to a clear **post-join lobby / waiting state** (roster UI is Story **1.6** — show **player count** from `roomJoined` and copy that the room is ready; optional short loading presentation consistent with host “Creating your room…” pattern).
2. **Given** join failures **when** the server responds with **`error`** **then** messaging is **inline** next to the code field (or join action), maps **`code`** to neutral, actionable copy (**no** blame, **no** stack traces — NFR-O1), and uses **`aria-describedby`** / visible **`role="alert"`** on the error region per UX Form Patterns (UX-DR12).
3. **Given** **`BAD_CODE`** (malformed length or charset after normalization) **when** the user submits **then** the UI explains the code format in plain language (e.g. six characters, valid character set) **without** implying user error.
4. **Given** **`UNKNOWN_ROOM`** or **`ROOM_FULL`** **when** returned **then** copy reflects **that room isn’t available or is full**, with a sensible retry path (edit code / try again), consistent with [`protocol-error-message.ts`](../../apps/web/src/features/lobby/lib/protocol-error-message.ts) — extend mappings if new codes appear.
5. **Given** **wrong-phase / join locked** (match already started) **when** the server eventually enforces this (Epic **2+**) **then** this story’s UI pattern must remain compatible: **one** inline error region + stable **`error.code`** mapping. **Today:** `Room.phase` is only **`lobby`** in [`room.ts`](../../apps/server/src/room/room.ts); if no server signal exists yet, document the **future** code name in Dev Notes and keep copy in [`messageForProtocolErrorCode`](../../apps/web/src/features/lobby/lib/protocol-error-message.ts) behind a placeholder or TODO for when **`joinRoom`** rejects non-lobby joins.
6. **Given** **`NEXT_PUBLIC_WS_URL`** unset **when** the guest attempts join **then** behavior matches host flow: **clear configuration error**, not a silent failure (reuse tone from [`use-host-create-room.ts`](../../apps/web/src/features/lobby/hooks/use-host-create-room.ts)).

## Tasks / Subtasks

- [x] **Wire protocol & validation alignment** (AC: 1, 3)
  - [x] Send **`joinRoom`** only via **`serializeClientCommand`** from **`@skribbl/shared`** — add **`serializeJoinRoomCommand(roomCode: string)`** in [`apps/web/src/lib/ws-client.ts`](../../apps/web/src/lib/ws-client.ts) mirroring **`serializeCreateRoomCommand`**.
  - [x] **Strongly recommended:** Move **`ROOM_CODE_LENGTH`**, alphabet, **`normalizeRoomCode`**, and **`isValidRoomCodeForJoin`** into **`@skribbl/shared`** (pure strings; no Node APIs) and **import from shared in `apps/server`** so web and server cannot drift. If you skip migration, add **Vitest** on web that asserts the same cases as [`room-manager.test.ts`](../../apps/server/src/room/room-manager.ts) normalization tests.
  - [x] **Client preflight:** Before opening WS or on submit, if normalized code fails validation, show **inline** helper text (don’t send junk that only produces generic errors).
- [x] **Join UX feature module** (AC: 1, 2, 6)
  - [x] Implement **`useGuestJoinRoom(normalizedCode: string)`** (name flexible) under **`apps/web/src/features/lobby/hooks/`**, modeled on **`useHostCreateRoom`**: resolve WS URL, **`open` → send join**, **`safeParseServerEvent`**, exhaustive **`switch`**, cleanup **`close`** on unmount.
  - [x] States: **`connecting` | `joined` | `error`** (and optional **`idle`** if you defer auto-join). On **`roomJoined`**, store **`roomId`, `roomCode`, `playerCount`, `phase`** for downstream stories.
  - [x] **Do not** close the socket on success if later stories expect the same connection — document choice in Dev Agent Record (MVP: **keep open** until unmount; **1.5/1.6** may add identity + roster on same socket).
- [x] **`/join` route composition** (AC: 1–6)
  - [x] Refactor [`apps/web/src/app/join/page.tsx`](../../apps/web/src/app/join/page.tsx) + [`JoinCodeEntry.tsx`](../../apps/web/src/app/join/JoinCodeEntry.tsx): **Server component** can keep reading **`searchParams`**; move interactive join into a **client** child (e.g. **`JoinRoomClient`**) that receives **initial code** from query.
  - [x] **Deep link:** If `?code=` present, **normalize for display** (existing **`normalizeRoomCodeForDisplay`**) and either **auto-start** join on mount or offer a single primary **“Join room”** — pick one pattern and document; prefer **auto-join** after brief confirmation for accessibility (reduce taps).
  - [x] **Manual path:** **`JoinCodeEntry`** already navigates to **`/join?code=`** — ensure the client shell then runs the same join logic (single code path).
  - [x] **Success UI:** Card with **joined** headline, monospace code, **player count** (“Players here: N”), and muted note that **live roster** arrives in Story **1.6**; link **Home** / **Create a room** like today.
- [x] **Accessibility & UX polish** (AC: 2, 3, UX-DR12)
  - [x] Single **`input`**: `aria-invalid`, **`aria-describedby`** pointing at error **`id`** when present; visible **`label`** (“Room code”).
  - [x] Paste-friendly: **`autoComplete="off"`**, **`spellCheck={false}`**, **`font-mono`** — already partially done; retain.
  - [x] Loading: DaisyUI **`loading-spinner`** + text (“Joining…”) analogous to host connecting state.
- [x] **Tests / verification** (AC: 1–6)
  - [x] **`pnpm --filter @skribbl/web typecheck`** + **`pnpm --filter @skribbl/web build`** (and **`pnpm -r exec tsc --noEmit`** if that’s team gate).
  - [x] Unit tests: normalization / validation — extend [`invite-url.test.ts`](../../apps/web/src/lib/invite-url.test.ts) or colocate with new shared **`room-code`** module.
  - [x] Server integration already covers **`joinRoom`** — if you only change web, manual smoke: **two terminals** (server + web), create room → open invite → join.

## Dev Notes

### Architecture compliance

- **Single WS listener demux by `type`**, **`safeParseServerEvent`** on every inbound message — same discipline as host hook ([`game-architecture.md`](../../_bmad-output/game-architecture.md) — Client event reducer).
- **No duplicate schemas** outside **`@skribbl/shared`**.
- **Two processes:** browser → **`NEXT_PUBLIC_WS_URL`** only.

### File structure (create / touch)

| Area | Path |
|------|------|
| Join hook | `apps/web/src/features/lobby/hooks/use-guest-join-room.ts` (or equivalent `camelCase` filename) |
| Join UI client | `apps/web/src/features/lobby/components/JoinRoomFlow.tsx` or `apps/web/src/app/join/JoinRoomClient.tsx` |
| WS helpers | `apps/web/src/lib/ws-client.ts` — **`serializeJoinRoomCommand`** |
| Error copy | `apps/web/src/features/lobby/lib/protocol-error-message.ts` — extend for any new join codes |
| Optional shared | `packages/shared/src/room-code.ts` (+ export from `index.ts`) |
| Route | `apps/web/src/app/join/page.tsx`, `JoinCodeEntry.tsx` |

### Technical requirements (guardrails)

- **Exhaustive `switch`** on parsed **`ServerEvent`** in the join hook; **`never` exhaustiveness** for future event types.
- **Never** `JSON.parse` client commands without **`serializeClientCommand`** / shared validation on outbound.
- **Tone:** Neutral, actionable — align with UX “Copy & tone” and NFR-O1.
- **Dependency budget:** Tailwind + DaisyUI only on web.

### Testing requirements

- Vitest where already configured (`@skribbl/web`, `@skribbl/shared`).
- Playwright: optional; call out in Dev Agent Record if not added.

### UX / product

- [Source: `ux-design-specification.md` — Session bootstrap diagram, Form Patterns (room code paste-friendly), Feedback Patterns (errors inline).]
- **Distinguish** validation helper (format) vs server error (room missing / full).

### Cross-story context (Epic 1)

- **Depends on:** **1.2** — **`joinRoom`**, **`roomJoined`**, error codes; **1.3** — **`/join?code=`**, **`buildRoomInviteUrl`**, invite normalization.
- **Unlocks:** **1.5** — nickname/avatar on same join path; **1.6** — roster + host start.
- **Avoid:** Implementing full roster, **startMatch**, or identity payloads in **1.4**.

### Previous story intelligence

From [`1-3-create-flow-ux-shareable-link-copy-feedback.md`](1-3-create-flow-ux-shareable-link-copy-feedback.md):

- Host flow uses **`useHostCreateRoom`**, **`LobbyHostPage`**, **`protocol-error-message`**, **`resolveGameWebSocketUrl`**, **`safeParseServerEvent`** — **mirror these patterns** for guests.
- **`buildRoomInviteUrl` / `normalizeRoomCodeForDisplay`** live in **`invite-url.ts`** — join flow must stay consistent with invite links.
- **`serializeClientCommand`** is canonical outbound validation.

From [`1-2-authoritative-rooms-secure-codes-on-the-server.md`](1-2-authoritative-rooms-secure-codes-on-the-server.md):

- Charset excludes ambiguous glyphs; codes are length **6** after normalization.
- **`normalizeRoomCode`** strips separators users paste from links or chat.

### Git intelligence

- Recent work: **1.3** “lobby / copy” commit; **1.2** rooms. Extend **`features/lobby`** rather than new top-level feature folders.

### Latest technical specifics

- Stack pins: Next **~16**, React **~19**, Zod **4.x**, **`ws`**, Node **24** — [`project-context.md`](../project-context.md).

### Project Context Rules

From `_bmad-output/project-context.md`:

- **All wire JSON** through **`@skribbl/shared`**; structured **`error.code`** on failures.
- **Naming:** `kebab-case` dirs, **`PascalCase.tsx`**, **`camelCase`** functions.
- **Do not** add Socket.io or duplicate message types in apps.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4, FR2, UX-DR12]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Session bootstrap, Form Patterns §Room code]
- [Source: `_bmad-output/game-architecture.md` — Lobby / join system map]
- [Source: `packages/shared/src/schemas.ts` — `joinRoom`, `roomJoined`, `error`]
- [Source: `apps/server/src/protocol/handlers/handle-client-command.ts` — join routing]

## Change Log

- Moved room-code normalization and validation into `@skribbl/shared`; server re-exports for existing imports; invites use shared `normalizeRoomCode` via `normalizeRoomCodeForDisplay`.
- Added `serializeJoinRoomCommand`, `useGuestJoinRoom`, `/join` `JoinRoomClient` with Suspense boundary, DaisyUI join spinner, success player count card, extended `protocol-error-message` (**`JOIN_NOT_ALLOWED`** placeholder string for Epic 2+ “wrong phase”; server does not emit it yet).

## Dev Agent Record

### Agent Model Used

Implementing dev tool: Cursor / GPT-5.

### Implementation Plan

- **Socket lifecycle:** Keeps WS open after `roomJoined` until `JoinRoomClient` unmounts so Stories **1.5/1.6** can extend the same socket (identity/roster).
- **Auto-join:** Valid invites (`useSearchParams` + SSR `initialQueryCode` fallback): `urlReadyToAutoJoin` enables join without showing a separate Join primary action; **`readOnly`** on the code field while URL drives a complete valid code.

### Debug Log References

_No debug instrumentation added._

### Completion Notes List

- Commands run: `pnpm --filter @skribbl/shared test`, `pnpm --filter @skribbl/server test`, `pnpm --filter @skribbl/web test`, `pnpm --filter @skribbl/web lint`, `pnpm -r exec tsc --noEmit`, `pnpm --filter @skribbl/web build`.
- Playwright/E2E not added (manual smoke per story checklist).

### File List

- `packages/shared/src/room-code.ts`
- `packages/shared/src/room-code.test.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/protocol/handlers/handle-client-command.ts`
- `apps/web/src/lib/ws-client.ts`
- `apps/web/src/lib/invite-url.ts`
- `apps/web/src/lib/invite-url.test.ts`
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
- `apps/web/src/features/lobby/lib/protocol-error-message.ts`
- `apps/web/src/app/join/page.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`


- Whether **auto-join on `?code=`** or **explicit button** is preferred for a11y — default recommendation above is auto-join with visible **Joining…** state; product can flip.
- **Centralizing room-code helpers in shared** vs **test-only parity** — recommended shared migration to kill drift between `normalizeRoomCodeForDisplay` and server `normalizeRoomCode`.

### Review Findings

- [x] [Review][Patch] Join hook can briefly show stale `idle` or prior `error` while a join attempt is active — sync transition to `connecting` when a new attempt starts (avoid relying only on `queueMicrotask` for the first paint after `activeJoinAttempt` / `connectionAttemptId` changes). [`apps/web/src/features/lobby/hooks/use-guest-join-room.ts` (~53–70, 146–156)] — fixed via `useLayoutEffect` + preserving `joined`

- [x] [Review][Defer] Duplicate normalization tests live in both `@skribbl/shared` and `room-manager.test.ts` — low risk; consolidate later if drift bothers maintenance. [`packages/shared/src/room-code.test.ts`, `apps/server/src/room/room-manager.test.ts`] — deferred, pre-existing pattern after shared extraction
