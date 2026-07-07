---
name: workflow-gateway
description: Use when starting any turn — forces a workflow/skill check before any response
---
# Workflow Gateway

<SUBAGENT-STOP>
Dispatched as a subagent for a task? Skip this; execute your task.
</SUBAGENT-STOP>

<IRON-LAW>
Before ANY response — including clarifying questions — check whether a skill or the
orchestrate lifecycle applies. If there's even a 1% chance one does, you MUST invoke it.
Not negotiable; you cannot rationalize past it.
</IRON-LAW>

## Before you respond
1. Development task (feature/bug/refactor/change)? → belongs in the `orchestrate` lifecycle;
   never implement ad hoc.
2. Might a skill apply? → invoke it, then announce "Using [skill] to [purpose]".
3. Checklist present? → one todo per item first; the todo list is your source of truth.

## Rationalizations — each means STOP and check
| Thought | Reality |
|---------|---------|
| "Just a simple question" | Questions are tasks. Check first. |
| "Let me explore first" | Skills tell you HOW. Check first. |
| "I'll do one thing first" | Check BEFORE any action. |
| "I remember this skill" | Skills evolve. Invoke the current one. |
| "Too small for the workflow" | Small changes break the most. |
