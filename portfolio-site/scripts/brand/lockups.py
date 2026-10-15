# Builds lecturesfrom lockups: mark A + "lecturesfrom" in Chakra Petch 600, text outlined.
# Geometry follows Paper board 15, column B, times 4. Clear space is a third of the mark width.
# Usage: pip install fonttools uharfbuzz brotli cairosvg
#        npm pack @fontsource/chakra-petch@5.2.5 && tar xzf fontsource-chakra-petch-5.2.5.tgz
#        python3 scripts/brand/lockups.py package/files/chakra-petch-latin-600-normal.woff
import io, os, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = sys.argv[1]
OUT = os.path.join(HERE, '..', '..', 'public', 'brand', 'kit', 'lockups'); os.makedirs(OUT, exist_ok=True)
WORD = 'lecturesfrom'
TRACK = -0.01

tt = TTFont(FONT)
gs = tt.getGlyphSet()
upm = tt['head'].unitsPerEm
hhea = tt['hhea']
asc, desc = hhea.ascent, -hhea.descent  # desc positive

buf = hb.Buffer(); buf.add_str(WORD); buf.guess_segment_properties()
# harfbuzz cannot read woff directly in all builds; decompress to sfnt bytes
b = io.BytesIO(); tt2 = TTFont(FONT); tt2.flavor = None; tt2.save(b)
face = hb.Face(b.getvalue()); font = hb.Font(face)
hb.shape(font, buf, {'kern': True, 'liga': True})
order = tt.getGlyphOrder()
glyphs = [(order[i.codepoint], p.x_advance, p.x_offset, p.y_offset) for i, p in zip(buf.glyph_infos, buf.glyph_positions)]

def text_paths(size):
    """returns (svg path d, width, ink bounds) for the word at font-size `size`, baseline y=0."""
    s = size / upm
    x = 0.0; ds = []; bp_all = None
    for i, (name, adv, xo, yo) in enumerate(glyphs):
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (s, 0, 0, -s, x + xo * s, -yo * s))
        gs[name].draw(tp)
        ds.append(pen.getCommands())
        bpen = BoundsPen(gs); gs[name].draw(TransformPen(bpen, (s, 0, 0, -s, x + xo * s, -yo * s)))
        if bpen.bounds:
            bx = bpen.bounds
            bp_all = bx if bp_all is None else (min(bp_all[0], bx[0]), min(bp_all[1], bx[1]), max(bp_all[2], bx[2]), max(bp_all[3], bx[3]))
        x += adv * s
        if i < len(glyphs) - 1: x += TRACK * size
    return ' '.join(d for d in ds if d), x, bp_all

MARK = '''<g transform="translate({cx:.3f} {cy:.3f}) scale({k:.5f})" fill="none" stroke="{ink}" stroke-width="0.0625" stroke-linecap="round" stroke-linejoin="round">
    <circle r="1"/>
    <ellipse rx="1" ry="0.43" transform="rotate(-60)"/>
    <path d="M 0.605385 -0.384961 C 0.86 -0.09 0.94 0.22 0.852 0.501"/>
    <path d="M 0.605385 -0.384961 L 0 0 L 0.852 0.501 M 0 0 L 0.837356 0 M 0 0 L 0.237 -0.482"/>
    <path d="M 0.197285 -0.587803 L 0.275803 -0.552715 L 0.240715 -0.474197 L 0.162197 -0.509285 Z" fill="{ink}"/>
  </g>'''
# mark box of side M maps 512 units; circle r=224 units
def mark(cx, cy, box, ink):
    return MARK.format(cx=cx, cy=cy, k=box * 224 / 512, ink=ink)

def line_box_baseline(size):
    # CSS line-height 100%: content area (asc+desc) centered in a box of height `size`
    s = size / upm
    return (size - (asc + desc) * s) / 2 + asc * s

THEMES = {
    'light': {'bg': '#FFFFFF', 'mark': '#20262B', 'text': '#0A0A0A'},
    'dark':  {'bg': '#0A0A0A', 'mark': '#ECECEC', 'text': '#ECECEC'},
}
U = 4  # board units to file units

def svg(w, h, body, bg, title='lecturesfrom'):
    bgr = f'\n  <rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">
  <title>{title}</title>{bgr}
  {body}
</svg>
'''

def horizontal(theme, bg=True):
    t = THEMES[theme]
    M, gap, size = 60 * U, 22 * U, 40 * U
    d, tw, ink = text_paths(size)
    pad = M / 3  # clear space rule: a third of the mark width
    inner_w = M + gap + tw
    inner_h = max(M, size)
    W, H = inner_w + 2 * pad, inner_h + 2 * pad
    cy = H / 2
    tx = pad + M + gap
    base = cy - size / 2 + line_box_baseline(size)
    body = mark(pad + M / 2, cy, M, t['mark']) + f'\n  <path transform="translate({tx:.3f} {base:.3f})" fill="{t["text"]}" d="{d}"/>'
    return svg(W, H, body, t['bg'] if bg else None)

def vertical(theme, bg=True):
    t = THEMES[theme]
    M, gap, size = 92 * U, 18 * U, 30 * U
    d, tw, ink = text_paths(size)
    pad = M / 3
    inner_w = max(M, tw); inner_h = M + gap + size
    W, H = inner_w + 2 * pad, inner_h + 2 * pad
    cx = W / 2
    top = pad
    base = top + M + gap + line_box_baseline(size)
    body = mark(cx, top + M / 2, M, t['mark']) + f'\n  <path transform="translate({cx - tw / 2:.3f} {base:.3f})" fill="{t["text"]}" d="{d}"/>'
    return svg(W, H, body, t['bg'] if bg else None)

made = []
for layout, fn in (('horizontal', horizontal), ('vertical', vertical)):
    for theme in ('light', 'dark'):
        for bg in (True, False):
            name = f'lf-lockup-{layout}-{"ink" if theme == "light" else "white"}{"" if bg else "-transparent"}'
            s = fn(theme, bg)
            open(f'{OUT}/{name}.svg', 'w').write(s); made.append(f'{name}.svg')
            png = cairosvg.svg2png(bytestring=s.encode(), scale=2)
            open(f'{OUT}/{name}.png', 'wb').write(png); made.append(f'{name}.png')
print('\n'.join(made))
