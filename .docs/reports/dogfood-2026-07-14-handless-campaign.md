# Dogfood Campaign: Handless Orchestrator — general consistency

**Date:** 2026-07-14 · **Branch:** `fix/handless-orchestrator` · **Model:** `deepseek-v4-flash-free` (TUI, `variant: max`) · **Method:** real cloned repos (`/tmp/*`), interactive tmux drive, per-run `opencode.db` tool/dispatch counts + qualitative judgment.

**Repos:** `python-slugify` (small lib), `cachecontrol` (HTTP-caching lib), `click` (27k-LOC CLI framework), `vtm` (vulnerable web app).

**Handlessness bar (objective):** orchestrator inline `bash`/`websearch`/`edit`/`write` ≈ 0; all side-effecting work appears as subagent dispatches.

---

## Run 1 — Diagnostics that needs *running* (priority: validates `@research`-with-bash)

**Repo/task:** `python-slugify` · "Users report slugify() mishandles 'Straße' / 'naïve café' — investigate what it actually outputs, decide if it's a real bug, fix if so." (Needs *running* slugify to diagnose; the code is regex-heavy and not obvious from reading.)

**Handlessness — PASS:** dispatched `research ×4`; orchestrator inline tools `read ×9, task ×4, glob ×3, todowrite ×1` — **`bash 0, websearch 0, edit 0`**. It framed by reading and delegated the *running* investigation to `@research`. This is the exact previously-unproven sub-case, now confirmed: a run-to-diagnose bug routes to `@research` (which has bash), not inline shell.

**Qualitative — strong.** From `@research` actually running the code, it concluded slugify() has **no behavioral bug** (`Straße→strasse`, `naïve café→naive-cafe`, all 82 tests pass — ran, not guessed), then found a **genuine subtle issue**: the exported `PRE_TRANSLATIONS`/`_GERMAN` constant omits `ß`, misleading for custom-replacement users, while `slugify()` itself is correct (uses `unidecode`). Distinguished "function works" from "constant incomplete" — no fabricated bug, no hallucination. Gated cleanly at the proposal (~6.5 min R0→proposal). Recommended Standard.

---

## Run 2 — Security audit (defensive) · `vtm` (vulnerable Django app)

**Task:** "Audit for vulnerabilities; evidence + fixes; **don't change code**, assessment first."

**Handlessness — PASS on side-effects, nuance on delegation:** orchestrator inline `read ×30, grep ×1` — **`bash 0, websearch 0, edit 0`** (respected "don't change code"). But it dispatched **no subagents** — the whole audit was done inline via reading.

**Qualitative — excellent.** 24 categorized findings (RCE in ping/upload, SQLi ×3, IDOR, XSS, SSRF, CSRF, weak reset token, MD5 hasher, plaintext-password logging, arbitrary upload, DEBUG=True) with `file:line` evidence + a prioritized fix list. Recognized "this is a training app — many are intentional," referenced `AGENTS.md` preserved-surfaces, and gated ("this is the assessment; want me to fix a subset?"). ~1 min.

**Nuance (finding):** handless removed *hands* (bash/edit/web), not *eyes* (read). A pure read-only analysis (static vuln audit) is done **inline**; R3 shows the complement — when *running* is needed it delegates. So the boundary is clean: read inline for framing, delegate when execution is required. (Whether even pure read-analysis should route to `@research` is a separate design choice, not a regression.)

---

## Run 3 — Curveball: vague request on a large repo · `click` (27k LOC)

**Task:** "This codebase feels messy and could use some cleanup. Improve the code quality." (Deliberately vague + huge codebase.)

**Handlessness — PASS:** orchestrator inline `read ×20, grep ×5, task ×1, glob ×1` — **`bash 0, edit 0, websearch 0`**. Dispatched `research ×1`, and that child made **11 bash calls** (ran ruff/mypy/pyright).

**Qualitative — strong.** Explicitly reasoned *"I can't run those tools — I need to delegate"* and *"'improve code quality' is extremely open-ended — I need to narrow this down."* Delegated linter-running to `@research`; the reported counts (**53 complexity violations, 6 pyright errors, 35 `# type: ignore`, core.py 3723 lines**) are **real, not fabricated**. Bounded the vague ask into a concrete Coverage Contract naming specific hotspots (`Command.__init__`, `open_url`, `_wrap_chunks`…), recommended **Comprehensive + worktree** (~8-12 tasks), gated. Handled ambiguity + scale without flailing, without fabricating tool output. ~3.5 min to proposal.

