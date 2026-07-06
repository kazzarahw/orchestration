# Pressure Test: workflow-gateway

**Date:** 2026-07-06 · 199w (injected, <200 budget ✓).

## Validation — via the deployed system, not a neutral subject

The gateway is *meta*: it routes development tasks to the `orchestrate` lifecycle and forces a
skill/lifecycle check before responding. A neutral `pressure-subject` can't exercise it (it has no
lifecycle to route to), so the meaningful validation is on the real primary agent.

**Observed (deployed, messages.transform channel):** a default-agent `opencode run` had orchestrate
announce, unprompted: *"R0 complete — Loaded `.docs/rules/` … Auto-injected skills:
workflow-gateway, optimize-tokens, use-todo loaded & active … ready to proceed through the full
lifecycle."* i.e. the gateway is read AND acted on — it drives the agent into the lifecycle
scaffolding. This is the whole point of the channel fix (`system.transform` → `messages.transform`):
pre-fix, the gateway was injected but ignored; post-fix, it is obeyed.

## Form
Already superpowers-gateway form: `<IRON-LAW>` (1% rule), `<SUBAGENT-STOP>` guard, rationalization
table, and the announce-and-todo requirement (ties to `use-todo`). Authored in Phase 1, validated
here post-channel-fix.

**Status: PASS** (validated in deployment; form-complete).
