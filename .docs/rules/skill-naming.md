# Skill Naming

**Rule:** Skill names form a single **noun-phrase family** — name the skill the way you'd say it. A skill is always invoked as "**using ___**", so its name sits in a noun slot; it must read naturally there and round-trip (named how you'd say it ⟷ said how it's named).

- **Disciplines and practices → noun-phrase** (`systematic-debugging`, `design-by-contract`, `verification-before-completion`). Never a verb-first command — no `use-*`, `create-*`, `optimize-*`. "using `optimize-tokens`" stutters and reads as a command in a noun slot; "using `token-efficiency`" reads as a thing.
- **Established methodology terms keep their trained names** (`test-driven-development`, `design-by-contract`, `systematic-debugging`). Renaming them to fit a local scheme discards recognition the model already has.
- **Encode kind in the vocabulary, not the grammar.** Authoring skills are `<artifact>-authoring`; methodologies are `<x>-driven-development`. The name-shape hints the kind without a form-switch that breaks the round-trip.

**Why:** One exceptionless rule the model never has to *classify a skill's kind* to apply. Consistency is what LLMs generalize from most reliably, and a regular name-shape is predictive — it narrows "what is this / when do I reach for it" before the body is read. This is the same leverage the code naming rule uses (`is_`/`verb_noun`/noun); see `extras/rules/naming-conventions.md`.

## Watch for dense foreign collocations

A name that collides with a heavily-trained phrase in another domain drags in off-target associations. `token-economy` evokes behavioral psychology and crypto; `token-efficiency` points cleanly at the concept. Prefer the unambiguous phrase.

**How to apply:** When authoring a skill (see [[agent-skill-locality]] first — it may not need to be a skill at all), pick the noun-phrase that completes "using ___" cleanly, keeps any established term intact, and avoids a foreign attractor.
