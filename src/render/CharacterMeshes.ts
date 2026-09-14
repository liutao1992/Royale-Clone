import * as THREE from 'three'
import type { Entity } from '../core/types'
import { TEAM_COLORS, type Team } from '../core/data/arena'
import { TOWER_CARDS } from '../core/data/cards'

/**
 * 程序化角色/建筑建模（无外部资源，纯几何拼装，画风对齐皇室战争）。
 * 所有模型以脚底/地面为原点 y=0，朝向 +z（面向敌方）。
 * 敌方实体由 EntityViews 将整体绕 y 轴旋转 π 实现镜像。
 */

const PALETTE = {
  skin: 0xf2c99a,
  pants: 0x333a4d,
  steel: 0xc9d3e2,
  steelDark: 0x8a97ad,
  gold: 0xffc021,
  wood: 0x8a5a30,
  woodDark: 0x6a4222,
  stone: 0x99a4b3,
  stoneLight: 0xd6dce6,
  stoneDark: 0x6e7889,
  bone: 0xe9e6db,
  goblinSkin: 0x67b546,
  goblinTunic: 0x5a4630,
  minionPurple: 0x7d54c8,
  minionDark: 0x4e2f8f,
  dragonTeal: 0x4fbcd8,
  dragonBelly: 0xd8f2f4,
  boar: 0x8a5535,
  dark: 0x2e3238,
  eye: 0x1a1e26,
  bannerRed: 0xc0342c,
} as const

export interface BuiltMesh {
  group: THREE.Group
  /** 血条悬挂高度 */
  barY: number
}

// ---------- 基础工具 ----------

function mat(color: number, roughness = 0.72): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness })
}

function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  castShadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = castShadow
  m.receiveShadow = true
  return m
}

/** 收集组内全部标准材质（部署半透明 / 废墟化时统一处理） */
export function collectMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const found: THREE.MeshStandardMaterial[] = []
  root.traverse((child) => {
    const material = (child as THREE.Mesh).material
    if (material instanceof THREE.MeshStandardMaterial && !found.includes(material)) {
      found.push(material)
    }
  })
  return found
}

// ---------- 人形单位 ----------

type Headgear = 'knight-helmet' | 'hood' | 'hat' | 'bald' | 'hair' | 'band' | 'ears'
type Weapon = 'sword' | 'axe' | 'bow' | 'musket' | 'bomb' | 'dagger' | 'fists' | 'spear'

interface HumanoidOpts {
  team: Team
  skin?: number
  tunic?: number
  headR?: number
  torsoR?: number
  headgear?: Headgear
  weapon?: Weapon
  shield?: boolean
  scale?: number
}

