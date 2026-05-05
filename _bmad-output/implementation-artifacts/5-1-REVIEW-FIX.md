---
status: all_fixed
phase: 5-1
findings_in_scope: 7
fixed: 7
skipped: 0
iteration: 2
---

# Phase 5-1: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** _bmad-output/implementation-artifacts/5-1-REVIEW.md
**Iteration:** 2 (iteration 1 fixed WR-01–WR-04; iteration 2 fixed IN-01–IN-03)

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-01: Race condition — guest reconnect context set from stale `displayName`/`avatarPresetId` closure

**Files modified:** `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
**Commit:** ad9bdae
**Applied fix:** Added `frozenIdentityRef` alongside other refs at the top of `useGuestJoinRoom`. Populated it from `parsed.data` in the `roomJoined` handler. Removed `displayName` and `avatarPresetId` from the `useEffect` dependency array so reconnect retries are only triggered by `activeJoinAttempt`, `connectionAttemptId`, `normalized`, and `wsUrl`.

---

### WR-02: Race condition — host reconnect effect fires on `displayName`/`avatarPresetId` prop change while disconnected

**Files modified:** `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
**Commit:** 15045a2
**Applied fix:** Removed `displayName` and `avatarPresetId` from the `useEffect` dependency array, leaving only `[wsUrl, shouldConnect, attemptId]`. The identity needed for reconnect is already captured in `hostResumeContextRef.current`.

---

### WR-03: `returnToLobby` clears the session optimistically before server confirmation

**Files modified:** `apps/web/src/features/lobby/hooks/use-host-create-room.ts`
**Commit:** 15045a2
**Applied fix:** Removed `clearSession()` from `returnToLobby` (which fired before any server acknowledgement). Added `clearSession()` inside the `matchPhase` handler under `if (mp.phase === "lobby")`, so the session is only wiped once the server confirms the lobby transition.

---

### WR-04: Non-recoverable post-join error codes for guests are silently dropped

**Files modified:** `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`
**Commit:** ad9bdae
**Applied fix:** Added a fallback after the `wordPickRecoverable` check that calls `setTransportErrorMessage(messageForProtocolErrorCode(code))` for any unrecognised post-join error code, surfacing a banner message without clearing state.

---

---

### IN-01: Pre-game chat renders user-controlled text without explicit escaping note

**Files modified:** `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
**Applied fix:** Added comment at the chat message render site: `m.who and m.text are plain strings; React escapes them. Do NOT render via dangerouslySetInnerHTML.`

---

### IN-02: Array index used as `key` in pre-game chat list

**Files modified:** `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
**Applied fix:** Added `id: string` field to `ChatMessage` type. All push sites (`setChatMessages` in the `roomCode` effect and `sendChatMessage`) now use `crypto.randomUUID()` for `id`. Both `key={i}` usages replaced with `key={m.id}`.

---

### IN-03: Integration test has no coverage for `reconnectPlayer` identity mismatch

**Files modified:**
- `apps/server/src/room/room-manager.ts` — added `IDENTITY_MISMATCH` to `ReconnectPlayerFailureReason`; added identity validation in `reconnectPlayer` comparing claimed `displayName`/`avatarPresetId` against stashed values; renamed `_player` parameter to `player`
- `apps/server/src/protocol/handlers/handle-client-command.ts` — added `IDENTITY_MISMATCH` error message branch
- `apps/server/src/room-ws.integration.test.ts` — added test `"IDENTITY_MISMATCH: reconnectPlayer with wrong displayName yields IDENTITY_MISMATCH"` (63 tests pass)

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
