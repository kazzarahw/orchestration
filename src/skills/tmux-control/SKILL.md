---
name: tmux-control
description: Use when needing tmux session management for interactive testing, terminal automation, or PTY-based QA workflows
---

# Use Tmux

## Overview

Tmux provides a real PTY (pseudo-terminal) for interactive program testing. Unlike piped execution (`echo "input" | program`), tmux preserves terminal behavior — colors, prompts, signals, cursor positioning, and escape sequences.

## Session Lifecycle

| Action | Command |
|--------|---------|
| Create detached session | `tmux new-session -d -s <name> '<cmd>'` |
| Kill session | `tmux kill-session -t <name>` |
| List sessions | `tmux list-sessions` |

## Sending Input

| Action | Command |
|--------|---------|
| Type and execute | `tmux send-keys -t <name> "input" Enter` |
| Ctrl+C | `tmux send-keys -t <name> C-c` |
| Ctrl+D | `tmux send-keys -t <name> C-d` |
| Ctrl+Z | `tmux send-keys -t <name> C-z` |
| Multi-line | `tmux send-keys -t <name> "line1" Enter "line2"` |
| Literal (no key translation) | `tmux send-keys -t <name> -l "raw text"` |

## Capturing Output

| Action | Command |
|--------|---------|
| Capture visible content | `tmux capture-pane -t <name> -p` |
| Capture all history | `tmux capture-pane -t <name> -p -S -` |
| Capture with trailing blanks | `tmux capture-pane -t <name> -p -J` |

## State Inspection

`capture-pane` shows what the user sees; `display-message` shows what tmux knows.

| Action | Command |
|--------|---------|
| Pane alive? | `tmux display-message -p -t <name> '#{pane_dead}'` |
| Exit status (if dead) | `tmux display-message -p -t <name> '#{pane_dead_status}'` |
| Cursor position | `tmux display-message -p -t <name> '#{cursor_x},#{cursor_y}'` |
| In a mode? | `tmux display-message -p -t <name> '#{pane_in_mode}'` |
| Pane dimensions | `tmux display-message -p -t <name> '#{pane_width}x#{pane_height}'` |

## Resize

| Action | Command |
|--------|---------|
| Absolute resize | `tmux resize-pane -t <name> -x 80 -y 24` |
| Relative resize | `tmux resize-pane -t <name> -L 10` |

## Best Practices

- **Always use `-d` (detached)** — attached sessions block automation
- **Capture between every interaction** — need before/after snapshots to identify what each action changed
- **Use `display-message` after every test** — `pane_dead`, `cursor_x`, `cursor_y` reveal issues invisible in captured output
- **Wait for the program to be ready** — prefer polling with `capture-pane` in a loop over fixed `sleep` delays on slow systems
- **Capture before killing** — pane content is lost on `kill-session`
- **Send `Enter` after commands** — `send-keys` types into the input buffer; they don't execute until Enter is sent
