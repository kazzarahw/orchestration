# Dev Branch: Framework Refactor

Full rewrite on the `dev` branch. Replaces the current Superpowers architecture with a modular agent/skill/plugin system. All existing artifacts (`src/agents/*`, `src/skills/*`, `src/plugins/*`, `src/docs/*`) are replaced in this branch — no backward compat needed.

---

## Phase 0: Workspace + Baseline

- [ ] Create `dev` branch from current `main`
- [ ] Set up worktree for isolated development
- [ ] Verify clean baseline: existing `install.sh` runs, no errors
- [ ] Read all rules from `docs/rules/` (if any) — currently empty, no constraint
- [ ] **Checkpoint commit:** `git add -A && git commit -m "phase-0: checkpoint before refactor"`

---

## Phase 1: Plugin Infrastructure

**Checkpoint commit before starting:** `git add -A && git commit -m "phase-1: pre-plugin checkpoint"`

### Step 1.1 — Create `skill-autoinjection` plugin

**File:** `src/plugins/skill-autoinjection.js`

**Verification:** File loads without syntax errors. Plugin registers via `opencode.jsonc`.

Replaces `superpowers.js`. Responsibilities:

1. **Config-driven skill injection** — reads `skill-autoinjection` key from `opencode.jsonc`. Array of skill names to auto-inject (e.g. `["optimize-tokens", "use-todo"]`).
2. **Per-agent frontmatter override** — reads agent `.md` YAML frontmatter for a `skills` key. If present, overrides the global list for that agent.
3. **Injection mechanism** — uses `experimental.chat.system.transform` hook to inject skill content into agent system prompts. Deduplicates by tracking which skills were injected per-agent (no double injection).
4. **Skills path registration** — registers `src/skills/` as a skills path via `config` hook (same as current superpowers.js).
5. **Guard** — skips injection if agent already has the skill loaded. Handles missing skill files gracefully (log warning, continue).
6. **Timing note:** Uses `experimental.chat.system.transform` (fires at session start/agent switch) instead of the old `superpowers.js` approach of `experimental.chat.messages.transform` (fires every agent step). Skills injected via system prompt are available from turn 1 without requiring a user message to be present. This is a deliberate improvement — verify nothing downstream depends on the old per-turn injection timing.
7. **Replaces** `superpowers.js` entirely — actual deletion deferred to Phase 5.2 (dedicated cleanup phase). Do not delete here.

### Step 1.2 — Create `src/opencode.jsonc` template

**File:** `src/opencode.jsonc`

The opencode.jsonc lives at `~/.config/opencode/opencode.jsonc` (user config, not repo-managed for existing installs). For this refactor, create a **source template** at `src/opencode.jsonc` that `install.sh` will copy alongside other artifacts. This is new — previously opencode.jsonc was excluded from install.

Content:

```jsonc
{
  "plugins": [
    "src/plugins/skill-autoinjection.js"
    // If goal.ts is in use, add it here after skill-autoinjection:
    // "src/plugins/goal.ts"
  ],
  "skill-autoinjection": [
    "optimize-tokens",
    "use-todo"
  ]
}
```

**Plugin loading order (if `goal.ts` is active):** `skill-autoinjection.js` must be listed *before* `goal.ts` in the plugins array. This ensures system prompt transforms run in the correct order (skill injection first, goal context appended after).

Also register any per-agent overrides in agent frontmatter as needed during Phase 3.

**Note:** `use-git` is NOT autoinjected — it is loaded on-demand by Orchestrate and Build agents via the `skill` tool. If other agents need git instructions, they must load it explicitly.

**Note:** After installing to `~/.config/opencode/`, the user must merge their existing config with this template. The plan does not modify the user's live config during build.

### Step 1.3 — Verify

- Plugin loads on session start
- Configured skills are injected into primary agent's system prompt
- Per-agent frontmatter overrides work (test with a mock agent)
- Missing skill names produce a warning, not a crash
- `goal.ts` plugin compatibility confirmed — both use `experimental.chat.system.transform` hook; verify they coexist without stomping on each other's output
- **Timing verification:** Start a session with the new plugin. Send a task requiring an autoinjected skill (e.g., `use-todo` for a multi-step task). Confirm the agent exhibits the skill behavior from turn 1, without requiring a user message to trigger injection. This validates the `system.transform` → turn-1 availability hypothesis. Note: this is a dev branch clean break — no guaranteed backward compatibility with old per-turn injection timing.
- `superpowers.js` is deleted (Phase 5.2)

---

## Phase 2: Skills

**Checkpoint commit before starting:** `git add -A && git commit -m "phase-2: pre-skills checkpoint"`

All skills go in `src/skills/<name>/SKILL.md` following the existing YAML frontmatter convention (`name`, `description`). Word targets: <200 for autoinjected skills, <500 for others.

### Shared Skills (≥2 consumers, stay as skills)

#### Step 2.1 — `optimize-tokens`

**From:** `maximizing-information-density` (rename + refinement)
**Autoinjected:** yes (via `skill-autoinjection` plugin)
**Consumers:** All agents

