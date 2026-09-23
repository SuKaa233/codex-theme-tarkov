import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const prefix = 'codex-theme-v1:'
const hex = /^#[0-9a-f]{6}$/
const source = JSON.parse(await readFile(resolve(root, 'desktop/themes.json'), 'utf8'))

function relativeLuminance(color) {
  const channels = color.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255)
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const variant of ['dark', 'light']) {
  const path = resolve(root, `desktop/codex-field-kit-${variant}.txt`)
  const raw = (await readFile(path, 'utf8')).trim()
  assert.ok(raw.startsWith(prefix), `${variant}: missing ${prefix} prefix`)

  const payload = JSON.parse(raw.slice(prefix.length))
  assert.deepEqual(payload, source[variant], `${variant}: generated share string is stale`)
  assert.equal(payload.variant, variant, `${variant}: variant mismatch`)
  assert.equal(payload.codeThemeId, 'gruvbox', `${variant}: unsupported code theme selection`)
  assert.equal(payload.theme.accentSource, 'custom', `${variant}: accent source must be custom`)
  assert.equal(typeof payload.theme.opaqueWindows, 'boolean')
  assert.ok(Number.isInteger(payload.theme.contrast) && payload.theme.contrast >= 0 && payload.theme.contrast <= 100)

  for (const [name, color] of Object.entries({
    accent: payload.theme.accent,
    ink: payload.theme.ink,
    surface: payload.theme.surface,
    ...payload.theme.semanticColors,
  })) {
    assert.match(color, hex, `${variant}: ${name} is not a six-digit lowercase hex color`)
  }

  const ratio = contrastRatio(payload.theme.ink, payload.theme.surface)
  assert.ok(ratio >= 7, `${variant}: main text contrast ${ratio.toFixed(2)} is below WCAG AAA`)
  assert.equal(typeof payload.theme.fonts.code, 'string')
  assert.equal(typeof payload.theme.fonts.ui, 'string')
}

for (const name of ['Codex Field Kit Dark.tmTheme', 'Codex Field Kit Light.tmTheme']) {
  const xml = await readFile(resolve(root, 'themes', name), 'utf8')
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.ok(xml.includes('<plist version="1.0">'), `${name}: missing plist root`)
  assert.ok(xml.includes(`<string>${name.replace('.tmTheme', '')}</string>`), `${name}: missing display name`)
  assert.equal((xml.match(/<dict>/g) ?? []).length, (xml.match(/<\/dict>/g) ?? []).length, `${name}: unbalanced dict tags`)
  assert.equal((xml.match(/<array>/g) ?? []).length, (xml.match(/<\/array>/g) ?? []).length, `${name}: unbalanced array tags`)
}

const installScript = await readFile(resolve(root, 'scripts/install.ps1'), 'utf8')
assert.ok(installScript.includes('Codex Field Kit Dark.tmTheme'))
assert.ok(installScript.includes('Codex Field Kit Light.tmTheme'))
assert.ok(installScript.includes('codex-field-kit-$Variant.txt'))

console.log('All Codex Field Kit theme checks passed.')
