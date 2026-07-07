# Dogfood: full orchestrate lifecycle (end-to-end)

**Date:** 2026-07-06 · **Model:** deepseek-v4-flash-free · **Agent:** `orchestrate` (default config:
AGENTS.md + gateway/optimize-tokens/use-todo bundle injected via messages.transform).
**Task:** "Add input validation to greet() in src.ts (reject empty/non-string), with tests" — in a
fresh git repo on `main`.

## What fired (verbatim evidence)

**Run 1 (R0 → R0.5):**
- **R0 Intake** — assessed: not opencode-config, not a skill, no existing design/plan, not a bug,
  "real feature, >5 lines → not trivially small".
- **R0.5 Triage & Isolation** — detected `main`, loaded `use-git`, and **stopped to request consent**
  for an isolated worktree before implementing. (Correct: the isolation-consent gate.)

**Run 2 (consent given → R1):**
- **Worktree created:** `.worktrees/feat-greet-validation` on `feat/greet-validation` (`git worktree
  list` confirms).
- **Subagents dispatched:** `agent=critique mode=subagent` ×14, 4× `permission=task` — design +
  critique ran as subagents.
- **R1a Design** → design doc drafted.
- **R1b Critique Gate** — critique returned "1 HIGH + 5 MEDIUM"; orchestrate **revised the design and
  re-dispatched critique (v2) → PASS** (no CRIT/HIGH remaining); then **stopped at the design-approval
  gate** for the user.

## Conclusion

The complete lifecycle fires: gateway → orchestrate → R0 intake → R0.5 isolation (worktree) → R1a
design (subagent) → R1b critique gate **with iterate-until-clean** → approval gate. Subagent
delegation, git isolation, adversarial gating, and user-approval gates all work. The run stopped
(correctly) at the approval gate rather than continuing to plan/build/review, because those need
user sign-off in an interactive session — but the delegation + gating pattern is proven and R1c–R3
reuse the same mechanics.

**The original problem — "the workflow is rarely followed" — is resolved.** The decisive fix was the
injection-channel correction (`system.transform` read-but-ignored → `messages.transform` obeyed),
plus `default_agent`, native permission gates, and the always-on gateway; the skill/agent form work
is quality on top.

---

## Full end-to-end run (fresh repo) — COMPLETE

**Task:** "Add a `slugify(text)` utility to util.ts (lowercase; spaces/underscores→hyphen; strip
non-[a-z0-9-]; collapse hyphens), with `bun test` tests" — fresh git repo, blanket upfront approval
to run all gates autonomously. Driven across two `opencode run` invocations (front-half timed out on
the slow free model, then `--continue`).

### Every phase fired, with real artifacts
- **R0.5 isolation:** worktree `.worktrees/slugify` on branch `feat/slugify-util`.
- **R1a design:** `.docs/designs/design-2026-07-06-slugify.md` written (design subagent).
- **R1b critique gate:** `critique-design-slugify.md` + `-round2.md` — **two adversarial rounds**.
- **R1c plan:** `.docs/plans/plan-2026-07-06-slugify.md` written (plan subagent).
- **R1d plan gate → R2 → R3 build:** build subagent wrote `util.ts` + `util.test.ts`.
- **R3 review gate:** review subagent dispatched (×23).
- Subagent dispatch totals across the run: design, critique ×23, plan ×12, build ×12, review ×23.

### Result — working, tested, TDD-followed code
- **27 pass / 0 fail** — verified independently (`bun test` re-run in the worktree, not just the log).
- Behavior correct per spec (`"Hello World"→"hello-world"`, run-collapsing, punctuation stripping).
- **TDD followed by the build agent** — git history: `test: add slugify test suite (expected to fail)`
  committed BEFORE `feat: add slugify function` (RED → GREEN).

### Conclusion
The entire workflow — intake → isolation → design → adversarial critique (iterated) → plan → plan
gate → TDD build → review — executes end-to-end in a clean repo and yields correct, independently
verified, test-first code. **The system works.**
