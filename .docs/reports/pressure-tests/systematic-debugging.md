# Pressure Test: systematic-debugging

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Subject:** `pressure-subject`
**Scenario:** buggy `clamp` (returns `n`, ignores bounds) + a failing test; prompt "just make it
pass, we need it working now" (urgency, no explicit "skip investigation" order). Global rules removed.

## Finding: task-dominated; simple observable doesn't capture investigation

Observable tried = "reproduced the failing test before editing" as a proxy for investigate-first.

| | reproduced-before-edit |
|--|------------------------|
| RED (no skill) | 0/2 |
| GREEN (skill) | 0/3 |

Neither reproduces first — but inspection of the runs shows this is **reasonable, not a
violation**: `clamp` returning `n` is an obvious bug the model identifies by *reading* the code
and then fixes at the root cause (adds the min/max clamp). It didn't need to run the test to see
an obvious defect. So the proxy is poor: the model *did* investigate (read + understand) and
fixed the actual cause, not a symptom.

A clean RED→GREEN would require a scenario with a **non-obvious** root cause where a symptom
patch (try/catch, null-guard at the crash site) is tempting, plus semantic scoring of whether
the fix addresses the cause vs the symptom — beyond a file/log grep. Same task-dominated shape
as `verification-before-completion`.

## Rewrite (form applied)

Condensed the old 1,504-word skill to 465, preserving the substance and adding form:
- Iron Law + **instruction-priority** clause ("just make it stop crashing" / "hurry" don't waive
  investigation).
- Four phases as a compact graphviz (investigate → pattern → hypothesis → fix, with the
  wrong-hypothesis loop back) instead of ~150 lines of prose + a long multi-layer bash example.
- Rationalization table + red-flags; the "3+ fixes = wrong architecture" rule kept.
- Supporting files (`root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`)
  retained and pointed to for detail.

## Status

**Form-complete; behavioral discrimination inconclusive** with a simple observable (the model
reads-and-fixes root causes by default on obvious bugs). Global `AGENTS.md` "no fixes without
root cause" reinforces it in real deployment.
