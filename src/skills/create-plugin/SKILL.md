---
name: create-plugin
description: Use when creating, editing, or troubleshooting OpenCode plugins — not for MCP server config or writing agents/skills/rules
---
# Create Plugin

OpenCode plugins are TypeScript/JS modules that hook into ~21 lifecycle hooks + config points —
register tools, auth/model providers, extend the TUI, mutate prompts. Typed via `@opencode-ai/plugin`.

## Shape
An async function receiving `PluginInput` + optional `options`, returning a `Hooks` object:
```ts
import type { Plugin } from "@opencode-ai/plugin"
export const MyPlugin: Plugin = async ({ client, project, directory, worktree, $, serverUrl }, options) => {
  // init: read config, set up state
  return { /* hooks */ }
}
export default MyPlugin   // default export also accepted
```
`PluginInput`: `client` (SDK), `project`, `directory` (cwd), `worktree`, `$` (Bun shell), `serverUrl`.

## Loading
Auto-discovered from `.opencode/plugins/*.ts` (project) or `~/.config/opencode/plugins/*.{ts,js}`
(global), or listed in `opencode.json` `"plugin": [...]` (npm name, `name@version`, or path).

## Key hooks — mutate `output`, return void
- `config(input: Config)` — read/mutate resolved config at startup (register skills paths, read keys).
- `tool.execute.before(input, output)` — inspect/deny a tool call (throw to block). **Does NOT reach
  subagent (`task`) calls** — for enforcement that must reach subagents, use native `permission` maps.
- `tool.execute.after(input, output)` — read-only post-hook.
- `experimental.chat.messages.transform(input, output)` — append/edit messages (`output.messages` =
  `{info, parts}[]`). A `user` message injected here is **obeyed**; `system.transform` content is read
  but **not obeyed**. `input` is `{}` (no agent identity available).
- `event({event})`, `dispose()`, `stop`, plus tool / auth-provider / model-provider registration.

## Register a tool
```ts
import { tool } from "@opencode-ai/plugin"
return { tool: { mytool: tool({ description, args, execute: async (args, ctx) => "result" }) } }
```

## Verify
Dev types: `bun add -d @opencode-ai/plugin @types/node` + a tsconfig; `bunx tsc --noEmit`. Deploy,
then `opencode run --print-logs` and confirm the hook fires (`console.error` → stderr). Config is
NOT hot-reloaded — restart opencode after changes.

Full hook catalogue, tool/auth/model-provider APIs, and examples: `reference.md`.
