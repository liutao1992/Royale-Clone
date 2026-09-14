import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'

const root = resolve('dist')
const embedded: Record<string, string> = {}
async function collect(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (/\.(glb|png)$/i.test(entry.name)) {
      const type = entry.name.endsWith('.glb') ? 'model/gltf-binary' : 'image/png'
      embedded[relative(root, path).split('\\').join('/')] = `data:${type};base64,${(await readFile(path)).toString('base64')}`
    }
  }
}
await collect(join(root, 'models'))
let html = await readFile(join(root, 'index.html'), 'utf8')
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/)
if (!script) throw new Error('Built entry script not found')
const code = await readFile(resolve(root, script[1]), 'utf8')
const escape = (text: string) => text.replace(/<\/script/gi, '<\\/script')
html = html.replace(script[0], () => `<script>globalThis.__ROYALE_ASSETS__=${JSON.stringify(embedded)};</script><script type="module">${escape(code)}</script>`)
// Fonts are optional; the standalone version uses the existing system-font fallbacks.
html = html.replace(/<link\b[^>]*href="https:\/\/fonts\.[^"]+"[^>]*\/?\s*>/g, '')
await writeFile(join(root, 'royale-offline.html'), html)
console.log(`Standalone game: dist/royale-offline.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`)
