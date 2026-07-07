---
name: design-by-contract
description: Use when implementing any function or module in the build phase — add executable contracts (pre/postconditions, invariants) and property-based tests proportionate to the code's exposure
---
# Design by Contract

<IRON-LAW>
EVERY unit you build gets executable contracts + at least one PROPERTY test — not just examples.
Contracts are guards that throw, not comments. A property constrains the whole output space; an
example checks one point. Scale to exposure, but never ship zero.
</IRON-LAW>

## Proportionate to exposure
| Exposure | Contracts | Properties |
|----------|-----------|-----------|
| Leaf / pure / internal | ≥1 input **precondition** (clear error) | 1–2 properties |
| Public API / risky boundary (auth, data, migrations, money/PII, concurrency, shared core) | full **pre + postconditions + invariants** | several properties + adversarial inputs |

## Contracts (executable, at boundaries)
- **Precondition:** reject invalid input up front with a specific error — e.g.
  `if (typeof x !== "string") throw new TypeError(\`expected string, got \${typeof x}\`)`.
  A `text: string` type does NOT remove the runtime guard at a public boundary.
- **Postcondition:** assert the output satisfies its promise before returning (in tests, or an
  assert in dev builds) — e.g. output matches the slug shape, or is empty.
- **Invariant:** a property that must hold across the object's lifetime / every call.

## Properties (REQUIRED — write at least one; prefer over enumerated examples)
A property test runs the function over MANY inputs (a loop or table of ≥5) and asserts a predicate
true for ALL of them — NOT one hard-coded expected value. This is separate from your example tests.
Pattern:
```ts
for (const [a, b] of [[1,5],[0,0],[3,9],[42,99],[7,7]]) {
  const r = parseRange(`${a}-${b}`);
  expect(r.start).toBeLessThanOrEqual(r.end);        // invariant over all inputs
}
```
State the rule as `∀ inputs: <predicate on output>`: `slugify` → `""` or matches
`/^[a-z0-9]+(-[a-z0-9]+)*$/`; normaliser → idempotent `f(f(x))===f(x)`; parser → round-trip
`parse(render(x))===x`. A property that restates the implementation is not a property — it must
constrain the OUTPUT space.

**If the code genuinely has no property** (pure I/O glue): the ≥1 requirement becomes ≥1 meaningful
integration assertion on observable effect. State why in the report. (This is a conditional, not a
blanket exemption.)

## Order (with TDD)
1. Seed tests from the spec's acceptance examples (specification-by-example) — these are your first RED.
2. Add the property test(s) + write the contract guards.
3. RED → minimal implementation → GREEN → refactor.

## Red flags — you skipped the spine
Only example-based tests · no input guard on a public boundary · a "property" that echoes the code ·
`typeof`-typed param treated as runtime-safe at an API edge · postcondition asserted nowhere.
