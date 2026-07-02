# Whole-Branch Review Report: Framework Refactor (dev)

> **Review date:** 2026-07-01
> **Branch:** `dev`
> **Range:** `5ec85a6..c127bc0` (7 commits, 73 files changed, +1924/-5242)
> **Review type:** Whole-branch integration review

## Context

Full framework refactor replacing the Superpowers architecture with a modular agent/skill/plugin system. The refactor:

- Creates `skill-autoinjection.js` plugin (replaces `superpowers.js`)
- Creates `src/opencode.jsonc` template
- Renames skills from `writing-*`, `receiving-*`, `maximizing-*`, `using-*` to concise names (`create-*`, `consider-*`, `optimize-*`, `use-*`)
- Creates new agent definitions (`orchestrate`, `design`, `plan`, `build`) replacing old (`develop`, `implement`)
- Updates existing agents (`research`, `review`, `critique`, `dogfood`)
- Deletes 16+ old agent/skill/plugin files
- Moves docs from `src/docs/` → `.docs/` with archival
- Updates `install.sh`, `README.md`, `AGENTS.md`, `CLAUDE.md`

---

## Phase-by-Phase Alignment

### Phase 0: Workspace + Baseline
| Requirement | Status |
|---|---|
| Create `dev` branch from `main` | ✅ Done (confirmed via git log) |
| Set up worktree for isolation | ✅ Done |
| Clean baseline verified | ✅ Commit `5ec85a6` is the checkpoint |
| **Checkpoint commit created** | ✅ `5ec85a6` appears to serve as baseline |

### Phase 1: Plugin Infrastructure
| Requirement | Status |
|---|---|
| `skill-autoinjection.js` created | ✅ Well-structured, 201 lines |
| `src/opencode.jsonc` template created | ✅ 11-line template with correct plugin config |
| Config-driven skill injection via `skill-autoinjection` key | ✅ Implemented in plugin |
| Per-agent frontmatter override | ✅ Implemented via `agentConfig.skills` |
| `experimental.chat.system.transform` hook | ✅ Correct hook used |
| Skills path registration | ✅ Via `config` hook |
| Missing skill names → warning | ✅ `console.warn` with graceful handling |
| Deduplication by agent+skill pair | ✅ `injectedTracker` Set pattern |
| SUBAGENT-STOP block stripping | ✅ Regex-based stripping |
| HTML escaping in XML attributes | ✅ `escapeHtml()` function |
| Plugin loading order documented | ✅ Comment in `opencode.jsonc` |

**Comprehensive test suite:** `test-skill-autoinjection.mjs` — 13 tests covering all requirements.

### Phase 2: Skills
| Skill | Created? | Status |
|---|---|---|
| `optimize-tokens` (from `maximizing-information-density`) | ✅ Renamed with `metadata.alias` | ⚠️ 1675 words (target <200) |
| `use-todo` (new) | ✅ 21 words — well within target | ✅ |
| `use-git` (from `using-git-worktrees`) | ✅ Expanded content, 103 lines | ✅ |
| `use-tmux` (extracted from dogfood.md) | ✅ 65 lines, clean reference | ✅ |
| `create-skill` (from `writing-skills`) | ✅ Renamed | ⚠️ 3839 words, broken references |
| `create-rule` (from `writing-rules`) | ✅ Renamed | ⚠️ 3763 words (target <500) |
| `create-agent` (from `writing-agents`) | ✅ Renamed | ⚠️ 2950 words (target <500) |
| `create-plugin` (from `writing-plugins`) | ✅ Renamed | ⚠️ 3511 words (target <500) |
| `consider-feedback` (from `receiving-code-review`) | ✅ Renamed | ⚠️ 1130 words (target <500) |
| `systematic-debugging` (kept) | ✅ Not modified | ⚠️ Stale `superpowers:` refs |
| `test-driven-development` (kept) | ✅ Not modified | ✅ |
| `verification-before-completion` (kept) | ✅ Not modified | ✅ |

**Deleted skills confirmed absent:** `brainstorming/`, `executing-plans/`, `writing-plans/`, `using-superpowers/`, `using-git-worktrees/`, `writing-skills/`, `writing-rules/`, `writing-agents/`, `writing-plugins/`, `receiving-code-review/`, `finishing-a-development-branch/`, `dispatching-parallel-agents/`, `requesting-code-review/` — **all confirmed deleted**.

**SDD scripts preserved:** `scripts/` directory with `sdd-workspace`, `task-brief`, `review-package` all intact.

