# Pressure Test: optimize-tokens

**Date:** 2026-07-06 · Type: **form-pass / injection-budget fix** (semantic skill — output
density is not cleanly measurable via a behavioral RED/GREEN, and the free model's density is
not the point; the skill governs *capable-model* output).

## Change

`optimize-tokens` is injected **every turn** (default bundle) but was **1,675 words** — ~8× the
<200 injected budget, bloating every prompt. Split into:
- `SKILL.md` (247w): the load-bearing core — mandate (highest *accurate* bits/token; accuracy
  wins), audience gate (HUMAN → all techniques; AGENT/uncertain → lossless only), verbatim-literal
  preservation, the lossless (always) and lossy (human-only) technique lists, and relax cases.
- `reference.md` (1,675w): full technique detail, worked examples, and the audience-risk rationale
  — read on demand.

247w slightly exceeds the 200 target: the two technique lists (12 lossless + 5 lossy terms) are
the actual content and don't compress further without losing which techniques to apply. Accepted
as the pragmatic floor (85% reduction from 1,675).

## Status
Form-complete; injected footprint reduced ~8×; no content lost (moved to reference.md).
