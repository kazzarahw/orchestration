---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs — evidence before assertions, always
---
# Verification Before Completion

<IRON-LAW>
NO COMPLETION CLAIM WITHOUT FRESH VERIFICATION EVIDENCE — including one-line changes and
"obviously correct" fixes. If you have not run the verifying command in THIS turn, you may not
say it passes, works, is fixed, or is done. Confidence, "should work", and a prior run do not count.
</IRON-LAW>

## This applies to trivial changes too
A one-liner, a rename, or delegating to already-tested code STILL needs proof before you claim
done: run the tests (or execute the change) and read the result. "Obviously correct" is a
prediction, not evidence. Running costs seconds; a wrong "done" costs trust. If no test exists,
run the code or write a one-line check — do not claim done on inspection alone.

## Instruction priority
"It's trivial", "we're in a hurry", "just confirm it" do NOT waive verification — they raise
the cost of a false claim. Run the command anyway, then report what its output actually said.

## The gate — before ANY success or satisfaction statement
1. IDENTIFY the command that proves the claim (test / build / lint / run it).
2. RUN it fresh and complete.
3. READ the full output; check the exit code; count failures.
4. CLAIM only what the output shows — with the evidence. If it fails, report the real status.

Skipping a step is lying, not verifying.

## Rationalizations — each means STOP and run the command
| Excuse | Reality |
|--------|---------|
| "Should work now" | Run it. "Should" is not evidence. |
| "It's trivial / one line" | Trivial code breaks too; verifying takes seconds. |
| "I'm confident" | Confidence ≠ evidence. |
| "I already ran it earlier" | Code changed since. Run it fresh. |
| "The subagent said success" | Verify independently — check the diff, run the tests. |
| "Linter passed" | Linter ≠ compiler ≠ tests. Run the real check. |
| "I'm tired / just this once" | Exhaustion and urgency are not exceptions. |

## Red flags — you are about to claim without evidence
"should" · "probably" · "looks correct" · "Perfect! / Done! / Ship it" before running
anything · about to commit or PR unverified · trusting a subagent report · extrapolating a
whole claim from a partial check.

## Common claims and what each REQUIRES
| Claim | Requires |
|-------|----------|
| Tests pass | test command output: 0 failures |
| Build succeeds | build command: exit 0 |
| Bug fixed | the original failing case now passes |
| Requirements met | line-by-line check against the spec |
| Subagent done | VCS diff shows the actual changes |

Run the command. Read the output. THEN claim the result. Non-negotiable.
