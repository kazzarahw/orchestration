# Critique Report: post-merge-refinements (Round 2)

## Context
Review of the `post-merge-refinements` branch — examines whether previously identified CRITICAL (2) and HIGH (4) issues from Round 1 are fixed, and identifies any new issues. Working tree: `.worktrees/post-merge`.

## Severity Summary
- Critical: 0 — All Round 1 criticals are resolved; no new criticals found
- High: 2 — One unresolved from Round 1, one new
- Medium: 5 — Notable design gaps and stale references
- Low: 2 — Consistency/readability issues
- Info: 3 — Observations, not actionable

## Critical Issues (Round 1 — Verification)

### C1: Four agents missing `name:` YAML field
**Status: ✅ FIXED**
`head -5` confirms `name:` present in all four agents:
- `src/agents/critique.md` — `name: critique`
- `src/agents/research.md` — `name: research`
- `src/agents/dogfood.md` — `name: dogfood`
- `src/agents/review.md` — `name: review`

All 8 agent files (`build`, `critique`, `design`, `dogfood`, `orchestrate`, `plan`, `research`, `review`) now have valid `name:` frontmatter.

### C2: SDD scripts use `.superpowers/sdd/` instead of `.opencode/sdd/`
**Status: ✅ FIXED**
`rg "\.superpowers" src/` returns zero results. All paths use `.opencode/sdd/`.

## High Issues

### H1 (Round 1 carry-over): Plugin transform hook conflict — `skill-autoinjection.js` + `goal.ts` share `experimental.chat.system.transform` hook
**Severity: High | Status: NOT FIXED**
- `src/plugins/skill-autoinjection.js:169` registers `'experimental.chat.system.transform'`
- `src/plugins/goal.ts:461` registers `"experimental.chat.system.transform"`

**Problem:** Both plugins hook the same transform event and both push to `output.system`. There is no coordination mechanism — no ordering guarantee, no dedup between the two, no check that one hasn't already added context the other depends on.

**Mitigating factor:** `goal.ts` is commented out in `src/opencode.jsonc` (line 5: `// "plugins/goal.ts"`), so the conflict is latent. But the code codifies a fragile dependency.

**Impact if unfixed:** When a user uncomments `goal.ts`, the transform hooks race. If `goal.ts` fires before `skill-autoinjection.js`, the injected skill may not have goal context; if it fires after, goal instructions appear after skills. Neither order is guaranteed.

**Suggestion:** Either (a) merge both transforms into a single plugin that owns the hook and dispatches to sub-handlers in defined order, or (b) document the ordering requirement and add a comment in both files stating the expected plugin registration order (goal.ts after skill-autoinjection.js).

### H2 (New): `src/AGENTS.md` references "the develop agent" which does not exist
**Severity: High | Location: `src/AGENTS.md` line 67**
```
Rules in `.docs/rules/` override all skill and default behavior — the develop agent re-reads them after any working directory change.
```
**Problem:** There is no `develop.md` agent — `ls src/agents/develop.md` returns "not found." The orchestrator is `orchestrate.md`. This is a stale reference from the pre-rename era.

**Impact:** When this rule loads into an OpenCode session, any agent reading it would look for a "develop agent" that doesn't exist. The rule about re-reading rules after directory change is correct, but the agent name is wrong.

**Suggestion:** Replace "the develop agent" with "the orchestrator agent" (which could also reference `orchestrate.md`).

## Medium Issues

### M1: `subagent-driven-development` skill directory has no `SKILL.md`
**Severity: Medium | Location: `src/skills/subagent-driven-development/`**
**Problem:** The `subagent-driven-development` directory contains `implementer-prompt.md` and `task-reviewer-prompt.md` but NO `SKILL.md`. This violates the convention stated in `AGENTS.md` line 26: "Skills live at `src/skills/<name>/SKILL.md`." The autoinjection plugin also validates by looking for `SKILL.md` — this skill would silently be skipped.

**Impact:** The skill cannot be loaded by the `skill-autoinjection` plugin or by OpenCode's native skill discovery. Any agent attempting to load `subagent-driven-development` via the `skill` tool would fail silently.

**Suggestion:** Either (a) create a minimal `SKILL.md` with frontmatter + summary that references the prompt files, or (b) move the content from the prompt files into a single `SKILL.md` and delete the prompt files.

### M2: AGENTS.md line 50 mentions "Build and implementer subagents" but no `implementer` agent exists
**Severity: Medium | Location: `AGENTS.md` line 50**
```
...delegating code changes to Build and implementer subagents and never writing implementation code directly.
```
**Problem:** The root `AGENTS.md` references "implementer subagents." The only implementation subagent is `build.md`. There is no `implementer.md` agent definition. The `subagent-driven-development/implementer-prompt.md` is a template, not an agent definition.

**Impact:** Creates confusion about the agent architecture — new readers would search for a non-existent agent.

**Suggestion:** Replace "Build and implementer subagents" with "build subagents" or "the build subagent." If the concept of "implementer" as distinct from "build" is intentional, create the corresponding agent definition.

### M3: `orchestrate.md` references `create-skill` as a loadable skill, but the lifecycle treats it as a boundary
**Severity: Medium | Location: `src/agents/orchestrate.md` lines 6, 73, 360, 403**
**Problem:** Line 6 lists `create-skill` as out of scope, line 73 says "Apply `create-skill` skill, stop", line 360 says "Apply `create-skill` when..." However, the `create-skill` skill directory exists and could be dispatched. The intent is clear (boundary enforcement), but the phrasing mixes "out of scope" with "apply this skill" inconsistently.

**Impact:** An agent might be uncertain whether `create-skill` is a loadable workflow or a boundary condition.

