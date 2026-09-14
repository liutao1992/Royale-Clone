import { describe, expect, it } from 'vitest'
import { makeMatch, simulate, spawnTestUnit } from './helpers'

describe('移动与寻路', () => {
  it('无目标时朝最近敌方塔推进', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 3.5, y: 11 })
    const y0 = knight.pos.y
    simulate(match, 2, () => {
      // 清空目标以测试纯推进（避免锁定干扰）
      knight.targetId = null
    })
    expect(knight.pos.y).toBeGreaterThan(y0 + 1.0)
  })

  it('跨河必须经过桥（不涉水）', () => {
    const match = makeMatch()
    const knight = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 12 })

    let crossed = false
    let offBridge = false

    simulate(match, 60, () => {
      if (knight.removed) return
      const inRiver = knight.pos.y > 15 && knight.pos.y < 17
      if (!inRiver) return
      crossed = true
      const onBridge =
        (knight.pos.x >= 2.5 && knight.pos.x <= 4.5) ||
        (knight.pos.x >= 13.5 && knight.pos.x <= 15.5)
      if (!onBridge) offBridge = true
    })

    expect(crossed).toBe(true)
    expect(offBridge).toBe(false)
  })

  it('Hog Rider 直接跳河（不绕行到桥）', () => {
    const match = makeMatch()
    const hog = spawnTestUnit(match, 'hog-rider', 'player', { x: 9, y: 13 })

    let crossedInRiver = false
    let onBridgeX = false

    simulate(match, 8, () => {
      if (hog.removed) return
      const inRiver = hog.pos.y > 15 && hog.pos.y < 17
      if (!inRiver) return
      crossedInRiver = true
      if (Math.abs(hog.pos.x - 3.5) <= 1.0 || Math.abs(hog.pos.x - 14.5) <= 1.0) {
        onBridgeX = true
      }
    })

    expect(crossedInRiver).toBe(true)
    expect(onBridgeX).toBe(false)
  })

  it('碰撞分离：重叠单位被推开', () => {
    const match = makeMatch()
    const a = spawnTestUnit(match, 'knight', 'player', { x: 9, y: 10 })
    const b = spawnTestUnit(match, 'knight', 'player', { x: 9.1, y: 10 })
    simulate(match, 0.5)
    const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)
    expect(d).toBeGreaterThanOrEqual(0.95)
  })

  it('Giant 沿桥推进不卡死', () => {
    const match = makeMatch()
    const giant = spawnTestUnit(match, 'giant', 'player', { x: 14.5, y: 12 })
    simulate(match, 40, () => {
      giant.targetId = null
    })
    expect(giant.pos.y).toBeGreaterThan(17)
  })
})
