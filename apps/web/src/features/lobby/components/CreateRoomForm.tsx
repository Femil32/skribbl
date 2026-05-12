"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import { NICKNAME_MAX_GRAPHEMES } from "@skribbl/shared";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { DR, chunk, AVATAR_PRESET_COLORS } from "@/features/lobby/design/tokens";
import { FaceSVG } from "@/features/lobby/components/primitives/FaceSVG";

const C_LIGHT = DR.colors;
const ACCENT = DR.accent.tomato;
const FONT = DR.font;
const ACCENT_INK = "#1a1714";

// Maps preset IDs to accent colors and face moods
const AVATAR_OPTIONS: Array<{
  id: AvatarPresetId;
  color: string;
  label: string;
  mood: "smile" | "wink" | "sleepy";
}> = [
  { id: "preset-1", color: AVATAR_PRESET_COLORS["preset-1"]!, label: "tomato",     mood: "smile"  },
  { id: "preset-2", color: AVATAR_PRESET_COLORS["preset-2"]!, label: "canary",     mood: "wink"   },
  { id: "preset-3", color: AVATAR_PRESET_COLORS["preset-3"]!, label: "mint",       mood: "smile"  },
  { id: "preset-4", color: AVATAR_PRESET_COLORS["preset-4"]!, label: "cornflower", mood: "sleepy" },
  { id: "preset-5", color: AVATAR_PRESET_COLORS["preset-5"]!, label: "lavender",   mood: "smile"  },
  { id: "preset-6", color: AVATAR_PRESET_COLORS["preset-6"]!, label: "rose",       mood: "wink"   },
];

const RANDOM_ADJ = ["fuzzy","glitchy","plum","noodle","crispy","tiny","moon","velvet","spicy","soggy","mossy","cosmic","stinky","retro","jazzy"];
const RANDOM_NOUN = ["paws","bug","cassette","wolf","radio","queen","bob","goose","toad","ghost","lemon","sprout","noir","bot","witch"];
const MOODS = ["smile", "wink", "sleepy"] as const;

function randomName(): string {
  const a = RANDOM_ADJ[Math.floor(Math.random() * RANDOM_ADJ.length)]!;
  const n = RANDOM_NOUN[Math.floor(Math.random() * RANDOM_NOUN.length)]!;
  const tail = Math.random() < 0.4 ? "." + (Math.floor(Math.random() * 89) + 10) : "";
  return a + (Math.random() < 0.5 ? "." : "") + n + tail;
}

