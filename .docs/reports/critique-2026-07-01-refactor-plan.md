# Critique Report: Refactor Plan — 6-Phase Framework Rewrite

## Context

Plan review of `/home/kazzarah/dev/orchestration/refactor-proposal.md` — a 6-phase refactor replacing the Superpowers agent/skill/plugin architecture with a modular system on a `dev` branch. No backward compatibility required during development. Reviewing the plan before execution begins.

## Severity Summary

| Severity | Count | Criteria |
|----------|-------|----------|
| **CRITICAL** | 2 | Must fix before proceeding — plan has fundamental flaws that would cause failure |
| **HIGH** | 6 | Should fix — will cause problems during execution if not addressed |
| **MEDIUM** | 8 | Worth fixing — notable but not urgent |
| **LOW** | 3 | Style/preference — optional |
| **INFO** | 2 | Observations, not actionable |

---

## Critical Issues

### CRITICAL 1: Embedding skills into agent files that don't exist yet — Phase 2 vs Phase 3 sequencing gap

**Location:** Phase 2, Steps 2.13–2.18 (embedding section)

**Problem:** Steps 2.13–2.18 say "Inline into [Agent]'s system prompt body" and "Delete `src/skills/<name>/` after embedding." But the target agent files — `src/agents/orchestrate.md`, `src/agents/design.md`, `src/agents/plan.md` — are not created until Phase 3 (Steps 3.1–3.3). There is no intermediate storage mechanism specified.

For example:
- Step 2.13: "Extract content from `src/skills/brainstorming/SKILL.md`. Inline into the Design agent's system prompt body." → Design agent (`src/agents/design.md`) does not exist until Phase 3.2.
- Step 2.15: "Embed `finishing-a-development-branch` into Orchestrate" → Orchestrate agent (`src/agents/orchestrate.md`) does not exist until Phase 3.1.
- Step 2.21 lists `src/skills/brainstorming/` → "embedded into Design" and schedules deletion in Phase 2. If the skill is deleted before the agent is created, the content is lost.

**Impact:** An implementer following the plan sequentially would attempt to inline content into nonexistent files, or would delete skill directories before the agent files are created in Phase 3, losing the embedded content entirely.

**Suggestion:** Resolve by one of:
- **Option A:** Move all embedding steps (2.13–2.18) into Phase 3, merging them with the corresponding agent creation steps (3.1–3.3). This is the cleanest fix.
- **Option B:** Add intermediate extraction steps that write the skill content to temp files (e.g., `src/.embedded-content/design-brainstorming.md`) in Phase 2, then reference those temp files during agent creation in Phase 3. Update deletion schedules accordingly.
- **Option C:** Restructure phases so that Phase 3 (Agents) runs BEFORE Phase 2 (Skills), but this creates a worse ordering problem (agents would reference skills that don't exist yet).

Recommend Option A — merge embedding with agent creation. This is also simpler for the implementer.

### CRITICAL 2: Install.sh file path is incorrect — references `src/install.sh` but file is at repo root; `.docs/` install logic installs to wrong location

**Location:** Phase 5.4 — Update `install.sh`

**Problem:** The plan says "File: `src/install.sh`" and shows modifications to it. But `install.sh` lives at the repo root (`/home/kazzarah/dev/orchestration/install.sh`), not in `src/`. If the implementer follows the plan literally and edits `src/install.sh`, they'll create a new file that never gets executed, while the real install script at the root remains unmodified.

Additionally, the proposed `.docs/` installation logic has a path error:
```bash
if [ -d "../.docs" ]; then
  mkdir -p "$CONFIG_DIR/.."
  cp -r "../.docs" "$CONFIG_DIR/.."
fi
```
- `$CONFIG_DIR` resolves to `~/.config/opencode/`
- `$CONFIG_DIR/..` resolves to `~/.config/`
- `cp -r "../.docs" "$CONFIG_DIR/.."` copies `.docs/` to `~/.config/.docs/`

But `.docs/` is a **project-level** directory (repo root), not a global config directory. Installing it to `~/.config/.docs/` doesn't serve any documented purpose. The templates belong either at the project level (not installed globally) or inside `~/.config/opencode/docs/`.

**Impact:** Either a new `src/install.sh` is created and the real script is untouched (broken install), or the script copies `.docs/` to the wrong global location where agents won't find it.

**Suggestion:** 
1. Change file reference from `src/install.sh` to `install.sh` (repo root).
2. Clarify where `.docs/` templates should live after install. Options:
   - Keep `.docs/` as project-level only (not installed — agents reference it relative to project root). 
   - Install `.docs/` templates into `~/.config/opencode/docs/` alongside other templates.
   - Add both: install templates to config dir AND keep project-level `.docs/` for per-project use, with clear documentation on which takes precedence.

---

## High Issues

### HIGH 1: Contradiction — `use-git` listed as autoinjected in config, but as on-demand in dependency map

**Location:** Phase 1.2 (opencode.jsonc template) vs Final Dependency Map table

**Problem:** The `opencode.jsonc` template (Phase 1.2) includes `"use-git"` in the autoinjection array:
```jsonc
"skill-autoinjection": [
    "optimize-tokens",
    "use-todo",
    "use-git"
]
```

But the Skill-to-Agent Dependency Map at the bottom of the document lists `use-git` as:
- **Type:** On-demand
- **Consumers:** Orchestrate, Build
- **Mechanism:** loaded via skill tool when needed

If `use-git` is autoinjected, it loads into ALL agents' system prompts, which contradicts "On-demand" and wastes tokens on agents that don't need git instructions (Critique, Review, Design, Plan, Research, Dogfood). If it's on-demand, it shouldn't be in the autoinjection list.

**Impact:** Either all agents get unnecessary git instructions (~200+ tokens each), or the autoinjection list is wrong and `use-git` won't be available to agents that need it (if they don't know to load it themselves).

