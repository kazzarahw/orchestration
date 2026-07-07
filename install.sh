#!/usr/bin/env bash
set -euo pipefail

# Installs the orchestration config (agents, plugins, skills, rules) into OpenCode's
# config directory. Instead of copying the whole config to a timestamped backup on every
# run (which accumulated gigabytes — OpenCode keeps a 63MB node_modules in there), this
# tracks the config in a git repo scoped to ONLY the orchestration-managed items, so:
#   - history is compact (deltas, not full copies)
#   - a bad install is one `git reset` away
#   - node_modules, package artifacts, caches, and any secrets are never committed
#
# Roll back a bad install:   git -C ~/.config/opencode reset --hard HEAD~1
# See history:               git -C ~/.config/opencode log --oneline

# 0. Setup / variables
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/src" && pwd -P)"
CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/opencode"

if [ ! -d "$SRC_DIR" ]; then
	echo "ERROR: Source directory not found at $SRC_DIR" >&2
	exit 1
fi
if ! command -v git >/dev/null 2>&1; then
	echo "ERROR: git is required for config version tracking but was not found on PATH." >&2
	exit 1
fi

# Items this installer manages (everything else in the config dir is left untouched).
items=("agents" "plugins" "skills" "commands" "AGENTS.md" "CLAUDE.md" "opencode.jsonc")

mkdir -p "$CONFIG_DIR"

# git in the config dir with a stable identity (no dependence on the user's global config)
cfg_git() { git -C "$CONFIG_DIR" -c user.email="install@orchestration" -c user.name="orchestration install" "$@"; }

# 1. Initialize config version tracking once. The whitelist .gitignore tracks ONLY the
#    managed items — node_modules, package*.json, caches, session data and secrets are ignored.
if [ ! -d "$CONFIG_DIR/.git" ]; then
	cfg_git init -q
	cat > "$CONFIG_DIR/.gitignore" <<'EOF'
# Track only orchestration-managed config; ignore everything else OpenCode puts here
# (node_modules, package*.json, caches, session data, credentials, etc.)
/*
!/.gitignore
!/agents/
!/plugins/
!/skills/
!/commands/
!/AGENTS.md
!/CLAUDE.md
!/opencode.jsonc
EOF
	cfg_git add -A
	cfg_git commit -q -m "init: track orchestration-managed config" || true
	echo "Initialized config version tracking at $CONFIG_DIR/.git"
fi

# 2. Snapshot the current managed config before overwriting (preserves any manual edits
#    in history, and gives a rollback point). No-op if nothing changed.
cfg_git add -A
cfg_git commit -q -m "snapshot before install $(date '+%F %T')" || true
ROLLBACK_REF="$(cfg_git rev-parse HEAD 2>/dev/null || echo "")"

# Restore-on-failure: reset the managed config to the pre-install snapshot.
cleanup() {
	local exit_code=$?
	if [ "$exit_code" -ne 0 ] && [ -n "$ROLLBACK_REF" ]; then
		echo "ERROR: Install failed. Rolling back config to the pre-install snapshot..." >&2
		cfg_git reset -q --hard "$ROLLBACK_REF" || true
		cfg_git clean -qfd || true   # remove new untracked managed files (node_modules is ignored, so safe)
		echo "Rolled back."
	fi
}
trap cleanup EXIT

# 3. Overwrite the managed items from src/
for item in "${items[@]}"; do
	src="$SRC_DIR/$item"
	dst="$CONFIG_DIR/$item"
	if [ -e "$src" ]; then
		rm -rf "$dst"
		cp -r "$src" "$dst"
		echo "  Installed: $item"
	else
		echo "  Skipped (not found): $item"
	fi
done

# 4. Commit the new state.
cfg_git add -A
if cfg_git commit -q -m "install from src $(date '+%F %T')"; then
	echo "Done. Config installed to $CONFIG_DIR"
else
	echo "Done. Config installed to $CONFIG_DIR (no changes since last install)"
fi