function buildHumanoid(o: HumanoidOpts): THREE.Group {
  const g = new THREE.Group()
  const s = o.scale ?? 1
  const team = TEAM_COLORS[o.team]
  const skin = mat(o.skin ?? PALETTE.skin)
  const cloth = mat(o.tunic ?? team)
  const pants = mat(PALETTE.pants)

  const headR = (o.headR ?? 0.19) * s
  const torsoR = (o.torsoR ?? 0.24) * s

  // 腿
  const legGeo = new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.3 * s, 8)
  g.add(mesh(legGeo, pants, -0.12 * s, 0.15 * s, 0))
  g.add(mesh(legGeo, pants, 0.12 * s, 0.15 * s, 0))

  // 躯干（上略窄，更有卡通感）
  const torso = mesh(
    new THREE.CylinderGeometry(torsoR * 0.78, torsoR, 0.44 * s, 12),
    cloth,
    0,
    0.52 * s,
    0,
  )
  g.add(torso)

  // 战队腰带
  g.add(
    mesh(new THREE.CylinderGeometry(torsoR * 0.82, torsoR * 0.86, 0.08 * s, 12), mat(team), 0, 0.4 * s, 0),
  )

  // 手臂
  const armGeo = new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.3 * s, 8)
  const armL = mesh(armGeo, cloth, -0.28 * s, 0.56 * s, 0.02 * s)
  armL.rotation.z = 0.32
  const armR = mesh(armGeo, cloth, 0.28 * s, 0.56 * s, 0.02 * s)
  armR.rotation.z = -0.32
  g.add(armL, armR)

  // 头
  const headY = 1.02 * s
  g.add(mesh(new THREE.SphereGeometry(headR, 14, 12), skin, 0, headY, 0))

  // 眼睛（不投影）
  const eyeGeo = new THREE.SphereGeometry(0.035 * s, 8, 6)
  const eyeMat = mat(PALETTE.eye, 0.4)
  g.add(mesh(eyeGeo, eyeMat, -0.07 * s, headY + 0.02 * s, headR * 0.82, false))
  g.add(mesh(eyeGeo, eyeMat, 0.07 * s, headY + 0.02 * s, headR * 0.82, false))

  // 头饰
  const hg = o.headgear ?? 'bald'
  if (hg === 'knight-helmet') {
    const helm = mesh(new THREE.SphereGeometry(headR * 1.12, 14, 10), mat(PALETTE.steel, 0.4), 0, headY + 0.03 * s, 0)
    helm.scale.y = 0.85
    g.add(helm)
    g.add(mesh(new THREE.BoxGeometry(0.08 * s, 0.14 * s, 0.1 * s), mat(PALETTE.steelDark, 0.4), 0, headY - 0.02 * s, headR * 0.9))
    // 肩甲
    const padGeo = new THREE.SphereGeometry(0.09 * s, 10, 8)
    g.add(mesh(padGeo, mat(PALETTE.steel, 0.4), -torsoR * 0.92, 0.72 * s, 0))
    g.add(mesh(padGeo, mat(PALETTE.steel, 0.4), torsoR * 0.92, 0.72 * s, 0))
  } else if (hg === 'hood') {
    const hood = mesh(new THREE.ConeGeometry(headR * 1.2, 0.34 * s, 12), mat(team), 0, headY + 0.16 * s, -0.02 * s)
    g.add(hood)
  } else if (hg === 'hat') {
    const brim = mesh(new THREE.CylinderGeometry(headR * 1.15, headR * 1.15, 0.04 * s, 14), mat(0x3d3a6e, 0.8), 0, headY + headR * 0.9, 0)
    const top = mesh(new THREE.CylinderGeometry(headR * 0.7, headR * 0.8, 0.16 * s, 12), mat(0x3d3a6e, 0.8), 0, headY + headR * 0.9 + 0.1 * s, 0)
    g.add(brim, top)
  } else if (hg === 'hair') {
    const hair = mesh(new THREE.SphereGeometry(headR * 1.14, 14, 10), mat(0xd96a1e, 0.85), 0, headY + 0.04 * s, -0.03 * s)
    hair.scale.set(1, 0.8, 1)
    g.add(hair)
  } else if (hg === 'band') {
    const band = mesh(new THREE.CylinderGeometry(headR * 1.04, headR * 1.04, 0.08 * s, 12), mat(0xd9a13a, 0.85), 0, headY + 0.06 * s, 0)
    g.add(band)
    // 头巾小尖
    g.add(mesh(new THREE.ConeGeometry(0.05 * s, 0.16 * s, 8), mat(0xd9a13a, 0.85), 0, headY + 0.14 * s, -headR * 0.7))
  } else if (hg === 'ears') {
    const earGeo = new THREE.ConeGeometry(0.06 * s, 0.2 * s, 8)
    const earL = mesh(earGeo, skin, -headR * 0.95, headY + 0.02 * s, 0)
    earL.rotation.z = Math.PI / 2.2
    const earR = mesh(earGeo, skin, headR * 0.95, headY + 0.02 * s, 0)
    earR.rotation.z = -Math.PI / 2.2
    g.add(earL, earR)
  }

  // 武器（右手持握，朝 +z）
  const wp = o.weapon ?? 'fists'
  const handX = 0.3 * s
  const handY = 0.62 * s
  if (wp === 'sword' || wp === 'dagger') {
    const len = (wp === 'sword' ? 0.46 : 0.28) * s
    const w = new THREE.Group()
    w.add(mesh(new THREE.BoxGeometry(0.05 * s, len, 0.05 * s), mat(PALETTE.steel, 0.35), 0, len / 2 + 0.04 * s, 0))
    w.add(mesh(new THREE.BoxGeometry(0.16 * s, 0.04 * s, 0.07 * s), mat(PALETTE.gold, 0.4), 0, 0.03 * s, 0))
    w.position.set(handX, handY, 0.1 * s)
    g.add(w)
  } else if (wp === 'axe') {
    const w = new THREE.Group()
    w.add(mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.52 * s, 8), mat(PALETTE.woodDark), 0, 0.26 * s, 0))
    w.add(mesh(new THREE.BoxGeometry(0.05 * s, 0.16 * s, 0.2 * s), mat(PALETTE.steel, 0.35), 0, 0.46 * s, 0))
    w.position.set(handX, handY - 0.1 * s, 0.12 * s)
    g.add(w)
  } else if (wp === 'bow') {
    const bow = mesh(new THREE.TorusGeometry(0.17 * s, 0.022 * s, 8, 14, Math.PI), mat(PALETTE.woodDark), handX, handY + 0.1 * s, 0.12 * s)
    bow.rotation.z = -Math.PI / 2
    g.add(bow)
  } else if (wp === 'musket') {
    const gun = new THREE.Group()
    gun.add(mesh(new THREE.BoxGeometry(0.055 * s, 0.06 * s, 0.62 * s), mat(PALETTE.dark, 0.5), 0, 0, 0.28 * s))
    gun.add(mesh(new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.18 * s), mat(PALETTE.wood), 0, -0.03 * s, -0.06 * s))
    gun.position.set(handX + 0.02 * s, handY - 0.05 * s, 0.08 * s)
    gun.rotation.x = -0.12
    g.add(gun)
  } else if (wp === 'bomb') {
    g.add(mesh(new THREE.SphereGeometry(0.11 * s, 12, 10), mat(0x23262e, 0.5), 0.14 * s, handY + 0.08 * s, 0.18 * s))
    g.add(mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.07 * s, 6), mat(PALETTE.gold, 0.9), 0.14 * s, handY + 0.2 * s, 0.18 * s, false))
  } else if (wp === 'fists') {
    const fistGeo = new THREE.SphereGeometry(0.12 * s, 10, 8)
    g.add(mesh(fistGeo, skin, -torsoR - 0.1 * s, 0.42 * s, 0.04 * s))
    g.add(mesh(fistGeo, skin, torsoR + 0.1 * s, 0.42 * s, 0.04 * s))
  } else if (wp === 'spear') {
    const spear = new THREE.Group()
    spear.add(mesh(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.7 * s, 8), mat(PALETTE.woodDark), 0, 0.35 * s, 0))
    spear.add(mesh(new THREE.ConeGeometry(0.05 * s, 0.14 * s, 8), mat(PALETTE.steel, 0.35), 0, 0.72 * s, 0))
    spear.rotation.x = -0.9
    spear.position.set(handX, handY - 0.05 * s, 0.1 * s)
    g.add(spear)
  }

  // 盾（左手）
  if (o.shield) {
    const shield = mesh(
      new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.045 * s, 14),
      mat(team),
      -handX - 0.04 * s,
      handY - 0.02 * s,
      0.14 * s,
    )
    shield.rotation.x = Math.PI / 2
    g.add(shield)
    g.add(mesh(new THREE.TorusGeometry(0.16 * s, 0.02 * s, 8, 14), mat(PALETTE.steel, 0.4), -handX - 0.04 * s, handY - 0.02 * s, 0.16 * s))
  }

  return g
}

