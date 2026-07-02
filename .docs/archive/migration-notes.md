# Migration Notes — Docs Restructure

Archived `src/docs/` on 2026-07-01.

## Contents Archived

| Source | Description |
|--------|-------------|
| `src/docs/plans/` | `2026-06-28-docs-restructure.md` — implementation plan for the docs restructure itself (historical reference) |
| `src/docs/review/` | Empty (`.gitkeep` only) |
| `src/docs/rules/` | Empty (`.gitkeep` only) |
| `src/docs/research/` | Empty (`.gitkeep` only) |

## Key Design Decisions Carried Forward

1. **Docs convention** (from plan `2026-06-28-docs-restructure.md`):
   - Design docs: `docs/plans/design-YYYY-MM-DD-<topic>.md`
   - Implementation plans: `docs/plans/plan-YYYY-MM-DD-<feature>.md`
   - Review reports: `docs/review/{critique,review,dogfood}-*.md`
   - Rules: `.docs/rules/*.md` (moved to dot-prefix directory)
   - Research: `docs/research/`

2. **Report file pattern** — subagents write report files to `.docs/` paths so parent agents can read them.

3. **Rules location** — old `src/docs/rules/` was empty. The active rules are now at `.docs/rules/`.

## New Structure

- `.docs/archive/` — archived old docs
- `.docs/designs/` — design documents
- `.docs/plans/` — implementation plans
- `.docs/reports/` — review/QA reports
- `.docs/rules/` — project rules
