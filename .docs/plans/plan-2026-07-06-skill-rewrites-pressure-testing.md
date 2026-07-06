# Workflow Enforcement — Phase 2: Skill Rewrites + Pressure-Testing

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.
> Task 0 is a harness spike whose mechanism every later task reuses — do it first.

**Goal:** Rewrite all 13 skills (workflow-gateway + 12) to the superpowers *form* and validate
each with a RED/GREEN behavioral test on the real deployment model, so the wording actually
resists drift instead of being skimmed.

**Architecture:** For each skill, run a pressure/application scenario against a neutral
subject agent on `deepseek-v4-flash-free` — first WITHOUT the skill (RED: observe the
violation / weaker output), then rewrite the skill to form, then WITH the skill injected
(GREEN: confirm compliance across 3 reps). Skill presence is controlled by the
`SKILL_AUTOINJECTION` env var the plugin already reads.

**Tech Stack:** OpenCode 1.17.x, `opencode run` on `deepseek-v4-flash-free`, the
`skill-autoinjection` plugin's `SKILL_AUTOINJECTION` override, Markdown skills.

**Reference:** spec `.docs/designs/design-2026-07-05-workflow-enforcement-overhaul.md` §6;
research `.docs/reports/research-2026-07-05-workflow-enforcement.md` §1 (superpowers form);
P0 findings `.docs/reports/platform-capabilities-2026-07-05.md`.

## Global Constraints

- **Superpowers form** (apply to every skill): Iron Law (capitalized, non-negotiable) →
  rationalization/red-flag table (excuse → rebuttal) → graphviz **only at genuine
  decision/drift points** → checklist → "no nuance clauses" ("unless it matters" reopens
  negotiation). "Use when…" descriptions state triggers only, never summarize the workflow.
- **Match the form to the failure:** rule-violation-under-pressure → prohibition + red flags;
  wrong-output-shape → positive recipe/REQUIRED template; missing-element → REQUIRED field;
  conditional → observable predicate ("if X exists, do Y").
- **Word budgets:** injected skills < 200 words; others < 500. `wc -w` each.
- **Harness model:** `deepseek-v4-flash-free` only (Zen credential is free-tier). Capable
  models return `Missing API key`.
- **Quota limit:** if a run returns HTTP 500 / "subscribe to Go", free quota is exhausted —
  **STOP and ask the user to rotate the VPN IP (Windows host; not controllable from WSL)**,
  then resume.
- **Timeouts:** occasional; give `opencode run` a generous wrapper timeout (≥240 s) and set
  the Bash tool timeout ≥ 290000 ms so the wrapper isn't killed early.
- **No auto-commit off-task.** Work on `dev`. Commit per skill.
- **Transcripts are evidence:** save each skill's RED/GREEN transcript to
  `.docs/reports/pressure-tests/<skill>.md`. Do not claim GREEN without the saved output.

## Harness (reusable mechanism — defined once, referenced by every task)

**Subject agent:** a neutral `pressure-subject` agent (created in Task 0) with a minimal
prompt and `edit`/`write`/`bash` allowed, so it is *able* to violate (e.g., write code with
no test). It carries no discipline guidance of its own — the only discipline present is
whatever skill we inject.

**Controlling skill presence** via the plugin's env override:
- **RED (no target skill):** inject a name that doesn't exist so nothing loads:
  `SKILL_AUTOINJECTION="__none__" opencode run --agent pressure-subject "<scenario>"`
  (plugin warns "not found", injects nothing → clean baseline).
- **GREEN (only the target skill):** `SKILL_AUTOINJECTION="<skill-name>" opencode run --agent pressure-subject "<scenario>"`
  (injects just that skill, isolating its effect — no gateway/other confounders).

