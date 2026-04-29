# Code review: Story 2.3 (word bank + WordChoicePanel)

**Depth:** standard  
**Scope:** Protocol (`chooseWord`, `wordChoiceOffer`), server word bank + match scheduler, web hooks + `WordChoicePanel`, `data/words.json`.

## Summary

Implementation matches acceptance criteria: drawer-only offers, validated payloads, early `chooseWord` transitions, timeout fallback to first word, UI panel with loading/error affordances, integration tests with static word bank. Rebuild `@skribbl/shared` so `dist/` includes new events before running `@skribbl/server` tests.

## Findings

| Severity | Area | Finding | Recommendation |
|----------|------|---------|----------------|
| Low | Server | If no socket matches `drawerPlayerId` in `emitWordChoiceOffer`, the round silently gets no offer and no `chooseWord` path (timer still picks word). | Log once per room or assert in dev; out of scope for MVP if roster invariant holds. |
| Low | Web | `wordChoiceOffer` dedupes on `matchRoundIndex`; first round may have `matchRoundIndex` undefined until first `matchPhase`. | Current `wordChoiceOffer` handler allows `prev.matchRoundIndex === undefined` — OK. |
| Info | Ops | `createWordBankFromEnv` default path is `cwd/data/words.json`; server must be started from monorepo root or `WORDS_PATH` set. | Document in server README when touched in a story that edits docs. |

**Verdict:** No blocking issues. Ship after tests + shared build are green.
