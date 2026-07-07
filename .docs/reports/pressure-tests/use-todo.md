# Pressure Test: use-todo

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Subject:** `pressure-subject`
**Scenario:** an explicit 5-step task (add isEven, isOdd, clamp, a test file, export all). Global
rules removed. **Verdict signal:** did the agent use `todowrite` to track the steps?

## Result

| | used todos |
|--|-----------|
| RED (no skill) | 2/2 |
| GREEN (skill) | 3/3 |

Task-dominated: a genuinely multi-step task prompts the model to create todos on its own, skill
or not. No behavioral movement to demonstrate.

## Rewrite — the point of this one was the reframe

Per the design spec, `use-todo` was a 115-word stub ("make a list for ≥3 steps") that
under-sold its role. Rewritten to 184 words (injected, <200 budget) encoding the
**source-of-truth / workflow-spine** framing:
- Iron Law: for ≥3 steps the todo list is the SOURCE OF TRUTH for progress (not memory); each
  lifecycle phase, gate, and skill-checklist item becomes a todo.
- **Durable state:** after context compaction, trust the list (+ `git log` + SDD progress ledger)
  over recollection — why steps aren't skipped/repeated.
- **Commitment:** an open todo is the *structural* half of the commitment loop (announcing a
  skill commits verbally; the todo commits structurally).

## Status

**Reframe complete; behavioral discrimination inconclusive** (model uses todos naturally for
multi-step work). Value is the content reframe — `use-todo` is injected every turn and is the
structural spine the gateway relies on (gateway requires one todo per checklist item).
