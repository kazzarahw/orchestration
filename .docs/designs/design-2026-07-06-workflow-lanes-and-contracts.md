# Design: Risk-Routed Lanes + Executable-Rigor Spine

## Context

The workflow-enforcement overhaul is validated and working (see
`dogfood-2026-07-06-lifecycle.md`): the full lifecycle fires end-to-end and produces correct,
TDD-followed, tested code even on a weak model. Reviewing that dogfood output surfaced two
refinements:

1. **The lifecycle over-ceremonies small work.** A ~15-line pure function (`slugify`) went through
   design → *two* design-critique rounds → plan → plan-critique → plan-review before any code —
   ~35 subagent dispatches, a mid-run timeout, and a `--continue`. The only sub-≤5-line fast-path
   exists, so "small-but-non-trivial" features fall into the full heavy lane.
2. **Rigor is front-loaded into prose, where it's a weak proxy.** The design-critique's key win was
   catching that the pipeline produced `"-x-"` not `"x"` (missing trim). But a *property test*
   ("output never starts/ends with a hyphen") would have caught that for free, at build time, with
   certainty. And the "reject non-string" gap slipped through every prose gate — an explicit
   *precondition* would have made it impossible. Prose review is a proxy for correctness;
   executable specs (tests, contracts, properties) are direct.

**Goal:** route work by risk so small/local features skip needless ceremony, and move correctness
enforcement from prose gates toward an executable spine (design-by-contract + property-based
testing) strong enough to make the lighter prose path safe.

