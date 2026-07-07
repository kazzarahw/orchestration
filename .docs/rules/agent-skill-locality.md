# Agent / Skill Locality

**Rule:** Instructions live where they're used. A process with a **single consumer** is embedded in that agent's definition; a technique shared by **two or more** agents is a skill.

- Only Orchestrate ever runs the subagent-driven lifecycle → it is embedded in `orchestrate.md`, not a skill.
- Test-driven-development, systematic-debugging, verification-before-completion are used by Build, Design, and others → they are skills.

**Why:** Locality keeps instructions next to the behavior they govern — no indirection to chase, no second copy to drift. A skill earns its existence by *plural reuse*, the same way the code naming rule says a verb earns a vocabulary slot by plausible recurrence (`extras/rules/naming-conventions.md`). A skill with one consumer is a function called once: inline it.

## The test, before creating a skill

Ask: **who else invokes this?**
- Exactly one agent → embed it in that agent. Do not create a skill.
- Two or more, or a genuinely cross-cutting discipline → skill (then name it per [[skill-naming]]).

A skill that exists only to hold instructions for a single agent is misplaced; fold it in. Conversely, an instruction copied into two agents wants to be extracted into a skill.

**How to apply:** When adding or reviewing framework behavior, place it by consumer count, not by how "reusable it feels." Reusability is proven by an actual second consumer, not anticipated by one.
