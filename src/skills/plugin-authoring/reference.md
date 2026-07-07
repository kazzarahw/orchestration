---
name: plugin-authoring
description: Use when creating, editing, or troubleshooting OpenCode plugins — not for MCP server config or writing agents/skills/rules
---

# Create Plugin

## Overview

OpenCode plugins extend the AI agent via TypeScript/JS modules that hook into ~21 lifecycle hooks and configuration points. Plugins can register custom tools, provide auth providers, define custom model providers, and extend the TUI. This skill is the complete reference for the `@opencode-ai/plugin` API surface (`v1.17.4`).

## Architecture

A plugin is an **async function** receiving `PluginInput` (`ctx`) + optional `options`, returning a `Hooks` object:

```
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async (
  { client, project, directory, worktree, $, serverUrl },
  options, // plugin options from config tuple ["name", { ... }]
) => {
  // init: read config, set up state
  return {
    // hook: handler(...) => mutate output, return void
  }
}

// default export also accepted (auto-detected)
export default MyPlugin
```

`PluginInput`:

| Field | Type | Description |
|---|---|---|
| `client` | `OpencodeClient` | SDK client for AI interaction, logging, etc |
| `project` | `Project` | Current project info |
| `directory` | `string` | CWD when opencode launched |
| `worktree` | `string` | Git worktree root |
| `$` | `BunShell` | Bun shell API for command execution |
| `serverUrl` | `URL` | OpenCode server URL |
| `experimental_workspace` | `{ register }` | Workspace adapter registration |

## Loading a Plugin

Two mechanisms (both auto-discovered):

```
.opencode/plugins/my-plugin.ts       # project-local
~/.config/opencode/plugins/plugin.js # global
```

Or via `opencode.json`:

```json
{
  "plugin": [
    "opencode-foo",                      // npm, latest
    "opencode-bar@1.2.3",                // npm, pinned
    "./local-plugin.ts",                 // file relative to declaring config
    ["opencode-baz", { "key": "val" }],  // tuple with options
    "@scope/my-plugin"                   // scoped npm
  ]
}
```

**Load order:** global config → project config → global plugin dir → project plugin dir. Hooks run in the same sequence (load order) across all loaded plugins. This order is **not guaranteed stable** across OpenCode versions — do not rely on inter-plugin ordering. Duplicate npm packages deduped; local files and npm packages are considered separate even if their names partially overlap (e.g., `./my-plugin.ts` and `opencode-my-plugin` both load).

**Dependencies:** For local plugins needing npm packages, create `package.json` in the config directory. OpenCode runs `bun install` at startup.

## Quick Reference

Common plugin patterns — each snippet assumes `export const P: Plugin = async (ctx) => ({ ... })`:

```ts
// 1. Register a custom tool
tool: { mytool: tool({ description, args: { ... }, async execute(args, ctx) { return "ok" } }) }

// 2. Intercept & block tool execution
"tool.execute.before": async (input, output) => { if (input.tool === "read") throw Error("no") }

// 3. Inject system prompt into every LLM call
"experimental.chat.system.transform": async (_i, o) => { o.system.push("Always ...") }

// 4. Inject environment variables
"shell.env": async (_i, o) => { o.env.MY_VAR = "value" }

// 5. Register an auth provider
auth: { provider: "my", methods: [{ type: "api", label: "Key", authorize() { return { type: "success", key: "..." } } }] }

// 6. React to session events
event: async ({ event }) => { if (event.type === "session.idle") console.log("idle") }

// 7. Mutate config on startup
config: async (cfg) => { cfg.skills = cfg.skills || {} }

// 8. Structured logging (hooks only, not tool execute)
await client.app.log({ body: { service: "my-plugin", level: "info", message: "started" } })
```

## Hooks Reference

Most hooks receive `(input, output)` and mutate `output` in place — return `void`. **Exceptions:** `config` receives only `(input)` and mutates it directly; `dispose` takes no arguments; `event` receives only input with no output; `tool`, `auth`, and `provider` are static objects, not callbacks.

