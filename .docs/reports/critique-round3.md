# Critique Report: post-merge-refinements (Round 3)

## Context
Review of the `post-merge-refinements` branch (2 commits: `41fdea0` Round 1, `5260c5a` Round 2) — examines whether Round 2 findings are resolved, identifies any remaining or new issues, and provides a merge recommendation. Working tree: `.worktrees/post-merge`.

## Severity Summary
- Critical: 0 — No critical issues found
- High: 1 — `subagent-driven-development` will break after `install.sh`
- Medium: 3 — Stale doc reference, non-existent skill name in agent prompt, dormant hook conflict
- Low: 2 — Transition naming mismatch, historical branding references
- Info: 4 — Observations, not actionable

## Critical Issues
None.

## High Issues

### H1: `subagent-driven-development` missing `SKILL.md` — latent breakage after install
**Location:** `src/skills/subagent-driven-development/`
**Previously:** Round 2 flagged as M1. Developing agent disagreed ("by design — scripts/prompts only")

**Problem:** The directory contains only `implementer-prompt.md`, `task-reviewer-prompt.md`, and `scripts/`. There is no `SKILL.md`. The installed version (`~/.config/opencode/skills/subagent-driven-development/SKILL.md`) exists from a pre-merge install and **will be destroyed on next `install.sh`** — the script does `rm -rf "$dst"` then `cp -r "$src"`, so the old SKILL.md is gone and nothing replaces it.

**Impact:** After `install.sh`:
1. `skill-autoinjection` plugin cannot discover the skill (it looks for `SKILL.md`)
2. OpenCode's native `skill` tool cannot load it
3. The `src/agents/orchestrate.md` Build phase references this skill — the lifecycle has a dead link

The skill is discoverable currently because the installed copy predates this branch. After merge + install, it breaks.

**Suggestion:** Create a minimal `SKILL.md` with frontmatter (`name: subagent-driven-development`, `description: Use when...`) and a summary that delegates to the prompt files. ~80 words is sufficient — the detailed workflow is in the prompts.

## Medium Issues

### M1 (Carry-over from Round 2 H1): Latent transform hook conflict
**Location:** `src/plugins/skill-autoinjection.js` (line 169), `src/plugins/goal.ts` (line 461), `src/opencode.jsonc`

**Severity re-assessment:** Downgraded from HIGH (Round 2) to MEDIUM.

**Problem:** Both plugins register `experimental.chat.system.transform` and both push to `output.system`. No coordination or ordering guarantee.

**Mitigation applied in this branch:**
- `goal.ts` is commented out in `opencode.jsonc`
- A comment notes the ordering requirement: `// If goal.ts is in use, add it here after skill-autoinjection:`

**Why Medium:** The conflict is now documented and dormant. Uncommenting `goal.ts` without understanding the ordering constraint would re-introduce the race, but the comment mitigates this for anyone reading the config. The code-level fragility remains, but the operational risk is near-zero.

**Suggestion:** Accept as-is for now. If both plugins are ever re-enabled, the correct fix is either (a) merge both into one plugin owning the hook, or (b) add runtime assertions so the ordering is enforced.

