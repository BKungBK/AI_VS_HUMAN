from pathlib import Path
import urllib.request, re, json, hashlib, html
from PIL import Image
from io import BytesIO

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'public/assets'
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 HumanVsAISeminar/2.0'})
    return urllib.request.urlopen(req,timeout=60).read()

manifest=[]
css=get('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap').decode()
for weight,url in re.findall(r'font-weight:\s*(\d+);.*?url\((.*?)\)',css,re.S):
    path=ASSETS/'fonts'/f'plex-thai-{weight}.ttf'
    path.write_bytes(get(url))
    manifest.append({'file':str(path.relative_to(ROOT/'public')),'source':url,'rights':'SIL Open Font License 1.1','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
license_url='https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansthai/OFL.txt'
(ASSETS/'fonts/OFL.txt').write_bytes(get(license_url))

entries=[
 ('van-gogh','https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg','Vincent van Gogh / Google Art Project','Public domain (PD-Art)',''),
 ('death-cap','https://commons.wikimedia.org/wiki/File:Amanita_phalloides_1.JPG','Archenzo','CC BY-SA 3.0; original photograph unchanged except resizing','https://upload.wikimedia.org/wikipedia/commons/9/99/Amanita_phalloides_1.JPG'),
 ('flamingone','https://www.milesastray.com/iconic-imagery','Miles Astray','Copyright Miles Astray. Local educational reference for critical discussion; no open license or redistribution permission claimed. Obtain a license for publication/commercial reuse.','https://static.wixstatic.com/media/c396be_17aa907139bc454887e9ec2b59da986d~mv2.jpg/v1/fit/w_1200,h_1800,q_90/c396be_17aa907139bc454887e9ec2b59da986d~mv2.jpg')
]
for name,page,author,rights,url in entries:
    if not url:
        source=get(page).decode()
        match=re.search(r'<meta\s+property="og:image"\s+content="([^"]+)',source)
        if not match: raise RuntimeError('No bounded preview URL: '+page)
        url=html.unescape(match.group(1))
    raw=get(url)
    im=Image.open(BytesIO(raw)).convert('RGB')
    im.thumbnail((1800,1800))
    path=ASSETS/'images'/f'{name}.jpg'
    im.save(path,quality=92)
    manifest.append({'file':str(path.relative_to(ROOT/'public')),'page':page,'source':url,'author':author,'rights':rights,'width':im.width,'height':im.height,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    print(name,im.size,flush=True)
(ROOT/'sources/asset-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Assets complete',flush=True)
