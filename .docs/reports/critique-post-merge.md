# Critique Report: Post-Merge Verification of Framework Refactor

## Context

Adversarial post-merge verification of the Superpowers → modular agent/skill/plugin refactor, merged to `master`. Examines completeness, consistency, integration, gaps, and architecture of the final state.

## Severity Summary

- **Critical:** 2 — Must fix before the framework is usable
- **High:** 4 — Should fix, will cause runtime problems or token waste
- **Medium:** 5 — Worth fixing, notable gaps but not blocking
- **Low:** 3 — Style/cleanliness, optional
- **Info:** 2 — Observations, not actionable

## Critical Issues

### C1. Four agents missing `name:` field in YAML frontmatter — agents will not register in OpenCode
- **Files:** `src/agents/critique.md`, `src/agents/research.md`, `src/agents/dogfood.md`, `src/agents/review.md`
- **Problem:** These four agent definition files have `description:`, `mode:`, `temperature:`, `color:`, and `permission:` fields, but are **missing the mandatory `name:` field** in their YAML frontmatter. The agents that have `name:` (orchestrate, design, plan, build) differ from those missing it. This appears to be an oversight during the rename from the old agent names (e.g., critique was likely `superpowers-agent: critique` in the old system).
  ```
  # Current (broken):
  ---
  description: >-
    Use this agent to ...
  mode: subagent
  temperature: 0.5
  ...

  # Required (example):
  ---
  name: critique
  description: >-
    Use this agent to ...
  mode: subagent
  ...
  ```
- **Impact:** OpenCode may fail to register these agents or dispatch them by name (`@critique`, `@review`, `@research`, `@dogfood`). The orchestrator's lifecycle depends on dispatching all four, so this would cause the entire SDD pipeline to break after design/planning when it tries to dispatch critique or review.
- **Suggestion:** Add `name: critique`, `name: research`, `name: dogfood`, `name: review` to the respective frontmatter blocks. The `name` should match the filename (minus `.md` suffix) to follow OpenCode conventions.

### C2. Three SDD scripts still use `.superpowers/sdd/` namespace — not migrated to `.opencode/sdd/`
- **Files:**
  - `src/skills/subagent-driven-development/scripts/sdd-workspace` (line 19)
  - `src/skills/subagent-driven-development/scripts/task-brief` (line 7)
  - `src/skills/subagent-driven-development/scripts/review-package` (line 8)
- **Problem:** All three SDD scripts use `$root/.superpowers/sdd/` as the working directory for task briefs, reports, and review packages. The `sdd-workspace` script creates this directory at runtime. The `.superpowers/` namespace is a legacy artifact from the Superpowers era and was supposed to be migrated to `.opencode/sdd/` per the design plan (design-2026-06-30-workflow-todo-enforcement.md, lines 175-178: "`.superpowers/sdd/` → `.opencode/sdd/`").
- **Impact:** New deployments create a `.superpowers/sdd/` directory in the project root. This perpetuates the old branding, confuses users who see both `.superpowers/` and `.opencode/` in their projects, and contradicts the stated goal of removing Superpowers branding. Also, the `sdd-workspace` script's `.gitignore` writes `*` into the directory, which could be destructive if the path is wrong.
- **Suggestion:** Replace `.superpowers/sdd` with `.opencode/sdd` in all three scripts. Update `sdd-workspace` to use `.opencode/sdd/`.

## High Issues

### H1. orchestrate.md references `.superpowers/sdd/` for workspace and progress ledger
- **File:** `src/agents/orchestrate.md`, lines 188 and 197
  - Line 188: `scripts/sdd-workspace` — resolves/creates `.superpowers/sdd/` (gitignored artifact dir)
  - Line 197: Maintain a progress ledger at `.superpowers/sdd/progress.md`
- **Problem:** The orchestrate agent instructs subagents to use `.superpowers/sdd/` for the SDD workspace and progress ledger. This is the same stale namespace as C2 but at the agent level. The orchestrate agent's instructions drive the SDD workflow — if the instructions say `.superpowers/` but the scripts create `.opencode/` (after C2 fix), there's a mismatch.
- **Suggestion:** Update both references to `.opencode/sdd/` (line 188 description and line 197 path). This must be done in coordination with C2 — both the scripts and the agent instruction must agree on the path.

### H2. skill-autoinjection.js and goal.ts both register `experimental.chat.system.transform` — potential handler conflict
- **Files:** `src/plugins/skill-autoinjection.js` (line 169), `src/plugins/goal.ts` (line 461)
- **Problem:** Both plugins register a handler for the `experimental.chat.system.transform` hook:
  - `skill-autoinjection.js` pushes `<AUTO_INJECTED_SKILL>` blocks to `output.system`
  - `goal.ts` pushes `<GOAL_CONTEXT>` blocks to `output.system`
  
  Both handlers read from `input` and push to `output.system`. The `opencode.jsonc` has `goal.ts` commented out, but if a user uncomments it, the behavior depends on OpenCode's hook dispatch mechanism:
  - If OpenCode iterates over all registered handlers: both work additively (desired behavior)
  - If OpenCode replaces the handler on each registration: one plugin silently loses its injection
  - If OpenCode calls handlers in registration order but one modifies `output` in a way that breaks the other: potential corruption
