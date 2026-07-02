# CLAUDE.md / AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What This Repo Is

A personal AI orchestration framework. It ships skill documents, OpenCode agent definitions, and OpenCode plugins. The skills currently follow the Superpowers format and conventions, but that's an implementation detail subject to change. There is no build system or test suite — the "artifacts" are Markdown skill files, agent Markdown files, and JS/TS plugins.

## Source Layout

Source files live under `src/` and get installed to `~/.config/opencode/` via `install.sh`:

| Path | Installed to | Purpose |
|------|-------------|---------|
| `src/skills/` | `~/.config/opencode/skills/` | Skill documents |
| `src/agents/` | `~/.config/opencode/agents/` | OpenCode agent definitions |
| `src/plugins/` | `~/.config/opencode/plugins/` | OpenCode plugins |
| `.docs/` | project root | Design specs, plans, review reports, and project rules |
| `src/AGENTS.md` | `~/.config/opencode/AGENTS.md` | Global agent rules |
| `src/CLAUDE.md` | `~/.config/opencode/CLAUDE.md` | Global agent rules (Claude Code alias) |

Root-level files (`AGENTS.md`, `CLAUDE.md`, `.docs/`, `README.md`) are for *this* repository itself. The `src/` directory contains the source that gets deployed to `~/.config/opencode/`.

## Skills

Skills live at `src/skills/<name>/SKILL.md`. Each file has YAML frontmatter (`name`, `description`) followed by the skill body. Supporting files (scripts, examples, heavy reference docs) go in the same directory as `SKILL.md` — nothing else.

**Frontmatter constraints:**
- `name`: letters, numbers, hyphens only (no parentheses or special chars)
- `description`: starts with "Use when…", third person, triggering conditions only — never summarize the workflow (agents read it to decide whether to load the skill, then follow the body, not the description)
- Total frontmatter ≤ 1024 chars

**Word-count targets** (skills load into every conversation — keep them tight):
- Skills loaded on every turn: < 200 words
- Other skills: < 500 words

Check with: `wc -w src/skills/<name>/SKILL.md`

**Creating new skills** currently follows the TDD process in `src/skills/create-skill/SKILL.md` (Iron Law: no skill without a failing pressure-scenario test first), but check with the user if conventions are evolving.

## Agents

Agent definitions live at `src/agents/<name>.md`. YAML frontmatter controls OpenCode behavior:
- `mode: primary` — orchestrator agent (runs the main session)
- `mode: subagent` — dispatched by primary agents
- `disable: true` — agent is inactive (e.g., `src/agents/build.md`, `src/agents/plan.md`)
- `permission` — per-tool allow/deny map
- `temperature`, `color`

The `src/agents/orchestrate.md` primary agent is the main entry point for all development work. It orchestrates the development lifecycle: brainstorm + critique (Design) → plan + critique (Plan) → implement + review (Build) → final Review + dogfood, delegating code changes to Build and implementer subagents and never writing implementation code directly.

## Plugins

`src/plugins/skill-autoinjection.js` — OpenCode plugin that injects `optimize-tokens` and `use-todo` skills into every session turn via the `system.transform` hook. Replaces the former `using-superpowers` skill + `superpowers.js` autoinjection pair.

`src/plugins/goal.ts` — OpenCode plugin providing the `/goal <description>` command. Implements a state machine (`working → review → done/stalled/cancelled`) with stagnation detection, auto-continuation via `session.idle` events, and three tools: `goal_plugin_get`, `goal_plugin_update`, `goal_plugin_verify`. State persists to `.opencode/goals/state.json`.

## Docs Convention

| Path | Content |
|------|---------|
| `.docs/designs/` | Design documents (from brainstorming skill) |
| `.docs/plans/` | Implementation plans (from writing-plans skill) |
| `.docs/rules/*.md` | Mandatory project constraints (from writing-rules skill) |
| `.docs/reports/` | Critique, review, and dogfood QA reports |

Rules in `.docs/rules/` override all skill and default behavior — the develop agent re-reads them after any working directory change.

## SDD Scripts

`src/skills/subagent-driven-development/scripts/` contains three shell scripts used during subagent-driven development:
- `sdd-workspace` — resolves/creates `.opencode/sdd/` (gitignored artifact dir)
- `task-brief PLAN_FILE TASK_N [OUTFILE]` — extracts one task from a plan into a brief file
- `review-package BASE HEAD [OUTFILE]` — generates a diff package (commits + stat + diff) for a reviewer subagent

## Graphviz Diagrams

Skills use `dot` code blocks for flowcharts. Install graphviz (`apt install graphviz`) and render:
```bash
dot -Tsvg -o diagram.svg diagram.dot
```

## Platform Targets

This repo supports multiple runtimes. On OpenCode, skills are invoked with the `Skill` tool and "dispatch a subagent" maps to the `Task` tool with the `subagent_type` parameter.

## Key Skill Dependency Chain

`skill-autoinjection` plugin → loads `optimize-tokens` + `use-todo` on every session turn  
Orchestrate → delegates Design (brainstorming embedded) → Plan (writing-plans embedded) → Build (subagent-driven-development)  
→ final Review + optional Dogfood → `finishing-a-development-branch`

Cross-cutting (apply throughout): `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `use-git`.
