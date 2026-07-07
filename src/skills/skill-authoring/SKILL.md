---
name: skill-authoring
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---
# Create Skill

**Writing a skill IS TDD applied to process documentation.** REQUIRED BACKGROUND: understand
`test-driven-development` first — this adapts its RED-GREEN-REFACTOR cycle to documentation.

<IRON-LAW>
NO SKILL WITHOUT A FAILING TEST FIRST — new skills AND edits. Run the pressure/application scenario
WITHOUT the skill and watch an agent fail before you write it. Wrote the skill first? Delete it,
start from the test. No exceptions for "simple additions" or "just docs".
</IRON-LAW>

## RED → GREEN → REFACTOR for skills
- **RED** — run the scenario without the skill; capture the agent's exact behavior and verbatim
  rationalizations. Include a no-guidance control — if it doesn't fail, there's nothing to fix; stop.
- **GREEN** — write the minimal skill countering those specific failures. Re-run; agent complies.
- **REFACTOR** — new rationalization? Add an explicit counter. Re-test (5+ reps) until binding
  (reps converge on one shape; five different interpretations = wording not binding, tighten it).

## Match the form to the failure (the key decision)
| Baseline failure | Right form |
|---|---|
| Skips/violates a rule under pressure | prohibition + rationalization table + red-flags |
| Complies but output has the wrong shape | positive recipe: state what the output IS, its parts in order |
| Omits a required element | REQUIRED field/slot in the template |
| Behavior depends on a condition | conditional on an observable predicate ("if X exists, do Y") |

**No nuance clauses** — "don't X unless it matters" reopens the negotiation. Prohibitions backfire
on shaping problems; use a recipe there.

## SKILL.md essentials
- Frontmatter: `name` (letters/numbers/hyphens only); `description` starts with "Use when…",
  **triggers only — never summarize the workflow** (a summary becomes a shortcut agents take instead
  of reading the body). ≤1024 chars.
- **Word budget:** always-loaded/injected < 200; other skills < 500. Heavy detail → supporting files.
- Structure: Overview (core principle) → When to Use → Quick Reference/pattern → one great example →
  Common Mistakes. Graphviz ONLY at non-obvious decision/drift points, never for linear steps.
- Reference other skills by name with `**REQUIRED SUB-SKILL:**`; never `@`-link (force-loads context).

## Deploy
One skill at a time — test each before the next. Create a todo per checklist item.

Full process (SDO/discovery, bulletproofing toolkit, testing by skill type, checklists, anti-patterns): `reference.md`.
