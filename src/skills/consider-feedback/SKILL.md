---
name: consider-feedback
description: Use when receiving code review or critique feedback, before implementing suggestions — requires technical verification, not performative agreement or blind implementation
---
# Consider Feedback

<IRON-LAW>
VERIFY FEEDBACK AGAINST REALITY BEFORE IMPLEMENTING IT.
Feedback is a suggestion to evaluate, not an order to obey. Check the claim yourself first — run
it, trace it, compute it. If it is wrong, push back with the evidence. Do NOT change correct code
to appease a reviewer.
</IRON-LAW>

## No performative agreement
Never open with "You're absolutely right!", "Great point!", "Thanks for catching that!", or "Let
me implement that now" (before verifying). Actions over words: verify, then either fix it or refute it.

## The response pattern
1. READ the whole feedback without reacting.
2. VERIFY each claim against the actual code/spec — run it, trace the value, compute the case.
   Don't assume the reviewer is right *or* wrong.
3. DECIDE per claim:
   - Correct → fix it (state the fix, no gratitude).
   - Wrong → push back with evidence ("`isEven(-3)` → `-3 % 2 === -1` → returns `false`; already
     correct, no change"). **Leave working code alone.**
   - Unclear → ask before implementing anything.
4. IMPLEMENT one item at a time, testing each.

## When to push back (technical reasoning, not defensiveness)
- The claim is factually wrong (you verified it).
- It breaks existing behaviour, or adds an unused feature (YAGNI — grep for usage first).
- The reviewer lacks context, or it conflicts with a prior decision by your human partner.

If you pushed back and were wrong: "Verified — you're correct; my check was off because [reason]. Fixing." State it, move on.

## Rationalizations — each means STOP and verify first
| Excuse | Reality |
|--------|---------|
| "The reviewer is probably right" | Verify. Reviewers are wrong too. |
| "Just make the change to be safe" | Editing correct code to appease introduces bugs and noise. |
| "I'll add a guard 'for robustness'" | An unnecessary change to correct code is not robustness — leave it. |
| "It's polite to agree" | Technical correctness > social comfort. Just act. |
| "Implement now, verify later" | Verify first; partial understanding = wrong implementation. |

## Bottom line
Feedback = suggestions to evaluate, not orders to follow. Verify. Question. Then implement — or refute.