**Suggestion:** Pick one model and make it consistent:
- If `use-git` is genuinely on-demand, remove it from the autoinjection array and ensure Orchestrate and Build agent definitions include instructions to load it when needed.
- If `use-git` should be autoinjected for all agents (because all agents might do git work), update the dependency map to reflect that.

### HIGH 2: Plugin timing migration has no verification method

**Location:** Phase 1.1, Step 1.1.6 (Timing note) and Phase 1.3 (Verify)

**Problem:** The `skill-autoinjection` plugin migrates from `experimental.chat.messages.transform` (fires every agent step, injects into user messages) to `experimental.chat.system.transform` (fires at session start/agent switch, injects into system prompts). The plan says:

> "verify nothing downstream depends on the old per-turn injection timing."

But there is no verification step that tests this. Phase 1.3's verification covers:
- Plugin loads
- Skills are injected
- Per-agent overrides work
- Missing skills produce warning
- goal.ts coexistence

None of these verify that existing agent behaviors don't depend on the old injection timing. Since this is a `dev` branch rewrite with no backward compatibility guarantee, this is survivable — but the plan claims it will verify this and provides no method.

**Impact:** If the old timing was a dependency (e.g., an agent expected to see the user message with the skill content before processing its first instruction), the migration could silently break that agent's behavior. This wouldn't be caught until the smoke test (Phase 5.9), which only verifies the plugin loads and skills appear — not that downstream logic is unaffected.

**Suggestion:** Either:
- Remove the verification claim ("verify nothing downstream depends...") since it's not actionable, and acknowledge the timing change as a clean break, OR
- Add concrete verification: start a session, send a task that requires an autoinjected skill (e.g., `use-todo` for a multi-step task), and confirm the agent behaves as expected from turn 1 without requiring a user message to trigger injection.

### HIGH 3: Supporting files in deleted skills are not addressed — content loss risk

**Location:** Phase 2, Steps 2.13–2.21

**Problem:** Several skills being deleted or replaced have supporting files beyond `SKILL.md` that are not mentioned in the plan:

| Skill Directory | Files Beyond SKILL.md | Planned Action | Risk |
|----------------|----------------------|----------------|------|
| `brainstorming/` | `scripts/`, `spec-document-reviewer-prompt.md`, `visual-companion.md` | "Delete after embedding" (Step 2.13) | Supporting files silently lost |
| `writing-skills/` | `render-graphs.js`, `examples/`, `anthropic-best-practices.md`, `graphviz-conventions.dot`, `persuasion-principles.md`, `testing-skills-with-subagents.md` | Replaced by `create-skill` (Step 2.5) | Supporting files may contain useful patterns for new skill |
| `subagent-driven-development/` | `implementer-prompt.md`, `task-reviewer-prompt.md` | Keep `scripts/` only (Step 2.18) | Other supporting files not mentioned — may need preservation |

**Impact:** If the Design agent, Create-skill skill, or Orchestrate agent reference any of these supporting files, those references break. Even if they don't, the files contain institutional knowledge that should be migrated or at least archived.

