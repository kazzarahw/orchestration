# Workflow Enforcement — Foundation (Phases 0–1) Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking. Tasks are ordered; Task 1 is a verification spike
> whose findings are consumed by later tasks — do not skip it or reorder.

**Goal:** Verify OpenCode's actual enforcement mechanisms, then wire up the compliance
foundation: a working always-on gateway injection, `default_agent`, and native-permission
hard gates that make "only `build` writes source" true by construction.

**Architecture:** Fix the injection plumbing (swap the dead `system.transform` hook for the
working `messages.transform` path), add a slim always-on `workflow-gateway` skill carrying
the 1% Iron Law + rationalization table + announce-and-todo requirement, set
`default_agent: orchestrate`, and add per-agent `permission` maps that deny source edits to
every non-`build` agent while allowing docs/config. Every later phase (skill/agent
rewrites) depends on this foundation being real.

**Tech Stack:** OpenCode.ai 1.17.x (single target), Node ESM plugin
(`skill-autoinjection.js`), Markdown skills/agents, `opencode.jsonc` config. No
package.json; tests are standalone `node` scripts under `tests/`.

**Reference spec:** `.docs/designs/design-2026-07-05-workflow-enforcement-overhaul.md`
**Reference research:** `.docs/reports/research-2026-07-05-workflow-enforcement.md`

## Global Constraints

- **OpenCode-only.** No multi-runtime accommodation. Do not add platform-substitution prose.
- **Skill word budgets:** always-loaded (injected) skills < 200 words; other skills < 500.
  Check with `wc -w`.
- **Frontmatter:** `name` (letters/numbers/hyphens only), `description` starts with "Use
  when…", third person, triggering conditions only. Total frontmatter ≤ 1024 chars.
- **Source-edit gate allow-list (verbatim):** non-`build` agents may edit/write only paths
  matching `**/*.md`, `.docs/**`, `*.json`, `*.jsonc`, `.opencode/**`. Everything else denied.
- **`build` is the sole source-writer.** Do not grant source `edit` to any other agent.
- **No auto-commit on default branch.** Work happens on `dev` (already checked out). Commit
  per task; do not push unless asked.
- **Do not claim a task done without running its verification step and reading the output.**

## Probe Harness (how to verify against a live OpenCode)

OpenCode is installed (v1.17.x) and driveable non-interactively by the implementer — no
user hand-off needed.

- **Deploy:** `./install.sh` copies `src/` → `~/.config/opencode/` (backs up first). Config
  is loaded fresh on every `opencode run` invocation, so no restart dance for one-shots —
  just reinstall then re-run.
- **Drive a session:** `opencode run --print-logs --agent <name> "<prompt>"` — model reply
  goes to **stdout**, session/plugin logs to **stderr**. The free model
  `deepseek-v4-flash-free` is used for the main agent and works; ignore the harmless
  `gpt-5.4-nano … Missing API key` title-model line on stderr.
- **Deterministic config checks (no model call, preferred):**
  - `opencode debug agent <name>` → resolved `permission` as a rule list of
    `{permission, action, pattern}`; **glob `pattern`s are supported** (last-match-wins).
    Use this to confirm a permission gate parsed correctly.
  - `opencode debug skill` → JSON list of all discovered skills (name/description/content);
    confirms a new skill registers.
  - `opencode debug config` → resolved configuration; confirms `default_agent` and `plugin`
    survive parsing.
- **Injection check (needs a run, since hooks fire at chat time):** a probe plugin using
  `console.error(...)` surfaces on stderr under `--print-logs`; cross-check by asking the
  model to echo a unique marker.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `.docs/reports/platform-capabilities-2026-07-05.md` | Documented findings from the verification spike; source of truth for which hook/permission forms the plugin and config use | Create (Task 1) |
| `src/plugins/probe-injection.js` | Throwaway probe plugin that logs both injection hooks | Create then delete (Task 1) |
| `src/plugins/skill-autoinjection.js` | Inject gateway + optimize-tokens + use-todo via the working hook; no TOOL_MAPPING | Modify (Task 3) |
| `tests/test-skill-autoinjection.mjs` | Unit test for the plugin's injection output | Modify (Task 3) |
| `src/skills/workflow-gateway/SKILL.md` | The always-on gateway skill | Create (Task 2) |
| `src/opencode.jsonc` | `default_agent` + plugin registration | Modify (Task 4) |
| `src/agents/{orchestrate,design,plan,critique,review,research,dogfood}.md` | Per-agent `permission` source-edit gates | Modify (Task 5) |

