# Whole-Branch Review Report: Post-Merge Refinements (Round 2)

> **Review date:** 2026-07-02
> **Branch:** `post-merge-refinements`
> **Commit:** `41fdea0` on top of `1778de3` (master)
> **Review type:** Whole-branch integration review — verifying Round 1 fixes

## Context

Single-commit branch (`41fdea0`) addressing findings from the Round 1 whole-branch review. The previous review found 2 CRITICAL and 5 IMPORTANT issues (plus 3 Minor, 2 Low). This commit claims to fix all CRITICAL and the most impactful IMPORTANT items.

**Commit message:** `fix: post-merge Review + Critique findings`

**Files changed:** 15 files, +482/−40 lines
- 3 SDD scripts updated (`.superpowers/sdd/` → `.opencode/sdd/`)
- `src/opencode.jsonc` (plugin paths fixed: `src/plugins/` → `plugins/`)
- `AGENTS.md` (references updated: `develop.md` → `orchestrate.md`, `superpowers.js` → `skill-autoinjection.js`, stale skill names fixed)
- 5 agents updated (`critique.md`, `dogfood.md`, `research.md`, `review.md` — added `name:` field; `design.md` — stale skill ref; `orchestrate.md` — `.superpowers/` → `.opencode/`, stale skill refs embedded)
- `TODO.md` (+1 line)
- 3 archive files added under `.docs/archive/pre-refactor-docs/` (design doc + 2 critique reports from the refactoring process)

---

## Fix Verification: Round 1 Issues

### Previously CRITICAL (Must Fix)

#### C1. `superpowers:` namespace references in active skills
- **Status:** ✅ **FIXED**
- **Evidence:** `grep -rn 'superpowers:' src/skills/` returns 0 matches. All 7 occurrences (create-skill, systematic-debugging) have been removed.
- **Note:** These were likely cleaned up in the dev branch (they're not in this commit's diff), but they are confirmed absent at HEAD.

#### C2. Broken file references in create-skill/SKILL.md
- **Status:** ✅ **FIXED**
- **Evidence:** No references to `anthropic-best-practices.md`, `graphviz-conventions.dot`, `render-graphs.js`, `persuasion-principles.md`, or `testing-skills-with-subagents.md` remain in `create-skill/SKILL.md`. These were cleaned up (likely in the dev branch or this commit).

### Previously IMPORTANT (Should Fix)

#### I1. Stale `explore` subagent reference in research.md body
- **Status:** ✅ **FIXED** (fixed in dev branch, not this commit)
- **Evidence:** `research.md:134` now reads `spawn `general` subagents` with `subagent_type: "general"`. No `explore` ref remains.

#### I2. Stale `implement` reference in create-agent.md
- **Status:** ✅ **FIXED**
- **Evidence:** `create-agent/SKILL.md:59` now reads: `` `orchestrate`, `build`, `architect`, `review`... `` (was `implement`).

#### I3. Surviving skills not updated (Step 2.15)
- **Status:** ⚠️ **PARTIALLY FIXED**
- **What was fixed:** The `superpowers:` namespace refs in systematic-debugging and create-skill are gone (see C1).
- **What remains:**
  - `src/skills/create-rule/SKILL.md:54`: Still references `writing-plans` (deleted skill) as a cross-reference
  - `AGENTS.md:90`: Still references `writing-plans` (as "embedded" — acceptable since content is inline, but the note calls a deleted skill)
  - `AGENTS.md:91`: References `` `finishing-a-development-branch` `` (deleted skill — see new finding below)
  - `src/agents/orchestrate.md:249`: References `finishing-a-development-branch` (deleted skill — see new finding)
  - `src/skills/systematic-debugging/CREATION-LOG.md:57`: Still references `testing-skills-with-subagents` (deleted) — this was MINOR M1 from Round 1

#### I4. Skill word counts dramatically exceed plan targets
- **Status:** ❌ **NOT ADDRESSED** (per Round 1 recommendation, this was deferred as post-merge optimization)
- `optimize-tokens` still at 1675 words (8× the <200 target for autoinjected skills)

### Previously MINOR

#### M1. CREATION-LOG.md references deleted test methodology
- **Status:** ❌ **NOT FIXED**
- `src/skills/systematic-debugging/CREATION-LOG.md:57`: Still references `testing-skills-with-subagents`

#### M2. Dogfood agent retains inline tmux documentation
- **Status:** ❌ **NOT FIXED**
- `src/agents/dogfood.md`: Still contains 75+ lines of inline tmux commands and references, duplicating the `use-tmux` skill content. Line 385 does reference `use-tmux` ("For detailed tmux command reference, load the `use-tmux` skill"), but the inline tmux docs were not removed.