Content mirror of existing `maximizing-information-density` with:
- Renamed frontmatter `name: optimize-tokens`
- Add `metadata.alias: maximizing-information-density` as a top-level YAML key in frontmatter (OpenCode ignores unknown YAML fields, so this is safe):

  ```yaml
  name: optimize-tokens
  description: Enforces semantic densification...
  metadata:
    alias: maximizing-information-density
  ```
- Audience gating preserved (lossless for agents, lossy for humans)
- Existing 12 lossless + 5 lossy techniques, literal preservation rules

#### Step 2.2 — `use-todo`

**Autoinjected:** yes
**Consumers:** All agents (hard requirement for multi-step tasks)

Content:
- Mandate: Use `todowrite` for any task with ≥3 distinct steps
- One item `in_progress` at a time
- Mark complete only after verification
- If blocked, mark `in_progress` with follow-up describing the blocker
- How to structure items (specific, actionable, break large work)

Enforcement is via Orchestrate agent definition (Phase 3) and plugin-level hooks, not skill body alone.

#### Step 2.3 — `use-git`

**From:** `using-git-worktrees` (merge + expand)
**Consumers:** Orchestrate, Build

Content covers:
- **Worktree creation:** detect → native tool → git worktree fallback
- **Branch isolation:** never implement on main/master without consent
- **Baseline anchoring:** record HEAD at worktree creation
- **Commit conventions:** Conventional Commits format, ≤200 lines per commit, commit-per-TDD-cycle
- **Cherry-pick:** selective commit promotion, conflict resolution
- **Cleanup:** provenance-based (only remove worktrees you created)

Replaces `using-git-worktrees` SKILL.md entirely.

#### Step 2.4 — `use-tmux`

**Consumers:** Dogfood (extracted from inline content)

Content extracted from `dogfood.md`'s inline tmux reference (lines 386-425 in current):
- Session lifecycle (create detached, kill, list)
- Sending input with send-keys
- Capturing output with capture-pane
- State inspection with display-message
- Resize commands

*(Dogfood agent update to reference this skill happens in Step 3.8 — not here.)*

#### Step 2.5 — `create-skill`

**From:** `writing-skills` (rename + restructure)
**Consumers:** Design, Plan, Orchestrate

Content:
- Structured skill creation process
- Frontmatter requirements (name ≤64 chars, description ≤1024 chars, no XML tags)
- SDO description convention (triggering conditions only, not workflow summary)
- Word-count targets (<200 autoinjected, <500 standard)
- Checklist vs narrative guidance
- Example with real skill creation walkthrough

#### Step 2.6 — `create-rule`

**From:** `writing-rules` (rename + restructure)
**Consumers:** Design, Plan, Orchestrate

Content:
- Structured rule creation process
- When to create a rule (recurring patterns, conventions, standards)
- Rule format and naming
- Phase U update mechanism for existing rules
- Dependency on `create-skill` for skill creation patterns

#### Step 2.7 — `create-agent`

**From:** `writing-agents` (rename + restructure)
**Consumers:** Orchestrate (when new subagents are needed)

Content:
- Agent definition structure (role statement + constraints + tools/permissions + error handling + stopping conditions)
- YAML frontmatter fields (name, description, mode, temperature, color, permissions)
- Primary vs subagent mode differences
- Tool permission model (minimum tools, deny edit/bash to read-only agents)
- Error handling patterns (recoverable + unrecoverable)
- Templates for common agent types

#### Step 2.8 — `create-plugin`

**From:** `writing-plugins` (rename + restructure)
**Consumers:** Orchestrate (when new plugins are needed)

Content:
- OpenCode plugin API reference
- Available hooks (config, experimental.chat.messages.transform, experimental.chat.system.transform, command.execute.before, chat.message, event, tool, dispose)
- Plugin structure and export format
- Tool registration patterns
- State management (atomic writes)
- Error handling in plugins

#### Step 2.9 — `test-driven-development`

**Kept as skill** (≥2 consumers: Build, Plan, Orchestrate)
**From:** existing `test-driven-development`
**Changes:** None — content is stable. Only update cross-references if skill is renamed later.

#### Step 2.10 — `verification-before-completion`

**Kept as skill** (≥2 consumers: Build, Orchestrate)
**From:** existing `verification-before-completion`
**Changes:** None — content is stable.

#### Step 2.11 — `systematic-debugging`

**Kept as skill** (≥2 consumers: Build, Orchestrate)
**From:** existing `systematic-debugging`
**Changes:** None — content is stable.

#### Step 2.12 — `consider-feedback`

**From:** `receiving-code-review` (rename + expand scope)
**Consumers:** Build, Design, Plan

Content:
- Receiving feedback from Critique (spec/plan review) and Review (code review)
- Verify before implementing — check against codebase reality
- Push back with technical reasoning if feedback is wrong
- No performative agreement ("great point!", "you're right!")
- Implement one item at a time, test each
- Applies to: Critique Gate output, Review Gate output, any subagent findings

