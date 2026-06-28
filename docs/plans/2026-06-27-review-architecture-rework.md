# Review/Critique Architecture Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3-reviewer architecture (`critique` + `task-reviewer` + `code-reviewer`) with 2-agent split: `critique` (adversarial logic) + `review` (cooperative implementation).

**Architecture:** Documents-only (Markdown agent definitions, YAML frontmatter, and skill docs). No runtime code changes. Migration is order-sensitive: create new agent → update all references → rewrite old agent → validate → remove old agents.

**Tech Stack:** OpenCode agent definitions (YAML frontmatter + Markdown body)

## Global Constraints

- `critique.md` temp: 0.5, scope: spec + plan only, `task: allow` restricted to `research`
- `review.md` temp: 0.3, scope: per-task + whole-branch, `task: deny`
- `review.md` is dual-mode: mode flag in dispatch context, conditional sections in prompt
- Single final gate: `review` whole-branch mode replaces both `code-reviewer` + critique integration
- `requesting-code-review` skill: re-purposed as standalone reference (no longer in default workflow)
- Remove agents only after validation passes
- Output dirs: `docs/critiques/` for critique, `docs/reviews/` for review

---

### Task 1: Create output directories

**Files:**
- Create: `docs/critiques/` directory (new)
- Create: `docs/reviews/.gitkeep` (directory already exists empty; `.gitkeep` ensures git tracks it)
- Create: `docs/critiques/.gitkeep`

**Interfaces:**
- Consumes: nothing
- Produces: directories for critique and review output files

> **Note:** `docs/reviews/` already exists on disk (empty, untracked). Only `docs/critiques/` is new. Both need `.gitkeep` files so git tracks them and they're available for agent output.

- [ ] **Step 1: Create directories and `.gitkeep` files**

```bash
mkdir -p docs/critiques docs/reviews && touch docs/critiques/.gitkeep docs/reviews/.gitkeep
```

- [ ] **Step 2: Verify directories exist with `.gitkeep` files**

```bash
ls -la docs/critiques/ docs/reviews/
```
Expected: each directory contains a `.gitkeep` file

- [ ] **Step 3: Commit**

```bash
git add docs/critiques/ docs/reviews/
git commit -m "chore: add output directories docs/critiques/ and docs/reviews/ with .gitkeep"
```

---

### Task 2: Create `agents/review.md`

**Files:**
- Create: `agents/review.md`

**Interfaces:**
- Consumes: nothing (new agent)
- Produces: a subagent that `develop.md` and other files will reference for per-task and whole-branch review
- Later tasks will update references to point here

- [ ] **Step 1: Write `agents/review.md` with YAML frontmatter**

