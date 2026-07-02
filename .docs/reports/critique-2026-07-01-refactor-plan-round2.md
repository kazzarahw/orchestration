# Critique Report: Refactor Plan — Round 2

## Context

Follow-up adversarial review of `/home/kazzarah/dev/orchestration/refactor-proposal.md` — a 6-phase framework rewrite plan. Previous critique (`.docs/reports/critique-2026-07-01-refactor-plan.md`) found 2 CRITICAL and 6 HIGH issues. All 8 were reportedly fixed. This round verifies those fixes and identifies any NEW issues introduced by the restructuring.

---

## Previous Issue Resolution Status

### CRITICAL 1: Phase 2→3 embedding gap
**Status: 🟡 Structurally fixed but introduced stale phase references**

The embedding steps were correctly removed from Phase 2 and moved into Phase 3 (agent creation steps now include inline embedding instructions). Phase 4 (Paper Trail) now runs before Phase 3 in the Execution Order so `.docs/reports/` exists when agents reference it. The structural change is sound.

**However**, two stale phase references were left behind and directly contradict the Execution Order (see NEW HIGH 1 and NEW HIGH 2 below).

### CRITICAL 2: Install.sh path + .docs/ installation errors
**Status: 🟢 Fully resolved**

- File path corrected from `src/install.sh` to `install.sh` (line 568: "repo root — NOT `src/install.sh`") ✅
- .docs/ install code removed entirely ✅
- Phase 5.4 now clearly states: ".docs/ is NOT installed globally. The .docs/ directory lives at project root and is created during Phase 4" ✅

### HIGH 1: use-git autoinjection contradiction
**Status: 🟢 Fully resolved**

- Removed from `src/opencode.jsonc` autoinjection array (line 52-55: `["optimize-tokens", "use-todo"]`) ✅
- Documentation consistently says "NOT autoinjected — loaded on-demand" (line 63) ✅
- Dependency map shows `use-git` as On-demand (line 732) ✅

### HIGH 2: Timing migration verification
**Status: 🟢 Fully resolved**

- Phase 1.3 now includes concrete verification step (line 74): start a session, send a task requiring an autoinjected skill, confirm turn-1 behavior ✅
- Explicit clean-break acknowledgment: "dev branch clean break — no guaranteed backward compatibility" ✅

### HIGH 3: Supporting files silently lost
**Status: 🟢 Fully resolved**

- Disposition table in Step 2.16 (lines 254-269) covers all 7 renamed skills with explicit supporting-files disposition ✅
- Scan command catches any unexpected extra files ✅
- Brainstorming supporting files (scripts/, spec-document-reviewer-prompt.md, visual-companion.md) explicitly handled in Phase 3.2 ✅
- SDD scripts/ directory preserved via explicit "keep" instruction (line 360) ✅

### HIGH 4: .docs/reports/ path timing
**Status: 🟢 Fully resolved**

- Execution Order now runs Phase 4 (Paper Trail) BEFORE Phase 3 (Agents) (line 755) ✅
- Phase 3.1 precondition note acknowledges this ordering (line 345) ✅

### HIGH 5: Cross-reference audit scope
**Status: 🟢 Fully resolved**

- Expanded grep commands cover `src/`, `src/agents/` (embedded content), `.docs/` (templates), and `superpowers:` namespace (lines 588-627) ✅
- Separate scan sections for source files, embedded agent content, and paper trail templates ✅

### HIGH 6: SDD stale references
**Status: 🟢 Fully resolved**

- Namespace replacement table in Phase 3.1 embedding step (lines 352-359) maps all 6+ superpowers: prefixes ✅
- Catch-all rule: "Any other superpowers:<name> → strip prefix" (line 359) ✅

---

## Severity Summary (This Round)

| Severity | Count | Notes |
|----------|-------|-------|
| **CRITICAL** | 0 | All previous CRITICALS structurally resolved |
| **HIGH** | 3 | All NEW — stale phase refs + smoke test contradiction |
| **MEDIUM** | 1 | NEW — .docs/archive/ timing issue |
| **LOW** | 2 | NEW — minor inconsistencies |
| **INFO** | 1 | Observation, not actionable |

