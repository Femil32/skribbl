import { z } from "zod";

/** Max visible length after trim/sanitize (grapheme clusters). Story 1.5: between 16–32. */
export const NICKNAME_MAX_GRAPHEMES = 24;

export const DEFAULT_AVATAR_PRESET_ID = "preset-1";

/** Fixed allow-list — clients must not send free-text avatar strings. */
export const AVATAR_PRESET_IDS = [
  "preset-1",
  "preset-2",
  "preset-3",
  "preset-4",
] as const;

export const avatarPresetIdSchema = z.enum(AVATAR_PRESET_IDS);

export const avatarPresets: ReadonlyArray<{
  id: (typeof AVATAR_PRESET_IDS)[number];
  label: string;
}> = [
  { id: "preset-1", label: "Cyan" },
  { id: "preset-2", label: "Violet" },
  { id: "preset-3", label: "Amber" },
  { id: "preset-4", label: "Rose" },
];

export type AvatarPresetId = z.infer<typeof avatarPresetIdSchema>;

export function isValidAvatarPresetId(id: string): id is AvatarPresetId {
  return (AVATAR_PRESET_IDS as readonly string[]).includes(id);
}

/** Map line/paragraph separators to spaces so words stay separated after control stripping. */
function normalizeLineLikeSeparatorsToSpaces(input: string): string {
  return input.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, " ");
}

function stripHtmlLikeTags(input: string): string {
  let out = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/<[^>]*>/g, "");
  }
  return out.replace(/[<>]/g, "");
}

function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x9 || cp === 0xa || cp === 0xd) continue;
    if (cp < 0x20 || cp === 0x7f) continue;
    out += ch;
  }
  return out;
}

/** Collapse internal whitespace to single spaces (display names are single-line). */
function normalizeInteriorWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function countGraphemes(input: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(input)) n++;
    return n;
  }
  return [...input].length;
}

/**
 * Server-authoritative cleanup for display names (NFR-SEC2). No HTML; plain text only.
 * Does not enforce max length — callers reject with `NICKNAME_TOO_LONG` after counting graphemes.
 */
export function sanitizeDisplayName(raw: string): string {
  const noTags = stripHtmlLikeTags(normalizeLineLikeSeparatorsToSpaces(raw));
  const noControls = stripControlChars(noTags);
  return normalizeInteriorWhitespace(noControls);
}
