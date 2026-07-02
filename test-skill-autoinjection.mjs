/**
 * Test: skill-autoinjection.js
 *
 * Validates the SkillAutoinjectionPlugin:
 * 1. Loads without errors
 * 2. Has expected hooks (config, system.transform)
 * 3. Config hook reads skill-autoinjection from config
 * 4. System.transform injects skill content
 * 5. Deduplication (no double injection)
 * 6. Missing skill file → console.warn, continues
 * 7. SUBAGENT-STOP blocks stripped
 * 8. Tool mapping appended
 * 9. Per-agent frontmatter override
 */

import path from 'path';
import fs from 'fs';

// ── Setup: pristine temp directory with mock skills ──────

const testId = Date.now();
const testDir = fs.mkdtempSync(`/tmp/skill-autoinjection-test-${testId}-`);
const skillsDir = path.join(testDir, 'skills');
fs.mkdirSync(skillsDir, { recursive: true });

// Helper: create a mock skill file
function createSkill(name, description, body, addSubagentStop = false) {
  const dir = path.join(skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  let content = `---\nname: ${name}\ndescription: ${description}\n---\n\n`;
  if (addSubagentStop) {
    content += `<SUBAGENT-STOP>\nIf you were dispatched as a subagent, skip this.\n</SUBAGENT-STOP>\n\n`;
  }
  content += body;
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
}

// Create test skills
createSkill(
  'test-skill-one',
  'First test skill',
  '## Test Skill One\n\nThis is the body of test skill one.\n\n- Item 1\n- Item 2'
);
createSkill(
  'test-skill-two',
  'Second test skill',
  '## Test Skill Two\n\nThis has different content.\n\nSome code:\n```js\nconst x = 1;\n```'
);
createSkill(
  'test-skill-with-stop',
  'Skill with SUBAGENT-STOP',
  '## Test Skill With Stop\n\nThis has a SUBAGENT-STOP block.\n\nImportant content here.',
  true // adds SUBAGENT-STOP block
);

// ── Helpers ──────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`FAIL: ${message}`);
  }
}

// ── Import the plugin ────────────────────────────────────

let SkillAutoinjectionPlugin;
try {
  const mod = await import('./src/plugins/skill-autoinjection.js');
  SkillAutoinjectionPlugin = mod.SkillAutoinjectionPlugin || mod.default;
  assert(typeof SkillAutoinjectionPlugin === 'function', 'Plugin exports a factory function');
} catch (err) {
  failed++;
  errors.push(`FAIL: Plugin import error: ${err.message}`);
  // If import failed, stop early
  console.error('Plugin import failed — cannot run further tests');
  console.error(`  ${failed} failed, ${passed} passed`);
  process.exit(1);
}

// ── Mock warnings capture ────────────────────────────────

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => {
  warnings.push(args.join(' '));
};

