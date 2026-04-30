# Code review: Story 3.1 — match shell (canvas + chat scaffold)

**Scope:** Files from `3-1-direction-1-match-shell-canvas-column-chat-column-scaffold.md`  
**Depth:** standard (per-file + acceptance cross-check)  
**Reviewed:** 2026-04-30  
**Resolved:** 2026-04-30 — M-1 (`min-w-[320px]` only on `<main>`, `min-w-0` on inner canvas slot), L-1 (scroll independence test + optional `chatSlot`), L-2 (story tasks aligned with `w-full lg:w-80`).

## Summary

Implementation matches the story’s layout intent, landmarks, `data-testid` hooks, and Vitest coverage. Findings below were addressed in follow-up commits; re-run tests after changes.

---

## Findings (resolved 2026-04-30)

### Medium

| ID | Area | Location | Issue | Resolution |
|----|------|----------|-------|------------|
| M-1 | CSS / AC2 | `GamePage.tsx` | Conflicting `min-w-0` and `min-w-[320px]` on `<main>`. | `<main>` uses only `min-w-[320px]`; inner canvas placeholder uses `min-w-0 flex-1` for flex overflow. |

### Low

| ID | Area | Location | Issue | Resolution |
|----|------|----------|-------|------------|
| L-1 | Tests / AC5 | `GamePage.test.tsx` | No regression on chat scroll vs canvas. | Optional `chatSlot` prop + test that aside accepts scrollTop while `main` stays at 0 (jsdom metrics stubbed). |
| L-2 | Docs | Story tasks | `w-72` vs `w-full` below `lg`. | Task 2.5 text updated to `w-full lg:w-80`. |

### Informational

| ID | Note |
|----|------|
| I-1 | `apps/web/src/app/game/page.tsx` follows the same Server Component delegation pattern as `app/lobby/page.tsx`. |
| I-2 | `vitest.setup.ts` RTL `cleanup` in `afterEach` is appropriate for Vitest + React 19 and avoids duplicate node pollution. |
| I-3 | Flex chain uses `min-h-0` on shell and canvas column — good for nested overflow and chat scroll containment. |

---

## Acceptance criteria checklist

| AC | Verdict | Notes |
|----|---------|--------|
| 1 Side-by-side ≥1024px, chat width constrained, canvas fills | **Pass** | `lg:flex-row`, `flex-1` on main, `lg:w-80` on aside |
| 2 Below `lg`: stack; canvas min usable width | **Pass** | Single `min-w-[320px]` on `<main>` |
| 3 Landmarks header / main / aside | **Pass** | Matches implementation |
| 4 `data-testid` hooks | **Pass** | Covered by tests |
| 5 Chat scrolls independently | **Pass** | Structure + unit test with scroll stub |
| 6 Placeholder regions | **Pass** | “Canvas area” / “Chat area” copy present |

---

## Security

No new attack surface: static layout, no user input, no network in these files.

---

## Verification run

- `pnpm --filter @skribbl/web exec vitest run src/features/game/components/GamePage.test.tsx` — **6/6 passed** (re-verify after edits)

---

## Suggested next steps

None for this story; follow-up E2E can still assert real overflow in Playwright if desired.
