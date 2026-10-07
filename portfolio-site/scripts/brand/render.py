# Renders the official lecturesfrom logo set from the 2026-09-26 master paths.
# Usage: pip install cairosvg pillow && python3 scripts/brand/render.py
# Then: node scripts/brand/manifest.mjs
import io, os, cairosvg
from PIL import Image
OUT=os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'brand'); os.makedirs(OUT,exist_ok=True)
INK, WHITE = '#20262b', '#ffffff'
PATHS='''<circle r="1"/>
    <ellipse rx="1" ry="0.43" transform="rotate(-60)"/>
    <path d="M 0.605385 -0.384961 C 0.86 -0.09 0.94 0.22 0.852000 0.501000"/>
    <path d="M 0.605385 -0.384961 L 0 0 L 0.852000 0.501000 M 0 0 L 0.837356 0.000000 M 0 0 L 0.237000 -0.482000"/>
    <path d="M 0.197285 -0.587803 L 0.275803 -0.552715 L 0.240715 -0.474197 L 0.162197 -0.509285 Z"/>'''
# simplified for tiny sizes: drop flag + square, thicker stroke
SIMPLE='''<circle r="1"/>
    <ellipse rx="1" ry="0.43" transform="rotate(-60)"/>
    <path d="M 0.605385 -0.384961 C 0.86 -0.09 0.94 0.22 0.852000 0.501000"/>
    <path d="M 0.605385 -0.384961 L 0 0 L 0.852000 0.501000 M 0 0 L 0.837356 0.000000"/>'''
def mark(color, paths=PATHS, sw='0.0625', scale=224, bg=None, title=True):
    t='\n  <title>lecturesfrom</title>' if title else ''
    b=f'\n  <rect width="512" height="512" fill="{bg}"/>' if bg else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">{t}{b}
  <g transform="translate(256 256) scale({scale})" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">
    {paths}
  </g>
</svg>
'''
def w(name, s): open(f'{OUT}/{name}','w').write(s)
def png(svg, px): return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=px,output_height=px))).convert('RGBA')

dark, white = mark(INK), mark(WHITE)
w('logo.svg', dark); w('logo-white.svg', white)
for px in (512,1024):
    png(dark,px).save(f'{OUT}/logo-{px}.png', optimize=True)
    png(white,px).save(f'{OUT}/logo-white-{px}.png', optimize=True)

# favicon svg: simplified, adapts to browser dark mode
fav=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <style>g{{stroke:{INK}}} @media (prefers-color-scheme:dark){{g{{stroke:{WHITE}}}}}</style>
  <g transform="translate(256 256) scale(236)" stroke-width="0.095" stroke-linecap="round" stroke-linejoin="round">
    {SIMPLE}
  </g>
</svg>
'''
w('favicon.svg', fav)
simple = mark(INK, SIMPLE, '0.095', 236, title=False)
ico=[png(simple,s) for s in (16,32,48)]
ico[2].save(f'{OUT}/favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=ico[:2])
png(simple,32).save(f'{OUT}/favicon-32.png')
# app icons: full mark on solid white (iOS/Android fill transparency badly)
app = mark(INK, scale=190, bg=WHITE, title=False)
png(app,180).convert('RGB').save(f'{OUT}/apple-touch-icon.png')
for s in (192,512): png(app,s).convert('RGB').save(f'{OUT}/icon-{s}.png')
print(sorted(os.listdir(OUT)))