try {

  // ── Test 1: Plugin creates instance ─────────────────────

  let plugin;
  try {
    plugin = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    assert(true, 'Plugin factory returns without error');
    assert(plugin && typeof plugin === 'object', 'Plugin returns an object');
  } catch (err) {
    assert(false, `Plugin factory throws: ${err.message}`);
  }

  // ── Test 2: Plugin has expected hooks ──────────────────

  assert(typeof plugin.config === 'function', 'Plugin has config hook');
  assert(typeof plugin['experimental.chat.system.transform'] === 'function',
    'Plugin has experimental.chat.system.transform hook');

  // ── Test 3: Config hook registers skills path ─────────

  {
    const config = { skills: { paths: [] } };
    await plugin.config(config);
    assert(config.skills.paths.includes(skillsDir),
      'Config hook registers skills path');
  }

  // ── Test 4: Config hook reads skill-autoinjection ─────

  {
    const config = {
      'skill-autoinjection': ['test-skill-one', 'test-skill-two'],
      skills: { paths: [] },
    };
    // Re-create plugin to reset state for this test
    const p2 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p2.config(config);

    const output = { system: [] };
    await p2['experimental.chat.system.transform']({}, output);

    // Should have 2 injected skills
    const injectedCount = output.system.filter(s => s.includes('<AUTO_INJECTED_SKILL')).length;
    assert(injectedCount === 2, `Config-driven: injects 2 skills (got ${injectedCount})`);

    // Check first skill content
    const firstInjection = output.system[0] || '';
    assert(firstInjection.includes('name="test-skill-one"'),
      'First injection has correct skill name');
    assert(firstInjection.includes('description="First test skill"'),
      'First injection has correct description');
    assert(firstInjection.includes('## Test Skill One'),
      'First injection has skill body');

    // Check tool mapping present
    assert(firstInjection.includes('Tool Mapping for OpenCode'),
      'Injection includes tool mapping');
  }

  // ── Test 5: Deduplication ───────────────────────────────

  {
    const config = {
      'skill-autoinjection': ['test-skill-one'],
      skills: { paths: [] },
    };
    const p3 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p3.config(config);

    const output1 = { system: [] };
    const output2 = { system: [] };

    await p3['experimental.chat.system.transform']({ agent: 'test-agent' }, output1);
    await p3['experimental.chat.system.transform']({ agent: 'test-agent' }, output2);

    const count1 = output1.system.filter(s => s.includes('<AUTO_INJECTED_SKILL')).length;
    const count2 = output2.system.filter(s => s.includes('<AUTO_INJECTED_SKILL')).length;

    assert(count1 === 1, `First call injects 1 skill (got ${count1})`);
    assert(count2 === 0, `Second call injects 0 (dedup, got ${count2})`);
  }

  // ── Test 6: Missing skill file warning ──────────────────

  {
    const config = {
      'skill-autoinjection': ['nonexistent-skill'],
      skills: { paths: [] },
    };
    const warningsBefore = warnings.length;
    const p4 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p4.config(config);
    const output = { system: [] };
    await p4['experimental.chat.system.transform']({ agent: 'missing-test' }, output);

    assert(warnings.length > warningsBefore,
      'Missing skill triggers console.warn');
    assert(output.system.length === 0,
      'Missing skill does not inject content');
  }

  // ── Test 7: SUBAGENT-STOP block stripped ────────────────

  {
    const config = {
      'skill-autoinjection': ['test-skill-with-stop'],
      skills: { paths: [] },
    };
    const p5 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p5.config(config);
    const output = { system: [] };
    await p5['experimental.chat.system.transform']({ agent: 'stop-test' }, output);

    const content = output.system[0] || '';
    assert(!content.includes('<SUBAGENT-STOP>'),
      'SUBAGENT-STOP block stripped from injected content');
    assert(!content.includes('If you were dispatched as a subagent'),
      'SUBAGENT-STOP content stripped');
    assert(content.includes('## Test Skill With Stop'),
      'Skill body preserved after stripping');
  }

  // ── Test 8: Tool mapping included ────────────────────────

  {
    const config = {
      'skill-autoinjection': ['test-skill-one'],
      skills: { paths: [] },
    };
    const p6 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p6.config(config);
    const output = { system: [] };
    await p6['experimental.chat.system.transform']({ agent: 'mapping-test' }, output);

    const content = output.system[0] || '';
    assert(content.includes('todowrite'), 'Tool mapping includes todowrite');
    assert(content.includes('`bash`'),
      'Tool mapping includes bash reference');
    assert(content.includes('`skill`'), 'Tool mapping includes skill tool');
    assert(content.includes('</AUTO_INJECTED_SKILL>'),
      'Injection has closing wrapper tag');
  }

  // ── Test 9: Per-agent frontmatter override ──────────────

  {
    const config = {
      'skill-autoinjection': ['test-skill-one'],
      skills: { paths: [] },
    };
    // Per-agent override specifies only test-skill-two
    const p7 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p7.config(config);

    const output = { system: [] };
    // agentConfig.skills overrides global list
    await p7['experimental.chat.system.transform'](
      { agent: 'override-agent', agentConfig: { skills: ['test-skill-two'] } },
      output
    );

    const injectedCount = output.system.filter(s => s.includes('<AUTO_INJECTED_SKILL')).length;
    assert(injectedCount === 1, `Per-agent override injects 1 skill (got ${injectedCount})`);

    const content = output.system[0] || '';
    assert(content.includes('name="test-skill-two"'),
      'Per-agent override injects correct skill (test-skill-two, not test-skill-one)');
    assert(!content.includes('test-skill-one'),
      'Per-agent override does not inject global skill');
  }

  // ── Test 10: Guard — agent already has skill loaded ────

  {
    const config = {
      'skill-autoinjection': ['test-skill-one'],
      skills: { paths: [] },
    };
    const p8 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p8.config(config);

    const output1 = { system: [] };
    const output2 = { system: [] };

    // Simulate agent that already has the skill loaded
    await p8['experimental.chat.system.transform'](
      { agent: 'loaded-agent', _hasSkill: 'test-skill-one' },
      output1
    );

    // This agent should not get injection
    const count = output1.system.filter(s => s.includes('<AUTO_INJECTED_SKILL')).length;
    assert(count === 1, 'Agent without pre-loaded skill gets injection');

    // Now agentConfig.skills = empty → no injection
    const output3 = { system: [] };
    await p8['experimental.chat.system.transform'](
      { agent: 'no-skills-agent', agentConfig: { skills: [] } },
      output3
    );
    assert(output3.system.length === 0,
      'Empty skills list injects nothing');
  }

  // ── Test 11: Empty config = no injection ────────────────

  {
    const config = { skills: { paths: [] } };
    const p9 = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p9.config(config);
    const output = { system: [] };
    await p9['experimental.chat.system.transform']({}, output);
    assert(output.system.length === 0,
      'Empty config injects nothing');
  }

} finally {
  // Restore console.warn
  console.warn = originalWarn;
}

// ── Summary ───────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.error('\nFailures:');
  errors.forEach(e => console.error(`  ${e}`));
}

// Cleanup temp directory
try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}

process.exit(failed > 0 ? 1 : 0);
