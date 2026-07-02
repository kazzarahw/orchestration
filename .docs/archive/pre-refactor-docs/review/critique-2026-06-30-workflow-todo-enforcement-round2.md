## Critique Report: Workflow & Todo Enforcement Design Spec — Round 2

### Context
Design spec review (pre-implementation). Second-round adversarial review of the revised spec at `src/docs/plans/design-2026-06-30-workflow-todo-enforcement.md` after all previously Critical (3) and High (5) issues were addressed.

### Severity Summary
- Critical: 0 — Must fix before proceeding
- High: 1 — Should fix, will cause problems later
- Medium: 3 — Worth fixing, notable but not urgent
- Low: 3 — Style/preference, optional
- Info: 2 — Observations, not actionable

---

### Previously Critical Issues — Resolution Status

**C1 (Tool mapping in SKILL.md) — RESOLVED** ✓
Tool mapping stays in the plugin, appended after `using-superpowers` only. SKILL.md untouched. Multi-platform design preserved. See Medium #1 for a secondary maintenance concern.

**C2 (Config key collision) — RESOLVED** ✓
Key is `"skill-injection"` (hyphenated, flat array). Documented with rationale. No collision risk.

**C3 (Path discovery) — RESOLVED** ✓
`path.resolve(__dirname, '../skills')` explicitly documented. Same as current `superpowers.js`.

### Previously High Issues — Resolution Status

**H1 (Per-skill subagent analysis) — RESOLVED** ✓
Documented that `maximizing-information-density` has a built-in audience gate. Plugin doesn't filter by agent type; skill's own rubric handles audience classification. Lossy techniques are gated to human-facing output.

**H2 (develop.md detail mapping) — RESOLVED** ✓
Full mapping table (lines 144-156) shows where each removed section goes: skills, condensed retention, or cross-cutting injection. No orphaned detail.

**H3 (Temperature rationale) — RESOLVED** ✓
Temperature stays at 0.2. 0.1 change removed.

**H4 (Frontmatter identity loss) — RESOLVED** ✓
Wrapper tag includes `name` and `description` attributes. Agents can recognize pre-loaded skills and avoid redundant `skill` tool invocations.

**H5 (Todo durability gap) — RESOLVED** ✓
`using-todos` gets a Durability section (line 118) referencing `.opencode/sdd/progress.md` as a recovery mechanism.

---

### High Issues

1. **SUBAGENT-STOP block makes `using-superpowers` injection self-defeating for subagents** — §"Injection Format" (lines 72-81), §"Architecture" (lines 31-35)
   - **Problem:** The `using-superpowers` skill body (lines 6-8 of SKILL.md) begins with:
     ```
     <SUBAGENT-STOP>
     If you were dispatched as a subagent to execute a specific task, skip this skill.
     </SUBAGENT-STOP>
     ```
     When injected into a subagent's first message, this instruction appears as the very first content the agent reads. An LLM subagent will interpret "skip this skill" as "don't follow the instructions below" — rendering the rest of `using-superpowers` (EXTREMELY-IMPORTANT block, 1% rule, skill flow diagram, red flags table) effectively dead text for all subagents.
     - **Impact:** Subagents lose the mandate to load skills before responding. The 1% rule, EXTREMELY-IMPORTANT enforcement, and red flags self-check are silently discarded. The `<AUTO_INJECTED_SKILL>` wrapper tag still provides name/description metadata (so the agent knows the skill exists), but the behavioral content — which is the actual value of injection — is skipped. Since the universal injection architecture (line 34: "primary + subagent, no session gating") sends this to ALL subagents, the loss is systemic.
     - **Severity calibration:** First-round critique flagged this as Low (noise). But the architecture change to universal injection elevates it: every subagent now receives content it's told to skip. The original Low rating assumed a minor annoyance; the universal-injection architecture makes it a system-wide behavioral gap.
   - **Suggestion:** Two options — (a) Have the plugin strip the `<SUBAGENT-STOP>` block from injected content. The plugin does not track session type, but it could simply always strip SUBAGENT-STOP blocks from injected skills (the plugin is the injection mechanism; the "stop" instruction is a guard against redundant `skill` tool invocation, which the injection wrapper already handles via the `name` attribute). OR (b) Add session-type detection to the plugin — if OpenCode passes metadata allowing the plugin to distinguish primary vs subagent sessions, strip SUBAGENT-STOP only for subagent injections. Option (a) is simpler and equally correct: the wrapper's `name` attribute already prevents redundant `skill` tool calls, making SUBAGENT-STOP unnecessary in the injected context.

