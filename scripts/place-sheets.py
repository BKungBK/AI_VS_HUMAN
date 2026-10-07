from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
samples=json.loads((root/'qa/place-journey/samples.json').read_text())
font=ImageFont.truetype(str(root/'public/assets/fonts/plex-thai-400.ttf'),20)
for clip in dict.fromkeys(s['clip'] for s in samples):
    rows=[s for s in samples if s['clip']==clip]
    sheet=Image.new('RGB',(1920,3*314),(13,17,23));draw=ImageDraw.Draw(sheet)
    for i,s in enumerate(rows):
        im=Image.open(root/s['path']).convert('RGB');im.thumbnail((480,270))
        x=(i%4)*480;y=(i//4)*314;sheet.paste(im,(x,y));draw.text((x+12,y+275),f"{s['time']:.2f}s  {s['state']['place']}  {s['state']['journey']['progress']:.2f}",fill=(248,249,250),font=font)
    sheet.save(root/f'qa/place-journey/{clip}-sheet.jpg',quality=94)
print('6 journey sheets saved')