---

## NEW Critical Issues

**None.** All previous CRITICAL issues are structurally fixed.

---

## NEW High Issues

### HIGH 1: Phase 3.1 precondition references wrong phase number — "Phase 3 (Paper Trail Setup)"

**Location:** Step 3.1 (Orchestrate Agent), line 345

**Problem:** The precondition statement reads:
> "**Precondition:** Phase 3 (Paper Trail Setup) creates `.docs/reports/`. Execute Paper Trail BEFORE Agents — see Execution Order section."

This says **Phase 3** is Paper Trail Setup. But Phase 3 is **Agents**, and Phase 4 is **Paper Trail Setup** (per the heading at line 504). The parenthetical says the right thing ("Paper Trail Setup") but the phase number is wrong. The Execution Order at line 755 correctly says "Phase 4 (Paper Trail) runs BEFORE Phase 3 (Agents)" — so the Phase 3.1 precondition contradicts the Execution Order it references.

**Impact:** An implementer reading the Phase 3.1 precondition and the Execution Order together sees a contradiction: the phase referenced in the agent instructions doesn't match the actual phase numbering. At best this causes confusion at the moment of execution; at worst the implementer adjusts the wrong phase.

**Suggestion:** Change to: "**Precondition:** Phase 4 (Paper Trail Setup) creates `.docs/reports/`..."

---

### HIGH 2: Step 2.14 note references wrong phase — "deletion happens as part of agent creation in Phase 4"

**Location:** Step 2.14 (Drop using-superpowers), lines 239-240

**Problem:** The note reads:
> "The embedded skills (...) are NOT deleted here. Their content is read and inlined during Phase 4 (Agents) — they survive Phase 2 so the agent creation steps can reference them. Deletion happens as part of agent creation in Phase 4."

Two errors in one sentence:
1. **"Phase 4 (Agents)"** — Phase 4 is Paper Trail Setup, not Agents. Agents is Phase 3.
2. **"Deletion happens as part of agent creation in Phase 4"** — Agent creation (with embedding and deletion) happens in Phase 3, not Phase 4.

**Impact:** Same class as HIGH 1. The note directly contradicts the Execution Order. An implementer reading this and then the Execution Order will have to resolve the contradiction manually. The skills that need to survive for Phase 3 embedding would be expected to be deleted in Phase 4 under this note, but the actual deletion occurs in Phase 3 — meaning they'd be deleted a phase early.

**Suggestion:** Change both references to "Phase 3 (Agents)":
> "Their content is read and inlined during Phase 3 (Agents) — they survive Phase 2 so the agent creation steps can reference them. Deletion happens as part of agent creation in Phase 3."

---

### HIGH 3: Phase 5.9 smoke test includes `use-git` in autoinjected skills check — but `use-git` is on-demand

**Location:** Phase 5.9 (Smoke test), line 654

**Problem:** The smoke test step says:
> "Skill injection: Confirm autoinjected skills (`optimize-tokens`, `use-todo`, `use-git`) appear in the Orchestrate agent's system prompt context"

`use-git` is listed here as an autoinjected skill. But:
- The opencode.jsonc template (Phase 1.2, line 52-55) only autoinjects `["optimize-tokens", "use-todo"]`
- The Phase 1.2 note explicitly says "`use-git` is NOT autoinjected" (line 63)
- The dependency map shows `use-git` as On-demand (line 732)
- Phase 3.1 embedding step 5 says "Load `use-git` via `skill` tool when git/worktree operations are needed — it is NOT autoinjected" (line 361)

**Impact:** The implementer running the smoke test will check for `use-git` in the system prompt, won't find it (correctly — it's not autoinjected), and will either:
- Record a false failure, wasting time investigating, OR
- Realize the plan is wrong and ignore the test instruction, reducing confidence in the rest of the smoke test

**Suggestion:** Remove `use-git` from the list of autoinjected skills in the smoke test. Change to:
> "Confirm autoinjected skills (`optimize-tokens`, `use-todo`) appear in the Orchestrate agent's system prompt context"

