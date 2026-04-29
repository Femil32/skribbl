# Story 2.2: Round-robin drawer rotation

Status: done

## Story

As participants,
I want predictable drawer rotation each round,
So that everyone sketches fairly across the match (FR5, UX-DR8 drawer highlight).

## Acceptance criteria (satisfied)

- Server freezes deterministic `matchPlayerOrder` at match start (sorted roster ids).
- Each round index uses `order[roundIndex % order.length]` as `drawerPlayerId`; broadcast on every `matchPhase`.
- Multi-round loop: `ROUNDS_PER_MATCH` + `INTER_ROUND_GAP_MS` from `config/game.ts`.
- **PhaseBar** shows round (1-based display) + drawer display name on host and guest lobby match surfaces.

## File list

- `apps/server/src/config/game.ts`
- `apps/server/src/room/room.ts`
- `apps/server/src/room/room-manager.ts`
- `apps/server/src/room-ws.integration.test.ts`
- `packages/shared/src/schemas.ts`, `schemas.test.ts`
- `apps/web/src/features/match/components/PhaseBar.tsx`
- `apps/web/src/features/lobby/hooks/use-host-create-room.ts`, `use-guest-join-room.ts`
- `apps/web/src/features/lobby/components/LobbyHostPage.tsx`
- `apps/web/src/app/join/JoinRoomClient.tsx`

## Dev Agent Record

Composer — Epic 2 story 2-2 execution.