// ---------- 野兽 / 飞行单位 ----------

/** 亡灵：紫蝙蝠 */
function buildMinion(): THREE.Group {
  const g = new THREE.Group()
  const body = mat(PALETTE.minionPurple)
  const dark = mat(PALETTE.minionDark)

  const core = mesh(new THREE.SphereGeometry(0.3, 14, 12), body, 0, 0, 0)
  g.add(core)

  // 蝙蝠翅膀
  const wingGeo = new THREE.SphereGeometry(0.2, 10, 8)
  const wingL = mesh(wingGeo, dark, -0.32, 0.06, -0.02)
  wingL.scale.set(0.9, 0.35, 0.55)
  wingL.rotation.z = 0.5
  const wingR = mesh(wingGeo, dark, 0.32, 0.06, -0.02)
  wingR.scale.set(0.9, 0.35, 0.55)
  wingR.rotation.z = -0.5
  g.add(wingL, wingR)

  // 角 + 眼 + 獠牙
  const hornGeo = new THREE.ConeGeometry(0.05, 0.14, 8)
  g.add(mesh(hornGeo, mat(PALETTE.bone), -0.1, 0.26, 0))
  g.add(mesh(hornGeo, mat(PALETTE.bone), 0.1, 0.26, 0))
  const eyeMat = mat(0xffe066, 0.4)
  g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat, -0.1, 0.06, 0.26, false))
  g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat, 0.1, 0.06, 0.26, false))
  const fangGeo = new THREE.ConeGeometry(0.025, 0.08, 6)
  g.add(mesh(fangGeo, mat(PALETTE.bone), -0.07, -0.14, 0.26, false))
  g.add(mesh(fangGeo, mat(PALETTE.bone), 0.07, -0.14, 0.26, false))
  return g
}

