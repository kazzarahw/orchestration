# Docs Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate `docs/` directory structure: merge specs into plans with `design-` prefix, consolidate critique/review/dogfood reports under `docs/review/` with prefix-based filenames, and fix the report-visibility problem by having subagents write report files.

**Architecture:** Directory restructuring (symlink `docs/ → src/docs/` stays). Remove `critiques/`, `reviews/`, `specs/` dirs, create `review/`. Update all agent definitions and skills that reference the old paths. Add `write: allow` permission to critique/review/dogfood agents so they persist report files to `docs/review/`.

**Tech Stack:** Markdown, OpenCode agent definitions (YAML frontmatter), shell (mkdir/rmdir/git).

---

## Global Constraints

- `docs/` is a symlink to `src/docs/` — only modify `src/docs/`
- Never delete `.gitkeep` from `research/` or `rules/` — those directories stay
- All agent definitions use YAML frontmatter with exact key structure
- All path references use forward slashes

---

### Task 1: Restructure `src/docs/` directories

**Files:**
- Create: `src/docs/review/.gitkeep`
- Remove: `src/docs/critiques/` directory
- Remove: `src/docs/reviews/` directory
- Remove: `src/docs/specs/` directory
- Keep: `src/docs/plans/`, `src/docs/research/`, `src/docs/rules/` — untouched

**Interfaces:**
- Consumes: current directory structure (`src/docs/` has 6 subdirs)
- Produces: new structure with 4 subdirs — `review/`, `plans/`, `research/`, `rules/`

- [ ] **Step 1: Create new `review/` directory with .gitkeep**

```bash
mkdir -p src/docs/review
touch src/docs/review/.gitkeep
git add src/docs/review/
```

- [ ] **Step 2: Remove old directories**

```bash
rm -rf src/docs/critiques src/docs/reviews src/docs/specs
git rm -r src/docs/critiques src/docs/reviews src/docs/specs
```

- [ ] **Step 3: Verify new structure**

```bash
ls -la src/docs/
# Expected: review/, plans/, research/, rules/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(docs): restructure src/docs/ — consolidate into review/, plans/, research/, rules/"
```

---

### Task 2: Update critique.md — add write permission + report file output

**Files:**
- Modify: `src/agents/critique.md`

**Interfaces:**
- Consumes: current critique.md (edit: deny, no write key)
- Produces: critique.md with `write: allow`, instructions to write report to `docs/review/critique-YYYY-MM-DD-<topic>.md`

- [ ] **Step 1: Add `write: allow` to critique permissions**

In the YAML frontmatter, add `write: allow` to the permission block.

- [ ] **Step 2: Add report-file output section after the output format**

After the "Output Format" section and before "Behavioral Guidelines", add instructions:
```
## Report File

After writing your critique to your final message, ALSO write it to a report file at:
`docs/review/critique-YYYY-MM-DD-<topic>.md`

This ensures the parent agent can read your full findings even if the platform
drops your final message content. Use the `write` tool to create this file.

**Always write the file before returning your final message.**
```

- [ ] **Step 3: Update Stopping Conditions**

Change "Critique report written with all findings documented and returned to the requesting agent" to "Critique report written to `docs/review/critique-*.md` and returned to the requesting agent".

- [ ] **Step 4: Commit**

```bash
git add src/agents/critique.md
git commit -m "feat(critique): add write permission + report file output to docs/review/"
```

---

### Task 3: Update review.md — add write permission + report file output

**Files:**
- Modify: `src/agents/review.md`

**Interfaces:**
- Consumes: current review.md (write: deny)
- Produces: review.md with `write: allow`, instructions to write report to `docs/review/review-*.md`

- [ ] **Step 1: Change `write: deny` to `write: allow` in review permissions**

- [ ] **Step 2: Add report file output instruction**

After the "Output Format" sections (both modes), near before "Calibration", add:

```
## Report File

After writing your review to your final message, ALSO write it to a report file at:
`docs/review/review-YYYY-MM-DD-<topic>-<mode>.md`

Use the `write` tool. Always write the file before returning your final message.
```

- [ ] **Step 3: Update Stopping Conditions**

Update to reference that the report is persisted to `docs/review/`.

- [ ] **Step 4: Commit**

```bash
git add src/agents/review.md
git commit -m "feat(review): add write permission + report file output to docs/review/"
```

---

### Task 4: Update dogfood.md — add write permission + report file output

**Files:**
- Modify: `src/agents/dogfood.md`

