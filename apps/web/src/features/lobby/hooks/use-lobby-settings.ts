"use client";

import { useCallback } from "react";
import type { RoomSettings } from "@skribbl/shared";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import { serializeUpdateSettingsCommand } from "@/lib/ws-client";

/**
 * Wraps the lobby settings store and provides a sendSettings helper for the host.
 * Non-hosts get a no-op sendSettings so the same API works on guest pages.
 */
export function useLobbySettingsSync(
  sendGameJsonLine: (raw: string) => void,
  isHost: boolean,
) {
  const store = useLobbySettingsStore();

  const sendSettings = useCallback(
    (partial: Partial<RoomSettings>) => {
      if (!isHost) return;
      sendGameJsonLine(serializeUpdateSettingsCommand(partial));
    },
    [sendGameJsonLine, isHost],
  );

  return { store, sendSettings };
}
