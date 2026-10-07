"""Assemble actual slide captures into a 16:9 PDF without changing slide content."""
import json
from io import BytesIO
from pathlib import Path
from PIL import Image
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

manifest = json.loads(Path('tmp/pdfs/slide-manifest.json').read_text(encoding='utf-8'))
assert len(manifest) == 43
output = Path('output/pdf/human-vs-ai-slides.pdf')
output.parent.mkdir(parents=True, exist_ok=True)
pdf = Canvas(str(output), pagesize=(960, 540), pageCompression=1)
pdf.setTitle('HUMAN vs AI - The Sparring Minds | 43 slide cues')
pdf.setAuthor('HUMAN vs AI presentation')
pdf.setSubject('Actual slide frames in presentation order, including game title slides; exported 2026-10-06')
pdf.setViewerPreference('FitWindow', 'true')
previous_chapter = None
for item in manifest:
    # Keep native 1920x1080 captures; compress embedded frames for practical sharing.
    image_stream = BytesIO()
    with Image.open(item['image']) as image:
        image.convert('RGB').save(image_stream, format='JPEG', quality=96, subsampling=0, optimize=True)
    image_stream.seek(0)
    pdf.drawImage(ImageReader(image_stream), 0, 0, width=960, height=540)
    key = 'cue-' + item['cueId']
    pdf.bookmarkPage(key)
    if item['chapterId'] != previous_chapter:
        pdf.addOutlineEntry(item['chapterId'] + ' - ' + item['chapterTitle'], key, level=0, closed=True)
        previous_chapter = item['chapterId']
    pdf.addOutlineEntry(item['cueId'] + ' - ' + item['title'], key, level=1)
    pdf.showPage()
pdf.save()
reader = PdfReader(str(output))
assert len(reader.pages) == 43
assert all(float(page.mediabox.width) == 960 and float(page.mediabox.height) == 540 for page in reader.pages)
assert all(page.images for page in reader.pages)
print(f'Created {output}: {len(reader.pages)} pages, {output.stat().st_size / 1024 / 1024:.1f} MB')