**Interfaces:**
- Consumes: current dogfood.md (write: deny)
- Produces: dogfood.md with `write: allow`, instructions to write report to `docs/review/dogfood-*.md`

- [ ] **Step 1: Change `write: deny` to `write: allow` in dogfood permissions**

- [ ] **Step 2: Add report file output instruction**

After the "Bug Report Format" section, add:

```
## Report File

After writing your report to your final message, ALSO write it to a report file at:
`docs/review/dogfood-YYYY-MM-DD-<program-name>.md`

Use the `write` tool. Always write the file before returning your final message.
```

- [ ] **Step 3: Update Stopping Conditions**

Update to reference the report file in `docs/review/`.

- [ ] **Step 4: Commit**

```bash
git add src/agents/dogfood.md
git commit -m "feat(dogfood): add write permission + report file output to docs/review/"
```

---

### Task 5: Update develop.md — all docs path references

**Files:**
- Modify: `src/agents/develop.md`

**Interfaces:**
- Consumes: current develop.md with old paths (docs/specs/, docs/plans/)
- Produces: develop.md with updated path references

Specific edits:

- [ ] **Step 1: Line 59 — Update inline implementation boundary**

Change:
```
Only spec (`docs/specs/`), plan (`docs/plans/`), and project documentation
```
To:
```
Only design docs (`docs/plans/design-*`), plans (`docs/plans/plan-*`), review reports (`docs/review/`), and project documentation
```

- [ ] **Step 2: Line 77 — Update spec existence check**

Change:
```
3. Does a spec already exist at `docs/specs/`? → Skip to Phase 1c
```
To:
```
3. Does a design doc already exist at `docs/plans/design-`? → Skip to Phase 1c
```

- [ ] **Step 3: Line 78 — Update plan existence check**

Change:
```
4. Does a plan already exist at `docs/plans/`? → Skip to Phase 2
```
To:
```
4. Does a plan already exist at `docs/plans/plan-`? → Skip to Phase 2
```

- [ ] **Step 4: Line 79 — Update fix plan save path**

Change:
```
save a minimal fix plan to `docs/plans/`
```
To:
```
save a minimal fix plan to `docs/plans/plan-`
```

- [ ] **Step 5: Line 111 — Update design doc write path**

Change:
```
6. Write design doc to `docs/specs/YYYY-MM-DD-<topic>-design.md`
```
To:
```
6. Write design doc to `docs/plans/design-YYYY-MM-DD-<topic>.md`
```

- [ ] **Step 6: Line 142 — Update plan save path**

Change:
```
6. Save to `docs/plans/YYYY-MM-DD-<feature-name>.md`
```
To:
```
6. Save to `docs/plans/plan-YYYY-MM-DD-<feature-name>.md`
```

- [ ] **Step 7: Update Phase 3b comment and review dispatch**

In Phase 3b, after dispatching review, add instruction to read from `docs/review/` file instead of relying solely on subagent message.

- [ ] **Step 8: Update Phase 3c dogfood handling**

After dispatching dogfood, add instruction to read from `docs/review/dogfood-*.md`.

- [ ] **Step 9: Commit**

```bash
git add src/agents/develop.md
git commit -m "refactor(develop): update all docs path references to new structure"
```

---

### Task 6: Update brainstorming SKILL.md + spec-document-reviewer-prompt.md

**Files:**
- Modify: `src/skills/brainstorming/SKILL.md`
- Modify: `src/skills/brainstorming/spec-document-reviewer-prompt.md`

- [ ] **Step 1: SKILL.md line 29 — change `docs/specs/` to `docs/plans/design-`**

Old:
```
6. **Write design doc** — save to `docs/specs/YYYY-MM-DD-<topic>-design.md` and commit
```
New:
```
6. **Write design doc** — save to `docs/plans/design-YYYY-MM-DD-<topic>.md` and commit
```

- [ ] **Step 2: SKILL.md line 106 — same change**

Old:
```
- Write the validated design (spec) to `docs/specs/YYYY-MM-DD-<topic>-design.md`
```
New:
```
- Write the validated design (spec) to `docs/plans/design-YYYY-MM-DD-<topic>.md`
```

- [ ] **Step 3: spec-document-reviewer-prompt.md line 7**

Old:
```
**Dispatch after:** Spec document is written to docs/specs/
```
New:
```
**Dispatch after:** Spec document is written to docs/plans/design-
```

- [ ] **Step 4: Commit**

