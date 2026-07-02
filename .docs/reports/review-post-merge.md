# Post-Merge Review: Framework Refactor

> **Review date:** 2026-07-02
> **Merge commit:** `1778de3`
> **Branch merged:** `dev` into `master`
> **Previous reviews:** 2 rounds of whole-branch review completed before merge

## Summary

The refactor was broadly successful: `develop.md` → `orchestrate.md`, `implement.md` → `build.md`, new `design.md` and `plan.md` agents created, `skill-autoinjection.js` replaces `superpowers.js`, skills renamed and reorganized, docs moved to `.docs/`, CI templates added. The two rounds of prereview caught the most critical issues (stale `superpowers:` namespace references, broken file references, stale agent type references), and the branch was merged after all CRITICAL and IMPORTANT findings were resolved.

However, several issues survived the review gates — some were classified as Minor (and legitimately waived for merge) but compound into real problems in production use. Others appear to be regressions or oversights in the merge itself.

**Overall verdict: YELLOW** — Functionally complete and mergable, but several issues need attention before production use.

---

## Per-Artifact Assessment

| Artifact | Status | Key Finding |
|----------|--------|-------------|
| **Agent definitions** | ✅ Good | Clean frontmatter, proper permissions, well-structured. `orchestrate.md` is excellent. |
| **Plugin code** (`skill-autoinjection.js`) | ✅ Excellent | Complete, well-tested (391-line test file), handles all edge cases (dedup, missing files, folded YAML, HTML escaping, per-agent overrides). |
| **Plugin test** (`test-skill-autoinjection.mjs`) | ✅ Excellent | Comprehensive coverage of 13 test scenarios including edge cases. |
| **Skills (frontmatter, content)** | ⚠️ Mixed | Content is correct and comprehensive, but word counts massively exceed targets in AGENTS.md. |
| **Config** (`opencode.jsonc`) | ❌ Issues | Plugin path is wrong after install; potential config key mismatch. |
| **install.sh** | ✅ Correct | Items array correctly updated. No syntax issues. |
| **Root AGENTS.md / CLAUDE.md** | ❌ Stale | Still reference `develop.md` and `superpowers.js`. Minor waiving was premature. |
| **README.md** | ✅ Updated | Correctly references `orchestrate.md`, `skill-autoinjection.js`, `.docs/`. |
| **src/AGENTS.md / src/CLAUDE.md** | ✅ Updated | Clean, correct references. |
| **Orphaned artifacts** | ❌ Issues | `src/docs/` still exists, was not archived/deleted. |

---

## Issues

### CRITICAL (Must Fix)

#### C1. Root AGENTS.md and CLAUDE.md still reference `develop.md` and `superpowers.js`
- **Files:** `AGENTS.md:50`, `CLAUDE.md:50`, `AGENTS.md:54`, `CLAUDE.md:54`
- **What:** Both files say *"The `src/agents/develop.md` primary agent is the main entry point for all development work"* (line 50) and *"`src/plugins/superpowers.js` — OpenCode plugin that injects..."* (line 54).
- **Why it matters:** These two files are the FIRST thing AI agents read when working in this repo. They tell agents to use an agent (`develop.md`) and a plugin (`superpowers.js`) that no longer exist. Agents following these instructions will fail immediately.
- **Note:** This was flagged as Minor in round 2 review and waived for merge. It should not have been waived — it directly breaks agent behavior in this repo.
- **Fix:** `develop.md` → `orchestrate.md`. `superpowers.js` → `skill-autoinjection.js`. Update paths to `.docs/rules/` from `docs/rules/`.

#### C2. `opencode.jsonc` plugin path resolves incorrectly after install
- **File:** `src/opencode.jsonc:3`
- **What:** Plugin path is `"src/plugins/skill-autoinjection.js"`. After `install.sh` copies `src/opencode.jsonc` → `~/.config/opencode/opencode.jsonc` and `src/plugins/` → `~/.config/opencode/plugins/`, the path resolves to `~/.config/opencode/src/plugins/skill-autoinjection.js` (relative to config file), which does not exist.
- **Why it matters:** The plugin will not load from the installed config. The user either gets no skill autoinjection or must manually edit the path.
- **Fix:** Change path to `"plugins/skill-autoinjection.js"` or `"./plugins/skill-autoinjection.js"`.

#### C3. `src/docs/` still exists — never archived and deleted
- **Files:** `src/docs/` directory with `plans/` and `review/` subdirectories
- **What:** Phase 5.3 specified archiving `src/docs/` to `.docs/archive/` then deleting it. The `.docs/archive/src-docs/` directory was created with only the OLD content (from before the refactor started). But NEW content created during the refactor (`design-2026-06-30-workflow-todo-enforcement.md`, `critique-2026-06-30-*.md`) was never archived, and `src/docs/` itself was never deleted.
- **Why it matters:** Two canonical doc locations now exist (`src/docs/` and `.docs/`). New reports go to `.docs/` (correct), but old content lives in both places. Stale paths may confuse agents and users.
- **Fix:** Either archive `src/docs/` content to `.docs/archive/src-docs/` and delete `src/docs/`, or if the new content is still useful, move it to `.docs/` appropriate subdirs and delete `src/docs/`.

