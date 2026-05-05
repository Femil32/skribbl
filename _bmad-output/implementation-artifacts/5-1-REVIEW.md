---
status: findings
phase: 5-1
phase_name: Session Tokens & Reconnect Handshake
depth: standard
files_reviewed: 7
files_reviewed_list:
  - apps/server/src/room-ws.integration.test.ts
  - apps/web/src/app/join/JoinRoomClient.tsx
  - apps/web/src/features/lobby/components/LobbyHostPage.tsx
  - apps/web/src/features/lobby/hooks/use-guest-join-room.ts
  - apps/web/src/features/lobby/hooks/use-host-create-room.ts
  - apps/web/src/features/lobby/lib/session-storage.test.ts
  - apps/web/src/features/lobby/lib/session-storage.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
reviewed_at: 2026-05-05
---

# Phase 5-1: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase implements session tokens stored in `sessionStorage` and WebSocket reconnect handshakes for both host and guest roles. The storage layer is well-structured with proper validation on read. The reconnect flow in both hooks is architecturally sound, guarding against stale reconnect data and correctly clearing sessions on terminal errors.

Four warnings were found: two race conditions in the reconnect hooks (stale closure / double-connect window), one unhandled error code path that silently swallows non-recoverable post-join errors for guests, and one logic gap where `returnToLobby` clears the session before the server confirms the transition, potentially leaving the host unable to reconnect on a transport failure mid-command. Three informational items cover a missing XSS-mitigation note for the pre-game chat render, an `array index` key antipattern in the chat list, and a gap in the integration tests (no test for `reconnectPlayer` being rejected when `playerId` does not match the stored session).

---

## Warnings

### WR-01: Race condition — guest reconnect context set from stale `displayName`/`avatarPresetId` closure

**File:** `apps/web/src/features/lobby/hooks/use-guest-join-room.ts:250-265`

**Issue:** When a transport drop triggers a retry (`closedWhileJoinedRef.current === true`), the `open` handler sends `serializeReconnectPlayerCommand` using `resume.displayName` and `resume.avatarPresetId` pulled from `guestResumeContextRef.current`, which was last written from the `roomJoined` server event. This is correct. However, on the *same* retry path the effect dependency array includes `displayName` and `avatarPresetId` (line 629-636). If the parent component updates those props between the disconnect and the reconnect attempt (e.g., user edits the nickname field while "disconnected" banner is shown), the effect re-runs with a new `connectionAttemptId`-independent trigger, a new WebSocket is opened, and the stale `closedWhileJoinedRef` flag causes it to send `reconnectPlayer` with the *stored* identity rather than the new one. The two sockets can briefly be open simultaneously, causing `ALREADY_CONNECTED` on the server.

**Fix:** Remove `displayName` and `avatarPresetId` from the dependency array of the reconnect effect, or gate effect re-runs on `connectionAttemptId` changes only when already joined. Alternatively, freeze identity into a ref on first successful join and use that ref exclusively for reconnect payloads:

```typescript
// At the top of useGuestJoinRoom, alongside other refs:
const frozenIdentityRef = useRef<{ displayName: string; avatarPresetId: AvatarPresetId } | null>(null);

// In the roomJoined handler, freeze identity once:
frozenIdentityRef.current = {
  displayName: parsed.data.displayName,
  avatarPresetId: parsed.data.avatarPresetId,
};

// In the effect dependency array, remove displayName and avatarPresetId:
}, [activeJoinAttempt, connectionAttemptId, normalized, wsUrl]);
```

---

### WR-02: Race condition — host reconnect effect fires on `displayName`/`avatarPresetId` prop change while disconnected

**File:** `apps/web/src/features/lobby/hooks/use-host-create-room.ts:629`

**Issue:** Same structural problem as WR-01, but for the host hook. The effect dependency array at line 629 includes `displayName` and `avatarPresetId`. When `closedWhileInLobbyRef.current` is true, any prop change re-runs the effect and opens a second WebSocket that sends `reconnectHost` with the stale `hostResumeContextRef`, while the prior socket may still be in its close sequence. This can result in two concurrent sockets attempting to claim the same host session.

**Fix:** Same pattern as WR-01 — remove `displayName` and `avatarPresetId` from the reconnect effect's dependency array and rely solely on `attemptId` for user-initiated retries:

```typescript
}, [wsUrl, shouldConnect, attemptId]);
```

The identity needed for reconnect is already captured in `hostResumeContextRef.current`; it does not need to come from the live closure.

---

### WR-03: `returnToLobby` clears the session optimistically before server confirmation

