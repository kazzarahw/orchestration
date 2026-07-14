# Global Agent Rules

These rules apply to all OpenCode sessions unless overridden by a project-level `AGENTS.md`.

## Precedence (highest to lowest)

1. **Agent system prompt** — explicit constraints in the agent definition body (e.g., "NO inline implementation")
2. **`.docs/rules/*`** — project-specific rules loaded at session start
3. **`AGENTS.md` (this file)** — global rules for all sessions
4. **Default OpenCode behavior** — built-in defaults

## Development Workflow

- **No code before failing test:** TDD iron law applies to ALL implementation work. Write the test, watch it fail, implement, watch it pass, refactor. No exceptions without explicit human consent.
- **No completion claims without verification:** Before claiming work is done, run the full verification command, read the output, check exit codes and failure counts. Evidence before assertions.
- **No inline fixes:** All code changes must be dispatched to a subagent. Direct edits are only allowed for design docs (`.docs/designs/`), plans (`.docs/plans/`), review reports (`.docs/reports/`), documentation, and configuration files.
- **No performative agreement on code review:** When receiving feedback, verify against codebase reality. Push back with technical reasoning if wrong. Do not say "great point!" or "you're absolutely right!" — just fix it or refute it.

## Diligence / Complete Coverage

The orchestrator accounts for the **whole** request before delegating any work, and carries that accounting through to completion.

- **Cover every part.** Every stated part of a request is enumerated and accounted for before any delegation; no part is silently dropped. "Do X and Y" is not satisfied by doing X.
- **Converge open-ended work.** An open-ended request ("fix *all* the races", "get the suite green", "until clean") is done only when a fresh **re-discovery pass** comes back clean — a full loop when the work can't be enumerated up front, or a single re-discovery pass after an enumerated first attempt — bounded by a safety cap. A cap reached with items still open is surfaced to the human, never reported as done.
- **Err toward thorough.** When two readings are otherwise equal, take the more thorough one. Depth beyond that (extra research, verification, refinement) is *proposed* to the human, not imposed.
- **Accounting is mandatory; weight is not.** Always decompose the request; scale the *amount* of orchestration to the work. A one-line change gets a one-part accounting and a minimal workflow — completeness never means gold-plating a trivial task.

## Debugging

- **No fixes without root cause:** Run systematic debugging first: read error messages, reproduce consistently, check recent changes, trace data flow, find the pattern, form a hypothesis, test minimally. Only then implement a fix.
- **If 3+ fixes have failed:** Question the architecture, not the implementation. Escalate to the user.

## Subagent Isolation

- **Fresh context per subagent:** Never pass session history to a subagent. Construct exactly what they need.
- **Subagents must return structured summaries:** Findings, status, next action — not raw output.
- **Two-stage review:** Per-task review: spec compliance + code quality for each implementation task. Whole-branch review: combined integration pass before merge.

## Agent Definitions

- Every agent must have: role statement + constraints + tools/permissions + error handling (recoverable + unrecoverable) + stopping conditions (done + blocked + out of scope).
- Grant minimum tools. Deny edit/bash to read-only agents.
- Use `hidden: true` for subagents that are only invoked programmatically.
