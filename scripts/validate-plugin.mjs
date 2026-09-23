import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  if (event === 'Interrupt') {
    assert.ok(handler.timeout <= 3, 'Codex allows at most 3 seconds for Interrupt hooks.');
  } else {
    assert.ok(handler.timeout >= 15, `${event} timeout must cover the full 7-second done clip.`);
  }
  assert.match(handler.command, /sound-hook\.mjs/);
}

const config = parse('config/default.json');
assert.equal(config.volume, 0.7, 'Upstream dsh-theme-tarkov uses 70% SFX volume.');
const upstreamHashes = {
  'assets/sounds/done.m4a': 'B05D86E39F52A01296A8D75D4CBEF97224CCF834CE1D775CAD0340145AA75292',
  'assets/sounds/approval.m4a': '720AEDBEF3358909E063CEF104FCA8FE263641D153F3EB812AF20980D664538C',
  'assets/sounds/error.m4a': 'C19E1070168C0A0CA6ACAF8B8A5A7A4518852BFC0FD9CDA70C95ABB764A4C7E6',
};
for (const kind of ['complete', 'approval', 'error', 'interrupt']) {
  const event = config.events[kind];
  assert.equal(event.enabled, true);
  assert.ok(event.cooldownMs >= 0);
  for (const sound of event.sounds) {
    const path = join(ROOT, sound);
    assert.ok(existsSync(path), `Missing sound: ${sound}`);
    const bytes = readFileSync(path);
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp', `Expected M4A/MP4 header: ${sound}`);
    const digest = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    assert.equal(digest, upstreamHashes[sound], `Upstream audio hash mismatch: ${sound}`);
    assert.ok(statSync(path).size > 1000, `Sound is unexpectedly small: ${sound}`);
  }
}

const marketplace = parse('.agents/plugins/marketplace.json');
const entry = marketplace.plugins.find((plugin) => plugin.name === manifest.name);
assert.ok(entry, 'Marketplace entry is missing.');
assert.equal(entry.policy.installation, 'AVAILABLE');
assert.equal(entry.policy.authentication, 'ON_INSTALL');

assert.equal(config.events.interrupt.sounds[0], 'assets/sounds/error.m4a');
console.log('Plugin manifest, hooks, marketplace, and upstream M4A hashes are valid.');
