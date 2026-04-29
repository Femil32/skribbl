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
    case "ROOM_FULL":
      return "That room is full. Try again later or ask the host to make space.";
    // Epic 2+: when match is not in lobby — placeholder until server emits this code.
    case "JOIN_NOT_ALLOWED":
      return "That room is not accepting joins right now. The match may have already started.";
    case "INTERNAL":
      return "Something went wrong. Try again shortly.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const protocolParseErrorMessage =
  "We could not read the server response. Check your connection and try again.";
