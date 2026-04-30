/**
 * User-safe copy for structured `error` events (NFR-O1). Prefer stable wording over
 * forwarding server `message` strings to the UI.
 */
export function messageForProtocolErrorCode(code: string): string {
  switch (code) {
    case "BAD_PAYLOAD":
      return "That request could not be processed. Try again.";
    case "BAD_CODE":
      return "Room codes are six characters long. Use the letters and numbers your host shared (2–9 and A–Z, without O, I, or L). You can paste from an invite link or type the code without spaces.";
    case "UNKNOWN_ROOM":
      return "That room is not available. Check the code and try again, or ask the host for a new invite.";
    case "HOST_RECLAIM_DENIED":
      return "We could not restore your host session to this room. Create a new room.";
    case "HOST_SESSION_LOST":
      return "This lobby is no longer on the game server (it may have closed or the server restarted). Create a new room.";
    case "ALREADY_CONNECTED":
      return "This host session looks like it is already connected elsewhere. Close other tabs or try again.";
    case "ROOM_FULL":
      return "That room is full. Try again later or ask the host to make space.";
    // Epic 2+: when match is not in lobby — placeholder until server emits this code.
    case "JOIN_NOT_ALLOWED":
      return "That room is not accepting joins right now. The match may have already started.";
    case "BAD_NICKNAME":
      return "Enter a display name (letters, numbers, or symbols — no HTML).";
    case "NICKNAME_TOO_LONG":
      return "That name is too long. Use a shorter display name.";
    case "INVALID_AVATAR":
      return "That avatar choice is not valid. Pick one of the presets shown.";
    case "INTERNAL":
      return "Something went wrong. Try again shortly.";
    case "NOT_HOST":
      return "Only the host can do that.";
    case "NOT_ENOUGH_PLAYERS":
      return "You need at least two players before starting.";
    case "WRONG_PHASE":
      return "That action is not available for this room right now.";
    case "NOT_DRAWER":
      return "Only the drawer picks the secret word.";
    case "BAD_CHOICE":
      return "Pick one of the three words shown.";
    case "ALREADY_CHOSE":
      return "You already chose a word for this round.";
    case "CHAT_TOO_LONG":
      return "That message is too long for chat.";
    case "CHAT_EMPTY":
      return "Enter something to send.";
    case "BAD_ROOM":
      return "That room does not match your connection. Try reconnecting.";
    case "NO_WORD_OFFER":
      return "Word choices are not ready yet. Wait a moment and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const protocolParseErrorMessage =
  "We could not read the server response. Check your connection and try again.";