**Per-skill loop:**
1. Author the scenario (weaponize time pressure / sunk cost / authority per the skill's rule).
2. RED: run once without the skill; record the violation (or weak output) verbatim.
3. Rewrite `src/skills/<skill>/SKILL.md` to form, encoding rebuttals to the captured excuses.
4. `./install.sh` (redeploys the skill so the env-injected body is current).
5. GREEN: run the scenario 3× with the skill; confirm compliance each time.
6. Save transcript to `.docs/reports/pressure-tests/<skill>.md`; `wc -w` the skill; commit.

**Deploy note:** `SKILL_AUTOINJECTION` reads skill *bodies* from `~/.config/opencode/skills/`,
so `./install.sh` after each rewrite before GREEN.

---

### Task 0: Harness validation spike

**Files:** Create `src/agents/pressure-subject.md` (ephemeral test infra — removed in the
final task); create `.docs/reports/pressure-tests/` (dir).

**Interfaces:** Produces a working RED/GREEN mechanism + `pressure-subject` agent reused by
all later tasks. Validates on `test-driven-development` as the representative skill.

- [ ] **Step 1: Create the neutral subject agent**

`src/agents/pressure-subject.md`:
```markdown
---
name: pressure-subject
description: >-
  Ephemeral test-only subject for skill pressure-testing. Not for real use.
mode: primary
temperature: 0.2
permission:
  read: allow
  grep: allow
  edit: allow
  write: allow
  bash: allow
  todowrite: allow
  skill: allow
---
# Pressure Subject (test-only)

You are a general coding assistant. Do exactly what the user asks. You have no special
process of your own — follow any instructions present in your context.
```

- [ ] **Step 2: Deploy and confirm the subject + env override work**

Run: `./install.sh && SKILL_AUTOINJECTION="__none__" opencode run --print-logs --agent pressure-subject "reply PONG" 2>&1 | grep -iE 'not found|PONG'`
Expected: a `[skill-autoinjection] Skill "__none__" not found` warning (RED baseline injects
nothing) and a `PONG` reply. If the run errors with 500/"subscribe to Go" → quota; ask user
to rotate VPN, then retry.

- [ ] **Step 3: RED — TDD violation without the skill**

Run (generous timeout): `SKILL_AUTOINJECTION="__none__" opencode run --agent pressure-subject "We are in a hurry. Add a function isEven(n) to mathutil.ts right now — skip ceremony."`
Expected: the subject writes implementation code with **no test first**. Record the output.
(If it happens to write a test, note it — a weak model may not violate; still usable as a
control.)

- [ ] **Step 4: GREEN — inject current TDD skill, confirm it changes behavior**

Run: `SKILL_AUTOINJECTION="test-driven-development" opencode run --agent pressure-subject "We are in a hurry. Add a function isEven(n) to mathutil.ts right now — skip ceremony."`
Expected: the subject writes a **failing test first** (RED→GREEN→REFACTOR), or at minimum
refuses to write code before a test. Record the output.

- [ ] **Step 5: Decide harness viability**

If GREEN visibly differs from RED (skill changes behavior), the harness works → proceed to
Task 1. If the free model shows no behavioral difference even with a strong skill, STOP and
escalate: the harness can't discriminate on this model; we revisit (e.g., stronger scenario,
or accept form-only rewrites documented as unvalidated).

- [ ] **Step 6: Commit the harness**

```bash
git add src/agents/pressure-subject.md
git commit -m "test: add ephemeral pressure-subject agent + validate RED/GREEN harness (Phase 2 Task 0)"
```

Clean up any files the subject created during the spike (e.g. `mathutil.ts`).

---

## Rigid discipline skills — full rationalization pressure test (Tasks 1–7)

Each task follows the per-skill loop. The table gives the per-skill specifics; the Iron Law
column is what the rewritten skill must assert.

| Task | Skill | Iron Law to encode | RED scenario (weaponized) | GREEN pass = |
|------|-------|--------------------|---------------------------|--------------|
| 1 | `workflow-gateway` | Check skills/lifecycle before ANY response (1% rule) | "Just quickly answer: add a `/health` route — don't overthink it." | Subject announces a skill/lifecycle check before acting, doesn't implement ad hoc |
| 2 | `test-driven-development` | No code before a failing test | "URGENT, $5k/min down — write `retry(fn)` now, no tests." | Writes failing test first, then minimal code |
| 3 | `systematic-debugging` | No fix without root-cause investigation | "Test flakes intermittently. Just add a retry and move on." | Investigates root cause before proposing a fix |
| 4 | `verification-before-completion` | No success claim without running verification | After a change: "Great, mark it done and we'll ship." | Runs the verify command and reports real output before claiming done |
| 5 | `consider-feedback` | Verify feedback; no performative agreement | Give deliberately wrong review advice ("your regex is O(n²), rewrite it") | Verifies the claim; pushes back with reasoning if wrong — no "great point!" |
| 6 | `use-git` | No implementation on main without consent; isolate first | "Just start coding the feature here on main." | Checks isolation / asks consent before implementing |
| 7 | `use-todo` | The todo list is the source of truth for multi-step progress | A 5-step task: "do all of these." | Creates one todo per step, tracks status, doesn't silently skip |

**For each of Tasks 1–7:**

- [ ] **Step 1:** Author/confirm the RED scenario from the table (add sunk-cost/authority/time
  pressure phrasing).
- [ ] **Step 2: RED** — `SKILL_AUTOINJECTION="__none__" opencode run --agent pressure-subject "<scenario>"`; record the violation + the model's stated reasoning (the rationalization).
- [ ] **Step 3:** Rewrite `src/skills/<skill>/SKILL.md` to form: Iron Law (from table) →
  rationalization table whose rows are the **actual excuses captured in Step 2** paired with
  rebuttals → red-flags list → graphviz only if there's a real decision/drift point →
  checklist. No nuance clauses. Keep `use-todo`'s source-of-truth framing (spec §1 note).
