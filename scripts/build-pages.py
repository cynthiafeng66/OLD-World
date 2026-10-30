#!/usr/bin/env python3
"""Package the runtime assets for Pages, retaining their original bytes."""
import argparse
import json
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
MODELS = [
    'kitchen-1-window-inset.glb', 'kitchen 2 stove fixed.glb',
    'wooden shelf 3d model.glb', 'kitchen oven 3d model.glb',
    'cutting board 3d model.glb', 'kitchen-corner-completion.glb',
]
PARTS = [
    'work-table.glb', 'floor.glb', 'rack-plates-display.glb',
    'flour-sack-display.glb', 'rice-bag-display.glb', 'bread-pasta-display.glb',
    'frying-pan-display.glb', 'stockpot-display.glb', 'baking-set-no-towel-display.glb',
    'dough-stage-1-display.glb', 'dough-stage-2-display.glb',
    'dough-stage-3-display.glb', 'dough-stage-4-display.glb',
]
BINARY_ASSETS = ([f'assets/models/{name}' for name in MODELS]
                 + [f'assets/parts/{name}' for name in PARTS])
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', nargs='?', default='_site')
parser.add_argument('--list-lfs', action='store_true')
args = parser.parse_args()
if args.list_lfs:
    print(','.join(BINARY_ASSETS))
    raise SystemExit

destination = Path(args.destination).resolve()
if destination == ROOT or ROOT.is_relative_to(destination):
    raise SystemExit('Choose a separate build destination.')
# A fresh dedicated output directory avoids publishing stale files or backups.
if destination.exists():
    if not (destination / '.old-world-pages-build').is_file():
        raise SystemExit('Destination exists and is not an Old World Pages build.')
    shutil.rmtree(destination)
destination.mkdir(parents=True)
(destination / '.old-world-pages-build').touch()

paths = ['index.html', 'style.css', 'room.js', 'preserve-source-glb.js', 'dough-sequence.js',
         'assets/models/kitchen-1-window-layout.json',
         'assets/parts/manifest.json', 'assets/images/window-landscape.png'] + BINARY_ASSETS
paths.extend(str(p.relative_to(ROOT)) for p in (ROOT / 'knife-control').glob('*')
             if p.suffix in {'.js', '.mjs', '.css'})
paths.extend('vendor/three/' + name for name in [
    'LICENSE', 'build/three.module.js', 'build/three.core.js',
    'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/exporters/GLTFExporter.js',
    'examples/jsm/controls/OrbitControls.js', 'examples/jsm/environments/RoomEnvironment.js',
    'examples/jsm/utils/BufferGeometryUtils.js',
])
paths.extend('vendor/mediapipe/' + name for name in [
    'LICENSE', 'vision_bundle.mjs', 'hand_landmarker.task',
    'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
    'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm',
])

manifest = []
for relative in sorted(set(paths)):
    source = ROOT / relative
    if not source.is_file():
        raise SystemExit(f'Missing runtime asset: {relative}')
    with source.open('rb') as stream:
        prefix = stream.read(128)
    if prefix.startswith(b'version https://git-lfs.github.com/spec/v1'):
        raise SystemExit(f'LFS pointer is not a usable asset; run git lfs pull: {relative}')
    if relative.endswith('.glb') and prefix[:4] != b'glTF':
        raise SystemExit(f'Invalid GLB model: {relative}')
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    manifest.append({'path': relative, 'bytes': target.stat().st_size})

total = sum(item['bytes'] for item in manifest)
if total >= 1_000_000_000:
    raise SystemExit(f'Runtime site exceeds the 1 GB Pages limit: {total} bytes')
(destination / '.nojekyll').touch()
(destination / 'deployment.json').write_text(json.dumps({
    'commit': os.environ.get('GITHUB_SHA', 'local'),
    'runtime_bytes': total, 'model_files': len(BINARY_ASSETS),
    'files': manifest,
}, indent=2) + '\n')
print(f'Packaged {len(manifest)} files, {len(BINARY_ASSETS)} original-texture models, {total / 1024**2:.1f} MiB')
