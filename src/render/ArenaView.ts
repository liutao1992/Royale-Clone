import * as THREE from 'three'
import {
  ARENA_WIDTH,
  ARENA_LENGTH,
  RIVER,
  BRIDGES,
  TOWER_SLOTS,
  type TowerSlot,
} from '../core/data/arena'
import { TOWER_CARDS } from '../core/data/cards'

const COLORS = {
  grassLight: '#64b45f',
  grassDark: '#549e52',
  grassEnemyLight: '#59a857',
  grassEnemyDark: '#4a9449',
  water: 0x3d9be8,
  bank: 0x3f7a4a,
  wood: '#a5713f',
  woodDark: 0x6e4a26,
  underlay: 0x2e6b46,
} as const

function towerDef(slot: TowerSlot) {
  return slot.kind === 'king' ? TOWER_CARDS['king-tower'] : TOWER_CARDS['princess-tower']
}

/**
 * 战场静态视图：地面、河流、双桥、调试网格与塔射程圈。
 * 塔与单位等动态实体由 EntityViews 管理。
 */
export class ArenaView {
  readonly root = new THREE.Group()

  private readonly grid: THREE.LineSegments
  private readonly ranges: THREE.Group

  constructor() {
    this.root.add(this.buildUnderlay())
    this.root.add(this.buildGround())
    this.root.add(this.buildRiverAndBridges())

    this.grid = buildGrid()
    this.grid.visible = false
    this.root.add(this.grid)

    this.ranges = buildRangeRings()
    this.ranges.visible = false
    this.root.add(this.ranges)
  }

  toggleGrid(visible?: boolean): boolean {
    this.grid.visible = visible ?? !this.grid.visible
    return this.grid.visible
  }

  toggleRanges(visible?: boolean): boolean {
    this.ranges.visible = visible ?? !this.ranges.visible
    return this.ranges.visible
  }

