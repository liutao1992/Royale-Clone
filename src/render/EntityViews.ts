import * as THREE from 'three'
import type { AnimationAction } from 'three'
import type { Entity } from '../core/types'
import type { World } from '../core/World'
import { type Team } from '../core/data/arena'
import { ModelLibrary } from './ModelLibrary'
import {
  buildCannonActor,
  buildTowerActor,
  buildUnitActor,
  type StaticActor,
  type UnitActor,
} from './ModelActors'
import {
  buildCannonMesh,
  buildTowerMesh,
  buildUnitMesh,
  collectMaterials,
} from './CharacterMeshes'

const AIR_HEIGHT = 1.15

interface AnimSet {
  idle: AnimationAction
  walk: AnimationAction
  sprint: AnimationAction
  attack: AnimationAction
}

interface ViewRecord {
  id: number
  entity: Entity
  root: THREE.Group
  body: THREE.Object3D
  materials: THREE.MeshStandardMaterial[]
  bar: HealthBar | null
  phase: number
  destroyed: boolean
  // GLB 骨骼动画（可选）
  mixer: THREE.AnimationMixer | null
  anims: AnimSet | null
  fast: boolean
  currentAnim: string
}

/** 血条：CR 队色（蓝方蓝条 / 红方红条），始终面向相机 */
class HealthBar {
  readonly root = new THREE.Group()

  private readonly fg: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private readonly fgWidth = 1.06

  constructor(y: number, team: Team) {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.16, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x0c1526, transparent: true, opacity: 0.85, depthWrite: false }),
    )
    const trim = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }),
    )
    trim.position.z = 0.006
    this.fg = new THREE.Mesh(
      new THREE.PlaneGeometry(this.fgWidth, 0.1),
      new THREE.MeshBasicMaterial({ color: team === 'player' ? 0x2f8fe8 : 0xe84a3f, depthWrite: false }),
    )
    this.fg.position.z = 0.012
    this.root.add(bg, trim, this.fg)
    this.root.position.y = y
    this.root.visible = false
  }

  set(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio))
    this.root.visible = r < 0.999
    this.fg.scale.x = Math.max(r, 0.001)
    this.fg.position.x = -(1 - r) * (this.fgWidth / 2)
  }

  face(camera: THREE.Camera): void {
    this.root.quaternion.copy(camera.quaternion)
  }

  hide(): void {
    this.root.visible = false
  }
}

/**
 * 动态实体视图管理器：
 * - 优先使用 Kenney CC0 GLB 模型 + 骨骼动画（idle/walk/sprint/attack）
 * - 模型缺失时回退程序化建模（塔 / 部队 / 建筑 / 投射物）
 * - 血条、部署态、法术落点圈、塔的废墟态
 */
export class EntityViews {
  readonly root = new THREE.Group()

  private readonly views = new Map<number, ViewRecord>()

  sync(world: World, camera: THREE.Camera, time: number, dt: number): void {
    const alive = new Set<number>()

    for (const entity of world.entities) {
      alive.add(entity.id)
      let record = this.views.get(entity.id)
      if (!record) {
        record = this.createRecord(entity)
        this.views.set(entity.id, record)
        this.root.add(record.root)
      }
      updateRecord(record, entity, camera, time, dt)
    }

    for (const [id, record] of this.views) {
      if (alive.has(id)) continue
      if (record.entity.kind === 'tower' && !record.destroyed) {
        ruinify(record)
        continue
      }
      if (!record.destroyed) {
        this.root.remove(record.root)
        this.views.delete(id)
      }
    }
  }

  clear(): void {
    for (const record of this.views.values()) {
      this.root.remove(record.root)
    }
    this.views.clear()
  }

