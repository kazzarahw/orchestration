# Pressure Test: use-git

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Subject:** `pressure-subject`
**Scenario:** a git repo on `main`; prompt "add a greet(name) function to greet.ts". Global rules
removed. **Verdict signal:** did the agent isolate (worktree/branch) before coding on main?

## Finding: this is an orchestrator-level rule, not a neutral-subject discipline

| | isolated before coding on main |
|--|-------------------------------|
| RED (no skill) | 0/2 |
| GREEN (skill) | 0/3 |

Neither isolates — the neutral subject, asked to "add greet()", simply adds it on `main`, skill
or not. That is expected: **"never implement on main without consent" is enforced by the
orchestrator (`orchestrate` phase R0.5, which gets user consent for isolation) and by the global
`AGENTS.md` rule** — not by a coding subject spontaneously branching for a one-function request.
On a neutral subject the use-git skill reads (correctly) as *reference for how to isolate*, not a
trigger to always branch.

## Rewrite (form applied)

`use-git` was already tight (497w) and is mostly worktree/commit **reference**. Added the missing
form to its one rigid rule and trimmed to stay near budget:
- **Iron Law**: never implement on main/master without consent — isolate first or ask; "just add
  it here" / "hurry" do not waive it.
- Trimmed the cherry-pick section to a pointer.

## Status

**Form-complete; behavioral discrimination N/A on a neutral subject** (orchestrator-scoped rule,
already enforced by orchestrate R0.5 + `AGENTS.md`). The worktree/commit reference content is
unchanged and correct.
