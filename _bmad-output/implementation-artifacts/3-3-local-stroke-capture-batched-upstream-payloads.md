# Story 3.3: Local stroke capture & batched upstream payloads

Status: done

## Summary

Implemented pointer-driven stroke capture with ~50ms batched `drawingStrokeChunk` commands (Zod-validated in `@skribbl/shared`), local immediate preview, flush on pointer-up and tab hide, and integration props on `DrawingCanvas` (`strokeTransport`, `brushColor`, `brushWidthPx`, `remoteCommitted`).

## Acceptance criteria

- ✅ Batched payloads conform to shared wire schema; serialize path uses `serializeClientCommand`.
- ✅ Local polyline preview while chunks are formed and flushed.
- ✅ Non-drawer / no-transport: `/game` retains local freehand when `strokeTransport` is omitted.

## Tasks

- [x] Shared `drawingStrokeChunk` command + parsing/serialization tests  
- [x] `DrawingCanvas` batching + visibility flush + pointer capture  
- [x] Lobby hooks ignore `drawingStrokeCommitted` until match UI subscribes  

## File list (high level)

- `packages/shared/src/schemas.ts`, `schemas.test.ts`, `index.ts`  
- `apps/web/src/features/game/canvas/DrawingCanvas.tsx`, `stroke-draw.ts`  
- `apps/web/src/features/lobby/hooks/use-guest-join-room.ts`, `use-host-create-room.ts`  

## Dev agent record

Implemented in epic-story-runner continuation on branch `dev/epic-3-story-3-3` alongside Story 3.4 server fan-out.
