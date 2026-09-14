import { expect, test, type Page } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

interface GameDebugState {
  phase: string
  elapsed: number
  winner: string | null
  playerElixir: number
  playerHand: string[]
  playerNext: string
  crowns: { player: number; enemy: number }
  entityCount: number
  unitCount: number
  towerCount: number
}

declare global {
  interface Window {
    __game: {
      getState(): GameDebugState
      fastForward(seconds: number): void
      tileToScreen(x: number, y: number): { x: number; y: number }
      getAssets(): { ready: boolean; loaded: number; total: number; failed: string[]; arena: boolean;
        views: { id: number; model: string; destroyed: boolean }[] }
    }
  }
}

async function openGame(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__game), undefined, { timeout: 20_000 })
  await expect(page.locator('#canvas-host canvas')).toBeVisible()
}

async function getState(page: Page): Promise<GameDebugState> {
  return page.evaluate(() => window.__game.getState())
}

async function dragCardTo(page: Page, slot: number, tileX: number, tileY: number): Promise<void> {
  const card = page.locator(`.card[data-slot="${slot}"]`)
  const box = await card.boundingBox()
  if (!box) throw new Error(`卡牌 slot=${slot} 不可见`)
  const target = await page.evaluate(
    ({ x, y }: { x: number; y: number }) => window.__game.tileToScreen(x, y),
    { x: tileX, y: tileY },
  )
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 10 })
  await page.mouse.up()
}

