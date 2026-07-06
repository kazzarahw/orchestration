# Platform Capability Verification (P0)

**Date:** 2026-07-05
**OpenCode version:** 1.17.13
**Method:** throwaway `probe-injection.js` plugin + `opencode run` / `opencode debug`
against the free `deepseek-v4-flash-free` model. Plan reference:
`.docs/plans/plan-2026-07-05-workflow-enforcement-foundation.md` (Task 1).

## Verdicts

| Verdict | Result | Confidence |
|---------|--------|-----------|
| `INJECTION_HOOK` | **`system.transform` works** (so does `messages.transform`, with caveats) | Proven |
| `EDIT_GLOB_ENFORCED` | **yes** — glob `permission.edit` denies at tool-execution time | Proven |
| `DEFAULT_AGENT_WORKS` | **yes** | Proven |

## ⚠️ CORRECTION (2026-07-06) — §1's conclusion was wrong

§1 below concluded "keep `system.transform`, no hook swap needed" because a marker pushed
via `system.transform` was **echoed** by the model. That proved the content is *readable* —
but **readable ≠ obeyed.** A later behavioral test (`.docs/reports/pressure-tests/test-driven-development.md`)
measured, on the same model with global rules removed:

- skill via `system.transform`: **0/3** compliance (same as no guidance — read but ignored)
- identical skill via `messages.transform` as a **`user` message**: **3/3**

So the spec's original call (Section 3: swap to `messages.transform`) was correct, and the
P0 decision to keep `system.transform` was the error — I conflated "reaches the model" with
"changes behavior." The plugin now injects via `messages.transform` as a bundled `user`
message (`df27c8d`, ported to TS in `9f4541c`). **Treat §1's "no hook swap" line as reversed.**
The message-shape details in §1 remain accurate and were needed for the fix.

## 1. Injection hook — `system.transform` is LIVE on 1.17.13 *(readable, not obeyed — see correction above)*

A marker `PROBE_MARKER_SYSTEM_7F3A` pushed via `experimental.chat.system.transform`
(`output.system.push(string)`) was **echoed back by the model**, proving the mutation
reaches the assembled prompt.

- **This contradicts research issue #17100** ("system.transform silently discarded").
  That issue does **not** apply to 1.17.13 — the hook works. The current
  `skill-autoinjection.js` (which uses `system.transform`) was therefore **not** a dead
  no-op on this version; `optimize-tokens`/`use-todo` have been injecting.
- Hook fires per chat request (observed firing for both the title sub-agent and the main
  agent). `output.system` is a `string[]`; pushing a string is safe.

### `messages.transform` also live — but needs the right shape
`experimental.chat.messages.transform` also fires and its mutations reach the pipeline
(a malformed push **crashed** `SessionPrompt.run` on `V.parts.length`, proving the pushed
entry is consumed). OpenCode messages are **not** `{role, content}` — the real shape is:

```json
{"info":{"role":"user","time":{...},"agent":"...","model":{...},"id":"msg_...","sessionID":"ses_..."},
 "parts":[{"type":"text","text":"...","id":"prt_..."}]}
```

`messages.transform` `input` keys were empty (`[]`); `output` exposes `messages`.

**Decision:** keep `system.transform` in `skill-autoinjection.js` — it works, is simpler
(plain strings), and needs no shape juggling. **No hook swap is required.** This simplifies
plan Task 3 (only: add `workflow-gateway` to the default list + drop `TOOL_MAPPING`).

## 2. Permission glob enforcement — confirmed

Temporary gate on the `design` agent:
```yaml
edit:
  "**": deny
  ".docs/**": allow
```
- `opencode debug agent design` resolved to the two `edit` rules with glob `pattern`s.
- `opencode run --agent design "…create probe-src.ts…"` → file **not created**; log:
  `evaluated permission=edit pattern=probe-src.ts action.pattern=** action.action=deny`,
  tool returned `Write probe-src.ts failed — The user has specified a rule which prevents
  you from using this specific tool call`.
