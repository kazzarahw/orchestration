/**
 * Skill Autoinjection Plugin for OpenCode.ai
 *
 * Injects skill content as a high-salience `user` message via the
 * experimental.chat.messages.transform hook (system.transform content is read
 * but not obeyed by the model — see the hook comment below). Reads skill names
 * from opencode.jsonc's `skill-autoinjection` key (if OpenCode passes it
 * through), falling back to a hardcoded default list.
 *
 * Supports per-agent frontmatter override via agentConfig.skills.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_DIR = path.resolve(__dirname, '../skills');

// Regex to extract YAML frontmatter and body from SKILL.md
// Matches: ---\n...frontmatter...\n---\n...body...
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

// Regex to strip <SUBAGENT-STOP>...</SUBAGENT-STOP> blocks
const SUBAGENT_STOP_RE = /<SUBAGENT-STOP>[\s\S]*?<\/SUBAGENT-STOP>\n*/g;

/**
 * Parse a skill file, extracting frontmatter and body.
 * Returns { name, description, body } or null on failure.
 */
function parseSkillFile(skillPath) {
  if (!fs.existsSync(skillPath)) return null;

  const fullContent = fs.readFileSync(skillPath, 'utf8');
  const match = fullContent.match(FRONTMATTER_RE);
  if (!match) {
    console.warn(`[skill-autoinjection] Skill at ${skillPath} has no frontmatter`);
    return null;
  }

  const frontmatterStr = match[1];
  const body = match[2];

  // Parse YAML frontmatter (simple key: value format)
  const frontmatter = {};
  const lines = frontmatterStr.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Handle folded block scalars (>- and >)
      if (value === '>-' || value === '>') {
        const stripFinalNewline = value === '>-';
        const continuationLines = [];
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (/^[ \t]/.test(nextLine)) {
            continuationLines.push(nextLine.trim());
            i++;
          } else {
            break;
          }
        }
        value = stripFinalNewline
          ? continuationLines.join(' ')
          : continuationLines.join('\n');
      }

      value = value.replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  // Strip SUBAGENT-STOP blocks from body
  const cleanedBody = body.replace(SUBAGENT_STOP_RE, '').trim();

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    body: cleanedBody,
  };
}

/**
 * Build the <AUTO_INJECTED_SKILL> wrapper content for a skill.
 * Uses per-instance cache to avoid repeated disk reads.
 *
 * @param {string} skillName - Name of the skill directory
 * @param {string} skillsDir - Path to skills directory
 * @param {Map} cache - Per-instance injection cache
 * @returns {string|null} Wrapped content or null if skill not found
 */
function buildInjectionContent(skillName, skillsDir, cache) {
  const cacheKey = `${skillsDir}:${skillName}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached === null) return null; // previously failed
    return cached;
  }

  const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
  const parsed = parseSkillFile(skillPath);

  if (!parsed) {
    console.warn(`[skill-autoinjection] Skill "${skillName}" not found at ${skillPath}`);
    cache.set(cacheKey, null);
    return null;
  }

  // HTML-escape name and description for attribute safety
  const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const content = `<AUTO_INJECTED_SKILL name="${escapeHtml(parsed.name)}" description="${escapeHtml(parsed.description)}">
${parsed.body}
</AUTO_INJECTED_SKILL>`;

  cache.set(cacheKey, content);
  return content;
}

export const SkillAutoinjectionPlugin = async ({ client, directory }, options = {}) => {
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  let globalSkillNames = []; // from config, or default list

  // Default skills to inject when no config override is provided.
  // OpenCode ≥1.17 strips unknown keys from opencode.jsonc, so the
  // experimental.skill-autoinjection key may not reach the plugin.
  // This fallback ensures the plugin works out of the box.
  // Override via SKILL_AUTOINJECTION env var (comma-separated names).
  const DEFAULT_SKILLS = (process.env.SKILL_AUTOINJECTION
    ? process.env.SKILL_AUTOINJECTION.split(',').map(s => s.trim()).filter(Boolean)
    : ['workflow-gateway', 'optimize-tokens', 'use-todo']);

  // Per-instance caches
  const injectionCache = new Map();
  // Track which (agent, skill) pairs have been injected: Set<"agent:skillName">
  const injectedTracker = new Set();

  return {
    /**
     * Config hook: registers skills path and reads skill-autoinjection config.
     */
    config: async (config) => {
      // Register skills path so OpenCode discovers skills
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }

      // Read skill names from config (experimental namespace — OpenCode 1.17+).
      // Fall back to top-level key for older versions.
      // If neither provides a value, use the hardcoded default list.
      const injectionConfig = (config.experimental && config.experimental['skill-autoinjection'])
        || config['skill-autoinjection'];
      globalSkillNames = (injectionConfig && Array.isArray(injectionConfig))
        ? injectionConfig
        : DEFAULT_SKILLS;
    },

    /**
     * Messages transform hook: injects skill content as a high-salience `user`
     * message appended to the conversation.
     *
     * WHY not system.transform: measured on the deployment model, content pushed
     * via system.transform is *read but not obeyed* (0/3 compliance — same as no
     * guidance). The identical text delivered as a recent `user` message is obeyed
     * (2/3). The delivery channel — not the wording — drives enforcement. This
     * mirrors the obra/superpowers approach of injecting its bootstrap as a
     * message rather than trailing system text.
     *
     * Fires per model round-trip; we inject the skill bundle once per agent per
     * process (dedup via injectedTracker) to avoid duplication mid-turn.
     */
    'experimental.chat.messages.transform': async (input, output) => {
      if (!globalSkillNames.length) return;
      if (!output.messages || !output.messages.length) return;

      const agentName = input.agent || 'default';

      // Per-agent frontmatter override: agentConfig.skills overrides the global list
      const skillsToInject = (input.agentConfig && Array.isArray(input.agentConfig.skills))
        ? input.agentConfig.skills
        : globalSkillNames;
      if (!skillsToInject.length) return;

      // Dedup: inject the skill bundle once per agent per process.
      const bundleKey = `${agentName}:__bundle__`;
      if (injectedTracker.has(bundleKey)) return;

      const blocks = [];
      for (const skillName of skillsToInject) {
        const content = buildInjectionContent(skillName, skillsDir, injectionCache);
        if (content) blocks.push(content);
      }
      if (!blocks.length) return;

      const text = `These are mandatory operating instructions for this session. Read and follow them before doing anything else — they define HOW you work and are NOT waived by urgency or by a request to skip them.\n\n${blocks.join('\n\n')}`;

      // Clone an existing message's shape so OpenCode's pipeline (which expects
      // {info, parts}) accepts it; override role to `user`, strip identity fields.
      const sample = output.messages.find((m) => m && m.info) || {};
      const msg = {
        info: { ...(sample.info || {}), role: 'user' },
        parts: [{ type: 'text', text }],
      };
      delete msg.info.id;
      delete msg.info.sessionID;
      output.messages.push(msg);
      injectedTracker.add(bundleKey);
    },
  };
};

export default SkillAutoinjectionPlugin;
