import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const parse = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

const manifest = parse('.codex-plugin/plugin.json');
assert.equal(manifest.name, 'codex-theme-tarkov');
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
assert.ok(manifest.description);
assert.ok(manifest.author?.name);
assert.ok(manifest.interface?.displayName);
assert.equal('hooks' in manifest, false, 'Default hooks/hooks.json discovery should be used.');

const hooks = parse('hooks/hooks.json');
for (const event of ['Stop', 'PermissionRequest', 'PostToolUse', 'Interrupt']) {
  assert.ok(Array.isArray(hooks.hooks[event]), `Missing ${event} hook.`);
  const handler = hooks.hooks[event][0].hooks[0];
  assert.equal(handler.type, 'command');
  assert.equal(handler.async, true);
  assert.match(handler.command, /sound-hook\.mjs/);
}

const config = parse('config/default.json');
for (const kind of ['complete', 'approval', 'error', 'interrupt']) {
  const event = config.events[kind];
  assert.equal(event.enabled, true);
  assert.ok(event.cooldownMs >= 0);
  for (const sound of event.sounds) {
    const path = join(ROOT, sound);
    assert.ok(existsSync(path), `Missing sound: ${sound}`);
    const header = readFileSync(path).subarray(0, 12);
    assert.equal(header.toString('ascii', 0, 4), 'RIFF');
    assert.equal(header.toString('ascii', 8, 12), 'WAVE');
    assert.ok(statSync(path).size > 1000, `Sound is unexpectedly small: ${sound}`);
  }
}

const marketplace = parse('.agents/plugins/marketplace.json');
const entry = marketplace.plugins.find((plugin) => plugin.name === manifest.name);
assert.ok(entry, 'Marketplace entry is missing.');
assert.equal(entry.policy.installation, 'AVAILABLE');
assert.equal(entry.policy.authentication, 'ON_INSTALL');

console.log('Plugin manifest, hooks, marketplace, and WAV assets are valid.');
