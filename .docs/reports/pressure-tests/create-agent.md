# Pressure Test: create-agent

**Date:** 2026-07-06 · Type: **condense + application-test**.

## Change
Condensed 2950w → **332w core** + `reference.md` (2950w preserved). Core keeps the Iron Law (an
agent = role + constraints + tools + stopping conditions; role-without-constraints is the #1
mistake), the pre-write questions, OpenCode frontmatter (name/description/mode/permission), the
required body sections (role → boundaries → workflow/capabilities → error handling → stopping
conditions), and min-tools/deny-by-default rules. Full pipeline-vs-expert templates + examples →
`reference.md`.

## Application test — positive
Scenario: "Create an OpenCode subagent that reviews code for security issues → sec-review.md".

| | file produced | boundaries | stopping conditions | mode/permission frontmatter |
|--|--------------|-----------|---------------------|-----------------------------|
| RED (no skill) | no proper file | — | — | — |
| GREEN (skill) | yes | ✓ | ✓ | ✓ |

With the skill, the subject produced a correctly-structured OpenCode agent carrying all four
required elements; without it, no properly-shaped agent file. Clean positive signal (like TDD and
consider-feedback, unlike the task-dominated skills).

**Status: PASS** — condensed for budget, app-test produces the required structure.
