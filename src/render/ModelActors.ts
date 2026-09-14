import * as THREE from 'three'
import type { AnimationAction } from 'three'
import type { Entity } from '../core/types'
import type { Team } from '../core/data/arena'
import { ALL_CARDS } from '../core/data/cards'
import { ModelLibrary, type ModelName } from './ModelLibrary'
import { buildAccessory, buildCrown, type AccessoryKind } from './CharacterMeshes'

/**
 * GLB 角色装配：Kenney CC0 模型 + 程序化配件 + 动画绑定。
 * 模型加载失败时返回 null，由 EntityViews 回退到程序化建模。
 */

/** 队伍整体染色（乘性，轻微蓝/红偏色保证敌我辨识） */
const TEAM_TINT: Record<Team, number> = { player: 0x9db8ff, enemy: 0xffab9b }
/** 塔顶部件染色（CR 风格蓝顶/红顶） */
const ROOF_TINT: Record<Team, number> = { player: 0x9fc4ff, enemy: 0xffa898 }

interface AccessorySpec {
  kind: AccessoryKind | 'sword' | 'shield'
  /** 挂载骨骼节点名 */
  node: string
  pos?: [number, number, number]
  rot?: [number, number, number]
}

interface UnitModelConf {
  base: 'human' | 'orc'
  scale: number
  tint?: number
  timeScale?: number
  accessories?: AccessorySpec[]
}

/** 卡牌 → Kenney 角色配置（无人形模型的卡走程序化建模） */
const UNIT_MODEL_CONF: Record<string, UnitModelConf> = {
  knight: {
    base: 'human',
    scale: 1.5,
    accessories: [
      { kind: 'sword', node: 'arm-right', pos: [0.02, -0.3, 0.03] },
      { kind: 'shield', node: 'arm-left', pos: [0.02, -0.28, 0.06] },
    ],
  },
  valkyrie: {
    base: 'human',
    scale: 1.5,
    tint: 0xffd9b8,
    accessories: [{ kind: 'axe', node: 'arm-right', pos: [0, -0.3, 0.03] }],
  },
  giant: { base: 'human', scale: 2.3, tint: 0xd9a878, timeScale: 0.85 },
  musketeer: {
    base: 'human',
    scale: 1.5,
    accessories: [{ kind: 'musket', node: 'arm-right', pos: [0.02, -0.3, 0.03] }],
  },
  archers: {
    base: 'human',
    scale: 1.4,
    tint: 0xcfe0ff,
    accessories: [{ kind: 'bow', node: 'arm-right', pos: [0.02, -0.28, 0.03] }],
  },
  goblins: {
    base: 'orc',
    scale: 1.2,
    timeScale: 1.15,
    accessories: [{ kind: 'dagger', node: 'arm-right', pos: [0.02, -0.28, 0.03] }],
  },
  bomber: {
    base: 'orc',
    scale: 1.15,
    tint: 0xe8e6da,
    accessories: [{ kind: 'bomb', node: 'arm-right', pos: [0.02, -0.3, 0.05] }],
  },
}

export interface UnitActor {
  group: THREE.Group
  barY: number
  mixer: THREE.AnimationMixer | null
  anims: { idle: AnimationAction; walk: AnimationAction; sprint: AnimationAction; attack: AnimationAction } | null
  fast: boolean
}

function tintMaterials(root: THREE.Object3D, tint: number): void {
  const color = new THREE.Color(tint)
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = (mesh.material as THREE.Material).clone()
    ;(mesh.material as THREE.MeshStandardMaterial).color.copy(color)
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null
  root.traverse((child) => {
    if (!found && child.name === name) found = child
  })
  return found
}

function attachAccessories(root: THREE.Group, conf: UnitModelConf, lib: ModelLibrary): void {
  for (const spec of conf.accessories ?? []) {
    const node = findNode(root, spec.node)
    if (!node) continue
    const holder = new THREE.Group()
    if (spec.pos) holder.position.set(spec.pos[0], spec.pos[1], spec.pos[2])
    if (spec.rot) holder.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2])
    let accessory: THREE.Object3D | null = null
    if (spec.kind === 'sword') {
      accessory = lib.cloneStatic('sword')
      if (accessory) accessory.position.set(0, -0.05, 0)
    } else if (spec.kind === 'shield') {
      accessory = lib.cloneStatic('shieldRound')
    } else {
      accessory = buildAccessory(spec.kind)
    }
    if (accessory) holder.add(accessory)
    node.add(holder)
  }
}