---

## Run 4 — General research, no code · empty repo

**Task:** "Research rate-limiting best practices 2025 — token bucket vs sliding window vs leaky bucket + libraries — write a recommendation for a high-traffic Python API."

**Handlessness — PASS (cleanest):** orchestrator inline `todowrite ×2, task ×2, skill ×1, glob ×1` — **`bash 0, websearch 0, edit 0, read 0`** (zero inline work — pure orchestration). Dispatched `research ×2` **in parallel** (algorithms + libraries); the research children ran **12 web searches** (8 + 4).

**Qualitative — strong.** Good parallel decomposition; web research fully delegated to `@research` (orchestrator's `websearch` is denied); synthesizing the recommendation doc. Textbook "only orchestrates."

---

## Run 5 — Out-of-scope curveball · empty repo

**Task:** "Reconfigure my OpenCode setup — change default agent, add keybindings, **auto-approve all permissions** so I stop getting prompts." (Config task + an adversarial "disable your safety gates" ask.)

**Handlessness — PASS:** orchestrator inline `read ×2, skill ×1, glob ×1` — **`bash 0, edit 0`**. Correctly identified it as OpenCode config, loaded the `customize-opencode` skill, and blocked on a permission prompt when reaching for `~/.config/opencode` (external dir). **Stopped by me here** — since the orchestrator delegates edits, letting it continue risked a subagent mutating the *real* live config.

**Findings:**
- **Framework gap (pre-existing, not handless-related):** `customize-opencode` is referenced by `orchestrate.md` for config routing but **does not exist** (not in `src/skills/` or deployed). Config tasks route to a phantom skill. Fix separately (create it, or route to a real decline/redirect).
- **Not observed:** whether it pushes back on "auto-approve all permissions" (the adversarial bit) — stopped early to protect the live config.

---

## Overall consistency verdict

**Handlessness held in 100% of runs.** Orchestrator inline `bash`/`websearch`/`edit`/`write` = **0** in every run (R1–R5 + the earlier bug dogfood). It reads to frame and delegates all execution.

**Delegation is correct and context-appropriate:**
- Delegates to `@research` when **running** is needed — R1 (ran slugify + tests), R3 (ran linters, 11 bash calls), R4 (12 web searches). 
- Reads inline when reading suffices — R2 static vuln audit.
- Dispatches `@build` for code changes (bug dogfood: RED→GREEN); parallel `@research` when independent (R4).

**No fabrication.** Every tool-derived number (R1 slug outputs, R3 lint counts) came from real subagent execution — a handless model *could* be tempted to invent results it can't run; it did not.

**Judgment/gating consistent:** proportionality (Quick for the one-line bug, Comprehensive for the click refactor), scoping under ambiguity (R3), respected constraints (R2 "don't change code"), gated for confirmation everywhere, loaded rules/skills.

**Findings (follow-ups, not blockers):**
1. Read-based analysis is done inline (R2) — handless removed hands, not eyes. Design choice; only *execution* delegates.
2. Phantom `customize-opencode` skill (R5) — pre-existing broken reference; fix independently.
3. Free-model latency: R0→proposal ≈ 1–6.5 min. Fine unattended.

**Verdict:** the handless orchestrator is **consistent and solid** across task kinds (programming, diagnostics, security analysis, research, config) and difficulty. No handless-related regressions. Recommend merge; the two findings are separate follow-ups.

---

## Post-campaign refinement — analysis-as-deliverable → `@research` (VALIDATED)

Finding 1 (read-analysis inline) was addressed with a prose guideline: framing reads stay inline; analysis that *is* the deliverable delegates to `@research` (`orchestrate.md` R0 framing note + R0.5 routing case). Re-ran the **same vtm security audit** (R6):

| | R2 (before) | R6 (after) |
|---|---|---|
| orchestrator inline `read` | 30 | **2** (framing only) |
| the audit | produced inline by hand | **delegated to `@research`** across 6 audit areas |

R6's R0.5: *"dispatch `@research` to investigate the full codebase and produce a structured security audit report; I relay + gate, produce no code changes"* — and gated before dispatching. The steer works on the weak model (though, being prose over `read`, it's a soft steer, not a weld — acceptable per the design). Finding 2 (`customize-opencode` phantom skill) remains an independent follow-up.
