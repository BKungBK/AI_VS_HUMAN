from pathlib import Path
from PIL import Image
import argparse,json
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--film',action='store_true');args=parser.parse_args()
directory=root/'qa/place-journey/frames' if args.film else root/'qa/place-journey'
paths=sorted(directory.glob('[0-9]*.png')) if args.film else [root/s['path'] for s in json.loads((root/'qa/place-journey/samples.json').read_text())]
checks=[]
for path in paths:
    im=Image.open(path).convert('RGB');scale=im.width/1920
    box=tuple(round(v*scale) for v in (96,66,750,130))
    # The screen-space brand remains visible throughout every content journey.
    # Missing white glyphs here caught GPU black-plane projection artifacts.
    count=sum(min(p)>=220 for p in im.crop(box).get_flattened_data())
    checks.append({'file':path.relative_to(root).as_posix(),'brandGlyphPixels':count,'pass':count>=round(500*scale*scale)})
report={'method':'Persistent brand region in all consecutive source frames; rejects black projection/compositing artifacts that erase screen-space content. This supplements visual review.','count':len(checks),'checks':checks,'pass':len(checks)==(720 if args.film else 72) and all(c['pass'] for c in checks)}
name='place-film-integrity.json' if args.film else 'place-frame-integrity.json'
(root/'qa'/name).write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(checks),'minimumBrandPixels':min(c['brandGlyphPixels'] for c in checks),'pass':report['pass']}))
if not report['pass']:raise SystemExit(1)
