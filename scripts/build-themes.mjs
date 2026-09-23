import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = JSON.parse(await readFile(resolve(root, 'desktop/themes.json'), 'utf8'))

for (const variant of ['dark', 'light']) {
  const payload = source[variant]
  const shareString = `codex-theme-v1:${JSON.stringify(payload)}\n`
  await writeFile(resolve(root, `desktop/codex-field-kit-${variant}.txt`), shareString, 'utf8')
}

console.log('Generated desktop theme share strings.')