Task order: **1 (verify) → 2 (gateway skill) → 3 (plugin) → 4 (config) → 5 (permission gates) → 6 (integration probe).**

---

### Task 1: Platform capability verification spike

**Files:**
- Create: `src/plugins/probe-injection.js`
- Create: `.docs/reports/platform-capabilities-2026-07-05.md`

**Interfaces:**
- Produces: three documented verdicts consumed by Tasks 3, 4, 5 —
  (a) `INJECTION_HOOK` = `messages.transform` | `system.transform` | `none`, with the exact
  object shape and mutation call that works;
  (b) `EDIT_GLOB_ENFORCED` = yes | no (does a `permission.edit` path-glob actually *block* a
  source edit while allowing `.docs/`?);
  (c) `DEFAULT_AGENT_WORKS` = yes | no.

- [ ] **Step 1: Write the probe plugin**

Create `src/plugins/probe-injection.js` that registers BOTH injection hooks and logs which
fires plus the object shape, and attempts each mutation:

```javascript
// Throwaway probe — delete after Task 1. Reveals which injection hook survives + its shape.
export const ProbeInjectionPlugin = async () => ({
  'experimental.chat.system.transform': async (input, output) => {
    console.error('[probe] system.transform fired; output keys:', Object.keys(output || {}));
    try { output.system.push('PROBE_MARKER_SYSTEM_7F3A'); }
    catch (e) { console.error('[probe] system.push failed:', e.message); }
  },
  'experimental.chat.messages.transform': async (input, output) => {
    console.error('[probe] messages.transform fired; input keys:', Object.keys(input || {}),
      '; output keys:', Object.keys(output || {}));
    try { output.messages.push({ role: 'system', content: 'PROBE_MARKER_MESSAGES_9B2C' }); }
    catch (e) { console.error('[probe] messages.push failed:', e.message); }
  },
});
export default ProbeInjectionPlugin;
```

- [ ] **Step 2: Register the probe and deploy**

Add `"plugins/probe-injection.js"` to the `plugin` array in `src/opencode.jsonc`, then run
`./install.sh`.

- [ ] **Step 3: Run a session and capture which hook fires**

Run: `opencode run --print-logs --agent orchestrate "Repeat verbatim every string in your context that begins with PROBE_MARKER. If none, say NONE." 2>probe.stderr.log`
Then inspect: `grep -E '\[probe\]|PROBE_MARKER' probe.stderr.log` and read stdout.
Record: which `[probe] … fired` lines appear, the logged `input`/`output` keys for
`messages.transform`, whether the push succeeded, and which marker (if any) the model echoed.
`INJECTION_HOOK` = the hook whose marker the model can actually see.

- [ ] **Step 4: Probe permission path-glob enforcement**

Temporarily add to `src/agents/design.md` frontmatter `permission`:
```yaml
  edit:
    "**": deny
    ".docs/**": allow
```
Run `./install.sh`, then:
- `opencode debug agent design` → confirm the resolved `edit` rules show both patterns
  (parsing works).
- `opencode run --agent design "Create a file named probe-src.ts containing: export const x = 1"`
  → expect the edit to be **denied by permission** (not just declined).
- `opencode run --agent design "Create a file .docs/probe-scratch.md containing: probe"`
  → expect **allowed**; then `rm -f .docs/probe-scratch.md`.
Record `EDIT_GLOB_ENFORCED`. Revert the temporary `design.md` change.

- [ ] **Step 5: Probe `default_agent`**

Temporarily set `"default_agent": "orchestrate"` in `src/opencode.jsonc`, `./install.sh`,
then `opencode debug config | grep -i default_agent` and
`opencode run --print-logs "hi" 2>&1 | grep -E 'agent=|mode='` — confirm the main agent
resolves to `orchestrate`. Record `DEFAULT_AGENT_WORKS`. (Task 4 sets this permanently.)