  /** 场地外的基底，让竞技场从天空背景中"浮"出来 */
  private buildUnderlay(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_WIDTH + 26, 2.4, ARENA_LENGTH + 30),
      new THREE.MeshStandardMaterial({ color: COLORS.underlay, roughness: 1 }),
    )
    mesh.position.set(ARENA_WIDTH / 2, -1.35, ARENA_LENGTH / 2)
    mesh.receiveShadow = true
    return mesh
  }

  private buildGround(): THREE.Group {
    const group = new THREE.Group()
    const halfLength = RIVER.y0

    const playerHalf = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_WIDTH, halfLength),
      new THREE.MeshStandardMaterial({
        map: buildGrassTexture(COLORS.grassLight, COLORS.grassDark, halfLength),
        roughness: 1,
      }),
    )
    playerHalf.rotation.x = -Math.PI / 2
    playerHalf.position.set(ARENA_WIDTH / 2, 0, halfLength / 2)
    playerHalf.receiveShadow = true
    group.add(playerHalf)

    const enemyHalf = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_WIDTH, halfLength),
      new THREE.MeshStandardMaterial({
        map: buildGrassTexture(COLORS.grassEnemyLight, COLORS.grassEnemyDark, halfLength),
        roughness: 1,
      }),
    )
    enemyHalf.rotation.x = -Math.PI / 2
    enemyHalf.position.set(ARENA_WIDTH / 2, 0, RIVER.y1 + halfLength / 2)
    enemyHalf.receiveShadow = true
    group.add(enemyHalf)

    return group
  }

  private buildRiverAndBridges(): THREE.Group {
    const group = new THREE.Group()
    const riverCenter = (RIVER.y0 + RIVER.y1) / 2
    const riverDepth = RIVER.y1 - RIVER.y0

    // 河床下沉，水面略低于地面
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA_WIDTH + 2, 0.6, riverDepth + 1),
      new THREE.MeshStandardMaterial({ color: 0x2b6b8e, roughness: 1 }),
    )
    bed.position.set(ARENA_WIDTH / 2, -0.42, riverCenter)
    group.add(bed)

    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_WIDTH, riverDepth),
      new THREE.MeshStandardMaterial({
        color: COLORS.water,
        roughness: 0.28,
        metalness: 0.15,
        emissive: 0x0c3a66,
        emissiveIntensity: 0.35,
      }),
    )
    river.rotation.x = -Math.PI / 2
    river.position.set(ARENA_WIDTH / 2, -0.08, riverCenter)
    group.add(river)

    // 两岸泡沫亮边
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xcfeeff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    for (const edge of [RIVER.y0, RIVER.y1]) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_WIDTH, 0.28), foamMat)
      foam.rotation.x = -Math.PI / 2
      foam.position.set(ARENA_WIDTH / 2, -0.05, edge === RIVER.y0 ? RIVER.y0 + 0.14 : RIVER.y1 - 0.14)
      group.add(foam)
    }

    // 河岸压边
    const bankMat = new THREE.MeshStandardMaterial({ color: COLORS.bank, roughness: 1 })
    for (const edge of [RIVER.y0, RIVER.y1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH + 2, 0.18, 0.4), bankMat)
      bank.position.set(ARENA_WIDTH / 2, 0.02, edge === RIVER.y0 ? RIVER.y0 - 0.2 : RIVER.y1 + 0.2)
      bank.castShadow = true
      bank.receiveShadow = true
      group.add(bank)
    }

    // 双桥：木纹铺板 + 侧栏
    const plankMat = new THREE.MeshStandardMaterial({
      map: buildPlankTexture(),
      roughness: 0.9,
    })
    const railMat = new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.9 })
    for (const bridge of BRIDGES) {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(bridge.x1 - bridge.x0, 0.16, riverDepth + 0.6),
        plankMat,
      )
      deck.position.set(bridge.centerX, 0.02, riverCenter)
      deck.castShadow = true
      deck.receiveShadow = true
      group.add(deck)

      for (const side of [bridge.x0 + 0.12, bridge.x1 - 0.12]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, riverDepth + 0.6), railMat)
        rail.position.set(side, 0.28, riverCenter)
        rail.castShadow = true
        group.add(rail)
      }
    }

    return group
  }
}

/** 修剪草坪：沿场地长边每 tile 交替的明暗条纹 + 轻微颗粒 */
function buildGrassTexture(light: string, dark: string, halfLength: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = light
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = dark
  ctx.fillRect(0, 32, 64, 32)

  // 轻微草粒噪点
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, Math.max(1, Math.round(halfLength / 2)))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  return texture
}

/** 木桥铺板：横向木板 + 板缝 */
function buildPlankTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = COLORS.wood
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#7a4e2a'
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  for (let y = 4; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 3, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 3)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildGrid(): THREE.LineSegments {
  const y = 0.02
  const points: number[] = []

  for (let x = 0; x <= ARENA_WIDTH; x++) {
    points.push(x, y, 0, x, y, ARENA_LENGTH)
  }
  for (let z = 0; z <= ARENA_LENGTH; z++) {
    points.push(0, y, z, ARENA_WIDTH, y, z)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const material = new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.22 })
  return new THREE.LineSegments(geometry, material)
}

function buildRangeRings(): THREE.Group {
  const group = new THREE.Group()

  for (const slot of TOWER_SLOTS) {
    const def = towerDef(slot)
    const color = slot.team === 'player' ? 0x7fb4ff : 0xff9a9a
    group.add(createRing(slot.x, slot.y, def.combat.range, color))
    group.add(createRing(slot.x, slot.y, def.radius, 0xffffff, 0.35))
  }

  return group
}

function createRing(x: number, z: number, radius: number, color: number, opacity = 0.5): THREE.LineLoop {
  const segments = 96
  const points: number[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    points.push(x + Math.cos(angle) * radius, 0.05, z + Math.sin(angle) * radius)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
}
