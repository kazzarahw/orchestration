---
name: agent-authoring
description: Use when creating or editing agent/subagent definitions, writing agent system prompts, or structuring YAML frontmatter — not for implementing features
---

# Create Agent

## Overview

A well-designed agent definition is a **structured prompt with explicit boundaries, tools, error handling, and stopping conditions.** An agent without constraints is not an agent — it is an unpredictable text generator.

**Core principle:** Every agent needs four things: role + constraints + tools + stopping conditions. Missing any one produces unreliable behavior.

**The #1 mistake:** Defining the role without defining the constraints. "You are a code reviewer" without saying "You NEVER modify files" will cause the agent to modify files when it thinks it should.

## When to Use

**Use when:** creating a new agent, editing an existing agent, structuring frontmatter, designing multi-agent pipelines, or reviewing agent quality.

**Do NOT use when:** implementing features or writing project plans (use domain-specific skills).

## Process Overview

1. **Understand Requirements** → 2. **Determine Agent Type** → 3. **Write Frontmatter** → 4. **Write Body** → 5. **Add Error Handling** → 6. **Add Stopping Conditions** → 7. **Test & Verify** → (if issues found, back to step 2)

## Step 1: Understand Requirements

Before writing a single line, answer these questions:

| Question | Why It Matters |
|----------|----------------|
| What problem does this agent solve? | Prevents scope creep — agents that try to do everything do nothing well |
| Who invokes it (user or another agent)? | Determines input format and whether it needs to be self-contained |
| What tools does it need? | Too few = can't do the job; too many = dangerous |
| When should it refuse to act? | Defines stopping conditions before it starts |
| What does success look like? | The stopping condition — how does the agent know it's done? |
| What happens on failure? | Error handling — does it retry? Escalate? Abort? |

**Input source determines structure:**

| If invoked by... | Then the agent needs... |
|---|---|
| **User directly** | Clear "when to use" guidance, self-contained instructions |
| **Another agent (pipeline)** | Explicit input schema, output contract, handoff protocol |
| **Orchestrator** | Status reporting, completion signals, escalation path |

## Step 2: Determine Agent Type

Two structural patterns exist. Choose based on the agent's role.

### Pipeline/Workflow Agent

Executes a specific stage in a multi-step process. Passes work to next stage.

**Use when:** The agent is one step in a pipeline, needs to produce structured output for another agent, or follows a sequential workflow.

**Structure:** Frontmatter + Strict Boundaries + Inputs + Workflow steps + Output format + State update + Handoff

**Example agents from reference:** `orchestrate`, `build`, `architect`, `review`, `qa`, `playwright`, `conductor-validator`

### Capability/Expert Agent

Provides domain expertise. Can be invoked independently.

**Use when:** The agent provides specialized knowledge, can work standalone, or needs deep domain expertise.

**Structure:** Frontmatter + Expert Purpose + Capabilities + Behavioral Traits + Knowledge Base + Response Approach + Example Interactions

**Example agents from reference:** `code-reviewer`, `security-auditor`, `data-scientist`, `incident-responder`, `malware-analyst`, `business-analyst`

> **Note:** These two patterns cover most agents but are not exhaustive. For orchestrator/coordinator agents (which manage other agents), utility agents (format conversion, one-shot tasks), or monitoring agents (observe and alert), start with the Pipeline template and strip what doesn't apply. The core four elements — role + constraints + tools + stopping conditions — are always required regardless of pattern.

## Step 3: Write Frontmatter

Frontmatter tells the system what this agent is, when to use it, and what resources it gets. The required and optional fields depend on your platform.

### Required Fields (All Platforms)

```yaml
---
name: agent-name               # Letters, numbers, hyphens only
description: >-                # Use this YAML format
  [Triggering condition and purpose in third person.
  Describe WHEN to invoke, not the agent's internal workflow.]
---
```

**Name conventions:**
- Use hyphens, no spaces: `code-reviewer`, `data-scientist`
- Scoped naming for specificity: `security-scanning-security-auditor`, `git-pr-workflows-code-reviewer`
- Avoid single-word vague names: `helper`, `tool`, `agent`

**Description rules:**
- **Write in third person** (never "I" or "you")
- **Describe triggering conditions**, NOT the agent's internal workflow
- **Include `<example>` blocks** showing real invocation patterns (see below)
- Aim for 150-200 characters for the core description (examples are additional). Descriptions over 300 characters risk being truncated in discovery systems.

**Description format depends on your platform:**