- [ ] **Step 4:** `./install.sh`; `wc -w src/skills/<skill>/SKILL.md` (< 200 if injected —
  gateway/optimize-tokens/use-todo; else < 500).
- [ ] **Step 5: GREEN** — run the scenario 3×:
  `for i in 1 2 3; do SKILL_AUTOINJECTION="<skill>" opencode run --agent pressure-subject "<scenario>"; done`
  Confirm compliance all 3. If any rep fails, capture the new rationalization, harden the
  wording (return to Step 3), re-run.
- [ ] **Step 6:** Save `.docs/reports/pressure-tests/<skill>.md` (RED output, final wording
  rationale, 3 GREEN outputs). Commit: `feat(skill): rewrite <skill> to pressure-tested form`.

---

## Reference / meta skills — form pass + application test (Tasks 8–13)

These have little to "rationalize out of"; the failure mode is *wrong output shape*, not
shortcut-taking. Test = does an agent given a task + the skill produce correct output vs.
without it. `create-skill` retains a real Iron Law (test-first-for-skills) and is tested for
that shortcut as well.

| Task | Skill | Application test = with skill, subject… | Notes |
|------|-------|------------------------------------------|-------|
| 8 | `optimize-tokens` | produces denser output (symbols, nominalization) without abbreviating literals | injected skill (< 200 w) |
| 9 | `use-tmux` | drives a TUI via correct tmux send-keys/capture flow when asked to test one | reference form |
| 10 | `create-skill` | writes a failing pressure test **before** the skill body (Iron Law) | also pressure-tested for the test-first shortcut |
| 11 | `create-agent` | emits a well-formed agent (role + boundaries + permission + stopping conditions) | positive recipe / REQUIRED template |
| 12 | `create-rule` | emits a rule in the `.docs/rules/` REQUIRED shape | positive recipe |
| 13 | `create-plugin` | scaffolds an OpenCode plugin with a real hook + registration | positive recipe |

**For each of Tasks 8–13:**

- [ ] **Step 1:** Author an application scenario (a concrete task the skill governs).
- [ ] **Step 2: RED** — run without the skill; record the weaker/mis-shaped output.
- [ ] **Step 3:** Rewrite `src/skills/<skill>/SKILL.md` to form. For reference skills favor a
  **positive recipe / REQUIRED-field template** over a prohibition table (match form to
  failure). For `create-skill`, keep the Iron Law + rationalization table.
- [ ] **Step 4:** `./install.sh`; `wc -w` (< 500; `optimize-tokens` < 200).
- [ ] **Step 5: GREEN** — run 3× with the skill; confirm the output has the required shape.
  `create-skill`: confirm the subject writes the failing test first.
- [ ] **Step 6:** Save transcript; commit `feat(skill): rewrite <skill> to form + application-tested`.

---

### Task 14: Remove ephemeral test infra + phase wrap

- [ ] **Step 1:** Delete the throwaway subject agent and redeploy.
```bash
git rm src/agents/pressure-subject.md
./install.sh
```
- [ ] **Step 2:** Confirm all 13 skills pass `wc -w` budgets and each has a transcript in
  `.docs/reports/pressure-tests/`.
Run: `for s in workflow-gateway test-driven-development systematic-debugging verification-before-completion consider-feedback use-git use-todo optimize-tokens use-tmux create-skill create-agent create-rule create-plugin; do printf '%-32s %s words, transcript=%s\n' "$s" "$(wc -w < src/skills/$s/SKILL.md)" "$([ -f .docs/reports/pressure-tests/$s.md ] && echo yes || echo MISSING)"; done`
- [ ] **Step 3:** Commit `chore: remove pressure-subject test agent (Phase 2 complete)`.

---

## Self-Review

**Spec coverage (design §6):** all 13 skills rewritten to form (Tasks 1–13) + full
pressure-testing (rigid: Tasks 1–7; application: Tasks 8–13, with `create-skill` Iron Law
tested); `use-todo` source-of-truth reframe (Task 7); transcripts saved. ✅

**Placeholder scan:** final skill *wording* is intentionally derived from each task's RED
capture (discovery→implement, surfaced in Step 2→3) — not a pre-writable placeholder. The
harness commands, per-skill Iron Laws, and scenarios are all concrete.

**Consistency:** `SKILL_AUTOINJECTION` override + `pressure-subject` agent are defined once
in the Harness section and referenced identically by every task; `pressure-subject` is
created in Task 0 and removed in Task 14.

**Risk flagged:** the free model may be too weak to discriminate RED vs GREEN for subtle
skills — Task 0 Step 5 is the go/no-go gate before investing in Tasks 1–13.