- **Impact:** Unknown — depends on OpenCode's internal dispatch. At minimum, the ordering of injected content (skills first vs. goal context first) varies. At worst, one plugin's injection is silently lost.
- **Suggestion:** 
  1. Test with both plugins active: verify both `<AUTO_INJECTED_SKILL>` and `<GOAL_CONTEXT>` appear in the system prompt.
  2. If OpenCode only supports one handler, merge the two transforms into a single plugin, or have `skill-autoinjection.js` re-dispatch to `goal.ts`'s transform logic.
  3. Document the known limitation in the `opencode.jsonc` comment.

### H3. TOOL_MAPPING is duplicated per injected skill — ~30 redundant lines per session
- **File:** `src/plugins/skill-autoinjection.js`, lines 25-36 and 128-132
- **Problem:** The `TOOL_MAPPING` block (~12 lines) is appended inside each `<AUTO_INJECTED_SKILL>` wrapper (line 131). When `["optimize-tokens", "use-todo"]` are both injected, the tool mapping block appears twice in the system prompt — identical content, duplicated.
  
  ```
  <AUTO_INJECTED_SKILL name="optimize-tokens" ...>
  ...body...
  
  **Tool Mapping for OpenCode:**
  ...12 lines...
  </AUTO_INJECTED_SKILL>
  
  <AUTO_INJECTED_SKILL name="use-todo" ...>
  ...body...
  
  **Tool Mapping for OpenCode:**
  ...12 lines...
  </AUTO_INJECTED_SKILL>
  ```
- **Impact:** Wastes ~300 tokens per session (2 skills × ~150 tokens for the mapping), reducing effective context for task-relevant content. For platforms with tight context limits, this compounds.
- **Suggestion:** Options:
  a. Move `TOOL_MAPPING` outside the `<AUTO_INJECTED_SKILL>` wrapper — inject it once after all skills.
  b. Only append the tool mapping to the first injected skill (deduplicate).
  c. Make the tool mapping an optional part of the `<AUTO_INJECTED_SKILL>` content, configurable per skill.
  
  Option (a) is cleanest: emit the tool mapping as a standalone block after the last `<AUTO_INJECTED_SKILL>`.

### H4. orchestrate.md references old embedded skills as loadable skills
- **File:** `src/agents/orchestrate.md`
  - Line 177: "from dispatching-parallel-agents skill" — implies this is a loadable skill
  - Line 202: "from requesting-code-review skill" — implies this is a loadable skill
  - Line 228: "from requesting-code-review skill" — same, repeated
- **Problem:** The skills `dispatching-parallel-agents` and `requesting-code-review` were embedded into the orchestrate agent during the refactor. They no longer exist as loadable skill documents. An agent reading "from dispatching-parallel-agents skill" might try to invoke the `skill` tool to load it, which would fail with "not found." The text reads as a citation (like "from X skill") but the cited skill no longer exists as a separate file.
- **Impact:** Minor confusion for the agent, but could trigger a skill-not-found error if the agent attempts to load a non-existent skill.
- **Suggestion:** Rewrite these attributions to remove the "skill" reference:
  - "Parallel dispatch rules:" (remove "from dispatching-parallel-agents skill")
  - "Per-task review requests:" (remove "from requesting-code-review skill")
  - Or add a note: "The following rules are embedded from the former dispatching-parallel-agents skill."

## Medium Issues

### M1. research.md references old skill names as negative examples
- **File:** `src/agents/research.md`, line 193
- **Problem:** "If you find yourself tempted to load any other skill (brainstorming, TDD, writing-plans, etc.), stop immediately" — references `brainstorming` and `writing-plans` as skill names. These skills no longer exist (brainstorming was dropped, writing-plans was embedded into the plan agent). An agent that tries to load these would get a "not found" error.
- **Suggestion:** Update the examples to reference skills that still exist: "(test-driven-development, create-skill, create-agent, etc.)"

### M2. design.md references "writing-plans" as a skill
- **File:** `src/agents/design.md`, line 35
- **Problem:** "NO invoking implementation skills after design — only writing-plans (via plan agent)" — "writing-plans" was an old skill name that was embedded into the plan agent. While the context makes it clear it's referring to the plan agent's function, using the exact old skill name could confuse agents.
- **Suggestion:** Change to "only plan creation (via the plan agent)" or "only plan (via @plan agent)".

