"use client";

import type { DrawingStrokeCommitted, DrawingStrokePoint, RoomPhase } from "@skribbl/shared";
import { serializeClientCommand } from "@skribbl/shared";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { pointerClientToCanvasCss } from "./pointer-mapping";
import { drawStrokePolylineOnContext } from "./stroke-draw";

export type DrawingCanvasMode = "drawing" | "read-only" | "syncing";

export type DrawingStrokeTransport = {
  roomId: string;
  /** When `phase !== "drawing"` or player is not drawer, callers should omit transport or toggle `mode`. */
  phase: RoomPhase;
  localPlayerId: string;
  currentDrawerPlayerId: string | null;
  sendJsonLine: (raw: string) => void;
};

export type DrawingCanvasProps = {
  /** Purpose of the surface for SR users (avoid generic “canvas”). */
  ariaLabel?: string;
  mode?: DrawingCanvasMode;
  className?: string;
  brushColor?: string;
  brushWidthPx?: number;
  /** Wired from match sockets (Epic 3). When omitted, freehand doodles locally only (no outbound batches). */
  strokeTransport?: DrawingStrokeTransport | null;
  /**
   * Server-fan-out segments in commit order (`seq` ascending). Drawer entries still arrive but are skipped visually
   * because ink is rendered locally during capture (Story 3.3–3.4).
   */
  remoteCommitted?: DrawingStrokeCommitted[];
};

const MAX_DEVICE_PIXEL_RATIO = 2;
const DEFAULT_FLUSH_MS = 50;

function resolveDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(raw, 1), MAX_DEVICE_PIXEL_RATIO);
}

