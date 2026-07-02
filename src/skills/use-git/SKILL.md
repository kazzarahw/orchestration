---
name: use-git
description: Use when needing isolated workspaces, branch management, or git workflow guidance during development — ensures work happens in isolated workspaces and follows commit conventions
---

# Use Git

## Overview

Ensure work happens in an isolated workspace. Prefer platform-native worktree tools. Fall back to manual git worktrees when no native tool is available.

**Core principle:** Detect existing isolation first. Use native tools. Fall back to git. Never fight the harness.

## Step 0: Detect Existing Isolation

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
# Submodule guard
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` and not a submodule:** Already in a linked worktree. Skip creation.

**If `GIT_DIR == GIT_COMMON`:** Ask for consent before creating a worktree.

## Step 1: Create Isolated Workspace

### 1a. Native Worktree Tools (preferred)
If platform provides a worktree tool, use it. Only proceed to 1b if no native tool.

### 1b. Git Worktree Fallback

Directory priority: explicit user preference > `.worktrees/` > `worktrees/` > default `.worktrees/`.

```bash
git check-ignore -q .worktrees  # MUST verify ignored first
git worktree add "$path" -b "$BRANCH_NAME"
```

**Sandbox fallback:** If `git worktree add` fails (permission error), work in place.

## Step 2: Branch Isolation

**Never implement on main/master without explicit user consent.** Always use a feature branch created via worktree.

Record the baseline HEAD at worktree creation time for later cherry-pick and review-package generation:

```bash
BASE_SHA=$(git rev-parse HEAD)
```

## Step 3: Commit Conventions

- Write commits in **Conventional Commits** format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
- Keep each commit under 200 lines changed
- One logical change per commit — no bundled fixes
- Use imperative mood: "Add retry logic" not "Added retry logic"

## Step 4: Selective Commit Promotion (Cherry-Pick)

When promoting commits from a worktree branch:

```bash
git log --oneline worktree-branch
git cherry-pick <SHA>  # One at a time
```

Resolve conflicts with `git cherry-pick --continue` or `--abort` if unresolvable. Always test after cherry-pick.

## Step 5: Cleanup

**Provenance-based cleanup:** Only remove worktrees you created. Check path under `.worktrees/` or `worktrees/`. Never remove harness-owned workspaces.

```bash
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Clean stale registrations
```

Always `cd` to main repo root before `git worktree remove`.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation |
| In a submodule | Treat as normal repo |
| Native worktree tool available | Use it |
| No native tool | Git worktree fallback |
| `.worktrees/` exists | Verify ignored, use it |
| Directory not ignored | Add to .gitignore + commit |
| Permission error on create | Work in place |
| Main/master branch | Never implement without consent |

## Common Mistakes

- Using `git worktree add` when platform provides isolation — creates phantom state
- Skipping ignore verification — worktree contents get tracked
- Removing worktrees you didn't create — violates provenance
- Deleting branch before removing worktree — `git branch -d` fails
- Running `git worktree remove` from inside the worktree
- Bundling multiple fixes in one commit — makes cherry-pick impossible
