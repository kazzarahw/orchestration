# Handless Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `orchestrate` a pure orchestrator — `bash: deny`, `websearch/webfetch: deny` — so a weak model can no longer do investigation/building/web-research by hand; every side-effecting action is delegated.

**Architecture:** Strip the orchestrator's hands; re-route its former bash uses to agents that already have hands (`@build`, `@review`), and grant `@research` bash so delegated investigation can run diagnostics. The orchestrator learns git/test/codebase state only from subagents' structured reports + the SDD ledger. Full rationale: `.docs/designs/design-2026-07-14-handless-orchestrator.md`.

**Tech Stack:** Markdown agent definitions (OpenCode), deployed via `install.sh`. **No test suite** — verification is `opencode debug agent` (deterministic permission resolution) + a tmux dogfood (behavioral) + opencode.db (dispatch/inline-tool counts).

## Global Constraints
- `src/CLAUDE.md` symlinks `src/AGENTS.md`; root `CLAUDE.md` symlinks root `AGENTS.md` — edit the `AGENTS.md` targets only.
- Gates are plain messages, never the `question` tool (`.docs/rules/explicit-over-implicit`).
- Preserve house style (NO-list phrasing, section conventions); don't reflow unrelated content.
- Conventional commits.

---

### Task 1: Permission changes — strip the orchestrator's hands, give research bash

**Files:** Modify `src/agents/orchestrate.md` (frontmatter), `src/agents/research.md` (frontmatter).

- [ ] **Step 1: Pressure scenario (records the fix target)**
> A weak model on a bug task must be *structurally unable* to run `pytest`/`python`/`pip` or `websearch` itself — those calls must fail so it delegates. Verified via `opencode debug agent orchestrate` showing `bash:false`.

- [ ] **Step 2: `orchestrate.md` — deny hands.** In frontmatter `permission:`, change `bash: allow` → `bash: deny`; `websearch: allow` → `websearch: deny`; `webfetch: allow` → `webfetch: deny`. Leave `read`/`grep`/`edit`/`write`/`task`/`skill`/`todowrite` unchanged.

- [ ] **Step 3: `research.md` — grant bash.** In frontmatter `permission:`, change `bash: deny` → `bash: allow`. (Investigation must be able to run diagnostics.)

- [ ] **Step 4: Verify resolution.**
```bash
opencode debug agent orchestrate 2>/dev/null | grep -A2 '"bash"\|"websearch"' | head
opencode debug agent research    2>/dev/null | grep -A2 '"bash"' | head
```
Expected: orchestrate `bash`/`websearch`/`webfetch` resolve to deny/false; research `bash` allow/true.

- [ ] **Step 5: Commit** — `git commit -m "fix(agents): handless orchestrator — deny orchestrate bash/websearch, grant research bash"`

---

### Task 2: Strict-Boundaries anchor + handless operating model

**Files:** Modify `src/agents/orchestrate.md` (Strict Boundaries; intro).

- [ ] **Step 1:** In `## Strict Boundaries`, after the `NO inline implementation …` bullet, add:
```markdown
- NO doing work by hand — no shell, no web search, no inline investigation/debugging/building. Every command, diagnosis, test-run, and mutation is delegated to a subagent. The orchestrator READS to frame and DELEGATES to act; it learns codebase/git/test state only from subagents' structured reports and the SDD ledger, never by running anything itself.
```

- [ ] **Step 2:** In the agent intro paragraph (after "enforce quality gates …"), append one sentence:
```markdown
You are **handless**: you have no shell and cannot run, build, or search. Your only actions are reading (to frame), writing workflow artifacts (specs/plans/reports/ledger under `.docs/` and `.opencode/`), dispatching subagents, and gating on the human.
```

- [ ] **Step 3: Verify** — `grep -n "handless\|NO doing work by hand" src/agents/orchestrate.md` shows both.
- [ ] **Step 4: Commit** — `git commit -m "feat(orchestrate): state the handless operating model + boundary"`

---

### Task 3: R0 framing + R2 setup delegation

**Files:** Modify `src/agents/orchestrate.md` (Phase R0; Phase R2).

- [ ] **Step 1: R0 — frame without git.** In `### Phase R0`, replace any reliance on running `git log`/`status`/`branch` with read/grep/glob framing. Add a note:
```markdown
Frame from `read`/`grep`/`glob` over the repo and `.docs/` (request, existing designs/plans, code shape). You cannot run `git` — if a branch/history fact is genuinely needed for routing, obtain it via a brief `@research` recon dispatch; the Approach Proposal itself does not require git history.
```

- [ ] **Step 2: R2 — delegate worktree + setup + baseline.** Rewrite `### Phase R2: Setup Worktree + Baseline` so the orchestrator does NOT run bash. New content:
```markdown
### Phase R2: Setup Worktree + Baseline (delegated)

The orchestrator has no shell — dispatch a **setup task to `@build`** (it loads `git-workflow`, has bash):
1. Create the worktree/branch (native worktree tool preferred, git fallback) with the human-approved consent already given at R0.5.
2. Run project setup (auto-detect package manager) and verify a **clean baseline** (tests pass).
3. Report back: the **absolute worktree path**, branch name, test count, and baseline status.

The orchestrator gates on that report (baseline must be green) and records the worktree path in the ledger. Every subsequent build/review brief carries that path so the hands-agent operates in the worktree — the orchestrator never `cd`s.
```

