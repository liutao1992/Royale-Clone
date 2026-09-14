import * as THREE from 'three'
import { ARENA_LENGTH, ARENA_WIDTH, BRIDGES, RIVER } from '../core/data/arena'
import { ModelLibrary, type ModelName } from './ModelLibrary'

/** Place terrain against simulation coordinates, never the demonstration scene's layout. */
export function buildLuxArena(lib: ModelLibrary): THREE.Group | null {
  if (!lib.get('arenaBase') || !lib.get('field') || !lib.get('bridge')) return null
  const root = new THREE.Group()
  root.name = 'Lux3D arena'
  const place = (name: ModelName, x: number, y: number, z: number, size?: [number, number, number], rotation = 0) => {
    const model = lib.cloneStatic(name)
    if (!model) return null
    model.rotation.y = rotation
    if (size) {
      const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
      // Wrapper scales along world axes after rotating the imported asset.
      const holder = new THREE.Group()
      holder.add(model)
      holder.scale.set(size[0] / bounds.x, size[1] / bounds.y, size[2] / bounds.z)
      holder.position.set(x, y, z)
      root.add(holder)
    } else {
      model.position.set(x, y, z)
      root.add(model)
    }
    return model
  }
  const cx = ARENA_WIDTH / 2, cz = ARENA_LENGTH / 2
  const depth = RIVER.y1 - RIVER.y0
  place('arenaBase', cx, -1.37, cz)
  place('field', cx, -0.12, RIVER.y0 / 2, [ARENA_WIDTH, 0.12, RIVER.y0])
  place('field', cx, -0.12, (RIVER.y1 + ARENA_LENGTH) / 2, [ARENA_WIDTH, 0.12, ARENA_LENGTH - RIVER.y1])
  place('riverbed', cx, -0.4, cz, [ARENA_WIDTH, 0.35, depth])
  const water = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_WIDTH, depth), new THREE.MeshStandardMaterial({ color: 0x279fcd, roughness: 0.3 }))
  water.rotation.x = -Math.PI / 2
  water.position.set(cx, -0.02, cz)
  root.add(water)
  for (const bridge of BRIDGES) {
    const model = place('bridge', bridge.centerX, -0.16, cz, [bridge.x1 - bridge.x0 + 0.35, 0.38, depth + 0.6], Math.PI / 2)
    if (model) model.userData.bridgeCenter = bridge.centerX
  }
  for (const x of [-0.5, ARENA_WIDTH + 0.5]) {
    for (let z = 1; z <= ARENA_LENGTH; z += 3) place('wall', x, -0.05, z, undefined, Math.PI / 2)
    for (const z of [5, 10, 22, 27]) place('shrub', x, 0, z)
    for (const z of [8, 24]) place('rocks', x, 0, z)
    for (const z of [3, 29]) {
      const flag = place('flag', x, 0, z, undefined, Math.PI / 2)
      if (flag && z > cz) flag.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) child.material.color.setHex(0xffa5a5)
      })
    }
  }
  for (const z of [-0.5, ARENA_LENGTH + 0.5]) {
    for (let x = 1.5; x < ARENA_WIDTH; x += 3) place('wall', x, -0.05, z)
    for (const x of [-0.5, ARENA_WIDTH + 0.5]) place('corner', x, -0.05, z)
  }
  return root
}