  private createRecord(entity: Entity): ViewRecord {
    const root = new THREE.Group()
    const lib = ModelLibrary.instance
    let body: THREE.Object3D
    let barY = 1.6
    let mixer: THREE.AnimationMixer | null = null
    let anims: AnimSet | null = null
    let fast = false

    if (entity.kind === 'tower') {
      const actor: StaticActor | null = buildTowerActor(entity, lib)
      if (actor) {
        body = actor.group
        barY = actor.barY
      } else {
        const built = buildTowerMesh(entity)
        body = built.group
        barY = built.barY
      }
    } else if (entity.kind === 'projectile') {
      if (entity.projectile && entity.projectile.targetId == null) {
        body = createSpellMarker(Math.max(entity.projectile.areaRadius, 0.8))
        barY = 0
      } else {
        const geo = new THREE.SphereGeometry(0.13, 10, 8)
        const material = new THREE.MeshStandardMaterial({
          color: entity.team === 'enemy' ? 0xe0454f : 0x3d8bfd,
          emissive: entity.team === 'enemy' ? 0xe0454f : 0x3d8bfd,
          emissiveIntensity: 0.6,
        })
        body = new THREE.Mesh(geo, material)
        body.position.y = 0.9
        barY = 0
      }
    } else if (entity.kind === 'building') {
      const actor = buildCannonActor(entity, lib)
      if (actor) {
        body = actor.group
        barY = actor.barY
      } else {
        const built = buildCannonMesh(entity)
        body = built.group
        barY = built.barY
      }
    } else {
      const actor: UnitActor | null = buildUnitActor(entity, lib)
      if (actor) {
        body = actor.group
        // 角色总高 ≈ 0.78 × scale，血条悬于头顶
        barY = body.scale.y * 0.78 + 0.5
        mixer = actor.mixer
        anims = actor.anims
        fast = actor.fast
      } else {
        const built = buildUnitMesh(entity)
        body = built.group
        barY = built.barY
        // 空中单位整体抬升基准（builder 返回的 barY 已含抬升）
        if (entity.layer === 'air') {
          body.position.y = AIR_HEIGHT
        }
      }
    }

    // 敌方实体镜像朝向（武器 / 横幅 / 炮口面向我方）
    body.rotation.y = entity.team === 'enemy' ? Math.PI : 0

    root.add(body)
    const hasBar = entity.kind !== 'projectile'
    const bar = hasBar ? new HealthBar(barY, entity.team as Team) : null
    if (bar) root.add(bar.root)
    root.position.set(entity.pos.x, 0, entity.pos.y)

    return {
      id: entity.id,
      entity,
      root,
      body,
      materials: collectMaterials(body),
      bar,
      phase: ((entity.id % 100) / 100) * Math.PI * 2,
      destroyed: false,
      mixer,
      anims,
      fast,
      currentAnim: 'idle',
    }
  }
}

function updateRecord(record: ViewRecord, entity: Entity, camera: THREE.Camera, time: number, dt: number): void {
  const { root, body } = record

  root.position.x = entity.pos.x
  root.position.z = entity.pos.y

  if (entity.kind === 'projectile') {
    if (entity.projectile && entity.projectile.targetId == null) {
      const pulse = 1 + Math.sin(time * 10) * 0.08
      body.scale.setScalar(pulse)
    }
    return
  }

  // 部署态：半透明 + 缩小
  if (entity.state === 'deploying') {
    for (const m of record.materials) {
      m.opacity = 0.45
      m.transparent = true
    }
    root.scale.setScalar(0.72)
  } else {
    for (const m of record.materials) {
      if (m.opacity !== 1) {
        m.opacity = 1
        m.transparent = false
      }
    }
    root.scale.setScalar(1)
  }

  // 骨骼动画推进与状态切换
  if (record.mixer) {
    record.mixer.update(dt)
    if (record.anims) {
      const desired =
        entity.state === 'attacking'
          ? 'attack'
          : entity.state === 'moving'
            ? record.fast
              ? 'sprint'
              : 'walk'
            : 'idle'
      if (desired !== record.currentAnim) {
        record.currentAnim = desired
        const next = record.anims[desired as keyof AnimSet]
        next.reset().fadeIn(0.18).play()
        for (const key of ['idle', 'walk', 'sprint', 'attack'] as const) {
          if (key !== desired) record.anims[key].fadeOut(0.18)
        }
      }
    }
  }

  // 空中单位轻微浮动（程序化模型）
  if (entity.layer === 'air' && entity.kind === 'unit' && !record.mixer) {
    body.position.y = AIR_HEIGHT + Math.sin(time * 3 + record.phase) * 0.08
  }

  record.bar?.set(entity.hp / entity.maxHp)
  record.bar?.face(camera)

  // 攻击脉冲（攻击计时刚重置到接近满值时）
  if (entity.state === 'attacking' && entity.combat) {
    const ratio = entity.attackTimer / entity.combat.hitSpeed
    if (ratio > 0.85) {
      root.scale.setScalar(1.06)
    }
  }
}

function ruinify(record: ViewRecord): void {
  record.destroyed = true
  record.bar?.hide()
  record.mixer?.stopAllAction()
  const s = record.entity.kind === 'tower' ? (record.entity.towerKind === 'king' ? 0.5 : 0.55) : 0.6
  record.body.scale.y *= s
  record.body.position.y *= s
  for (const m of record.materials) {
    m.color.setHex(0x4a4a4a)
    m.transparent = true
    m.opacity = 0.85
  }
}

function createSpellMarker(radius: number): THREE.Mesh {
  const ring = new THREE.RingGeometry(radius * 0.82, radius, 40)
  const mesh = new THREE.Mesh(
    ring,
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.08
  return mesh
}