---

## NEW Medium Issues

### MEDIUM 1: Phase 3.2 references `.docs/archive/` before it exists

**Location:** Step 3.2 (Design Agent embedding), line 389

**Problem:** The embedding instruction says:
> "Also migrate supporting files: `scripts/`, `spec-document-reviewer-prompt.md`, `visual-companion.md` — move to `.docs/archive/` if valuable; otherwise delete"

But `.docs/archive/` is not created until Phase 5.3 (Archive and delete old docs), which runs after Phase 3 in the execution order. Phase 3 runs 4th (Phase 0→1→2→4→3→5), so `.docs/archive/` won't exist when this instruction executes.

**Impact:** The implementer either creates `.docs/archive/` early (breaking the clean phase structure) or must remember to defer the move to Phase 5.3 (adding cognitive overhead).

**Suggestion:** One of:
- **Option A:** Create `.docs/archive/` during Phase 4 (Paper Trail Setup) as an empty directory — then Phase 3.2's move-to-archive works cleanly.
- **Option B:** Change Phase 3.2 to say "move to a temp location or delete; archival to `.docs/archive/` happens in Phase 5.3." Add a note in Phase 5.3 to check for deferred files.
- **Option C:** Since the instruction already says "if valuable; otherwise delete" — simplest fix is to just say "delete" and skip the archive reference. Brainstorming files (scripts directory, spec-document-reviewer-prompt.md, visual-companion.md) are supporting material for the now-deleted brainstorming skill; questionable whether they need archiving at all.

Recommend Option A (create `.docs/archive/` in Phase 4.1) or Option C (drop the archive reference).

---

## NEW Low Issues

### LOW 1: Plugin description example (Step 1.1) shows `use-git` as autoinjected

**Location:** Step 1.1 (Plugin description), line 29

**Observation:** The example in the plugin's config-driven injection description shows:
> "e.g. `["optimize-tokens", "use-todo", "use-git"]`"

While this is labeled as an example ("e.g.") and not the actual config file, it still includes `use-git` as an autoinjected skill, which contradicts the actual config in Phase 1.2. The implementer might copy this example verbatim into the plugin's documentation comment, creating documentation that disagrees with configuration.

**Suggestion:** Change the example to match actual usage: `["optimize-tokens", "use-todo"]` — or use a different example that doesn't include `use-git`, e.g., `["optimize-tokens", "use-todo", "create-skill"]`.

---

### LOW 2: Phase 3.2 and Phase 5.3 both target `.docs/archive/` with no coordination

**Location:** Phase 3.2 (line 389) and Phase 5.3 (line 562)

**Observation:** Two different phases write to `.docs/archive/` with no synchronization:
- Phase 3.2: Moves brainstorming supporting files to `.docs/archive/` (if valuable)
- Phase 5.3: Copies `src/docs/` entire tree to `.docs/archive/`

These use different commands (move vs copy) and have no conflict if files are distinct, but there's no mention of potential filename collisions or ordering requirements.

**Suggestion:** Add a note in Phase 5.3: "Check .docs/archive/ for any files placed there by Phase 3.2 before copying src/docs/."

---

## Info

### INFO 1: Review Gate uses "IMPORTANT" severity while Critique/Dogfood use "HIGH"

**Location:** Gate Definitions (lines 677, 693, 709)

**Observation:** The three gates use slightly different severity scales:
- Critique Gate: CRITICAL + **HIGH** → must fix
- Review Gate: CRITICAL + **IMPORTANT** → must fix
- Dogfood Gate: CRITICAL + **HIGH** → must fix

"IMPORTANT" (IMP) and "HIGH" appear to be equivalent severity levels with different names across gates. This is fine within each gate's self-contained definition but introduces unnecessary inconsistency. The Review Agent (Phase 3.6) also uses CRIT/IMP/MINOR/LOW/INFO — confirming this is intentional and not a typo. Not a blocking issue, but harmonizing to a single scale reduces cognitive load.

---

## Cross-Cutting Consistency Check

### Embedded skill inlining + deletion schedule

