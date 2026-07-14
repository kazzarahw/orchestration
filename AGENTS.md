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
| `src/commands/` | `~/.config/opencode/commands/` | OpenCode slash-command definitions (currently empty; reserved) |
| `src/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | OpenCode config (`default_agent`, plugin list, permission maps) |
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

**Creating new skills** currently follows the TDD process in `src/skills/skill-authoring/SKILL.md` (Iron Law: no skill without a failing pressure-scenario test first), but check with the user if conventions are evolving.

## Agents

Agent definitions live at `src/agents/<name>.md`. YAML frontmatter controls OpenCode behavior:
- `mode: primary` — orchestrator agent (runs the main session)
- `mode: subagent` — dispatched by primary agents
- `disable: true` — agent is inactive (e.g., `src/agents/build.md`, `src/agents/plan.md`)
- `permission` — per-tool allow/deny map
- `temperature`, `color`

The `src/agents/orchestrate.md` primary agent is the main entry point for all development work. It orchestrates the development lifecycle: brainstorm + critique (Design) → plan + critique (Plan) → implement + review (Build) → final Review + dogfood, delegating code changes to the build subagent and never writing implementation code directly. Before delegating, R0.5 emits a **Coverage Contract** — every part of the request enumerated (or, for open-ended "all X" requests, a re-discovery pass committed) — persisted in the SDD ledger and verified 100% at the R3b completeness gate, so no part is silently dropped.

## Plugins

`src/plugins/skill-autoinjection.ts` — OpenCode plugin that injects the `workflow-gateway`, `token-efficiency`, and `progress-tracking` skills into every session turn via the `experimental.chat.messages.transform` hook (a `user` message — `system.transform` content is read but not obeyed). The injected set is the `DEFAULT_SKILLS` list in the plugin, overridable via the `SKILL_AUTOINJECTION` env var. Replaces the former `using-superpowers` skill + `superpowers.js` autoinjection pair.

`src/plugins/goal.ts` — OpenCode plugin providing the `/goal <description>` command. Implements a state machine (`working → review → done/stalled/cancelled`) with stagnation detection, auto-continuation via `session.idle` events, and three tools: `goal_plugin_get`, `goal_plugin_update`, `goal_plugin_verify`. State persists to `.opencode/goals/state.json`.

## Docs Convention

| Path | Content |
|------|---------|
| `.docs/designs/` | Design documents (from brainstorming skill) |
| `.docs/plans/` | Implementation plans (from plan agent) |
| `.docs/rules/*.md` | Mandatory project constraints (from rule-authoring skill) |
| `.docs/reports/` | Critique, review, and dogfood QA reports |

Rules in `.docs/rules/` override all skill and default behavior — the orchestrator agent re-reads them after any working directory change.

## SDD Scripts

`src/skills/subagent-driven-development/scripts/` contains three shell scripts used during subagent-driven development:
- `sdd-workspace` — resolves/creates `.opencode/sdd/` (gitignored artifact dir)
- `task-brief PLAN_FILE TASK_N [OUTFILE]` — extracts one task from a plan into a brief file
- `review-package BASE HEAD [OUTFILE]` — generates a diff package (commits + stat + diff) for a reviewer subagent

## Graphviz Diagrams

**When to use one.** At runtime the agent reads the `dot` *source*, not a rendered image — so a
diagram buys nothing a clear table or list wouldn't, *except* for one shape: a **cyclic state
machine** (a flow with back-edges — `hypothesis → wrong → new hypothesis`, `critique → revise →
re-critique → escalate`). That's the shape prose and tables express poorly, and the only place a
`dot` block earns its cost.

- **Cyclic flow (loops / back-edges)** → `dot` diagram.
- **Flat or tree-shaped decision** (routing, "if X → do Y") → a **decision table** or a numbered
  **branch-list**. Clearer, cheaper in tokens, easier to maintain. Do *not* reach for graphviz here.

Rendering is a human-maintenance aid only. Install graphviz (`apt install graphviz`) and render:
```bash
dot -Tsvg -o diagram.svg diagram.dot
```

## Platform Target

This repo targets **OpenCode** (single platform, as of the 2026-07 enforcement overhaul). Skills
are invoked with OpenCode's `skill` tool; "dispatch a subagent" maps to the `task` tool with a
`subagent_type`. Enforcement relies on OpenCode-specific mechanisms — the `skill-autoinjection`
plugin injects the always-on gateway via `experimental.chat.messages.transform` (a `user` message —
`system.transform` content is read but not obeyed), native `permission` maps gate source edits to
the `build` agent, and `default_agent` launches into `orchestrate`. Skill *bodies* stay
runtime-neutral in phrasing where it costs nothing, but portability is no longer a goal.

## Key Skill Dependency Chain

`skill-autoinjection` plugin → loads `workflow-gateway` + `token-efficiency` + `progress-tracking` on every session turn  
Orchestrate → delegates Design (brainstorming embedded) → Plan (plan agent) → Build (subagent-driven-development)  
→ final Review + optional Dogfood → branch finish (embedded in orchestrate R4)

Cross-cutting (apply throughout): `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `git-workflow`.