| Platform | Description Format |
|----------|-------------------|
| **OpenCode** | `description: >-` (folded YAML with `<example>` blocks, see below) |
| **Superpowers / Claude Code** | Single-line: `description: Use when [trigger] — [purpose]` |

```yaml
# OpenCode format
description: >-
  Use this agent to [triggering condition]. It [brief purpose].
  Does NOT [what it doesn't do].

  <example>
  Context: [When would someone use this agent?]
  user: "[Example prompt]"
  assistant: "[How to invoke]"
  <commentary>When to use — brief note.</commentary>
  </example>

# Skill format
description: Use when [triggering condition] — [what it does]
```

**Good vs bad descriptions:**

```yaml
# ✅ GOOD: Triggering condition, third person
description: Use when reviewing pull requests for security vulnerabilities, correctness bugs, or performance issues

# ❌ BAD: No triggering condition, summarizes workflow
description: A code review agent that catches security vulnerabilities and bugs

# ❌ BAD: First person
description: I review code for issues
```

### OpenCode-Specific Fields

If you are creating an agent for OpenCode, these fields are required:

```yaml
mode: subagent                # Agent mode: primary, subagent, or all
permission:
  read: allow                 # Tool permissions: allow or deny
  grep: allow
  edit: deny                  # Deny write access to read-only agents
  bash: deny
  task: allow
  todowrite: allow
  question: allow
  webfetch: allow
  websearch: allow
  skill: allow
```

**`mode` field:**

| Value | When to Use |
|-------|-------------|
| `primary` | Main agent users interact with directly (e.g., the orchestrate agent) |
| `subagent` | Agent invoked by other agents, never directly by users |
| `all` | Agent usable both as primary and as subagent |

**`permission` block:**
- Every entry is a tool name with `allow` or `deny`
- **Principle: deny by default, allow selectively.** A reviewer needs `read` + `grep` but NOT `edit` or `bash`.
- Common permission presets:

```yaml
# Read-only reviewer (no write, no execute)
permission:
  read: allow
  grep: allow
  edit: deny
  bash: deny

# Full-access implementer (can write, execute, spawn tasks)
permission:
  read: allow
  grep: allow
  edit: allow
  bash: allow
  task: allow
```

### Optional Fields (Platform-Dependent)

```yaml
model: sonnet                 # Model assignment (names vary by platform)
tools: Read, Glob, Grep, Bash  # Comma-separated tool list (Claude Code)
color: "#21ad01"              # Visual identifier as hex color
```

**Model selection guide (Claude models as example; adapt to your platform):**
- **Small/fast model** — utility agents, reference lookups, mechanical transformations
- **Balanced model** — most pipeline and expert agents
- **Largest/capable model** — complex analysis, security review, architecture, coordination
- **`inherit`** — child/sub-agents that should match whatever model spawned them

**Tool selection principles:**
- **Grant the minimum tools needed.** Every extra tool is a potential failure mode.
- Pipeline agents typically need fewer tools than expert agents.
- Never grant `Write`/`Edit`/`Bash` to read-only agents (reviewers, validators).

```yaml
# ❌ BAD: Read-only reviewer with write access
tools: Read, Write, Edit, Glob, Grep, Bash

# ✅ GOOD: Appropriate tool set for a code reviewer
tools: Read, Glob, Grep, Bash

# ✅ GOOD: Appropriate for a plan-only agent
tools: Read, Glob, Grep
```

**What NOT to put in frontmatter:**
- `temperature`, `max_tokens`, `top_p` — These are inference params, not agent definition fields. They don't belong in agent metadata.
- `system_prompt` as a YAML field — Put the body in markdown, not in a YAML string.
- Execution instructions — Those go in the body.
- `handoff` — Pipeline handoffs are conventions in the body, not frontmatter fields.

## Step 4: Write the Body

**Before any content: start with an H1 heading (`# Role Name`) followed by a role statement sentence.** This establishes identity before diving into rules. Every agent MUST have these two elements at the top of the body.

```markdown
# [Role Name] Agent

You are a [description of who/what the agent is]. [One more sentence defining core function].
```

Do NOT skip the H1 heading. Do NOT jump straight into `## Strict Boundaries` without establishing the role first. Agents need identity context before constraints make sense.

### Pipeline/Workflow Agent Template

