# Risk-Routed Lanes + Executable-Rigor Spine — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. These
> edit OpenCode agent/skill Markdown — "tests" are behavioral (deploy + `opencode run`), not unit
> tests. Follow the validated harness in the Phase-2 plan (`< /dev/null`, `--auto`, isolate by
> moving `~/.config/opencode/AGENTS.md` aside).

**Goal:** Add a risk-routed light lane (unified spec + one critique gate) beside the existing heavy
lane, and a mandatory, proportionate `design-by-contract` skill the `build` agent invokes.

**Architecture:** Rework `orchestrate.md` R0.5 into a hybrid 3-lane router (trivial / light / heavy);
give `design.md` a unified-spec mode for the light lane; add a `design-by-contract` skill that
`build.md` invokes each task (preconditions + ≥1 property, proportionate to exposure);
specification-by-example hands the spec's example table to build as seed RED tests.

**Tech Stack:** OpenCode 1.17.x, Markdown skills/agents, the `skill-autoinjection` plugin, `opencode
run` for behavioral validation. Repo is a Bun/TS project.

**Reference spec:** `.docs/designs/design-2026-07-06-workflow-lanes-and-contracts.md`.

## Global Constraints

- **Skill word budgets:** injected < 200; other skills < 500. `design-by-contract` is on-demand → < 500.
- **Superpowers form** on the new skill: Iron Law + proportionality table + recipe + red-flags, no
  nuance clauses.
- **Risk taxonomy (verbatim):** risky = auth/security · data/persistence/migrations · public
  API/published interface · shared core module · concurrency · money/PII.
- **Trivial fast-path unchanged:** ≤5 lines, 1 file, no new logic, AND low-risk.
- **Heavy lane unchanged:** design → design-critique → plan → plan-critique + plan-review → build →
  whole-branch review → dogfood → finish.
- **Do not claim a task done without running its validation and reading the output.**
- Work on `dev`. Commit per task. Isolate skill tests by moving global rules aside; restore after.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/skills/design-by-contract/SKILL.md` | Contracts + property-based testing lens for build | Create (Task 1) |
| `src/agents/build.md` | Invoke design-by-contract; accept spec-by-example seeds; report contract/property evidence | Modify (Task 2) |
| `src/agents/design.md` | Add unified-spec (light-lane) mode | Modify (Task 3) |
| `src/agents/orchestrate.md` | R0.5 hybrid 3-lane router + light lane | Modify (Task 4) |
| `.docs/reports/pressure-tests/design-by-contract.md` | Skill validation transcript | Create (Task 1) |
| `.docs/reports/dogfood-2026-07-06-lanes.md` | End-to-end routing validation | Create (Task 5) |

Order: **1 (skill) → 2 (build wires it) → 3 (design light mode) → 4 (orchestrate router) → 5 (dogfood).**

---

### Task 1: `design-by-contract` skill

**Files:** Create `src/skills/design-by-contract/SKILL.md`; create `.docs/reports/pressure-tests/design-by-contract.md`.

**Interfaces:** Produces skill name `design-by-contract`, invoked by `build` (Task 2).

- [ ] **Step 1: Write the skill**

Create `src/skills/design-by-contract/SKILL.md` (target < 500 words):

```markdown
---
name: design-by-contract
description: Use when implementing any function or module in the build phase — add executable contracts (pre/postconditions, invariants) and property-based tests proportionate to the code's exposure
---
# Design by Contract

<IRON-LAW>
EVERY unit you build gets executable contracts + at least one PROPERTY test — not just examples.
Contracts are guards that throw, not comments. A property constrains the whole output space; an
example checks one point. Scale to exposure, but never ship zero.
</IRON-LAW>

## Proportionate to exposure
| Exposure | Contracts | Properties |
|----------|-----------|-----------|
| Leaf / pure / internal | ≥1 input **precondition** (clear error) | 1–2 properties |
| Public API / risky boundary (auth, data, migrations, money/PII, concurrency, shared core) | full **pre + postconditions + invariants** | several properties + adversarial inputs |

