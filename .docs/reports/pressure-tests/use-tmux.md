# Pressure Test: use-tmux

**Date:** 2026-07-06 · 418w (on-demand, <500 ✓). Type: **reference review — no rewrite**.

`use-tmux` is a pure command reference (session lifecycle, send-keys, capture-pane,
display-message, resize) for PTY-based interactive testing, consumed by the `dogfood` agent. It has
no discipline/rationalization to pressure-test — the failure mode is "used the wrong tmux
incantation", addressed by correct reference tables, which it already has (concise, tabular, with a
Best Practices list: always `-d`, capture between interactions, `display-message` for invisible
state, poll don't `sleep`, capture before kill, send `Enter`).

Reviewed against the superpowers form: already tight and well-structured; no rewrite adds value.

**Status: reviewed, form-complete, no change.**
