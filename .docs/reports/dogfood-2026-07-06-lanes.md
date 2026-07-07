# Dogfood: risk-routed lanes + design-by-contract

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Agent:** `orchestrate` (reworked).

## Risky-small → HEAVY (risk override) — CONFIRMED
**Task:** "Change the auth token TTL in auth.ts from 1h to 15m" (≤1 line, but auth).
Orchestrate's R0.5 triage, verbatim: *"Auth/security domain → **HEAVY lane** per risk override
(Step B). Trivially small, but auth TTL affects session security, so we follow the full lifecycle."*
→ proceeded into R1a design → R1b critique (found 2 High, revised). The risk override correctly
overrode size — a tiny change did NOT take the trivial/light path.

## Small-pure → LIGHT — CONFIRMED
**Task:** "Add a titleCase(s) helper to util.ts" (1 function, pure, low-risk).
- **R0.5 triage table:** Size=Small, Risk=Low (no auth/data/API/money/PII), **Lane=LIGHT**; correctly
  judged "not trivial enough for fast-path" (needs test-framework setup) → LIGHT.
- **Unified spec collapse:** produced ONE artifact `.docs/specs/spec-2026-07-06-titlecase.md`
  (Problem, Approach, acceptance examples, contracts, tasks) — NOT a separate design + plan.
- **Single critique gate:** "R0-R1-light complete: spec written, **critique passed clean (0 CRIT/HIGH)**,
  branch isolated" — one gate, vs the heavy lane's design-critique + plan-critique + plan-review.
- Then dispatched the **build** subagent (TDD + design-by-contract); the run timed out at build
  dispatch (free-model latency — the same reason the heavy slugify run needed two invocations).

## design-by-contract — CONFIRMED (Task 1)
Isolated RED/GREEN on `parseRange`: property-based tests 0/3 → **3/3** with the skill; contracts
task-dominated but reinforced. See `.docs/reports/pressure-tests/design-by-contract.md`.

## Conclusion
The refinement works: **hybrid routing** sends risky-small to HEAVY and pure-small to LIGHT; the
LIGHT lane **collapses design+plan into one spec with one critique gate**; and **design-by-contract**
adds property-based tests the model doesn't write by default. Only gap in this session's runs is the
LIGHT lane's build *output* captured in a single continuous run — thwarted by free-model speed, not
the workflow (the skill's property behavior is verified separately at 3/3).