- [ ] **Step 3: Verify** — `grep -n "delegated\|setup task to .@build\|absolute worktree path" src/agents/orchestrate.md`.
- [ ] **Step 4: Commit** — `git commit -m "feat(orchestrate): delegate R2 worktree/baseline setup (no inline bash)"`

---

### Task 4: R3 plumbing — briefs via read/write, diffs via @review, investigation via @research

**Files:** Modify `src/agents/orchestrate.md` (Phase R0.5 bug routing; Phase R3 SDD steps + scripts reference).

- [ ] **Step 1: Bug routing delegates investigation.** In `### Phase R0.5`, in the bug/systematic-debugging recommendation line, make root-cause investigation delegated:
```markdown
- Bug / test failure → **systematic-debugging** path: dispatch `@research` (it has bash) to investigate and report the root cause → minimal fix plan in `.docs/plans/` → `@build`. The orchestrator does not investigate by hand.
```

- [ ] **Step 2: Task briefs without the shell script.** In `### Phase R3`, replace `scripts/task-brief`-via-bash with: the orchestrator **reads** the plan file and **writes** the brief to `.opencode/sdd/task-N-brief.md` itself (it has `.opencode`/`.md` write). Update the "File handoffs" + "SDD scripts reference" bullets accordingly — the scripts remain for hands-agents that want them, but the orchestrator uses read+write.

- [ ] **Step 3: Review packages via @review.** Replace `scripts/review-package BASE HEAD` (orchestrator bash) with: the orchestrator passes the **BASE/HEAD range** (from subagent-reported SHAs / the ledger) to `@review`, and `@review` generates its own diff (it has bash; `review.md` already documents self-fetching). Remove the orchestrator's diff-generation step.

- [ ] **Step 4: Verify** — `grep -n "reads the plan\|@review.*own diff\|dispatch .@research. .*investigate" src/agents/orchestrate.md`; confirm no remaining instruction telling the orchestrator to *run* `scripts/*` or `git diff`.
- [ ] **Step 5: Commit** — `git commit -m "feat(orchestrate): R3 plumbing handless — briefs via read/write, diffs via @review, investigation via @research"`

---

### Task 5: R3b commit-ranges + R4 finish delegation

**Files:** Modify `src/agents/orchestrate.md` (Phase R3b; Phase R4).

- [ ] **Step 1: R3b ranges.** In `### Phase R3b`, the whole-branch commit range is computed by `@review` (or taken from the ledger's recorded SHAs), not by the orchestrator running `git merge-base`/`rev-parse`. Adjust the "Get commit range" bullet to pass branch + base info to `@review` and let it compute.

- [ ] **Step 2: R4 finish delegated.** In `### Phase R4`, keep the orchestrator's job = present options (plain message) + get the human's choice. Replace every inline `bash` block (test verify, `GIT_DIR=...`, `git merge`, `git worktree remove`) with: **dispatch the chosen finish action to `@build`** (verify tests, merge/push/cleanup per the choice) and relay its report. Keep the decision tables/menus; remove the orchestrator-run shell.

- [ ] **Step 3: Verify** — `grep -n '```bash' src/agents/orchestrate.md` returns **0** (no orchestrator-run shell blocks remain); `grep -n "dispatch.*@build.*finish\|@review.*compute" src/agents/orchestrate.md` present.
- [ ] **Step 4: Commit** — `git commit -m "feat(orchestrate): delegate R3b ranges + R4 finish execution (fully handless)"`

---

### Task 6: Deploy + dogfood the bug scenario

**Files:** none (runs install + a live session).

- [ ] **Step 1: Deploy + static.** `bash install.sh`; `opencode debug agent orchestrate | grep bash` → deny. `diff src/AGENTS.md src/CLAUDE.md` → in sync.

- [ ] **Step 2: Dogfood a bug (the failure mode).** Via tmux (see memory `opencode-headless-testing`), on a scratch repo with a real bug, prompt e.g. *"Fix the failing import in mod.py."* Expected observable: the orchestrator **dispatches `@research`** to investigate (does NOT run `bash`/`websearch` itself) and delegates the fix to `@build`. Confirm from opencode.db: for the run's root session, **inline `bash` = 0**, and child sessions include `research` + `build`. Record to `.docs/reports/dogfood-2026-07-14-handless.md`.

- [ ] **Step 3: Handle findings.** Any inline `bash` attempt that now *fails* (permission denied) and derails the run → the prose still tells it to do X by hand somewhere; fix that instruction (systematic-debugging), redeploy, re-run.

- [ ] **Step 4: Commit report** — `git commit -m "docs(report): handless orchestrator dogfood"`

---

## Self-Review
**Spec coverage:** design §1 (perms)→T1; §2 (anchor)→T2; §3 (re-routing: investigation→T4, R2→T3, review-diff→T4, ranges/finish→T5); §4 (state via ledger/reports)→T2+T3. **Placeholder scan:** `task-N`, `mod.py`, `BASE/HEAD` are product placeholders/examples, not plan gaps. **Consistency:** worktree-path-in-brief introduced T3, consumed T4/T5; `@research`+bash granted T1, used T4; "no ```bash blocks" is the T5 exit check for full handlessness. **Risk flagged:** if OpenCode subagents cannot operate in a named worktree path from their brief, T3 falls back to in-place work (no isolation) — surface to the user rather than silently dropping isolation.
