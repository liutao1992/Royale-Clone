import { describe, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { ModelLibrary } from '../src/render/ModelLibrary'
import { EntityViews } from '../src/render/EntityViews'
import { buildLuxArena } from '../src/render/LuxArena'
import { makeMatch, spawnTestUnit } from './helpers'

function fakeLibrary(lib: ModelLibrary) {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())
  mesh.position.y = 0.5
  group.add(mesh)
  return vi.spyOn(lib, 'get').mockReturnValue({ scene: group, animations: [] })
}

describe('Lux3D asset integration', () => {
  test('runtime GLBs have embedded resources and match recorded digests', async () => {
    const { createHash } = await import('node:crypto')
    const manifest = JSON.parse(readFileSync('public/models/lux3d/manifest.json', 'utf8'))
    expect(manifest.assets).toHaveLength(30)
    for (const asset of manifest.assets) {
      const raw = readFileSync(`public/models/lux3d/${asset.file}`)
      expect(createHash('sha256').update(raw).digest('hex')).toBe(asset.sha256)
      expect(raw.toString('utf8', 0, 4)).toBe('glTF')
      const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)))
      expect(json.meshes.length).toBeGreaterThan(0)
      for (const resource of [...(json.images ?? []), ...(json.buffers ?? [])]) {
        expect(resource.uri === undefined || resource.uri.startsWith('data:')).toBe(true)
      }
    }
  })

  test('deployment and ruin materials do not leak into other instances', () => {
    const lib = ModelLibrary.instance
    const spy = fakeLibrary(lib)
    try {
      const match = makeMatch()
      const a = spawnTestUnit(match, 'knight', 'player', { x: 4, y: 9 })
      const b = spawnTestUnit(match, 'knight', 'player', { x: 7, y: 9 })
      a.state = 'deploying'
      const views = new EntityViews()
      const camera = new THREE.PerspectiveCamera()
      views.sync(match.world, camera, 0, 0)
      expect(views.getDebugState().find(v => v.id === a.id)?.opacity).toBe(0.45)
      expect(views.getDebugState().find(v => v.id === b.id)?.opacity).toBe(1)
      a.state = 'moving'; a.pos.x += 1
      views.sync(match.world, camera, 1, 0.1)
      expect(views.getDebugState().find(v => v.id === a.id)?.rotation).toBeCloseTo(Math.PI / 2)
      const tower = match.world.entities.find(e => e.towerKind === 'princess')!
      match.world.entities = match.world.entities.filter(e => e.id !== tower.id)
      views.sync(match.world, camera, 2, 0.1)
      expect(views.getDebugState().find(v => v.id === tower.id)).toMatchObject({ destroyed: true, model: 'princessRuin' })
      expect(views.getDebugState().find(v => v.id === b.id)?.opacity).toBe(1)
      views.clear()
      expect(views.root.children).toHaveLength(0)
    } finally { spy.mockRestore() }
  })

  test('bridges follow battle coordinates and missing terrain falls back', () => {
    const lib = new ModelLibrary()
    expect(buildLuxArena(lib)).toBeNull()
    const spy = fakeLibrary(lib)
    try {
      const root = buildLuxArena(lib)!
      root.updateMatrixWorld(true)
      const centers: number[] = []
      root.traverse(o => {
        if (o.userData.bridgeCenter !== undefined) {
          const p = o.getWorldPosition(new THREE.Vector3())
          centers.push(p.x)
          expect(p.z).toBe(16)
        }
      })
      expect(centers).toEqual([3.5, 14.5])
    } finally { spy.mockRestore() }
  })
})
