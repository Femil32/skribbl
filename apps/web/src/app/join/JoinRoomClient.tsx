"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
} from "@skribbl/shared";
import { useGuestJoinRoom } from "@/features/lobby/hooks/use-guest-join-room";

const formatHintId = "join-room-code-format-hint";
const protocolErrId = "join-room-protocol-error";

type JoinRoomClientProps = {
  /** Already display-normalized on the server (`normalizeRoomCodeForDisplay`). */
  initialQueryCode: string | null;
};

/**
 * Paste-friendly join: valid **`?code=`** deep links connect immediately; manual entry shares the
 * same **`joinRoom`** path as client navigation to **`/join?code=`** (same as `JoinCodeEntry`).
 */
export function JoinRoomClient({ initialQueryCode }: JoinRoomClientProps) {
  const searchParams = useSearchParams();
  const codeFromRouter = searchParams.get("code");
  const effectiveQueryRaw =
    codeFromRouter != null && codeFromRouter !== ""
      ? codeFromRouter
      : (initialQueryCode ?? "");

  const urlNormalized =
    effectiveQueryRaw === "" ? null : normalizeRoomCode(effectiveQueryRaw);

  const urlReadyToAutoJoin =
    urlNormalized !== null && isValidRoomCodeForJoin(urlNormalized);

  const [typedRaw, setTypedRaw] = useState(() => {
    if (effectiveQueryRaw === "") return "";
    if (urlNormalized === null) return "";
    if (isValidRoomCodeForJoin(urlNormalized)) return "";
    return urlNormalized;
  });

  const raw = urlReadyToAutoJoin ? urlNormalized! : typedRaw;

  const [manualCommitted, setManualCommitted] = useState(false);
  const [joinGeneration, setJoinGeneration] = useState(0);

  const normalized = normalizeRoomCode(raw);
  const formatOk = isValidRoomCodeForJoin(normalized);

  const urlAutoJoin = urlReadyToAutoJoin;

  const activeJoinAttempt =
    (urlAutoJoin || manualCommitted) && formatOk;

  const guestState = useGuestJoinRoom({
    activeJoinAttempt,
    connectionAttemptId: joinGeneration,
    roomCodeInput: raw,
  });

  const connecting = guestState.status === "connecting";
  const helperFormat =
    raw.trim().length > 0 && !formatOk
      ? "After removing spaces and symbols, codes are six letters or numbers using 2–9 and A–Z (excluding O, I, and L)."
      : null;

  const protocolErrorMsg =
    guestState.status === "error" ? guestState.message : null;

  const ariaDescribed =
    [
      helperFormat ? formatHintId : null,
      protocolErrorMsg ? protocolErrId : null,
    ].filter(Boolean).join(" ") || undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formatOk) return;
    setManualCommitted(true);
    setJoinGeneration((n) => n + 1);
  }

  if (guestState.status === "joined") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-6 text-center">
            <h1 className="card-title text-2xl justify-center">You joined the room</h1>
            <p className="text-base-content/80">
              You are in the lobby. Live roster and host controls arrive in a later update.
            </p>
            <div className="space-y-2">
              <span className="text-sm font-medium text-base-content/70">
                Room code
              </span>
              <p className="font-mono text-2xl tracking-widest bg-base-200 rounded-box px-3 py-3 border border-base-300">
                {guestState.roomCode}
              </p>
            </div>
            <p className="text-sm text-base-content/70">
              Players here: <span className="font-semibold tabular-nums">{guestState.playerCount}</span>
            </p>
            <div className="card-actions flex-wrap justify-center gap-2">
              <Link href="/" className="btn btn-ghost">
                Home
              </Link>
              <Link href="/lobby" className="btn btn-primary">
                Create a room
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
      <div className="card bg-base-100 shadow-xl w-full max-w-lg">
        <div className="card-body gap-4 text-center">
          <h1 className="card-title text-2xl justify-center">Join a room</h1>
          <p className="text-base-content/80">
            Paste a code from an invite or type it. Full nickname and roster UI land in later stories.
          </p>

          {connecting ? (
            <div
              className="flex flex-col items-center gap-4 py-6"
              aria-live="polite"
            >
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="text-base-content/80">Joining…</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 w-full max-w-sm mx-auto text-left"
              noValidate
            >
              <label className="form-control w-full">
                <span className="label-text font-medium">Room code</span>
                <input
                  type="text"
                  name="roomCode"
                  id="join-room-code-input"
                  className="input input-bordered w-full font-mono"
                  value={raw}
                  onChange={(e) => setTypedRaw(e.target.value)}
                  readOnly={urlReadyToAutoJoin}
                  placeholder="Paste or type the code"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={connecting}
                  aria-invalid={Boolean(helperFormat || protocolErrorMsg)}
                  aria-describedby={ariaDescribed}
                />
              </label>

              {helperFormat ? (
                <p id={formatHintId} className="text-sm text-base-content/70">
                  {helperFormat}
                </p>
              ) : null}

              {protocolErrorMsg ? (
                <div
                  id={protocolErrId}
                  role="alert"
                  className="alert alert-warning text-sm"
                >
                  <span>{protocolErrorMsg}</span>
                </div>
              ) : null}

              {guestState.status === "error" ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm self-center"
                  onClick={() => setJoinGeneration((n) => n + 1)}
                >
                  Try again
                </button>
              ) : null}

              {urlAutoJoin ? null : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formatOk || connecting}
                >
                  Join room
                </button>
              )}
            </form>
          )}

          <div className="card-actions justify-center">
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
            <Link href="/lobby" className="btn btn-primary">
              Create a room
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
