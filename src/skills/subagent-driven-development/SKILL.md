---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session, task-by-task with review checkpoints
---

# Subagent-Driven Development

This skill provides the SDD workflow for executing implementation plans: dispatch build subagents per-task, verify with review checkpoints, and track progress.

## Resources

- `implementer-prompt.md` — prompt template dispatched to build subagents
- `task-reviewer-prompt.md` — prompt template for per-task review
- `scripts/task-brief` — extract single task from plan file
- `scripts/review-package` — generate diff package for reviewer
- `scripts/sdd-workspace` — manage artifact directory

The full SDD lifecycle is embedded in `src/agents/orchestrate.md` (Phase R3). This directory contains reusable prompt templates and scripts used by the orchestrator at runtime.
