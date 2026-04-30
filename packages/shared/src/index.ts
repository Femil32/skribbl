export {
  clientCommandSchema,
  serverEventSchema,
  roomPhaseSchema,
  lobbyRosterPlayerSchema,
  isMatchFlowPhase,
  isRosterScoreVisiblePhase,
  safeParseClientCommand,
  safeParseServerEvent,
  parseClientCommand,
  parseServerEvent,
  serializeClientCommand,
  serializeServerEvent,
  type ClientCommand,
  type ServerEvent,
  type RoomPhase,
  type LobbyRosterPlayer,
  type DrawingStrokeCommitted,
  type DrawingHintTick,
  type DrawingCanvasOpCommitted,
  type DrawingCanvasOpPayload,
  type CanvasReplayEvent,
  type DrawingStrokePoint,
} from "./schemas.js";
export {
  HINT_MASK_CHAR,
  eligibleLetterIndices,
  buildMaskedWord,
  shuffleIndicesDeterministic,
  hintRevealOrderSeed,
  computeTotalLetters,
} from "./hint-mask.js";
export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
} from "./room-code.js";
export {
  NICKNAME_MAX_GRAPHEMES,
  DEFAULT_AVATAR_PRESET_ID,
  AVATAR_PRESET_IDS,
  avatarPresetIdSchema,
  avatarPresets,
  isValidAvatarPresetId,
  sanitizeDisplayName,
  countGraphemes,
  type AvatarPresetId,
} from "./player-identity.js";
export { computeGuesserPoints } from "./scoring.js";
export {
  DEFAULT_CLIENT_LINE_WIDTH_PX,
  DEFAULT_CLIENT_STROKE_COLOR,
  clampClientLineWidthPx,
  normalizeClientStrokeColor,
} from "./drawing-stroke-style.js";
