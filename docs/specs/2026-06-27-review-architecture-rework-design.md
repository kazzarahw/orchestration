# Review/Critique Subagent Architecture Rework

**Date:** 2026-06-27  
**Status:** Draft  
**Author:** Develop Agent (via brainstorming)

## Summary

Replace the current 3-reviewer architecture (`critique` + `task-reviewer` + `code-reviewer`) with a cleaner 2-agent split: `critique` (adversarial logic review) and `review` (cooperative implementation review). Removes overlapping final-review gates and fixes temperature/permission inconsistencies.

## Current State & Problems

### Current agents

| Agent | Role | Temp | Problems |
|---|---|---|---|
| `critique.md` | Spec + Plan + Integration review | 0.1 | Temp too low for adversarial work; integration role overlaps with code-reviewer; has `task: allow` with no documented reason |
| `task-reviewer.md` | Per-task spec compliance + code quality | default | Develop.md references it as two separate agents ("spec-reviewer" + "code quality reviewer") |
| `code-reviewer.md` | Whole-branch pre-merge review | default | Overlaps with critique's integration role — two final passes instead of one |

### Specific inconsistencies

1. **Double final gate:** After all tasks, `code-reviewer.md` (whole-branch) runs, THEN `critique.md` (integration) runs. They check overlapping concerns.
2. **Naming mismatch:** `develop.md` Phase 3 describes "dispatch spec-reviewer subagent" and "dispatch code quality reviewer" as generic action instructions, but both routes actually dispatch `task-reviewer.md`. The descriptions should reference actual agent names.
3. **Temperature contradiction:** `critique` is "adversarial" at temp 0.1 — adversarial edge-case finding benefits from higher temperature, not near-determinism.
4. **Blurred role boundaries:** `critique` handles pre-implementation documents AND post-implementation code review — two fundamentally different artifacts.

## Design: 2-Agent Architecture

### Conceptual split

```
DOCUMENTS (pre-code)                    CODE (post-plan)
┌──────────────────────┐              ┌──────────────────────┐
│   CRITIQUE           │              │   REVIEW             │
│  (adversarial)       │              │  (cooperative)       │
│                      │              │                      │
│  "What's wrong with  │              │  "Is this correctly  │
│   this thinking?"    │              │   implemented?"      │
│                      │              │                      │
│  Specs, plans,       │              │  Diffs, code, tests, │
│  assumptions, logic  │              │  architecture         │
└──────────────────────┘              └──────────────────────┘
```

### Agent: `critique`

| Property | Value | Rationale |
|---|---|---|
| Type | Adversarial logic reviewer | Finds flaws in thinking before code exists |
| Scope | Spec documents + Plan documents | Pre-implementation only |
| Temperature | 0.5 | Compromise — high enough for creative edge-case discovery, low enough for precise plan-verification tasks |
| `task: allow` | `research` only | May spawn research subagent to validate domain assumptions |
| Output | `docs/critiques/critique-YYYY-MM-DD-<topic>.md` | Structured report with severity-scaled findings |
| Gate frequency | 2× per feature (spec critique + plan critique) | Before any implementation begins |

**Prompt structure:** Keeps current adversarial format (severity-scaled findings, cite evidence, propose alternatives) but scoped to document-only review. Drops the integration/implementation review sections.

### Agent: `review`

| Property | Value | Rationale |
|---|---|---|
| Type | Cooperative implementation reviewer | Verifies code correctness, quality, completeness |
| Scope | Per-task diffs + Whole-branch diffs | Both are code review — same focus, different breadth |
| Temperature | 0.3 | Balanced — precise for compliance, flexible enough for quality judgment |
| `task: allow` | `deny` | No subagent dispatch needed — reviewers use read/grep/bash directly; can be escalated to `research` if a specific documented scenario arises |
| Output (per-task) | `docs/reviews/task-<N>-<feature>.md` | Spec compliance + code quality verdict |
| Output (whole-branch) | `docs/reviews/integration-YYYY-MM-DD-<feature>.md` | Full integration assessment + merge verdict |
| Gate frequency | Per-task (N×) + whole-branch (1×) | After each implementer task + once at the end |

**Dual-mode design:** The same agent handles both scopes via context from the dispatcher:

| Mode | Context passed | What to check |
|---|---|---|---|
| `per-task` | Task brief, implementer report, git diff (narrow) | Spec compliance, code quality, test coverage for this task |
| `whole-branch` | Plan/spec, full diff range, accumulated minor-issues | Cross-task consistency, emergent behavior, design debt, integration gaps, regression risk, production readiness |

**Mode-switching mechanism:** The dispatcher passes `review_mode: per-task` or `review_mode: whole-branch` as a context flag. The `review.md` prompt has conditional sections gated on this flag. In `per-task` mode, the prompt expects `BRIEF_FILE`, `REPORT_FILE`, `DIFF_FILE` as inputs. In `whole-branch` mode, it expects `DIFF_FILE` (full branch range) and optionally `MINOR_ISSUES_FILE` (accumulated minor findings from per-task reviews for triage). Cross-task concerns discovered during per-task review (interface mismatches, shared-module issues) are flagged as `⚠️ forwarded to whole-branch` items — they don't block the current task but are recorded in the minor-issues accumulator for the whole-branch review. The review loop protocol (fix → re-review cycle) is unchanged from current task-reviewer behavior.

