import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "./session-storage";
import type { SkribblSession } from "./session-storage";

const validSession: SkribblSession = {
  roomId: "room-abc-123",
  roomCode: "ABCDEF",
  playerId: "player-xyz",
  displayName: "TestUser",
  avatarPresetId: "preset-1",
  role: "host",
};

describe("session-storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a host session", () => {
    saveSession(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it("round-trips a guest session", () => {
    const guest: SkribblSession = { ...validSession, role: "guest" };
    saveSession(guest);
    expect(loadSession()).toEqual(guest);
  });

  it("clearSession removes the entry", () => {
    saveSession(validSession);
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null when nothing stored", () => {
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null for corrupt JSON", () => {
    sessionStorage.setItem("skribbl_session", "not-json{{");
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null when avatarPresetId is invalid", () => {
    sessionStorage.setItem(
      "skribbl_session",
      JSON.stringify({ ...validSession, avatarPresetId: "not-a-preset" }),
    );
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null when role is invalid", () => {
    sessionStorage.setItem(
      "skribbl_session",
      JSON.stringify({ ...validSession, role: "admin" }),
    );
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null when required field is missing", () => {
    const { roomId: _omit, ...rest } = validSession;
    sessionStorage.setItem("skribbl_session", JSON.stringify(rest));
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns null for empty string fields", () => {
    sessionStorage.setItem(
      "skribbl_session",
      JSON.stringify({ ...validSession, playerId: "" }),
    );
    expect(loadSession()).toBeNull();
  });

  it("saveSession overwrites previous entry", () => {
    saveSession(validSession);
    const updated: SkribblSession = { ...validSession, displayName: "NewName", role: "guest" };
    saveSession(updated);
    expect(loadSession()).toEqual(updated);
  });
});