---

### Medium Issues

1. **Tool mapping text in plugin code creates a manual maintenance coupling** — §"Platform Tool Mapping" (lines 83-98)
   - **Problem:** The spec says the tool mapping text is "appended after `using-superpowers`" by the plugin. This mapping text (lines 86-95) is hardcoded in the plugin. If the `using-superpowers` skill's action verbs change (e.g., "dispatch a subagent" becomes "delegate to a subagent"), the mapping must be manually updated in the plugin source. There's no test or validation that the mapping is current with the skill.
   - **Impact:** Low probability (skill actions are stable), but the mapping text is duplicated knowledge — it exists in the skill's platform reference files (`references/*-tools.md`) AND in the plugin. Two sources of truth with no sync mechanism.
   - **Suggestion:** Either (a) document that the plugin mapping is a first-class maintenance responsibility in the plugin's own source comments, or (b) derive the mapping programmatically from the skill's reference files at plugin load time (e.g., parse `references/opencode-codex-tools.md`). Option (a) is pragmatic for now. Add a comment in the plugin: "Update this mapping when `using-superpowers` actions change."

2. **Post-processing order for tool mapping is underspecified** — §"Injection Format" (lines 72-81), §"Platform Tool Mapping" (lines 83-98)
   - **Problem:** The spec shows the tool mapping text (lines 86-95) and says it's "appended after `using-superpowers`." But it does not specify where this text goes relative to the `<AUTO_INJECTED_SKILL>` wrapper. Is it:
     - Inside the wrapper, after the skill body? (preserving the skill as a unit)
     - Outside the wrapper, as a separate block? (making it a distinct context element)
     - Between the wrapper's attributes and the skill body?
   - **Impact:** An implementation detail but one with behavioral consequences. If the mapping is inside the wrapper, it's part of the `using-superpowers` skill context. If outside, it's a standalone instruction. The format affects how agents perceive the mapping's scope.
   - **Suggestion:** Specify: the tool mapping is placed INSIDE the `<AUTO_INJECTED_SKILL>` wrapper, after the skill body, separated by a blank line. This keeps the skill content cohesive. The wrapper becomes: `<AUTO_INJECTED_SKILL ...>\n[skill body]\n\n[tool mapping]\n</AUTO_INJECTED_SKILL>`.

3. **1673-word `maximizing-information-density` skill adds ~3500-4000 tokens per session** — §"Architecture" (lines 26-35)
   - **Problem:** Every agent session (primary + subagent) receives ~1673 words of `maximizing-information-density` content injected at session start (~3500-4000 tokens). For code-implementing subagents, the skill's behavioral impact is minimal (code blocks are exempt; only status prose is affected), but the token overhead is paid regardless. On platforms with 8K-16K context limits, this reduces effective working memory by 25-50%.
   - **Impact:** Not a regression (the original spec also included this skill). But it's now the dominant token cost in the injection payload — larger than `using-superpowers` (~750 words) and `using-todos` (~200 words) combined.
   - **Suggestion:** Re-evaluate whether `maximizing-information-density` needs universal injection. The default config (line 61: key absent → `["using-superpowers", "using-todos"]`) already excludes it. Consider documenting a recommendation: most deployments should NOT include `maximizing-information-density` in the injection array unless density discipline is specifically needed for a task type. Document this as a configuration guidance in the plugin's source or in the spec.

---

### Low Issues

