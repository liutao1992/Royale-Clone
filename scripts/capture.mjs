import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const port = process.argv[2] ?? '5199'
mkdirSync('artifacts', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (err) => console.log('[pageerror]', err.message))

await page.goto(`http://localhost:${port}/`)
await page.waitForFunction(() => Boolean(window.__game))
await page.waitForTimeout(800)
await page.screenshot({ path: 'artifacts/01-initial.png' })

const card = page.locator('.card[data-slot="0"]')
const box = await card.boundingBox()
const target = await page.evaluate(
  ({ x, y }) => window.__game.tileToScreen(x, y),
  { x: 9, y: 12 },
)
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(target.x, target.y, { steps: 8 })
await page.waitForTimeout(200)
console.log('preview during drag:', JSON.stringify(await page.evaluate(() => window.__game.getPreview())))
await page.screenshot({ path: 'artifacts/02-dragging.png' })
// 隐藏卡片浮层，验证 3D 幽灵预览与区域高亮
await page.evaluate(() => {
  const el = document.querySelector('.drag-float')
  if (el) el.style.display = 'none'
})
await page.screenshot({
  path: 'artifacts/02b-preview-zoom.png',
  clip: { x: 380, y: 340, width: 560, height: 300 },
})
await page.mouse.up()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'artifacts/03-deployed.png' })

await page.evaluate(() => window.__game.fastForward(100))
await page.waitForTimeout(1200)
await page.screenshot({ path: 'artifacts/04-midbattle.png' })

await page.evaluate(() => window.__game.fastForward(400))
await page.waitForTimeout(800)
await page.screenshot({ path: 'artifacts/05-result.png' })

const state = await page.evaluate(() => window.__game.getState())
console.log('final state:', JSON.stringify(state))
console.log('screenshots saved to artifacts/')
await browser.close()
