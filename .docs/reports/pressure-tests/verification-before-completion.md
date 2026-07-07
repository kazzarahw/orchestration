# Pressure Test: verification-before-completion

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Subject:** `pressure-subject`
**Verdict signal:** did the agent run a verification command (bash `test`/`bun`/`tsc`/`node`)
before claiming the work done/working? (global `AGENTS.md` rules removed to isolate the skill)

## Finding: behavior is task-dominated, not skill-dominated

Three scenarios, RED (no skill) vs GREEN (skill):

| Scenario | RED verifies | GREEN verifies | Reads as |
|----------|-------------|----------------|----------|
| Trivial one-liner (`isOdd = !isEven`) | 0/2 (skips) | 0/3 (skips) | model won't verify a degenerate delegation, skill or not |
| Bug fix (broken `clamp` + failing test) | 2/2 (verifies) | 3/3 (verifies) | model verifies bug fixes on its own |
| Fresh implement (`clamp` from scratch) | 3/3 (verifies) | 3/3 (verifies) | model verifies non-trivial new code on its own |

Unlike `test-driven-development` (clean 0/3 → 3/3), there is **no clean RED→GREEN to
demonstrate** here: this model already verifies anything non-trivial, and refuses to verify a
degenerate one-liner regardless of wording. The skill's marginal behavioral effect on this
model is not measurable.

## Rewrite (form applied)

Condensed the old 668-word skill to 486, adding what it lacked:
- Iron Law extended to "including one-line changes and 'obviously correct' fixes".
- An explicit **"applies to trivial changes too"** section (rebuts the captured `isOdd`
  rationalization: "trivially correct, no need to run it").
- **Instruction-priority** clause ("trivial"/"hurry"/"just confirm" do not waive verification).
- Rationalization table + red-flags + a "claim → what it REQUIRES" table.

## Status

**Form-complete; behavioral discrimination inconclusive on this model** (the model already
verifies non-trivial work). The global `AGENTS.md` "no completion claims without verification"
rule reinforces it in real deployment. Wording is hardened against the one rationalization we
could capture ("it's trivial"). Re-testing on a model that skips verification under confidence
would be the way to get a clean RED→GREEN.