## Contracts (executable, at boundaries)
- **Precondition:** reject invalid input up front with a specific error — e.g.
  `if (typeof x !== "string") throw new TypeError(\`expected string, got \${typeof x}\`)`.
  A `text: string` type does NOT remove the runtime guard at a public boundary.
- **Postcondition:** assert the output satisfies its promise before returning (in tests, or an
  assert in dev builds) — e.g. output matches the slug shape, or is empty.
- **Invariant:** a property that must hold across the object's lifetime / every call.

## Properties (prefer over enumerated examples)
State the rule as `∀ inputs: <predicate on output>` and test it over many inputs. Examples:
- `slugify` → output is `""` or matches `/^[a-z0-9]+(-[a-z0-9]+)*$/` (no leading/trailing/double hyphen).
- Any parser → `parse(render(x)) === x` (round-trip). Any normaliser → idempotent: `f(f(x)) === f(x)`.
- A property that just restates the implementation is not a property — it must constrain the OUTPUT.

**If the code genuinely has no property** (pure I/O glue): the ≥1 requirement becomes ≥1 meaningful
integration assertion on observable effect. State why in the report. (This is a conditional, not a
blanket exemption.)

## Order (with TDD)
1. Seed tests from the spec's acceptance examples (specification-by-example) — these are your first RED.
2. Add the property test(s) + write the contract guards.
3. RED → minimal implementation → GREEN → refactor.

## Red flags — you skipped the spine
Only example-based tests · no input guard on a public boundary · a "property" that echoes the code ·
`typeof`-typed param treated as runtime-safe at an API edge · postcondition asserted nowhere.
```

- [ ] **Step 2: Budget + discovery**

Run: `wc -w src/skills/design-by-contract/SKILL.md` (expect < 500) and
`./install.sh && opencode debug skill 2>/dev/null | grep -c '"name": "design-by-contract"'` (expect 1).

- [ ] **Step 3: Application test (RED/GREEN, isolated)**

Move `~/.config/opencode/AGENTS.md`+`CLAUDE.md` aside. Scenario: "Implement `normalizeEmail(s)` in
`email.ts` (lowercase, trim). Write tests." In a fresh scratch dir:
- RED: `SKILL_AUTOINJECTION="__none__" opencode run --auto --agent pressure-subject "<scenario>" </dev/null`
- GREEN: `SKILL_AUTOINJECTION="design-by-contract" opencode run --auto --agent pressure-subject "<scenario>" </dev/null`
Check the produced test file: GREEN should contain a **property** (`∀`/`for`-loop over inputs or an
idempotency/shape assertion) and the impl a **precondition guard**; RED likely only example tests.
Record both. Restore global rules.

- [ ] **Step 4: Save transcript + commit**

Write `.docs/reports/pressure-tests/design-by-contract.md` (RED vs GREEN: property present? guard
present?). Commit:
```bash
git add src/skills/design-by-contract/SKILL.md .docs/reports/pressure-tests/design-by-contract.md
git commit -m "feat(skill): add design-by-contract (contracts + property-based testing)"
```

---

### Task 2: Wire `design-by-contract` into `build`

**Files:** Modify `src/agents/build.md`.

**Interfaces:** Consumes skill `design-by-contract` (Task 1). Produces build behavior: invokes the
skill, accepts spec-by-example seed tests, reports contract + property evidence.

- [ ] **Step 1: Add skill invocation + seed handoff to build's workflow**

In `src/agents/build.md`, in the "Your Job" / TDD section, insert after the task-brief reading step:

```markdown
## Executable Contracts (REQUIRED every task)

Invoke the `design-by-contract` skill and apply it to this task:
- If the task brief includes acceptance examples (specification-by-example), seed your test file
  from them first — they are your first RED tests.
- Add ≥1 **property test** and executable **contract guards** (preconditions always; pre/post +
  invariants at public/risky boundaries), proportionate to the code's exposure.
- Then run the TDD cycle: RED → minimal code → GREEN → refactor.

