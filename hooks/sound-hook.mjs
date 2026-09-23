import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(process.env.PLUGIN_ROOT || join(SCRIPT_DIR, '..'));
const PLUGIN_DATA = resolve(
  process.env.PLUGIN_DATA || join(tmpdir(), 'codex-theme-tarkov-data'),
);
const DEFAULT_CONFIG_PATH = join(PLUGIN_ROOT, 'config', 'default.json');
const STATE_PATH = join(PLUGIN_DATA, 'state.json');
const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const result = { dryRun: process.env.CODEX_TARKOV_SFX_DRY_RUN === '1' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') result.dryRun = true;
    if (value === '--preview') result.preview = argv[index += 1];
    if (value === '--config') result.configPath = argv[index += 1];
  }
  return result;
}

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function mergeConfig(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      merged[key] = mergeConfig(base[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function loadConfig(args) {
  const defaults = readJson(DEFAULT_CONFIG_PATH);
  const userConfigPath = join(homedir(), '.codex', 'codex-tarkov-sfx.json');
  const overridePath = resolve(
    args.configPath ||
      process.env.CODEX_TARKOV_SFX_CONFIG ||
      (existsSync(userConfigPath) ? userConfigPath : join(PLUGIN_DATA, 'config.json')),
  );
  const override = existsSync(overridePath) ? readJson(overridePath) : {};
  return { config: mergeConfig(defaults, override), overridePath };
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function eventFromPreview(kind) {
  const events = {
    complete: { hook_event_name: 'Stop', session_id: 'preview', turn_id: 'preview' },
    approval: {
      hook_event_name: 'PermissionRequest',
      session_id: 'preview',
      turn_id: 'preview',
      tool_name: 'Bash',
    },
    error: {
      hook_event_name: 'PostToolUse',
      session_id: 'preview',
      turn_id: 'preview',
      tool_name: 'Bash',
      tool_response: { exit_code: 1 },
    },
    interrupt: { hook_event_name: 'Interrupt', session_id: 'preview', turn_id: 'preview' },
  };
  return events[kind];
}

function hasFailureSignal(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') {
    return (
      /(?:^|\n)\s*(?:error|fatal):/im.test(value) ||
      /process exited with (?:code|status)\s+[1-9]\d*/i.test(value) ||
      /"isError"\s*:\s*true/i.test(value) ||
      /"exit_code"\s*:\s*[1-9]\d*/i.test(value)
    );
  }
  if (Array.isArray(value)) return value.some((item) => hasFailureSignal(item, depth + 1));
  if (typeof value !== 'object') return false;

  if (value.isError === true || value.is_error === true || value.success === false || value.ok === false) {
    return true;
  }
  for (const key of ['exit_code', 'exitCode', 'status_code', 'statusCode']) {
    if (typeof value[key] === 'number' && value[key] !== 0) return true;
  }
  for (const key of ['status', 'state', 'result']) {
    if (typeof value[key] === 'string' && /^(?:error|failed|failure|cancelled)$/i.test(value[key])) {
      return true;
    }
  }
  return Object.values(value).some((item) => hasFailureSignal(item, depth + 1));
}

function classifyEvent(event) {
  switch (event?.hook_event_name) {
    case 'Stop':
      return event.stop_hook_active ? null : 'complete';
    case 'PermissionRequest':
      return 'approval';
    case 'PostToolUse':
      return hasFailureSignal(event.tool_response) ? 'error' : null;
    case 'Interrupt':
      return 'interrupt';
    default:
      return null;
  }
}

function resolveSoundPath(sound) {
  if (isAbsolute(sound)) return sound;
  const candidates = [
    join(PLUGIN_DATA, sound),
    join(PLUGIN_ROOT, sound),
    join(PLUGIN_ROOT, 'assets', 'sounds', sound),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[1];
}

function selectSound(sounds, event) {
  if (!Array.isArray(sounds) || sounds.length === 0) return null;
  const seed = `${event.session_id || ''}:${event.turn_id || ''}:${event.tool_use_id || ''}`;
  const digest = createHash('sha256').update(seed).digest();
  return sounds[digest.readUInt32LE(0) % sounds.length];
}

function claimCooldown(kind, event, cooldownMs, dryRun) {
  if (dryRun) return true;
  mkdirSync(PLUGIN_DATA, { recursive: true });
  const now = Date.now();
  const state = readJson(STATE_PATH, { lastPlayed: {} });
  state.lastPlayed ||= {};
  state.lastPlayed = Object.fromEntries(
    Object.entries(state.lastPlayed).filter(([, value]) => now - Number(value) < MAX_STATE_AGE_MS),
  );
  const key = `${kind}:${event.session_id || 'unknown'}:${event.turn_id || 'none'}`;
  if (now - Number(state.lastPlayed[key] || 0) < cooldownMs) return false;
  state.lastPlayed[key] = now;
  const temporaryPath = `${STATE_PATH}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
  try {
    renameSync(temporaryPath, STATE_PATH);
  } catch {
    // Concurrent hooks can race. Losing a cooldown update must never affect Codex.
  }
  return true;
}

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

function launchPlayer(soundPath, volume) {
  const currentPlatform = platform();
  let child;
  let player;
  if (currentPlatform === 'win32') {
    player = 'System.Windows.Media.MediaPlayer';
    child = spawn(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        [
          'Add-Type -AssemblyName PresentationCore',
          '$p = [System.Windows.Media.MediaPlayer]::new()',
          '$p.Open([Uri]::new($env:CODEX_TARKOV_SFX_FILE))',
          '$deadline = [DateTime]::UtcNow.AddSeconds(5)',
          'while (-not $p.NaturalDuration.HasTimeSpan -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 50 }',
          '$p.Volume = [double]$env:CODEX_TARKOV_SFX_VOLUME',
          '$p.Play()',
          '$duration = if ($p.NaturalDuration.HasTimeSpan) { $p.NaturalDuration.TimeSpan.TotalMilliseconds } else { 5000 }',
          'Start-Sleep -Milliseconds ([Math]::Ceiling($duration + 250))',
          '$p.Close()',
        ].join('; '),
      ],
      {
        env: {
          ...process.env,
          CODEX_TARKOV_SFX_FILE: soundPath,
          CODEX_TARKOV_SFX_VOLUME: String(volume),
        },
        stdio: 'ignore',
        windowsHide: true,
      },
    );
  } else if (currentPlatform === 'darwin') {
    player = 'afplay';
    child = spawn('afplay', ['-v', String(volume), soundPath], { stdio: 'ignore' });
  } else {
    player = commandExists('ffplay') ? 'ffplay' : null;
    if (!player) throw new Error('ffplay is required to play the bundled M4A sounds on Linux.');
    const args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(Math.round(volume * 100)), soundPath];
    child = spawn(player, args, { stdio: 'ignore' });
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(player);
      else reject(new Error(`${player} exited before playback completed (code=${code}, signal=${signal}).`));
    });
  });
}

function appendDebug(message) {
  try {
    mkdirSync(PLUGIN_DATA, { recursive: true });
    const path = join(PLUGIN_DATA, 'debug.log');
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
    writeFileSync(path, `${existing}${new Date().toISOString()} ${message}\n`);
  } catch {
    // Sound hooks are advisory and must never interfere with the Codex lifecycle.
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { config, overridePath } = loadConfig(args);
  if (!config.enabled) return;

  const input = args.preview ? '' : await readStdin();
  const event = args.preview ? eventFromPreview(args.preview) : JSON.parse(input || '{}');
  if (!event) throw new Error(`Unknown preview event: ${args.preview}`);
  const kind = classifyEvent(event);
  if (!kind) return;

  const eventConfig = config.events?.[kind];
  if (!eventConfig?.enabled) return;
  const sound = selectSound(eventConfig.sounds, event);
  if (!sound) return;
  const sourcePath = resolveSoundPath(sound);
  if (!existsSync(sourcePath)) throw new Error(`Sound file not found: ${sourcePath}`);

  const volume = Math.max(0, Math.min(1, Number(config.volume ?? 1)));
  if (volume === 0) return;
  if (!claimCooldown(kind, event, Number(eventConfig.cooldownMs || 0), args.dryRun)) return;

  const player = args.dryRun ? 'dry-run' : await launchPlayer(sourcePath, volume);
  const result = {
    kind,
    hookEvent: event.hook_event_name,
    sound: sourcePath,
    volume,
    overridePath,
    player,
  };
  if (args.dryRun) process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const debugEnabled = readJson(DEFAULT_CONFIG_PATH).debug || process.env.CODEX_TARKOV_SFX_DEBUG === '1';
  if (debugEnabled) appendDebug(error.stack || error.message || String(error));
  // A notification failure must never fail or steer the Codex hook that invoked it.
  process.exitCode = 0;
});

export { classifyEvent, hasFailureSignal, mergeConfig };