### M2: `writing-rules` referenced in AGENTS.md but only `create-rule` exists in source
**Location:** `AGENTS.md` line 64
```
| `.docs/rules/*.md` | Mandatory project constraints (from writing-rules skill) |
```

**Problem:** The source has `src/skills/create-rule/`, not `src/skills/writing-rules/`. The installed `~/.config/opencode/skills/writing-rules/` exists from a previous install but will be **deleted on next `install.sh`**. After merge + install, the documentation points to a skill that doesn't exist.

**Impact:** Stale documentation — tells readers to look for a skill that isn't there.

**Suggestion:** Change to `(from create-rule skill)` — matches the source tree name.

### M3: `generate-plan` in research.md references non-existent skill
**Location:** `src/agents/research.md` line 192
```
You may invoke the `optimize-tokens` skill ... If you find yourself tempted to load any other skill (brainstorming, TDD, generate-plan, etc.), stop immediately
```

**Problem:** `generate-plan` is not a skill name in the source tree or the installed config. This was changed FROM `writing-plans` (which also doesn't exist anymore — it was replaced by the `plan` agent). There is no `generate-plan` skill.

**Impact:** Trivial — this is a list of example skills the research agent should NOT use. But it references a non-existent name, which is confusing and breaks consistency.

**Suggestion:** Replace with `plan agent` or just remove the parenthetical: "brainstorming, TDD, etc." — the list doesn't need to be exhaustive.

## Low Issues

### L1: `consider-feedback` vs `receiving-code-review` naming mismatch
**Locations:**
- Source: `src/skills/consider-feedback/` (exists)
- Source: `src/skills/receiving-code-review/` (does not exist)
- Orchestrate: `src/agents/orchestrate.md` line 354 references `consider-feedback`
- Installed: `~/.config/opencode/skills/receiving-code-review/` (from pre-merge install)

**Problem:** Two different names for what appears to be the same skill concept. The source has `consider-feedback`, the installed config has `receiving-code-review`. After `install.sh`, the installed `receiving-code-review/` is deleted and `consider-feedback/` takes its place.

**Impact:** Low — resolves after `install.sh` runs. During development before install, the naming mismatch could confuse someone looking for the skill at the wrong path.

**Suggestion:** The orchestrate.md reference is already correct (`consider-feedback`). After merge + install, the naming will be consistent. No action needed.

### L2: Historical "Superpowers / Claude Code" references in documentation
**Locations:**
- `AGENTS.md:7` — "The skills currently follow the Superpowers format and conventions"
- `AGENTS.md:54` — "Replaces the former `using-superpowers` skill + `superpowers.js`"
- `src/skills/create-agent/SKILL.md:104` — "Superpowers / Claude Code" format comparison
- `README.md:3,31` — "Claude Code" mentions
- `TODO.md:4` — "Superpowers does this fairly nicely..."

**Problem:** These are not production references — they're historical context, documentation, and a TODO note. No `.superpowers` paths or active branding remain. Zero `rg "\.superpowers"` results in source code.

**Impact:** None. These are accurate historical notes explaining the design evolution.

**Suggestion:** No action needed. If a future cleanup wants to purge all non-OpenCode branding, these are the remaining targets, but they add useful context.

## Info

### I1: Round 2 issues verified as fixed
| Issue | Status | Verification |
|-------|--------|-------------|
| H2: "develop agent" in src/AGENTS.md | ✅ FIXED | Zero rg results; now reads "orchestrator agent" |
| M2: "Build and implementer subagents" | ✅ FIXED | AGENTS.md now says "build subagent" |
| M4: "writing-plans" references | ✅ FIXED | Zero rg results for "writing-plans" |
| M3: create-skill boundary | ✅ NOT AN ISSUE | Language is consistent across all 4 references |

### I2: All agent `name:` fields present
All 8 agent files have `name:` frontmatter: build, critique, design, dogfood, orchestrate, plan, research, review. No `name:` issues remain.

### I3: `mode:` field inconsistency — research.md uses `mode: all`
**Location:** `src/agents/research.md` YAML frontmatter

All other agents use `mode: primary` or `mode: subagent`. `research.md` uses `mode: all`, which means it can be dispatched as either primary or subagent. This may be intentional (research is a standalone capability used both ways) but is worth documenting/confirming.

### I4: `install.sh` currently works but will delete unknown configs
The install script does `rm -rf "$dst"` then copies from `src/`. This means anything in `~/.config/opencode/skills/` not in `src/skills/` gets silently deleted. Currently this includes:
- `writing-plans/` (will be deleted — the plan agent replaces it)
- `writing-rules/` (will be deleted — `create-rule` replaces it)
- `receiving-code-review/` (will be deleted — `consider-feedback` replaces it)
- `brainstorming/`, `maximizing-information-density/`, `using-git-worktrees/`, `using-superpowers/`, `dispatching-parallel-agents/`, `executing-plans/`, `requesting-code-review/`, `finishing-a-development-branch/` (all will be deleted — content embedded in orchestrate.md or not needed)

This is mostly correct behavior (old skills being replaced by new ones), but the silent deletion could surprise a developer who has local additions. Not actionable for this merge.

## Positive Notes

- The AGENTS.md rewrite is excellent — clean terminology, accurate agent references, and the "embedded from" pattern clearly documents provenance.
- The `src/opencode.jsonc` configuration is minimal and correct — plugin path, injection list, and a clean comment structure.
- Every agent file now has `name:` frontmatter — clean resolution of the most impactful Round 1 issue.
- Zero `.superpowers` references remain in source code, scripts, or config. The migration from Superpowers naming is complete.
- The orchestrate.md diff shows careful attention to terminology: `writing-plans` → `plan agent`, `.superpowers/sdd/` → `.opencode/sdd/`, `from X skill` → `embedded from X`.

## Overall Assessment

**Recommendation: CONDITIONAL — merge after fixing H1.**

The branch fixes the vast majority of Round 1 and Round 2 issues. All old naming problems (develop agent, writing-plans, .superpowers paths) are cleanly resolved. The AGENTS.md rewrite is thorough and correct.

One issue requires attention before merge: **`src/skills/subagent-driven-development/` has no `SKILL.md`**, which will break the Build phase after `install.sh` runs. This is a regression introduced in this branch (the installed version has a SKILL.md from the pre-merge state; the source version doesn't). The fix is trivial — create a minimal ~80-word `SKILL.md` with `name:` and `description:` frontmatter and a brief summary referencing the prompt files.

Medium issues (M1-M3) are documentation/consistency gaps that should be fixed but are not blockers. Low and Info items are for awareness.

**Fix H1 → merge. Then handle M1, M2, M3 in a follow-up or immediately.**
