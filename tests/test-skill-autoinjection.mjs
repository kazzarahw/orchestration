/**
 * Test: skill-autoinjection.js
 *
 * Validates the SkillAutoinjectionPlugin (messages.transform channel):
 * 1. Loads without errors, exports a factory
 * 2. Has expected hooks (config, messages.transform)
 * 3. Config hook registers skills path + reads skill-autoinjection list
 * 4. messages.transform appends ONE `user` message bundling the skills
 * 5. Bundle contains a block per configured skill, wrapped in <AUTO_INJECTED_SKILL>
 * 6. No TOOL_MAPPING (OpenCode-only build)
 * 7. Deduplication (no double injection per agent per process)
 * 8. SUBAGENT-STOP blocks stripped
 * 10. Empty skills list injects nothing
 * 11. Missing skill file → console.warn, continues
 * 12. Default fallback list includes workflow-gateway
 * 13. Injected message has a valid {info:{role:'user'}, parts:[{type,text}]} shape
 */

import path from 'path';
import fs from 'fs';

const testDir = fs.mkdtempSync(`/tmp/skill-autoinjection-test-`);
const skillsDir = path.join(testDir, 'skills');
fs.mkdirSync(skillsDir, { recursive: true });

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

createSkill('test-skill-one', 'First test skill', '## Test Skill One\n\nBody one.\n- Item 1');
createSkill('test-skill-two', 'Second test skill', '## Test Skill Two\n\nBody two.');
createSkill('test-skill-with-stop', 'Skill with stop', '## Test Skill With Stop\n\nImportant content.', true);

let passed = 0, failed = 0;
const errors = [];
function assert(cond, msg) { if (cond) passed++; else { failed++; errors.push(`FAIL: ${msg}`); } }

// A realistic output object: one existing user message (the plugin clones its shape).
function mkOutput() {
  return {
    messages: [{
      info: { role: 'user', time: { created: 1 }, agent: 'a', model: { providerID: 'p', modelID: 'm' }, id: 'msg_1', sessionID: 'ses_1' },
      parts: [{ type: 'text', text: 'do a thing', id: 'prt_1' }],
    }],
  };
}
// The injected message = the last one whose text contains the wrapper.
function injectedMsg(output) {
  return [...output.messages].reverse().find(m => m?.parts?.[0]?.text?.includes('<AUTO_INJECTED_SKILL'));
}

let SkillAutoinjectionPlugin;
try {
  const mod = await import('../src/plugins/skill-autoinjection.ts');
  SkillAutoinjectionPlugin = mod.SkillAutoinjectionPlugin || mod.default;
  assert(typeof SkillAutoinjectionPlugin === 'function', 'Plugin exports a factory function');
} catch (err) {
  console.error(`Plugin import failed: ${err.message}`);
  process.exit(1);
}

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));