```bash
git add src/skills/brainstorming/SKILL.md src/skills/brainstorming/spec-document-reviewer-prompt.md
git commit -m "refactor(brainstorming): update spec output path to docs/plans/design-"
```

---

### Task 7: Update writing-plans SKILL.md to use plan- prefix

**Files:**
- Modify: `src/skills/writing-plans/SKILL.md`

- [ ] **Step 1: Line 18 — Update plan save path**

Old:
```
**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`
```
New:
```
**Save plans to:** `docs/plans/plan-YYYY-MM-DD-<feature-name>.md`
```

- [ ] **Step 2: Line 160 — Update execution handoff example**

Old:
```
**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**
```
New:
```
**"Plan complete and saved to `docs/plans/plan-<filename>.md`. Two execution options:**
```

- [ ] **Step 3: Commit**

```bash
git add src/skills/writing-plans/SKILL.md
git commit -m "refactor(writing-plans): update plan save path to use plan- prefix"
```

---

### Task 8: Update AGENTS.md (root + src) and README.md

**Files:**
- Modify: `src/AGENTS.md`
- Modify: `AGENTS.md` (root)
- Modify: `README.md`

- [ ] **Step 1: src/AGENTS.md line 16 — inline fix allowance**

Old:
```
Direct edits are only allowed for specs (`docs/specs/`), plans (`docs/plans/`), documentation, and configuration files.
```
New:
```
Direct edits are only allowed for design docs (`docs/plans/design-*`), plans (`docs/plans/plan-*`), review reports (`docs/review/`), documentation, and configuration files.
```

- [ ] **Step 2: src/AGENTS.md lines 62-66 — docs convention table**

Update to:
```
| Path | Content |
|------|---------|
| `src/docs/plans/design-YYYY-MM-DD-<topic>.md` | Design documents (from brainstorming skill) |
| `src/docs/plans/plan-YYYY-MM-DD-<feature>.md` | Implementation plans (from writing-plans skill) |
| `src/docs/rules/*.md` | Mandatory project constraints (from writing-rules skill) |
| `src/docs/review/critique-*.md` | Critique reports (adversarial spec/plan review) |
| `src/docs/review/review-*.md` | Code review reports (per-task and whole-branch) |
| `src/docs/review/dogfood-*.md` | Dogfood QA reports (interactive testing) |
| `src/docs/research/` | Research outputs |
```

- [ ] **Step 3: README.md lines 46-48 — docs conventions**

Old:
```
- `src/docs/specs/YYYY-MM-DD-<topic>-design.md` — design documents
- `src/docs/plans/YYYY-MM-DD-<feature>.md` — implementation plans
- `src/docs/rules/*.md` — mandatory project constraints (override all default behavior)
```
New:
```
- `src/docs/plans/design-YYYY-MM-DD-<topic>.md` — design documents
- `src/docs/plans/plan-YYYY-MM-DD-<feature>.md` — implementation plans
- `src/docs/review/critique-*.md` — critique reports
- `src/docs/review/review-*.md` — code review reports
- `src/docs/review/dogfood-*.md` — QA reports
- `src/docs/rules/*.md` — mandatory project constraints (override all default behavior)
```

- [ ] **Step 4: Commit**

```bash
git add src/AGENTS.md AGENTS.md README.md
git commit -m "docs: update docs convention references across AGENTS.md and README.md"
```

---

### Task 9: Update subagent-driven-development SKILL.md example path

**Files:**
- Modify: `src/skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Line 276 — Update example plan path**

Old:
```
[Read plan file once: docs/plans/feature-plan.md]
```
New:
```
[Read plan file once: docs/plans/plan-feature-plan.md]
```

- [ ] **Step 2: Commit**

```bash
git add src/skills/subagent-driven-development/SKILL.md
git commit -m "refactor(sdd): update example plan path to plan- prefix"
```

---

### Task 10: Remove old directories' git tracking (already done in Task 1)

Verification only — Task 1 already removed `critiques/`, `reviews/`, `specs/` dirs and their `.gitkeep` files.

- [ ] **Step 1: Verify no stale references to old paths remain**

```bash
grep -rn 'docs/specs/' src/ --include='*.md' || echo "No stale docs/specs/ references"
grep -rn 'docs/critiques/' src/ --include='*.md' || echo "No stale docs/critiques/ references"
grep -rn 'docs/reviews/' src/ --include='*.md' || echo "No stale docs/reviews/ references"
```

- [ ] **Step 2: Commit if any stragglers found**

```bash
git add -A
git commit -m "chore: remove stale docs directory references"
```