**Suggestion:** For each deleted/replaced skill, explicitly list all files and their disposition:
- Migrate into new skill or agent
- Archive to `.docs/archive/`
- Delete intentionally
- The plan should include a quick scan: `for dir in src/skills/*/; do count=$(find "$dir" -mindepth 1 -maxdepth 1 | wc -l); if [ "$count" -gt 1 ]; then echo "$dir: $(ls "$dir")"; fi; done`

### HIGH 4: Orchestrate agent instructions reference `.docs/reports/` path that doesn't exist until Phase 4

**Location:** Phase 3.1 — Orchestrate agent, "Report handling (inline)" block

**Problem:** The Orchestrate agent definition (created in Phase 3.1) contains inline instructions:
> "After dispatching any subagent that produces a report (Critique, Review, Dogfood, Research), read the report from `.docs/reports/` — the file on disk is the authoritative record."

But `.docs/` directory and its subdirectories aren't created until Phase 4 (Paper Trail Setup). Between Phase 3.1 and Phase 4, if the Orchestrate agent were tested, it would reference a nonexistent path. In production (after the full build), this is fine, but it creates a window where the agent instructions reference something that doesn't exist yet.

**Impact:** If any intermediate testing or debugging references `.docs/reports/`, it fails with a path error. More importantly, the path resolution from the agent's working directory context may not be the repo root — `.docs/reports/` is a relative path that depends on where OpenCode is running.

**Suggestion:** Either:
- Move Phase 4 before Phase 3 (creating `.docs/` before agents that reference it), OR
- Add a note in Phase 3 that `.docs/` resolution is relative to the project root, and Phase 4 must complete before the agent is usable.

### HIGH 5: Cross-reference audit scope limited to `src/` but needs to cover `.docs/` and embedded agent content

**Location:** Phase 5.5 — Cross-reference audit

**Problem:** The grep commands in Phase 5.5 only scan `src/`:
```bash
grep -rn "...pattern..." src/ --include="*.md" --include="*.js"
```

But after Phase 3 (agent creation with embedded skill content) and Phase 4 (template creation), there are active artifacts in:
- `.docs/designs/` (not created yet but will contain agent-produced content)
- `.docs/plans/` (templates)
- `.docs/reports/` (templates)

If the new templates reference old skill names or old agent names, they need updating too. More importantly, the **embedded skill content inside agent definitions** (`src/agents/orchestrate.md`, `src/agents/design.md`, `src/agents/plan.md`) may contain old cross-references (the SDD skill body references `superpowers:` prefixes throughout). These would NOT be caught by the `src/` scan since they're skill content, but they'd be missed because they're now inside agent files.

**Impact:** Stale references like `superpowers:using-git-worktrees`, `superpowers:finishing-a-development-branch`, `superpowers:executing-plans` would survive inside embedded agent content.

**Suggestion:** Expand the audit scope:
- Add scans for `.docs/` patterns: `grep -rn "...pattern..." .docs/ --include="*.md"`
- Add scans for old `superpowers:` prefixed references in agent files: `grep -rn 'superpowers:' src/agents/ --include="*.md"`
- Scan the embedded content inside agent definitions for cross-references to deleted/renamed skills

### HIGH 6: SDD skill references `superpowers:` namespace conventions throughout — embedded version will contain stale references

**Location:** Phase 2.18 (embed SDD into Orchestrate) and SDD SKILL.md (lines ~408-417)

**Problem:** The SDD SKILL.md contains multiple references to `superpowers:using-git-worktrees`, `superpowers:writing-plans`, `superpowers:finishing-a-development-branch`, `superpowers:executing-plans`, `superpowers:test-driven-development`. These use the old `superpowers:` namespace prefix and reference skills that are being renamed, embedded, or dropped.

When this content is embedded into the Orchestrate agent verbatim (Step 2.18), these stale references become part of the Orchestrate agent's system prompt. The cross-reference audit in Phase 5.5 will not catch these because its grep patterns don't search for `superpowers:` prefixes.

**Impact:** When deployed, the Orchestrate agent would instruct subagents to load skills that don't exist (wrong names, wrong namespace), causing skill-load failures.

**Suggestion:** During embedding (whether in Phase 2 or Phase 3, per the CRITICAL 1 fix), replace all `superpowers:` prefixed skill references with their new names. Add the specific replacements to the plan:
- `superpowers:using-git-worktrees` → `use-git`
- `superpowers:writing-plans` → (embedded in Plan agent)
- `superpowers:finishing-a-development-branch` → (embedded in Orchestrate)
- `superpowers:executing-plans` → (dropped — update reference to SDD itself)
- `superpowers:test-driven-development` → `test-driven-development`
- `superpowers:writing-skills` → `create-skill`