interface CreateRoomFormProps {
  nicknameRaw: string;
  onNicknameChange: (v: string) => void;
  avatarId: AvatarPresetId;
  onAvatarChange: (id: AvatarPresetId) => void;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CreateRoomForm({
  nicknameRaw,
  onNicknameChange,
  avatarId,
  onAvatarChange,
  error,
  onSubmit,
}: CreateRoomFormProps) {
  const C = C_LIGHT;
  const [moodOverride, setMoodOverride] = useState<"smile" | "wink" | "sleepy" | null>(null);
  const [spinning, setSpinning] = useState(false);

  const baseSel = AVATAR_OPTIONS.find((a) => a.id === avatarId) ?? AVATAR_OPTIONS[0]!;
  const sel = { ...baseSel, mood: moodOverride ?? baseSel.mood };

  const randomize = () => {
    setSpinning(true);
    const pick = AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)]!;
    onAvatarChange(pick.id);
    setMoodOverride(MOODS[Math.floor(Math.random() * MOODS.length)]!);
    onNicknameChange(randomName());
    setTimeout(() => setSpinning(false), 450);
  };

  const nameEmpty = !nicknameRaw.trim();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        backgroundImage: "radial-gradient(rgba(26,23,20,.07) 1.2px, transparent 1.5px)",
        backgroundSize: "22px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        fontFamily: FONT.body,
        color: C.ink,
      }}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          maxWidth: 540,
          width: "100%",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.inkDim,
            letterSpacing: ".18em", textTransform: "uppercase",
          }}>
            create a room
          </div>
          <h1 style={{
            margin: "6px 0 0", fontFamily: FONT.display,
            fontSize: 36, fontWeight: 900, letterSpacing: "-0.01em",
          }}>
            print your badge.
          </h1>
        </div>

        {/* ID badge card */}
        <div style={{
          width: "100%", maxWidth: 460,
          background: C.panel, border: `3px solid ${C.line}`, borderRadius: 22,
          boxShadow: chunk(6, 8),
          padding: 22,
          display: "flex", flexDirection: "column", gap: 16,
          position: "relative",
        }}>
          {/* punch hole */}
          <div style={{
            position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)",
            width: 56, height: 14, background: C.bg,
            border: `3px solid ${C.line}`, borderTop: "none",
            borderRadius: "0 0 999px 999px",
          }} />

          {/* face + name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            {/* face sticker */}
            <div style={{
              flex: "0 0 auto",
              background: sel.color, border: `3px solid ${C.line}`, borderRadius: 18,
              boxShadow: chunk(4, 5),
              padding: 10, transform: "rotate(-3deg)",
            }}>
              <FaceSVG color={sel.color} mood={sel.mood} size={72} stroke={C.line} />
            </div>

            {/* name column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.inkDim, letterSpacing: ".2em",
                textTransform: "uppercase", fontFamily: FONT.mono,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>display name</span>
                {/* dice roll button */}
                <button
                  type="button"
                  onClick={randomize}
                  title="roll for a random handle + face"
                  style={{
                    border: `2px solid ${C.line}`, borderRadius: 10,
                    background: ACCENT, color: ACCENT_INK,
                    width: 32, height: 32, padding: 0, cursor: "pointer",
                    boxShadow: chunk(2, 3),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
                    transition: "transform .45s cubic-bezier(.5,.1,.3,1.2)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke={C.line} strokeWidth="2" />
                    <circle cx="7"  cy="7"  r="1.4" fill={C.line} />
                    <circle cx="13" cy="7"  r="1.4" fill={C.line} />
                    <circle cx="10" cy="10" r="1.4" fill={C.line} />
                    <circle cx="7"  cy="13" r="1.4" fill={C.line} />
                    <circle cx="13" cy="13" r="1.4" fill={C.line} />
                  </svg>
                </button>
              </div>

              <input
                id="create-room-nickname"
                name="nickname"
                type="text"
                autoComplete="username"
                maxLength={128}
                value={nicknameRaw}
                onChange={(e) => onNicknameChange(e.target.value)}
                placeholder="type a handle"
                aria-invalid={error !== null}
                style={{
                  width: "100%", padding: "6px 0 8px", marginTop: 4,
                  border: "none",
                  borderBottom: `2.5px dashed ${error ? DR.semantic.danger : C.line}`,
                  background: "transparent", color: C.ink,
                  fontFamily: FONT.display, fontSize: 28, fontWeight: 900,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{
                marginTop: 6, fontSize: 11, color: error ? DR.semantic.danger : C.inkDim,
                fontFamily: FONT.mono,
                display: "flex", justifyContent: "space-between",
              }}>
                <span>{error ?? "lobby badge · host"}</span>
                <span>{nicknameRaw.length}/{NICKNAME_MAX_GRAPHEMES}</span>
              </div>
            </div>
          </div>

          {/* colorway swatches */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.inkDim, letterSpacing: ".2em",
              textTransform: "uppercase", fontFamily: FONT.mono, marginBottom: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>colorway</span>
              <button
                type="button"
                onClick={randomize}
                style={{
                  border: "none", background: "transparent",
                  color: C.inkDim, fontFamily: FONT.mono, fontSize: 11, fontWeight: 700,
                  letterSpacing: ".1em", cursor: "pointer", padding: 0,
                  textTransform: "uppercase", textDecoration: "underline",
                }}
              >
                ⚄ roll the dice
              </button>
            </div>
            <div
              role="group"
              aria-label="Avatar preset"
              style={{ display: "flex", gap: 8 }}
            >
              {AVATAR_OPTIONS.map((a) => {
                const on = a.id === avatarId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { onAvatarChange(a.id); setMoodOverride(null); }}
                    title={a.label}
                    style={{
                      flex: 1, height: 36, borderRadius: 10,
                      border: `2.5px solid ${C.line}`,
                      background: a.color, cursor: "pointer",
                      boxShadow: on ? chunk(3, 4) : "none",
                      transform: on ? "translate(-1px,-1px)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: ACCENT_INK,
                      transition: "box-shadow .1s, transform .1s",
                    }}
                  >
                    {on ? "✓" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* stamp row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 12, borderTop: `2px dashed ${C.inkDim}`,
            fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: C.inkDim,
          }}>
            <span>ROOM ID · ····</span>
            <span style={{
              border: `2px solid ${C.line}`, padding: "3px 8px", borderRadius: 6,
              color: ACCENT_INK, transform: "rotate(-3deg)", background: ACCENT,
              fontWeight: 800,
            }}>
              HOST
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 460 }}>
          <Link
            href="/"
            style={{
              flex: "0 0 auto",
              border: `2.5px solid ${C.line}`, borderRadius: 14, background: "transparent",
              color: C.ink, padding: "14px 18px", fontWeight: 800, fontSize: 14,
              fontFamily: FONT.body, cursor: "pointer", textDecoration: "none",
              display: "inline-flex", alignItems: "center",
            }}
          >
            ← cancel
          </Link>
          <button
            type="submit"
            style={{
              flex: 1,
              border: `3px solid ${C.line}`, borderRadius: 14,
              background: nameEmpty ? C.soft : ACCENT, color: ACCENT_INK,
              padding: "14px 22px",
              fontFamily: FONT.display, fontWeight: 900, fontSize: 18, letterSpacing: ".02em",
              boxShadow: nameEmpty ? "none" : chunk(5, 6),
              cursor: nameEmpty ? "not-allowed" : "pointer",
              opacity: nameEmpty ? 0.55 : 1,
              transition: "background .15s, box-shadow .15s, opacity .15s",
            }}
          >
            open the room →
          </button>
        </div>
      </form>
    </div>
  );
}
