"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type DrawingCanvasMode = "drawing" | "read-only" | "syncing";

export type DrawingCanvasProps = {
  /** Purpose of the surface for SR users (avoid generic “canvas”). */
  ariaLabel?: string;
  mode?: DrawingCanvasMode;
  className?: string;
};

/** Optional DPR cap to limit extreme HiDPI bitmap cost (Story 3.2 dev note). */
const MAX_DEVICE_PIXEL_RATIO = 2;

function resolveDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.devicePixelRatio ?? 1;
  return Math.min(Math.max(raw, 1), MAX_DEVICE_PIXEL_RATIO);
}

export type DrawingCanvasHandle = {
  /** Current density ratio used for backing store (after cap). */
  getDevicePixelRatio: () => number;
};

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    { ariaLabel = "Drawing surface for the current round", mode = "drawing", className = "" }: DrawingCanvasProps,
    ref
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const appliedDprRef = useRef(1);

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
    }, []);

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

    const readOnlyInteractions = mode === "read-only";

    return (
      <div
        ref={wrapperRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${className}`.trim()}
      >
        <canvas
          ref={canvasRef}
          aria-label={ariaLabel}
          className={`h-full min-h-0 w-full min-w-0 bg-base-200 ${readOnlyInteractions ? "pointer-events-none touch-none" : ""}`.trim()}
          role="img"
          style={{ verticalAlign: "top" }}
        />
      </div>
    );
  }
);