### Dropped Skills

#### Step 2.13 — Drop `executing-plans`

Superseded by SDD. **Delete** `src/skills/executing-plans/` entirely.

#### Step 2.14 — Drop `using-superpowers`

Replaced by `skill-autoinjection` plugin + `optimize-tokens` skill. **Delete** `src/skills/using-superpowers/` entirely.

**Note:** The embedded skills (`brainstorming`, `writing-plans`, `finishing-a-development-branch`, `dispatching-parallel-agents`, `requesting-code-review`, `subagent-driven-development/SKILL.md`) are NOT deleted here. Their content is read and inlined during Phase 3 (Agents) — they survive Phase 2 so the agent creation steps can reference them. Deletion happens as part of agent creation in Phase 3.

### Skill Cleanup

#### Step 2.15 — Update surviving skills

- [ ] `src/skills/test-driven-development/` — update cross-references only
- [ ] `src/skills/verification-before-completion/` — update cross-references only
- [ ] `src/skills/systematic-debugging/` — update cross-references only

#### Step 2.16 — Delete old renamed skills

After all new shared skills are created:

| Delete | Replaced By | Supporting Files Disposition |
|--------|-------------|------------------------------|
| `src/skills/maximizing-information-density/` | `optimize-tokens` | All files become `optimize-tokens/` — single rename |
| `src/skills/using-git-worktrees/` | `use-git` | All files become `use-git/` — single rename |
| `src/skills/writing-skills/` | `create-skill` | Scan for useful patterns in `render-graphs.js`, `examples/`, reference docs — migrate to new skill or `.docs/archive/` |
| `src/skills/writing-rules/` | `create-rule` | Single SKILL.md source — no orphaned supporting files expected |
| `src/skills/writing-agents/` | `create-agent` | Single SKILL.md source — no orphaned supporting files expected |
| `src/skills/writing-plugins/` | `create-plugin` | Single SKILL.md source — no orphaned supporting files expected |
| `src/skills/receiving-code-review/` | `consider-feedback` | Single SKILL.md source — no orphaned supporting files expected |

Run this scan before deletion to verify no orphaned supporting files:
```bash
for dir in maximizing-information-density using-git-worktrees writing-skills writing-rules writing-agents writing-plugins receiving-code-review; do
  count=$(find "src/skills/$dir" -mindepth 1 -maxdepth 1 | wc -l)
  if [ "$count" -gt 1 ]; then echo "$dir: has $count items — check supporting files"; fi
done
```

### New Skills Created in This Phase

- [ ] `src/skills/optimize-tokens/` (from maximizing-information-density)
- [ ] `src/skills/use-todo/`
- [ ] `src/skills/use-git/` (from using-git-worktrees + expansion)
- [ ] `src/skills/use-tmux/` (extracted from dogfood.md)
- [ ] `src/skills/create-skill/` (from writing-skills)
- [ ] `src/skills/create-rule/` (from writing-rules)
- [ ] `src/skills/create-agent/` (from writing-agents)
- [ ] `src/skills/create-plugin/` (from writing-plugins)
- [ ] `src/skills/consider-feedback/` (from receiving-code-review)

---

## Phase 3: Agents

**Checkpoint commit before starting:** `git add -A && git commit -m "phase-3: pre-agents checkpoint"`

All agents go in `src/agents/<name>.md` with YAML frontmatter.

### Step 3.1 — Orchestrate Agent

**File:** `src/agents/orchestrate.md`
**Mode:** primary
**Temperature:** 0.2 — low for deterministic routing/decision-making; orchestrator must make consistent subagent dispatch calls
**Replaces:** `develop.md`

Based on `develop.md`'s lifecycle with inline work replaced by subagent delegation:

**Permissions:**
- `task`: allow → design, plan, build, research, review, critique, dogfood
- `read`, `grep`, `edit`, `write`, `bash`: allow
- `todowrite`, `question`, `webfetch`, `websearch`, `skill`: allow

**Lifecycle (runtime phases — use "R" prefix to distinguish from build-plan phases):**

| Phase | Action | Delegates to | Gate |
|-------|--------|-------------|------|
| R0 | Load Rules & Intake | — | — |
| R0.5 | Triage + Isolation (worktree consent) | — | User approval |
| R1a | Research + Design | Research → Design | — |
| R1b | Design Critique Gate | Critique | All CRIT/HIGH fixed, 3-iteration cap, user approves spec |
| R1c | Create Plan | Plan | — |
| R1d | Plan Critique + Review Gates | Critique, Review | Both must pass |
| R2 | Setup Worktree + Baseline | load `use-git` skill first, then inline | Tests must pass |
| R3 | Execute — Steps per Phase | Build per Step, Review per Step | Per-step review (lightweight, part of SDD subagent workflow) — NOT a formal Review Gate; full Review Gate at R3b only |
| R3b | Final Review Gate (whole-branch) | Review | No CRIT/IMP issues |
| R3c | Dogfood Gate (if interactive CLI/TUI) | Dogfood | No CRIT/HIGH findings |
| R4 | Finish (Merge/PR/Discard) | — | User chooses |

