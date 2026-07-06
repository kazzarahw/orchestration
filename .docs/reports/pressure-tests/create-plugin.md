# Pressure Test: create-plugin

**Date:** 2026-07-06 · Type: **condense + application-test**.

## Change
Condensed 3511w → **317w core** + `reference.md`. The core embeds the hard-won findings from this
session's plugin work: `messages.transform` user-message injection is *obeyed* while
`system.transform` is *read but not obeyed*; `tool.execute.before` does NOT reach subagent calls
(use native `permission` maps); `messages.transform` `input` is `{}`. Plus plugin shape
(`PluginInput` → `Hooks`), loading, tool registration, and the tsc/`--print-logs` verify loop. Full
~21-hook catalogue + auth/model-provider APIs → `reference.md`.

## Application test
Scenario: "create an OpenCode plugin that logs every tool call → log-plugin.ts".

| | plugin shape | OpenCode hook/API |
|--|-------------|-------------------|
| RED (no skill) | ✓ | ✓ |
| GREEN (skill) | ✓ | ✓ |

Task-dominated at the shape level: `@opencode-ai/plugin` is in the model's training, so it produces
plugin-shaped output regardless. A shape-grep can't measure the skill's real value (API *accuracy* —
current hook names, the subagent-bypass caveat, the channel finding).

**Status:** form-complete, split; app-test task-dominated at shape level; value is API accuracy in
the condensed core + preserved reference.
