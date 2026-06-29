# TODO - Orchestration

- Fix `docs/` file output instructions and organization. Research and reviewers/Critique (whatever that ends up being) should be outputting to files for future reference. Maybe enforce one or more of them to read through existing research before doing something? Not sure yet.
- Normalize some language/behaviors of subagents. Superpowers does this fairly nicely, but it could be more consistent overall - mine and theirs included.
- Move some behaviors to agent-specific instructions then enforce stricter delegation for tasks. Could remove some of the hyperspecific skills that don't need to exist for most agents.
- Implement proper agent/skill/etc. docs for consistent construction of each.
- Fix install script. Should put backup in `~/.config/opencode/.bak/...` and should not clear entire config dir, just the folders/files it's replacing (to keep things like `node_modules/`, `.git/` and so on).
