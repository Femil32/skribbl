"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { normalizeRoomCodeForDisplay } from "@/lib/invite-url";

export function JoinCodeEntry() {
  const router = useRouter();
  const [raw, setRaw] = useState("");

  const normalized = normalizeRoomCodeForDisplay(raw);
  const canSubmit = normalized.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    router.push(`/join?code=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <label className="form-control w-full">
        <span className="label-text font-medium">Have a room code?</span>
        <input
          type="text"
          name="roomCode"
          className="input input-bordered w-full font-mono"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste or type the code"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        Continue
      </button>
    </form>
  );
}
