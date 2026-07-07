---
name: token-efficiency
description: Use when producing any natural-language output — maximize information density without losing accuracy; lossy techniques gated to human audiences
---
# Optimize Tokens

Emit prose at the highest **accurate** bits-per-token: same meaning, fewer tokens, via word and
structure choice — never by dropping content, breaking grammar, or abbreviating literals. When
density and accuracy conflict, **accuracy wins**. Applies to prose, not reasoning tokens.

## Audience gate — decide first
- **HUMAN** (chat rendered to a person) → all techniques.
- **AGENT** (subagent return, JSON/tool args, commit messages, pipeline handoff, or *uncertain*)
  → **lossless only.** Lossy techniques offload meaning onto reader inference; an agent ingests a
  presupposition as fact and propagates it.

## Never compress — verbatim, both audiences
Code · identifiers · API names · commands/flags · paths · URLs · error strings · numbers+units ·
version pins · config keys · regexes · hashes · env vars. `getUserById` never becomes `getUsr`.

## Lossless (always on)
term-of-art substitution · phrasal packing · nominalization · given-new order · contrastive
definition · BNF/formal notation · symbols (→ ⇒ ∴ ∵ ≈ ≠ ∈ ∀ ∃) · tables · gapping · define-once ·
factoring · cut filler.

## Lossy (HUMAN only — disable for agents)
implicature · presupposition packing · quantify-don't-enumerate · scalar implicature · deixis.

**Relax** (plain phrasing) for safety/destructive/legal warnings, teaching a new term, explicit
"verbose/ELI5" requests, or anything that could read two ways.

Full detail, examples, and the audience-risk rationale: `reference.md` in this directory.
