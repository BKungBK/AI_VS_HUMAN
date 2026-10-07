from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]
places=[('01.01','Confluence hall'),('03.01','Gallery'),('04.03','Idea atrium'),('06.01','Calculation laboratory'),('06.04','Jagged frontier'),('07.02','Botanical grove'),('09.02','Listening room'),('10.01','Safety checkpoint'),('11.01','Civic forum'),('13.01','Systems observatory'),('15.01','Shared horizon')]
font=ImageFont.truetype(str(root/'public/assets/fonts/plex-thai-400.ttf'),24)
sheet=Image.new('RGB',(1920,4*408),(13,17,23));draw=ImageDraw.Draw(sheet)
for i,(cue,label) in enumerate(places):
    im=Image.open(root/f'qa/captures/{cue}.png').convert('RGB');im.thumbnail((640,360))
    x=(i%3)*640;y=(i//3)*408;sheet.paste(im,(x,y));draw.text((x+16,y+366),cue+'  '+label,font=font,fill=(248,249,250))
sheet.save(root/'qa/place-gallery.jpg',quality=94)
print('11 scenic places at the reading pose')
