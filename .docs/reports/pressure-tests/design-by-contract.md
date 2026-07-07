# Pressure Test: design-by-contract

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Subject:** `pressure-subject`
**Scenario:** "Implement `parseRange(s)` in range.ts ('3-7' → {start,end}), write bun tests"
(global rules removed to isolate). 442 words (<500).

## Results

| Aspect | RED (no skill) | GREEN (skill) |
|--------|----------------|---------------|
| Contract guards (throw on invalid) | already present (~10 signals) | present | 
| **Property test** (loop/table over inputs, predicate for all) | **0/3** (examples only) | **3/3** ✓ |

- **Contracts are task-dominated:** for a task with obvious invalid inputs (`parseRange`), the model
  writes throw-guards on its own. The skill ensures they're present + adds the postcondition/invariant
  framing for public/risky boundaries. (For a *trivial* task like `normalizeEmail`, neither RED nor
  GREEN added guards/properties — too degenerate to demand them, same as Phase 2's `isOdd`.)
- **Property tests are the skill's real win:** the model does NOT habitually write property-based
  tests. The first skill draft ("write ≥1 property", abstract) got **0/3**. Adding a **concrete,
  copyable loop pattern** to the skill got **3/3** — a clean effect. Lesson: for a technique the model
  doesn't do by habit, a copyable pattern lands where exhortation doesn't.

## Form
Iron Law (contracts + ≥1 property, never zero) · proportionality table (leaf vs public/risky) ·
copyable property pattern · precondition/postcondition/invariant recipe · pure-glue conditional
(not a blanket exemption) · red-flags.

**Status: PASS** — property adoption 0/3 → 3/3 (novel value realized); contracts task-dominated but reinforced.
