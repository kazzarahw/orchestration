# Workflow & Todo Enforcement — Design Spec

> **Status:** Draft for review
> **Date:** 2026-06-30
> **Drivers:** Develop agent skips lifecycle phases; todo tool underused across all agents.

---

## Problem Statement

Two systemic issues with the current agent ecosystem:

1. **Lifecycle skipping** — The develop agent (342-line prompt) provides multiple escape hatches that allow phase skipping (trivial-change fast path, intake shortcuts). No structural enforcement prevents the agent from improvising instead of following the mandated lifecycle.

2. **Todo underuse** — The `todowrite` tool is only referenced in Phase 3 of the develop agent. No other agent prompts mandate todo usage. Fast paths bypass Phase 3 entirely, never triggering the only todo requirement.

Root cause: The workflow relies entirely on LLM self-discipline to follow a long, complex prompt. The prompt has 11 NO-rules but zero positive DO-rules for phase gating and todo discipline.

---

## Architecture

### Three components, one coherent system:

```
skill-injection plugin
  └── Config-driven auto-inject (messages.transform, one-time)
       ├── using-superpowers  (bootstrapping — skill + tool mapping)
       ├── using-todos        (todo discipline — new, <200 words)
       └── maximizing-information-density  (cross-cutting)
              │
              ▼
         Every agent receives these at session start
         (primary + subagent, no session gating)
```

### Skill content is the enforcement mechanism

