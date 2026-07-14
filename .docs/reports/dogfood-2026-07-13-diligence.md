# Dogfood: Orchestrator Diligence — enumerable + convergent shapes

**Date:** 2026-07-13 · **Branch:** `feat/orchestrator-diligence` · **Model:** `deepseek-v4-flash-free` (OpenCode Zen, the target weak free model) · **Method:** `opencode run --agent orchestrate --dir <scratch> --auto` (turn 1 = the R0.5 Approach Proposal, which stops for confirmation).

## Setup

Isolated scratch git projects (never touched this repo):
- **proj** — `calc.py`, 3 functions each with one obvious bug.
- **proj2** — `textutils.py`, 12 functions with 7 real bugs scattered + 1 *planted false annotation* (`initials` annotated "crashes on empty" but actually returns `""` correctly).

## Run 1 — Enumerable ("implement X and Y"), proj

Prompt: *"Implement a function to reverse a string, and a function to check whether a string is a palindrome."*

**Result — PASS (clean).** R0.5 produced:
- **Shape: Enumerable — two clear parts.**
- **Coverage Contract** enumerating *both* parts (`reverse_string`, `is_palindrome`), **plus implied work** (tests via TDD; full-suite verification), each mapped to `calc.py`.
- Recommended **Standard**; raised the isolation/consent gate; stopped with *"Proceed with Standard workflow and this contract, or adjust?"*

Every design intent for the enumerable shape was observed on the weak model: complete part enumeration, implied-work default-in, mapping, and the plain-message stop-gate.

## Run 2 — "find and fix all bugs", proj (tiny)

Prompt: *"Find and fix all the bugs in calc.py."*

**Result — classified Enumerable + Quick (correct).** The file is 3 lines of logic; the model read all 3 bugs up front, enumerated them as a 3-part Coverage Contract, and chose the **Quick** lane. This is the **proportionality resolution working**: accounting was still produced, but the *weight* stayed minimal — no gold-plating of a trivial fix. It did *not* commit to a convergent loop, because it *could* enumerate.

## Run 3 — "audit and fix all bugs", proj2 (12 functions)

Prompt: *"Audit textutils.py and find and fix all the bugs. There may be edge cases that aren't obvious on a first read."*

**Result — classified Enumerable, with strong diligence.** The model:
- Read the file **twice**, globbed for existing tests.
- Enumerated **all 7 real bugs** with the exact fix for each.
- **Caught the planted false-positive** — correctly reasoned `"".split() → []` so `initials("")` returns `""`, "annotation is incorrect, function is correct." It refused to "fix" a non-bug.
- Proactively **edge-case-checked the 5 functions it left alone** (`title_case`, `reverse_words`, `strip_punct`, `repeat`) and justified leaving them.
- Produced a 10-item Coverage Contract (7 fixes + TDD tests + verify + the explicit "not fixing initials"), recommended **Standard**, and stopped for confirmation.

This is the "err toward thorough / want to do more" behavior the feature targets — unprompted edge-case analysis and true/false-bug discrimination.

## Findings

**PASS — core feature, on the weak model (3/3 runs):**
- Coverage Contract emitted at R0.5 every time.
- Enumerable classification + complete part coverage + implied-work default-in.
- Proportionality: trivial → Quick, medium → Standard; weight scaled, no gold-plating.
- Err-toward-thorough: deep edge-case audit + false-positive rejection, unprompted.
- The R0.5 plain-message stop-and-confirm gate held every time.

**NOT OBSERVED — convergent classification / loop execution.** The model preferred **Enumerable** in all three "fix all X" cases. This is *correct* for a single readable file (enumeration is possible and gives a stronger guarantee than a loop), but it means the convergent path was never exercised end-to-end. A single file — even 12 functions — is always enumerable in one read; convergent only becomes the right call when enumeration is genuinely impossible up front (very large/multi-file codebases, or tasks defined by a re-runnable external check with cascading results). The convergent mode is thus **validated-by-prose** (present, internally consistent, referenced from R0.5) but **not validated-in-execution**.

**Design question this raises (for discussion, not yet actioned):** a weak model will classify "find and fix all bugs" as *enumerable* whenever it can enumerate — which is most readable targets. The failure mode convergent was meant to guard (fix the enumerated subset, miss an item that only surfaces *after* the fixes; the R3b completeness check then passes because it only checks the *enumerated* parts) is therefore not automatically closed for "all X" requests. Possible refinement: for open-ended "all X" phrasing, fold a **single re-discovery pass** into the completeness check even when the request was handled as enumerable ("having fixed these, is a fresh scan clean?"). This blends convergent's termination into the enumerable path without needing the model to pre-commit to a loop.

## Status

- Enumerable Coverage Contract + proportionality + err-thorough: **verified live on the weak model.**
- Convergent loop: **deferred** — needs a genuinely non-enumerable target (large multi-file, or a cascading re-runnable check) to observe. Flagged for the user's call on whether to (a) accept convergent as a documented-but-rarely-triggered fallback, (b) add the re-discovery-pass refinement above, or (c) build a heavier convergent validation target.
