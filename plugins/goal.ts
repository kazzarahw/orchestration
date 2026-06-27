import { type Plugin, type PluginInput, tool } from "@opencode-ai/plugin"
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "fs"
import { join } from "path"
import { randomUUID } from "crypto"

// ── State types ──────────────────────────────────────────

type GoalStatus = "working" | "review" | "done" | "stalled" | "cancelled" | "paused"

interface GoalState {
  goal: string
  status: GoalStatus
  round: number
  finite_incantatem: boolean
  verifier_passed: boolean
  stagnant_rounds: number
  paused_by_user: boolean
  created_at: string
  updated_at: string
  turns_used: number
  last_injected_round: number
  progress_log: Array<{ round: number; phase: string; summary: string }>
}

const STATE_FILENAME = "state.json"
const GOALS_DIR_RELATIVE = ".opencode/goals"
const MAX_ROUNDS_HARD = 50
const STAGNATION_NUDGE_AT = 3
const STAGNATION_ESCALATED_AT = 5
const STAGNATION_FORCE_STOP_AT = 8
const AUTO_RESUME_TIMEOUT_MS = 60_000
const DEBOUNCE_MS = 1_500

// ── State file helpers ───────────────────────────────────

function getGoalsDir(worktree: string): string {
  return join(worktree, GOALS_DIR_RELATIVE)
}

function getStatePath(goalsDir: string): string {
  return join(goalsDir, STATE_FILENAME)
}

function ensureGoalsDir(goalsDir: string): void {
  if (!existsSync(goalsDir)) {
    mkdirSync(goalsDir, { recursive: true })
  }
}

function defaultState(goal: string, worktree: string): GoalState {
  const now = new Date().toISOString()
  return {
    goal,
    status: "working",
    round: 1,
    finite_incantatem: false,
    verifier_passed: false,
    stagnant_rounds: 0,
    paused_by_user: false,
    created_at: now,
    updated_at: now,
    turns_used: 0,
    last_injected_round: 0,
    progress_log: [{ round: 1, phase: "implementer", summary: "Goal set: " + goal }],
  }
}

function readState(worktree: string): GoalState | null {
  const goalsDir = getGoalsDir(worktree)
  const statePath = getStatePath(goalsDir)
  if (!existsSync(statePath)) return null
  try {
    const raw = readFileSync(statePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (!parsed.goal || !parsed.status || typeof parsed.round !== 'number' || typeof parsed.turns_used !== 'number') return null
    return parsed as GoalState
  } catch {
    return null
  }
}

function writeState(worktree: string, state: GoalState): boolean {
  const goalsDir = getGoalsDir(worktree)
  ensureGoalsDir(goalsDir)
  const statePath = getStatePath(goalsDir)
  const tmpPath = statePath + ".tmp." + randomUUID().slice(0, 8)
  try {
    state.updated_at = new Date().toISOString()
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8")
    renameSync(tmpPath, statePath)
    return true
  } catch (err) {
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch {}
    return false
  }
}

function deleteState(worktree: string): void {
  const statePath = getStatePath(getGoalsDir(worktree))
  try { if (existsSync(statePath)) unlinkSync(statePath) } catch {}
}

// ── Simple mutex for event serialization ─────────────────

class SimpleMutex {
  private _locked = false
  private _queue: Array<() => void> = []

  async acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true
      return
    }
    return new Promise((resolve) => {
      this._queue.push(() => {
        this._locked = true
        resolve()
      })
    })
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!
      next()
    } else {
      this._locked = false
    }
  }
}

// ── Phase enforcement ────────────────────────────────────

interface UpdateRequest {
  progress?: string
  finite_incantatem?: boolean
  verifier_passed?: boolean
  status?: GoalStatus
}

interface UpdateResult {
  ok: boolean
  error?: string
  state: GoalState
}