---

## Medium Issues

### MEDIUM 1: Template content is unspecified — Phase 4.2 creates empty files

**Location:** Phase 4.2 — Create report templates

**Problem:** The plan lists 6 template files to create (.docs/designs/TEMPLATE.md, .docs/plans/TEMPLATE.md, etc.) but provides no content, structure, or reference for any of them. During implementation, the implementer must either invent template content, leave them empty (defeating their purpose), or make an arbitrary choice.

**Impact:** Templates are either inconsistently created (different implementers, different quality) or created as empty files that provide no value. Either way, the agents that reference these templates during report generation get no guidance.

**Suggestion:** The plan should either:
- Specify the minimum structure for each template (required sections, example header), OR
- Reference existing conventions from the current `src/docs/` structure to extract template patterns, OR
- Defer template content creation to the Design agent (have it define template formats), OR
- If templates are intentionally left as implementer discretion, say so explicitly: "Create stub TEMPLATE.md files — content will be refined during use."

### MEDIUM 2: superpowers.js deletion specified in two different phases

**Location:** Phase 1.1 Step 7 ("Delete `src/plugins/superpowers.js` after this step") AND Phase 5.2 ("Delete removed plugins: src/plugins/superpowers.js")

**Problem:** The deletion of `superpowers.js` appears twice — once during Phase 1 (plugin creation) and again during Phase 5 (cleanup). This is redundant and creates a timing ambiguity. If the file was already deleted in Phase 1, Phase 5.2 would fail (file not found). If it's deferred to Phase 5, Phase 1's "after this step" instruction is misleading.

**Impact:** Confusion during execution — does the implementer delete it in Phase 1 (the logical time, since the replacement exists) or wait until Phase 5? If they delete in Phase 1 and move on, Phase 5.2's redundant instruction breaks the sequential flow.

**Suggestion:** Remove the duplicate. Keep the deletion in Phase 5.2 (the dedicated cleanup phase) and change Phase 1.1 Step 7 from "Delete" to "Document that superpowers.js is replaced — actual deletion in Phase 5.2."

### MEDIUM 3: Duplicate dogfood.md update instruction

**Location:** Step 2.4 (use-tmux creation) AND Step 3.8 (Dogfood agent update)

**Problem:** Both steps say to update dogfood.md to reference `use-tmux` instead of inline commands:
- Step 2.4: "After creation, update dogfood.md to reference this skill instead of containing commands inline."
- Step 3.8: "After Step 2.4 (use-tmux skill created), replace inline tmux reference tables with a reference to the skill."

This is the same change referenced in two places. If the implementer does it in Step 2.4, it's done. If they follow the plan literally and try to do it again in Step 3.8, they'd either redo completed work or skip it (creating a moment of uncertainty).