### M3. Three agents have leftover `<!-- superpowers-agent: ... -->` HTML comments
- **Files:**
  - `src/agents/critique.md`, line 30
  - `src/agents/research.md`, line 99
  - `src/agents/dogfood.md`, line 79
- **Problem:** These HTML comments are vestiges of the old Superpowers agent system (`superpowers-agent: critique v1`, etc.). While functionally harmless (HTML comments are ignored by the agent), they perpetuate the old branding in what is supposed to be a clean refactor.
- **Suggestion:** Remove these three lines from the agent definition files.

### M4. orchestrate.md references "finishing-a-development-branch" as a process
- **File:** `src/agents/orchestrate.md`, line 249
- **Problem:** "Apply the finishing-a-development-branch process" — this was an old skill name used as a description. Since the skill was embedded, this is a minor inconsistency. The R4 section that follows does contain the embedded content. The reference is descriptive, not functional.
- **Suggestion:** Change to "Apply the branch finishing process:" to remove the old skill name.

### M5. `opencode.jsonc` `skill-autoinjection` config key may cause collision with OpenCode's own config parsing
- **File:** `src/opencode.jsonc`, line 7
- **Problem:** The custom config key `skill-autoinjection` is not part of OpenCode's standard config schema. If OpenCode strips unknown keys during validation, this configuration would be silently lost and no skills would be injected. The plugin reads from `config['skill-autoinjection']` but if OpenCode doesn't pass it through, the array is always empty.
- **Suggestion:** Validate in a running OpenCode instance that the `skill-autoinjection` key survives config parsing. Alternatively, namespace the key (e.g., `custom.skill-autoinjection` or `plugins.skill-autoinjection.skills`) to avoid collision.

## Low Issues

### L1. Oversized YAML description fields with embedded HTML in three agents
- **Files:** `src/agents/research.md` (lines 2-80), `src/agents/dogfood.md` (lines 2-60), `src/agents/critique.md` (lines 2-10), `src/agents/review.md` (lines 2-23)
- **Observation:** The `description:` field uses `>-` (folded block scalar with strip) containing multi-line text that includes `<example>`, `<commentary>`, and other HTML tags. This is syntactically valid YAML but unusual — the description field is intended for a concise purpose statement. The embedded examples could potentially be parsed as YAML structure depending on indentation. Specifically, `research.md`'s description spans ~80 lines.
- Not a functional issue but could cause parsing problems with strict YAML parsers.

### L2. `optimize-tokens/SKILL.md` uses non-standard `metadata.alias` YAML field
- **File:** `src/skills/optimize-tokens/SKILL.md`, line 5
- **Observation:** The frontmatter includes `metadata:` with a nested `alias:` field: `metadata:\n  alias: maximizing-information-density`. This is a non-standard YAML structure. OpenCode's frontmatter parser may not understand nested objects in the way intended. The old name `maximizing-information-density` is listed here for backward compatibility, but it's unclear whether the platform's skill-loading mechanism reads this field.
- Not an actionable issue — just noting that the `metadata.alias` convention may or may not be recognized.

### L3. `src/commands/` directory is empty (only .gitkeep)
- **File:** `src/commands/.gitkeep`
- **Observation:** The `commands/` directory is included in the `install.sh` items array but contains only a `.gitkeep` file. This is expected (future use) but means the install step copies an effectively empty directory. No action needed.

## Info

### I1. Previous review findings (CRITICAL C1, C2, IMP1-4) confirmed resolved
- The earlier whole-branch review found 7 `superpowers:` namespace references in active skill files (C1), 5 broken file links in `create-skill/SKILL.md` (C2), and various IMPORTANT issues.
- **Verification:** grep for `superpowers:` in `src/` returns zero results. All file paths in skills use the new `.docs/` convention. This confirms the CRITICAL findings from the pre-merge review were properly remediated.

### I2. Goals plugin integration ambiguity
- **Observation:** The `goal.ts` plugin is commented out in `opencode.jsonc` with the note "If goal.ts is in use, add it here after skill-autoinjection." The ordering comment ("after skill-autoinjection") suggests the author is aware of the transform hook ordering concern (H2) and recommends `skill-autoinjection` register first. If OpenCode calls handlers in registration order, this is the correct approach.
- This suggests the author intentionally mitigated H2 through config ordering — the issue is worth documenting but partially addressed.

### I3. SDD directory exists without SKILL.md — scripts-only artifact
- **Observation:** `src/skills/subagent-driven-development/` contains `implementer-prompt.md`, `task-reviewer-prompt.md`, and `scripts/` but no `SKILL.md`. This is by design: the SDD skill content was embedded into `orchestrate.md`, and the directory retains supporting files (scripts and reference prompts) for the orchestrate agent to reference via file paths. This is a clean approach but should be documented in a README or comment in the directory to prevent confusion.