### Non-goals
- Removing the heavy lane — large/risky work still gets full design→plan→critique→review→dogfood.
- Broader review-pass consolidation (user's #4) beyond what the light lane naturally removes —
  deferred.

## Approaches

### Routing: Risk-based vs Size-based vs Hybrid (chosen)
- **Risk-based:** classify purely by blast radius/reversibility. Principled but ignores that a large
  pure refactor is genuinely more work than a tiny one.
- **Size-based:** route by scope estimate. Simple but mis-routes the dangerous case (a 5-line auth
  change) — needs an always-heavy carve-out anyway.
- **Hybrid (chosen):** size gives the tentative lane; risk overrides it *both ways*. Best accuracy
  for two cheap triage checks.

### Executable-rigor lens: Default-on vs Risk-gated vs Advisory
- **Default-on, proportionate (chosen):** every build task gets preconditions + ≥1 property, scaled
  to exposure. Closes the exact gaps observed; a mandate, not a suggestion (advisory guidance
  erodes under pressure — a repeated finding this session).
- Risk-gated would have exempted the leaf `slugify` util that benefited. Advisory would erode.

## Recommendation

Hybrid risk-routing into three lanes + a default-on, proportionate `design-by-contract` skill that
`build` invokes every task. Reuse existing agents; the light lane *removes* steps rather than adding
machinery.

## Design Details

### Section 1: Three lanes, hybrid-gated (R0.5 rework)

| Lane | Trigger | Flow |
|------|---------|------|
| **Trivial** | ≤5 lines, 1 file, no new logic | fast-path → build (TDD) → verify → finish (existing) |
| **Light** (new default) | most features: local, bounded, low-risk | unified spec → **one** critique gate → build (TDD + contracts + properties) → per-task review → finish |
| **Heavy** | large **or** risky | design → design-critique → plan → plan-critique + plan-review → build → whole-branch review → dogfood → finish (today's full lane) |

**Hybrid gate (in R0.5):**
1. Estimate size → tentative lane (small → light, large → heavy).
2. **Risk override:**
   - Small **but** risky → bump to **heavy**. Risk = touches auth/security, data/persistence/
     migrations, public API/published interface, shared core module, concurrency, or money/PII.
   - Large **but** pure/local/reversible/leaf → allow **light**.
3. When ambiguous, prefer the heavier lane (accuracy-safe default).

**Mid-flow escalation:** if the light lane uncovers unexpected scope (>3 SDD tasks emerge) or a risk
surfaces mid-work, escalate to heavy — generate the design→plan split at that point and resume.

### Section 2: The light lane's unified spec (design + plan collapsed)

The `design` agent gains a **unified-spec mode**: it produces ONE artifact
`.docs/specs/spec-YYYY-MM-DD-<topic>.md` containing:
- **Problem / goal** (1–3 sentences).
- **Approach** (chosen design, briefly; no multi-approach ceremony for light work).
- **Acceptance examples** — an input→expected table (the observable contract).
- **Contracts** — the pre/postconditions/invariants the implementation must uphold (seeds §3).
- **Task list** — short, inline, SDD-ready (each task 2–5 min, TDD).

The `plan` agent is **skipped** in the light lane. **Specification-by-example:** the acceptance-
examples table is handed to `build` as the **seed test file**, which under TDD *is* the first batch
of RED tests. **One** critique gate reviews the whole spec (logic, edge cases, contract
completeness, YAGNI) before build. The heavy lane keeps design + plan as separate agents/artifacts
and its full gate sequence.

### Section 3: The `design-by-contract` skill (build invokes every task)

New `src/skills/design-by-contract/SKILL.md` — contracts + property-based testing as its
verification arm. **Default-on, proportionate to exposure:**
- **Every task:** input **precondition(s)** with clear errors + **≥1 property test**.
- **Public/risky boundary:** full **pre/postconditions + invariants**; several properties.
- **Leaf/pure:** minimal precondition + 1–2 properties.
- **Prefer a property over enumerated examples** where the property captures the rule
  (`∀ inputs: output matches /^[a-z0-9]+(-[a-z0-9]+)*$/ or is ""` beats five examples).
- Contracts are executable guards (asserts/guards that throw), not comments.

`build.md` invokes `design-by-contract` after reading the task brief and before/with its TDD cycle:
seed acceptance tests (from the spec) → add property tests + contract guards → RED → implement →
GREEN → refactor. The per-task/whole-branch review checks that contracts and ≥1 property are present
and meaningful (not tautological).

### Section 4: Files touched

- `src/agents/orchestrate.md` — rework R0.5 (hybrid routing, three lanes, mid-flow escalation); add
  the light-lane path (R1-light: unified spec → one critique → build); heavy lane unchanged.
- `src/skills/design-by-contract/SKILL.md` — new (form: Iron Law + proportionality table +
  property/contract recipe + red-flags).
- `src/agents/build.md` — invoke `design-by-contract`; accept spec-by-example seed tests; report
  contract + property evidence.
- `src/agents/design.md` — add unified-spec (light-lane) mode; keep full design mode for heavy lane.
- `src/agents/plan.md` — unchanged (heavy lane only).
- `.docs/` — new `specs/` dir for unified specs (light lane); `designs/` + `plans/` remain for heavy.

## Edge Cases

- **Mis-routed light→heavy:** handled by mid-flow escalation (generate design→plan split, resume).
  No rework of completed light artifacts — the unified spec becomes the design seed.
- **Risky-but-tiny:** the risk override forces heavy even at ≤5 lines (auth one-liner ≠ trivial).
  The trivial fast-path applies only when size is small AND risk is low.
- **Properties that don't apply:** some code has no clean property (pure I/O glue). Then ≥1 property
  requirement relaxes to "a meaningful integration assertion"; the skill states this explicitly as a
  conditional, not a blanket exemption (exemptions erode).
- **Contract noise:** proportionality prevents over-contracting leaves; a leaf util gets one
  precondition, not a ceremony of invariants.
- **Tautological properties:** the review gate rejects `expect(x).toBe(x)`-style non-properties; a
  property must constrain the output space, not restate the implementation.
- **Spec-by-example seed drift:** if build finds an acceptance example is wrong (contradiction), it
  reports it (DONE_WITH_CONCERNS / escalate) rather than silently "fixing" the spec.
