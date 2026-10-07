from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
root=Path(__file__).resolve().parents[1]
samples=json.loads((root/'qa/spatial-motion/samples.json').read_text())
font=ImageFont.truetype(str(root/'public/assets/fonts/plex-thai-400.ttf'),21)
for name in dict.fromkeys(s['clip'] for s in samples):
    shots=[s for s in samples if s['clip']==name]
    sheet=Image.new('RGB',(1920,math.ceil(len(shots)/3)*396),(13,17,23));draw=ImageDraw.Draw(sheet)
    for i,s in enumerate(shots):
        im=Image.open(root/s['path']).convert('RGB');im.thumbnail((640,360))
        x=i%3*640;y=i//3*396;sheet.paste(im,(x,y))
        draw.text((x+12,y+361),f"{name.upper()} {s['time']:.2f}s  Z {s['state']['cameraZ']:.0f}  YAW {s['state']['cameraYaw']:.1f}",font=font,fill=(248,249,250))
    sheet.save(root/f'qa/spatial-motion/{name}-sheet.jpg',quality=94)
print('6 spatial transition sheets created')
