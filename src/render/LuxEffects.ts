import * as THREE from 'three'
import type { Entity } from '../core/types'
import { ModelLibrary, type ModelName } from './ModelLibrary'

export function buildProjectileActor(entity: Entity): THREE.Group | null {
  const names: Partial<Record<string, ModelName>> = {
    archers: 'arrow', 'princess-tower': 'arrow', bomber: 'bomb',
    cannon: 'cannonball', 'king-tower': 'cannonball',
  }
  const name = names[entity.cardId]
  if (!name) return null
  const model = ModelLibrary.instance.cloneStatic(name)
  if (!model) return null
  const root = new THREE.Group()
  root.userData.modelName = name
  if (name === 'arrow') model.rotation.y = Math.PI / 2 // source arrow points -X; actors face +Z
  root.add(model)
  root.position.y = 0.9
  return root
}

export function buildRuinActor(entity: Entity): THREE.Group | null {
  const lib = ModelLibrary.instance
  const model = lib.cloneStatic(entity.towerKind === 'king' ? 'kingRuin' : 'princessRuin')
  if (!model) return null
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  const width = entity.towerKind === 'king' ? 2.3 : 2.35
  model.scale.x = width / size.x
  model.scale.z = width / size.z
  for (let i = 0; i < 3; i++) {
    const fragment = lib.cloneStatic('debris')
    if (!fragment) continue
    fragment.position.set(Math.cos(i * 2.1) * 1.15, 0, Math.sin(i * 2.1) * 1.15)
    fragment.scale.setScalar(0.7)
    model.add(fragment)
  }
  return model
}

/** Only dispose per-instance materials; library geometry and textures remain shared. */
export function disposeActor(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>()
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material)
  })
  for (const material of materials) material.dispose()
}