/** 实例化带骨骼动画的卡牌角色；模型不可用时返回 null */
export function buildUnitActor(entity: Entity, lib: ModelLibrary): UnitActor | null {
  const models: Record<string, [ModelName, ModelName]> = {
    knight: ['knightBlue', 'knightRed'], archers: ['archerBlue', 'archerRed'],
    giant: ['giantBlue', 'giantRed'], goblins: ['goblinBlue', 'goblinRed'], bomber: ['bomberBlue', 'bomberRed'],
  }
  const pair = models[entity.cardId]
  const generated = pair ? lib.cloneStatic(pair[entity.team === 'enemy' ? 1 : 0]) : null
  if (generated) {
    generated.userData.staticUnit = true
    return { group: generated, barY: new THREE.Box3().setFromObject(generated).max.y + 0.35, mixer: null, anims: null, fast: false }
  }
  const conf = UNIT_MODEL_CONF[entity.cardId]
  if (!conf) return null
  const template = lib.get(conf.base)
  if (!template) return null

  const root = lib.cloneSkinned(conf.base)
  if (!root) return null
  root.scale.setScalar(conf.scale)

  const team = entity.team as Team
  tintMaterials(root, conf.tint ?? TEAM_TINT[team])
  attachAccessories(root, conf, lib)

  const mixer = new THREE.AnimationMixer(root)
  mixer.timeScale = conf.timeScale ?? 1
  const clip = (name: string): THREE.AnimationClip | undefined =>
    template.animations.find((c) => c.name === name)
  const action = (name: string): AnimationAction => {
    const a = mixer.clipAction(clip(name)!)
    a.enabled = true
    a.setLoop(THREE.LoopRepeat, Infinity)
    return a
  }
  if (!clip('idle') || !clip('walk') || !clip('sprint') || !clip('attack-melee-right')) {
    return null
  }
  const anims = {
    idle: action('idle'),
    walk: action('walk'),
    sprint: action('sprint'),
    attack: action('attack-melee-right'),
  }
  anims.idle.play()

  const def = ALL_CARDS[entity.cardId]
  return { group: root, barY: root.scale.y * 0.78 + 0.5, mixer, anims, fast: (def?.speed ?? 1) >= 1.8 }
}

// ---------- 塔（Kenney TDK 模块堆叠） ----------

export interface StaticActor {
  group: THREE.Group
  barY: number
}

function stackTower(
  pieces: (THREE.Group | null)[],
  offsets: number[],
  topTint: number,
): THREE.Group | null {
  const group = new THREE.Group()
  let ok = true
  pieces.forEach((piece, i) => {
    if (!piece) {
      ok = false
      return
    }
    piece.position.y = offsets[i]
    group.add(piece)
  })
  if (!ok) return null
  const top = pieces[pieces.length - 1]
  if (top) tintMaterials(top, topTint)
  return group
}

export function buildTowerActor(entity: Entity, lib: ModelLibrary): StaticActor | null {
  const team = entity.team as Team
  const name = entity.towerKind === 'king'
    ? (team === 'player' ? 'kingBlue' : 'kingRed')
    : (team === 'player' ? 'princessBlue' : 'princessRed')
  const generated = lib.cloneStatic(name)
  if (generated) return { group: generated, barY: new THREE.Box3().setFromObject(generated).max.y + 0.35 }
  if (entity.towerKind === 'king') {
    const group = stackTower(
      [lib.cloneStatic('towerSquareBottom'), lib.cloneStatic('towerSquareMiddle'), lib.cloneStatic('towerSquareTop')],
      [0, 0.5, 1.0],
      ROOF_TINT[team],
    )
    if (!group) return null

    const crown = buildCrown()
    crown.position.y = 1.52
    crown.scale.setScalar(0.72)
    group.add(crown)

    const banner = lib.cloneStatic('banner')
    if (banner) {
      tintMaterials(banner, TEAM_TINT[team])
      banner.scale.setScalar(0.9)
      banner.position.set(0, 0.3, 0.99)
      group.add(banner)
    }

    group.scale.setScalar(2.8)
    return { group, barY: 5.1 }
  }

  const group = stackTower(
    [lib.cloneStatic('towerRoundBottom'), lib.cloneStatic('towerRoundMiddle'), lib.cloneStatic('towerRoundTop')],
    [0, 0.6, 1.2],
    ROOF_TINT[team],
  )
  if (!group) return null
  group.scale.setScalar(2.4)
  return { group, barY: 4.7 }
}

// ---------- 加农炮 ----------

export function buildCannonActor(entity: Entity, lib: ModelLibrary): StaticActor | null {
  const generated = lib.cloneStatic('luxCannon')
  if (generated) return { group: generated, barY: 1.2 }
  const cannon = lib.cloneStatic('cannon')
  if (!cannon) return null
  const team = entity.team as Team
  tintMaterials(cannon, TEAM_TINT[team])
  cannon.scale.setScalar(2.2)
  cannon.position.y = 0.33
  const group = new THREE.Group()
  group.add(cannon)
  return { group, barY: 1.6 }
}