test.describe('Royale Clone 功能测试', () => {
  test('1. 页面加载：canvas 与 HUD 元素齐全', async ({ page }) => {
    await openGame(page)
    // 对局在页面加载后即开始计时（3:00 起倒数）
    await expect(page.locator('#timer')).toHaveText(/^[23]:\d{2}$/)
    await expect(page.locator('#crowns-player')).toHaveText('0')
    await expect(page.locator('#crowns-enemy')).toHaveText('0')
    await expect(page.locator('#elixir .elixir-cell')).toHaveCount(10)
    await expect(page.locator('#hand .card[data-slot]')).toHaveCount(4)
    await expect(page.locator('#hand .card.next')).toHaveCount(1)

    const state = await getState(page)
    expect(state.towerCount).toBe(6)
    expect(state.phase).toBe('normal')
    const assets = await page.evaluate(() => window.__game.getAssets())
    expect(assets.ready).toBe(true)
    expect(assets.failed).toEqual([])
    expect(assets.arena).toBe(true)
    expect(assets.views.filter(v => /^(king|princess)(Blue|Red)$/.test(v.model))).toHaveLength(6)
  })

  test('2. 初始手牌、费用与下一张预览正确', async ({ page }) => {
    await openGame(page)
    const names = await page.locator('#hand .card[data-slot] .card-name').allTextContents()
    expect(names).toEqual(['Knight', 'Archers', 'Giant', 'Musketeer'])
    const costs = await page.locator('#hand .card[data-slot] .card-cost').allTextContents()
    expect(costs).toEqual(['3', '3', '5', '4'])
    await expect(page.locator('#hand .card.next .card-name')).toHaveText('Minions')
  })

  test('3. 合法拖拽部署：浮层出现、扣圣水、手牌循环', async ({ page }) => {
    await openGame(page)
    const before = await getState(page)
    expect(before.playerElixir).toBeGreaterThanOrEqual(3)

    const card = page.locator('.card[data-slot="0"]')
    const box = await card.boundingBox()
    if (!box) throw new Error('手牌不可见')
    const target = await page.evaluate(
      ({ x, y }: { x: number; y: number }) => window.__game.tileToScreen(x, y),
      { x: 9, y: 8 },
    )

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x, target.y, { steps: 8 })
    await expect(page.locator('.drag-float')).toHaveCount(1)

    // 浮层应在指针上方，不遮挡落点预览
    const floatBox = await page.locator('.drag-float').boundingBox()
    expect(floatBox).not.toBeNull()
    expect((floatBox?.y ?? 0) + (floatBox?.height ?? 0)).toBeLessThanOrEqual(target.y - 20)

    await page.mouse.up()

    await page.waitForTimeout(400)
    const after = await getState(page)
    expect(after.playerElixir).toBeLessThan(before.playerElixir)
    expect(after.playerHand).not.toContain('knight')
    expect(after.playerHand[0]).toBe('minions')
    expect((await page.evaluate(() => window.__game.getAssets())).views.some(v => v.model === 'knightBlue')).toBe(true)
  })

  test('4. 非法拖拽（敌方半场）：不部署、不扣费、手牌不变', async ({ page }) => {
    await openGame(page)
    const before = await getState(page)

    await dragCardTo(page, 0, 9, 26)
    await page.waitForTimeout(400)

    const after = await getState(page)
    expect(after.playerHand).toEqual(before.playerHand)
    expect(after.playerElixir).toBeGreaterThanOrEqual(before.playerElixir - 0.05)
  })

  test('5. 对局推进：计时递减、圣水增长、实体活动', async ({ page }) => {
    await openGame(page)
    const t0 = await getState(page)
    await page.waitForTimeout(2500)
    const t1 = await getState(page)

    expect(t1.elapsed - t0.elapsed).toBeGreaterThan(1.5)
    expect(t1.playerElixir).toBeGreaterThanOrEqual(t0.playerElixir)
    await expect(page.locator('#timer')).not.toHaveText('3:00')
  })

  test('6. 圣水不足时卡牌灰显', async ({ page }) => {
    await openGame(page)
    await dragCardTo(page, 0, 9, 8)
    await page.waitForTimeout(400)

    const state = await getState(page)
    expect(state.playerElixir).toBeLessThan(4)
    await expect(page.locator('.card[data-slot="3"]')).toHaveClass(/disabled/)
  })

  test('7. 快进至结算：结算面板显示与重开', async ({ page }) => {
    await openGame(page)
    await page.evaluate(() => window.__game.fastForward(400))

    await expect(page.locator('#match-end')).not.toHaveClass(/hidden/, { timeout: 15_000 })
    await expect(page.locator('#match-end-title')).toHaveText(/胜利|失败|平局/)

    await page.locator('#match-end-restart').click()
    await expect(page.locator('#match-end')).toHaveClass(/hidden/)
    await page.waitForTimeout(300)

    const state = await getState(page)
    expect(state.winner).toBeNull()
    expect(state.elapsed).toBeLessThan(10)
    expect(state.towerCount).toBe(6)
    expect((await page.evaluate(() => window.__game.getAssets())).views.some(v => v.destroyed)).toBe(false)
  })

  test('8. 单个新模型缺失时仍能启动并部署', async ({ page }) => {
    await page.route('**/models/lux3d/knight_blue.glb', route => route.abort())
    await openGame(page)
    expect((await page.evaluate(() => window.__game.getAssets())).failed).toContain('knightBlue')
    await dragCardTo(page, 0, 9, 8)
    await expect.poll(async () => (await getState(page)).playerHand[0]).toBe('minions')
  })

  test('9. 战斗素材加载无异常并保存实机截图', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await openGame(page)
    await dragCardTo(page, 0, 3.5, 10)
    await page.evaluate(() => window.__game.fastForward(10))
    await expect.poll(async () => (await page.evaluate(() => window.__game.getAssets())).views.length).toBeGreaterThan(6)
    await page.screenshot({ path: 'artifacts/lux3d-game.png' })
    expect(errors).toEqual([])
  })

  test('10. 单 HTML 在离线 file 模式下加载并可部署', async ({ page, context }) => {
    const errors: string[] = [], requests: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
    await context.setOffline(true)
    await page.goto(pathToFileURL(resolve('dist/royale-offline.html')).href)
    await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('#canvas-host canvas')).toBeVisible()
    const card = await page.locator('.card[data-slot="0"]').boundingBox()
    if (!card) throw new Error('手牌未加载')
    const viewport = page.viewportSize()!
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
    await page.mouse.down()
    await page.mouse.move(viewport.width / 2, viewport.height * 0.57, { steps: 10 })
    await page.mouse.up()
    await expect(page.locator('.card[data-slot="0"] .card-name')).toHaveText('Minions')
    await page.screenshot({ path: 'artifacts/royale-offline.png' })
    expect(errors).toEqual([])
    expect(requests).toEqual([])
  })
})
