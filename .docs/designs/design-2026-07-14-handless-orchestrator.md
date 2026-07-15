# Design: Handless Orchestrator — the orchestrator only orchestrates

## Context

Live evidence (opencode.db, a real ComfyUI bug-fix run) showed `orchestrate` doing the work **itself**
— `bash ×87` (debugging/investigation), `websearch ×10`, inline `read`/`edit` — and dispatching only
**`build ×1`**. It behaved like a direct agent that occasionally taps a subagent, not an orchestrator.

**Root cause:** `orchestrate` has hands — `bash: allow`, `websearch: allow`, scoped `edit`. A weak
model with hands uses them; prose telling it to "delegate all work" cannot restrain a weak model that
holds the tools. This is the exact lesson the abandoned rebuild learned and solved with
*sighted-but-handless* (see the archived `plan-build-architecture` memory). This behavior is
**pre-existing** in master (pre-diligence bug runs show the same "investigate inline → build ×1"
shape); it is not caused by the diligence merge, and the fix is orthogonal to it.

**Why not a command-scoped `bash` allowlist.** OpenCode's `bash` permission *does* support command
patterns (verified: `git *`→allow, `*`→deny resolves). It looked like we could allow "control-plane"
bash and deny "work" bash. It fails: the orchestrator's *legitimate* bash includes **test-runs** (R2
baseline gate, R4 pre-merge verify → `pytest`/`npm test`), which are the **same commands** an
investigation uses. No pattern can distinguish "pytest to verify the gate" from "pytest to
investigate." So there is no clean targeted middle — it's fully-handless or leaky-prose.

## Approaches

### Approach 1: Fully handless orchestrator — *recommended*
`orchestrate` gets `bash: deny`, `websearch/webfetch: deny`. It keeps only what orchestration needs:
`read`/`grep`/`glob` (framing), `.docs`/`.opencode` `write` (authoring specs/plans/reports/ledger),
`task` (dispatch), `skill`, `todowrite`. Everything with side effects is delegated.
**Pros:** structurally airtight; matches "the orchestrator only orchestrates"; leans on hands-agents
that already exist. **Cons:** re-routes R2/R4 + SDD plumbing; one downstream permission change.
**Effort:** Medium.

### Approach 2: Command-scoped `bash` allowlist
Rejected — the dual-use test-run problem above makes it leaky.

### Approach 3: Keep `bash`, add prose "delegate investigation" discipline
Rejected — a weak model with hands ignores prose (the framework already proved this).

## Recommendation

**Approach 1.** The deeper investigation shows there is no honest halfway, and fully-handless is what
the orchestrator *should* be. Feasible because the framework already has the hands.

## Design Details

### Section 1: Permission changes
- **`src/agents/orchestrate.md`:** `bash: allow → deny`; `websearch: allow → deny`;
  `webfetch: allow → deny`. Unchanged: `read`/`grep`/`glob` allow; `edit`/`write` stay `.docs`/`.md`/
  `.json`/`.opencode`-scoped (authoring workflow artifacts is legit output, not "work"); `task` map;
  `skill`; `todowrite`.
- **`src/agents/research.md`:** `bash: deny → allow`. Load-bearing: delegated investigation must be
  able to *run* diagnostics (reproduce the error, run tests). Today it can't — which is *why* the
  orchestrator investigated inline.

### Section 2: The handless operating model (the anchor)
The orchestrator: **reads** (framing) → **writes** workflow docs (spec/plan/report/ledger) →
**dispatches** subagents → **gates** on the human. It learns git/test/codebase state **only from
subagents' structured reports + the SDD ledger**, never by running commands itself. A new
Strict-Boundaries line encodes this: *NO doing work by hand — no shell, no web search, no inline
investigation/building; every command, diagnosis, and mutation is delegated. Read to frame; delegate
to act.*

### Section 3: Re-routing the orchestrator's former bash uses
- **Bug/root-cause investigation** → dispatch `@research` (now with `bash`) to investigate and report
  the root cause; the orchestrator does not investigate inline.
