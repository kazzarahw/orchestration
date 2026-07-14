# ai/orchestration

Personal AI orchestration framework — skills, agents, and plugins for directing AI coding assistants across multiple runtimes (Claude Code, OpenCode, Codex, Copilot CLI, Gemini CLI).

## What's here

| Directory | Contents |
|-----------|----------|
| `src/skills/` | Reusable skill documents. Each skill is `src/skills/<name>/SKILL.md` plus optional supporting files. |
| `src/agents/` | OpenCode agent definitions (Markdown + YAML frontmatter). |
| `src/plugins/` | OpenCode plugins: `skill-autoinjection.js` (bootstrap injection) and `goal.ts` (autonomous goal loop). |
| `src/commands/` | OpenCode slash-commands (future use). |
| `.docs/` | Spec, plan, review, and rule templates. |
| `install.sh` | Copies `src/` to `~/.config/opencode/` with backup. |

## Install

```bash
./install.sh
```

Copies `src/` contents to `~/.config/opencode/`, backing up any existing config first.

**Backup location:** `~/.config/opencode.bak.YYYYMMDD-HHMMSS`
**To restore:** `cp -r ~/.config/opencode.bak.*/* ~/.config/opencode/`

**What gets overwritten:** `agents/`, `plugins/`, `skills/`, `commands/`, `AGENTS.md`, `CLAUDE.md`, `opencode.jsonc`. Other custom config files are untouched.

## Skills

Skills are Markdown files that teach AI agents proven techniques and workflows. They load on demand via each runtime's skill mechanism (e.g. the `Skill` tool in Claude Code).

The `skill-autoinjection.js` plugin injects bootstrap context automatically at session start, loading orientation and conventions.

## Agents (OpenCode)

`src/agents/orchestrate.md` is the primary orchestrator: design → plan → implement → review → finish. It delegates all code changes to build subagents. Other agents (`critique`, `review`, `dogfood`, `research`, `design`, `plan`) are dispatched as needed. At R0.5 it emits a **Coverage Contract** accounting for every part of the request (open-ended "all X" requests also commit a re-discovery pass), verified 100% at the final gate so nothing is silently dropped.

## Plugins (OpenCode)

- **skill-autoinjection.js** — injects bootstrap context into the first user message of each session; registers the skills directory.
- **goal.ts** — adds `/goal <description>` to run an autonomous implementation loop with stagnation detection and a two-phase (implement → verify) state machine.

## Docs conventions

- `.docs/designs/design-YYYY-MM-DD-<topic>.md` — design documents
- `.docs/plans/plan-YYYY-MM-DD-<feature>.md` — implementation plans
- `.docs/reports/critique-*.md` — critique reports
- `.docs/reports/review-*.md` — code review reports
- `.docs/reports/dogfood-*.md` — QA reports
- `.docs/rules/*.md` — mandatory project constraints (override all default behavior)