**Report handling (inline):**
After dispatching any subagent that produces a report (Critique, Review, Dogfood, Research), read the report from `.docs/reports/` — the file on disk is the authoritative record. Do not rely solely on the subagent's return message.

**Cross-cutting rules (inline):**
- All output must follow `optimize-tokens` skill
- `verification-before-completion` before any success claim
- `systematic-debugging` for any unexpected failure
- `use-todo` for any multi-step task
- Rules compliance (load + propagate to subagents)


**Error handling:**
- Subagent DONE → review output, proceed
- Subagent NEEDS_CONTEXT → provide context, re-dispatch
- Subagent BLOCKED → if independently researchable → parallel investigation; else escalate
- Critique/Review gate non-convergence (3+ iterations) → ESCALATE
- Test fails → dispatch `systematic-debugging`

**Stopping conditions:**
- Done: R4 (Finish) complete
- Blocked: Escalation required
- OOS: Agent/skill/plugin config → use appropriate skill

**Precondition:** Phase 4 (Paper Trail Setup) creates `.docs/reports/`. Execute Paper Trail BEFORE Agents — see Execution Order section. The `.docs/reports/` path is resolved relative to project root (not install dir).

**Embedding — inline the following skill content into this agent definition:**

1. **Read** `src/skills/finishing-a-development-branch/SKILL.md` — inline key content (test suite, detect environment, base branch, options, worktree cleanup). **Delete** directory after embedding.
2. **Read** `src/skills/dispatching-parallel-agents/SKILL.md` — inline key content (parallel dispatch conditions, await results). **Delete** directory after embedding.
3. **Read** `src/skills/requesting-code-review/SKILL.md` — inline key content (per-task + whole-branch review modes). **Delete** directory after embedding.
4. **Read** `src/skills/subagent-driven-development/SKILL.md` — inline key content (SDD scripts reference, per-task dispatch pattern, parallel rules). **Before inlining**, scan for old `superpowers:` namespace references and update:
   - `superpowers:using-git-worktrees` → `use-git`
   - `superpowers:writing-plans` → (embedded in Plan — reference `writing-plans` directly)
   - `superpowers:finishing-a-development-branch` → (embedded here — reference `finishing-a-development-branch` directly)
   - `superpowers:executing-plans` → (dropped — reference the SDD pattern itself)
   - `superpowers:test-driven-development` → `test-driven-development`
   - `superpowers:writing-skills` → `create-skill`
   - Any other `superpowers:<name>` → strip prefix (e.g., `superpowers:foo` → `foo`)
   Keep `scripts/` directory. **Delete** SKILL.md only after embedding.
5. **Add** `use-git` loading instruction: "Load `use-git` via `skill` tool when git/worktree operations are needed — it is NOT autoinjected."

**Delete** `src/agents/develop.md`.

### Step 3.2 — Design Agent

**File:** `src/agents/design.md`
**Mode:** primary (called by user) or subagent (called by Orchestrate)
**Temperature:** 0.5 — moderate for creative exploration of design alternatives; high enough for brainstorming, low enough to stay structured

**Permissions:**
- `task`: allow → research
- `read`, `grep`: allow
- `edit`, `write`: allow (for writing to `.docs/designs/`)
- `bash`: deny
- `todowrite`: allow
- `question`, `webfetch`, `websearch`, `skill`: allow

**Role:**
- Questions and brainstorms with user to clarify requirements
- Uses Research subagent for domain exploration
- Proposes 2-3 approaches with trade-offs
- Presents design sections with user approval after each
- Writes final design spec to `.docs/designs/<date>-<topic>.md`
- Orchestrate runs the Critique Gate (Phase R1b) on Design's output before passing to Plan. Design does **not** self-dispatch Critique.

**Embedding — inline `brainstorming` from `src/skills/brainstorming/SKILL.md`:**
- Read the skill file, inline key content (explore via Research subagent, clarifying questions, 2-3 approaches, design sections with user approval, write to `.docs/designs/`)
- Also migrate supporting files: `scripts/`, `spec-document-reviewer-prompt.md`, `visual-companion.md` — move to `.docs/archive/` if valuable; otherwise delete
- **Delete** `src/skills/brainstorming/` after embedding

### Step 3.3 — Plan Agent

**File:** `src/agents/plan.md`
**Mode:** subagent (called by Orchestrate)
**Temperature:** 0.2 — low for structured decomposition; plan follows templates, not creative generation

**Permissions:**
- `read`, `grep`: allow
- `edit`, `write`: allow (for writing to `.docs/plans/`)
- `bash`: deny
- `task`: deny
- `skill`: allow (for loading TDD, optimize-tokens, etc.)

**Role:**
- Reads design spec from `.docs/designs/`
- Transitions design into a structured implementation plan
- Writes plan to `.docs/plans/<date>-<feature>.md`
- Does NOT ask user implementation questions — delegates to Critique/Review
- Each task sized for TDD (2-5 min, one action per step)
- Each task follows RED→GREEN→REFACTOR
- No placeholders, TBDs, or "similar to Task N"