**Suggestion:** Make the boundary language consistent: either say "Stop — this is out of scope (use create-skill independently)" consistently at every reference, or treat it as an in-lifecycle action consistently.

### M4: `writing-plans` referenced in AGENTS.md and skill content but no `src/skills/writing-plans/` directory exists
**Severity: Medium | Locations:**
- `AGENTS.md` lines 63, 90
- `src/skills/create-rule/SKILL.md` line 54

**Problem:** `writing-plans` is referenced as a source of documentation conventions and as a step in the dependency chain. The directory does not exist in `src/skills/`. While the content is "embedded" in `orchestrate.md`, a developer needs to know where to find/maintain it.

**Impact:** Documentation-sourced knowledge gap — the convention links to a skill that isn't in the source tree.

**Suggestion:** Either (a) reproduce `writing-plans` as a minimal skill directory in `src/skills/` with frontmatter + cross-reference to the orchestrate.md sections, or (b) remove the `writing-plans` references from the dependency chain descriptions and replace with "built into orchestrate."

### M5: `consider-feedback` skill name doesn't match platform convention
**Severity: Medium | Location: `src/skills/consider-feedback/SKILL.md`**
**Problem:** The system prompt lists an available skill `receiving-code-review` with description "Use when receiving code review feedback". The on-disk skill is named `consider-feedback`. These appear to be the same skill under different names. The `consider-feedback` one is referenced in `orchestrate.md` line 354 ("Apply `consider-feedback` when receiving feedback").

**Impact:** Duplication or inconsistency — if both skills exist in the installed config, an agent might load the wrong one.

**Suggestion:** If they are the same skill, delete one and consolidate references. If they are different, rename to make the distinction clear (e.g., `consider-feedback` for receiving review vs something else).

## Low Issues

### L1: `src/opencode.jsonc` uses relative plugin path
**Severity: Low | Location: `src/opencode.jsonc` line 3**
```json
"plugins": ["plugins/skill-autoinjection.js"]
```
**Observation:** The relative path works after `install.sh` (plugin resolves relative to `~/.config/opencode/`). But during development (running opencode from the repo root), the config file at `src/opencode.jsonc` wouldn't be found by default — only `~/.config/opencode/opencode.jsonc` is loaded. This is fine for production but creates a minor development friction: devs must run `install.sh` to test config changes.

**Suggestion:** Add an `opencode.jsonc` at the repo root (or document that install → test cycle is required). This is a dev-experience issue, not a correctness issue.

### L2: AGENTS.md line 91 backtick inconsistency
**Severity: Low | Location: AGENTS.md lines 90-91**
```
Orchestrate → delegates Design (brainstorming embedded) → Plan (writing-plans embedded) → Build (subagent-driven-development)  
→ final Review + optional Dogfood → `finishing-a-development-branch`
```
**Observation:** `finishing-a-development-branch` is backticked on line 91 but other skill names on line 90 are not. Minor typographic inconsistency.

**Suggestion:** Either backtick all skill references or none on those lines.

## Info

### I1: "superpowers" survives in one historical reference
**Location: AGENTS.md line 54**
```
Replaces the former `using-superpowers` skill + `superpowers.js` autoinjection pair.
```
**Observation:** This is a historical note describing what was replaced. Not actionable — it's correct and useful context. Zero `SUPERPOWERS` references remain in source code (scripts, config, plugins).

### I2: Five skills referenced as "embedded from" in orchestrate.md have no source directory
**Location: `src/agents/orchestrate.md` lines 177, 202, 228**
Skills: `dispatching-parallel-agents`, `requesting-code-review` (2x), `finishing-a-development-branch`
**Observation:** These skills are referenced as embedded content origin. The directories don't exist in `src/skills/`, meaning no source of truth exists outside `orchestrate.md`. If this is intentional (single-source-of-truth in the orchestrator), consider adding a comment. If accidental, create the skill directories.

### I3: Skill word counts generally under target
**Location: `wc -w src/skills/*/SKILL.md`**
**Observation:** Most skills are within or under the <500 word target specified in AGENTS.md. `create-skill` and `create-rule` are notably larger (3738 and 3763 words respectively) — these may benefit from trimming, but that's a separate optimization pass.

## Positive Notes

- All agent files now have `name:` frontmatter — clean resolution of the most impactful Round 1 issue.
- Zero `.superpowers` or `SUPERPOWERS` references remain in source code and plugins. The migration from Superpowers naming to OpenCode conventions is complete.
- `orchestrate.md` is well-structured with clear phases, error handling, and red flags. The embedded skill content pattern (annotating provenance with "embedded from X") is good documentation practice.
- The `skill-autoinjection.js` plugin has improved caching (per-instance `injectionCache` + per-agent `injectedTracker` dedup) — clean design for avoiding repeated disk reads and duplicate injections.
- `install.sh` has a proper backup-before-overwrite pattern with error recovery via `trap`.

## Overall Assessment

**Ready to proceed with reservations.** All 2 CRITICAL issues from Round 1 are cleanly fixed. Most HIGH issues from Round 1 are resolved or are by-design decisions. Two HIGH issues remain: the latent transform hook conflict between `goal.ts` and `skill-autoinjection.js` (needs documentation or coordination), and the stale "develop agent" reference in `src/AGENTS.md`. The medium issues are documentation/maintainability gaps (missing `SKILL.md` for `subagent-driven-development`, stale references to non-existent agents/skills). None are blockers, but H1 (transform hook conflict) and H2 (stale develop-agent reference) should be addressed before merging to avoid confusion and future debugging pain. Recommend fixing H1/H2, then merging.