**Suggestion:** Consolidate into one location — keep it in Step 3.8 (when the agent is actually being updated) and remove it from Step 2.4. Or keep it in Step 2.4 (when the skill's creation makes the update possible) and note in Step 3.8 that the update was already done.

### MEDIUM 4: Root `docs/` symlink not addressed in archive/deletion steps

**Location:** Phase 5.3 — Archive and delete old docs

**Problem:** The repo has a `docs/` symlink at the root (pointing to `src/docs/`, per AGENTS.md line 22). Phase 5.3 archives `src/docs/` to `.docs/archive/` and deletes `src/docs/`. But:

1. The root `docs/` symlink would become a dangling symlink after `src/docs/` is deleted.
2. The README.md (updated in Phase 5.8) references `docs/ → src/docs` — this may need updating if the symlink is removed.

**Impact:** A dangling symlink at the repo root that either needs to be cleaned up or will cause confusion.

**Suggestion:** Add explicit handling for the root `docs/` symlink:
- Option A: Delete the root `docs/` symlink after archiving `src/docs/`.
- Option B: Leave the symlink but document it as a dangling reference until cleanup.
- Include this in the cross-reference audit (Phase 5.5) and README update (Phase 5.8).

### MEDIUM 5: Phase 5.6 leaves "Two-stage review" decision unresolved

**Location:** Phase 5.6 — Update src/AGENTS.md, "Two-stage review rule"

**Problem:** The plan says:
> "Two-stage review rule (current line 28): explicitly address. Either update to 'Single integrated review gate (whole-branch) combining spec compliance and code quality' or keep existing rule for per-task SDD reviews and clarify that whole-branch review is a separate, combined pass."

This presents an undecided design choice with two options and no recommendation. The implementer must make a design decision about the review workflow architecture, which should have been resolved at the spec/plan level, not left as a TODO during implementation.

**Impact:** The implementer either makes a decision without full context (leading to suboptimal architecture), or escalates (blocking the cleanup phase).

**Suggestion:** Resolve this choice in the plan before execution. The rest of the plan implies the two-tier model (per-task lightweight review + whole-branch formal Review Gate), which suggests keeping the two-stage rule is the correct path. Make that explicit.

### MEDIUM 6: Existing `src/docs/` content has no migration path beyond archival

**Location:** Phase 5.3 — Archive and delete old docs

**Problem:** The plan archives `src/docs/` to `.docs/archive/` but existing content like `src/docs/plans/2026-06-28-docs-restructure.md` and `src/docs/plans/design-2026-06-30-workflow-todo-enforcement.md` contain design decisions and rationale for the current architecture. There's no step to review these for:
- Decisions that are being carried forward (document them in the new system)
- Decisions being reversed (acknowledge the reversal)
- Cross-references to old paths or agent names that should be noted

**Impact:** Historical design context is archived but not surfaced. Future agents referencing `.docs/archive/` may not know to look there.

**Suggestion:** Add a lightweight scan step (or delegate to Research agent) to extract any decisions, constraints, or references from the archived content that should be explicitly carried forward or reversed in the new system.

### MEDIUM 7: Build agent tool permissions — replacement of `implement.md` omits `webfetch`/`websearch`

**Location:** Phase 3.4 — Build Agent permissions

**Problem:** The current `implement.md` (lines 34-35) explicitly denies `webfetch` and `websearch`:
```yaml
webfetch: deny
websearch: deny
```

The new Build agent description doesn't mention `webfetch` or `websearch` in its permissions. If OpenCode defaults to allow, this is a permissions expansion (Build would gain web access). If defaults to deny, Build would silently lack tools that agents expect. The plan should be explicit.

Additionally, the current `implement.md` may have other permission settings (color, description constraints) that the Build agent's Phase 3.4 description doesn't explicitly replicate.

**Impact:** Silent permission drift — Build could have different capabilities than the implement.md it replaces, either expanding attack surface or breaking expected workflows.

**Suggestion:** The Build agent permissions block should explicitly state deny/allow for ALL common tools, not just the ones being changed. At minimum, note whether `webfetch` and `websearch` are allowed.

### MEDIUM 8: `commands/` directory referenced but its contents/state unclear

**Location:** Phase 5.4 — install.sh update, commands item kept

**Problem:** The install.sh change keeps `"commands"` in the items array, with the note "currently empty `.gitkeep` — no-op but harmless." But the Phase 5.9 smoke test doesn't verify the `commands/` directory exists after install. If the refactor creates other contents in `commands/` or changes its role (which isn't described), the install step might miss it.

**Impact:** Minor — could skip installing command files if they exist. The `commands/` role in the new architecture is undefined.

