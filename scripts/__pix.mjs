import { chromium } from '@playwright/test'

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://localhost:5199')
  await page.waitForFunction(() => Boolean(window.__game), undefined, { timeout: 20000 })
  await page.waitForTimeout(600)

  // 部署一个骑士（slot 0）到 (9, 8)
  const card = page.locator('.card[data-slot="0"]')
  const box = await card.boundingBox()
  if (!box) throw new Error('card not visible')
  const target = await page.evaluate(() => window.__game.tileToScreen(9, 8))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(500)

  // 采样点：tile -> screen
  const spots = await page.evaluate(() => {
    const t = (x, y) => window.__game.tileToScreen(x, y)
    return {
      sky: { x: 20, y: 20 },
      playerKing: t(9, 3),
      enemyKing: t(9, 29),
      princessL: t(3.5, 6.5),
      princessR: t(14.5, 25.5),
      river: t(9, 16),
      bridge: t(3.5, 16),
      grassA: t(9, 10),
      grassB: t(9, 11),
      unit: t(9, 8),
    }
  })

  const shot = await page.screenshot()
  await browser.close()

  // 在第二个页面解码 PNG 并采样像素
  const b2 = await (await chromium.launch({ channel: 'chrome' })).newPage()
  await b2.goto('about:blank')
  const pixels = await b2.evaluate(
    async ({ b64, spots }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const out = {}
      for (const [name, p] of Object.entries(spots)) {
        let r = 0, g = 0, b = 0, n = 0
        for (let dx = -3; dx <= 3; dx++) {
          for (let dy = -3; dy <= 3; dy++) {
            const d = ctx.getImageData(Math.round(p.x) + dx, Math.round(p.y) + dy, 1, 1).data
            r += d[0]; g += d[1]; b += d[2]; n++
          }
        }
        out[name] = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
      }
      return out
    },
    { b64: shot.toString('base64'), spots },
  )
  await b2.close()

  const result = {}
  for (const [name, c] of Object.entries(pixels)) {
    result[name] = c
  }
  console.log(JSON.stringify(result, null, 2))

  // 断言
  const assert = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg)
      process.exitCode = 1
    } else {
      console.log('ok:', msg)
    }
  }
  const P = pixels
  assert(P.sky.b > P.sky.r && P.sky.b > 120, '天空为蓝色')
  assert(P.river.b > P.river.r && P.river.b > P.grassA.g, '河流为蓝色')
  assert(P.bridge.r > P.bridge.b + 15, '木桥为棕色')
  assert(P.grassA.g > P.grassA.r && P.grassA.g > 100, '草地为绿色')
  assert(Math.abs(P.grassA.g - P.grassB.g) >= 3 || Math.abs(P.grassA.r - P.grassB.r) >= 3, '草地明暗条纹存在')
  for (const t of ['playerKing', 'enemyKing', 'princessL', 'princessR']) {
    assert(Math.abs(P[t].r - P[t].g) < 30 && P[t].r > 110, `${t} 为亮色石塔`)
  }
  assert(
    Math.abs(P.unit.g - P.grassA.g) > 12 || P.unit.b > P.grassA.b + 20,
    '部署单位处像素与草地不同（角色已渲染）',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