#### C4. SDD workspace path still uses `.superpowers/` instead of `.opencode/`
- **Files:** 
  - `src/skills/subagent-driven-development/scripts/sdd-workspace:19` → `dir="$root/.superpowers/sdd"`
  - `src/skills/subagent-driven-development/scripts/task-brief:7` → comment says `.superpowers/sdd/`
  - `src/skills/subagent-driven-development/scripts/review-package:8` → comment says `.superpowers/sdd/`
  - `src/agents/orchestrate.md:188,197` → references `.superpowers/sdd/`
- **What:** The refactor plan said the SDD artifact directory should migrate from `.superpowers/sdd/` to `.opencode/sdd/`. The scripts still use `.superpowers/sdd/` as the actual workspace path (sdd-workspace line 19). The orchestrate agent documents it as `.superpowers/sdd/`.
- **Why it matters:** `.superpowers/` is a legacy namespace from the old framework. Creates confusion about which artifact directory is canonical. The `.gitignore` has `.superpowers/` listed, so the old path works — but it's inconsistent with the rest of the refactor's naming choices.
- **Fix:** Update `sdd-workspace` to use `.opencode/sdd/`, update comments in `task-brief` and `review-package`, update references in `orchestrate.md`. Also add `.opencode/` to `.gitignore` if not already present (it already is).

### IMPORTANT (Should Fix)

#### I1. Skill word counts massively exceed AGENTS.md targets
The `AGENTS.md` specifies clear word-count targets:
> - Skills loaded on every turn: **< 200 words**
> - Other skills: **< 500 words**

Measured body-only word counts (excluding YAML frontmatter):

| Skill | Body Words | Target | Status |
|-------|-----------|--------|--------|
| `create-rule` | 3,739 | <500 | ❌ 7.5× over |
| `create-skill` | 3,713 | <500 | ❌ 7.4× over |
| `create-plugin` | 3,489 | <500 | ❌ 7× over |
| `create-agent` | 2,925 | <500 | ❌ 5.8× over |
| `optimize-tokens` | 1,628 | **<200** (autoinjected!) | ❌ 8× over |
| `systematic-debugging` | 1,486 | <500 | ❌ 3× over |
| `test-driven-development` | 1,480 | <500 | ❌ 3× over |
| `consider-feedback` | 1,102 | <500 | ❌ 2.2× over |
| `verification-before-completion` | 630 | <500 | ❌ 1.3× over |
| `use-git` | 479 | <500 | ✅ Under (was trimmed in round 2) |
| `use-tmux` | 398 | <500 | ✅ Under |
| `use-todo` | 91 | **<200** (autoinjected!) | ✅ Under |

- **Why it matters:** The word-target guidelines exist for a reason. Autoinjected skills load into every agent turn. `optimize-tokens` at 1,628 words adds ~2,000 tokens per turn (with frontmatter + wrapper). That is a real cost. For on-demand skills, the overhead is per-load, not per-turn — but 3,700 words is well beyond "reference" territory.
- **Note:** These word counts are not necessarily wrong (the content is valuable) but they contradict the documented targets. Two options: (a) tighten the skills, or (b) update the targets in AGENTS.md to reflect reality. Either choice is valid — but the contradiction itself is a problem.

#### I2. `superpowers-agent:` HTML comments survive in 3 agent files
- **Files:**
  - `src/agents/critique.md:30` → `<!-- superpowers-agent: critique v1 -->`
  - `src/agents/dogfood.md:79` → `<!-- superpowers-agent: dogfood v1 -->`
  - `src/agents/research.md:99` → `<!-- superpowers-agent: research v1 -->`
- **What:** HTML comments in markdown referencing the old `superpowers-agent:` naming scheme. These are invisible in rendered output but visible in source. They represent a versioning/naming convention from the old framework that was not cleaned up.
- **Why it matters:** Not visible to users, but visible to developers and agents reading the raw files. Stale naming in comments can cause confusion during maintenance. Minor individually, but the pattern suggests incomplete cleanup.

#### I3. `src/docs/` content may have value — should not be lost
- **What:** The files in `src/docs/plans/` and `src/docs/review/` contain design work and critique reports related to the `workflow-todo-enforcement` feature that was part of the refactor. These were created during the dev branch work but never archived.
- **Why it matters:** If these documents have ongoing value (design decisions, critique findings about plugin behavior), they should be preserved in `.docs/archive/`. If they were superseded by the refactor and have no ongoing value, they should be deleted. Currently they're in limbo.

