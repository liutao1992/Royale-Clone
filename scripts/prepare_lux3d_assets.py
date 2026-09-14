"""Run with Blender --background --python this_file -- /path/to/game-assets.

Preserve geometry and embedded materials; cap runtime textures at 512px.
The source directory is the separately delivered Lux3D assembly output.
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path

source = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output = Path(__file__).resolve().parents[1] / 'public/models/lux3d'
output.mkdir(parents=True, exist_ok=True)
names = ['ENV-01','ENV-02','ENV-03','ENV-05','ENV-06','ENV-07','ENV-08','ENV-09','ENV-10',
         'BLD-05','BLD-06','BLD-07','BLD-08','PRJ-01','PRJ-02','PRJ-03']
names += [f'{kind}_{team}' for team in ('blue','red')
          for kind in ('princess_tower','king_tower','knight','archer','giant','goblin','bomber')]
records = []
for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = source / f'{name}.glb'
    bpy.ops.import_scene.gltf(filepath=str(path))
    for image in bpy.data.images:
        if max(image.size) > 512:
            factor = 512 / max(image.size)
            image.scale(round(image.size[0]*factor), round(image.size[1]*factor))
            image.pack()
    target = output / path.name
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_extras=True)
    records.append({'file':path.name,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                    'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size})
(output/'manifest.json').write_text(json.dumps({'source':'User-provided Lux3D assembly',
    'textureMaxDimension':512,'staticMeshes':True,'assets':records},indent=2))
print('PREPARED',len(records),'assets',sum(r['bytes'] for r in records),'bytes')