## Process Flow

### Before (3 agents, double final gate)

```
Spec → critique (spec)
  → Plan → critique (plan)
    → Per task: implement → task-reviewer
    → After all: code-reviewer → critique (integration) → Finish
```

### After (2 agents, single final gate)

```
Spec → critique (spec)
  → Plan → critique (plan)
    → Per task: implement → review (per-task mode)
    → After all: review (whole-branch mode) → Finish
```

### Changes from current workflow

| Phase | Current | New |
|---|---|---|
| Phase 1b (spec critique) | `@critique.md` | `@critique.md` (same agent, better temp) |
| Phase 1d (plan critique) | `@critique.md` | `@critique.md` (same agent, better temp) |
| Phase 3 step b | "dispatch spec-reviewer subagent" | "dispatch `@review.md` in per-task mode" |
| Phase 3 step c | "dispatch code quality reviewer" | *(merged into step b)* |
| Phase 3 post-tasks | `requesting-code-review` skill + `@code-reviewer.md` + `@critique.md` (integration) | `@review.md` in whole-branch mode (single pass) |
| Phase 3b | Integration Critique Gate → `@critique.md` | Changes to `@review.md` whole-branch dispatch. Section may be merged into Phase 3 Step 3. |

## Files to Create/Modify/Remove

### Create
- `agents/review.md` — new cooperative implementation review agent
- `docs/critiques/` directory (mkdir)
- `docs/reviews/` directory (mkdir)

### Rewrite
- `agents/critique.md` — temp 0.1→0.5, remove integration role, restrict task to research-only, update description

### Modify
- `agents/develop.md` — fix Phase 3 review dispatch naming, remove double-final-gate process
- `skills/subagent-driven-development/SKILL.md` — update flow diagram, replace agent references; update `task-reviewer-prompt.md` link to `review.md`
- `skills/subagent-driven-development/task-reviewer-prompt.md` — update template to reference `@review.md` per-task mode (reference doc)
- `skills/requesting-code-review/SKILL.md` — **re-purpose as standalone reference**: no longer in default workflow (develop.md dispatches `@review.md` directly), but retained for ad-hoc/manual review requests outside SDD
- `skills/requesting-code-review/code-reviewer.md` — update template to reference `review.md` whole-branch mode

### Remove
- `agents/task-reviewer.md` — replaced by `review.md` per-task mode
- `agents/code-reviewer.md` — replaced by `review.md` whole-branch mode

## Migration Sequence

Do NOT apply the Files list as a flat batch — order matters to avoid transient breakage:

1. **Create** `docs/critiques/` and `docs/reviews/` directories
2. **Create** `agents/review.md`
3. **Update** `skills/requesting-code-review/code-reviewer.md` template to reference `review.md` whole-branch mode
4. **Update** `skills/requesting-code-review/SKILL.md` to re-purpose as standalone reference
5. **Update** `skills/subagent-driven-development/SKILL.md` (flow diagram + agent reference text)
6. **Update** `skills/subagent-driven-development/task-reviewer-prompt.md` (reference doc)
7. **Update** `agents/develop.md` (Phase 3, Phase 3b)
8. **Rewrite** `agents/critique.md` (temp, scope, permissions)
9. **Validate dual-mode review agent** — dispatch `@review.md` in per-task and whole-branch modes. Compare against existing `task-reviewer.md` and `code-reviewer.md` outputs. Only proceed if pass criteria met (see Validation Strategy below).
10. **Remove** `agents/task-reviewer.md`, `agents/code-reviewer.md` (last — only after validation passes)

Steps 3-7 can be parallelized since they modify different files.

## Output Structure

```
docs/
├── critiques/
│   └── critique-YYYY-MM-DD-<topic>.md
├── reviews/
│   ├── task-<N>-<feature>.md
│   └── integration-YYYY-MM-DD-<feature>.md
├── specs/           (unchanged)
├── plans/           (unchanged)
├── rules/           (unchanged)
├── research/        (unchanged)
```

## Validation Strategy

The dual-mode `review` agent (replacing two separate prompts) is a testable hypothesis. Validate it before declaring the rework complete:

1. After implementing `review.md`, run it in `per-task` mode on the next real feature implementation. Compare output quality against the current `task-reviewer.md` on a similar task.
2. Run it in `whole-branch` mode on the same branch. Compare output against the current `code-reviewer.md` on a similar branch.
3. **Pass criteria:** Finding accuracy is maintained (no missed issues), false-positive rate does not increase, and coverage of required review dimensions is complete.
4. **Rollback plan:** If quality degrades in either mode, revert to separate agents (`task-reviewer.md` + `code-reviewer.md` + updated `critique.md`) and document which mode needs its own agent. The spec's core improvements (temperature fix, single final gate, role boundaries) can still be applied to the 3-agent architecture.

## Dogfood / QA

Not applicable — this is a subagent-definition change, not a user-facing program. No interactive QA gate.

## Open Questions

No open questions remain. Key decisions:
- `critique` temperature: **0.5** (compromise — high enough for adversarial edge-case discovery, precise enough for plan verification)
- `review` dual-mode mechanism: **mode flag in dispatch context** + conditional sections in prompt
- `review` task permission: **deny** (escalate to `research` only if documented need arises)
- Migration sequence: **order-preserving** (create new agents → update references → rewrite old → remove last)
