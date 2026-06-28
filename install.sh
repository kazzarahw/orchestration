#!/usr/bin/env bash
set -euo pipefail

# 0. Setup / Variables
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/src" && pwd -P)"
CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/opencode"
BACKUP_DIR="${CONFIG_DIR}.bak.$(date +%Y%m%d-%H%M%S)"

# Verify source exists
if [ ! -d "$SRC_DIR" ]; then
	echo "ERROR: Source directory not found at $SRC_DIR" >&2
	exit 1
fi

# Error recovery: restore from backup if install fails midway
cleanup() {
	local exit_code=$?
	if [ "$exit_code" -ne 0 ] && [ -d "$BACKUP_DIR" ]; then
		echo "ERROR: Install failed. Restoring from backup..." >&2
		rm -rf "$CONFIG_DIR"
		mv "$BACKUP_DIR" "$CONFIG_DIR"
		echo "Restored."
	fi
}
trap cleanup EXIT

# 1. Backup existing config (if present)
if [ -d "$CONFIG_DIR" ]; then
	cp -r "$CONFIG_DIR" "$BACKUP_DIR"
	echo "Backed up existing config to $BACKUP_DIR"
fi

# 2. Overwrite relevant files
items=("agents" "plugins" "skills" "docs" "commands" "AGENTS.md" "CLAUDE.md")
mkdir -p "$CONFIG_DIR"

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

echo "Done. Config installed to $CONFIG_DIR"
