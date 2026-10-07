# Slide PDF verification - 2026-10-06

- Export: output/pdf/human-vs-ai-slides.pdf
- 43 pages in the exact source cue order; 16 chapter bookmarks and cue bookmarks.
- Each page is 960 x 540 PDF points (16:9), using the actual 1920 x 1080 browser frame at cue time 4 seconds.
- Captures include all seven current game titles and all registration/ranking/closing placeholders.
- Browser captures checked for loaded images and card text overflow; no failures.
- Final PDF rendered with Poppler; all 43 pages reviewed across contact-1.png through contact-4.png, with selected pages inspected at full rendered size.
- No blank, missing, clipped or overlapping slide pages found. Compression retained readable Thai and English text.
- PDF count, dimensions, embedded page images and chapter outline verified with pypdf.
- Build, live presenter narration, document links, fixed-roster average scores and 50-minute timing checks passed.
- PDF is a static image export; the animated presentation and interactive game system remain separate artifacts.

To regenerate, run the Vite app, then node scripts/export-slides-pdf.mjs and scripts/build-slides-pdf.py using a Python runtime with ReportLab, Pillow and pypdf.