**Suggestion:** Either define what `commands/` is for in the new architecture (even if it's "future use, empty for now"), or remove it from the install items if it's truly vestigial.

---

## Low Issues

### LOW 1: Phase starting checkpoint commits have inconsistent naming conventions

**Location:** All Phase checkpoint commits

**Problem:** Checkpoint commits use different patterns:
- Phase 0: `"chore: baseline before refactor"` (no phase prefix)
- Phase 1: `"phase-1: pre-plugin checkpoint"`
- Phase 2: `"phase-2: pre-skills checkpoint"`
- Phase 3: `"phase-3: pre-agents checkpoint"`
- Phase 4: `"phase-4: pre-paper-trail checkpoint"`
- Phase 5: `"phase-5: pre-cleanup checkpoint"`

Phase 0's checkpoint doesn't follow the `phase-N:` prefix pattern. This is minor but inconsistent for rollback parsing.

**Suggestion:** Standardize all checkpoint messages to follow the same format, e.g., `"phase-N: checkpoint before <step>"`.

### LOW 2: No mention of `.gitkeep` file after old directories are deleted

**Location:** Phase 2 cleanup (2.19–2.21)

**Problem:** After deleting entire skill directories (`executing-plans/`, `using-superpowers/`), the `src/skills/` directory may contain leftover `.gitkeep` files or the deleted directories may have had their own `.gitkeep` files. Not mentioned.

**Suggestion:** No action needed — git handles this naturally. Just noting for awareness.

### LOW 3: Rollback procedure describes checkpoint commits but doesn't specify how to handle Phase 4+5 combined state

**Location:** Rollback Procedure section

**Problem:** The rollback procedure says `git reset --hard` to phase-start checkpoint. But Phase 4 creates `.docs/` at repo root, and Phase 5 modifies `install.sh` at repo root and `src/AGENTS.md`, `src/CLAUDE.md` under `src/`. If a rollback is needed during Phase 5, the git reset would need to cover both tracked files in `src/` and newly created `.docs/` files. Git reset handles tracked files correctly, but newly created files (like `.docs/` templates before they're committed) would need explicit cleanup.

**Suggestion:** Wrap the rollback note: "For untracked created directories (`.docs/`, etc.), `rm -rf` them after reset."

---

## Info

### INFO 1: Existing `systematic-debugging` skill has extensive supporting files (11 total) — may need update

**Location:** Phase 2.11 — Kept skills

**Observation:** The `systematic-debugging` skill directory at `src/skills/systematic-debugging/` contains 11 items (SKILL.md, 9 supporting files including test scenarios, scripts, and detailed reference docs). The plan says "Changes: None — content is stable." But some of these supporting files may reference old paths or agent names if they include usage instructions. Not blocking but worth a quick grep: `grep -rn "develop\|implement\|superpowers:" src/skills/systematic-debugging/`.

### INFO 2: Plan uses "Phase 4: Finish" as both a build phase (original Phase 4 in lifecycle table) and a reference in Final Gate Sequence

**Location:** Final Gate Sequence section (line 734)

**Observation:** The Final Gate Sequence says "Phase 4: Finish — user chooses merge/PR/keep/discard." But Phase 4 in the build plan is "Paper Trail Setup." The lifecycle table's R4 phase is labeled "Finish." These are different "Phase 4" references that could cause confusion. The lifecycle uses "R" prefix (R0-R4) to distinguish from build phases, which mostly avoids the conflict, but the Final Gate Sequence section doesn't use the "R" prefix.

---

## Positive Notes

1. **Checkpoint commit discipline is excellent.** Each phase starts with a checkpoint that enables clean rollback without losing partial progress. This is the most important structural safeguard in a complex multi-phase plan.

2. **Gate architecture is well-defined.** The Critique Gate, Review Gate, and Dogfood Gate have clear inputs, outputs, iteration limits, and convergence caps. The distinction between pre-implementation review (Critique) and post-implementation review (Review) is sound.

3. **The dependency map table is valuable.** The Skill-to-Agent Dependency Map provides a single source of truth for who-uses-what, making it easy to verify coverage.

4. **The plan correctly identifies the timing difference** between `messages.transform` and `system.transform` hooks and flags it for attention — even though the verification method needs work, the awareness of the issue is good.

5. **Build agent's `task: deny` with escalation pattern is the right choice.** Prohibiting subagent spawning during implementation and forcing escalation for unknown domains prevents the common failure mode of agents hallucinating unfamiliar APIs.

6. **Phase 5.5's grep commands are comprehensive** and provide a clear automated check for stale references. Expanding their scope (per HIGH 5) would make them bulletproof.

---

## Overall Assessment

**🟡 YELLOW — Conditionally ready to proceed after fixing CRITICAL issues**

The plan is structurally sound with good discipline around checkpoints, gates, and rollback procedures. It correctly identifies the major components that need to change and their relationships.

However, the two CRITICAL issues — the Phase 2→3 sequencing gap for skill embedding, and the install.sh file path/destination errors — must be fixed before execution. The former will cause the implementer to hit a dead end (inlining content into nonexistent files), and the latter will result in an install script that either doesn't run or installs files to the wrong location.

The HIGH issues are concentrated around completeness gaps: supporting files that would be silently lost, stale cross-references in embedded content, and verification claims without verification methods. These will cause problems that surface late in the build (Phase 5 or later), when they're most expensive to fix.

**Recommended actions before proceeding:**
1. Resolve the embedding sequencing (either merge into Phase 3 or add intermediate extraction)
2. Fix the install.sh file path and `.docs/` install destination
3. Resolve the `use-git` autoinjection contradiction
4. Add supporting-file disposition for each deleted/replaced skill
5. Decide on the two-stage review rule (don't leave it as a TODO)

The plan's strengths (checkpoint discipline, gate architecture, dependency tracking) mean that once these issues are resolved, execution should be straightforward with rollback safety.