try {
  // Test 1: factory + hooks
  const plugin = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
  assert(plugin && typeof plugin === 'object', 'Plugin returns an object');
  assert(typeof plugin.config === 'function', 'Plugin has config hook');
  assert(typeof plugin['experimental.chat.messages.transform'] === 'function',
    'Plugin has experimental.chat.messages.transform hook');
  assert(plugin['experimental.chat.system.transform'] === undefined,
    'Plugin no longer registers the (ineffective) system.transform hook');

  // Test 2: config registers skills path
  {
    const config = { skills: { paths: [] } };
    await plugin.config(config);
    assert(config.skills.paths.includes(skillsDir), 'Config hook registers skills path');
  }

  // Test 3+4+5+6: config-driven injection into a bundled user message
  {
    const config = { 'skill-autoinjection': ['test-skill-one', 'test-skill-two'], skills: { paths: [] } };
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    const before = output.messages.length;
    await p['experimental.chat.messages.transform']({ agent: 'agentA' }, output);

    assert(output.messages.length === before + 1, 'Injects exactly one bundled message');
    const msg = injectedMsg(output);
    assert(!!msg, 'A bundled message was appended');
    assert(msg.info.role === 'user', 'Injected message has role "user" (high salience)');
    const text = msg?.parts?.[0]?.text || '';
    assert(text.includes('name="test-skill-one"'), 'Bundle contains skill one');
    assert(text.includes('name="test-skill-two"'), 'Bundle contains skill two');
    assert(text.includes('## Test Skill One'), 'Bundle contains skill body');
    assert(!text.includes('Tool Mapping for OpenCode'), 'No TOOL_MAPPING injected');
  }

  // Test 7: dedup — second call for same agent injects nothing more
  {
    const config = { 'skill-autoinjection': ['test-skill-one'], skills: { paths: [] } };
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const o1 = mkOutput(); await p['experimental.chat.messages.transform']({ agent: 'dupe' }, o1);
    const o2 = mkOutput(); await p['experimental.chat.messages.transform']({ agent: 'dupe' }, o2);
    assert(!!injectedMsg(o1), 'First call injects');
    assert(!injectedMsg(o2), 'Second call for same agent does not re-inject (dedup)');
  }

  // Test 8: SUBAGENT-STOP stripped
  {
    const config = { 'skill-autoinjection': ['test-skill-with-stop'], skills: { paths: [] } };
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    await p['experimental.chat.messages.transform']({ agent: 'stop' }, output);
    const text = injectedMsg(output)?.parts?.[0]?.text || '';
    assert(!text.includes('<SUBAGENT-STOP>'), 'SUBAGENT-STOP block stripped');
    assert(text.includes('## Test Skill With Stop'), 'Skill body preserved after stripping');
  }

  // Test 10: explicit empty list → nothing
  {
    const config = { 'skill-autoinjection': [], skills: { paths: [] } };
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    await p['experimental.chat.messages.transform']({ agent: 'empty' }, output);
    assert(!injectedMsg(output), 'Explicit empty skill list injects nothing');
  }

  // Test 11: missing skill warns, continues
  {
    const config = { 'skill-autoinjection': ['nonexistent-skill'], skills: { paths: [] } };
    const before = warnings.length;
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    await p['experimental.chat.messages.transform']({ agent: 'missing' }, output);
    assert(warnings.length > before, 'Missing skill triggers console.warn');
    assert(!injectedMsg(output), 'Missing skill injects nothing');
  }

  // Test 12: default fallback list includes workflow-gateway
  {
    createSkill('workflow-gateway', 'gateway', '## Gateway body');
    createSkill('optimize-tokens', 'tokens', '## Tokens body');
    createSkill('use-todo', 'todo', '## Todo body');
    const config = { skills: { paths: [] } }; // no key → fallback to DEFAULT_SKILLS
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    await p['experimental.chat.messages.transform']({ agent: 'def' }, output);
    const text = injectedMsg(output)?.parts?.[0]?.text || '';
    assert(text.includes('name="workflow-gateway"'), 'Default list injects workflow-gateway');
    assert(text.includes('name="optimize-tokens"'), 'Default list injects optimize-tokens');
    assert(text.includes('name="use-todo"'), 'Default list injects use-todo');
  }

  // Test 13: injected message shape is valid + no identity leakage
  {
    const config = { 'skill-autoinjection': ['test-skill-one'], skills: { paths: [] } };
    const p = await SkillAutoinjectionPlugin({ client: {}, directory: testDir }, { skillsDir });
    await p.config(config);
    const output = mkOutput();
    await p['experimental.chat.messages.transform']({ agent: 'shape' }, output);
    const msg = injectedMsg(output);
    assert(Array.isArray(msg.parts) && msg.parts[0].type === 'text', 'Injected message has a text part');
    assert(msg.info && msg.info.role === 'user', 'Injected message info.role is user');
    assert(msg.info.id === undefined && msg.info.sessionID === undefined,
      'Injected message does not leak a cloned id/sessionID');
  }

} finally {
  console.warn = originalWarn;
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (errors.length) { console.error('\nFailures:'); errors.forEach(e => console.error(`  ${e}`)); }
try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
process.exit(failed > 0 ? 1 : 0);
