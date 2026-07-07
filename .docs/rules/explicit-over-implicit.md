# Explicit Over Implicit

**Rule:** The framework never silently selects a path that changes what work happens, how much, or where. Every such determination is surfaced to the user as an **Approach Proposal** — a recommendation with reasoning — and confirmed before acting.

Determinations that MUST be proposed and confirmed, never taken silently:
- **Request-type read** (feature / bug / prose rewrite / config / new-skill)
- **Workflow selection** (Quick / Standard / Comprehensive)
- **Isolation** (worktree vs in-place)
- **Mid-flow escalation** (e.g. Standard → Comprehensive when scope grows)

The user supplies a natural request ("rewrite the rules", "add caching"); the agent does the triage *reasoning*, then states its read and the recommended workflow and waits. The user's phrasing stays free of framework vocabulary — the agent asks, it does not assume.

## Gates are plain messages, not the `question` tool

Present options as a normal assistant message with labeled choices and await a normal reply. Do **not** use the `question` tool anywhere in the framework. OpenCode can rewind a conversation to a full message but not to a `question`-tool response; plain-message gates keep every routing decision editable and re-runnable. The `question` permission is denied on every agent to enforce this — the denial is the guarantee, the instruction is the intent.

**Why:** Silent determinations cause silent misroutes. The framework once inline-edited an entire rules rewrite because it silently classified the task "documentation-only" and skipped the workflow. An explicit gate makes a wrong turn impossible to take without the user seeing it first, at near-zero cost to natural phrasing.

**How to apply (to future framework changes):** Do not add a branch that alters scope, isolation, or workflow without routing it through an Approach Proposal. If you find an existing silent branch, convert it to a confirm. See [[prose-is-first-class]] for the routing case this most often protects.
