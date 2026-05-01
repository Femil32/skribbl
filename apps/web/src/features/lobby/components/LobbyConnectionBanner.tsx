"use client";

import type { LobbyConnectionReason, LobbyTransportPhase } from "@/features/lobby/lib/lobby-transport";
import { lobbyConnectionBannerModel } from "@/features/lobby/lib/lobby-transport";

export type LobbyConnectionBannerProps = {
  transport: LobbyTransportPhase;
  reason: LobbyConnectionReason;
  errorMessage?: string;
  awaitingRoomHandshake?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  onReload?: () => void;
  reloadLabel?: string;
};

/**
 * Sticky lobby strip for honest WebSocket lifecycle labels (ConnectionBanner UX).
 * `role="alert"` only for blocking transport failures; connecting/reconnecting/live use `status`.
 */
export function LobbyConnectionBanner(props: LobbyConnectionBannerProps) {
  const {
    transport,
    reason,
    errorMessage,
    awaitingRoomHandshake,
    onRetry,
    retryLabel = "Retry connection",
    onReload,
    reloadLabel = "Reload page",
  } = props;

  const model = lobbyConnectionBannerModel({
    transport,
    reason,
    errorMessage,
    awaitingRoomHandshake,
  });

  if (!model) return null;

  const { alertRole, alertClass, title, description, showRetry, showReload } = model;

  const retrySlot =
    showRetry && onRetry ? (
      <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={onRetry}>
        {retryLabel}
      </button>
    ) : null;

  const reloadSlot =
    showReload && onReload ? (
      <button type="button" className="btn btn-outline btn-primary btn-sm shrink-0" onClick={onReload}>
        {reloadLabel}
      </button>
    ) : null;

  const actionsSlot =
    retrySlot || reloadSlot ? (
      <div className="flex flex-wrap gap-2 shrink-0 justify-end">{retrySlot}{reloadSlot}</div>
    ) : null;

  return (
    <div
      className={`sticky top-0 z-40 w-full border-b border-base-300 shadow-sm ${alertClass}`}
      role={alertRole}
      aria-live={alertRole === "alert" ? "assertive" : "polite"}
    >
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-base-content">{title}</p>
          {description ? (
            <p className="text-base-content/90 mt-0.5">{description}</p>
          ) : null}
        </div>
        {actionsSlot}
      </div>
    </div>
  );
}
