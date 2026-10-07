from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json, math
ROOT=Path(__file__).resolve().parents[1]
regions=json.loads((ROOT/'qa/contrast-regions.json').read_text())
def luminance(rgb):
    vals=[v/255 for v in rgb[:3]]
    vals=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
    return .2126*vals[0]+.7152*vals[1]+.0722*vals[2]
fg=luminance((248,249,250))
reports=[]
for frame in regions:
    im=Image.open(ROOT/'qa/captures'/f"{frame['id']}.png").convert('RGB')
    bg=Image.open(ROOT/'qa/backgrounds'/f"{frame['id']}.png").convert('RGB')
    ip,bp=im.load(),bg.load();minimum=100;count=0;worst=''
    for box in frame['boxes']:
        startx=max(0,int(box['x']));endx=min(1920,math.ceil(box['x']+box['w']))
        starty=max(0,int(box['y']));endy=min(1080,math.ceil(box['y']+box['h']))
        for y in range(starty,endy,2):
            for x in range(startx,endx,2):
                a,b=ip[x,y],bp[x,y]
                # Interior off-white glyph pixels only; anti-alias edges are intentionally excluded.
                if max(abs(a[i]-(248,249,250)[i]) for i in range(3))<12 and sum(abs(a[i]-b[i]) for i in range(3))>100:
                    ratio=(fg+.05)/(luminance(b)+.05);count+=1
                    if ratio<minimum:minimum=ratio;worst=box['label']
    reports.append({'cue':frame['id'],'minContrast':round(minimum,3),'glyphSamples':count,'worstRegion':worst,'pass':minimum>=8.5 and count>100})
(ROOT/'qa/contrast-checks.json').write_text(json.dumps({'method':'Off-white interior glyph mask vs synchronized text-hidden composite; samples every 2px, excluding antialias edges. Includes glass, photographs and grain. Decorative accent text excluded.','checks':reports,'pass':all(r['pass'] for r in reports)},ensure_ascii=False,indent=2),encoding='utf-8')
font=ImageFont.truetype(str(ROOT/'public/assets/fonts/plex-thai-400.ttf'),20)
cols=4;thumbw=480;thumbh=270;labelh=44
sheet=Image.new('RGB',(cols*thumbw,math.ceil(len(regions)/cols)*(thumbh+labelh)),(13,17,23));draw=ImageDraw.Draw(sheet)
for i,frame in enumerate(regions):
    im=Image.open(ROOT/'qa/captures'/f"{frame['id']}.png").convert('RGB');im.thumbnail((thumbw,thumbh))
    x=(i%cols)*thumbw;y=(i//cols)*(thumbh+labelh);sheet.paste(im,(x,y))
    draw.text((x+12,y+thumbh+8),frame['id']+'  '+frame['title'].replace('\n',' ')[:35],font=font,fill=(248,249,250))
sheet.save(ROOT/'qa/contact-sheet.jpg',quality=94)
print('Contrast minimum:',min(r['minContrast'] for r in reports),'Pass:',all(r['pass'] for r in reports))
print('Contact sheet:',len(regions),'frames')
for r in reports:
    if not r['pass']:print(r)