- **Worktree + project setup + baseline tests (R2)** → dispatch a setup task to `@build` (has `bash`):
  create the worktree on the branch, run setup, verify baseline, and **report the worktree path +
  test count**. The orchestrator gates on that report.
- **Worktree navigation** → every build/review brief names the **worktree path**; the hands-agent
  `cd`s there itself. The orchestrator never needs `cd`.
- **`task-brief` / `sdd-workspace`** → the orchestrator extracts the task by **reading** the plan and
  **writing** the brief to `.opencode/sdd/` itself (no shell). It creates the ledger/workspace via
  `.opencode` `write`.
- **`review-package` (diff generation)** → `@review` (has `bash`) generates its own diff from a
  BASE/HEAD range the orchestrator passes; the orchestrator stops running `git diff`. `review.md`
  already documents self-fetching the diff.
- **Commit ranges** → computed by the subagent that needs them (`@review`), not the orchestrator.
- **R4 finish execution** (merge / worktree remove / pre-merge test verify) → the orchestrator
  presents the options and gets the human's choice (gating), then **dispatches** the git + test ops
  to `@build`; it does not run them.

### Section 4: State awareness without hands
The orchestrator tracks the branch through the **SDD ledger** (`.opencode/sdd/progress.md`, which it
writes) and subagents' **structured summaries** (status, commit SHAs, paths, test counts — already
required by `AGENTS.md`). R0 framing uses `read`/`grep`/`glob` over the repo + `.docs/` (existing
artifacts, code shape); it no longer runs `git log`/`status` — recent-history facts it needs come
from a `@research`/recon dispatch or are simply not required for the Approach Proposal.

## Edge Cases
- **Subagent can't find the worktree** — the brief always carries the absolute worktree path from the
  R2 setup report; if a report omits it, the orchestrator treats R2 as failed and re-dispatches.
- **A subagent itself needs to delegate** (e.g., `@research` finds it must build a repro) — `@research`
  can `task → general`; it does not bounce back to the orchestrator.
- **Trivial Quick task** — still delegates: one `@build` task carries the whole change (including its
  own verification). The orchestrator writes no ledger for Quick (unchanged).
- **The orchestrator "wants" to peek** (run a quick command to check something) — structurally
  impossible now (`bash: deny`); it must dispatch or infer from a report. This is the point.
- **git-workflow skill** — still loaded, but by the `@build` setup task that creates the worktree, not
  by the orchestrator inline.

## Refinement (2026-07-14): analysis-as-deliverable → `@research`

The dogfood campaign (`.docs/reports/dogfood-2026-07-14-handless-campaign.md`) showed the orchestrator
does *read-based* analysis inline — e.g. it produced a 24-finding security audit itself via `read ×30`.
Handless removed *hands* (bash/edit/web), not *eyes* (read), so this isn't a regression, but it's the
orchestrator producing a *deliverable* by hand.

**Guideline (prose, not structural).** Distinguish **framing** from **deliverable**:
- **Framing reads stay inline** — the orchestrator must read enough to classify, decompose, and write
  the Coverage Contract; it can't delegate its own comprehension, and a dispatch round-trip for that
  is overhead.
- **Analysis-as-deliverable delegates to `@research`** — when the report *is* what the user asked for
  (audit / assessment / "understand & document X" / research write-up), `@research` produces it
  (methodology + a persisted `.docs/reports/` artifact) and the orchestrator relays + gates. On a
  large/unfamiliar codebase, a recon `@research` pass keeps the orchestrator lean even during framing.

**Why prose, not a weld:** `read` is a single tool — there's no way to deny "analysis reads" while
allowing "framing reads." So this is a *soft steer* a weak model won't always follow, and that's
acceptable: the failure mode (inline read-analysis) is safe and often good — a consistency/context
concern, not a safety hole like `bash` was. `@research` also runs the *same* model, so the wins are
methodology + context isolation + durable report, not smarter analysis. Changes: `orchestrate.md` R0
framing note + an R0.5 routing case.