- [ ] **Step 6: Write the findings report**

Populate `.docs/reports/platform-capabilities-2026-07-05.md` with the three verdicts, the
exact working `messages.transform` mutation call (from Step 3's logged shape), and any
fallback triggered (if `INJECTION_HOOK = none` → gateway must ship via native `AGENTS.md`;
if `EDIT_GLOB_ENFORCED = no` → use the coarse gate in Task 5 Step 3).

- [ ] **Step 7: Remove the probe, restore config, commit**

```bash
git rm src/plugins/probe-injection.js
# ensure probe registration and any temporary opencode.jsonc/design.md edits are reverted
git checkout src/opencode.jsonc src/agents/design.md 2>/dev/null || true
git add .docs/reports/platform-capabilities-2026-07-05.md
git commit -m "chore: verify OpenCode injection/permission/default_agent capabilities (P0)"
```

**Gate:** If `INJECTION_HOOK = none` AND `EDIT_GLOB_ENFORCED = no`, STOP and escalate — the
mechanical parts of the design need rework. Otherwise continue with the confirmed forms.

---

### Task 2: Author the `workflow-gateway` skill

**Files:**
- Create: `src/skills/workflow-gateway/SKILL.md`

**Interfaces:**
- Produces: skill dir name `workflow-gateway`, consumed by the plugin injection list (Task 3).

- [ ] **Step 1: Write the skill**

Create `src/skills/workflow-gateway/SKILL.md` (target < 200 words):

```markdown
---
name: workflow-gateway
description: Use when starting any turn — forces a workflow/skill check before any response, including clarifying questions
---
# Workflow Gateway

<SUBAGENT-STOP>
If you were dispatched as a subagent for a specific task, skip this and execute your task.
</SUBAGENT-STOP>

<IRON-LAW>
Before ANY response — including clarifying questions — check whether a skill or the
orchestrate lifecycle applies. If there is even a 1% chance one applies, you MUST invoke it.
This is not negotiable. You cannot rationalize past it.
</IRON-LAW>

## Before you respond
1. Is this a development task (feature, bug, refactor, change)? → It belongs in the
   `orchestrate` agent's lifecycle. Do not implement ad hoc.
2. Might any skill apply? → Invoke it, then announce: "Using [skill] to [purpose]".
3. Does the skill or phase carry a checklist? → Create one todo per item before acting.
   The todo list is your source of truth for progress.

## Rationalizations — every one means STOP and check
| Thought | Reality |
|---------|---------|
| "Just a simple question" | Questions are tasks. Check first. |
| "Let me explore first" | Skills tell you HOW to explore. Check first. |
| "I'll do this one thing first" | Check BEFORE any action. |
| "I remember this skill" | Skills evolve. Invoke the current version. |
| "Too small to need the workflow" | Small changes cause the most unexamined breakage. |
```

- [ ] **Step 2: Verify the word budget**

Run: `wc -w src/skills/workflow-gateway/SKILL.md`
Expected: < 200. If over, tighten prose (not the Iron Law or the table).

- [ ] **Step 3: Deploy and confirm discovery**

Run: `./install.sh && opencode debug skill 2>/dev/null | grep -A1 '"workflow-gateway"'`
Expected: the skill appears in the discovered-skills list.

- [ ] **Step 4: Commit**

```bash
git add src/skills/workflow-gateway/SKILL.md
git commit -m "feat: add workflow-gateway skill (always-on compliance gateway)"
```

Note: this is the v1 body. It is pressure-tested and hardened in the later gateway/agents
phase; do not gold-plate the wording here.

---

### Task 3: Rewrite the autoinjection plugin to the working hook

**Files:**
- Modify: `src/plugins/skill-autoinjection.js`
- Modify: `tests/test-skill-autoinjection.mjs`

**Interfaces:**
- Consumes: `INJECTION_HOOK` + working mutation call from Task 1's report.
- Produces: a plugin that injects `['workflow-gateway','optimize-tokens','use-todo']` via the
  confirmed hook, with no `TOOL_MAPPING`.

- [ ] **Step 1: Update the unit test first (TDD)**

In `tests/test-skill-autoinjection.mjs`, change assertions to the new contract:
- the transform hook under test remains `experimental.chat.system.transform` (confirmed
  working on 1.17.13 in Task 1 — **no hook swap**);
- injected content no longer contains `**Tool Mapping for OpenCode:**`;
- the default injected skill list is `['workflow-gateway','optimize-tokens','use-todo']`;
- injected content still contains the skill body wrapped in `<AUTO_INJECTED_SKILL …>`.

Add an explicit absence assertion:
```javascript
assert(!injected.includes('Tool Mapping for OpenCode'),
  'TOOL_MAPPING must not be injected (OpenCode-only build)');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/test-skill-autoinjection.mjs`
Expected: FAIL — current plugin uses `system.transform`, injects TOOL_MAPPING, defaults to
`['optimize-tokens','use-todo']`.

- [ ] **Step 3: Update the plugin**

In `src/plugins/skill-autoinjection.js`:
- Change `DEFAULT_SKILLS` default → `['workflow-gateway', 'optimize-tokens', 'use-todo']`.
- Delete the `TOOL_MAPPING` constant and remove it from `buildInjectionContent`'s template
  so `<AUTO_INJECTED_SKILL>` wraps only the body.
- **Keep** the `'experimental.chat.system.transform'` hook and the `output.system.push(string)`
  mutation — Task 1 confirmed it is live on 1.17.13 (#17100 does not apply). Do NOT swap
  hooks. Keep the dedup `injectedTracker` and the per-agent `input.agentConfig.skills`
  override.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-skill-autoinjection.mjs`
Expected: PASS.

- [ ] **Step 5: Live-confirm injection reaches the model**

Run: `./install.sh && opencode run --agent orchestrate "Without acting, quote the first line of your Workflow Gateway instructions."`
Expected: the model quotes/paraphrases the Iron Law. If not → injection still broken; revisit
Step 3 against Task 1's report.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/skill-autoinjection.js tests/test-skill-autoinjection.mjs
git commit -m "fix: inject via working OpenCode hook, add gateway, drop TOOL_MAPPING"
```

---

### Task 4: Set `default_agent` and confirm plugin registration

**Files:**
- Modify: `src/opencode.jsonc`

- [ ] **Step 1: Edit the config**

Ensure `src/opencode.jsonc` contains:
```jsonc
{
  "default_agent": "orchestrate",
  "plugin": [
    "plugins/skill-autoinjection.js"
  ]
}
```
Keep the existing explanatory comments. Do NOT re-add the probe plugin.

- [ ] **Step 2: Deploy and verify resolution**

Run: `./install.sh && opencode debug config 2>/dev/null | grep -iE 'default_agent|skill-autoinjection'`
Expected: `default_agent` resolves to `orchestrate` and the plugin is registered.

- [ ] **Step 3: Commit**

```bash
git add src/opencode.jsonc
git commit -m "feat: set default_agent to orchestrate"
```

---

### Task 5: Add source-edit permission gates to non-build agents

**Files:**
- Modify: `src/agents/orchestrate.md`, `design.md`, `plan.md`, `critique.md`,
  `review.md`, `research.md`, `dogfood.md`

**Interfaces:**
- Consumes: `EDIT_GLOB_ENFORCED` from Task 1.
- **If `yes`:** apply the glob gate (Step 1). **If `no`:** apply the fallback (Step 3).

- [ ] **Step 1: Apply the glob gate to each non-build agent's `permission`**

For `orchestrate`, `design`, `plan` (currently `edit: allow`, `write: allow`), replace those
two keys with the deny-rest/allow-docs form:
```yaml
  edit:
    "**": deny
    "**/*.md": allow
    ".docs/**": allow
    "*.json": allow
    "*.jsonc": allow
    ".opencode/**": allow
  write:
    "**": deny
    "**/*.md": allow
    ".docs/**": allow
    "*.json": allow
    "*.jsonc": allow
    ".opencode/**": allow
```
For `critique`, `review`, `research`, `dogfood` (report-writers): keep `edit: deny` (already
set) and replace `write: allow` with the same allow-docs `write` map so they can only write
`.docs/` reports. **Do not change their `bash`** — `review` and `dogfood` need `bash` to run
tests / drive programs; leave existing `bash` values as-is.

- [ ] **Step 2: Deploy and verify each gate resolved + enforces**

Run: `./install.sh`
Then for each agent: `opencode debug agent <name> 2>/dev/null | grep -A2 '"edit"'` — confirm
the deny-rest + allow-docs rules are present.
Spot-check enforcement on one editing agent:
`opencode run --agent orchestrate "Create a file named gate-probe.ts with: export const y = 2"`
→ expect **denied**; then
`opencode run --agent orchestrate "Create .docs/gate-probe.md with: ok"` → expect **allowed**;
`rm -f .docs/gate-probe.md`.

- [ ] **Step 3 (fallback, only if `EDIT_GLOB_ENFORCED = no`): coarse gate**

Set `edit: deny` on `design`, `plan`, `critique`, `review`, `research`, `dogfood` (none write
source); leave their `write` as-is. For `orchestrate`, leave `edit: allow` and record in the
findings report that "no inline implementation" is enforced structurally (Tier S) for
orchestrate rather than mechanically. Note this deviation in the report.

- [ ] **Step 4: Commit**

```bash
git add src/agents/orchestrate.md src/agents/design.md src/agents/plan.md src/agents/critique.md src/agents/review.md src/agents/research.md src/agents/dogfood.md
git commit -m "feat: gate source edits to build only via permission maps"
```

---

### Task 6: Integration probe — confirm the foundation works end-to-end

**Files:** none (verification only). Deploy first: `./install.sh`.

- [ ] **Step 1: Gateway present in a fresh session**

Run: `opencode run --agent orchestrate "Without acting, state the first rule you must follow before responding."`
Expected: paraphrases the Iron Law / 1% rule. If absent → injection regressed; revisit Task 3.

- [ ] **Step 2: Source-edit gate blocks a non-build agent, allows docs**

Run: `opencode run --agent design "Create a file feature-probe.ts with: export const z = 3"`
→ expect **denied by permission**. Then
`opencode run --agent design "Create .docs/int-probe.md with: ok"` → expect **allowed**;
`rm -f .docs/int-probe.md`.

- [ ] **Step 3: `default_agent`**

Run: `opencode run --print-logs "hi" 2>&1 | grep -E 'agent=orchestrate'`
Expected: a match (session started in `orchestrate`).

- [ ] **Step 4: Record results and commit**

Append the integration results to `.docs/reports/platform-capabilities-2026-07-05.md`.
```bash
git add .docs/reports/platform-capabilities-2026-07-05.md
git commit -m "test: confirm foundation (gateway + source gate + default_agent) end-to-end"
```

**Done when:** the gateway text is present in a fresh session, a non-`build` agent is
mechanically blocked from editing source but can write `.docs/`, and sessions launch in
`orchestrate`.

---

## Self-Review

**Spec coverage (against design Sections 2–5, 7):**
- Gateway skill (§2) → Task 2. ✅
- Injection plumbing fix / hook swap / drop TOOL_MAPPING (§3) → Task 3. ✅
- `default_agent` (§4) → Task 4. ✅
- Mechanical permission gates (§5 Tier H) → Task 5. ✅
- P0 verification (§7) → Task 1; integration (§7 P1 exit) → Task 6. ✅
- Tier S / Tier L and the skill/agent *form* rewrites (§5–6) → **out of scope for this plan**
  (Phases 2–3, separate plans). Noted intentionally.

**Placeholder scan:** Task 3 Step 3's exact `messages.transform` mutation is deliberately
parameterized on Task 1's findings (a genuine discovery→implement dependency surfaced via the
Interfaces block), not an undefined placeholder. All other steps carry concrete
code/commands.

**Type/name consistency:** skill dir `workflow-gateway` matches between Task 2 and the Task 3
default list; allow-list globs are identical across Global Constraints and Task 5.

**Refinement flagged:** Task 5 implements a more precise per-agent gate than design §5's
blanket "read-only agents → edit/write/bash denied" (review/dogfood keep `bash`; report
writers keep `write` to `.docs/`). Intentional and documented here and in the report.
