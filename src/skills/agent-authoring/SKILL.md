---
name: agent-authoring
description: Use when creating or editing agent/subagent definitions, writing agent system prompts, or structuring YAML frontmatter — not for implementing features
---
# Create Agent

<IRON-LAW>
Every agent needs FOUR things: role + constraints + tools + stopping conditions. Missing any one
produces an unpredictable text generator, not an agent. The #1 mistake is defining the role without
the constraints — "You are a code reviewer" without "You NEVER modify files" makes it modify files.
</IRON-LAW>

## When to use
Creating/editing an agent, structuring frontmatter, designing a pipeline, or reviewing agent
quality. NOT for implementing features (use domain skills).

## Before writing, answer
What problem does it solve? · Who invokes it (user / another agent / orchestrator)? · What tools
does it need (too few → can't work; too many → dangerous)? · When must it REFUSE? · What does "done"
look like? · What happens on failure (retry / escalate / abort)?

## Frontmatter (OpenCode)
```yaml
name: agent-name            # letters, numbers, hyphens only
description: >-             # folded; may include <example> blocks; TRIGGERS, not a workflow summary
  Use this agent to [trigger]. It [purpose]. Does NOT [boundary].
mode: subagent             # primary | subagent | all
permission:                # deny by default, allow selectively
  read: allow
  edit: deny               # read-only agents (reviewers) get no edit/bash
  bash: deny
```

## Body — required sections
1. `# Role` heading + a one-sentence role statement (identity before rules).
2. **Strict Boundaries** — `NO <prohibited action>` lines (and what it does instead).
3. Inputs / workflow steps / output contract (pipeline agent) OR capabilities (expert agent).
4. **Error handling** — recoverable (retry / ask) vs unrecoverable (`ESCALATE:` + STOP).
5. **Stopping conditions** — done / blocked / out-of-scope.

## Rules
- Grant minimum tools; deny `edit`/`bash` to read-only agents.
- Description = triggering conditions, third person, never a workflow summary.
- Test it: dispatch on a representative task; confirm it respects boundaries and stops correctly.

Full pipeline-vs-expert templates, model/tool guidance, and worked examples: `reference.md`.