/** 飞龙宝宝 */
function buildBabyDragon(): THREE.Group {
  const g = new THREE.Group()
  const body = mat(PALETTE.dragonTeal)
  const belly = mat(PALETTE.dragonBelly)

  g.add(mesh(new THREE.SphereGeometry(0.34, 14, 12), body, 0, 0, 0))
  const tummy = mesh(new THREE.SphereGeometry(0.27, 12, 10), belly, 0, -0.06, 0.13)
  tummy.scale.y = 0.85
  g.add(tummy)

  // 头 + 吻部 + 角
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), body, 0, 0.3, 0.18))
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), belly, 0, 0.26, 0.38))
  const hornGeo = new THREE.ConeGeometry(0.04, 0.12, 8)
  g.add(mesh(hornGeo, mat(PALETTE.bone), -0.09, 0.44, 0.14))
  g.add(mesh(hornGeo, mat(PALETTE.bone), 0.09, 0.44, 0.14))
  const eyeMat = mat(PALETTE.eye, 0.4)
  g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat, -0.09, 0.34, 0.32, false))
  g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat, 0.09, 0.34, 0.32, false))

  // 翅膀
  const wingGeo = new THREE.SphereGeometry(0.26, 10, 8)
  const wingL = mesh(wingGeo, mat(0x2f98b5), -0.4, 0.2, -0.05)
  wingL.scale.set(0.9, 0.28, 0.6)
  wingL.rotation.z = 0.55
  const wingR = mesh(wingGeo, mat(0x2f98b5), 0.4, 0.2, -0.05)
  wingR.scale.set(0.9, 0.28, 0.6)
  wingR.rotation.z = -0.55
  g.add(wingL, wingR)

  // 尾巴
  const tail = mesh(new THREE.ConeGeometry(0.09, 0.4, 8), body, 0, 0.02, -0.5)
  tail.rotation.x = -Math.PI / 2.4
  g.add(tail)
  return g
}

/** 野猪骑士：野猪 + 骑手 */
function buildHogRider(team: Team): THREE.Group {
  const g = new THREE.Group()
  const boarMat = mat(PALETTE.boar)
  const darkBoar = mat(0x6a3d24)

  // 猪身
  const body = mesh(new THREE.SphereGeometry(0.34, 14, 12), boarMat, 0, 0.42, 0)
  body.scale.set(0.95, 0.82, 1.35)
  g.add(body)

  // 猪头 + 吻 + 獠牙
  g.add(mesh(new THREE.SphereGeometry(0.22, 12, 10), boarMat, 0, 0.5, 0.45))
  const snout = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 10), mat(0x5e3620), 0, 0.44, 0.62)
  snout.rotation.x = Math.PI / 2
  g.add(snout)
  const tuskGeo = new THREE.ConeGeometry(0.03, 0.12, 8)
  const tuskL = mesh(tuskGeo, mat(PALETTE.bone), -0.11, 0.52, 0.58)
  tuskL.rotation.x = -0.5
  const tuskR = mesh(tuskGeo, mat(PALETTE.bone), 0.11, 0.52, 0.58)
  tuskR.rotation.x = -0.5
  g.add(tuskL, tuskR)
  const eyeMat = mat(PALETTE.eye, 0.4)
  g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, -0.1, 0.56, 0.6, false))
  g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, 0.1, 0.56, 0.6, false))

  // 猪腿
  const legGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.26, 8)
  for (const lx of [-0.18, 0.18]) {
    for (const lz of [-0.22, 0.22]) {
      g.add(mesh(legGeo, darkBoar, lx, 0.13, lz))
    }
  }

  // 骑手（持矛）
  const rider = buildHumanoid({ team, headgear: 'band', weapon: 'spear', scale: 0.85 })
  rider.position.set(0, 0.58, -0.05)
  g.add(rider)
  return g
}