function applyUpdate(current: GoalState, req: UpdateRequest): UpdateResult {
  const state: GoalState = JSON.parse(JSON.stringify(current))

  // Status transitions
  if (req.status) {
    const allowed: Record<GoalStatus, GoalStatus[]> = {
      working: ["paused", "done", "stalled", "cancelled"],
      review: ["done", "working", "stalled", "cancelled"],
      done: [],
      stalled: [],
      cancelled: [],
      paused: ["working", "cancelled"],
    }
    const valid = allowed[state.status]?.includes(req.status)
    if (!valid) {
      return { ok: false, error: `Cannot transition from ${state.status} to ${req.status}`, state: current }
    }
    state.status = req.status
  }

  // finite_incantatem can only be set in working phase
  if (req.finite_incantatem === true) {
    if (state.status !== "working") {
      return { ok: false, error: "Cannot set finite_incantatem=true outside working phase", state: current }
    }
    state.finite_incantatem = true
    state.status = "review"
  }
  if (req.finite_incantatem === false) {
    state.finite_incantatem = false
    if (state.status === "review") {
      state.status = "working"
    }
  }

  // verifier_passed can only be set in review phase
  if (req.verifier_passed === true) {
    if (state.status !== "review") {
      return { ok: false, error: "Cannot set verifier_passed=true outside review phase", state: current }
    }
    state.verifier_passed = true
    state.status = "done"
  }

  // Progress logging
  if (req.progress) {
    state.progress_log.push({
      round: state.round,
      phase: state.status === "review" ? "verifier" : "implementer",
      summary: req.progress,
    })
  }

  state.turns_used++
  return { ok: true, state }
}

// ── Stagnation helpers ──────────────────────────────────

function detectStagnation(state: GoalState, _worktree: string): {
  stagnant: boolean
  nudge: string | null
  forceStop: boolean
} {
  // Hard max round limit
  if (state.round >= MAX_ROUNDS_HARD) {
    state.status = "stalled"
    return { stagnant: true, nudge: null, forceStop: true }
  }

  // Check 1: Progress log last two entries identical → no progress
  const log = state.progress_log
  if (log.length >= 2) {
    const last = log[log.length - 1].summary
    const prev = log[log.length - 2].summary
    if (last === prev && !last.includes("Goal set:")) {
      return incrementStagnation(state)
    }
  }

  // Check 2: If progress_log has only the initial entry and we're past round 1 → stagnant
  if (log.length <= 1 && state.round > 1) {
    return incrementStagnation(state)
  }

  // Not stagnant — reset counter
  state.stagnant_rounds = 0
  return { stagnant: false, nudge: null, forceStop: false }
}

function incrementStagnation(state: GoalState): {
  stagnant: boolean
  nudge: string | null
  forceStop: boolean
} {
  state.stagnant_rounds++

  if (state.stagnant_rounds >= STAGNATION_FORCE_STOP_AT) {
    state.status = "stalled"
    return { stagnant: true, nudge: null, forceStop: true }
  }

  let nudge: string | null = null
  if (state.stagnant_rounds >= STAGNATION_ESCALATED_AT) {
    nudge = "Escalated nudge: still stuck. Consider a completely different strategy or ask the user for guidance."
  } else if (state.stagnant_rounds >= STAGNATION_NUDGE_AT) {
    nudge = "Nudge: you seem stuck. Try a different approach or break the problem down."
  }

  return { stagnant: true, nudge, forceStop: false }
}

// ── Plugin entry ────────────────────────────────────────

