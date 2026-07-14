# Dogfood: Handless Orchestrator

**Date:** 2026-07-14 · **Branch:** `fix/handless-orchestrator` · **Model:** `deepseek-v4-flash-free` (TUI, `variant: max`) · **Method:** tmux interactive drive + opencode.db tool/dispatch counts.

## Static verification
`opencode debug agent orchestrate` resolves `bash: false`, `websearch: false`, `webfetch: false`; `research` resolves `bash: true`. Symlinks in sync. `orchestrate.md` has **0** ```` ```bash ```` blocks and no remaining "the orchestrator runs X" instructions.

## Behavioral dogfood — the exact failure mode, reversed
Target: `ho-bug/cart.py` — a **mutable-default-argument state-leak** bug (`def new_cart(items=[])`) with a failing test. This is the class of task where the ComfyUI orchestrator did `bash ×87` of inline investigation.

**Handless orchestrator run** (`ses_09e83831bffe…`):
- **R0.5:** diagnosed the root cause by **static analysis (reading)** — "Classic Python mutable default argument pitfall" — no shell attempt, no flailing against the denied `bash`. Coverage Contract routed the fix **and** the verification to `@build` ("Verify test passes → @build runs the test").
- **Execution:** dispatched `@build ×1`, which applied the None-sentinel fix and reported **RED (before): FAILED → GREEN (after): 1/1 passing, exit 0**, commit `ea3bdca`. The orchestrator relayed that report.

**opencode.db — orchestrator inline tools:**

| tool | handless run | (ComfyUI, pre-fix) |
|------|--------------|--------------------|
| bash | **0** | 87 |
| websearch | **0** | 10 |
| edit / write | **0 / 0** | 1 / 2 |
| read / glob | 5 / 3 (framing) | 9 / – |
| task (dispatch) | 1 (`build`) | 1 |

The orchestrator did **zero** side-effecting work by hand: it read to frame, dispatched to act, relayed the result. Exactly the intended "only orchestrates" behavior.

## Honest scope of this validation
- **Confirmed:** the orchestrator no longer investigates/builds/searches inline; it delegates and does not stall on the denied tools. Core fix verified end-to-end on the weak model.
- **Not exercised:** the `@research`-with-bash path for a bug that needs **execution** to diagnose (this bug was statically diagnosable, so the orchestrator read rather than dispatching `@research`). That path is in place by config (`research` now has `bash`) + R0.5 prose (bug → dispatch `@research`), but was not observed running. A follow-up dogfood on a run-to-diagnose bug (e.g. an import/runtime error like the ComfyUI case) would confirm it.