**Embedding — inline `writing-plans` from `src/skills/writing-plans/SKILL.md`:**
- Read the skill file, inline key content (file structure mapping, bite-sized tasks, no placeholders, TDD per task, save to `.docs/plans/`)
- **Delete** `src/skills/writing-plans/` after embedding

**Gates required before output is accepted:**
- Critique Gate (adversarial review of plan logic/assumptions)
- Review Gate (technical review of plan structure/completeness)

### Step 3.4 — Build Agent

**File:** `src/agents/build.md`
**Mode:** subagent (called by Orchestrate)
**Temperature:** 0.3 — moderate-low for precise implementation; low enough for deterministic code, high enough for adaptable test writing
**Replaces:** `implement.md`

Based on `implement.md` (181 lines). Same structure:

**Permissions:**
- `read`, `grep`: allow
- `edit`, `write`: allow
- `bash`: allow
- `task`: deny
- `todowrite`: allow
- `question`: allow
- `skill`: allow
- `webfetch`: deny
- `websearch`: deny

**Role:**
- Implements individual tasks from plan
- Follows TDD: RED → GREEN → REFACTOR
- Self-reviews before returning
- Structured report: DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
- Only modifies files within task scope (YAGNI)
- Files changed: only what the task specifies

**Task `deny` note:** Build cannot spawn subagents. If it encounters unfamiliar technology during implementation, it must escalate to Orchestrate with BLOCKED + description of what it needs. Orchestrate dispatches Research in parallel. Build **must not guess** when it lacks domain knowledge — escalate is the correct behavior.

**Delete** `src/agents/implement.md`.

### Step 3.5 — Research Agent

**File:** `src/agents/research.md`
**Mode:** all
**Temperature:** 0.3 — balanced for structured exploration; systematic enough for thorough searches, flexible enough for creative connections
**Changes:** Update output paths to `.docs/reports/research-*.md`

Minor updates to existing content:
- Output path reference changes: `docs/review/` → `.docs/reports/`
- Remove Explore from allowed task subagents: change task permissions from `"explore": allow` to remove the explore entry. Keep `"general": allow` as a fallback for independent sub-explorations.
- Add webfetch/websearch tool descriptions
- Keep `todowrite: allow` (research needs todos for multi-source synthesis)

### Step 3.6 — Review Agent

**File:** `src/agents/review.md`
**Mode:** subagent
**Temperature:** 0.3 — low for analytical, consistent code review; higher temps can flip conclusions across runs
**Changes:** Update output paths to `.docs/reports/review-*.md`

Minor updates:
- Output path: `.docs/reports/review-*.md`
- Graduated severity handling (CRIT/IMP → fix, MINOR/LOW → note)

### Step 3.7 — Critique Agent

**File:** `src/agents/critique.md`
**Mode:** subagent
**Temperature:** 0.5 — moderate-high for adversarial creativity; needs to find what the author didn't think of, requires some divergence
**Changes:** Update output paths to `.docs/reports/critique-*.md`

Minor updates:
- Output path: `.docs/reports/critique-*.md`

### Step 3.8 — Dogfood Agent

**File:** `src/agents/dogfood.md`
**Mode:** subagent
**Temperature:** 0.2
**Changes:** Reference `use-tmux` skill instead of inline tmux commands

Replace inline tmux command tables in dogfood.md with `use-tmux` skill reference (the skill was created in Phase 2.4).

### Step 3.9 — Disable Explore and General

- **Explore:** Remove from Research agent's allowed task subagents. Delete no file (it never existed as an agent file — only as a permission reference).
- **General:** No action needed (no agent file exists).

---

## Phase 4: Paper Trail Setup

**Checkpoint commit before starting:** `git add -A && git commit -m "phase-4: pre-paper-trail checkpoint"`

### Step 4.1 — Create directory structure

```
.docs/
├── designs/       # Design specs (from Design agent)
├── plans/         # Implementation plans (from Plan agent)
├── reports/       # Review, Critique, Dogfood, Research outputs
└── rules/         # Project-level agent constraints (via create-rule skill)
```

**Note:** Deletion of `src/docs/` happens in Phase 5.3 (after archival). Do not delete here.

### Step 4.2 — Create report templates

Each report type gets a stub template file in `.docs/`. Templates define required sections and structure — agents fill in content during report generation.