#### I4. Orchestrate agent references `scripts/` without accessible path
- **File:** `src/agents/orchestrate.md:186-188`
- **What:** Orchestrate references SDD scripts as `scripts/task-brief`, `scripts/review-package`, `scripts/sdd-workspace`. These scripts live at `src/skills/subagent-driven-development/scripts/` — not at a top-level `scripts/` directory.
- **Why it matters:** When an agent working from a worktree tries to run `scripts/task-brief`, the command will fail because `scripts/` doesn't exist at the worktree root. The agent must either know the full path or have the scripts installed.
- **Fix:** Add a note in the orchestrate definition clarifying the script location, or add an install step that makes them available in PATH or copies them to a known location.

#### I5. `opencode.jsonc` uses `"plugins"` (plural) — may be ignored
- **File:** `src/opencode.jsonc:2`
- **What:** The config key is `"plugins"` (plural array). The `create-plugin` skill documents the key as `"plugin"` (singular). If OpenCode expects `"plugin"`, the entire plugins array is silently ignored.
- **Why it matters:** If the key is wrong, the plugin never loads, skill autoinjection doesn't happen, and the agent operates without the `optimize-tokens` and `use-todo` skills it expects to have.
- **Fix:** Verify the correct OpenCode config key for plugins. If it's `"plugin"` (singular), update `src/opencode.jsonc`. If `"plugins"` (plural) is also supported, confirm and document it.

### MINOR (Nice to Have)

#### M1. `subagent-driven-development/` directory still has prompt files but no SKILL.md
- **Directory:** `src/skills/subagent-driven-development/`
- **What:** The directory contains `implementer-prompt.md` and `task-reviewer-prompt.md` (reference templates), and `scripts/`. The SKILL.md was deleted after embedding into the Orchestrate agent (per plan). The directory name suggests it's a skill but no SKILL.md exists — this could confuse discovery.
- **Fix:** If the prompts are active references, consider moving them to a `prompts/` or `templates/` namespace. If they're historical only, move to `.docs/archive/`. Either way, the README's skill-dependency chain reference to `subagent-driven-development` should be checked.

#### M2. `extras/rules/` contains orphaned rule files
- **Directory:** `extras/rules/` with `code-documentation.md`, `naming-conventions.md`, `python-paradigm.md`
- **What:** Three rule files exist in an `extras/` directory that is not referenced by any install path or docs convention. They may be valuable project-level rules that should be in `.docs/rules/`.
- **Fix:** Either move useful rules to `.docs/rules/` (where agents will find them) or delete the directory.

#### M3. `test-skill-autoinjection.mjs` not integrated into any test runner
- **File:** `test-skill-autoinjection.mjs` (repo root)
- **What:** A 391-line comprehensive test file for the plugin. Excellent content — but there's no test runner config or `package.json` that would execute it. It's a standalone file that must be run manually with `node`.
- **Fix:** Either add a `package.json` with a test script (`node test-skill-autoinjection.mjs`), or add a comment in the file header noting how to run it.

---

## Recommendations

1. **Fix the root AGENTS.md/CLAUDE.md first** — this is the most impactful issue because it misdirects every AI agent entering this repo.
2. **Fix the opencode.jsonc plugin path** — without it, the skill autoinjection system doesn't work after installation.
3. **Either clean up or legitimize word-count targets** — the current state has documented guidelines that are violated by almost every skill. Either tighten the skills or update the guidelines.
4. **Resolve the `src/docs/` orphan** — three states possible: delete if valueless, archive to `.docs/archive/` if historical, or move to `.docs/` proper if active.
5. **Audit SDD workspace path migration** — the `.superpowers/ → .opencode/` rename was planned but not executed in the build scripts.
6. **Add a `package.json` with test script** — the plugin test is too good to remain invisible.

---

## Overall Verdict

**YELLOW** — Ready for use with important caveats.

**Reasoning:** The core architecture is sound. The agent lifecycle, plugin infrastructure, skill structure, and doc organization are all correct and well-implemented. The `skill-autoinjection.js` plugin is production-quality with thorough testing. The orchestrate agent's 403-line lifecycle definition is comprehensive and well-structured.

However, four CRITICAL issues were missed by the review gates: (1) root AGENTS.md/CLAUDE.md directing agents to deleted files, (2) opencode.jsonc plugin path breaking after install, (3) unarchived `src/docs/` creating two canonical doc locations, and (4) unmigrated `.superpowers/` paths breaking the namespace cleanup. The word-count guideline violations in skills (IMPORTANT) create a documented-versus-actual gap that erodes the guidelines' authority.

The round 2 review classified the AGENTS.md issue as Minor and waived it for merge — this was a mis-calibration. A file that misdirects every AI agent entering the repo is at minimum IMPORTANT, and arguably CRITICAL.

Fix the CRITICAL items, then address the IMPORTANT items. The architecture itself is ready for production use.