#### M3. `.gitignore` verification
- **Status:** ✅ **FIXED** (verified clean — no `.docs/` exclusion)
- Root `.gitignore` has no blanket `.*` pattern; `.docs/` is fully tracked.

---

## New & Remaining Issues

### Important (Should Fix)

#### I-R2-1. `finishing-a-development-branch` skill referenced but source deleted

**Files & Lines:**
- `AGENTS.md:91` — `` → final Review + optional Dogfood → `finishing-a-development-branch` ``
- `src/agents/orchestrate.md:249` — `` Apply the finishing-a-development-branch process: ``

**Problem:** The `finishing-a-development-branch` skill directory (`src/skills/finishing-a-development-branch/`) was deleted during the refactor (it was part of the original Superpowers skill set). Two files reference it as if it exists:
- AGENTS.md lists it in the "Key Skill Dependency Chain" as a loadable skill
- orchestrate.md introduces a section header with its name, then embeds similar-sounding steps

In orchestrate.md, the content is actually embedded inline (lines 251+) — the reference is just a heading. But AGENTS.md line 91 presents it as a skill in the dependency chain, which is misleading.

**Impact:** Users/agents reading AGENTS.md will expect to find a `finishing-a-development-branch` skill. Running `install.sh` from this source won't deploy it. The dependency chain diagram is incorrect.

**Fix:** Either (a) restore the skill as a lightweight wrapper (documenting the embedded content in orchestrate.md as authoritative), or (b) remove the reference from AGENTS.md's dependency chain.

**Severity:** Important (documentation correctness, not a runtime error since the content is embedded in orchestrate.md)

---

#### I-R2-2. `writing-plans` reference in create-rule/SKILL.md

**File:** `src/skills/create-rule/SKILL.md:54`

```
- Implementation plans (use `writing-plans`)
```

**Problem:** The `writing-plans` skill was deleted during the refactor. This cross-reference will confuse agents loading `create-rule` who try to find the referenced skill.

**Impact:** Agents following the `create-rule` skill will see a reference to a non-existent skill.

**Fix:** Replace `writing-plans` with the current skill name for plan creation. The existing skill that covers this domain would be... looking at the skills inventory, there is no dedicated "writing-plans" replacement in the current set. The plan-writing is embedded in the `plan.md` agent. Adjust the text to reference the agent: `` Use the plan agent for implementation plans ``.

**Severity:** Important

---

### Minor (Nice to Have)

#### M-R2-1. Stale `testing-skills-with-subagents` ref in CREATION-LOG.md

**File:** `src/skills/systematic-debugging/CREATION-LOG.md:57`

```
Created 4 validation tests following skills/meta/testing-skills-with-subagents:
```

**Problem:** Persists from Round 1 (M1). A reference to a deleted document.

**Impact:** Low — CREATION-LOG.md is historical reference, not loaded by agents.

**Fix:** Remove or update the line. Since it's a historical changelog, simply removing the reference (`testing-skills-with-subagents:`) would suffice.

---

#### M-R2-2. Dogfood agent inline tmux docs not deduplicated

**File:** `src/agents/dogfood.md`

**Problem:** Persists from Round 1 (M2). The agent contains 75+ tmux command references that duplicate the `use-tmux` skill. Line 385 references the skill but the inline copy was not removed.

**Impact:** Low — redundant documentation, not a functional issue. Increases agent prompt size.

**Fix:** Replace inline tmux command tables with a reference to load the `use-tmux` skill, per the skill extraction pattern used elsewhere.

---

#### M-R2-3. "generate-plan" is not a real skill name

**File:** `src/agents/research.md:171`

**Change in this commit:** `writing-plans` → `generate-plan`

```
If you find yourself tempted to load any other skill (brainstorming, TDD, generate-plan, etc.), stop immediately
```

**Problem:** The previous version referenced `writing-plans` (deleted skill). The fix replaces it with `generate-plan`, but no skill named `generate-plan` exists in the current inventory. The replacement improves clarity but doesn't resolve the stale-reference problem — it just replaces one non-existent skill name with another.

**Impact:** Very low — this is in a list of "don't use these" examples, so the agent won't try to load them. But if it did, neither name resolves.

**Fix:** Either remove the example (`etc.` already covers the intent) or use the actual agent name (`generate-plan` → `orchestrate with plan agent`).

---

#### M-R2-4. Archived docs semantic misclassification

**Files:**
- `.docs/archive/pre-refactor-docs/plans/design-2026-06-30-workflow-todo-enforcement.md`
- `.docs/archive/pre-refactor-docs/review/critique-2026-06-30-workflow-todo-enforcement.md`
- `.docs/archive/pre-refactor-docs/review/critique-2026-06-30-workflow-todo-enforcement-round2.md`

