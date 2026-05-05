---
status: all_fixed
phase: 5-1
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
---

# Phase 5-1: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** _bmad-output/implementation-artifacts/5-1-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
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

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