Instead of encoding workflow rules in agent prompts (where they're buried and ignored), inject them as skill content at session start — visible, tagged, and consistent across all agents.

---

## Component 1: `skill-injection` Plugin

Replaces `superpowers.js`. Configuration-driven, no hardcoded skill references.

### OpenCode Config

```json
{
  "skill-injection": [
    "using-superpowers",
    "using-todos",
    "maximizing-information-density"
  ]
}
```

Plugin-namespaced key (`"skill-injection"`) to avoid collision with OpenCode's own config properties. Flat array — just skill names. Empty array = no injection.

If the key is absent from config, the plugin defaults to: `["using-superpowers", "using-todos"]`. This prevents silent ecosystem breakage if the config section is missing entirely. Writes `console.warn` if empty array provided explicitly.

### Plugin Hooks

| Hook | Purpose |
|------|---------|
| `config` | Register skills path (`path.resolve(__dirname, '../skills')` — same as current superpowers.js). Read `skill-injection` array from config. |
| `messages.transform` | On first user message, inject all listed skills into the message. One-time per session. Guard against double-injection via marker detection. |

### Injection Format

Each skill is wrapped in identifiable markers with metadata:

```
<AUTO_INJECTED_SKILL name="using-todos" description="Use when starting any task...">
[skill body after frontmatter stripping]
</AUTO_INJECTED_SKILL>
```

The `name` and `description` fields from frontmatter are preserved in the wrapper tag so agents can recognize skills they already have loaded and avoid redundant `skill` tool invocations.

### Platform Tool Mapping

The plugin appends an OpenCode-specific tool mapping after `using-superpowers` (and only `using-superpowers`), matching current `superpowers.js` behavior. This mapping is NOT embedded into the SKILL.md file itself — keeping the skill cross-platform. The mapping translates the skill's generic actions to OpenCode tools:

```
**Tool Mapping for OpenCode:**
- Create or update todos → `todowrite`
- `Subagent (general-purpose):` → `task` with `subagent_type: "general"`
- Invoke a skill → OpenCode's native `skill` tool
- Read files → `read`
- Create, edit, or delete files → `apply_patch`
- Run shell commands → `bash`
- Search files → `grep`, `glob`
- Fetch a URL → `webfetch`
```

Other injected skills (`using-todos`, `maximizing-information-density`) use generic language and don't need mapping.

### Key Design Decisions

- **NOT using `system.transform`** — static skill content doesn't need per-round injection. Cost savings.
- **No session gating** — subagents receive the same injections. The `messages.transform` hook fires for all sessions.
- **Cache skill content** — read from disk once, cache in memory. Same pattern as current superpowers.js `_bootstrapCache`.
- **Frontmatter stripping** — only the body after the `---` fence is injected. Name + description preserved in wrapper tag.
- **SUBAGENT-STOP stripping** — `using-superpowers` contains a `<SUBAGENT-STOP>` block telling subagents to skip the skill. Since the plugin auto-injects it, this guard is unnecessary and creates confusion. The plugin strips the SUBAGENT-STOP block (and its closing `</SUBAGENT-STOP>`) from the skill body before injection.
- **Subagent appropriateness** — `maximizing-information-density` has a built-in audience gate (lossy techniques for human-facing output only; subagents are agents and receive lossless techniques only). The plugin does not filter by agent type; the skill's own rubric handles audience classification.

---

## Component 2: `using-todos` Skill

A new skill (<200 words) that establishes todo discipline as a universal pattern.

### Sections

1. **Personal Discipline** — "Before starting any work, create a todo list. Work through it in order. Add sub-tasks. Mark complete only after verification."

2. **Durability** — "For long-running work or sessions subject to compaction, check for a progress ledger at `.opencode/sdd/progress.md`. If it exists, reconcile your todos against it before proceeding."

3. **Delegating to Subagents** — "When dispatching a subagent, pre-populate its todo list with mandatory items. The subagent may add sub-tasks but must complete all mandatory items before reporting."

### Distribution

- Exists as a standard SKILL.md at `src/skills/using-todos/SKILL.md`
- Injected into every agent via the `skill-injection` plugin
- Agent prompts reference it: "Your todo list is the source of truth" (~1 line, minimal duplication)

---

## Component 3: Agent Prompt Updates

### `develop.md` — Major Rewrite (342→~100 lines)

| Change | Current | New |
|--------|---------|-----|
| Length | 342 lines | ~100 lines |
| Temperature | 0.2 | 0.2 (unchanged) |
| Role scope | Full lifecycle + implementation rules | Orchestration only — dispatch, verify, advance |
| Phase descriptions | 20-50 lines each with sub-steps | 1-2 lines: skill reference + gate condition |
| Triage | Self-judgment ("is this trivial?") | Direct user question: "Full lifecycle, fast path, or maintenance?" |
| Todo discipline | Only mentioned in Phase 3 | "Your todo list defines your work" — once, at top. Bulk discipline comes from injected skill. |

### Detail Mapping: Where the 342→100 line reduction goes

| Removed from develop.md (70%) | Absorbed by |
|-------------------------------|-------------|
| Phase sub-steps (20-50 lines each) | Skills: brainstorming, writing-plans, subagent-driven-development, finishing-a-development-branch |
| Phase error handling (Phase 1a/b/c/d loops) | Skills contain their own error handling. develop.md retains condensed error handling (~5 lines). |
| Cross-cutting rules (40 lines) | Retained in condensed form (~8 lines). Bulk comes from injected `using-todos` and `maximizing-information-density` skills. |
| Detailed subagent dispatch rules (20 lines) | Retained in condensed form (~8 lines). Pre-populated todo construction rules. |
| Stopping conditions (12 lines) | Retained in condensed form (~5 lines). |
| Strict boundaries (11 NO-rules, ~15 lines) | Retained in condensed form (~6 lines: `DO NOT implement — dispatch. DO NOT skip phases — follow todos.`) |
| Phase 2 worktree details | `using-git-worktrees` skill handles this. develop.md just references it. |
| Phase 3c dogfood details | `dogfood.md` agent handles this. develop.md just references it. |

**Net effect:** The 100-line develop.md retains: role statement, condensed boundaries, condensed error handling, condensed stopping conditions, phase reference table (1-2 lines each), condensed dispatch rules, and condensed cross-cutting rules. What's removed is verbatim repetition of what the skills already say.

### Other Agents — Minor Updates

| Agent | Change |
|-------|--------|
| `implement.md` | +~3 lines: "Your pre-populated todo list defines your work scope. Follow it in order." |
| `review.md` | +~3 lines: same pattern |
| `critique.md` | +~3 lines: same pattern |
| `research.md` | +~3 lines: same pattern |
| `dogfood.md` | +~3 lines: same pattern |

---

## Component 4: SDD Scripts — Namespace Migration

| Script | Change |
|--------|--------|
| `sdd-workspace` | `.superpowers/sdd/` → `.opencode/sdd/` |
| `task-brief` | `.superpowers/sdd/` → `.opencode/sdd/` |
| `review-package` | `.superpowers/sdd/` → `.opencode/sdd/` |
| `subagent-driven-development/SKILL.md` | Update all `.superpowers/` references to `.opencode/` |

---

## File Changes Summary

| File | Action | Approx. Size |
|------|--------|-------------|
| `src/plugins/skill-injection.js` | Create | ~150 lines |
| `src/plugins/superpowers.js` | Delete | — |
| `src/skills/using-todos/SKILL.md` | Create | ~55 lines (<200 words) |
| `src/agents/develop.md` | Rewrite | 100 lines (from 342) |
| `src/agents/implement.md` | Edit | +~3 lines |
| `src/agents/review.md` | Edit | +~3 lines |
| `src/agents/critique.md` | Edit | +~3 lines |
| `src/agents/research.md` | Edit | +~3 lines |
| `src/agents/dogfood.md` | Edit | +~3 lines |
| `src/skills/subagent-driven-development/scripts/sdd-workspace` | Edit | 1 path change |
| `src/skills/subagent-driven-development/scripts/task-brief` | Edit | 1 path change |
| `src/skills/subagent-driven-development/scripts/review-package` | Edit | 1 path change |
| `src/skills/subagent-driven-development/SKILL.md` | Edit | ~5 `.superpowers/` refs |

---

## Out of Scope (for this work)

- `maximizing-information-density` skill rewrite (delegated)
- Superpowers skillset rework (separate effort)
- `.gitignore` updates (`.workflow/` not needed — no filesystem persistence)
- Agent definition structural review beyond the minor todo additions listed above

---

## Edge Cases & Risks

| Risk | Mitigation |
|------|-----------|
| Plugin doesn't fire for subagent sessions | Research confirmed: `messages.transform` fires for all sessions. No session gating needed. |
| Skill content changes mid-session | Skills are read at plugin load time and cached. Config change requires restart. Acceptable. |
| Config key absent or empty array | Plugin defaults to `["using-superpowers", "using-todos"]`. Logs `console.warn` if explicitly empty. Ecosystem never silently breaks. |
| Agent still ignores todo list | The todo list is visible in conversation. The injected skill tells the agent to use it. If an agent still ignores it, the failure mode is observable and auditable — improvement over current state where non-compliance is invisible. |
| Todowrite tool not available on platform | The skill says "use the todo tool available in your environment." Not OpenCode-specific. |