// ---------- 建筑 ----------

/** 加农炮：木基座 + 轮子 + 炮管 */
export function buildCannonMesh(entity: Entity): BuiltMesh {
  const g = new THREE.Group()
  const team = TEAM_COLORS[entity.team as Team]

  g.add(mesh(new THREE.BoxGeometry(1.06, 0.2, 1.06), mat(PALETTE.wood, 0.9), 0, 0.1, 0))
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.07, 1.1), mat(team), 0, 0.235, 0))

  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.07, 12)
  for (const side of [-0.36, 0.36]) {
    const wheel = mesh(wheelGeo, mat(PALETTE.woodDark, 0.9), side, 0.19, 0)
    wheel.rotation.z = Math.PI / 2
    g.add(wheel)
  }

  // 炮管（朝 +z 微仰）
  const barrel = new THREE.Group()
  const tube = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.82, 14), mat(0x3a3f47, 0.5), 0, 0, 0.3)
  tube.rotation.x = Math.PI / 2 - 0.18
  barrel.add(tube)
  const muzzle = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 14), mat(PALETTE.steelDark, 0.5), 0, 0.05, 0.66)
  muzzle.rotation.x = -0.18
  barrel.add(muzzle)
  barrel.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), mat(0x3a3f47, 0.5), 0, 0, -0.08))
  barrel.position.set(0, 0.44, 0)
  g.add(barrel)

  return { group: g, barY: 1.75 }
}

// ---------- 塔 ----------

/** 圆形雉堞环 */
function crenelRing(radius: number, count: number, y: number, size: [number, number, number]): THREE.Group {
  const g = new THREE.Group()
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2])
  const stone = mat(PALETTE.stoneLight, 0.85)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const crenel = mesh(geo, stone, Math.cos(a) * radius, y, Math.sin(a) * radius)
    crenel.rotation.y = -a
    g.add(crenel)
  }
  return g
}

/** 公主塔：石砌圆塔 + 雉堞 + 队色屋顶 + 旗帜 */
function buildPrincessTower(entity: Entity): BuiltMesh {
  const g = new THREE.Group()
  const team = TEAM_COLORS[entity.team as Team]
  const stone = mat(PALETTE.stoneLight, 0.85)
  const stoneDark = mat(PALETTE.stone, 0.9)
  const roofMat = mat(team, 0.55)

  // 基座 + 塔身
  g.add(mesh(new THREE.CylinderGeometry(1.42, 1.55, 0.42, 18), stoneDark, 0, 0.21, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.02, 1.12, 2.0, 18), stone, 0, 1.4, 0))

  // 砖缝装饰带
  g.add(mesh(new THREE.CylinderGeometry(1.06, 1.09, 0.16, 18), stoneDark, 0, 0.86, 0))
  g.add(mesh(new THREE.CylinderGeometry(1.05, 1.08, 0.14, 18), mat(team), 0, 2.36, 0))

  // 垛口平台 + 雉堞
  g.add(mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.22, 18), stoneDark, 0, 2.5, 0))
  g.add(crenelRing(1.12, 9, 2.73, [0.32, 0.26, 0.2]))

  // 中央塔心 + 屋顶 + 旗帜
  g.add(mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.6, 12), stone, 0, 2.9, 0))
  g.add(mesh(new THREE.ConeGeometry(0.62, 0.72, 12), roofMat, 0, 3.55, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.66, 6), mat(PALETTE.woodDark), 0, 4.18, 0))
  g.add(mesh(new THREE.BoxGeometry(0.36, 0.2, 0.02), mat(team), 0.18, 4.36, 0))

  return { group: g, barY: 4.95 }
}

