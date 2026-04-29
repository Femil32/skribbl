"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  avatarPresets,
  countGraphemes,
  sanitizeDisplayName,
} from "@skribbl/shared";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useHostCreateRoom } from "@/features/lobby/hooks/use-host-create-room";
import {
  buildRoomInviteUrl,
  resolvePublicWebOrigin,
} from "@/lib/invite-url";

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined") {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  await navigator.clipboard.writeText(text);
}

function clipboardFailureMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = String((err as Error).name);
    if (name === "NotAllowedError") {
      return "Copy was blocked. Allow clipboard access for this site, or copy manually.";
    }
  }
  if (
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost"
  ) {
    return "Copy needs a secure connection (https). You can copy the text manually below.";
  }
  return "Copy is not available in this browser. You can select and copy the text below.";
}

const nicknameHintId = "host-lobby-nickname-hint";
const nicknameErrId = "host-lobby-nickname-error";

export function LobbyHostPage() {
  const [nicknameRaw, setNicknameRaw] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarPresetId>(
    DEFAULT_AVATAR_PRESET_ID,
  );
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState(0);

  const nicknameTrimmed = nicknameRaw.trim();
  const nicknameSanitized = sanitizeDisplayName(nicknameTrimmed);
  const nicknameEmpty = submitted && nicknameTrimmed.length === 0;
  const nicknameTooLong =
    submitted &&
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) > NICKNAME_MAX_GRAPHEMES;
  const nicknameOk =
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) <= NICKNAME_MAX_GRAPHEMES;

  const shouldConnect = submitted && nicknameOk;

  const state = useHostCreateRoom({
    shouldConnect,
    attemptId,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
  });

  const [toast, setToast] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleCreate = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const trimmed = nicknameRaw.trim();
    const sanitized = sanitizeDisplayName(trimmed);
    if (
      trimmed.length === 0 ||
      sanitized.length === 0 ||
      countGraphemes(sanitized) > NICKNAME_MAX_GRAPHEMES
    ) {
      return;
    }
    setAttemptId((n) => n + 1);
  }, [nicknameRaw]);

  if (!submitted || !nicknameOk) {
    const nickFieldError = nicknameEmpty
      ? "Enter a display name."
      : nicknameTooLong
        ? `Use at most ${String(NICKNAME_MAX_GRAPHEMES)} characters.`
        : null;
    const ariaNickname = [nicknameHintId, nickFieldError ? nicknameErrId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">Create a room</h1>
            <p className="text-base-content/80">
              Choose how you appear in the lobby before we open your room.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleCreate} noValidate>
              <label className="form-control w-full">
                <span className="label-text font-medium">Display name</span>
                <input
                  type="text"
                  id="host-lobby-nickname"
                  name="nickname"
                  className="input input-bordered w-full"
                  value={nicknameRaw}
                  onChange={(ev) => setNicknameRaw(ev.target.value)}
                  autoComplete="username"
                  maxLength={128}
                  aria-invalid={Boolean(nickFieldError)}
                  aria-describedby={ariaNickname || undefined}
                />
              </label>
              <p id={nicknameHintId} className="text-sm text-base-content/70">
                Plain text only — no HTML. Shown to everyone in the lobby.
              </p>
              {nickFieldError ? (
                <p id={nicknameErrId} role="alert" className="text-sm text-warning">
                  {nickFieldError}
                </p>
              ) : null}

              <div className="form-control w-full">
                <span className="label-text font-medium mb-2">Avatar</span>
                <div
                  className="flex flex-wrap gap-2 justify-center sm:justify-start"
                  role="group"
                  aria-label="Avatar preset"
                >
                  {avatarPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm gap-2 ${
                        avatarId === p.id ? "btn-primary" : "btn-outline"
                      }`}
                      aria-pressed={avatarId === p.id}
                      onClick={() => setAvatarId(p.id)}
                    >
                      <span
                        className="inline-block size-6 rounded-full border border-base-300 bg-gradient-to-br from-primary/30 to-secondary/40"
                        aria-hidden
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-actions justify-end">
                <Link href="/" className="btn btn-ghost">
                  Back home
                </Link>
                <button type="submit" className="btn btn-primary">
                  Create room
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "connecting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body items-center text-center gap-4">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/80">Creating your room…</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">Could not create room</h1>
            <div className="alert alert-warning" role="alert">
              <span>{state.message}</span>
            </div>
            <div className="card-actions justify-end">
              <Link href="/" className="btn btn-ghost">
                Back home
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSubmitted(false);
                  setAttemptId((n) => n + 1);
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status !== "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body items-center text-center gap-4">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/80">Creating your room…</p>
          </div>
        </div>
      </div>
    );
  }

  const { roomCode } = state;
  const publicOrigin =
    resolvePublicWebOrigin() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const inviteUrl = publicOrigin
    ? buildRoomInviteUrl(roomCode, publicOrigin)
    : `/join?code=${encodeURIComponent(roomCode)}`;

  async function handleCopy(label: "link" | "code", text: string) {
    setCopyError(null);
    try {
      await copyToClipboard(text);
      setToast(label === "link" ? "Link copied" : "Code copied");
    } catch (err) {
      setCopyError(clipboardFailureMessage(err));
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
      <div
        className="toast toast-end toast-bottom z-50"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast ? (
          <div className="alert alert-success shadow-md">
            <span>{toast}</span>
          </div>
        ) : null}
      </div>

      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body gap-6">
          <h1 className="card-title text-2xl">Your lobby</h1>
          <p className="text-base-content/80">
            You are <span className="font-semibold">{state.displayName}</span>{" "}
            in this room. Share the link or code so friends can join.
          </p>

          <div className="space-y-2">
            <span className="text-sm font-medium text-base-content/70">
              Invite link
            </span>
            <p className="font-mono text-sm break-all bg-base-200 rounded-box px-3 py-2 border border-base-300">
              {inviteUrl}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-base-content/70">
              Room code
            </span>
            <p className="font-mono text-2xl tracking-widest text-center bg-base-200 rounded-box px-3 py-3 border border-base-300">
              {roomCode}
            </p>
          </div>

          {copyError ? (
            <div className="alert alert-warning" role="alert">
              <span>{copyError}</span>
            </div>
          ) : null}

          <div className="card-actions flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-primary"
              onClick={() => handleCopy("link", inviteUrl)}
            >
              Copy link
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-primary"
              onClick={() => handleCopy("code", roomCode)}
            >
              Copy code
            </button>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
