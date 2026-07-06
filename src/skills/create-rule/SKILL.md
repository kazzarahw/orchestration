---
name: create-rule
description: Use when creating or updating a guideline document intended to direct agent behavior — before writing the document itself
---
# Create Rule

Create strict, unambiguous guideline docs (`.docs/rules/*.md`) that agents reference to produce
consistent output. **Core principle:** a rule succeeds when an agent landing on a call site cold,
comments stripped, can still produce correct code. If it needs shared context or judgment, it's
unfinished.

<IRON-LAW>
NO RULE WITHOUT A GOOD/BAD EXAMPLE PAIR AND A CORRESPONDING ANTI-PATTERN.
A rule with no example is ambiguous; with no anti-pattern it is unenforceable — you haven't said
what NOT to do. Can't produce both? The rule isn't specific enough yet — sharpen it.
</IRON-LAW>

## When to use
Project-specific conventions whose audience includes other agents: naming, coding standards,
architectural boundaries, commit/PR conventions.
- **≤5 rules, single category → put it in `AGENTS.md`/`CLAUDE.md`**, not a separate doc (threshold:
  when the doc would need its own table of contents).
- Cross-project reusable technique → `create-skill`. Agent definition → `create-agent`. Plan → plan agent.

## Process
1. **Audit** — grep the codebase / check the ecosystem for the existing convention (30s minimum). Don't invent.
2. **Principle** — state the one-sentence principle the rules serve.
3. **Categorize** — group rules; each gets a stable heading/id.
4. **Draft rules** — imperative, testable, one decision each.
5. **Anti-patterns** — for every rule, a good/bad pair + what NOT to do (2–3+ per category).
6. **Checklist** — 3–5 scannable self-check items.
7. **Ambiguity scan** — could any rule be read two ways? Pin it. Mark each rule *floor* (minimum) vs
   *ceiling* (limit).

## Output
`.docs/rules/<topic>.md`. These are mandatory constraints — the orchestrator re-reads them each phase.

Full process (decision-space mapping, update path, scope boundaries, cross-category gap checks): `reference.md`.