1. **Plugin default does not log a warning when config key is absent** — §"Edge Cases & Risks" (lines 214-217)
   - **Observation:** The spec says absent key → default `["using-superpowers", "using-todos"]` (silent). Empty array → `console.warn`. This means an upgrade from an environment without the `skill-injection` key gets `maximizing-information-density` silently dropped (since the default doesn't include it). The user may expect all three skills. A one-time info log on absent key would help: "skill-injection config key not found, using default: [using-superpowers, using-todos]."
   - **Suggestion:** Add `console.info` (not warn, since this is normal operation) when the key is absent and defaults are applied. Not blocking, but improves observability.

2. **Disabled agents (plan.md, build.md) not updated** — §"Other Agents — Minor Updates" (lines 158-166)
   - **Observation:** First-round Low #2 — agents marked `disable: true` were not updated with todo lines. Not addressed. If re-enabled, they'll lack todo discipline. Acceptable as-is since they're disabled, but a one-line comment in the spec would clarify: "Disabled agents excluded — if re-enabled, add +~3 lines for todo discipline."

3. **SDD script quoting not fixed during namespace migration** — §"Component 4: SDD Scripts" (lines 170-177)
   - **Observation:** First-round Low #4 — shell quoting fragility in `task-brief` and `review-package` (spaces in paths) was flagged but not addressed. The spec touches these files for the `.superpowers → .opencode` path change, which would be a natural opportunity to fix quoting. Acceptable as-is; not blocking.

---

### Info

1. **Both plugins active during incomplete migration** — §"File Changes Summary" (lines 182-197)
   - **Observation:** The deployment sequence matters. If `install.sh` runs before `superpowers.js` is deleted from `src/plugins/`, both plugins load simultaneously. OpenCode loads all `.js`/`.ts` files from `~/.config/opencode/plugins/`. During the window where both exist, `superpowers.js` injects `using-superpowers` with its own wrapper and tool mapping, and `skill-injection.js` injects the same skill again plus the other two. The EXTREMELY-IMPORTANT guard in `superpowers.js` checks for old markers; the new plugin's guard checks for `<AUTO_INJECTED_SKILL>` markers. These guards are NOT compatible — they check different markers. Result: double injection of `using-superpowers` until the old plugin is removed.
   - **No action needed.** This is a deployment sequencing concern, not a design issue. Document in the implementation plan: "Delete `src/plugins/superpowers.js` BEFORE running `install.sh`."

2. **`maximizing-information-density` injected but default config excludes it** — §"OpenCode Config" (lines 49-57), §"Key Design Decisions" (lines 100-107)
   - **Observation:** The spec injects three skills (line 30) but the default (key absent) only includes two. This creates a subtle behavior difference: early adopters who don't configure anything get only `using-superpowers` + `using-todos`. Users who explicitly set `"skill-injection": [...]` are more likely to include `maximizing-information-density`. The design implicitly makes density discipline opt-in. This is sensible — density has real token cost and behavioral impact — but it's undocumented. Consider adding one line in the config section: "The default excludes `maximizing-information-density` to avoid token overhead. Include it explicitly if density discipline is needed."

---

### Positive Notes

- **Config-driven architecture is clean.** Flat array, plugin-namespaced key, sensible defaults. The design is a clear improvement over hardcoded skill references.
- **Mapping table is thorough.** Every section removed from develop.md has a documented destination. No orphaned detail. The 342→100 line reduction is well-justified.
- **Durability bridge between todo system and SDD progress ledger.** The `using-todos` Durability section is exactly what was needed — one line that connects two previously disconnected tracking mechanisms.
- **Tool mapping stays out of SKILL.md.** The fix correctly preserves the multi-platform design of `using-superpowers`. This was the most important fix from round 1 and it's executed correctly.
- **Frontmatter identity preserved.** The `name` and `description` attributes in the wrapper tag are the right solution — lightweight, informative, doesn't inflate injection size.
- **Default fallback on absent config key.** The default `["using-superpowers", "using-todos"]` prevents silent ecosystem breakage. The `console.warn` on empty array adds observability for misconfiguration.

---

### Overall Assessment

**Ready to proceed to planning with one High issue to resolve.** All three Critical and all five High issues from the first round are genuinely resolved — the fixes are not cosmetic, they address the root concerns. The remaining High issue (SUBAGENT-STOP block making `using-superpowers` injection self-defeating for subagents) is real but straightforward to fix: have the plugin strip the SUBAGENT-STOP block from injected content. This doesn't require a spec rewrite — it's a single implementation constraint that should be captured in the implementation plan.

The Medium issues are worth addressing in the plan but not blocking: (1) document the tool mapping maintenance coupling in the plugin source comments, (2) specify the post-processing order for the tool mapping relative to the wrapper tag, and (3) document the token overhead trade-off of `maximizing-information-density` in the config guidance.

The spec is solid. The fixes from round 1 demonstrate responsive design iteration. Proceed to planning with the SUBAGENT-STOP fix as a mandatory implementation constraint.