### Phase 3: Agents
| Agent | Created/Updated? | Status |
|---|---|---|
| `orchestrate.md` (new, replaces `develop.md`) | ✅ 403 lines, comprehensive lifecycle | ✅ |
| `design.md` (new) | ✅ 116 lines with embedded brainstorming | ✅ |
| `plan.md` (new) | ✅ 179 lines with embedded writing-plans | ✅ |
| `build.md` (new, replaces `implement.md`) | ✅ 162 lines, well-structured | ✅ |
| `research.md` (updated) | ✅ Output paths updated | ⚠️ Stale `explore` body ref |
| `review.md` (updated) | ✅ Output paths, severity handling | ✅ |
| `critique.md` (updated) | ✅ Output paths updated | ✅ |
| `dogfood.md` (updated) | ✅ tmux commands extracted to `use-tmux` skill | ✅ |

**Deleted agents confirmed absent:** `develop.md`, `implement.md`.

### Phase 4: Paper Trail
| Requirement | Status |
|---|---|
| `.docs/` directory structure created | ✅ designs/, plans/, reports/, rules/ |
| `.gitkeep` files in each directory | ✅ Present |
| Design template | ✅ `designs/TEMPLATE.md` — 37 lines |
| Plan template | ✅ `plans/TEMPLATE.md` — 23 lines |
| Report templates | ✅ All 4 templates (critique, dogfood, research, review) |
| `.gitignore` check | ⚠️ Not verified in diff — needs confirmation `.docs/` is not excluded |

### Phase 5: Config & Cleanup
| Requirement | Status |
|---|---|
| `src/plugins/superpowers.js` deleted | ✅ Confirmed absent |
| `src/docs/` archived to `.docs/archive/` | ✅ Migration notes created |
| `docs/` symlink removed | ✅ Confirmed absent |
| `install.sh` updated (no `docs/`, has `opencode.jsonc`) | ✅ Items array correctly updated |
| Cross-reference audit | ⚠️ Several stale references remain (see Issues) |
| `src/AGENTS.md` updated | ✅ Paths, two-stage review updated |
| `src/CLAUDE.md` updated | ✅ Mirrors AGENTS.md (files match) |
| `README.md` updated | ✅ All references updated (orchestrate.md, skill-autoinjection.js, .docs/ paths) |

---

## Strengths

1. **Plugin architecture is clean and well-tested.** The `skill-autoinjection.js` plugin has proper deduplication, per-agent overrides, HTML escaping, graceful missing-skill handling, and comprehensive test coverage (13 tests, 391 lines).

2. **Agent definitions are comprehensive.** The `orchestrate.md` lifecycle (R0–R4) is meticulously specified with error handling, gate definitions, and stopping conditions. The `build.md` has proper escalation paths for unfamiliar technology.

3. **Clean deletion execution.** All 16+ deleted files are confirmed absent. No dangling agent/skill/plugin files remain.

4. **Consistent naming conventions.** All skill names use kebab-case. All agent names match their filenames. All YAML frontmatter uses correct fields.

5. **Good structural separation.** Plugin infrastructure → Skills → Agents → Paper trail → Cleanup follows a clear dependency order. The archived source docs are preserved for historical reference.

6. **Test file is thorough.** 13 tests covering injection, dedup, missing files, SUBAGENT-STOP stripping, folded block scalars, HTML escaping, and per-agent overrides.

---

## Issues

### Critical (Must Fix)

#### C1. `superpowers:` namespace references in active skills

**Files & Lines:**
- `src/skills/systematic-debugging/SKILL.md:179` — `superpowers:test-driven-development`
- `src/skills/systematic-debugging/SKILL.md:287` — `superpowers:test-driven-development`
- `src/skills/systematic-debugging/SKILL.md:288` — `superpowers:verification-before-completion`
- `src/skills/create-skill/SKILL.md:18` — `superpowers:test-driven-development`
- `src/skills/create-skill/SKILL.md:283` — `superpowers:test-driven-development`
- `src/skills/create-skill/SKILL.md:284` — `superpowers:systematic-debugging`
- `src/skills/create-skill/SKILL.md:393` — `superpowers:test-driven-development`

**Problem:** 7 occurrences of the dead `superpowers:` namespace across 2 active skill files. The Superpowers architecture no longer exists — these references will confuse agents and may cause lookup failures.

**Impact:** Agents loading these skills will encounter non-functional cross-references. The `superpowers:` prefix is meaningless in the new architecture.