**Problem:** Three files added to `.docs/archive/pre-refactor-docs/` contain design spec and critique artifacts from the **refactoring process** itself (dated June 30, 2026 — the workflow-todo-enforcement spec for the new plugin). The `pre-refactor-docs` directory should contain documents from before the superpowers-to-modular refactor. These documents are artifacts OF the refactor, not pre-refactor source docs.

**Impact:** Very low — the archive is for historical reference. The misclassification is semantic, not functional.

**Fix:** Either rename the directory to something like `refactor-process-docs/` or move them to a more appropriate archive location.

---

### Information / Already Clean

#### Clean verification checklist (all passing):
- Root `AGENTS.md` → symlink root `CLAUDE.md` is fixed ✅
- `src/AGENTS.md` → symlink `src/CLAUDE.md` is clean ✅
- `src/docs/` directory confirmed removed ✅
- `install.sh`: no stale references ✅
- `README.md`: no stale references ✅
- All 8 agent definitions have `name:` frontmatter ✅
- `<!-- superpowers-agent: ... -->` comments removed from 3 agents ✅
- `src/opencode.jsonc` plugin paths corrected (`src/plugins/` → `plugins/`) ✅
- 3 SDD scripts paths corrected (`.superpowers/sdd/` → `.opencode/sdd/`) ✅
- `orchestrate.md` paths updated (`.superpowers/sdd/` → `.opencode/sdd/`) ✅
- `orchestrate.md` stale skill refs converted to "embedded from" format ✅
- Root `.gitignore` does not exclude `.docs/` ✅

---

## Integration Assessment

### Cross-task consistency
The `dispatching-parallel-agents` and `requesting-code-review` skills are deleted, but their content is embedded in `orchestrate.md` with "(embedded from ...)" notes. This pattern is used consistently. No conflicts or naming drift.

### Remaining stale references
The most impactful remaining stale reference is `finishing-a-development-branch` in `AGENTS.md` (the key dependency chain). This is the lone survival of the old skill namespace in a prominent architectural document. All other stale refs are in low-impact locations (CREATION-LOG.md, example lists).

### Emergent behavior
No emergent integration issues detected. The changes in this commit are well-scoped and targeted.

---

## Summary of Fix Verification

| Round 1 Issue | Severity | Status |
|---|---|---|
| C1: `superpowers:` namespace | Critical | ✅ Fixed |
| C2: create-skill broken refs | Critical | ✅ Fixed |
| I1: `explore` subagent ref | Important | ✅ Fixed |
| I2: `implement` agent ref | Important | ✅ Fixed |
| I3: Surviving skills sweep | Important | ⚠️ Partial — see I-R2-1, I-R2-2 |
| I4: Word counts | Important | ❌ Deferred to post-merge |
| M1: CREATION-LOG.md stale ref | Minor | ❌ Open |
| M2: Dogfood inline tmux | Minor | ❌ Open |
| M3: .gitignore verification | Minor | ✅ Verified |

**Round 1 blocking CRITICAL items: 2/2 fixed**
**Round 1 Important items addressed:** 2 fully fixed, 1 partially, 1 deferred

---

## Recommendations

1. **Fix `finishing-a-development-branch` in AGENTS.md before merge** — this is the one remaining reference that could mislead users/agents. Either restore the skill as a minimal wrapper (pointing to the orchestrate.md content), or remove the reference from the dependency chain.

2. **Fix `writing-plans` in create-rule/SKILL.md** — one-line fix, no design work needed. Replace with guidance to use the plan agent.

3. **Defer remaining minor issues** (CREATION-LOG.md, dogfood inline tmux, generate-plan name, archive semantics) to a future cleanup pass. None are blocking.

4. **Word count reduction** remains deferred as agreed in Round 1.

---

## Assessment

**Ready to merge?** ✅ **Yes, with minor post-merge cleanup**

**Reasoning:** Both CRITICAL issues from Round 1 are confirmed fixed. The remaining issues are:
- One **Important** documentation reference (`finishing-a-development-branch` in AGENTS.md:91) that misrepresents the skill inventory — straightforward to fix
- One **Important** cross-reference (`writing-plans` in create-rule/SKILL.md:54) — one-line text change
- Three **Minor** issues that were already deferred in Round 1 and remain deferred

No runtime bugs, no broken imports, no agent confusion that would occur during normal operation. The blocking criteria from Round 1 (C1, C2) are fully resolved.

**What should be fixed before final merge:**
1. AGENTS.md:91 — `finishing-a-development-branch` reference (remove or restore skill)
2. create-rule/SKILL.md:54 — `writing-plans` → reference to plan agent

**Can follow as post-merge:**
- CREATION-LOG.md stale ref
- Dogfood inline tmux dedup
- `generate-plan` naming
- Archive semantics
- Word counts (already deferred)