/** 国王塔：方塔 + 雉堞 + 金色王冠 + 战队横幅 */
function buildKingTower(entity: Entity): BuiltMesh {
  const g = new THREE.Group()
  const team = TEAM_COLORS[entity.team as Team]
  const size = TOWER_CARDS['king-tower'].size
  const stone = mat(PALETTE.stoneLight, 0.85)
  const stoneDark = mat(PALETTE.stone, 0.9)
  const gold = mat(PALETTE.gold, 0.4)

  // 基座 + 塔身
  g.add(mesh(new THREE.BoxGeometry(size + 0.3, 0.45, size + 0.3), stoneDark, 0, 0.225, 0))
  g.add(mesh(new THREE.BoxGeometry(size - 0.85, 3.3, size - 0.85), stone, 0, 2.1, 0))

  // 转角镶边
  const cornerGeo = new THREE.BoxGeometry(0.34, 3.3, 0.34)
  const q = (size - 0.85) / 2 - 0.06
  for (const cx of [-q, q]) {
    for (const cz of [-q, q]) {
      g.add(mesh(cornerGeo, stoneDark, cx, 2.1, cz))
    }
  }

  // 队色装饰带 + 垛口平台
  g.add(mesh(new THREE.BoxGeometry(size - 0.7, 0.2, size - 0.7), mat(team), 0, 3.62, 0))
  g.add(mesh(new THREE.BoxGeometry(size - 0.5, 0.26, size - 0.5), stoneDark, 0, 3.84, 0))

  // 方形雉堞（每边 3 个，避开角部）
  const crenelGeo = new THREE.BoxGeometry(0.42, 0.3, 0.32)
  const rim = (size - 0.5) / 2 - 0.1
  for (let i = 0; i < 3; i++) {
    const t = -rim + (i + 0.5) * ((2 * rim) / 3)
    for (const [ex, ez] of [
      [t, rim],
      [t, -rim],
      [rim, t],
      [-rim, t],
    ]) {
      const crenel = mesh(crenelGeo, stone, ex, 4.1, ez)
      if (Math.abs(ez) === rim) crenel.rotation.y = Math.PI / 2
      g.add(crenel)
    }
  }

  // 金色王冠
  g.add(mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.3, 14), gold, 0, 4.36, 0))
  const spikeGeo = new THREE.ConeGeometry(0.17, 0.42, 10)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.add(mesh(spikeGeo, gold, Math.cos(a) * 0.62, 4.7, Math.sin(a) * 0.62))
  }
  g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(PALETTE.bannerRed, 0.4), 0, 4.42, 0.86, false))

  // 正面战队横幅（朝 +z，敌方实体整体镜像）
  const face = (size - 0.85) / 2 + 0.02
  g.add(mesh(new THREE.BoxGeometry(0.6, 1.15, 0.07), mat(team), 0, 2.35, face))
  g.add(mesh(new THREE.BoxGeometry(0.68, 0.12, 0.09), gold, 0, 2.9, face))
  g.add(mesh(new THREE.BoxGeometry(0.68, 0.12, 0.09), gold, 0, 1.8, face))

  return { group: g, barY: 5.35 }
}

export function buildTowerMesh(entity: Entity): BuiltMesh {
  return entity.towerKind === 'king' ? buildKingTower(entity) : buildPrincessTower(entity)
}

// ---------- GLB 角色配件（挂到 Kenney 骨骼节点，模型本地空间 ≈0.78 高） ----------

export type AccessoryKind = 'musket' | 'bow' | 'axe' | 'dagger' | 'bomb'