**Fix:** Replace `superpowers:test-driven-development` → `test-driven-development` and `superpowers:verification-before-completion` → `verification-before-completion` and `superpowers:systematic-debugging` → `systematic-debugging`.

---

#### C2. Broken file references in create-skill/SKILL.md

**Files & Lines:**
- `src/skills/create-skill/SKILL.md:20` — "see anthropic-best-practices.md" (file deleted)
- `src/skills/create-skill/SKILL.md:316` — "See `graphviz-conventions.dot`" (file deleted)
- `src/skills/create-skill/SKILL.md:318` — "Use `render-graphs.js` in this directory to render" (file deleted)
- `src/skills/create-skill/SKILL.md:482` — "See persuasion-principles.md" (file deleted)
- `src/skills/create-skill/SKILL.md:587` — "See testing-skills-with-subagents.md" (file deleted)

**Problem:** The `create-skill` skill, which was renamed from `writing-skills`, still references 5 supporting files that were deleted when the old `writing-skills/` directory was removed. These files were NOT migrated to `.docs/archive/`.

**Impact:** Agents following the `create-skill` skill will encounter `file not found` errors when trying to reference these files. This breaks the skill's usability.

**Fix:** Either (a) restore the referenced files to `.docs/archive/` and update paths, (b) remove the references and inline essential content, or (c) update the text to note these files are available online/reference only.

---

### Important (Should Fix)

#### I1. Stale `explore` subagent reference in research.md body

**File:** `src/agents/research.md:135-139`

```markdown
If the research relates to the existing codebase, spawn `explore` subagents:
...
  subagent_type: "explore"
```

**Problem:** The research agent body still instructs agents to spawn `explore` subagents, but `explore` was removed from the allowed task subagents in the frontmatter (permissions correctly show `"*": deny` with only `"general": allow`). No `explore` agent file ever existed.

**Impact:** Agents following these instructions will try to dispatch a non-existent subagent type, causing errors.

**Fix:** Remove the `explore` subagent section or replace with `"general"` subagent type.

---

#### I2. Stale `implement` reference in create-agent.md

**File:** `src/skills/create-agent/SKILL.md:59`

```markdown
**Example agents from reference:** `orchestrate`, `implement`, `architect`, `review`, `qa`, ...
```

**Problem:** The `implement` agent was deleted (replaced by `build.md`). Listing it as a reference example for new agents is misleading.

**Fix:** Replace `implement` with `build` in the example list.

---

#### I3. Surviving skills not updated (Step 2.15)

**File:** `src/skills/systematic-debugging/SKILL.md`

**Problem:** The plan (Step 2.15) specifies updating cross-references in the 3 surviving skills (`test-driven-development`, `verification-before-completion`, `systematic-debugging`). The diff shows zero modifications to any of these files. `systematic-debugging` still has `superpowers:` namespace references (see C1). The other two may have stale references not caught by the grep pattern.

**Impact:** Cross-references in surviving skills may still refer to deleted/renamed skills, causing broken navigation.

**Fix:** Review and update all cross-references in `systematic-debugging/SKILL.md`, `test-driven-development/SKILL.md`, and `verification-before-completion/SKILL.md` to use new skill names.

---

#### I4. Skill word counts dramatically exceed plan targets

The plan specifies:
- Autoinjected skills: **<200 words**
- Other skills: **<500 words**

| Skill | Current | Target | Δ |
|-------|---------|--------|---|
| `optimize-tokens` | 1675 | <200 | +1475 |
| `use-todo` | 115 | <200 | ✅ |
| `create-skill` | 3839 | <500 | +3339 |
| `create-rule` | 3763 | <500 | +3263 |
| `create-agent` | 2950 | <500 | +2450 |
| `create-plugin` | 3511 | <500 | +3011 |
| `consider-feedback` | 1130 | <500 | +630 |
| `systematic-debugging` | 1504 | <500 | +1004 |
| `test-driven-development` | 1496 | <500 | +996 |
| `verification-before-completion` | 668 | <500 | +168 |
| `use-git` | 533 | <500 | +33 |
| `use-tmux` | 418 | <500 | ✅ |

**Impact:** Skills consume excessive context window. Autoinjected `optimize-tokens` at 1675 words (8× target) loads into every agent's prompt on every session start. Other skills at 3K–4K words will degrade performance when loaded.

**Fix:** Aggressively trim skills to word targets. Move detailed/advanced content to supporting files in the same directory rather than inline in SKILL.md.

---

### Minor