## Completeness Checklist

### Files that should exist
| Path | Status |
|------|--------|
| `src/agents/orchestrate.md` | ✅ |
| `src/agents/design.md` | ✅ |
| `src/agents/plan.md` | ✅ |
| `src/agents/build.md` | ✅ |
| `src/agents/research.md` | ✅ |
| `src/agents/review.md` | ✅ |
| `src/agents/critique.md` | ✅ |
| `src/agents/dogfood.md` | ✅ |
| `src/plugins/skill-autoinjection.js` | ✅ |
| `src/plugins/goal.ts` | ✅ |
| `src/opencode.jsonc` | ✅ |
| `.docs/designs/TEMPLATE.md` | ✅ |
| `.docs/plans/TEMPLATE.md` | ✅ |
| `src/skills/optimize-tokens/` | ✅ |
| `src/skills/use-todo/` | ✅ |
| `src/skills/use-git/` | ✅ |
| `src/skills/use-tmux/` | ✅ |
| `src/skills/create-skill/` | ✅ |
| `src/skills/create-rule/` | ✅ |
| `src/skills/create-agent/` | ✅ |
| `src/skills/create-plugin/` | ✅ |
| `src/skills/consider-feedback/` | ✅ |
| `src/skills/test-driven-development/` | ✅ |
| `src/skills/verification-before-completion/` | ✅ |
| `src/skills/systematic-debugging/` | ✅ |

### Files that should be gone
| Path | Status |
|------|--------|
| `src/plugins/superpowers.js` | ✅ Gone |
| `src/skills/using-superpowers/` | ✅ Gone |
| `src/skills/brainstorming/` | ✅ Gone |
| `src/skills/executing-plans/` | ✅ Gone |
| `src/skills/writing-plans/` | ✅ Gone |
| `src/skills/finishing-a-development-branch/` | ✅ Gone |
| `src/skills/dispatching-parallel-agents/` | ✅ Gone |
| `src/skills/requesting-code-review/` | ✅ Gone |
| `src/skills/maximizing-information-density/` | ✅ Gone |
| `src/skills/using-git-worktrees/` | ✅ Gone |
| `src/skills/writing-skills/` | ✅ Gone |
| `src/skills/writing-rules/` | ✅ Gone |
| `src/skills/writing-agents/` | ✅ Gone |
| `src/skills/writing-plugins/` | ✅ Gone |
| `src/skills/receiving-code-review/` | ✅ Gone |

## Plugin Transformation Hook Ordering

Analysis of how `skill-autoinjection.js` and `goal.ts` interact when both enabled:

```
Both registered for: experimental.chat.system.transform

skill-autoinjection.js:                    goal.ts:
  Reads: input.agent,                        Reads: input.sessionID,
         input.agentConfig                            currentGoal state
  Pushes to: output.system                  Pushes to: output.system
  Content: <AUTO_INJECTED_SKILL>            Content: <GOAL_CONTEXT>

Ordering (per opencode.jsonc comment):
1. skill-autoinjection.js → <AUTO_INJECTED_SKILL> blocks
2. goal.ts → <GOAL_CONTEXT> block

Output precedence:
[...skill injections..., tool mapping, ...goal context...]
```

If OpenCode calls both handlers sequentially with the same `(input, output)`, both plugins work. If it replaces the handler on each registration, only `goal.ts` takes effect. **This should be tested** before declaring the architecture stable.

## Overall Assessment

**YELLOW** — The structural foundation is solid (file deletions, agent creations, doc path migration, install.sh update, plugin system) but **two CRITICAL issues prevent the framework from being usable out of the box**:

1. **Four agents missing `name:` fields** — Without these, `@critique`, `@review`, `@research`, and `@dogfood` dispatches from the orchestrate agent will fail. The entire SDD pipeline that the orchestrate agent orchestrates depends on these agents being dispatchable by name.

2. **`.superpowers/sdd/` namespace not migrated** — The old Superpowers branding persists in three runtime scripts and two orchestrate agent instructions. New deployments silently create a `.superpowers/` directory in every project.

The four HIGH issues (stale namespace references in orchestrate.md, plugin transform hook conflict, tool mapping duplication, and misleading skill references) should be addressed before the framework is considered stable, but they won't prevent initial use if the two CRITICAL issues are fixed.

**Recommended order of fixes:**
1. Add `name:` field to `critique.md`, `research.md`, `dogfood.md`, `review.md` (C1)
2. Migrate `.superpowers/sdd/` → `.opencode/sdd/` in all three scripts and orchestrate.md (C2 → H1)
3. Test `experimental.chat.system.transform` with both plugins active (H2)
4. Deduplicate TOOL_MAPPING injection (H3)
5. Clean up old skill name references in agent text (H4, M1, M2, M3)
