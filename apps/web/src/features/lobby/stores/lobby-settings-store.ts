import { create } from "zustand";
import type { WordPackId } from "@/features/lobby/design/tokens";

export type LobbySettings = {
  rounds: number;
  drawTime: number;
  maxPlayers: number;
  wordPack: WordPackId;
  showHints: boolean;
  skipAfk: boolean;
  allowVoice: boolean;
};

type LobbySettingsActions = {
  setRounds: (v: number) => void;
  setDrawTime: (v: number) => void;
  setMaxPlayers: (v: number) => void;
  setWordPack: (v: WordPackId) => void;
  setShowHints: (v: boolean) => void;
  setSkipAfk: (v: boolean) => void;
  setAllowVoice: (v: boolean) => void;
};

export const useLobbySettingsStore = create<LobbySettings & LobbySettingsActions>((set) => ({
  rounds: 6,
  drawTime: 80,
  maxPlayers: 12,
  wordPack: "classic",
  showHints: true,
  skipAfk: true,
  allowVoice: false,

  setRounds: (v) => set({ rounds: v }),
  setDrawTime: (v) => set({ drawTime: v }),
  setMaxPlayers: (v) => set({ maxPlayers: v }),
  setWordPack: (v) => set({ wordPack: v }),
  setShowHints: (v) => set({ showHints: v }),
  setSkipAfk: (v) => set({ skipAfk: v }),
  setAllowVoice: (v) => set({ allowVoice: v }),
}));