```markdown
---
name: [agent-name]
description: Use when [triggering condition]
model: sonnet
tools: Read, Glob, Grep
---

# [Role] Agent

You are a Senior [Role] with [N] years of experience.

## Strict Boundaries

- NO [prohibited action] — what you do instead
- NO [another prohibited action] — reason you don't do it
- ONE task at a time — focus only on the current assignment

## Inputs

- `[file path]` — what it provides
- `[file path]` — what it provides

## Output Format

Write results to `[output file path]` using this schema:

```yaml
field: value       # Required section
list_field: [...]  # Required section
optional_field:    # Only if condition met
```

## Workflow

### 1. Read All Inputs

[Instructions to read inputs thoroughly]

### 2. [Analysis Step]

[What to analyze, how to process]

### 3. [Processing Step]

**Mandatory halt triggers:**
- [Situation where agent must stop and escalate]
- [Situation where agent must stop and escalate]

### 4. Write Output

Write to the output file following the `## Output Format` section. Verify the output matches the schema before finishing.

### 5. Signal Completion

Print: `✅ [Completion message]. Handing off to [next agent].`

## Error Handling

### Recoverable (agent can fix)
- [Recoverable error] → [how to recover]
- [Recoverable error] → [how to recover]

### Unrecoverable (agent must stop)
- [Unrecoverable error] → print: `ESCALATE: [reason]` and STOP

## Stopping Conditions

- ✅ **Done:** [Criteria for completion]
- ⏹️ **Blocked:** [Criteria for blocking]
- ⛔ **Out of scope:** [Criteria for out of scope]
```

### Capability/Expert Agent Template

```markdown
---
name: [scope-prefix-agent-name]
description: Use when [triggering condition]
model: opus
tools: Read, Glob, Grep, Bash
color: cyan
---

# [Role]

You are [an expert / a master / an elite] [role] specializing in [primary domain].

## Expert Purpose

[2-3 sentences describing expertise scope]

## Strict Boundaries

- NO [prohibited action] — what you do instead
- NO [another prohibited action] — reason you don't do it
- NO [another prohibited action] — reason you don't do it

## Capabilities

### [Major Capability 1]

- [Capability with brief description]
- [Capability with brief description]

### [Major Capability 2]

- [Capability with brief description]
- [Capability with brief description]

## Behavioral Traits

- [Positive behavior trait]
- [Positive behavior trait]

## Knowledge Base

- [Knowledge domain]
- [Knowledge domain]

## Response Approach

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Example Interactions

- "[Example prompt]" → "[Expected response]"

## Error Handling

- **Recoverable:** [issue] → [recovery action]
- **Unrecoverable:** [issue] → print: `ESCALATE: [reason]` and STOP

## Stopping Conditions

- ✅ **Done:** [Completion criteria]
- ⏹️ **Blocked:** [Blocking criteria]
- ⛔ **Out of scope:** [Out of scope criteria]
```

## Step 5: Add Error Handling

**Every agent needs error handling.** Without it, agents hallucinate recovery or produce garbage output.

### Error Handling Checklist

```markdown
## Error Handling

### Recoverable Errors (agent can fix)
- Tool fails with timeout → retry once with simpler approach
- File not found → search for alternative paths
- Missing information → state assumptions explicitly, continue

### Unrecoverable Errors (agent must stop)
- Contradictory requirements → escalate to user
- Security implications not addressed in instructions → stop and flag
- Implementation complexity exceeds defined scope → escalate
- Insufficient information to produce meaningful output → escalate
```

**Escalation format — use a clear signal:**

```markdown
## Escalation

If you cannot complete this task:
1. Print: `ESCALATE: [reason]`
2. List exactly what information or decision you need
3. Do NOT guess, continue, or produce partial output
4. STOP and wait for further instructions
```

## Step 6: Add Stopping Conditions

**Without explicit stopping conditions, agents loop forever or stop too early.**

### Three Types of Stopping Conditions

| Type | Example |
|------|---------|
| **Goal achieved** | All requirements verified, report written, tests pass |
| **Blocked** | Missing dependency, contradictory instructions, tool failure beyond retry |
| **Boundary hit** | Exceeded iteration limit, scope outside responsibilities, task type doesn't match |

**Define at least one of each.**

```markdown
## Stopping Conditions

- ✅ **Done:** All acceptance criteria met, output file written, completion message printed
- ⏹️ **Blocked:** Missing input file or tool access needed to proceed — escalate
- ⛔ **Out of scope:** Asked to implement features, write code, or make decisions outside your role — decline with explanation
```

## Step 7: Test Your Agent

**Required verification BEFORE deploying any agent:**

```markdown
## Testing Checklist

