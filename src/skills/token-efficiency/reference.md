---
name: token-efficiency
description: Use when producing any natural-language output — maximizes information density (term-of-art substitution, phrasal packing, nominalization, given-new ordering, quantification, contrastive definitions, BNF, implicature, presupposition packing) to minimize output tokens without losing technical accuracy; lossy techniques are gated to human-only audiences.
metadata:
  alias: maximizing-information-density
---

# Optimize Tokens

Spend output tokens at the highest accurate **bits-per-token**. This is *compression of encoding*, not *omission of content* and not broken grammar. Same meaning, fewer tokens — achieved by word and structure choice, never by dropping what the reader needs.

Contrast with "caveman speak": that drops articles and function words into telegraphic fragments (lossy, ungrammatical). This skill instead picks denser words (term-of-art), denser structures (phrasal packing, tables, BNF), and denser pragmatics (implicature) — output stays grammatical and *gains* clarity-per-token.

## The Mandate

Every natural-language token you emit should be the densest **accurate** encoding for its audience. Density that costs accuracy is a defect, not a win. When density and accuracy conflict, accuracy wins — every time.

This applies to prose only. Reasoning/thinking tokens are untouched: think at full length, *emit* densely.

## Audience Determination (do this first — it decides which techniques are legal)

The technique set you may use depends entirely on **who reads the output**.

| Output destination | Audience | Lossy techniques allowed? |
|---|---|---|
| Chat message rendered to the user; a person reads it | **HUMAN** | ✅ Yes — full set |
| Subagent return value to an orchestrator | **AGENT** | ⛔ No — lossless only |
| Structured / schema-constrained output, JSON, tool args | **AGENT** | ⛔ No — lossless only |
| Commit message, machine-parsed artifact, generated file consumed by tooling | **AGENT** | ⛔ No — lossless only |
| Handoff to a later pipeline stage | **AGENT** | ⛔ No — lossless only |
| **Genuinely uncertain** | **treat as AGENT** | ⛔ No (accuracy-safe default) |

**Rule:** HUMAN audience → all techniques (lossless §6 + lossy §7). AGENT audience → **lossless only**; disable everything in §7.

**Why lossy techniques are gated to humans:** lossy techniques offload meaning onto the reader's inference and skepticism. A human shares pragmatic context, fills implicatures correctly, and *challenges* a smuggled claim. A downstream agent does neither: it may lack the inference context (implicature lost) and it ingests presupposition as ground truth, then propagates that unverified claim through the pipeline as fact. Lossless techniques carry their full meaning in the text itself, so they are safe for both audiences.

## What This Is — and Is Not

- **IS:** more information per token via deliberate lexical, syntactic, and pragmatic choices.
- **IS NOT** caveman/telegraphic article-dropping that breaks grammar.
- **IS NOT** shortening by *omitting content* — no dropped claim, step, caveat, or constraint.
- **IS NOT** abbreviating literals (§5).
- **IS NOT** trading clarity for brevity — clarity-per-token must *rise*, never fall. If a dense form is ambiguous, it failed; expand it.

## Critical Preservation (verbatim — BOTH audiences, always)

Never compress, abbreviate, paraphrase, or "tidy" these. Density acts on prose **only**.

Code blocks · identifiers (function/class/variable names) · API names · CLI commands & flags · file paths · URLs · error strings & log lines · numeric values + units · version pins · config keys · regexes · commit hashes · environment-variable names.

`getUserById` stays `getUserById` — never `getUsr`. `--no-verify` stays exact. `0.0.0.0:8080` stays exact.

## Lossless Techniques (always on — both audiences)

Each carries its full meaning in the text; safe everywhere.

1. **Term-of-art substitution** — replace a multi-word gloss with the precise term.
   *"the bug where two threads touch shared state without coordination"* → *"data race"*.
2. **Phrasal packing / attributive nouns** — collapse a relative clause into a noun stack.
   *"a queue that holds messages which failed delivery"* → *"dead-letter queue"*.
3. **Nominalization** — turn a verb clause into a noun phrase (use judiciously; over-use hurts readability).
   *"when the cache initializes, it fails"* → *"cache-init failure"*.
4. **Given-new ordering** — known/topic first, new info last. Lets connectives drop and sentences chain without "and so, therefore, because of this."
5. **Contrastive definition** — define by delta from a known anchor instead of from scratch.
   *"X is like Y but Z"* rather than re-specifying all of Y.
6. **BNF / formal notation** — express grammar/structure as EBNF, type signatures, regex, or set-builder.
   *"one or more comma-separated key=value pairs"* → `pairs ::= pair ("," pair)* ; pair ::= key "=" value`.
7. **Symbol / operator substitution** — where unambiguous: `→ ⇒ ∴ ∵ ≈ ≠ ≤ ≥ ∈ ∀ ∃ ± × |`, and `e.g. i.e. viz. cf. w/ w/o`.
8. **Tabular / columnar layout** — convert parallel prose into a table or list; structure carries meaning that prose would spell out.
9. **Elision / gapping / coordination reduction** — drop recoverable repeats.
   *"A uses X; B uses Y"* → *"A uses X, B Y"*.
