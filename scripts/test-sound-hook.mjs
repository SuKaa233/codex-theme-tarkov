import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'sound-hook.mjs');
const DATA = mkdtempSync(join(tmpdir(), 'codex-tarkov-sfx-test-'));

function run(event) {
  const result = spawnSync(process.execPath, [HOOK, '--dry-run'], {
    cwd: ROOT,
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_ROOT: ROOT, PLUGIN_DATA: DATA },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

assert.equal(run({ hook_event_name: 'Stop', session_id: 's1', turn_id: 't1' }).kind, 'complete');
assert.equal(
  run({ hook_event_name: 'PermissionRequest', session_id: 's1', turn_id: 't1', tool_name: 'Bash' }).kind,
  'approval',
);
assert.equal(
  run({
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    turn_id: 't1',
    tool_response: { exit_code: 2, output: 'command failed' },
  }).kind,
  'error',
);
assert.equal(
  run({
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    turn_id: 't1',
    tool_response: { isError: true, content: [] },
  }).kind,
  'error',
);
assert.equal(
  run({
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    turn_id: 't1',
    tool_response: { exit_code: 0, output: 'all checks passed' },
  }),
  null,
);
assert.equal(run({ hook_event_name: 'Stop', stop_hook_active: true }), null);
assert.equal(run({ hook_event_name: 'Interrupt', session_id: 's1', turn_id: 't1' }).kind, 'interrupt');

console.log('Sound hook routing tests passed.');