- The deny reason is fed to the model, which then correctly proposed dispatching the Build
  agent — a useful side effect (the gate nudges toward the intended routing).

Permissions are a last-match-wins rule list of `{permission, action, pattern}` enforced at
tool-execution time. The design's deny-source/allow-docs gate (plan Task 5) is viable as
specified — no fallback needed.

## 2b. Gate limitation — bash-enabled agents bypass via shell redirect

Verified during Task 5 on `orchestrate` (which has `bash: allow`). The model tried in order:
`Edit gate-probe.ts` → **denied** (edit `**`), `Write gate-probe.ts` → **denied**, then
`echo 'export const y = 2' > gate-probe.ts` via **bash** → **allowed**, file created.

**Conclusion:** the `edit`/`write` gate is airtight, but permission maps gate *tools*, not
shell redirects. Agents with `bash: allow` (`orchestrate`, `critique`, `review`, `dogfood`)
can write source via `>`/`tee`/`sed -i`/heredoc. Agents with `bash: deny` (`design`, `plan`,
`research`) are fully airtight.

- This only triggered under **explicit, repeated adversarial pushing** (told to create the
  file, then denied twice). The natural *drift* path — a model reaching for the Edit tool —
  is blocked and the deny reason redirects it toward Build. That is the real threat model.
- Denying shell redirects via `bash` permission globs is not viable (too many write paths;
  would break legitimate `>` usage for tests/`.docs`/`.opencode`). So bash-write is left to
  **Tier S (structural review)** + **Tier L (linguistic Iron Law)**, consistent with the
  design's tiering. Open hardening option: set `bash: deny` on pure-review agents
  (`critique`) that never need to execute — deferred as a decision.

## 3. `default_agent` — confirmed

`"default_agent": "orchestrate"` in `opencode.jsonc`:
- `opencode debug config` → `"default_agent": "orchestrate"` (survives parsing).
- `opencode run "hi"` with no `--agent` → logs `agent=orchestrate mode=primary`.

## Operational notes for later tasks

- **Deploy loop:** edit `src/` → `./install.sh` → `opencode run …` (fresh config each run;
  no restart needed for one-shots).
- **Model latency:** `deepseek-v4-flash-free` is slow against large prompts (the orchestrate
  system prompt timed out introspection prompts at 2 min). Prefer **deterministic** checks
  (`debug agent` / `debug config` / file-existence) over asking the model to introspect;
  keep behavioral probes short and give generous timeouts (≥240 s).
- **Harmless noise:** the `gpt-5.4-nano … Missing API key` title-model error on stderr does
  not affect the main run.

## Integration (P1 exit) — all green

| Check | Method | Result |
|-------|--------|--------|
| Gateway injected every turn | `[SAI]` instrumentation: `config hook … globalSkillNames = ["workflow-gateway","optimize-tokens","use-todo"]`, `transform fired; length = 3` | ✅ PASS |
| Source-edit gate (bash-deny agent) | `design` asked to create `int-probe.ts` + `.docs/int-probe.md` → source **not created**, docs **created** | ✅ PASS |
| `default_agent` | no-`--agent` run logs `agent=orchestrate mode=primary` | ✅ PASS |

Known limitation carried forward: bash-enabled agents can bypass the source gate via shell
redirect (§2b) — covered by Tier S/L, with an optional `bash: deny` hardening for `critique`
deferred as a decision.

## Plan adjustments arising from P0

1. **Task 3:** do **not** swap the injection hook. Keep `system.transform`; only add
   `workflow-gateway` to `DEFAULT_SKILLS` and delete `TOOL_MAPPING`. Update the Task 3
   live-confirm step to use a short prompt / generous timeout.
2. **Task 5:** glob gate confirmed enforceable — the coarse fallback (Step 3) is not needed.
