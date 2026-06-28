# ai/orchestration

Personal AI orchestration framework — skills, agents, and plugins for directing AI coding assistants across multiple runtimes (Claude Code, OpenCode, Codex, Copilot CLI, Gemini CLI).

## What's here

| Directory | Contents |
|-----------|----------|
| `skills/` | Reusable skill documents. Each skill is `skills/<name>/SKILL.md` plus optional supporting files. |
| `agents/` | OpenCode agent definitions (Markdown + YAML frontmatter). |
| `plugins/` | OpenCode plugins: `superpowers.js` (bootstrap injection) and `goal.ts` (autonomous goal loop). |
| `docs/` | Generated output — specs, plans, rules, research, reviews. |

## Skills

Skills are Markdown files that teach AI agents proven techniques and workflows. They load on demand via each runtime's skill mechanism (e.g. the `Skill` tool in Claude Code).

The `using-superpowers` skill is the entry point — it's injected automatically at session start and explains how to discover and invoke all other skills.

## Agents (OpenCode)

`agents/develop.md` is the primary orchestrator: design → plan → implement → review → finish. It delegates all code changes to implementer subagents. Other agents (`critique`, `code-reviewer`, `dogfood`, `research`, `task-reviewer`) are dispatched as needed.

## Plugins (OpenCode)

- **superpowers.js** — injects bootstrap context into the first user message of each session; registers the skills directory.
- **goal.ts** — adds `/goal <description>` to run an autonomous implementation loop with stagnation detection and a two-phase (implement → verify) state machine.

## Docs conventions

- `docs/specs/YYYY-MM-DD-<topic>-design.md` — design documents
- `docs/plans/YYYY-MM-DD-<feature>.md` — implementation plans
- `docs/rules/*.md` — mandatory project constraints (override all default behavior)