**File:** `apps/web/src/features/lobby/hooks/use-host-create-room.ts:666-675`

**Issue:** `returnToLobby` calls `clearSession()` immediately after sending the command, before any server acknowledgement arrives. If the WebSocket send succeeds but the transport drops before the server processes the command (or the server rejects it), the host's session is wiped. On the next page load the host cannot use `reconnectHost` because `loadSession()` returns `null`, forcing a fresh `createRoom` that will fail if the server-side room is still active and expects the original host.

```typescript
const returnToLobby = useCallback(() => {
  const w = wsRef.current;
  if (!w || w.readyState !== WebSocket.OPEN) return;
  try {
    w.send(serializeReturnToLobbyCommand());
    clearSession(); // <-- premature: session wiped before server ack
  } catch {
    /* ignore */
  }
}, []);
```

**Fix:** Defer `clearSession()` until the server sends a `matchPhase` event with `phase === "lobby"`, which already resets local state in the `matchPhase` handler. Add the clear there:

```typescript
case "matchPhase": {
  // ... existing logic ...
  if (mp.phase === "lobby") {
    nextCommits = [];
    drawingHintRows = [];
    chatFeed = [];
    closeGuessHint = null;
    clearSession(); // clear only once server confirms lobby reset
  }
  // ...
}
```

---

### WR-04: Non-recoverable post-join error codes for guests are silently dropped

**File:** `apps/web/src/features/lobby/hooks/use-guest-join-room.ts:482-499`

**Issue:** In the `error` event handler for a guest that has already reached `status: "joined"`, the code checks `TERMINAL_PROTOCOL_CODES_AFTER_JOINED` (line 468), then checks `wordPickRecoverable` codes (line 482), and if neither set matches, it silently `return`s (line 499) without updating state. If the server sends an unexpected error code after join (e.g., a future `RATE_LIMITED` or any unrecognised code), the guest UI shows no feedback and is left in an indeterminate `joined` state with no way to recover.

**Fix:** Add a fallback that surfaces the unknown error as a non-fatal banner message:

```typescript
// After the wordPickRecoverable check at line 499:
// Unknown post-join error — surface as a banner message without clearing state.
setTransportErrorMessage(messageForProtocolErrorCode(code));
return;
```

---

## Info

### IN-01: Pre-game chat renders user-controlled text without explicit escaping note

**File:** `apps/web/src/features/lobby/components/LobbyHostPage.tsx:870-905`

**Issue:** The pre-game chat message list renders `m.who` and `m.text` directly as React children inside JSX (lines 900-903). React escapes string children automatically, so there is no active XSS risk here. However, `m.who` is populated directly from `state.displayName` (the value that came from the form/server), and `m.text` is from the chat draft — neither passes through `sanitizeDisplayName` before being placed in the chat store. A future refactor that moves rendering to `dangerouslySetInnerHTML` or `innerHTML` would silently introduce XSS. A short comment at the render site would make the invariant explicit.

**Fix:** Add a comment at the message render site:
```tsx
{/* m.who and m.text are plain strings; React escapes them. Do NOT render via dangerouslySetInnerHTML. */}
```

---

### IN-02: Array index used as `key` in pre-game chat list

**File:** `apps/web/src/features/lobby/components/LobbyHostPage.tsx:870`

**Issue:** `chatMessages.map((m, i) => ... key={i} ...)` uses the array index as key. If messages are ever prepended or removed (e.g., scrollback trimming), React will reuse DOM nodes incorrectly, potentially showing stale content.

**Fix:** Assign a stable ID when pushing to `chatMessages`:
```typescript
setChatMessages((prev) => [...prev, { who: ..., text: ..., id: crypto.randomUUID() }]);
// and use key={m.id} in the map
```

---

### IN-03: Integration test has no coverage for `reconnectPlayer` identity mismatch

**File:** `apps/server/src/room-ws.integration.test.ts`

**Issue:** The test suite covers `reconnectHost` for both success and `HOST_SESSION_LOST`. It also covers `reconnectPlayer` success and disconnect-roster-update. There is no test verifying that `reconnectPlayer` is rejected when the `playerId` exists in the room but the supplied `displayName` or `avatarPresetId` does not match what was originally stored — a scenario that would allow a different client to hijack an existing player slot if the server does not validate identity on reconnect.

**Fix:** Add a test case:
```typescript
it("reconnectPlayer with wrong displayName yields HOST_RECLAIM_DENIED or equivalent", () => {
  // setup: create room, guest joins, guest disconnects
  // reconnect with guestPlayerId but displayName: "Impostor"
  // assert error code
});
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