**Throwing from a hook** aborts the current operation (tool call, LLM request, command execution) but does **not** crash OpenCode or disable the plugin. OpenCode catches the error and logs it. Subsequent hooks of the same type on other plugins may still fire depending on hook type. Listed with their exact TypeScript shapes.

### 🔧 Tool Registration

| Hook | Purpose | Shape |
|---|---|---|
| `tool` | Register custom tools | `Record<string, ToolDefinition>` (static object) |

```ts
tool: {
  mytool: tool({
    description: "Does X and Y",
    args: {
      input: tool.schema.string().describe("the input"),
      count: tool.schema.number().optional(),
    },
    async execute(args, context) {
      // context: { sessionID, messageID, agent, directory, worktree, abort, metadata(), ask() }
      return { title: "Done", output: `Processed ${args.input}` }
    },
  }),
}
```

`ToolResult` is `string | { title?, output, metadata?, attachments? }`. `output` is **required** in the object variant. `context.ask()` triggers a permission prompt. `context` does NOT include `client` — logging must use `console.log` or an imported logger (hooks have `client.app.log()` available; see Common Mistakes).

### 🔄 Lifecycle Hooks

| Hook | Trigger | Signature |
|---|---|---|
| `config` | Once on init, merged config | `(input: Config) => Promise<void>` — mutates `input` directly (no 2nd arg) |
| `dispose` | Plugin shutdown (process exit, deactivation, or config reload) | `() => Promise<void>` — no arguments. Not guaranteed on abrupt termination (SIGKILL) |

### 💬 Chat / LLM Hooks

| Hook | Trigger | `input` | `output` |
|---|---|---|---|
| `chat.message` | New message received | `{ sessionID, agent?, model?, messageID?, variant? }` (variant = model variant like `"thinking"`) | `{ message: UserMessage, parts: Part[] }` — `message` is the full message metadata; `parts` are its constituent content blocks (text, tool_use, tool_result, etc.) |
| `chat.params` | Before LLM call | `{ sessionID, agent, model, provider, message }` | `{ temperature, topP, topK, maxOutputTokens, options }` |
| `chat.headers` | Before LLM call | `{ sessionID, agent, model, provider, message }` | `{ headers }` |
| `experimental.chat.system.transform` | System prompt assembly | `{ sessionID?, model }` | `{ system: string[] }` |
| `experimental.chat.messages.transform` | Message list assembly | `{}` | `{ messages: { info, parts }[] }` |
| `experimental.text.complete` | Text completion request | `{ sessionID, messageID, partID }` | `{ text }` |

### 🛠 Tool Execution Hooks

| Hook | Trigger | `input` | `output` |
|---|---|---|---|
| `tool.execute.before` | Before any tool runs | `{ tool, sessionID, callID }` | `{ args }` |
| `tool.execute.after` | After tool completes | `{ tool, sessionID, callID, args }` | `{ title, output, metadata }` |
| `tool.definition` | Tool def sent to LLM | `{ toolID }` | `{ description, parameters }` |

### 🔐 Permission / Auth / Provider

| Hook | Trigger | Signature |
|---|---|---|
| `permission.ask` | Permission check | `(input: Permission, output: { status: "ask" \| "deny" \| "allow" }) => Promise<void>` |
| `auth` | Auth provider registration | `AuthHook` (static object, not a callback) |
| `provider` | Custom model provider | `ProviderHook` (static object, not a callback) |

`auth:` shape — register OAuth or API-key auth methods. Optionally include a `loader` to preload auth data before methods execute:

```ts
auth: {
  provider: "myservice",
  methods: [
    {
      type: "oauth",
      label: "Sign in with MyService",
      prompts: [{ type: "text", key: "tenant", message: "Tenant ID" }],
      authorize(inputs) { /* return AuthOAuthResult */ },
    },
    {
      type: "api",
      label: "API Key",
      authorize(inputs) { /* return success/failed */ },
    },
  ],
}
```

`provider:` shape — register custom model provider:

```ts
provider: {
  id: "my-provider",
  async models(provider, ctx) {
    // ctx: ProviderHookContext — has ctx.auth for authenticated requests
    return { "my-model": { id: "my-model", /* ModelV2 fields */ } }
  },
}
```

### ⚙️ Environment / Shell

| Hook | Trigger | `input` | `output` |
|---|---|---|---|
| `shell.env` | Shell creation | `{ cwd, sessionID?, callID? }` | `{ env }` |
| `command.execute.before` | Slash command execution | `{ command, sessionID, arguments }` | `{ parts }` |

### 🧠 Session / Compaction

| Hook | Trigger | `input` | `output` |
|---|---|---|---|
| `experimental.session.compacting` | Before compaction | `{ sessionID }` | `{ context: string[], prompt?: string }` |
| `experimental.compaction.autocontinue` | Post-compaction | `{ sessionID, agent, model, provider, message, overflow }` | `{ enabled: boolean }` |
| `experimental.provider.small_model` | Small model selection | `{ provider }` | `{ model?: ModelV2 }` |

### 📡 Generic Event Bus

| Hook | Trigger | `input` | `output` |
|---|---|---|---|
| `event` | Any bus event | `{ event: Event }` | — |

## Event Types (for `event` hook)

The `event` hook receives a discriminated union on `event.type`. Note: some event names overlap with hook names (e.g., `tool.execute.before` appears both as a hook and an event). **Hooks modify behavior** by mutating their output; **events are read-only notifications** that cannot affect the operation.

| Event type | When fired |
|---|---|
| `command.executed` | A slash-command ran |
| `file.edited` | Agent edited a file |
| `file.watcher.updated` | File watcher detected changes |
| `installation.updated` | Plugin/package installed |
| `lsp.client.diagnostics` | LSP diagnostics published |
| `lsp.updated` | LSP server state changed |
| `message.part.removed` | A message part was removed |
| `message.part.updated` | A message part was updated |
| `message.removed` | A message was deleted |
| `message.updated` | A message was modified |
| `permission.asked` | Permission prompt shown |
| `permission.replied` | Permission prompt answered |
| `server.connected` | Server connection established |
| `session.created` | Session created |
| `session.compacted` | Session was compacted |
| `session.deleted` | Session deleted |
| `session.diff` | Session diff computed |
| `session.error` | Session error occurred |
| `session.idle` | Session idle (detect completion) |
| `session.status` | Session status changed |
| `session.updated` | Session state updated |
| `todo.updated` | Todo item changed |
| `shell.env` | Shell env loaded |
| `tool.execute.after` | Tool execution finished |
| `tool.execute.before` | Tool execution starting |
| `tui.prompt.append` | TUI prompt text appended |
| `tui.command.execute` | TUI command triggered |
| `tui.toast.show` | Toast notification shown |

## Custom Tools with `tool()`

Import the helper:

```ts
import { type Plugin, tool } from "@opencode-ai/plugin"

export const ToolsPlugin: Plugin = async () => ({
  tool: {
    analyze: tool({
      description: "Analyze a file for issues",
      args: {
        path: tool.schema.string().describe("file path relative to worktree"),
        check: tool.schema.enum(["style", "security", "perf"]).default("style"),
      },
      async execute(args, ctx) {
        const { directory, worktree, abort } = ctx
        if (abort.aborted) return "cancelled"
        // ctx.metadata({ title: "Analyzing...", metadata: { severity: "low" } })
        // ctx.ask({ permission: "read", patterns: [args.path], always: [], metadata: {} })
        return { title: "Analysis complete", output: `Checked ${args.path} for ${args.check}` }
      },
    }),
  },
})
```

### ToolContext Reference

`ToolContext` fields available inside `execute(args, ctx)`:

| Field | Type | Description |
|---|---|---|
| `sessionID` | `string` | Current session ID |
| `messageID` | `string` | Current message ID |
| `agent` | `string` | Agent name running the tool |
| `directory` | `string` | Project CWD |
| `worktree` | `string` | Git worktree root |
| `abort` | `AbortSignal` | Cancellation signal — check `abort.aborted` |
| `metadata(input)` | `({ title?, metadata? }) => void` | Stream progress updates to the UI |
| `ask(input)` | `(AskInput) => Promise<void>` | Request user permission at runtime |

