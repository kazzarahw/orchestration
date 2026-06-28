---
name: requesting-code-review
description: >-
  Standalone reference for manually requesting code review outside the
  default development workflow. The primary workflow (subagent-driven
  development) dispatches @review.md directly. Use this when you want
  to request a review ad-hoc — for a small fix, a refactoring, or a
  change made without the full SDD lifecycle.
---

# Requesting Code Review

**Note:** The default development workflow dispatches `@review.md` directly
for both per-task and whole-branch review. This skill is a standalone
reference for ad-hoc review requests outside that workflow.

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git merge-base origin/main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch review subagent:**

Dispatch `@review.md` in whole-branch mode, filling the minimum template
at [code-reviewer.md](code-reviewer.md).

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed a feature fix]

You: Let me request code review before merging.

[Request review with]:
  DESCRIPTION: Fixed indexing timeout for large directories
  PLAN_OR_REQUIREMENTS: The fix should handle 100k+ files
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean fix, good edge case handling
  Issues: None
  Assessment: Ready to merge

You: [Merge]
```

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