- `.docs/designs/TEMPLATE.md` — **Design spec:** `# Design: <topic>`, `## Context`, `## Approaches (2-3 with trade-offs)`, `## Recommendation`, `## Design Details (sections with user approval)`, `## Edge Cases`
- `.docs/plans/TEMPLATE.md` — **Plan:** `# Plan: <feature>`, `## Phase <N>: <name>`, `### Step N.M — <action>`, file references, verification steps, checkpoint commits
- `.docs/reports/review-TEMPLATE.md` — **Review report:** `# Review Report: <scope>`, `## Context`, `## Findings (severity-graded)`, `## Positive Notes`, `## Overall Assessment (green/yellow/red)`
- `.docs/reports/critique-TEMPLATE.md` — **Critique report:** `# Critique Report: <topic> (Round N)`, `## Context`, `## Severity Summary (table)`, `## Findings per Severity`, `## Previous Issues — Resolution Status`, `## Positive Notes`, `## Overall Assessment`
- `.docs/reports/dogfood-TEMPLATE.md` — **Dogfood report:** `# Dogfood Report: <program>`, `## Features Tested`, `## Signal Handling`, `## Terminal Behavior`, `## Findings`, `## Verdict`
- `.docs/reports/research-TEMPLATE.md` — **Research report:** `# Research: <topic>`, `## Sources`, `## Key Findings`, `## Recommendations`, `## References`

These are stubs — content will be refined during use. The structure mirrors the existing conventions in current `src/docs/review/` reports.

### Step 4.3 — Verify `.gitignore`

Check that `.docs/` is not excluded by `.gitignore` patterns. If a blanket `.*` or `.*/` pattern exists, add `!.docs/` to ensure `.docs/` templates are version-controlled.

### Step 4.4 — Create `.gitkeep` files

Each directory gets a `.gitkeep` for empty-initial-state.

---

## Phase 5: Configuration & Cleanup

**Checkpoint commit before starting:** `git add -A && git commit -m "phase-5: pre-cleanup checkpoint"`

### Step 5.1 — Address `goal.ts` plugin compatibility

`goal.ts` (745 lines) uses `experimental.chat.system.transform`, `command.execute.before`, `event`, and `chat.message` hooks. The new `skill-autoinjection.js` also uses `system.transform`.