`AskInput` shape: `{ permission: string, patterns: string[], always: string[], metadata: Record<string, any> }`.

**ToolContext does NOT include `$` (BunShell) or `client`.** For shell execution, use Node's `child_process` (`execSync`, `execFileSync`, etc.). For logging, use `console.log` or import a logger.

### Tool Rules

- Tool names are `snake_case` strings; plugin tools shadow built-in tools of the same name. If two plugins register the same tool name, the last-loaded plugin shadows the earlier one. Prefix tool names (e.g., `myorg_mytool`) to avoid collisions.
- `tool.schema` is `zod` v4.x — all Zod methods available: `.string()`, `.number()`, `.boolean()`, `.enum()`, `.array()`, `.object()`, `.describe()`. Note: Zod v4 removed some v3 APIs (e.g., `.nonempty()`); use `.min(1)` instead.
- `execute` must return `ToolResult` (see Hooks Reference above). In the object variant, `output` is **required**.
- Attachments: `{ type: "file", mime, url, filename? }[]`.

## Slash-Commands (Custom Commands)

> Slash-commands are a **configuration feature** (`.md` files or `opencode.json` `command` key), not part of the `@opencode-ai/plugin` API. They are documented here because plugin authors commonly create them alongside plugins and they follow the same hook/custom-tool lifecycle.

Two definition forms — **both support** `$ARGUMENTS`, `$1`/`$2`/`$N` positional args, `!command` shell injection, and `@path` file references in the template body.

### Form A: Markdown Files

Files in `~/.config/opencode/commands/` (global) or `.opencode/commands/` (project). Filename (minus `.md`) = command name.

```markdown
---
description: Run tests with coverage report
agent: build
model: anthropic/claude-sonnet-4-6
subtask: true
---

Run the full test suite with coverage and show failures.
Focus on failing tests and suggest fixes.
```

### Form B: JSON Config

Under `command` in `opencode.json`:

```json
{
  "command": {
    "test": {
      "template": "Run tests and fix failures: $ARGUMENTS",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-sonnet-4-6",
      "subtask": false
    }
  }
}
```

### Command Options

| Field | Required | Type | Default | Description |
|---|---|---|---|---|---|
| `template` | yes (JSON) | `string` | — | Prompt template (body in .md) |
| `description` | no | `string` | — | Shown in TUI command palette |
| `agent` | no | `string` | current | Agent to execute command |
| `model` | no | `string` | default | Model override |
| `variant` | no | `string` | — | Model variant override (e.g., `"thinking"`) |
| `subtask` | no | `boolean` | `true` if agent is subagent | Force subagent invocation |

### Template Syntax

```
/component Button primary

# template body:
Create a React component named $ARGUMENTS
  → $ARGUMENTS = "Button primary"

Create at $1 with variant $2
  → $1 = "Button", $2 = "primary"

Current branch: !`git branch --show-current`
  → injects shell output

Review @src/components/Button.tsx
  → injects file content
```

**Built-in commands** (can be overridden by custom commands of same name): `/init`, `/undo`, `/redo`, `/share`, `/help`, `/models`, `/sessions`, `/compact` (`/summarize`), `/theme`, `/editor`, `/thinking`, `/details`, `/export`, `/connect`.

## TUI Plugins

TUI plugins extend OpenCode's terminal UI with custom keymaps, slots, routes, dialogs, and UI state. The entry point is `TuiPlugin`:

```ts
import type { TuiPlugin } from "@opencode-ai/plugin/tui"

export const MyTuiPlugin: TuiPlugin = async (api, options, meta) => {
  // api:     TuiPluginApi
  // options: plugin options from config
  // meta:    { id, source, spec, ... }

  api.keymap.registerLayer({
    id: "my-layer",
    bindings: [
      { key: { key: "g", ctrl: true }, command: "my.command", description: "Do a thing" },
    ],
    commands: [
      {
        id: "my.command",
        display: "My Command",
        execute: () => { api.ui.toast({ message: "Executed!" }) },
      },
    ],
  })
}
```