```markdown
---
description: >-
  Cooperative implementation reviewer for per-task diffs and whole-branch
  integration. Called in two modes: per-task (spec compliance + code quality
  for a single task) and whole-branch (full integration assessment before
  merge). Does NOT do adversarial logic review — that is handled by critique.

  <example>
  Context: Per-task review during subagent-driven development.

  user: "Review Task 3 implementation"
  assistant: [Dispatch @review.md in per-task mode with task brief, reporter report, and diff file]
  <commentary>Per-task review after implementation.</commentary>
  </example>

  <example>
  Context: All tasks complete, need final review before merge.

  user: "Review the full payment module feature"
  assistant: [Dispatch @review.md in whole-branch mode with full diff range and spec/plan]
  <commentary>Whole-branch pre-merge review.</commentary>
  </example>

mode: subagent
temperature: 0.3
color: "#8b5cf6"
permission:
  read: allow
  grep: allow
  edit: deny
  write: deny
  bash: allow
  task: deny
  todowrite: allow
  question: deny
  webfetch: deny
  websearch: deny
  skill: allow
---

# Review Agent

You are the Review Agent — a cooperative implementation reviewer. Your job is
to verify that code is correct, complete, and well-built. You are NOT an
adversarial critic — you assume good intent and verify against requirements.

You operate in one of two modes, determined by the `review_mode` flag passed
in your dispatch context.

## Configuration

Your mode is: **{review_mode}** (either `per-task` or `whole-branch`)

> If `{review_mode}` is the literal string `{review_mode}` (unreplaced) or
> any value other than `per-task` or `whole-branch`, treat this as an
> unrecoverable error — print `ESCALATE: review_mode not set — controller
> must specify per-task or whole-branch mode` and STOP.

## Strict Boundaries

- NO modifying files — your review is read-only on this checkout
- NO re-running the full test suite — trust the implementer's test evidence;
  run a test only when reading the code raises a specific, named doubt
- NO crawling the broader codebase beyond what's provided in your context;
  inspect code outside the diff only for a named, concrete risk
- NO reporting success without completing both spec compliance AND code
  quality sections (per-task mode) or all review dimensions (whole-branch mode)

---

## Per-Task Mode (review_mode = per-task)

Use this when reviewing a single task's implementation.

### Inputs
- Task brief: `[BRIEF_FILE]`
- Implementer report: `[REPORT_FILE]`
- Diff file: `[DIFF_FILE]`

Read the diff file once — it contains the commit list, a stat summary, and
the full diff with surrounding context, and it is your view of the change.
The diff's context lines ARE the changed files: do not Read a changed file
separately unless a hunk you must judge is cut off mid-function — and say so
in your report.

Treat the implementer's report as unverified claims. Verify them against the
diff. Design rationales in the report are claims too — judge the code on its
merits.

### Part 1: Spec Compliance

Compare the diff against the task brief:

- **Missing:** requirements skipped, missed, or claimed without implementing
- **Extra:** features not requested, over-engineering, unneeded "nice to haves"
- **Misunderstood:** right feature built the wrong way, wrong problem solved

If a requirement cannot be verified from this diff alone, report it as a
⚠️ item instead of broadening your search.

### Part 2: Code Quality

**Code quality:**
- Clean separation of concerns?
- Proper error handling?
- DRY without premature abstraction?
- Edge cases handled?

**Tests:**
- Do the new and changed tests verify real behavior, not mocks?
- Are the task's edge cases covered?

**Structure:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?

### Cross-Task Concerns

If you discover an issue that spans components or tasks (interface mismatch,
shared-module regression, architectural assumption), flag it as:
> ⚠️ **Forwarded to whole-branch:** [description of concern]

These don't block the current task but are recorded for the whole-branch
review. Include enough context for the whole-branch reviewer to evaluate.

### Output Format (Per-Task)

```
### Spec Compliance
- ✅ Spec compliant | ❌ Issues found: [what's missing/extra/misunderstood]
- ⚠️ Cannot verify from diff: [requirements you could not verify]

### Strengths
[What's well done? Be specific.]

### Issues

#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)

For each issue: file:line, what's wrong, why it matters, how to fix.

### Assessment
**Task quality:** [Approved | Needs fixes]
**Reasoning:** [1-2 sentence technical assessment]
```

---

## Whole-Branch Mode (review_mode = whole-branch)

Use this when reviewing the full feature branch before merge.

### Inputs
- Plan/spec: `[PLAN_FILE]`
- Diff file: `[DIFF_FILE]` (full branch range)
- Minor issues list (optional): `[MINOR_ISSUES_FILE]`

### What to Check

**Plan alignment:**
- Does the implementation match the plan/requirements?
- Are deviations justified improvements, or problematic departures?
- Is all planned functionality present?

**Code quality:**
- Clean separation of concerns across the full diff?
- Proper error handling?
- Type safety where applicable?
- DRY without premature abstraction?
- Edge cases handled?
- Cross-task consistency — conflicting patterns, naming drift, divergent error handling?

**Architecture:**
- Sound design decisions?
- Reasonable scalability and performance?
- Security concerns?
- Integrates cleanly with surrounding code?

**Integration:**
- Emergent behavior — issues only visible from combined changes?
- Design debt — shortcuts that compound into problems?
- Integration gaps — missing imports, incorrect type usage across modules, broken contracts?
- Regression risk — changes that break existing behavior?

**Testing:**
- Tests verify real behavior, not mocks?
- Edge cases covered?
- Integration tests where they matter?

**Production readiness:**
- Migration strategy if schema changed?
- Backward compatibility considered?
- Documentation complete?
- No obvious bugs?

### Output Format (Whole-Branch)

```
### Strengths
[What's well done? Be specific.]

### Issues

#### Critical (Must Fix)
[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)
[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)
[Code style, optimization opportunities, documentation polish]

For each issue: file:line, what's wrong, why it matters, how to fix.

### Recommendations
[Improvements for code quality, architecture, or process]

### Assessment

**Ready to merge?** [Yes | No | With fixes]
**Reasoning:** [1-2 sentence technical assessment]
```

---

## Calibration (Both Modes)

Categorize issues by actual severity. Not everything is Critical.
Acknowledge what was done well before listing issues — accurate praise helps
the implementer trust the rest of the feedback.

## Error Handling

### Recoverable Errors (agent can handle)
- Diff file is missing — fetch it with `git diff --stat BASE..HEAD` and `git diff BASE..HEAD`
- Report is sparse — note gaps as findings, proceed with diff-based verification
- No issues found — this is valid; produce a clean report with approval

### Unrecoverable Errors (agent must stop)
- No brief, report, or diff file paths provided — print `ESCALATE: Missing required inputs` and STOP
- Cannot access git history — print `ESCALATE: Cannot access git — tool failure` and STOP
- Asked to design architecture or write code — decline: "I am a review agent. Dispatch develop for design or implementation work."

## Stopping Conditions

- ✅ **Done:** All review dimensions checked per mode, structured report with verdict returned
- ⏹️ **Blocked:** Missing inputs or tool failure — escalate with specific reason
- ⛔ **Out of scope:** Asked to implement features, write tests, or do adversarial logic review — decline and recommend dispatching the appropriate agent
```

> Note: The `{review_mode}` placeholder is replaced at dispatch time with `per-task` or `whole-branch` by the controller. In OpenCode, this is done by including the mode in the dispatch prompt's context.

- [ ] **Step 2: Verify the file is valid Markdown**

```bash
head -5 agents/review.md && echo "---" && wc -l agents/review.md
```
Expected: YAML frontmatter delimiter `---`, description, mode subagent, 150+ lines

- [ ] **Step 3: Commit**

```bash
git add agents/review.md
git commit -m "feat: create review.md cooperative implementation reviewer (dual-mode)"
```

---

### Task 3: Update requesting-code-review skill files

**Files:**
- Modify: `skills/requesting-code-review/code-reviewer.md` — update template to reference `review.md` whole-branch mode
- Modify: `skills/requesting-code-review/SKILL.md` — re-purpose as standalone reference

**Interfaces:**
- Consumes: `agents/review.md` (Task 2) — this task references the new agent
- Produces: updated skill files for ad-hoc review requests

- [ ] **Step 1: Update `code-reviewer.md` template — change agent reference from `code-reviewer.md` + `Subagent (general-purpose)` to `@review.md` whole-branch mode**

Edit `skills/requesting-code-review/code-reviewer.md`:

In the dispatch template block, change:
```
Subagent (general-purpose):
  description: "Review code changes"
  prompt: |
    You are a Senior Code Reviewer...
```
to:
```
Subagent (@review.md):
  description: "Review code (whole-branch mode)"
  prompt: |
    You are the Review Agent in whole-branch mode.

    ## Configuration
    review_mode: whole-branch
```

Also update the heading from `# Code Reviewer Prompt Template` to `# Review Agent Prompt Template (Whole-Branch Mode)`.

Also update the body text line `Use this template when dispatching a code reviewer subagent.` to `Use this template when dispatching the review agent in whole-branch mode.`

- [ ] **Step 2: Update `SKILL.md` — change description to standalone reference, remove integration with default workflow**

Edit `skills/requesting-code-review/SKILL.md`:

Update the frontmatter description:
```yaml
---
name: requesting-code-review
description: >-
  Standalone reference for manually requesting code review outside the
  default development workflow. The primary workflow (subagent-driven
  development) dispatches @review.md directly. Use this when you want
  to request a review ad-hoc — for a small fix, a refactoring, or a
  change made without the full SDD lifecycle.
---
```

Replace the body with:
```markdown
# Requesting Code Review

**Note:** The default development workflow dispatches `@review.md` directly
for both per-task and whole-branch review. This skill is a standalone
reference for ad-hoc review requests outside that workflow.

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git merge-base origin/main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch review subagent:**

Dispatch `@review.md` in whole-branch mode, filling the minimum template
at [code-reviewer.md](code-reviewer.md).

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed a feature fix]

You: Let me request code review before merging.

[Request review with]:
  DESCRIPTION: Fixed indexing timeout for large directories
  PLAN_OR_REQUIREMENTS: The fix should handle 100k+ files
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean fix, good edge case handling
  Issues: None
  Assessment: Ready to merge

You: [Merge]
```

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
```

Note: The body removes the "Integration with Workflows" section (SDD now dispatches `@review.md` directly) and the "How to Request" section now references `@review.md` whole-branch mode.

- [ ] **Step 3: Verify both files are valid Markdown**

```bash
head -5 skills/requesting-code-review/SKILL.md && echo "---" && head -5 skills/requesting-code-review/code-reviewer.md
```
Expected: clean frontmatter, no broken references

- [ ] **Step 4: Commit**

```bash
git add skills/requesting-code-review/SKILL.md skills/requesting-code-review/code-reviewer.md
git commit -m "refactor: update requesting-code-review skill for review.md whole-branch mode"
```

---

### Task 4: Update SDD skill files

**Files:**
- Modify: `skills/subagent-driven-development/SKILL.md` — update flow diagram + agent references
- Modify: `skills/subagent-driven-development/task-reviewer-prompt.md` — update as reference doc

**Interfaces:**
- Consumes: `agents/review.md` (Task 2) — references the new agent
- Produces: updated SDD workflow documentation

- [ ] **Step 1: Update `SKILL.md` dot diagram labels**

Edit `skills/subagent-driven-development/SKILL.md`. Replace these diagram labels:
- `"Dispatch implementer subagent (./implementer-prompt.md)"` → keep as-is (implementer unchanged)
- `"Write diff file, dispatch task reviewer subagent (./task-reviewer-prompt.md)"` → `"Write diff file, dispatch review subagent (@review.md per-task)"`
- `"Task reviewer reports spec ✅ and quality approved?"` → `"Review agent reports approved?"`
- `"Dispatch final code reviewer subagent (../requesting-code-review/code-reviewer.md)"` → `"Dispatch review subagent (@review.md whole-branch)"`
- `"Integration Critique Gate"` (if present in diagram) → remove node + edge (no separate integration gate)
- `"Dispatch fix subagent(s)"` → keep as-is; `"Use superpowers:finishing-a-development-branch"` → keep as-is

Also update the text label at line 52: `label="Per Task"` stays.

Verify the resulting diagram has no stale reference to `task-reviewer-prompt.md`, `code-reviewer.md`, or separate integration gate.

- [ ] **Step 2: Update text references in `SKILL.md`**

Search for all text references to `task-reviewer`, `code-reviewer`, and `task-reviewer-prompt` (with or without `@` prefix or `.md` suffix) in the skill body (outside the dot diagram). Replace:

| Old reference | New reference |
|---|---|
| `@task-reviewer.md` — Per-task spec compliance + code quality reviewer | `@review.md` — Per-task implementation reviewer |
| `task-reviewer` (any form) | `@review.md` per-task mode |
| `@code-reviewer.md` — Final whole-branch reviewer | *(remove — merged into `@review.md` whole-branch mode)* |
| `code-reviewer` (any form — in text, not in file paths to `requesting-code-review`) | `@review.md` whole-branch mode |
| `task-reviewer-prompt.md` link / reference | `review.md` reference doc |
| `superpowers:requesting-code-review` in Integration section | `@review.md` whole-branch mode |
| "Integration Critique Gate" section header + content | Remove the separate section (merged into final `@review.md` whole-branch dispatch) |

The `@implement.md` entry stays unchanged.

Specific sections that need updates:

**a) Prompt Templates section (~lines 268-270):**
```
- [implementer-prompt.md](implementer-prompt.md) - Dispatch implementer subagent
- [review.md](../agents/review.md) - Dispatch review subagent (per-task or whole-branch mode)
```

**b) Example Workflow (~line 329):** Replace final code-reviewer reference:
```
[After all tasks]
[Dispatch @review.md whole-branch]
Final reviewer: All requirements met, ready to merge
```

**c) Integration section (~line 411):** Replace `requesting-code-review` entry:
```
- **@review.md whole-branch** - Final integration review after all tasks complete
```

- [ ] **Step 3: Update `task-reviewer-prompt.md` as reference doc**

Edit `skills/subagent-driven-development/task-reviewer-prompt.md`:

Replace the dispatch template block's top section. Change:
```
## What Was Requested

Read the task brief: [BRIEF_FILE]

Global constraints from the spec/design...
```
to include a header noting this is a reference doc and the active agent is `@review.md`:
```
> **NOTE:** This is a reference document. The active reviewer is now
> `@review.md` (dispatched in per-task mode). This template documents the
> dispatch contract for reference — the actual agent prompt lives in
> `agents/review.md`.

## What Was Requested
[content unchanged below this]
```

Also update the template header: change `# Task Reviewer Prompt Template` to `# Task Reviewer Reference (Per-Task Mode — superseded by agents/review.md)`.

- [ ] **Step 4: Verify files**

```bash
grep -n "task-reviewer-prompt\|code-reviewer\|task-reviewer" skills/subagent-driven-development/SKILL.md | head -20
```
Expected: only remaining references are in the updated flow diagram (which now shows `@review.md`)

```bash
head -10 skills/subagent-driven-development/task-reviewer-prompt.md
```
Expected: header note saying this is a reference doc, superseded by `agents/review.md`

- [ ] **Step 5: Commit**

```bash
git add skills/subagent-driven-development/SKILL.md skills/subagent-driven-development/task-reviewer-prompt.md
git commit -m "refactor: update SDD skill to reference review.md instead of task-reviewer/code-reviewer"
```

---

### Task 5: Update `agents/develop.md`

**Files:**
- Modify: `agents/develop.md`

**Interfaces:**
- Consumes: `agents/review.md` (Task 2) — dispatches it in two modes
- Consumes: `agents/critique.md` (rewritten in Task 6) — drops integration role reference

- [ ] **Step 1: Fix Phase 3 per-task review dispatch (lines ~178-184)**

Edit `agents/develop.md`. Replace:
```
    b. **Spec compliance review** — dispatch spec-reviewer subagent
       - Does code match spec exactly? No extra features, no missing requirements?
       - If gaps found → send back to implementer, re-review
    c. **Code quality review** — dispatch code quality reviewer
       - Clean architecture, test coverage, no magic numbers, no duplication
       - If issues found → send back to implementer, re-review
```
with:
```
    b. **Task review** — dispatch `@review.md` in per-task mode
       - Combines spec compliance + code quality in one pass
       - Does code match spec, is it clean, tested, well-structured?
       - If Critical or Important issues found → send back to implementer, re-review
```

- [ ] **Step 2: Remove `requesting-code-review` invocation (line ~185)**

Replace:
```
3. After ALL tasks complete: dispatch `requesting-code-review` for the full implementation batch
```
with nothing (this line is removed — the whole-branch review happens in Phase 3b).

- [ ] **Step 3: Update Phase 3b (lines ~195-206)**

Replace the Integration Critique Gate section that dispatches `@critique.md` with the new single-final-gate dispatch to `@review.md` whole-branch mode:

```
### Phase 3b: Final Review Gate

After all implementation tasks complete (and before dogfood if applicable),
dispatch `@review.md` in **whole-branch mode** for a single-pass integration
review. This replaces the previous two-pass system (code-reviewer + critique
integration).

The `@review.md` agent checks:
- Plan alignment — does the full branch match the spec?
- Code quality — clean, tested, well-structured across all tasks?
- Architecture — sound design, security, integration with surrounding code?
- Integration — cross-task consistency, emergent behavior, design debt,
  broken contracts, regression risk?
- Production readiness — migrations, backward compat, docs?

**Handling Review results:**
- **Critical or Important issues** → ALWAYS dispatch an implementer subagent to
  fix each issue (never fix inline). After all fixes applied, re-dispatch
  `@review.md` for re-review. Repeat until no Critical/Important issues remain.
- **Minor/Low/Info** → note, proceed to next gate or Phase 4.
```

- [ ] **Step 4: Update Cross-Cutting Rules section (lines ~267-270)**

Edit `agents/develop.md`. Find the `requesting-code-review` bullet in the Cross-Cutting Rules:
```
Apply `requesting-code-review` at:
```
Replace with:
```
Apply `@review.md` in whole-branch mode at:
- After ALL tasks complete in a subagent-driven development batch
- After completing a major feature milestone
- Before merge to main
```

- [ ] **Step 5: Verify lines reference correct agents**

```bash
grep -n "spec-reviewer\|code quality reviewer\|code-reviewer\|task-reviewer\|requesting-code-review" agents/develop.md
```
Expected: no remaining references to old agents or the old double-final-gate process

- [ ] **Step 6: Commit**

```bash
git add agents/develop.md
git commit -m "refactor: update develop.md for review.md dual-mode, remove double final gate"
```

---

### Task 6: Rewrite `agents/critique.md`

**Files:**
- Rewrite: `agents/critique.md`

**Interfaces:**
- Consumes: own previous version (rewrite in place)
- Produces: updated critique agent with corrected temp, permissions, scope

- [ ] **Step 1: Update YAML frontmatter**

Change temperature from `0.1` to `0.5`.

Change permission block:
```yaml
permission:
  read: allow
  grep: allow
  edit: deny
  bash: allow
  task:
    "*": deny
    "research": allow
  todowrite: allow
  question: deny
  webfetch: allow
  websearch: allow
  skill: allow
```

- [ ] **Step 2: Update description**

Replace the description's third case ("integration-level review — after all implementation tasks are complete") with a simpler scope statement. The description should only mention spec review and plan review.

Old description section (remove):
```
3. **Integration-level review** — After all implementation tasks are complete,
   before finishing/merging. You review the full integrated result for
   cross-task inconsistencies, emergent issues, accumulated design debt, and
   anything that only becomes visible when viewing the whole.
```

- [ ] **Step 3: Update "When You Are Called" section**

Remove the third bullet (integration-level review) entirely. Re-number remaining bullets.

Keep the note at the bottom of the section:
```
You do NOT review individual tasks during implementation.
```
This note still applies — critique does not review per-task code even in the new architecture.

- [ ] **Step 4: Update "What You Critique" section**

Remove the "For Integrated Implementations" subsection entirely. The critique no longer reviews code. Keep only "For Plans/Designs" content (which covers spec + plan review).

- [ ] **Step 5: Verify the file**

```bash
head -60 agents/critique.md
```
Expected: temp 0.5, scope spec+plan only, research-only task permission, no integration/implementation sections

- [ ] **Step 6: Commit**

```bash
git add agents/critique.md
git commit -m "fix: rewrite critique.md — temp 0.1→0.5, drop integration role, restrict task to research"
```

---

### Task 7: Validate dual-mode review agent

**Files:**
- No file changes — this is a validation gate

**Interfaces:**
- Consumes: `agents/review.md` (Task 2), old `agents/task-reviewer.md`, old `agents/code-reviewer.md`
- Produces: validation decision (proceed to removal or rollback)

- [ ] **Step 1: Run `@review.md` in per-task mode on a recent task**

Pick a task from a recent feature implementation. Construct the dispatch with:
- `review_mode: per-task`
- Task brief, implementer report, diff file (narrow range)

Compare output against the existing `task-reviewer.md` output from the real task review (available in git history at `docs/reviews/` if it was saved, or from the original review report).

**Pass criteria:**
- Same verdict (Approved/Needs fixes)
- If both found issues, new review's issue list must be a **superset** of the old review's (no missed issues)
- New issues raised by `@review.md` that the old reviewer missed are a positive signal unless clearly irrelevant
- Spec compliance + code quality both assessed

- [ ] **Step 2: Run `@review.md` in whole-branch mode on a recent branch**

Pick a recent feature branch with multiple tasks. Construct the dispatch with:
- `review_mode: whole-branch`
- Plan/spec, full diff range, accumulated minor issues

Compare against the last `code-reviewer.md` output on a similar-sized branch (from git history or `docs/reviews/`).

**Pass criteria:**
- All review dimensions covered: plan alignment, code quality, architecture, integration (emergent behavior + design debt + integration gaps), testing, production readiness
- No missed issues compared to prior code-reviewer
- Clear merge verdict (Yes/No/With fixes)
- Coverage of accumulated minor-issues list confirmed

- [ ] **Step 3: Decide**

If both modes pass: proceed to Task 8.
If either mode fails: execute rollback plan (revert to `task-reviewer.md` + `code-reviewer.md` + updated `critique.md`, document which mode needs its own agent, and abort removal).

- [ ] **Step 4: If passing, commit any incidental fixes discovered during validation**

```bash
git add -A && git commit -m "fix: validation-driven improvements to review.md"
```

---

### Task 8: Remove old agents

**Files:**
- Remove: `agents/task-reviewer.md`
- Remove: `agents/code-reviewer.md`

**Interfaces:**
- Consumes: passes from Task 7 — only execute if validation passed
- Produces: clean agent directory with only `critique.md` + `review.md` + `develop.md`

- [ ] **Step 1: Remove old agent files**

```bash
rm agents/task-reviewer.md agents/code-reviewer.md
```

- [ ] **Step 2: Verify removal**

```bash
ls agents/*.md
```
Expected: agents present are `critique.md`, `develop.md`, `dogfood.md`, `implement.md`, `research.md`, `review.md`, `plan.md`, `build.md` (and any others). NOT `task-reviewer.md` or `code-reviewer.md`.

- [ ] **Step 3: Final sweep for stale references**

```bash
grep -rn "task-reviewer\|code-reviewer" agents/ skills/ --include="*.md" | grep -v "task-reviewer-prompt.md" | grep -v "skills/requesting-code-review/code-reviewer.md" | grep -v "git log\|git diff\|git show"
```
Expected: no remaining references to removed agents (except in reference docs like `task-reviewer-prompt.md` which are explicitly retained as historical references)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated task-reviewer.md and code-reviewer.md agents"
```
