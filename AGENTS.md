# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A personal AI orchestration framework. It ships skill documents, OpenCode agent definitions, and OpenCode plugins. The skills currently follow the Superpowers format and conventions, but that's an implementation detail subject to change. There is no build system or test suite — the "artifacts" are Markdown skill files, agent Markdown files, and JS/TS plugins.

## Skills

Skills live at `skills/<name>/SKILL.md`. Each file has YAML frontmatter (`name`, `description`) followed by the skill body. Supporting files (scripts, examples, heavy reference docs) go in the same directory as `SKILL.md` — nothing else.

**Frontmatter constraints:**
- `name`: letters, numbers, hyphens only (no parentheses or special chars)
- `description`: starts with "Use when…", third person, triggering conditions only — never summarize the workflow (agents read it to decide whether to load the skill, then follow the body, not the description)
- Total frontmatter ≤ 1024 chars

**Word-count targets** (skills load into every conversation — keep them tight):
- Skills loaded on every turn: < 200 words
- Other skills: < 500 words

Check with: `wc -w skills/<name>/SKILL.md`

**Writing new skills** currently follows the TDD process in `skills/writing-skills/SKILL.md` (Iron Law: no skill without a failing pressure-scenario test first), but check with the user if conventions are evolving.

## Agents

Agent definitions live at `agents/<name>.md`. YAML frontmatter controls OpenCode behavior:
- `mode: primary` — orchestrator agent (runs the main session)
- `mode: subagent` — dispatched by primary agents
- `disable: true` — agent is inactive (e.g., `agents/build.md`, `agents/plan.md`)
- `permission` — per-tool allow/deny map
- `temperature`, `color`

The `agents/develop.md` primary agent is the main entry point for all development work. It runs a full lifecycle: design → plan → implement → review → finish, delegating code changes to implementer subagents and never writing implementation code directly.

## Plugins

`plugins/superpowers.js` — OpenCode plugin that injects the `using-superpowers` skill into the first user message of each session and registers `skills/` as a skills path in OpenCode config. Uses module-level cache to avoid repeated disk reads.

`plugins/goal.ts` — OpenCode plugin providing the `/goal <description>` command. Implements a state machine (`working → review → done/stalled/cancelled`) with stagnation detection, auto-continuation via `session.idle` events, and three tools: `goal_plugin_get`, `goal_plugin_update`, `goal_plugin_verify`. State persists to `.opencode/goals/state.json`.

## Docs Convention

| Path | Content |
|------|---------|
| `docs/specs/YYYY-MM-DD-<topic>-design.md` | Design documents (from brainstorming skill) |
| `docs/plans/YYYY-MM-DD-<feature>.md` | Implementation plans (from writing-plans skill) |
| `docs/rules/*.md` | Mandatory project constraints (from writing-rules skill) |
| `docs/research/` | Research outputs |
| `docs/reviews/` | Code review outputs |

Rules in `docs/rules/` override all skill and default behavior — the develop agent re-reads them after any working directory change.

## SDD Scripts

`skills/subagent-driven-development/scripts/` contains three shell scripts used during subagent-driven development:
- `sdd-workspace` — resolves/creates `.superpowers/sdd/` (gitignored artifact dir)
- `task-brief PLAN_FILE TASK_N [OUTFILE]` — extracts one task from a plan into a brief file
- `review-package BASE HEAD [OUTFILE]` — generates a diff package (commits + stat + diff) for a reviewer subagent

## Graphviz Diagrams

Skills use `dot` code blocks for flowcharts. Render them:
```bash
./skills/writing-skills/render-graphs.js skills/<name>           # each diagram separately
./skills/writing-skills/render-graphs.js skills/<name> --combine # all in one SVG
```

## Platform Targets

This repo supports multiple runtimes. `skills/using-superpowers/references/` has per-platform tool mapping docs. On Claude Code, skills are invoked with the `Skill` tool and "dispatch a subagent" maps to the `Agent` tool.

## Key Skill Dependency Chain

`using-superpowers` → loaded on every session start  
→ `brainstorming` → `writing-plans` → `subagent-driven-development` or `executing-plans`  
→ `requesting-code-review` + `receiving-code-review` → `finishing-a-development-branch`

Cross-cutting (apply throughout): `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `using-git-worktrees`.