### TuiPluginApi Surface

| Field | Type | Description |
|---|---|---|
| `app` | `{ version }` | App info |
| `attention` | `TuiAttention` | Notifications + soundboard |
| `keys` | `TuiKeys` | Key sequence formatting |
| `keymap` | `TuiKeymap` | Key binding layers, commands, dispatch |
| `mode` | `TuiModeApi` | Mode stack (`current()`, `push()`) |
| `route` | `{ register, navigate, current }` | Custom route registration + navigation + read current route |
| `ui` | `{ Dialog, DialogAlert, DialogConfirm, DialogPrompt, DialogSelect, Slot, Prompt, toast, dialog }` | UI component constructors |
| `kv` | `TuiKV` | Key-value persistent store |
| `state` | `TuiState` | Live session/config state |
| `theme` | `TuiTheme` | Theme colors, switching |
| `client` | `OpencodeClient` | SDK client |
| `event` | `TuiEventBus` | Event bus subscription |
| `renderer` | `CliRenderer` | Terminal renderer |
| `slots` | `TuiSlots` | Slot plugin registration |
| `plugins` | `{ list, activate, deactivate, add, install }` | Plugin management |
| `lifecycle` | `{ signal, onDispose }` | Lifecycle management |
| `tuiConfig` | frozen config | Read-only plugin/settings config |

### Slot System

TUI plugins can inject UI into named slots:

```ts
api.slots.register({
  home_logo: (ctx) => <text color={ctx.theme.current.primary}> MyPlugin </text>,
  sidebar_content: ({ session_id }) => (
    <box>
      <text>Custom sidebar for {session_id}</text>
    </box>
  ),
})
```

Available slots and their props (from `TuiHostSlotMap`):

| Slot | Props |
|---|---|
| `app` | `{}` |
| `app_bottom` | `{}` |
| `home_logo` | `{}` |
| `home_prompt` | `{ ref?: (ref: TuiPromptRef) => void }` |
| `home_prompt_right` | `{}` |
| `session_prompt` | `{ session_id, visible?, disabled?, on_submit?, ref? }` |
| `session_prompt_right` | `{ session_id }` |
| `home_bottom` | `{}` |
| `home_footer` | `{}` |
| `sidebar_title` | `{ session_id, title, share_url? }` |
| `sidebar_content` | `{ session_id }` |
| `sidebar_footer` | `{ session_id }` |

### Custom Routes

```ts
api.route.register([
  {
    name: "dashboard",
    render: ({ params }) => (
      <box><text>Dashboard: {JSON.stringify(params)}</text></box>
    ),
  },
])
api.route.navigate("dashboard", { tab: "metrics" })
```

### Dialogs

```ts
api.ui.DialogConfirm({
  title: "Confirm",
  message: "Delete this file?",
  onConfirm: () => api.ui.toast({ variant: "success", message: "Deleted" }),
  onCancel: () => {},
})
```

### Legacy Command API (deprecated, use keymap)

```ts
// v1 compat — avoid for new plugins
api.command.register(() => [{
  title: "My Command",
  value: "my.command",
  slash: { name: "mycmd", aliases: ["mc"] },
  onSelect: () => {},
}])
```

## Publishing to npm

For distribution, export a `PluginModule` (default export). Server and TUI entry points **cannot** co-exist in the same module — they are separate types:

```ts
// index.ts — server-side plugin
import type { PluginModule } from "@opencode-ai/plugin"
import { MyPlugin } from "./my-plugin.js"

export default {
  id: "my-org.my-plugin",  // unique reverse-domain ID
  server: MyPlugin,          // required: server-side hooks
} satisfies PluginModule
```

```ts
// tui.ts — TUI plugin (separate file, separate npm entry)
import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { MyTuiPlugin } from "./my-tui-plugin.js"

export default {
  id: "my-org.my-plugin",
  tui: MyTuiPlugin,
} satisfies TuiPluginModule
```

