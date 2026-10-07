from pathlib import Path
import hashlib,json,zipfile,argparse
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--name',default='HUMAN_vs_AI_Spatial_Motion_20261006.zip');args=parser.parse_args()
if Path(args.name).name!=args.name or not args.name.endswith('.zip'):raise ValueError('Use a ZIP filename without directory components')
destination=root.parent/args.name
if destination.exists():raise RuntimeError('Delivery ZIP already exists; choose a new filename before packaging')
skip={'node_modules','.git','motion-frames','frames','previous-motion-source','backgrounds','__pycache__'}
paths=[]
for p in root.rglob('*'):
    if not p.is_file():continue
    rel=p.relative_to(root)
    if any(part in skip for part in rel.parts):continue
    if p.name=='tsconfig.tsbuildinfo' or p.name=='delivery-manifest.json':continue
    if p.name.startswith(('debug-','loop-','join-')):continue
    paths.append(p)
records=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]
manifest=root/'qa/delivery-manifest.json'
manifest.write_text(json.dumps({'date':'2026-10-06','archive':str(destination),'files':records,'note':'Hashes cover payload; this manifest excludes its own hash. Private local presentation; FLAMINGONE rights are not granted for redistribution. Dependencies and raw capture intermediates excluded.'},ensure_ascii=False,indent=2),encoding='utf-8')
paths.append(manifest)
with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in paths:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(destination) as z:
    bad=z.testzip()
    if bad:raise RuntimeError('Archive CRC failed: '+bad)
    if len(z.namelist())!=len(paths):raise RuntimeError('Archive count mismatch')
print(json.dumps({'archive':str(destination),'files':len(paths),'bytes':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'crc':'PASS'},indent=2))