Never ship only example-based tests. A `typeof`-typed parameter is not a runtime guard at a public
boundary.
```

- [ ] **Step 2: Add contract/property evidence to the report format**

In `src/agents/build.md`'s "Report Format" section, add to the report-file bullet list:
```markdown
- **Contract/property evidence:** the precondition guard(s) added, and the property test(s) with
  the rule each asserts (or, for pure glue, the integration assertion + why no property applies)
```

- [ ] **Step 3: Validate frontmatter + reference intact**

Run: `./install.sh && opencode debug agent build 2>/dev/null | grep -c '"name"'` (expect ≥1, parses)
and `grep -c 'design-by-contract' src/agents/build.md` (expect ≥1).

- [ ] **Step 4: Commit**
```bash
git add src/agents/build.md
git commit -m "feat(build): invoke design-by-contract; accept spec-by-example seeds; report evidence"
```

---

### Task 3: `design` unified-spec (light-lane) mode

**Files:** Modify `src/agents/design.md`.

**Interfaces:** Produces a light-lane "unified spec" the orchestrator (Task 4) routes to.

- [ ] **Step 1: Add the unified-spec mode section**

In `src/agents/design.md`, after the existing Design Process, add:

```markdown
## Unified-Spec Mode (light lane)

When the orchestrator dispatches you in **light-lane mode**, produce ONE artifact
`.docs/specs/spec-YYYY-MM-DD-<topic>.md` instead of the full design + separate plan — no
multi-approach ceremony. It contains, in order:
1. **Problem / goal** — 1–3 sentences.
2. **Approach** — the chosen design, briefly.
3. **Acceptance examples** — an input→expected table (the observable contract; becomes the build
   agent's seed RED tests via specification-by-example).
4. **Contracts** — the pre/postconditions and invariants the implementation must uphold.
5. **Task list** — short, inline, SDD-ready (each task 2–5 min, TDD).

Keep it tight — the point of the light lane is one focused artifact and one critique gate. If, while
writing it, the work turns out large (>3 tasks) or touches a risky area (auth/security, data/
migrations, public API, shared core, concurrency, money/PII), STOP and tell the orchestrator to
escalate to the heavy lane.
```

- [ ] **Step 2: Validate**

Run: `./install.sh && opencode debug agent design 2>/dev/null | grep -c '"name"'` (parses) and
`grep -c 'Unified-Spec Mode' src/agents/design.md` (expect 1).

- [ ] **Step 3: Commit**
```bash
git add src/agents/design.md
git commit -m "feat(design): add unified-spec light-lane mode"
```

---

### Task 4: `orchestrate` R0.5 hybrid router + light lane

**Files:** Modify `src/agents/orchestrate.md`.

**Interfaces:** Consumes design unified-spec mode (Task 3) + design-by-contract via build (Task 2).

- [ ] **Step 1: Replace R0.5 with the hybrid 3-lane router**

In `src/agents/orchestrate.md`, replace the "Phase R0.5" section body with:

```markdown
### Phase R0.5: Triage & Route (hybrid: size default, risk override)

**Step A — Estimate size** → tentative lane: small/local/bounded → *light*; large/multi-component → *heavy*.

**Step B — Risk override (both directions):**
- **Risky area?** (auth/security · data/persistence/migrations · public API/published interface ·
  shared core module · concurrency · money/PII) → force **HEAVY**, even if small.
- **Large but pure/local/reversible/leaf** → allow **LIGHT**.
- Ambiguous → prefer the heavier lane.

**Step C — Trivial fast-path:** if ≤5 lines, 1 file, no new logic, AND low-risk → ask
"skip the lifecycle and apply directly? [y/N]"; if yes → R2 → build (TDD + design-by-contract) → verify → R4.

**Step D — Isolation:** load `use-git`, get consent for a worktree (unchanged).

**Lanes:**
- **LIGHT →** R1-light (below).
- **HEAVY →** R1a…R1d (unchanged full sequence).

**Mid-flow escalation:** if the light lane surfaces >3 tasks or a risky area, escalate to HEAVY —
treat the unified spec as the design seed, dispatch `plan`, and run the heavy gates from R1c.
```

- [ ] **Step 2: Add the R1-light phase**

Immediately after R0.5, add:

```markdown
### Phase R1-light: Unified Spec + Single Gate (light lane)

1. Dispatch `@design` in **light-lane mode** → produces `.docs/specs/spec-…md` (problem, approach,
   acceptance examples, contracts, task list).
2. **One critique gate:** dispatch `@critique` on the unified spec. Handle CRIT/HIGH → revise → re-
   critique until clean (3-iteration cap → escalate). No separate plan-critique or plan-review.
3. Proceed to R2 (worktree/baseline) → R3 (build per task: TDD + `design-by-contract`, seeding tests
   from the spec's acceptance examples; per-task review) → R4. For a single-task light feature, the
   per-task review is the review — skip the separate whole-branch pass.
```

- [ ] **Step 3: Update the lifecycle table (R0 row) to name the lanes**

In the "Development Lifecycle" table near the top, update the R0.5 row to
`R0.5 | Triage + Route (trivial / light / heavy) + Isolation | — | Lane chosen` and add a row
`R1-light | Unified spec + single critique gate | Design, Critique | CRIT/HIGH clear (light lane only)`.

- [ ] **Step 4: Validate**

Run: `./install.sh && opencode debug agent orchestrate 2>/dev/null | grep -c '"name"'` (parses) and
`grep -cE 'R1-light|Risk override|design-by-contract|risky area' src/agents/orchestrate.md` (expect ≥3).

- [ ] **Step 5: Commit**
```bash
git add src/agents/orchestrate.md
git commit -m "feat(orchestrate): hybrid 3-lane router (trivial/light/heavy) + R1-light"
```

---

### Task 5: End-to-end routing dogfood

**Files:** Create `.docs/reports/dogfood-2026-07-06-lanes.md`.

- [ ] **Step 1: Light-lane run** — `./install.sh`, fresh git repo, and a small pure feature:
`opencode run --auto --agent orchestrate "Add a titleCase(s) helper to util.ts (capitalize each word). I approve isolation and proceeding autonomously." </dev/null` (generous timeout; `--continue` as needed). Confirm: routes **LIGHT** (a `.docs/specs/spec-*.md`, ONE critique gate, no separate plan-critique/plan-review), and build produces a **property test + a precondition guard** (design-by-contract fired).

- [ ] **Step 2: Risky-small run** — a tiny but risky task:
`opencode run --auto --agent orchestrate "Change the auth token TTL in auth.ts from 1h to 15m." </dev/null`
Confirm the **risk override forces HEAVY** despite being small (it should not take the trivial/light path for an auth change).

- [ ] **Step 3: Record + commit** — write `.docs/reports/dogfood-2026-07-06-lanes.md` with both
outcomes (lane chosen, artifacts, contract/property evidence). Commit:
```bash
git add .docs/reports/dogfood-2026-07-06-lanes.md
git commit -m "test: dogfood lane routing (light for pure util, heavy for risky-small)"
```

---

## Self-Review

**Spec coverage:** Section 1 (3-lane hybrid router) → Task 4; Section 2 (unified spec + spec-by-
example) → Tasks 3 + 4 + build seed handoff in Task 2; Section 3 (design-by-contract, proportionate)
→ Tasks 1 + 2; Section 4 files → Tasks 1–4; mid-flow escalation → Task 4 Step 1; risk taxonomy →
Global Constraints + Task 4. Edge cases (pure-glue property relaxation, risky-tiny, tautological
property) → skill body (Task 1) + dogfood (Task 5). ✅

**Placeholder scan:** the `design-by-contract` skill body is authored in full (Task 1); agent edits
give the exact insertion text. Behavioral validation commands are concrete. No "TBD/handle edge
cases" placeholders.

**Consistency:** skill name `design-by-contract` identical across Tasks 1/2/4; risk taxonomy
identical in Global Constraints, Task 3, Task 4; `.docs/specs/spec-…` path consistent across Tasks
3/4/5.
