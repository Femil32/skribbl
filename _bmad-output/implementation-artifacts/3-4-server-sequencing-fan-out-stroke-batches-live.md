# Story 3.4: Server sequencing & fan-out — stroke batches live

Status: done

## Summary

Server assigns monotonic `drawingStrokeSeq` per drawing phase, validates drawer + phase + room id, and broadcasts `drawingStrokeCommitted` (with `seq`) to all room sockets. Errors use structured `error` events (`NOT_DRAWER`, `WRONG_PHASE`, `BAD_ROOM`).

## Acceptance criteria

- ✅ Validated batches get monotonic `seq` per `drawing` phase (reset when entering drawing).
- ✅ Broadcast to all connected peers in the room.
- ✅ Rejects when sender is not the current drawer or phase ≠ `drawing` or room id mismatch.

## Tasks

- [x] `Room.drawingStrokeSeq` + reset in `lockWordAndBeginDrawing`  
- [x] `RoomManager.applyDrawingStrokeChunk` + protocol handler wiring  
- [x] Shared `drawingStrokeCommitted` event shape  

## File list

- `apps/server/src/room/room.ts`  
- `apps/server/src/room/room-manager.ts`  
- `apps/server/src/protocol/handlers/handle-client-command.ts`  
- `packages/shared/src/schemas.ts`, `schemas.test.ts`  

## Notes

Lan/latency ≤100ms target (NFR-P1) is environment-dependent — fan-out path is synchronous `ws.send` per peer.
