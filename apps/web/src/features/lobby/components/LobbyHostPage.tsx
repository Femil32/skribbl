"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

export function LobbyHostPage() {
  const state = useHostCreateRoom();
  const [toast, setToast] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismissToast, 3200);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

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
              <Link href="/lobby" className="btn btn-primary">
                Try again
              </Link>
            </div>
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
            Share the link or code so friends can join.
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
