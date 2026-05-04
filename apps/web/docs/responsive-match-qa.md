# Responsive match UX (UX-DR17) — QA checklist

Short manual passes for host + guest match shells (`LobbyHostPage`, `JoinRoomClient`, `/game` scaffold). Canonical test ids used in CI smoke: **`phase-bar`**, **`drawing-canvas`**, **`chat-composer-input`**.

## Breakpoints / layout grid

- **`sm`** (~640 px): content column stays usable (no clipped controls); roster/panels readable.
- **`md`** (~768 px): match grid remains legible before **lg**.
- **`lg`** (~1024 px): two-column rhythm — **`lg:flex-row`** on canvas + chat; chat column **`lg:w-80`**; drawing column keeps **`min-w-[320px]`** floor on main canvas lane.

## Viewport widths to spot-check

- **Mobile narrow:** ~375 px wide × ~667 px tall.
- **Tablet:** ~834 × ~1112 (rotated usable).
- **Desktop:** ≥1280 px wide — confirm **`lg:flex-row`** and drawer/chat side-by-side.

## Resize order (drawer UX)

1. Start at desktop width with match UI visible (`phase-bar`, canvas, chat).
2. Narrow to **below `lg`** — stack should be stable (canvas first, chat **below**, scroll independent).
3. Widen again — restored **aside** scroll without resetting canvas incorrectly.

## Canvas stroke mapping smoke (desktop-first)

- With dev or live drawer role, drag short strokes across the bordered canvas (**`drawing-canvas`** wrapper).
- **Resize** browser width (maintain drawer) — strokes should rescale visually with the surface; coordinate mapping stays aligned (CSS pixel space + device pixel ratio). No duplicate overlays or ghost canvases after resize.

## Chat column scroll / focus

- Fill chat history (many lines) until message list scrolls.
- Composer (**`chat-composer-input`**) stays usable; scrolling history does not trap focus (Tab should reach landmarks per a11y story when present).