export type DrawingCanvasHandle = {
  getDevicePixelRatio: () => number;
};

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      ariaLabel = "Drawing surface for the current round",
      mode = "drawing",
      className = "",
      brushColor = "#0f172a",
      brushWidthPx = 4,
      strokeTransport = null,
      remoteCommitted = [],
    }: DrawingCanvasProps,
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const appliedDprRef = useRef(1);

    const strokeIdRef = useRef<string>("");
    const batchBufferRef = useRef<DrawingStrokePoint[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRenderedRef = useRef<DrawingStrokePoint | null>(null);
    const remoteWatermarkRef = useRef(0);
    const isPointerDrawingRef = useRef(false);

    const applyCanvasSizeAndTransform = useCallback(() => {
      const wrapper = wrapperRef.current;
      const canvasEl = canvasRef.current;
      if (!wrapper || !canvasEl) return;

      const dpr = resolveDevicePixelRatio();
      appliedDprRef.current = dpr;

      const cssW = Math.max(1, wrapper.clientWidth);
      const cssH = Math.max(1, wrapper.clientHeight);
      const nextW = Math.round(cssW * dpr);
      const nextH = Math.round(cssH * dpr);

      canvasEl.style.width = "100%";
      canvasEl.style.height = "100%";
      canvasEl.style.display = "block";

      if (canvasEl.width !== nextW) canvasEl.width = nextW;
      if (canvasEl.height !== nextH) canvasEl.height = nextH;

      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      remoteWatermarkRef.current = 0;
      lastRenderedRef.current = null;
      batchBufferRef.current = [];
    }, []);

    const cancelFlushTimer = useCallback(() => {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    }, []);

    const flushStrokeBatchNow = useCallback(
      (_reason: "interval" | "pointer-up" | "visibility" | "transport-off") => {
        cancelFlushTimer();

        const canvasEl = canvasRef.current;
        if (!canvasEl || !strokeTransport) {
          batchBufferRef.current = [];
          return;
        }

        const points = batchBufferRef.current;
        if (points.length === 0) return;

        const pid = strokeIdRef.current;
        if (!pid) {
          batchBufferRef.current = [];
          return;
        }

        batchBufferRef.current = [];

        const chunkId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `chunk-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const raw = serializeClientCommand({
          type: "drawingStrokeChunk",
          roomId: strokeTransport.roomId,
          strokeId: pid,
          chunkId,
          points,
          color: brushColor,
          lineWidthPx: brushWidthPx,
        });

        strokeTransport.sendJsonLine(raw);
      },
      [brushColor, brushWidthPx, cancelFlushTimer, strokeTransport],
    );

    const scheduleFlush = useCallback(() => {
      if (!strokeTransport) return;
      if (flushTimerRef.current != null) return;

      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushStrokeBatchNow("interval");
      }, DEFAULT_FLUSH_MS);
    }, [flushStrokeBatchNow, strokeTransport]);

    const enqueueBatchPointForTransport = useCallback(
      (p: DrawingStrokePoint) => {
        batchBufferRef.current.push(p);
        scheduleFlush();
      },
      [scheduleFlush],
    );

    const scheduleResize = useCallback(() => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyCanvasSizeAndTransform();
      });
    }, [applyCanvasSizeAndTransform]);

    useImperativeHandle(ref, () => ({
      getDevicePixelRatio: () => appliedDprRef.current,
    }));

    useEffect(() => {
      const wrapper = wrapperRef.current;
      const canvasEl = canvasRef.current;
      if (!wrapper || !canvasEl) return;

      applyCanvasSizeAndTransform();

      const ro = new ResizeObserver(() => {
        scheduleResize();
      });
      ro.observe(wrapper);

      window.addEventListener("resize", scheduleResize);

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", scheduleResize);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      };
    }, [applyCanvasSizeAndTransform, scheduleResize]);

    const pointerDrawingEnabled =
      mode !== "read-only" &&
      (!strokeTransport
        ? true
        : strokeTransport.phase === "drawing" &&
          strokeTransport.currentDrawerPlayerId === strokeTransport.localPlayerId);

    useEffect(() => {
      remoteWatermarkRef.current = 0;
    }, []);

    /** Apply server-fan-out segments for non-local players. */
    useEffect(() => {
      const canvasEl = canvasRef.current;
      const ctx = canvasEl?.getContext("2d");
      const localId = strokeTransport?.localPlayerId ?? "";

      if (remoteCommitted.length === 0) {
        remoteWatermarkRef.current = 0;
      }

      if (!canvasEl || !ctx) return;

      while (remoteWatermarkRef.current < remoteCommitted.length) {
        const evt = remoteCommitted[remoteWatermarkRef.current];
        remoteWatermarkRef.current += 1;
        if (!evt) continue;

        if (evt.senderPlayerId === localId) continue;

        drawStrokePolylineOnContext(ctx, evt.points, evt.color, evt.lineWidthPx);
      }
    }, [remoteCommitted, strokeTransport?.localPlayerId]);

    /** Flush pending outbound batches when the tab hides mid-stroke (NFR batched payloads). */
    useEffect(() => {
      function onHidden() {
        if (document.visibilityState !== "hidden") return;
        if (!strokeTransport) return;
        flushStrokeBatchNow("visibility");
        isPointerDrawingRef.current = false;
      }

      document.addEventListener("visibilitychange", onHidden);
      return () => {
        document.removeEventListener("visibilitychange", onHidden);
      };
    }, [flushStrokeBatchNow, strokeTransport]);

    const suppressPointerInteractions =
      mode === "read-only" || mode === "syncing" || !pointerDrawingEnabled;

    const readOnlyInteractions = suppressPointerInteractions;

    const onPointerCancel = useCallback(() => {
      if (!strokeTransport) {
        isPointerDrawingRef.current = false;
        lastRenderedRef.current = null;
        strokeIdRef.current = "";
        return;
      }

      flushStrokeBatchNow("pointer-up");
      isPointerDrawingRef.current = false;
      lastRenderedRef.current = null;
      strokeIdRef.current = "";
    }, [flushStrokeBatchNow, strokeTransport]);

    const onPointerDown = useCallback(
      (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!pointerDrawingEnabled) return;

        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        try {
          canvasEl.setPointerCapture(e.pointerId);
        } catch {
          /* noop — pointer capture is best-effort in tests */
        }

        isPointerDrawingRef.current = true;
        strokeIdRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        cancelFlushTimer();
        batchBufferRef.current = [];

        const p = pointerClientToCanvasCss(canvasEl, e.clientX, e.clientY, {
          devicePixelRatio: appliedDprRef.current,
        });
        lastRenderedRef.current = { x: p.x, y: p.y };

        if (strokeTransport) {
          enqueueBatchPointForTransport({ x: p.x, y: p.y });
        }
      },
      [cancelFlushTimer, enqueueBatchPointForTransport, pointerDrawingEnabled, strokeTransport],
    );

    const onPointerMove = useCallback(
      (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!pointerDrawingEnabled) return;

        const canvasEl = canvasRef.current;
        if (!canvasEl || !isPointerDrawingRef.current) return;

        const ctx = canvasEl.getContext("2d");
        if (!ctx) return;

        const p = pointerClientToCanvasCss(canvasEl, e.clientX, e.clientY, {
          devicePixelRatio: appliedDprRef.current,
        });
        const next: DrawingStrokePoint = { x: p.x, y: p.y };
        const prev = lastRenderedRef.current;
        lastRenderedRef.current = next;

        if (strokeTransport) {
          if (prev) {
            drawStrokePolylineOnContext(ctx, [prev, next], brushColor, brushWidthPx);
          }
          enqueueBatchPointForTransport(next);
        } else if (prev) {
          drawStrokePolylineOnContext(ctx, [prev, next], brushColor, brushWidthPx);
        }
      },
      [
        brushColor,
        brushWidthPx,
        enqueueBatchPointForTransport,
        pointerDrawingEnabled,
        strokeTransport,
      ],
    );

    const onPointerUp = useCallback(() => {
      if (!isPointerDrawingRef.current) return;
      flushStrokeBatchNow("pointer-up");
      isPointerDrawingRef.current = false;
      lastRenderedRef.current = null;
      strokeIdRef.current = "";
    }, [flushStrokeBatchNow]);

    useEffect(() => {
      cancelFlushTimer();
      batchBufferRef.current = [];

      const canvasEl = canvasRef.current;

      /** Release pointer capture when transport toggles off mid-interaction. */
      if (!strokeTransport && canvasEl) {
        isPointerDrawingRef.current = false;
      }
    }, [cancelFlushTimer, strokeTransport]);

    return (
      <div
        ref={wrapperRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${className}`.trim()}
      >
        <canvas
          ref={canvasRef}
          aria-label={ariaLabel}
          className={`h-full min-h-0 w-full min-w-0 bg-base-200 ${readOnlyInteractions ? "pointer-events-none touch-none" : "touch-none"}`}
          role="img"
          style={{ verticalAlign: "top" }}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
    );
  },
);
