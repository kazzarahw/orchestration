# Pressure Test: create-skill

**Date:** 2026-07-06 · Type: **condense + application-test** (on-demand meta-skill).

## Change
Condensed 3738w → **399w core** + `reference.md` (3738w preserved). Core keeps the load-bearing
insights: Iron Law (no skill without a failing test), RED-GREEN-REFACTOR for skills,
**match-the-form-to-the-failure** table, frontmatter/word-budget rules, "description = triggers
only, never a workflow summary", one-example + graphviz-at-drift rules. Full SDO/discovery,
bulletproofing toolkit, testing-by-skill-type, checklists, anti-patterns → `reference.md`.

## Application test
Scenario: "create a skill that teaches agents to run `npm audit` before deploying → my-skill/SKILL.md".

| | SKILL.md produced | "Use when" description | Iron-Law form |
|--|------------------|------------------------|---------------|
| RED (no skill) | yes | yes | no |
| GREEN (skill) | yes | yes | no |

Task-dominated: the model already produces a correctly-shaped SKILL.md with a "Use when"
description. Neither adds an Iron Law — appropriate here (an npm-audit reminder is a simple
reference, not a discipline). No behavioral discrimination on this scenario; the skill's value is
the condensed injectable-budget-safe core + the author-facing process depth in `reference.md`.

**Status:** form-complete, split for budget; app-test inconclusive (task-dominated).
