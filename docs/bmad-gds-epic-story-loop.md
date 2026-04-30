# BMAD / GDS — Epic story loop (manual playbook)

Use this document when you want to run **every story in one epic** in order: create context → implement → review → fix → verify → commit, without skipping steps.

**Slash commands** below assume your Cursor/BMAD setup maps them to the GDS workflows (`gds-create-story`, `gds-dev-story`, `gds-code-review`). If a command is not registered, run the same workflow by opening the skill file and executing it end-to end (see [Skill paths](#skill-paths)).

---

## Prerequisites

1. **Sprint tracking exists** — `_bmad-output/implementation-artifacts/sprint-status.yaml` must be present and maintained (run sprint planning first if missing).
2. **Clean git tree** — before starting a new story branch, `git status` should be clean, or you should consciously stash/commit WIP.
3. **Epic number** — decide `E` (e.g. `3` for Epic 3).

---

## Canonical paths (this repo)

| Item | Path |
|------|------|
| GDS config | `_bmad/gds/config.yaml` |
| Sprint status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Story markdown files | `_bmad-output/implementation-artifacts/{story-key}.md` |
| Planning / epics | `_bmad-output/planning-artifacts/` (e.g. `epics.md`) |

---

## Status flow (do not skip backwards)

```
backlog → ready-for-dev → in-progress → review → done
```

| Status | Meaning |
|--------|---------|
| `backlog` | Story not fully contexted; run **create-story** |
| `ready-for-dev` | Story file ready; run **dev-story** |
| `in-progress` | Dev agent active (dev-story) |
| `review` | Implementation complete; run **code-review**, then fix findings |
| `done` | Review addressed, verified, committed |

Epic rows (`epic-{E}`) in `sprint-status.yaml` follow their own lifecycle (`backlog` → `in-progress` → `done`).

---

## Branch naming (required)

**Pattern:** `dev/epic-{E}-story-{E}-{S}`

- `{E}` = epic number  
- `{S}` = story number **within that epic**

**Examples:**

| Story key (prefix) | Branch |
|--------------------|--------|
| `3-1-…` | `dev/epic-3-story-3-1` |
| `3-2-…` | `dev/epic-3-story-3-2` |

Create or switch to this branch **before** you start work for that story so the whole create → dev → review → fix → commit chain sits on one branch per story.

```bash
git fetch origin
git checkout main   # or your agreed integration branch
git pull origin main
git checkout -b dev/epic-3-story-3-1    # replace 3 and 1 with E and S
# If the branch already exists:
# git checkout dev/epic-3-story-3-1
```

---

## Skill paths (fallback if slash commands are unavailable)

| Workflow | Skill file |
|----------|------------|
| Create story | `.cursor/skills/gds-create-story/SKILL.md` |
| Dev story | `.cursor/skills/gds-dev-story/SKILL.md` |
| Code review | `.cursor/skills/gds-code-review/SKILL.md` |

---

## Per-story loop (repeat for each story in Epic `E`)

For each story key `{E}-{S}-…` in **ascending** `S` order, while the story is not `done`:

### 1) Branch

Ensure you are on `dev/epic-{E}-story-{E}-{S}` (see [Branch naming](#branch-naming-required)).

### 2) Create story — `/gds-create-story`

**When:** `sprint-status.yaml` shows this story as `backlog` (no or incomplete story file).

**Run:** `/gds-create-story`

**Tell the agent explicitly if needed:**

- Epic and story: e.g. **Epic 3, story 3-1**, or story key `3-1-<slug>`.
- Paths: sprint file and implementation artifacts under `_bmad-output/implementation-artifacts/`.

**Verify:**

- `_bmad-output/implementation-artifacts/{story-key}.md` exists and is complete.
- Story status in sprint file is `ready-for-dev` (and story doc status matches workflow output).

**Skip this step** if the story is already `ready-for-dev` or later.

### 3) Implement — `/gds-dev-story`

**When:** Status is `ready-for-dev` or `in-progress`.

**Run:** `/gds-dev-story`

**Tell the agent:**

- Story file path if not auto-discovered: `_bmad-output/implementation-artifacts/{story-key}.md`.

**Verify (per skill / DoD):**

- All tasks in the story file checked off.
- Tests and linters pass as required by the project.
- Sprint status and story file show **`review`** when dev workflow completes (not `done` yet).

**Skip** if you are only fixing code-review items while already at `review` (go to step 4, then use dev-story or direct fixes as appropriate).

### 4) Code review — `/gds-code-review`

**When:** Story (and sprint row) is in **`review`**.

**Run:** `/gds-code-review`

**Verify:**

- Review outcome and action items are recorded (in the story file and/or review artifact per workflow).
- You have a clear list of **BLOCKER / MAJOR / MINOR** (or equivalent) findings.

### 5) Fix all findings + bugs

- Address **every** open review item and any failing tests/build.
- Update the **story file** only in allowed sections (tasks, dev agent record, file list, change log, status — per `gds-dev-story` rules).
- Re-run test/lint commands until green.
- If the review added unchecked follow-up tasks in the story, complete them and check them off.

### 6) Mark story done (status)

When fixes are verified:

1. Set the story’s row in **`sprint-status.yaml`** to **`done`** (preserve YAML comments; update `last_updated` if the file uses it).
2. Set the **Status** field in the story markdown file to **`done`** if your process requires it to match sprint tracking.

Do **not** mark `done` until tests and review findings are actually resolved.

### 7) Local commit (no push unless you decide otherwise)

Commit on the same branch `dev/epic-{E}-story-{E}-{S}`:

```bash
git status
git add -A
git commit -m "feat({E}-{S}): <short outcome aligned with story title>"
```

Use a message convention your team agrees on; keep the story id (`{E}-{S}`) in the subject for traceability.

---

## Ordering stories in an epic

1. Open `sprint-status.yaml` and list keys matching `{E}-{digit}-*` (not `epic-{E}`, not `epic-{E}-retrospective`).
2. Sort by story number numerically (`{E}-1-*`, `{E}-2-*`, …).
3. For each key not already `done`, run the [Per-story loop](#per-story-loop-repeat-for-each-story-in-epic-e).

---

## After the last story in the epic

- Set **`epic-{E}`** to **`done`** in `sprint-status.yaml` when all its stories are `done`.
- Optional: run **`/gds-retrospective`** for that epic if your module includes it.
- Optionally merge branches via PR; this playbook only mandates **local** commits per story branch.

---

## Automation note

For a **Cursor CLI–driven** variant (blocking `agent -p` per phase), see `.cursor/rules/BMAD Workflow Loop.mdc`.

---

## Quick checklist (one story)

- [ ] On branch `dev/epic-{E}-story-{E}-{S}`
- [ ] `/gds-create-story` if `backlog`
- [ ] `/gds-dev-story` through **`review`**
- [ ] `/gds-code-review`
- [ ] All findings fixed; tests/lint green
- [ ] Sprint + story status → **`done`**
- [ ] `git commit` on story branch
