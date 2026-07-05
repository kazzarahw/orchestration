# Design: Workflow Enforcement Overhaul

## Context

The framework was overhauled from the `obra/superpowers` skill system to embedding
those processes into agent definitions. The overhaul preserved the *structure*
(agents, skills, plugins, docs layout) but silently dropped the *enforcement model*:
agents now rarely follow the design → plan → build → review lifecycle.

Research (`.docs/reports/research-2026-07-05-workflow-enforcement.md`) identifies the
root cause. Superpowers reliability came from four reinforcing forces, all lost when
procedures became passive agent prose:

1. **Always-on gateway** — a skill injected every turn that forces a workflow/skill
   check *before any response*, carrying the "1% Iron Law" (if there's even a 1%
   chance a skill applies, you MUST invoke it — not negotiable).
2. **Just-in-time loading** — the heavy procedure enters context only when invoked,
   fresh and top-of-attention, dodging "lost-in-the-middle" degradation.
3. **Announce/commit** — the agent must declare the skill/step it is using, converting
   passive reading into a chosen action.
4. **Pressure-tested wording** — Iron Law + rationalization tables + red-flag lists,
   empirically hardened against the excuses agents actually generate under pressure.

Three OpenCode-specific facts compound the regression:

- **The autoinjection plugin uses a dead hook.** `skill-autoinjection.js` registers
  `experimental.chat.system.transform`, which OpenCode **silently discards**
  (issue #17100, closed "not planned"). If confirmed, `optimize-tokens` and `use-todo`
  have not been injecting at all. Superpowers' own OpenCode adapter uses
  `experimental.chat.messages.transform` — the working path.
- **Plugin hooks can't hard-enforce.** `tool.execute.before` throws don't intercept
  subagent (`task`) tool calls (#5894). OpenCode's real hard layer is native
  `permission` maps, which *do* reach subagents.
- **No `default_agent` is set,** so a plain session gets none of the lifecycle.

**The inventory is already essentially correct.** The genuinely multi-consumer
disciplines are already skills; the single-consumer procedures are already embedded in
their agents. This is therefore a **rework of *form* and *enforcement wiring*, not a
re-inventory.**

### Goal

Restore reliable workflow compliance by re-establishing the four forces on top of the
existing (correct) inventory, using OpenCode's actual capabilities.

### Non-goals

- Multi-runtime portability. Decision: **OpenCode-first, single platform.** Multi-runtime
  support was aspirational and is dropped; this unlocks OpenCode-specific enforcement and
  lets us delete platform-adaptation cruft.
- Re-inventorying skills/agents. The set of skills and agents stays as-is.

## Approaches

### Approach 1: Restore the four forces on the existing inventory (recommended)

Keep the current placement (locality rule: embed single-consumer, skill multi-consumer)
and add back the enforcement forces: fix the injection hook, add an always-on gateway,
set `default_agent`, add native-`permission` hard gates, and rewrite every procedure to
the superpowers form with pressure-testing.

**Pros:** Directly targets the confirmed root cause; preserves the correct inventory;
uses OpenCode's real mechanisms; enforcement is layered (mechanical + structural +
linguistic) so no single point of failure.
**Cons:** Large — full pressure-testing of ~7 skills + 8 agents is the bulk of the effort.
**Effort:** High (mostly scenario authoring).

### Approach 2: Re-skill everything (revert to pure superpowers topology)

Turn every embedded procedure back into a standalone invokable skill, including
single-consumer ones (SDD, finishing).

**Pros:** Maximizes the just-in-time + announce/commit forces uniformly.
**Cons:** Violates the locality principle (single-consumer logic scattered into skills
the orchestrator must re-load); more files; doesn't address the dead hook or missing
mechanical gates on its own.
**Effort:** High, with worse cohesion.

### Approach 3: Fat agents + hard hooks only

Keep procedures embedded, re-pressurize the prose, and lean entirely on mechanical gates.

**Pros:** Fewest files.
**Cons:** OpenCode plugin hooks don't reach subagents, so mechanical gating is limited to
tool boundaries — it cannot enforce semantic invariants (TDD-first, verify-before-done).
Embedded prose still gets skimmed (lost-in-the-middle). Highest residual drift.
**Effort:** Medium, lowest assurance.

## Recommendation

**Approach 1.** It is the only option that addresses all four lost forces *and* the three
OpenCode plumbing facts, while preserving the locality-based inventory the user endorsed.
Enforcement is deliberately layered so that mechanical, structural, and linguistic gates
back each other up.

## Design Details

### Section 1: Placement (locality rule)

Two orthogonal axes: **where a procedure lives** (placement) and **how it is enforced**
(enforcement). Placement follows locality:

| Procedure | Consumers | Placement |
|-----------|-----------|-----------|
| test-driven-development | build (+ orchestrate enforces) | **skill** |
| systematic-debugging | orchestrate, build, dogfood | **skill** |
| verification-before-completion | build, orchestrate, review, dogfood | **skill** |
| consider-feedback | orchestrate, build | **skill** |
| use-git | orchestrate, build | **skill** |
| optimize-tokens | all (autoinjected) | **skill** |
| use-todo | all (autoinjected) | **skill** |
| subagent-driven-development | orchestrate only | **embed** in orchestrate |
| brainstorming | design only | **embed** in design |
| writing-plans | plan only | **embed** in plan |
| finishing / dispatching-parallel / requesting-review | orchestrate only | **embed** in orchestrate |

This matches the current file topology — no inventory change. **All skills** (including
`create-*` and `use-*`) are pressure-tested — see Section 6.

**`use-todo` — the workflow spine (design note).** `use-todo` is not generic list
hygiene; it is a core compliance mechanism and must be rewritten to reflect that. Its
intended role is the durable, authoritative representation of workflow state: every
lifecycle phase, gate, and skill-checklist item becomes a todo, so the list *is* where
the agent is in the workflow. Two coupled functions:

- **Source of truth for progress** — after context compaction, the agent trusts the todo
  list (with `git log` and the SDD progress ledger) over recollection, preventing skipped
  or repeated steps.
- **Structural half of the commitment loop** — announcing a skill commits the agent
  verbally; the todo commits it structurally. An open, visible todo item is why a step
  cannot be silently dropped.

`use-todo` is therefore tightly coupled to the gateway (Section 2, which *requires*
spawning a todo per checklist item) and to SDD's progress ledger. The current ~20-line
skill reads as "make a list for ≥3 steps" and must be rewritten to encode the
source-of-truth / spine framing.

### Section 2: The gateway skill

A new slim skill (`workflow-gateway`) injected **every turn** via
`experimental.chat.messages.transform`. Content:

- **Iron Law / 1% rule** — before ANY response (including clarifying questions), check
  whether a skill or the orchestrate lifecycle applies; if there's even a 1% chance, use it.
- **Rationalization table** — the anticipated excuses ("just a simple question", "let me
  explore first", "I remember this skill") each paired with a rebuttal.
- **Compact workflow map** — dev task → orchestrate lifecycle; bug → systematic-debugging;
  etc. Trigger conditions only, never a workflow summary (a summary creates a shortcut).
- **Announce-and-todo requirement** — announce "Using [skill] to [purpose]", then create a
  todo per checklist item.
- **SUBAGENT-STOP guard** — subagents dispatched for a specific task skip the gateway
  (prevents re-discovery recursion).

Kept under 200 words (always-loaded budget). OpenCode-only, so no platform-adaptation prose.

### Section 3: Injection plumbing fix

`skill-autoinjection.js`:
- Swap `experimental.chat.system.transform` → `experimental.chat.messages.transform`
  (the working path). **P0 verifies this empirically with a marker probe before we rely
  on it.**
- Inject `workflow-gateway` first, then `optimize-tokens`, `use-todo`.
- **Delete `TOOL_MAPPING`** — it exists only for cross-runtime tool substitution; with
  OpenCode-only, skills speak OpenCode tools directly. Removes the H3 duplication entirely.
- Keep the dedup tracker and per-agent `skills` frontmatter override.

### Section 4: `default_agent`

`opencode.jsonc` → `default_agent: "orchestrate"`. This sets the *launch* agent only (tab
still cycles primaries), so it's a convenience, not a lock. The gateway injection —
global across all agents/sessions — is what actually guarantees the workflow check
travels to whatever primary is active.

### Section 5: Mechanical + structural gates

**Tier H — mechanical (native `permission` maps, reach subagents):**
- Non-build agents: `edit`/`write` deny-rest + allow-list (`**/*.md`, `.docs/**`,
  `*.json*`, `.opencode/**`). Enforces "only build writes source" by construction.
- Read-only agents (critique, review, research, dogfood): `edit`/`write`/`bash` denied.
- `orchestrate.permission.task`: whitelist only (already present); `build.permission.task: deny`
  (already present) so it can't sub-delegate around gates.

**Tier S — structural (workflow shape):**
- verify-before-done, gate-passing, TDD evidence: the review subagent re-runs/inspects,
  and orchestrate won't advance a phase without a clean report. Cannot be tool-gated
  (semantic), so enforced by the lifecycle + review agent.

**Tier L — linguistic (pressure-tested form), backstopped by Tier S:**
- TDD-first, root-cause-before-fix, no-performative-agreement, load-rules-first, the
  gateway 1% rule. No mechanical backstop on subagents → rely on hardened wording.

### Section 6: Form + pressure-testing

Every rewritten skill and each agent's critical gates adopt the superpowers form:
Iron Law, rationalization/red-flag tables, "match the form to the failure", **no nuance
clauses** ("unless it matters" reopens negotiation), graphviz **only at drift/branch
points**, announce-and-todo.

**Validation — full pressure-testing** (honoring `create-skill`'s Iron Law):
- **RED:** run the scenario *without* the gate (with a no-guidance control), capture the
  model's verbatim rationalizations.
- **GREEN:** minimal wording that counters those specific rationalizations.
- **REFACTOR:** re-run 5×, catch new rationalizations, harden.
- Scenarios weaponize time pressure, sunk cost, authority, exhaustion.
- Transcripts saved to `.docs/reports/pressure-tests/<skill-or-gate>.md`.

Harness: pressure scenarios are executed by dispatching a subagent with the scenario
prompt and observing behavior — no new test framework required.

Full pressure-test targets: **every skill** — test-driven-development,
systematic-debugging, verification-before-completion, consider-feedback, use-git,
optimize-tokens, use-todo, use-tmux, create-skill, create-agent, create-rule,
create-plugin — plus the gateway and each of the 8 agents' critical gates.
(`subagent-driven-development` has no standalone skill body; its content is embedded in
orchestrate and is pressure-tested there as an agent gate.)

### Section 7: Build order (phases)

- **P0 — Verify plumbing.** Marker-probe `system.transform` vs `messages.transform` in a
  live OpenCode instance. Confirm the injection path before building on it.
- **P1 — Fix wiring (highest leverage).** Plugin hook swap + `workflow-gateway` skill +
  `default_agent` + permission hard-gates. After P1, injection works and gates exist.
- **P2 — Rewrite the ~7 core skills to form + pressure-test each.**
- **P3 — Rewrite the 8 agents' critical gates to form + pressure-test each.**
- **P4 — Simplify + integrate.** Strip multi-runtime cruft (CLAUDE.md claims, skill
  platform-adaptation prose, TOOL_MAPPING), close remaining stale-ref debt, dogfood the
  full lifecycle by running a real task through it.

P2 and P3 are the bulk (the cost of full pressure-testing) and can themselves be executed
through the SDD lifecycle — the overhaul dogfoods its own workflow.

## Edge Cases

- **`messages.transform` also unreliable / version-specific.** P0 must prove the injection
  path. If both hooks fail on the installed OpenCode version, fall back to native
  `AGENTS.md` rules for the gateway content (soft, lower assurance) and record the
  limitation. Do not proceed past P1 assuming injection works.
- **Permission allow-list too narrow.** A non-build agent may legitimately need to write a
  non-doc file (e.g., a generated fixture). Symptom: a blocked edit. Fix: widen the
  allow-list; the deny-rest default is intentionally conservative.
- **Gateway injected into subagents causes re-discovery loops.** Mitigated by the
  SUBAGENT-STOP guard; if OpenCode injects globally, the guard text must make subagents
  skip the gateway. Verify subagents are treated as fresh contexts (research flagged this
  as partially undocumented — re-brief subagents explicitly in each dispatch).
- **Pressure-test non-convergence.** If a gate's wording still fails after 5× hardening,
  escalate: the invariant may need a structural (Tier S) backstop rather than linguistic
  enforcement alone.
- **Per-agent `permission.deny` ignored via SDK (#6396).** If sessions are launched via
  the OpenCode SDK rather than the TUI/CLI, verify the deny actually applies; the gate is
  only real if enforced on the invocation path in use.
- **SDD stub skill.** `subagent-driven-development/SKILL.md` is a 111-word stub while the
  real content is embedded in orchestrate. Keep the directory (scripts + reference prompts)
  but ensure nothing dispatches the stub as a skill.