- [ ] Verify both plugins can coexist on the `system.transform` hook. OpenCode processes plugin hooks sequentially in array order from config — content appended by both should compose cleanly.
- [ ] Document plugin loading order in `opencode.jsonc`: `skill-autoinjection.js` first, then `goal.ts`. This ensures skill injection runs before goal context injection.
- [ ] If hooks conflict (e.g., one stomps the other's output), merge both plugins' transform logic into a single plugin.

### Step 5.2 — Delete removed plugins

- [ ] `src/plugins/superpowers.js` — deleted (replaced by skill-autoinjection.js)

### Step 5.3 — Archive and delete old docs

- [ ] **Lightweight scan:** Before archiving, scan `src/docs/` for design decisions and cross-references that should be carried forward or explicitly acknowledged as reversed. Delegate to Research agent if depth is needed.
- [ ] Archive existing content: copy `src/docs/` to `.docs/archive/` before deletion (preserves historical plans, designs, critique reports)
- [ ] **Delete** `src/docs/` entirely after archival
- [ ] **Root `docs/` symlink:** Remove or document as dangling. The repo has `docs/ → src/docs/` symlink at root — after `src/docs/` is deleted, this becomes a dead link. Options: (a) delete the symlink, (b) re-point to `.docs/`. Recommend option (a) — the new convention is `.docs/`, not `docs/`. Include in README update (Step 5.8).

### Step 5.4 — Update `install.sh`

**File:** `install.sh` (repo root — NOT `src/install.sh`)

Current install.sh copies from `src/` to `~/.config/opencode/`. After the refactor:
- `docs/` item removed from install array (replaced by `.docs/` at repo root — project-level only, not installed globally)
- `src/opencode.jsonc` template added to install items
- `commands/` item kept (reserved for OpenCode slash-command plugin files — OpenCode auto-discovers `.js`/`.ts` files in this directory; currently empty, no-op but harmless)

Change the items array from:
```bash
items=("agents" "plugins" "skills" "docs" "commands" "AGENTS.md" "CLAUDE.md")
```
to:
```bash
items=("agents" "plugins" "skills" "commands" "AGENTS.md" "CLAUDE.md" "opencode.jsonc")
```

**.docs/ is NOT installed globally.** The `.docs/` directory lives at project root and is created during Phase 4 (Paper Trail Setup). Agents reference `.docs/` paths relative to the project root — they do not use global templates. Templates inside `.docs/` are project-scaffolding, not global config artifacts.

### Step 5.5 — Cross-reference audit

Run these grep commands and fix any remaining stale references. **Scan ALL active file locations, not just `src/`:**

```bash
# ≡≡≡ SOURCE FILES (src/) ≡≡≡

# Deleted skills still referenced?
grep -rn "maximizing-information-density\|using-git-worktrees\|writing-skills\|writing-rules\|writing-agents\|writing-plugins\|receiving-code-review\|brainstorming\|executing-plans\|using-superpowers" src/ --include="*.md" --include="*.js"

# Deleted plugin still referenced?
grep -rn "superpowers\.js\|superpowers:skill-name\|superpowers:" src/ --include="*.md" --include="*.js"

# Old agent names still referenced in all contexts?
grep -rn "develop\|implement" src/ --include="*.md" --include="*.js" --include="*.jsonc"

# Old doc paths still referenced?
grep -rn "docs/review/\|docs/plans/\|docs/rules/\|docs/designs/" src/ --include="*.md" --include="*.js"

# Remaining references to explore as a subagent?
grep -rn '"explore"' src/ --include="*.md"

# Old skill path prefixes in cross-references?
grep -rn 'superpowers:' src/ --include="*.md"

# ≡≡≡ EMBEDDED AGENT CONTENT (src/agents/) — scan for stale references that were inlined from skills ≡≡≡

# Old namespace references inside embedded skill content?
grep -rn 'superpowers:' src/agents/ --include="*.md"

# Deleted/renamed skill names referenced inside agent definitions?
grep -rn "maximizing-information-density\|using-git-worktrees\|writing-skills\|writing-rules\|writing-agents\|writing-plugins\|receiving-code-review\|brainstorming\|executing-plans\|using-superpowers" src/agents/ --include="*.md"

# ≡≡≡ PAPER TRAIL (.docs/) — check templates for stale references ≡≡≡

if [ -d ".docs" ]; then
  grep -rn "superpowers\|develop\|implement\|maximizing-information-density\|using-git-worktrees\|writing-skills\|writing-rules\|writing-agents\|writing-plugins\|receiving-code-review\|brainstorming\|executing-plans" .docs/ --include="*.md"
fi

# ≡≡≡ OLD SKILL NAMESPACE IN AGENT DEFINITIONS ≡≡≡
# Scan for any remaining superpowers: prefix in new agent content
grep -rn 'superpowers:' src/agents/ --include="*.md"
```

### Step 5.6 — Update `src/AGENTS.md`

- Remove references to deleted skills (`receiving-code-review`, `using-superpowers`, `using-git-worktrees`)
- Update reference to `develop.md` → `orchestrate.md`
- **Two-stage review rule** (current line 28): RESOLVED — keep the two-stage model. Per-task SDD reviews remain as "spec compliance + code quality" (task-level, lightweight). Whole-branch Review Gate is a separate, combined pass at R3b. Update AGENTS.md to clarify this: "Per-task review: spec compliance + code quality for each implementation task. Whole-branch review: combined integration pass before merge."
- Update rules-loading path reference from `docs/rules/` to `.docs/rules/` (requires Phase 4 to create `.docs/rules/`)
- Verify minimum-tool rule still applies
- Permission model note: the new Orchestrate agent uses allow-by-default for task subagents (differs from develop.md's deny-by-default). Update AGENTS.md if the global convention is changing.

### Step 5.7 — Update `src/CLAUDE.md`

Same changes as AGENTS.md (these are mirrors).

### Step 5.8 — Update README.md

Update references to old agent names (`develop.md` → `orchestrate.md`), doc paths (`docs/` → `.docs/`), and plugin (`superpowers.js` → `skill-autoinjection.js`).

### Step 5.9 — Smoke test (post-deployment manual check)

After `./install.sh` is run and `~/.config/opencode/` is populated, run a minimal end-to-end verification in a **separate terminal session** (do not test in the build session):

1. **Install:** Run `./install.sh` — confirm it succeeds without errors
2. **Structure:** `ls ~/.config/opencode/` shows agents/, plugins/, skills/, commands/, AGENTS.md, CLAUDE.md, opencode.jsonc
3. **Plugin load:** Start a new OpenCode session with `orchestrate.md` as the primary agent. Verify no console errors from `skill-autoinjection` plugin
4. **Skill injection:** Confirm autoinjected skills (`optimize-tokens`, `use-todo`) appear in the Orchestrate agent's system prompt context
5. **Agent boot:** Verify Orchestrate displays its Runtime Phase R0 (Load Rules) step without errors
6. **goal.ts (if active):** Verify `/goal` command still works alongside skill-autoinjection by running `/goal test` and confirming it responds

Note: Steps 3-6 require an interactive OpenCode session. They cannot be automated in the build script.

---

## Gate Definitions

These apply across the entire workflow, referenced by Orchestrate agent.

### Critique Gate

Adversarial review of specs, plans, and ideas. Applied to design docs (before planning) and plans (before execution).

**Input:** Document to critique (spec, plan)
**Agent:** Critique
**Output:** `.docs/reports/critique-<date>-<topic>.md`

**Process:**
1. Dispatch Critique subagent with document
2. Receive critique report with severity: CRIT | HIGH | MED | LOW | INFO
3. **CRITICAL + HIGH issues** → must fix. Revise document, re-dispatch Critique. Repeat.
4. **MEDIUM + LOW issues** → note and proceed (optional fix). Do not block.
5. **INFO items** → note, no action needed.
6. **Convergence cap** → if 3+ consecutive iterations produce new CRITICAL/HIGH issues, ESCALATE: "Critique loop not converging — fundamental disagreement."
7. After all CRITICAL/HIGH issues resolved, proceed to next phase.

### Review Gate

Technical review of implementations, rules compliance, formatting, test results.

**Input:** Implementation diff or plan
**Agent:** Review
**Output:** `.docs/reports/review-<date>-<topic>.md`

**Process:**
1. Dispatch Review subagent in appropriate mode (per-step or whole-branch)
2. Receive review report with severity: CRIT | IMP | MINOR | LOW | INFO
3. **CRITICAL + IMPORTANT issues** → dispatch Build agent to fix, then re-review. Repeat until clean.
4. **MINOR + LOW issues** → note and proceed.
5. After all CRITICAL+IMPORTANT issues resolved, proceed.

### Dogfood Gate

Interactive QA testing for CLI/TUI programs only. Skip for library code, backend APIs.

**Input:** Running program
**Agent:** Dogfood
**Output:** `.docs/reports/dogfood-<date>-<topic>.md`

**Process:**
1. Orchestrate dispatches Dogfood agent with program path
2. Receive QA report with severity: CRIT | HIGH | MED | LOW | INFO
3. **CRITICAL + HIGH findings** → Orchestrate runs `systematic-debugging` to find root cause, then dispatches Build to fix. Re-dispatch Dogfood. Repeat until clean.
4. **MEDIUM + LOW findings** → Orchestrate notes, may fix depending on severity.

---

## Final Gate Sequence

After all Phases and Steps complete:

1. **Final Review Gate** (whole-branch mode) — integration review across all changes
2. **Dogfood Gate** (if applicable) — interactive QA
3. **R4: Finish** (runtime phase) — user chooses merge/PR/keep/discard

No final Critique Gate — Critique is pre-implementation only.

---

## Skill-to-Agent Dependency Map

| Skill | Type | Consumers | Mechanism |
|-------|------|-----------|-----------|
| `optimize-tokens` | Autoinjected | All agents | plugin injects into system prompt |
| `use-todo` | Autoinjected | All agents | plugin injects into system prompt |
| `use-git` | On-demand | Orchestrate, Build | loaded via skill tool when needed |
| `use-tmux` | On-demand | Dogfood | loaded via skill tool when needed |
| `create-skill` | On-demand | Design, Plan, Orchestrate | loaded via skill tool when needed |
| `create-rule` | On-demand | Design, Plan, Orchestrate | loaded via skill tool when needed |
| `create-agent` | On-demand | Orchestrate | loaded via skill tool when needed |
| `create-plugin` | On-demand | Orchestrate | loaded via skill tool when needed |
| `test-driven-development` | On-demand | Build, Plan, Orchestrate | loaded via skill tool when needed |
| `verification-before-completion` | On-demand | Build, Orchestrate | loaded via skill tool when needed |
| `systematic-debugging` | On-demand | Build, Orchestrate | loaded via skill tool when needed |
| `consider-feedback` | On-demand | Build, Design, Plan | loaded via skill tool when needed |
| `brainstorming` | Embedded | Design agent | inline in agent definition |
| `writing-plans` | Embedded | Plan agent | inline in agent definition |
| `finishing-a-development-branch` | Embedded | Orchestrate | inline in agent definition |
| `dispatching-parallel-agents` | Embedded | Orchestrate | inline in agent definition |
| `requesting-code-review` | Embedded | Orchestrate | inline in agent definition |
| `subagent-driven-development` | Embedded | Orchestrate | inline in agent definition (keep scripts/) |

---

## Execution Order

Phases must run in order. Within a phase, steps are sequential unless noted.

Phase 4 (Paper Trail) runs BEFORE Phase 3 (Agents) to ensure `.docs/reports/` exists when agent files are created.

```
Phase 0: Workspace + Baseline
Phase 1: Plugin Infrastructure (1.1 → 1.2 → 1.3)
Phase 2: Skills (2.1-2.12 create shared skills, 2.13-2.14 drop skills, 2.15-2.16 cleanup/update)
          → Skills can be parallelized: create shared skills first, then drops and cleanup
Phase 4: Paper Trail Setup (4.1 → 4.2 → 4.3 → 4.4)
Phase 3: Agents — WITH embedded skill inlining + deletion (3.1-3.4 create new agents with embedding, 3.5-3.8 update existing, 3.9 cleanup)
Phase 5: Config & Cleanup (5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8 → 5.9)
```

Gate per Phase: Review Gate required after each Phase (whole-branch mode).
After all Phases: Final Review Gate + optional Dogfood Gate → R4: Finish.

### Rollback Procedure

If any step within a phase fails:
1. Commit whatever has been completed with a descriptive message
2. Create a checkpoint commit marking the recovery point
3. Assess: roll back the partial phase (`git reset --hard` to phase-start checkpoint commit) or continue from the failure point
4. Document the decision and rationale

Phase-start checkpoint commits are created at the beginning of each phase. This ensures partial progress is never lost but a clean rollback option always exists.

**Important:** `git reset --hard` reverts tracked files only. Newly created directories (`.docs/` created in Phase 4, any temp files) must be removed manually:
```bash
# After git reset --hard to a checkpoint before .docs/ was created:
rm -rf .docs/
```