**Verdict: Sound once phase references are corrected.**

| Skill | Inlined Into | Phase | Step | Deletion |
|-------|-------------|-------|------|----------|
| `brainstorming` | Design agent | 3 | 3.2 | After embedding in 3.2 ✅ |
| `writing-plans` | Plan agent | 3 | 3.3 | After embedding in 3.3 ✅ |
| `finishing-a-development-branch` | Orchestrate | 3 | 3.1 | After embedding in 3.1 ✅ |
| `dispatching-parallel-agents` | Orchestrate | 3 | 3.1 | After embedding in 3.1 ✅ |
| `requesting-code-review` | Orchestrate | 3 | 3.1 | After embedding in 3.1 ✅ |
| `subagent-driven-development` | Orchestrate | 3 | 3.1 | SKILL.md deleted after embedding (scripts/ kept) ✅ |

All skills survive Phase 2, are read+inlined+deleted in Phase 3. The note in Step 2.14 references the wrong phase number but the intent is correct when mapped to Phase 3 instead of Phase 4.

### Execution Order consistency

The Execution Order block (lines 758-764) is internally consistent and correct:
```
Phase 0 → Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 5
```

But **3 inline references** disagree with this ordering:
1. Line 239-240: "Phase 4 (Agents)" ❌ (should be Phase 3)
2. Line 345: "Phase 3 (Paper Trail Setup)" ❌ (should be Phase 4)  
3. Line 654: "autoinjected skills use-git" ❌ (should not include use-git)

These are all in the body text, not the Execution Order itself. They appear to be remnants of the pre-reordering version of the plan.

---

## Positive Notes

1. **The embedding restructuring is solid.** Moving all embedding into Phase 3 and running Phase 4 before Phase 3 correctly resolves the original CRITICAL 1 issue. The remaining phase reference errors are typographical surface issues, not structural flaws.

2. **Supporting file disposition is now comprehensive.** The combination of the explicit disposition table (Step 2.16), the scan command, and the per-skill handling in Phase 3 embedding instructions covers all edge cases from the original HIGH 3.

3. **Cross-reference audit is now thorough.** The expanded grep commands (lines 588-627) cover every relevant location and pattern. Once the `use-git` smoke test contradiction is fixed, this audit will catch any remaining stale references.

4. **The automated scan command in Step 2.16** (`for dir in ...; do find ... | wc -l`) is a good pattern for catching unexpected supporting files before deletion. Consider adding similar scan steps in other cleanup-relevant locations (e.g., before deleting skill directories in Phase 3, after archiving in Phase 5.3).

---

## Overall Assessment

**🟡 YELLOW — Conditionally ready to execute after fixing 3 HIGH issues**

The structural fixes from Round 1 are all correct and complete. The embedding now happens in the right phase. The install.sh path and .docs/ handling are correct. The autoinjection contradiction, timing verification, supporting files, cross-reference audit, and SDD namespace updates are all properly addressed.

**However, the restructuring introduced 3 new HIGH issues** that must be fixed before execution:

1. **Phase 3.1 precondition says "Phase 3 (Paper Trail Setup)"** → should be Phase 4
2. **Step 2.14 says "Phase 4 (Agents)"** → should be Phase 3
3. **Phase 5.9 smoke test lists `use-git` as autoinjected** → remove it

These are all straightforward text corrections (no structural redesign needed). The first two are remnant phase numbers from the pre-reordering version; the third is a copy-paste oversight from the original autoinjection list.

**Fixing these 3 HIGH issues will make the plan GREEN — Ready to execute.** No structural problems remain.

The one MEDIUM issue (.docs/archive/ timing) is minor and can be fixed alongside the HIGH issues or addressed during execution with a simple note adjustment.

**Recommended pre-execution actions:**
1. Fix Phase references in Step 2.14 (line 239-240) and Step 3.1 (line 345)
2. Fix smoke test autoinjection list (line 654)
3. Fix .docs/archive/ reference in Phase 3.2 (line 389) — either create archive in Phase 4 or drop the archive instruction
4. Fix plugin description example (line 29) to avoid confusing implementers