#### M1. CREATION-LOG.md references deleted test methodology

**File:** `src/skills/systematic-debugging/CREATION-LOG.md:57`

```
Created 4 validation tests following skills/meta/testing-skills-with-subagents:
```

**Problem:** References a deleted file from the `writing-skills` directory.

**Fix:** Update or remove the reference since `testing-skills-with-subagents.md` no longer exists.

---

#### M2. Dogfood agent retains inline tmux documentation

**File:** `src/agents/dogfood.md`

**Problem:** The `use-tmux` skill was created (65 lines) to centralize tmux reference material, but the `dogfood.md` agent still contains extensive inline tmux command documentation throughout its body (session creation, send-keys, capture-pane, display-message — all duplicating the skill content).

**Fix:** Replace the inline tmux command documentation in `dogfood.md` with references to load the `use-tmux` skill, reducing duplication.

---

#### M3. `.gitignore` verification not confirmed

**Problem:** The plan (Phase 4, Step 4.3) requires checking that `.docs/` is not excluded by `.gitignore`. This verification was not found in the diff.

**Fix:** Verify `.gitignore` and add `!.docs/` if a blanket `.*` pattern exists.

---

### Low (Informational / No Action Required)

- All YAML frontmatter satisfies ≤1024 char constraint ✅
- All skill descriptions start with "Use when" ✅
- All skill/agent names match directory names ✅
- `src/opencode.jsonc` correct with proper loading order documentation ✅
- `install.sh` correctly updated (no more `docs/` in items, has `opencode.jsonc`) ✅
- README.md correctly updates all references ✅
- AGENTS.md/CLAUDE.md correctly update rules path and two-stage review ✅
- `.docs/archive/migration-notes.md` properly documents the archival ✅
- YAML frontmatter parser in plugin handles folded block scalars (`>-` and `>`) ✅
- HTML escaping in plugin prevents XML attribute breakage ✅
- `docs/` symlink at root correctly removed ✅
- `src/docs/` deleted after archival ✅

---

## Cross-Task Concerns

1. **Skill word counts vs context budget:** The aggregate word count of all skills is 21,602 words. Multiple skills at 3K–4K+ words will consume significant context when loaded. This is a design-level concern that compounds across the skill system. Consider a follow-up refactor to split dense skills or move detailed content to supporting files.

2. **`systematic-debugging` was not updated** despite being in the plan's Step 2.15. This is a gap in the surviving-skills sweep. If other surviving skills (`test-driven-development`, `verification-before-completion`) similarly escaped update, there may be additional stale references to find.

3. **`create-skill` is partly broken** — the rename renamed the file but kept supporting file references that were then deleted. This suggests the implementation order within Phase 2 may have deleted the `writing-skills/` directory before confirming the new `create-skill/` had no remaining dependencies.

---

## Recommendations

1. **Fix CRITICAL issues before merge.** Stale `superpowers:` namespace references and broken file links in `create-skill` will cause runtime errors for agents.

2. **Reduce skill word counts** as a post-merge optimization. The current sizes load excessive context. Prioritize `optimize-tokens` (autoinjected, 8× target).

3. **Sweep remaining surviving skills** for stale references beyond what the grep patterns caught. Some cross-references may use different phrasing.

4. **Review `.gitignore`** to ensure `.docs/` is version-controlled.

---

## Assessment

**Overall Verdict:** 🔴 **RED — Do Not Merge**

**Reasoning:** Two CRITICAL issues — dead `superpowers:` namespace references in 2 active skill files (7 occurrences) and 5 broken file references in `create-skill/SKILL.md` — will cause agent confusion and file-not-found errors during normal operation. These must be fixed before merge. Additionally, IMPORTANT issues with an `explore` subagent reference that will produce runtime errors, a stale agent reference, and unchecked surviving skills should be addressed. The structural foundation (plugin, agents, file deletions, doc paths) is solid and well-executed — the remaining issues are concentrated in skill content and cross-reference maintenance.

**What's blocking merge:**
1. C1: 7 `superpowers:` namespace references in 2 skill files
2. C2: 5 broken `file not found` references in `create-skill/SKILL.md`

**What should be fixed before merge (but not blocking):**
- I1: Stale `explore` subagent body reference
- I2: Stale `implement` agent reference
- I3: Unchecked surviving skills
- M3: `.gitignore` verification

**What can follow as post-merge improvements:**
- I4: Skill word count reduction
- M1: CREATION-LOG.md update
- M2: Dogfood inline tmux deduplication