Wire both entry points in `package.json` so consumers can import the TUI module separately:

```json
{
  "exports": {
    ".": "./index.js",
    "./tui": "./tui.js"
  }
}
```

Users install the server plugin via:

```json
{ "plugin": ["@my-org/my-plugin"] }
```

And if a TUI plugin is available separately, users can load it by referencing the TUI subpath in their config setup.

## Real-World Examples

### Example 1: .env Protection Plugin

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const EnvProtection: Plugin = async () => ({
  "tool.execute.before": async (input, output) => {
    if (input.tool === "read" && output.args.filePath?.includes(".env")) {
      throw new Error("Reading .env files is not allowed")
    }
  },
})
```

### Example 2: System Prompt Injector (bootstrap skill)

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const BootstrapPlugin: Plugin = async () => ({
  config: async (cfg) => {
    cfg.skills = cfg.skills || {}
    cfg.skills.paths = [...(cfg.skills.paths || []), "/path/to/skills"]
  },
  "experimental.chat.system.transform": async (_input, output) => {
    output.system.push("Always use TDD. Write test first, then code.")
  },
})
```

### Example 3: Notification on Session Complete

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const Notifier: Plugin = async ({ $ }) => ({
  event: async ({ event }) => {
    if (event.type === "session.idle") {
      await $`notify-send "OpenCode" "Session completed"`
      // Platform note: notify-send is Linux (libnotify).
      // macOS: osascript -e 'display notification "..." with title "..."'
      // Windows: use a PowerShell toast or MessageBox
    }
  },
})
```

### Example 4: Custom Lint Tool

`ToolContext` does not have a `$` shell — use `child_process`. Prefer `execFileSync` over `execSync` to avoid shell injection when arguments come from LLM-generated tool calls:

```ts
import { type Plugin, tool } from "@opencode-ai/plugin"
import { execFileSync } from "child_process"

export const LintPlugin: Plugin = async () => ({
  tool: {
    custom_lint: tool({
      description: "Lint project files with custom rules",
      args: { path: tool.schema.string() },
      async execute(args, ctx) {
        if (ctx.abort.aborted) return "cancelled"
        const stdout = execFileSync("npx", ["eslint", args.path], {
          cwd: ctx.directory,
          encoding: "utf-8",
        })
        return { title: "Lint Results", output: stdout }
      },
    }),
  },
})
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `console.log` in hooks (where `client` is available) | Use `client.app.log({ body: { service, level, message } })` for structured logging |
| Using `client.app.log()` in tool `execute` (no `client`) | ToolContext lacks `client`; use `console.log` or import a logger directly |
| Mutating `input` instead of `output` | Hooks take `(input, output)` — mutate `output` only |
| Returning from hooks instead of mutating | Hooks return `void`; all modification is via `output` mutation |
| Not checking `abort.aborted` in tool `execute` | Long-running tools must respect `ctx.abort` |
| Using `process.cwd()` instead of `directory`/`worktree` | Use `ctx.directory` / `ctx.worktree` from `PluginInput` or `ToolContext` |
| Plugin tool name collisions | Plugin tools shadow built-ins; prefix tool names to avoid |
| Not setting `subtask: true` for commands targeting subagents | Without it, command runs in primary context |
| TUI: using deprecated `api.command` instead of `api.keymap.registerLayer` | Use keymap layers for new plugins |

## Testing & Debugging

1. **Validate syntax:** `bun build --noEmit .opencode/plugins/my-plugin.ts`
2. **Check logs:** Run opencode with `logLevel: "DEBUG"` in config
3. **Logging in plugin:**
   ```ts
   await client.app.log({
     body: { service: "my-plugin", level: "debug", message: "hook fired", extra: { /* any */ } }
   })
   ```
4. **Restart required:** Config/plugin changes need full restart — no hot reload
5. **Break plugin quickly:** Wrap hook body in try/catch that logs then re-throws
6. **Verify hook fires:** Add a trivial `event` hook logging all events first
