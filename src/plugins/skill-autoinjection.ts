/**
 * Skill Autoinjection Plugin for OpenCode.ai
 *
 * Injects skill content as a high-salience `user` message via the
 * experimental.chat.messages.transform hook (system.transform content is read
 * but not obeyed by the model — see the hook comment below). Reads skill names
 * from opencode.jsonc's `skill-autoinjection` key (if OpenCode passes it
 * through), falling back to a hardcoded default list.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Plugin } from '@opencode-ai/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS_DIR = path.resolve(__dirname, '../skills');

// Extract YAML frontmatter and body from SKILL.md: ---\n<frontmatter>\n---\n<body>
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
// Strip <SUBAGENT-STOP>...</SUBAGENT-STOP> blocks (guidance for the primary, not subagents).
const SUBAGENT_STOP_RE = /<SUBAGENT-STOP>[\s\S]*?<\/SUBAGENT-STOP>\n*/g;

interface ParsedSkill {
  name: string;
  description: string;
  body: string;
}

/** Parse a SKILL.md file into { name, description, body }, or null on failure. */
function parseSkillFile(skillPath: string): ParsedSkill | null {
  if (!fs.existsSync(skillPath)) return null;

  const match = fs.readFileSync(skillPath, 'utf8').match(FRONTMATTER_RE);
  if (!match) {
    console.warn(`[skill-autoinjection] Skill at ${skillPath} has no frontmatter`);
    return null;
  }

  const frontmatterStr = match[1];
  const body = match[2];

  // Minimal YAML: `key: value`, plus folded block scalars (>- and >).
  const frontmatter: Record<string, string> = {};
  const lines = frontmatterStr.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if (value === '>-' || value === '>') {
      const stripFinalNewline = value === '>-';
      const continuationLines: string[] = [];
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
        continuationLines.push(lines[i + 1].trim());
        i++;
      }
      value = stripFinalNewline ? continuationLines.join(' ') : continuationLines.join('\n');
    }

    frontmatter[key] = value.replace(/^["']|["']$/g, '');
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    body: body.replace(SUBAGENT_STOP_RE, '').trim(),
  };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Build the <AUTO_INJECTED_SKILL> block for a skill (cached), or null if missing. */
function buildInjectionContent(
  skillName: string,
  skillsDir: string,
  cache: Map<string, string | null>,
): string | null {
  const cacheKey = `${skillsDir}:${skillName}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
  const parsed = parseSkillFile(skillPath);
  if (!parsed) {
    console.warn(`[skill-autoinjection] Skill "${skillName}" not found at ${skillPath}`);
    cache.set(cacheKey, null);
    return null;
  }

  const content = `<AUTO_INJECTED_SKILL name="${escapeHtml(parsed.name)}" description="${escapeHtml(parsed.description)}">
${parsed.body}
</AUTO_INJECTED_SKILL>`;
  cache.set(cacheKey, content);
  return content;
}

export const SkillAutoinjectionPlugin: Plugin = async (_input, options = {}) => {
  const skillsDir = (options.skillsDir as string | undefined) ?? DEFAULT_SKILLS_DIR;

  // Skill list: from opencode.jsonc's `skill-autoinjection` key, else the SKILL_AUTOINJECTION
  // env var (comma-separated), else the hardcoded default. OpenCode ≥1.17 strips unknown
  // config keys, so the fallback is what runs in practice.
  const DEFAULT_SKILLS = process.env.SKILL_AUTOINJECTION
    ? process.env.SKILL_AUTOINJECTION.split(',').map((s) => s.trim()).filter(Boolean)
    : ['workflow-gateway', 'optimize-tokens', 'use-todo'];

  let globalSkillNames: string[] = [];
  const injectionCache = new Map<string, string | null>();
  let injected = false; // dedup: inject the bundle once per plugin instance (session)

  return {
    /** Register the skills path and resolve the skill list to inject. */
    config: async (config) => {
      const c = config as Record<string, any>;
      c.skills = c.skills || {};
      c.skills.paths = c.skills.paths || [];
      if (!c.skills.paths.includes(skillsDir)) c.skills.paths.push(skillsDir);

      const injectionConfig =
        (c.experimental && c.experimental['skill-autoinjection']) || c['skill-autoinjection'];
      globalSkillNames = Array.isArray(injectionConfig) ? injectionConfig : DEFAULT_SKILLS;
    },

    /**
     * Inject the skill bundle as a high-salience `user` message.
     *
     * WHY not system.transform: measured on the deployment model, content pushed via
     * system.transform is *read but not obeyed* (0/3 compliance — same as no guidance).
     * The identical text delivered as a recent `user` message is obeyed (3/3). The delivery
     * channel — not the wording — drives enforcement. This mirrors obra/superpowers, which
     * injects its bootstrap as a message rather than trailing system text.
     *
     * The hook `input` is `{}` (OpenCode provides no agent identity here), so per-agent
     * skill lists are not possible in this hook — the global list applies to every agent.
     * Fires per model round-trip; we inject once per session (dedup flag) to avoid
     * duplicating the bundle mid-turn.
     */
    'experimental.chat.messages.transform': async (_input, output) => {
      if (injected) return;
      if (!globalSkillNames.length || !output.messages?.length) return;

      const blocks: string[] = [];
      for (const name of globalSkillNames) {
        const content = buildInjectionContent(name, skillsDir, injectionCache);
        if (content) blocks.push(content);
      }
      if (!blocks.length) return;

      const text = `These are mandatory operating instructions for this session. Read and follow them before doing anything else — they define HOW you work and are NOT waived by urgency or by a request to skip them.\n\n${blocks.join('\n\n')}`;

      // Clone an existing message so the pushed message satisfies OpenCode's {info, parts}
      // shape; override role to `user` and drop identity fields (fresh message, same session).
      const sample = output.messages[output.messages.length - 1];
      const { id: _id, sessionID: _sid, ...restInfo } = sample.info as Record<string, unknown>;
      output.messages.push({
        info: { ...restInfo, role: 'user' },
        parts: [{ type: 'text', text }],
      } as (typeof output.messages)[number]);
      injected = true;
    },
  };
};

export default SkillAutoinjectionPlugin;
