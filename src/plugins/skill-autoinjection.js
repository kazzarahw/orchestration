/**
 * Skill Autoinjection Plugin for OpenCode.ai
 *
 * Reads a `skill-autoinjection` key from opencode.jsonc (array of skill names)
 * and injects those skills' content into agent system prompts via the
 * experimental.chat.system.transform hook.
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

const TOOL_MAPPING = `**Tool Mapping for OpenCode:**
When skills request actions, substitute OpenCode equivalents:
- Create or update todos → \`todowrite\`
- \`Subagent (general-purpose):\` → \`task\` with \`subagent_type: "general"\`
- Invoke a skill → OpenCode's native \`skill\` tool
- Read files → \`read\`
- Create, edit, or delete files → \`apply_patch\`
- Run shell commands → \`bash\`
- Search files → \`grep\`, \`glob\`
- Fetch a URL → \`webfetch\`

Use OpenCode's native \`skill\` tool to list and load skills.`;

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
  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      // Handle values with leading '>-' (folded block scalars)
      let value = line.slice(colonIdx + 1).trim();
      if (value.startsWith('>-')) {
        // Folded block scalar — take the first line for description
        value = value.slice(2).trim();
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

  const content = `<AUTO_INJECTED_SKILL name="${parsed.name}" description="${parsed.description}">
${parsed.body}

${TOOL_MAPPING}
</AUTO_INJECTED_SKILL>`;

  cache.set(cacheKey, content);
  return content;
}

export const SkillAutoinjectionPlugin = async ({ client, directory }, options = {}) => {
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  let globalSkillNames = []; // from config["skill-autoinjection"]

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

      // Read skill-autoinjection config
      if (config['skill-autoinjection'] && Array.isArray(config['skill-autoinjection'])) {
        globalSkillNames = config['skill-autoinjection'];
      }
    },

    /**
     * System transform hook: injects skill content into system prompt.
     * Fires at session start and agent switch.
     */
    'experimental.chat.system.transform': async (input, output) => {
      // Guard: no skills configured
      if (!globalSkillNames.length) return;

      // Determine agent identity
      const agentName = input.agent || 'default';

      // Per-agent frontmatter override: if agentConfig has a `skills` array,
      // it overrides the global list for this agent
      const skillsToInject = (input.agentConfig && Array.isArray(input.agentConfig.skills))
        ? input.agentConfig.skills
        : globalSkillNames;

      // Guard: no skills for this agent
      if (!skillsToInject.length) return;

      for (const skillName of skillsToInject) {
        const trackerKey = `${agentName}:${skillName}`;

        // Dedup: skip if already injected for this agent
        if (injectedTracker.has(trackerKey)) continue;

        const content = buildInjectionContent(skillName, skillsDir, injectionCache);
        if (content) {
          output.system.push(content);
          injectedTracker.add(trackerKey);
        }
      }
    },
  };
};

export default SkillAutoinjectionPlugin;