### Structure Check
- [ ] Frontmatter has `name` (hyphenated) and `description` (starts with "Use when...")
- [ ] Description is third person, describes triggers, max ~200 chars
- [ ] Body starts with an H1 heading (`# Role Name`) identifying the agent
- [ ] Body has a clear role statement sentence after the H1 heading
- [ ] Body has at least: role statement, constraints, stopping conditions, error handling
- [ ] No `temperature`, `max_tokens`, or inference params in frontmatter
- [ ] Tools are minimal and appropriate for the agent's role

### Quality Check
- [ ] Constraints paired with roles (every "you are X" has a "you do not Y")
- [ ] Error handling covers recoverable AND unrecoverable errors
- [ ] Stopping conditions cover: done, blocked, and out of scope
- [ ] Output format is clearly specified (if agent produces output)
- [ ] Agent type is correct (pipeline vs expert — not a hybrid mishmash)

### Edge Case Check
- [ ] What happens if inputs are missing?
- [ ] What happens if tools fail?
- [ ] What happens if asked to do something outside scope?
- [ ] What if the agent encounters contradictory instructions?

### Behavioral Verification
- [ ] Give the agent a representative test task — does it produce the expected output?
- [ ] Does it stop at the right condition (done, not looping)?
- [ ] Does it escalate when it should (blocked, not guessing)?
- [ ] Does it decline out-of-scope requests?
```

## Common Mistakes

| Mistake | Fix |
|---------|------|
| **Role without constraints** | Every "you are X" needs "you do NOT Y" |
| **No trigger in description** | Describe WHEN to invoke, not what the agent does internally |
| **Inference params in frontmatter** | `temperature`, `max_tokens` are execution config, not agent metadata |
| **Tool over-provisioning** | Grant minimum tools needed. Deny Write/Edit/Bash to reviewers |
| **Content in `system_prompt` YAML field** | Put instructions in the markdown body, not in a YAML string |
| **No error handling** | Add recoverable + unrecoverable error paths |
| **No stopping conditions** | Add done + blocked + out-of-scope conditions |
| **Missing H1 role heading** | Start every agent body with `# Role Name` + role statement |
| **Mixing templates** | Pipeline and Expert templates serve different purposes. Don't hybridize |
| **Vague role** | "You are a helpful agent" → "You are a security auditor specializing in..." |
| **No output format** | Specify exact schema for any output the agent produces |

## Rationalization Bingo

Red flags that mean you're about to skip critical structure:

| Thought | Reality |
|---------|---------|
| "This agent is simple — it doesn't need constraints" | Simple agents need constraints most — less context to self-correct |
| "I'll add stopping conditions later" | No you won't. Add them now or the agent will loop |
| "The role name makes the purpose obvious" | Role names don't trigger discovery. The description does |
| "Error handling is overkill — the agent will figure it out" | Agents hallucinate recovery. You must define it |
| "I know what the output should look like" | Other systems reading the output don't. Specify the format |
| "I can put everything in one long prompt" | Structure prevents LLM drift. Sections keep the agent focused |
| "The tools are obvious from the role" | Not to the system assigning tools. Be explicit |
| "I'll do a hybrid of pipeline and expert templates" | Each serves one purpose. Hybrids serve none well |
| "The H1 heading is unnecessary" | The heading establishes identity before rules make sense |
| "I'll put the role in the description, not the body" | Frontmatter is metadata. The body defines behavior. Both need the role |
| "I can add error handling in the next iteration" | You will deploy it before then. Error handling is table stakes |
| "It's just a prompt, not an agent definition" | Every prompt controlling tool access IS an agent definition |

## Quick Reference

```yaml
# Minimal (all platforms):  name + description
# Standard:                  + model + tools
# OpenCode full:             + mode + permission block
# Full (Claude Code):        + model + tools + color
---
name: my-agent
description: Use when [trigger] - [purpose]
---

### Required Body Sections

| Section | Pipeline Agent | Expert Agent |
|---------|---------------|--------------|
| Role statement | ✓ | ✓ |
| Strict Boundaries | ✓ | ✓ |
| Inputs | ✓ | — |
| Output Format | ✓ | — (when needed) |
| Workflow/Steps | ✓ | — (use Response Approach) |
| Capabilities | — | ✓ |
| Behavioral Traits | — | ✓ |
| Error Handling | ✓ | ✓ |
| Stopping Conditions | ✓ | ✓ |
