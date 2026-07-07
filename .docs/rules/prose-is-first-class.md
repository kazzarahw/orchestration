# Prose Is First-Class

**Rule:** Prose work — skills, agents, rules, specs, docs, config — is real implementation, not a trivial fast-path. It earns the same workflow rigor as code, scaled to its size: isolation, a todo ledger, and a spec/critique or review pass proportional to the change.

The direct-edit path is reserved for **genuinely trivial** edits — a typo, a one-line wording fix, a single config value. Anything substantial (rewriting a rules file, authoring a skill, restructuring a document, drafting a spec) runs the normal workflow.

**Why:** This repo's primary product *is* prose. A code-centric workflow that equates "implementation" with "code that has tests" treats everything else as throwaway — so the majority of real work here falls through to an unstructured inline edit with no isolation, no todos, and no review. That is the failure this rule closes.

## Adapting rigor to prose

Prose does not get TDD, but it gets the equivalents:
- **Acceptance criteria** instead of tests — what must the finished document say/do to be correct?
- **A critique or review gate** sized to the change — a fresh pass against those criteria before it's done.
- **Isolation + todos** exactly as code work gets them.

**How to apply:** When triaging (see [[explicit-over-implicit]]), classify a substantial prose task as first-class work and propose a real workflow for it — never route it to direct-edit merely because it is not code. "Is it code?" is the wrong question; "is it trivial?" is the right one.
