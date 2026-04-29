/**
 * User-safe copy for structured `error` events (NFR-O1). Prefer stable wording over
 * forwarding server `message` strings to the UI.
 */
export function messageForProtocolErrorCode(code: string): string {
  switch (code) {
    case "BAD_PAYLOAD":
      return "That request could not be processed. Try again.";
    case "BAD_CODE":
      return "That room code is not valid.";
    case "UNKNOWN_ROOM":
      return "That room could not be found.";
    case "ROOM_FULL":
      return "That room is full.";
    case "INTERNAL":
      return "Something went wrong. Try again shortly.";
    default:
      return "Something went wrong. Try again.";
  }
}

export const protocolParseErrorMessage =
  "We could not read the server response. Check your connection and try again.";