export const GoalPlugin: Plugin = async ({ client, project, directory, worktree }: PluginInput) => {
  const mutex = new SimpleMutex()
  const wt = worktree || directory

  // Module-level state (in-memory)
  let currentGoal: GoalState | null = null
  let currentSessionID: string | null = null
  let active: boolean = false
  let pendingResume: boolean = false  // goal loaded from disk, awaiting user confirmation
  let lastIdleTime: number = 0
  let pausedAt: number = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Helpers ──────────────────────────────────────────

  function isActive(): boolean {
    return active && currentGoal !== null && ["working", "review"].includes(currentGoal.status)
  }

  function isPaused(): boolean {
    return currentGoal !== null && currentGoal.status === "paused"
  }

  function queueContinuation(delayMs: number = DEBOUNCE_MS): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (!currentGoal) return
      await mutex.acquire()
      try {
        if (!isActive() || isPaused()) return

        // Re-read state from disk to get latest
        const diskState = readState(wt)
        if (diskState && diskState.updated_at !== currentGoal.updated_at) {
          currentGoal = diskState
        }
        if (!isActive()) return

        const goal = currentGoal.goal
        const phase = currentGoal.status === "review" ? "verification" : "implementation"
        const msg = `[Auto] Goal round ${currentGoal.round} (${phase}): continue working on "${goal}"`

        // Internal/undocumented API — confirmed working on OpenCode v1.17.4
        // See: github.com/watzon/opencode-goal for reference usage
        await (client as any).session?.prompt?.(msg)
      } catch (err) {
        console.error("[goal-plugin] continuation failed:", err)
        if (currentGoal) {
          currentGoal.status = "stalled"
          currentGoal.progress_log.push({
            round: currentGoal.round,
            phase: "implementer",
            summary: "Auto-continuation failed — possibly non-TUI mode",
          })
          writeState(wt, currentGoal)
        }
      } finally {
        mutex.release()
      }
    }, delayMs)
  }

  function cancelDebounce(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function cleanupGoal(): void {
    cancelDebounce()
    currentGoal = null
    active = false
    pendingResume = false
    currentSessionID = null
  }

  // Load state from disk on init (check for resume)
  const savedState = readState(wt)
  if (savedState && ["working", "review", "paused"].includes(savedState.status)) {
    currentGoal = savedState
    pendingResume = true
    // active remains false until user confirms resume
  }

  return {
    // ── config: register command for discoverability ──────
    config: async (config) => {
      config.command = config.command || {}
      if (!config.command.goal) {
        config.command.goal = {
          description: "Set a goal and loop until verified complete",
          template: "/goal $ARGUMENTS",
        }
      }
    },

    // ── command.execute.before: intercept /goal ──────────
    "command.execute.before": async (input, output) => {
      if (input.command !== "goal") return

      await mutex.acquire()
      try {
        const description = input.arguments?.trim() || ""

        // If there's a pending resume, first prompt handles it
        if (pendingResume && currentGoal) {
          if (description.toLowerCase() === "resume" || description.toLowerCase() === "yes") {
            active = true
            pendingResume = false
            currentSessionID = input.sessionID || null
            lastIdleTime = 0
            currentGoal.status = currentGoal.status === "paused" ? "working" : currentGoal.status
            writeState(wt, currentGoal)
            output.parts = [{
              type: "text" as const,
              text: `Resumed goal: "${currentGoal.goal}". Continuing from round ${currentGoal.round}.`,
            }]
          } else if (description) {
            // New goal replaces the pending one
            pendingResume = false
            cleanupGoal()
            deleteState(wt)

            const newState = defaultState(description, wt)
            const ok = writeState(wt, newState)
            if (!ok) {
              output.parts = [{ type: "text" as const, text: "Error: Could not save goal state." }]
              return
            }
            currentGoal = newState
            currentSessionID = input.sessionID || null
            active = true
            output.parts = [{
              type: "text" as const,
              text: `New goal set: ${description}`,
            }]
          } else {
            output.parts = [{
              type: "text" as const,
              text: `A goal from a previous session was found: "${currentGoal.goal}". Type "/goal resume" to continue or "/goal <new>" to replace it.`,
            }]
          }
          return
        }

        if (!description) {
          if (currentGoal && active) {
            output.parts = [{
              type: "text" as const,
              text: `Active goal: "${currentGoal.goal}"\nStatus: ${currentGoal.status}\nRound: ${currentGoal.round}`,
            }]
          } else {
            output.parts = [{
              type: "text" as const,
              text: "Usage: /goal <description>\nSet a goal and the agent will loop until it's verified complete.",
            }]
          }
          return
        }

        // Replace existing goal if active
        if (currentGoal && active) {
          cancelDebounce()
          deleteState(wt)
        }

        // Write state FIRST, then set in-memory — avoids inconsistent state on write failure
        const newState = defaultState(description, wt)
        const ok = writeState(wt, newState)
        if (!ok) {
          output.parts = [{
            type: "text" as const,
            text: "Error: Could not save goal state. Check filesystem permissions.",
          }]
          return
        }

        currentGoal = newState
        currentSessionID = input.sessionID || null
        active = true
        lastIdleTime = 0

        output.parts = [{
          type: "text" as const,
          text: `You have been assigned a goal:\n\n${description}\n\nWork toward this goal. When done, use the goal_plugin_update tool to report progress. Set finite_incantatem=true only when you are certain the goal is 100% complete after inspecting the codebase. Then use goal_plugin_verify to check your work.`,
        }]
      } finally {
        mutex.release()
      }
    },

    // ── experimental.chat.system.transform: inject goal context ──
    "experimental.chat.system.transform": async (input, output) => {
      if (!active || !currentGoal) return

      // Session gating: only inject into the session that owns the goal
      const goalSession = currentSessionID
      const callSession = input.sessionID
      if (goalSession != null && callSession != null && callSession !== goalSession) return

      // Deduplication: skip if already injected for this round
      if (currentGoal.last_injected_round >= currentGoal.round) return

      const state = currentGoal
      let instructions = ""
      let nudge = ""

      if (state.status === "working") {
        instructions =
          "Advance toward the goal. Use goal_plugin_update to log progress. " +
          "Set finite_incantatem=true ONLY when you are certain the goal is 100% complete " +
          "after inspecting the codebase. Then call goal_plugin_verify to check your work."
      } else if (state.status === "review") {
        instructions =
          "The implementer phase claimed the goal is complete (finite_incantatem=true). " +
          "Your job is to verify: use goal_plugin_verify to run a structured self-check. " +
          "Inspect the codebase using read/bash/grep tools. " +
          "If truly complete, set verifier_passed=true. " +
          "If gaps remain, set finite_incantatem=false and describe what's missing."
      }

      if (state.stagnant_rounds >= STAGNATION_NUDGE_AT) {
        nudge = `\n\n⚠️ Nudge: You've been stuck for ${state.stagnant_rounds} rounds. ${
          state.stagnant_rounds >= STAGNATION_ESCALATED_AT
            ? "Consider a completely different strategy or ask the user for guidance."
            : "Try a different approach or break the problem down."
        }`
      }

      const goalContext = `<GOAL_CONTEXT>\nGoal: ${state.goal}\nStatus: ${state.status}\nRound: ${state.round}\n\nProgress so far:\n${
        state.progress_log.map((e) => `  Round ${e.round} (${e.phase}): ${e.summary}`).join("\n")
      }\n\nInstructions:\n${instructions}${nudge}\n</GOAL_CONTEXT>`

      output.system.push(goalContext)
      state.last_injected_round = state.round
    },

    // ── experimental.session.compacting: preserve goal ──
    "experimental.session.compacting": async (input, output) => {
      if (!active || !currentGoal) return
      if (currentSessionID != null && input.sessionID != null && input.sessionID !== currentSessionID) return
      output.context.push(`Active goal: "${currentGoal.goal}" (round ${currentGoal.round}, status: ${currentGoal.status})`)
    },

    // ── event: session.idle AND tui.command.execute ─────
    event: async ({ event: evt }) => {
      if (evt.type === "tui.command.execute") {
        // Only cancel on Ctrl+C (session.interrupt), not on page up/down or other TUI navigation
        const cmd = (evt as any).properties?.command
        if (cmd && cmd !== "session.interrupt") return
        if (!active || !currentGoal) return
        await mutex.acquire()
        try {
          if (!currentGoal) return
          cancelDebounce()
          currentGoal.status = "cancelled"
          writeState(wt, currentGoal)
          deleteState(wt)
          cleanupGoal()
        } finally {
          mutex.release()
        }
        return
      }

      if (evt.type === "session.idle") {
        if (!active || !currentGoal) return

        await mutex.acquire()
        try {
          if (!active || !currentGoal) return
          if (["done", "stalled", "cancelled"].includes(currentGoal.status)) {
            cleanupGoal()
            return
          }

          if (currentGoal.status === "paused") {
            if (pausedAt > 0 && Date.now() - pausedAt >= AUTO_RESUME_TIMEOUT_MS) {
              currentGoal.status = "working"
              writeState(wt, currentGoal)
              queueContinuation()
            }
            return
          }

          // Debounce rapid idle events
          const now = Date.now()
          if (lastIdleTime > 0 && now - lastIdleTime < DEBOUNCE_MS) return
          lastIdleTime = now

          // Re-read state from disk (agent may have updated it via goal_plugin_update)
          const diskState = readState(wt)
          if (diskState) {
            currentGoal = diskState
          }

          if (currentGoal.status === "done") {
            cleanupGoal()
            return
          }

          if (currentGoal.status === "working") {
            currentGoal.round++
            const result = detectStagnation(currentGoal, wt)
            writeState(wt, currentGoal)
            if (result.forceStop) {
              cleanupGoal()
              return
            }
            queueContinuation()
          } else if (currentGoal.status === "review") {
            currentGoal.round++
            const result = detectStagnation(currentGoal, wt)
            writeState(wt, currentGoal)
            if (result.forceStop) {
              cleanupGoal()
              return
            }
            queueContinuation()
          }
        } finally {
          mutex.release()
        }
      }
    },

    // ── chat.message: detect user messages → goal pause ──
    "chat.message": async (input, output) => {
      if (!active || !currentGoal) return

      const goalSession = currentSessionID
      const msgSession = input.sessionID
      if (goalSession != null && msgSession != null && msgSession !== goalSession) return

      // chat.message output has { message: UserMessage, parts: Part[] } where UserMessage.role = "user"
      const userRole = (output as { message?: { role?: string } })?.message?.role
      if (userRole !== "user") return

      if (["working", "review"].includes(currentGoal.status)) {
        await mutex.acquire()
        try {
          if (!currentGoal || !["working", "review"].includes(currentGoal.status)) return
          cancelDebounce()
          currentGoal.status = "paused"
          currentGoal.paused_by_user = true
          pausedAt = Date.now()
          writeState(wt, currentGoal)
        } finally {
          mutex.release()
        }
      }
    },

    // ── dispose: cleanup on process exit ────────────────
    dispose: async () => {
      cancelDebounce()
      if (currentGoal && ["working", "review", "paused"].includes(currentGoal.status)) {
        currentGoal.status = "cancelled"
        currentGoal.progress_log.push({
          round: currentGoal.round,
          phase: "implementer",
          summary: "Goal cancelled — process exited",
        })
        writeState(wt, currentGoal)
        deleteState(wt)
      }
      cleanupGoal()
    },

    // ── tool: custom tools ────────────────────────────
    tool: {
      goal_plugin_get: tool({
        description: "Get current goal status, progress, and round information",
        args: {},
        async execute(_args, ctx) {
          const w = ctx.worktree || ctx.directory
          const state = readState(w)
          if (!state) {
            return { title: "No Active Goal", output: "No goal is currently active." }
          }
          return {
            title: `Goal: ${state.goal}`,
            output: JSON.stringify({
              goal: state.goal,
              status: state.status,
              round: state.round,
              finite_incantatem: state.finite_incantatem,
              verifier_passed: state.verifier_passed,
              stagnant_rounds: state.stagnant_rounds,
              turns_used: state.turns_used,
              progress_log: state.progress_log,
            }, null, 2),
          }
        },
      }),

      goal_plugin_update: tool({
        description: "Update goal progress and set completion flags. Server-side phase enforcement prevents invalid state transitions.",
        args: {
          progress: tool.schema.string().optional().describe("Narrative progress update for this round"),
          finite_incantatem: tool.schema.boolean().optional().describe("Set true when you believe the goal is 100% complete"),
          verifier_passed: tool.schema.boolean().optional().describe("(Review phase only) Confirm goal is complete after verification"),
          status: tool.schema.enum(["working", "paused", "done", "stalled", "cancelled"]).optional().describe("Direct status update"),
        },
        async execute(args, ctx) {
          const w = ctx.worktree || ctx.directory
          if (ctx.abort.aborted) return "cancelled"

          const current = readState(w)
          if (!current) {
            return { title: "No Active Goal", output: "No goal is active. Use /goal to set one." }
          }

          const req: UpdateRequest = {}
          if (args.progress) req.progress = args.progress
          if (args.finite_incantatem !== undefined) req.finite_incantatem = args.finite_incantatem
          if (args.verifier_passed !== undefined) req.verifier_passed = args.verifier_passed
          if (args.status) req.status = args.status as GoalStatus

          const result = applyUpdate(current, req)
          if (!result.ok) {
            return { title: "Update Rejected", output: `Phase enforcement: ${result.error}` }
          }

          const ok = writeState(w, result.state)
          if (!ok) {
            return { title: "Error", output: "Failed to save goal state. Check filesystem permissions." }
          }

          let summary = `Round ${result.state.round}: `
          if (result.state.status === "done") {
            summary += "Goal complete! ✓"
          } else if (result.state.status === "stalled") {
            summary += "Goal stalled."
          } else if (result.state.status === "review") {
            summary += "Implementer claims done — awaiting verification."
          } else {
            summary += "Progress updated."
          }

          return { title: `Goal Update (${result.state.status})`, output: summary }
        },
      }),

      goal_plugin_verify: tool({
        description: "Run structured self-verification. Call during review phase to check codebase state against the goal before claiming completion.",
        args: {
          thorough: tool.schema.boolean().default(true).describe("Run comprehensive verification checks"),
        },
        async execute(args, ctx) {
          const w = ctx.worktree || ctx.directory
          if (ctx.abort.aborted) return "cancelled"

          const state = readState(w)
          if (!state) {
            return { title: "No Active Goal", output: "No goal is active." }
          }
          if (state.status !== "review") {
            return { title: "Wrong Phase", output: `Goal is in "${state.status}" phase, not "review". Set finite_incantatem=true first.` }
          }

          return {
            title: "Self-Verification Required",
            output: `Goal: ${state.goal}\n\n` +
              "Examine the codebase thoroughly using read, bash, grep, and glob tools. " +
              `Verify every aspect of the goal is met. Do NOT rely on memory — actually inspect files and run tests.\n\n` +
              "When done, call goal_plugin_update:\n" +
              "- If all checks pass: set verifier_passed=true\n" +
              "- If gaps remain: set finite_incantatem=false and describe what's missing",
          }
        },
      }),
    },
  }
}

export default GoalPlugin