10. **Reference by anchor / define-once** — introduce a term or acronym once, then reuse the short form (e.g. "dead-letter queue (DLQ)" … "DLQ").
11. **Factoring / deduplication** — pull common factors out.
    *"validate input, validate output, validate config"* → *"validate {input, output, config}"*.
12. **Hedge / filler elision** — cut `just`, `really`, `basically`, `in order to`→`to`, `due to the fact that`→`because`/`∵`. Keep *genuine* epistemic markers (real uncertainty is content, not filler).

## Lossy Techniques (HUMAN audience ONLY — disable for AGENT audience)

These offload meaning onto reader inference. Powerful for humans, unsafe for agents.

13. **Implicature** (Gricean) — convey by implication rather than statement.
    *"Tests pass."* ⟹ (human infers) *"I ran them and all passed."*
    **Agent risk:** the inference context may not be shared → meaning lost. For agents: state it — *"Ran the suite; 142/142 passed."*
14. **Presupposition packing** — embed claims as *given* via definite descriptions and factive/change-of-state verbs.
    *"the race in the retry loop"* packs *(∃ a race) ∧ (it is in the retry loop)* as accepted fact in one noun phrase.
    **Agent risk:** the agent ingests the presupposition as ground truth and propagates it. For agents: unpack into explicit, separately-verifiable assertions — *"There is a race condition. It is located in the retry loop."*
15. **Quantification over enumeration** — *"all 12 handlers validate input"* instead of listing each.
    **Lossy when** the reader must act on specific members. For an agent that needs the set → enumerate it.
16. **Scalar / quantity implicature** — *"some X"* implies *"not all X"*.
    **Agent risk:** ambiguous. For agents: say *"a subset (not all)"* or give the count.
17. **Deictic / shared-salience reference** — *"the usual way"*, *"as before"*, *"that approach"*.
    **Agent risk:** relies on a shared frame the agent lacks. For agents: name the referent explicitly.

## Quick Reference: Lossy vs Lossless

| Technique | Class | Human | Agent |
|---|---|---|---|
| Term-of-art substitution | Lossless | ✅ | ✅ |
| Phrasal packing | Lossless | ✅ | ✅ |
| Nominalization | Lossless | ✅ | ✅ |
| Given-new ordering | Lossless | ✅ | ✅ |
| Contrastive definition | Lossless | ✅ | ✅ |
| BNF / formal notation | Lossless | ✅ | ✅ |
| Symbol substitution | Lossless | ✅ | ✅ |
| Tabular layout | Lossless | ✅ | ✅ |
| Elision / gapping | Lossless | ✅ | ✅ |
| Define-once / anchor | Lossless | ✅ | ✅ |
| Factoring | Lossless | ✅ | ✅ |
| Hedge/filler elision | Lossless | ✅ | ✅ |
| Implicature | **Lossy** | ✅ | ⛔ |
| Presupposition packing | **Lossy** | ✅ | ⛔ |
| Quantification over enumeration | **Lossy** | ✅ | ⛔ (enumerate) |
| Scalar implicature | **Lossy** | ✅ | ⛔ |
| Deictic reference | **Lossy** | ✅ | ⛔ |

## When to Relax (prefer explicitness over compression)

Density must never hide a caveat or create ambiguity. Favor full, plain phrasing for:

- Safety / security warnings.
- Irreversible or destructive-action confirmations.
- Legal / compliance text.
- Teaching a learner who does not yet know the term-of-art (define it, then use it).
- User explicitly asks for verbose / step-by-step / ELI5.
- Any case where the dense form could be read two ways.

## Red Flags

These thoughts mean you're degrading accuracy, not compressing — STOP.

| Thought | Reality |
|---|---|
| "They'll know what I mean" (output is agent-bound) | Lossy leaking into AGENT mode. Unpack it. |
| "I'll shorten this identifier / path / flag" | Never touch literals (§5). |
| "Dropping this caveat tightens it up" | That's omission of content, often on a safety item. |
| "A fragment reads fine here" | Not if it's ambiguous or ungrammatical. This isn't caveman mode. |
| "Just presuppose it — saves a sentence" | For agents, presupposition smuggles an unverified claim. Assert it explicitly. |
| "Density means shorter, period" | Density means higher bits/token. If clarity dropped, you failed. |

## Self-Check (before sending)

1. **No content lost** — every claim, step, caveat, and constraint from the full-length version survives.
2. **Literals verbatim** — §5 untouched.
3. **Audience gate honored** — if AGENT audience, zero §7 techniques used.
4. **No new ambiguity** — if any dense form reads two ways, restore words.

## Cheat Sheet

- **Symbols:** `→` leads to · `⇒` implies · `∴` therefore · `∵` because · `≈` approx · `≠` not equal · `∈` in · `∀` all · `∃` exists · `w/` with · `w/o` without · `e.g.` for example · `i.e.` that is · `viz.` namely · `cf.` compare.
- **Lossless (always):** term-of-art · phrasal packing · nominalization · given-new · contrastive def · BNF · symbols · tables · gapping · define-once · factoring · cut filler.
- **Lossy (humans only):** implicature · presupposition packing · quantify-don't-enumerate · scalar implicature · deixis.
- **Always verbatim:** code, identifiers, APIs, commands, paths, URLs, errors, numbers, versions, regexes, hashes, env vars.
- **Uncertain audience → lossless.** **Density vs accuracy → accuracy.**
