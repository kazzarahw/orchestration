# ai/orchestration

Personal AI orchestration framework — skills, agents, and plugins for directing AI coding assistants across multiple runtimes (Claude Code, OpenCode, Codex, Copilot CLI, Gemini CLI).

## What's here

| Directory | Contents |
|-----------|----------|
| `src/skills/` | Reusable skill documents. Each skill is `src/skills/<name>/SKILL.md` plus optional supporting files. |
| `src/agents/` | OpenCode agent definitions (Markdown + YAML frontmatter). |
| `src/plugins/` | OpenCode plugins: `superpowers.js` (bootstrap injection) and `goal.ts` (autonomous goal loop). |
| `src/commands/` | OpenCode slash-commands (future use). |
| `src/docs/` | Spec, plan, review, and rule templates installed to `~/.config/opencode/docs/`. |
| `install.sh` | Copies `src/` to `~/.config/opencode/` with backup. |

## Install

```bash
./install.sh
```

Copies `src/` contents to `~/.config/opencode/`, backing up any existing config first.

**Backup location:** `~/.config/opencode.bak.YYYYMMDD-HHMMSS`
**To restore:** `cp -r ~/.config/opencode.bak.*/* ~/.config/opencode/`

**What gets overwritten:** `agents/`, `plugins/`, `skills/`, `docs/`, `commands/`, `AGENTS.md`, `CLAUDE.md`. The `opencode.jsonc` and other custom config files are untouched.

## Skills

Skills are Markdown files that teach AI agents proven techniques and workflows. They load on demand via each runtime's skill mechanism (e.g. the `Skill` tool in Claude Code).

The `using-superpowers` skill is the entry point — it's injected automatically at session start and explains how to discover and invoke all other skills.

## Agents (OpenCode)

`src/agents/develop.md` is the primary orchestrator: design → plan → implement → review → finish. It delegates all code changes to implementer subagents. Other agents (`critique`, `review`, `dogfood`, `research`, `implement`) are dispatched as needed.

## Plugins (OpenCode)

- **superpowers.js** — injects bootstrap context into the first user message of each session; registers the skills directory.
- **goal.ts** — adds `/goal <description>` to run an autonomous implementation loop with stagnation detection and a two-phase (implement → verify) state machine.

## Docs conventions

- `src/docs/specs/YYYY-MM-DD-<topic>-design.md` — design documents
- `src/docs/plans/YYYY-MM-DD-<feature>.md` — implementation plans
- `src/docs/rules/*.md` — mandatory project constraints (override all default behavior)
