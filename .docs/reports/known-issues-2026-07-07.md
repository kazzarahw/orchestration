# Known Issues & Deferred Work — 2026-07-07

Punch-list after the workflow-enforcement overhaul + tier-matrix dogfood. Order: **known-minors
first, then enhancements.** All framework code is committed; tree clean at time of writing.

## Known-minor issues (do next)

1. **Routing fixes not behaviorally verified.** The skill→consumer sweep (commit `cc03314`) closed
   four gaps, but only the commit-header one (`git-workflow`→`build`) was confirmed *behaviorally*
   (a real build now emits `fix: …`). Still to verify with targeted runs that these change behavior:
   - `build` → `test-driven-development` (was gist-only)
   - `build` → `verification-before-completion` (before DONE claims)
   - `build` / `design` → `feedback-response` (handling review/critique findings)
   Files: `src/agents/build.md`, `src/agents/design.md`.

2. **Quick leaves the build-report file untracked.** For in-place Quick work the build subagent
   writes its report (e.g. `<topic>-report.md`) to the repo root, left untracked — there's no
   gitignored `.opencode/sdd/` for in-place work. Fix: build writes reports to a gitignored location
   even in-place, or emits no separate report file for Quick. Files: `src/agents/build.md`, SDD
   scripts, `orchestrate.md` R2.

3. **Quick review-pass is inconsistent.** Prose Quick (Test A) dispatched *no* review subagent; code
   Quick (Test B) did. Decide and specify whether Quick includes a review subagent, and for which
   deliverable kinds. File: `src/agents/orchestrate.md` (R0.5 Quick path).

4. **Two linear graphviz diagrams violate the new guidance.** `condition-based-waiting.md` and
   `rule-authoring/reference.md` are flat/tree flows; per the `AGENTS.md` graphviz rule (cyclic →
   diagram, flat → table/branch-list) they should be tables. Convert, or consciously exempt.
   Files: `src/skills/systematic-debugging/condition-based-waiting.md`,
   `src/skills/rule-authoring/reference.md`.

## Deferred enhancements (after known-minors)

- **Parallelism for independent build tasks.** R3 builds tasks serially even when independent
  (different files, no shared interface). Fan out concurrent build subagents. Needs a feasibility
  check first: can the orchestrate *agent* dispatch concurrent subagents safely, and do independent
  tasks need a worktree-per-task to avoid clobbering? File: `orchestrate.md` R3.
- **Gate cohesion / plan-critique trim.** Comprehensive runs four evaluation passes (design-critique,
  plan-critique, per-task review, whole-branch review). Trim `R1d` plan-critique to a
  coverage/consistency check (not a full adversarial round — the design was already critiqued), and
  give critique/review/dogfood a *shared evaluation contract* (same severity calibration, report
  shape, convergence protocol) for cohesion. Files: `orchestrate.md` R1d, `critique.md`, `review.md`,
  `dogfood.md`.

## Methodology to preserve

- **Measure dogfood dispatches from `opencode.db` (distinct sessions), NOT the log.** Grepping
  `opencode.log` for `agent=X mode=subagent` counts ~8 stream-events per session (≈8× inflation).
  This produced a false "non-convergence" crisis this session. See memory `opencode-dogfood-measurement`.
- **The weak model is a fuzzer.** Each quirk is a failing test case pointing at a spec/routing gap —
  trace it to a structural cause; the model is the harness, not the defendant. (This found the
  commit-header routing bug and the whole skill→consumer gap class.)

## Confirmed NON-issues (don't re-open)

- "Non-convergence / runaway iteration / 3-iteration-cap-not-enforced" — **a log-event miscount.**
  The loops converge healthily in ~3 rounds (fix real bugs, respect documented intent, verify). No
  fix needed; do not reintroduce stateful critique or forced convergence (they'd degrade it).
- Design+Plan merge — decided: keep separate; the workflow tiering already merges them where it pays
  (Standard) and separates them where it pays (Comprehensive).
- Graphviz render-to-context / vision — scrapped; superpowers' renderer is a human aid only.