export function buildAccessory(kind: AccessoryKind): THREE.Group {
  const g = new THREE.Group()
  if (kind === 'musket') {
    g.add(mesh(new THREE.BoxGeometry(0.035, 0.04, 0.4), mat(PALETTE.dark, 0.5), 0, 0, 0.18))
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), mat(PALETTE.wood), 0, -0.025, -0.05))
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.06, 0.03), mat(PALETTE.woodDark), 0, -0.03, 0.1))
  } else if (kind === 'bow') {
    const bow = mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 14, Math.PI), mat(PALETTE.woodDark), 0, 0.05, 0.02)
    bow.rotation.z = -Math.PI / 2
    g.add(bow)
  } else if (kind === 'axe') {
    g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8), mat(PALETTE.woodDark), 0, 0.1, 0))
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.11, 0.13), mat(PALETTE.steel, 0.35), 0, 0.24, 0))
  } else if (kind === 'dagger') {
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mat(PALETTE.steel, 0.35), 0, 0.12, 0))
    g.add(mesh(new THREE.BoxGeometry(0.09, 0.02, 0.045), mat(PALETTE.gold, 0.4), 0, 0.01, 0))
  } else if (kind === 'bomb') {
    g.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0x23262e, 0.5), 0, 0.1, 0.06))
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), mat(PALETTE.gold, 0.9), 0, 0.18, 0.06, false))
  }
  return g
}

/** 国王塔金冠（约 0.5 高，随塔组缩放） */
export function buildCrown(): THREE.Group {
  const g = new THREE.Group()
  const gold = mat(PALETTE.gold, 0.4)
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.18, 12), gold, 0, 0.09, 0))
  const spikeGeo = new THREE.ConeGeometry(0.09, 0.22, 8)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.add(mesh(spikeGeo, gold, Math.cos(a) * 0.26, 0.28, Math.sin(a) * 0.26))
  }
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(PALETTE.bannerRed, 0.4), 0, 0.14, 0.38, false))
  return g
}

// ---------- 单位总装 ----------

export function buildUnitMesh(entity: Entity): BuiltMesh {
  const team = entity.team as Team
  let group: THREE.Group
  let barY = 1.45

  switch (entity.cardId) {
    case 'knight':
      group = buildHumanoid({ team, headgear: 'knight-helmet', weapon: 'sword', shield: true })
      barY = 1.55
      break
    case 'valkyrie':
      group = buildHumanoid({ team, headgear: 'hair', weapon: 'axe' })
      barY = 1.55
      break
    case 'giant':
      group = buildHumanoid({ team, tunic: 0x7a4a26, headgear: 'bald', weapon: 'fists', scale: 1.32 })
      barY = 2.1
      break
    case 'hog-rider':
      group = buildHogRider(team)
      barY = 1.95
      break
    case 'musketeer':
      group = buildHumanoid({ team, headgear: 'hat', weapon: 'musket' })
      barY = 1.6
      break
    case 'archers':
      group = buildHumanoid({ team, headgear: 'hood', weapon: 'bow' })
      barY = 1.5
      break
    case 'bomber':
      group = buildHumanoid({ team, skin: PALETTE.bone, headgear: 'hood', weapon: 'bomb', scale: 0.9 })
      barY = 1.35
      break
    case 'goblins':
      group = buildHumanoid({
        team,
        skin: PALETTE.goblinSkin,
        tunic: PALETTE.goblinTunic,
        headgear: 'ears',
        weapon: 'dagger',
        headR: 0.21,
        scale: 0.78,
      })
      barY = 1.2
      break
    case 'minions':
      group = buildMinion()
      barY = 2.0
      break
    case 'baby-dragon':
      group = buildBabyDragon()
      barY = 2.15
      break
    default:
      // 兜底：原占位圆柱
      group = new THREE.Group()
      const r = entity.radius * 1.15
      const h = 1.05
      const body = mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 12), mat(TEAM_COLORS[team], 0.6), 0, h / 2, 0)
      group.add(body)
      group.add(mesh(new THREE.SphereGeometry(r * 0.72, 12, 10), mat(0xffffff, 0.5), 0, h + r * 0.4, 0))
      barY = h + 1.0
      break
  }

  return { group, barY }
}
