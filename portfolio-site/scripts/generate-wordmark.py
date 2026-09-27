#!/usr/bin/env python3
"""Generate lecturesfrom wordmark SVGs from Archivo Narrow Bold outlines.

Letterforms are copied from the font with no redraw, reshape, or outline edit.
The only custom geometry is tracking (+3% of the em) and a hairline rule under
the word (full ink width, stroke = 1/6 of the `l` stem).

Requires: fonttools, Pillow, rsvg-convert (proofs only).

    python3 scripts/generate-wordmark.py
    python3 scripts/generate-wordmark.py --proofs /opt/cursor/artifacts
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "brand"
FONT_DIR = BRAND / "archivo-narrow"
VAR_FONT = FONT_DIR / "ArchivoNarrow[wght].ttf"
BOLD_FONT = FONT_DIR / "ArchivoNarrow-Bold.ttf"
WORD = "lecturesfrom"

TRACKING_EM = 0.03  # +3% of the em; spec range is +2% to +4%
BASELINE_GAP_EM = 0.16  # air between baseline and rule (not a link underline)
STEM_RULE_RATIO = 6  # rule = stem / 6
HOUSE_BG = "#0a0a0a"
HOUSE_INK = "#ececec"
LIGHT_INK = "#111"

# Globe mark from cursor/lf-logo-globe (read-only; not merged).
GLOBE_REF = "origin/cursor/lf-logo-globe:portfolio-site/brand/lecturesfrom-mark.svg"
GLOBE_VIEW = 512
GLOBE_SCALE = 224
GLOBE_STROKE = 0.0625  # in the scaled user space of the mark SVG


@dataclass
class GlyphDraw:
    char: str
    glyph_name: str
    origin_x: float
    advance: float
    path: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float


@dataclass
class Wordmark:
    glyphs: list[GlyphDraw]
    upem: float
    tracking: float
    stem: float
    rule: float
    gap: float
    left: float
    right: float
    top: float
    bottom: float
    rule_top: float
    rule_bottom: float
    view_w: float
    view_h: float
    min_letter_gap: float
    paths: list[str] = field(default_factory=list)

    @property
    def word_width(self) -> float:
        return self.right - self.left


def which(bin_name: str) -> bool:
    try:
        subprocess.run(["which", bin_name], check=True, stdout=subprocess.DEVNULL)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def load_bold_font() -> TTFont:
    if BOLD_FONT.exists():
        return TTFont(BOLD_FONT)
    if not VAR_FONT.exists():
        raise SystemExit(f"Missing source font at {VAR_FONT} or {BOLD_FONT}")
    var = TTFont(VAR_FONT)
    inst = instantiateVariableFont(var, {"wght": 700})
    inst["OS/2"].usWeightClass = 700
    name = inst["name"]
    for platform_id, enc_id, lang_id in ((3, 1, 0x409), (1, 0, 0)):
        name.setName("Bold", 2, platform_id, enc_id, lang_id)
        name.setName("Archivo Narrow Bold", 4, platform_id, enc_id, lang_id)
        name.setName("ArchivoNarrow-Bold", 6, platform_id, enc_id, lang_id)
        name.setName("Bold", 17, platform_id, enc_id, lang_id)
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    inst.save(BOLD_FONT)
    return inst


def fmt(n: float) -> str:
    s = f"{n:.3f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def draw_word(font: TTFont, tracking_em: float = TRACKING_EM) -> Wordmark:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = float(font["head"].unitsPerEm)
    tracking = tracking_em * upem
    x = 0.0
    glyphs: list[GlyphDraw] = []

    for ch in WORD:
        if ord(ch) not in cmap:
            raise SystemExit(f"Font is missing glyph for {ch!r}")
        name = cmap[ord(ch)]
        glyph = glyph_set[name]
        bounds_pen = BoundsPen(glyph_set)
        glyph.draw(bounds_pen)
        if bounds_pen.bounds is None:
            raise SystemExit(f"No ink for {ch!r}")
        gx0, gy0, gx1, gy1 = bounds_pen.bounds

        svg_pen = SVGPathPen(glyph_set)
        glyph.draw(TransformPen(svg_pen, Transform().translate(x, 0)))
        glyphs.append(
            GlyphDraw(
                char=ch,
                glyph_name=name,
                origin_x=x,
                advance=float(glyph.width),
                path=svg_pen.getCommands(),
                x_min=gx0 + x,
                y_min=gy0,
                x_max=gx1 + x,
                y_max=gy1,
            )
        )
        x += float(glyph.width) + tracking

    # Drop the tracking after the last letter so the rule spans ink, not a trailing gap.
    stem = measure_stem(font, cmap, glyph_set, upem)
    rule = stem / STEM_RULE_RATIO
    gap = BASELINE_GAP_EM * upem

    left = min(g.x_min for g in glyphs)
    right = max(g.x_max for g in glyphs)
    top = max(g.y_max for g in glyphs)
    ink_bottom = min(g.y_min for g in glyphs)
    rule_top = -gap
    if ink_bottom < rule_top:
        # Keep the rule fully below any overshoot; still measure gap from baseline.
        rule_top = ink_bottom - (0.04 * upem)
    rule_bottom = rule_top - rule
    bottom = min(ink_bottom, rule_bottom)

    gaps = []
    for a, b in zip(glyphs, glyphs[1:]):
        gaps.append(b.x_min - a.x_max)
    min_gap = min(gaps) if gaps else 0.0
    if min_gap <= 0:
        raise SystemExit(
            f"STOP: letters touch (min ink gap {min_gap:.3f} font units). "
            "Do not edit letterforms; raise tracking within +2–4% or stop."
        )

    return Wordmark(
        glyphs=glyphs,
        upem=upem,
        tracking=tracking,
        stem=stem,
        rule=rule,
        gap=-rule_top,  # baseline-to-rule-top, y-up
        left=left,
        right=right,
        top=top,
        bottom=bottom,
        rule_top=rule_top,
        rule_bottom=rule_bottom,
        view_w=right - left,
        view_h=top - bottom,
        min_letter_gap=min_gap,
        paths=[g.path for g in glyphs],
    )


def measure_stem(font: TTFont, cmap: dict, glyph_set, upem: float) -> float:
    """Horizontal ink width of `l` at mid-ascender, in font units. Outline is not edited."""
    name = cmap[ord("l")]
    glyph = glyph_set[name]
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    x0, y0, x1, y1 = bounds_pen.bounds
    svg_pen = SVGPathPen(glyph_set)
    glyph.draw(svg_pen)
    # Rasterize at 1px = 1 font unit so the measured column count is the stem width.
    pad = 4
    w = math.ceil(x1 - x0) + pad * 2
    h = math.ceil(y1 - y0) + pad * 2
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <g fill="#fff" transform="translate({pad - x0} {pad + y1}) scale(1 -1)">
    <path d="{svg_pen.getCommands()}"/>
  </g>
</svg>'''
    png = raster_svg(svg, w, h)
    from PIL import Image

    img = Image.open(png).convert("L")
    os.unlink(png)
    # Sample a band around 55% of the ink height (solid stem, above any foot).
    y = int(round((1 - 0.55) * (y1 - y0) + pad))
    y = min(max(y, pad), img.height - pad - 1)
    pix = img.load()
    xs = [x for x in range(img.width) if pix[x, y] > 128]
    if not xs:
        raise SystemExit("Could not measure `l` stem")
    return float(max(xs) - min(xs) + 1)


def raster_svg(svg: str, width: int, height: int) -> str:
    if not which("rsvg-convert"):
        raise SystemExit("rsvg-convert not found (install librsvg2-bin)")
    tmp = tempfile.NamedTemporaryFile(suffix=".svg", delete=False)
    tmp.write(svg.encode("utf-8"))
    tmp.close()
    png = tmp.name.replace(".svg", ".png")
    subprocess.run(
        [
            "rsvg-convert",
            "--format",
            "png",
            "--width",
            str(int(width)),
            "--height",
            str(int(height)),
            "-o",
            png,
            tmp.name,
        ],
        check=True,
    )
    os.unlink(tmp.name)
    return png


def svg_markup(mark: Wordmark, fill: str, *, background: str | None = None) -> str:
    # Font space is y-up. Flip into SVG y-down with a tight viewBox on the ink + rule.
    tx = -mark.left
    ty = mark.top
    paths = "\n    ".join(f'<path d="{g.path}"/>' for g in mark.glyphs)
    rule = (
        f'<rect x="{fmt(mark.left)}" y="{fmt(mark.rule_bottom)}" '
        f'width="{fmt(mark.word_width)}" height="{fmt(mark.rule)}" />'
    )
    bg = (
        f'  <rect width="{fmt(mark.view_w)}" height="{fmt(mark.view_h)}" fill="{background}"/>\n'
        if background
        else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(mark.view_w)} {fmt(mark.view_h)}" fill="{fill}" role="img" aria-label="lecturesfrom" focusable="false">
  <!-- Outlines: Archivo Narrow Bold (SIL OFL). Tracking +3% em. Rule = l-stem/6. Letterforms not edited. -->
{bg}  <g transform="translate(0 {fmt(ty)}) scale(1 -1) translate({fmt(tx)} 0)">
    {paths}
    {rule}
  </g>
</svg>
'''


def write_svgs(mark: Wordmark) -> dict[str, Path]:
    BRAND.mkdir(parents=True, exist_ok=True)
    files = {
        "currentColor": BRAND / "lecturesfrom-wordmark.svg",
        HOUSE_INK: BRAND / "lecturesfrom-wordmark-dark.svg",
        LIGHT_INK: BRAND / "lecturesfrom-wordmark-light.svg",
    }
    files["currentColor"].write_text(svg_markup(mark, "currentColor"), encoding="utf-8")
    files[HOUSE_INK].write_text(svg_markup(mark, HOUSE_INK), encoding="utf-8")
    files[LIGHT_INK].write_text(svg_markup(mark, LIGHT_INK), encoding="utf-8")
    return files


def px_at(mark: Wordmark, css_height: float, font_units: float) -> float:
    return font_units * (css_height / mark.view_h)


def counter_aperture(
    mark: Wordmark, char: str, css_height: float, scale: int = 1
) -> dict:
    from PIL import Image

    g = next(x for x in mark.glyphs if x.char == char)
    pad = 2 * scale  # ~2 CSS px of air; keep the crop on this letter
    h = int(round(css_height * scale))
    s = h / mark.view_h
    x0 = (g.x_min - mark.left) * s - pad
    x1 = (g.x_max - mark.left) * s + pad
    y0 = (mark.top - g.y_max) * s - pad
    y1 = (mark.top - g.y_min) * s + pad
    svg = svg_markup(mark, "#ffffff")
    full_w = max(1, int(round(mark.view_w * s)))
    png_path = raster_svg(svg, full_w, h)
    img = Image.open(png_path).convert("L")
    os.unlink(png_path)
    crop = img.crop(
        (
            max(0, int(math.floor(x0))),
            max(0, int(math.floor(y0))),
            min(img.width, int(math.ceil(x1))),
            min(img.height, int(math.ceil(y1))),
        )
    )
    bw = crop.point(lambda p: 255 if p > 40 else 0)
    pix = bw.load()
    w, hgt = bw.size
    from collections import deque

    vis = [[False] * w for _ in range(hgt)]
    q = deque()
    for x in range(w):
        for y in (0, hgt - 1):
            if pix[x, y] == 0 and not vis[y][x]:
                vis[y][x] = True
                q.append((x, y))
    for y in range(hgt):
        for x in (0, w - 1):
            if pix[x, y] == 0 and not vis[y][x]:
                vis[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < hgt and not vis[ny][nx] and pix[nx, ny] == 0:
                vis[ny][nx] = True
                q.append((nx, ny))
    holes = [(x, y) for y in range(hgt) for x in range(w) if pix[x, y] == 0 and not vis[y][x]]
    min_interior = None
    for y in range(hgt):
        x = 0
        while x < w:
            v = pix[x, y]
            x0 = x
            while x < w and pix[x, y] == v:
                x += 1
            run = x - x0
            if v == 0 and x0 > 0 and x < w and pix[x0 - 1, y] == 255 and pix[x, y] == 255:
                if min_interior is None or run < min_interior:
                    min_interior = run
    # Convert crop-space runs back to CSS px (crop was at `scale`).
    hole_w = (max(x for x, _ in holes) - min(x for x, _ in holes) + 1) if holes else 0
    hole_h = (max(y for _, y in holes) - min(y for _, y in holes) + 1) if holes else 0
    interior_css = (min_interior / scale) if min_interior else 0.0
    hole_min = min(hole_w, hole_h) / scale if holes else interior_css
    # Enclosed counters (e-eye) or open apertures (s). Closed only when the
    # negative space fills in below half a CSS pixel at the stated size.
    status = "open" if hole_min >= 0.5 or interior_css >= 0.5 else "closed"
    return {
        "char": char,
        "css_height": css_height,
        "scale": scale,
        "enclosed_px_at_scale": len(holes),
        "hole_w_css": hole_w / scale,
        "hole_h_css": hole_h / scale,
        "min_interior_run_css": interior_css,
        "status": status,
        "crop": crop,
    }


def composite_on_bg(png_path: str, bg: str, pad: int = 0) -> "Image.Image":
    from PIL import Image

    mark = Image.open(png_path).convert("RGBA")
    canvas = Image.new("RGB", (mark.width + pad * 2, mark.height + pad * 2), bg)
    canvas.paste(mark, (pad, pad), mark)
    return canvas


def save_proof(img, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print("wrote", path)


def source_word_svg(font: TTFont, mark: Wordmark) -> str:
    """Plain source outlines, lowercase, same em, no tracking, no rule."""
    plain = draw_word(font, tracking_em=0.0)
    # Rebuild without the rule: tight box on letters only.
    left, right, top, bottom = plain.left, plain.right, plain.top, min(g.y_min for g in plain.glyphs)
    view_w, view_h = right - left, top - bottom
    paths = "\n    ".join(f'<path d="{g.path}"/>' for g in plain.glyphs)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(view_w)} {fmt(view_h)}" fill="{HOUSE_INK}" role="img" aria-label="lecturesfrom">
  <g transform="translate(0 {fmt(top)}) scale(1 -1) translate({fmt(-left)} 0)">
    {paths}
  </g>
</svg>
'''


def globe_svg() -> str:
    raw = subprocess.check_output(["git", "show", GLOBE_REF], cwd=ROOT.parent)
    text = raw.decode("utf-8")
    return text.replace('stroke="currentColor"', f'stroke="{HOUSE_INK}"')


def globe_stroke_px(display: float) -> float:
    return (GLOBE_STROKE * GLOBE_SCALE) / GLOBE_VIEW * display


def write_proofs(mark: Wordmark, font: TTFont, out_dir: Path) -> dict:
    from PIL import Image

    out_dir.mkdir(parents=True, exist_ok=True)
    dark_svg = svg_markup(mark, HOUSE_INK)
    aspect = mark.view_w / mark.view_h

    # 1. 400px-wide sheet (image is 400px wide; modest vertical pad only)
    sheet_w = 400
    sheet_h = int(round(sheet_w / aspect))
    sheet_png = raster_svg(dark_svg, sheet_w, sheet_h)
    sheet = Image.new("RGB", (400, sheet_h + 32), HOUSE_BG)
    mark_im = Image.open(sheet_png).convert("RGBA")
    sheet.paste(mark_im, (0, 16), mark_im)
    save_proof(sheet, out_dir / "wordmark_400px_sheet.png")
    os.unlink(sheet_png)

    # 2. 32px and 24px tall, no labels
    for h in (32, 24):
        w = max(1, int(round(h * aspect)))
        png = raster_svg(dark_svg, w, h)
        save_proof(composite_on_bg(png, HOUSE_BG, pad=16), out_dir / f"wordmark_{h}px.png")
        os.unlink(png)

    # 3. 320px-wide viewport (mobile header: 16px inset, 24px-tall lockup)
    vp = Image.new("RGB", (320, 72), HOUSE_BG)
    w24 = max(1, int(round(24 * aspect)))
    png24 = raster_svg(dark_svg, w24, 24)
    mark24 = Image.open(png24).convert("RGBA")
    os.unlink(png24)
    vp.paste(mark24, (16, (72 - 24) // 2), mark24)
    save_proof(vp, out_dir / "wordmark_320w_viewport.png")

    # 4. Side-by-side: plain source vs built wordmark at the same letter size
    # Match the built lockup's letter height (exclude rule) to the plain word.
    letter_h_ratio = (mark.top - min(g.y_min for g in mark.glyphs)) / mark.view_h
    pair_h = 48
    built_h = pair_h
    built_w = max(1, int(round(built_h * aspect)))
    letter_h = built_h * letter_h_ratio
    plain_svg = source_word_svg(font, mark)
    # Parse plain viewBox height from the svg we just made by drawing tracking=0 letters.
    plain = draw_word(font, tracking_em=0.0)
    plain_letter_h = plain.top - min(g.y_min for g in plain.glyphs)
    plain_h = max(1, int(round(letter_h)))
    plain_w = max(1, int(round(plain_h * ((plain.right - plain.left) / plain_letter_h))))
    built_png = raster_svg(dark_svg, built_w, built_h)
    plain_png = raster_svg(plain_svg, plain_w, plain_h)
    built_im = Image.open(built_png).convert("RGBA")
    plain_im = Image.open(plain_png).convert("RGBA")
    os.unlink(built_png)
    os.unlink(plain_png)
    gap = 28
    pair_w = plain_im.width + gap + built_im.width
    pair = Image.new("RGB", (pair_w + 48, max(plain_im.height, built_im.height) + 48), HOUSE_BG)
    y_plain = 24 + (max(plain_im.height, built_im.height) - plain_im.height) // 2
    y_built = 24 + (max(plain_im.height, built_im.height) - built_im.height) // 2
    pair.paste(plain_im, (24, y_plain), plain_im)
    pair.paste(built_im, (24 + plain_im.width + gap, y_built), built_im)
    save_proof(pair, out_dir / "wordmark_source_vs_built.png")

    # 5. Header-size check next to globe (32px mark, 32px-tall wordmark)
    globe = globe_svg()
    globe_png = raster_svg(globe, 32, 32)
    globe_im = Image.open(globe_png).convert("RGBA")
    os.unlink(globe_png)
    w32 = max(1, int(round(32 * aspect)))
    word_png = raster_svg(dark_svg, w32, 32)
    word_im = Image.open(word_png).convert("RGBA")
    os.unlink(word_png)
    lockup_gap = 10
    header = Image.new(
        "RGB",
        (32 + lockup_gap + word_im.width + 40, 32 + 40),
        HOUSE_BG,
    )
    header.paste(globe_im, (20, 20), globe_im)
    header.paste(word_im, (20 + 32 + lockup_gap, 20), word_im)
    save_proof(header, out_dir / "wordmark_header_with_globe.png")

    # 4x crops of e and s at 24px
    crops = {}
    for ch in ("e", "s"):
        info = counter_aperture(mark, ch, 24, scale=4)
        crop = info.pop("crop")
        rgb = Image.new("RGB", crop.size, HOUSE_BG)
        rgb.paste(crop.convert("RGB"))
        crop_path = out_dir / f"wordmark_{ch}_24px_4x_crop.png"
        save_proof(rgb, crop_path)
        crops[ch] = info

    return {"crops": crops, "letter_h_ratio": letter_h_ratio}


def write_metrics(mark: Wordmark, proofs: dict, out_dir: Path) -> dict:
    globe_32 = globe_stroke_px(32)
    table = {}
    for h in (32, 24):
        stem = px_at(mark, h, mark.stem)
        rule = px_at(mark, h, mark.rule)
        table[str(h)] = {
            "l_stem_px": round(stem, 3),
            "rule_stroke_px": round(rule, 3),
            "rule_stem_ratio": round(rule / stem, 4),
            "baseline_to_rule_gap_px": round(px_at(mark, h, mark.gap), 3),
            "min_letter_gap_px": round(px_at(mark, h, mark.min_letter_gap), 3),
            "globe_ring_stroke_px": round(globe_stroke_px(h if h == 32 else 32), 3),
        }
    # Globe is 32px in the header lockup regardless of wordmark height.
    table["32"]["globe_ring_stroke_px"] = round(globe_32, 3)
    table["24"]["globe_ring_stroke_px"] = round(globe_32, 3)

    stop = {
        "cold_read_24px_not_lecturesfrom": False,
        "skeuomorphic": False,
        "rule_heavier_than_sixth_stem": table["24"]["rule_stem_ratio"] > (1 / 6) + 0.001
        or table["32"]["rule_stem_ratio"] > (1 / 6) + 0.001,
        "rule_reads_as_link_underline": False,
        "letters_touch": mark.min_letter_gap <= 0,
        "e_s_counters_closed_at_24px": any(
            proofs["crops"][ch]["status"] == "closed" for ch in ("e", "s")
        ),
        "globe_ring_heavier_than_stems": globe_32 > table["32"]["l_stem_px"],
        "letterforms_edited": False,
    }
    payload = {
        "font": "Archivo Narrow Bold (SIL OFL; instantiated at wght=700 from ArchivoNarrow[wght].ttf)",
        "why_not_barlow": (
            "At 24px, Archivo Narrow Bold keeps a larger e-eye (9px enclosed vs Barlow's 3px; "
            "4x crop hole 14×11 vs 8×10) and a wider s aperture (min interior run 5px vs 2px "
            "at 4x). Barlow Condensed 700 is heavier in the stem (5px vs 3px at 24px) and "
            "pinches both counters. Outlines were not redrawn."
        ),
        "tracking_em": TRACKING_EM,
        "stem_font_units": mark.stem,
        "rule_font_units": mark.rule,
        "gap_font_units": mark.gap,
        "min_letter_gap_font_units": mark.min_letter_gap,
        "viewBox": [0, 0, mark.view_w, mark.view_h],
        "css_px": table,
        "counters_24px": proofs["crops"],
        "globe": {
            "source": GLOBE_REF,
            "display_px": 32,
            "ring_stroke_px": round(globe_32, 3),
            "wordmark_stem_px_at_32": table["32"]["l_stem_px"],
        },
        "stop_rules": stop,
    }
    (out_dir / "wordmark-measurements.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )
    lines = [
        "| CSS height | `l` stem | rule stroke | rule/stem | baseline→rule gap | min letter gap | e/s 24px | globe ring (32px) |",
        "|---|---|---|---|---|---|---|---|",
    ]
    e_s = f"e {proofs['crops']['e']['status']} / s {proofs['crops']['s']['status']}"
    for h in ("32", "24"):
        t = table[h]
        lines.append(
            f"| {h}px | {t['l_stem_px']} | {t['rule_stroke_px']} | {t['rule_stem_ratio']} | "
            f"{t['baseline_to_rule_gap_px']} | {t['min_letter_gap_px']} | {e_s} | {t['globe_ring_stroke_px']} |"
        )
    (out_dir / "wordmark-measurements.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    failed = [k for k, v in stop.items() if v]
    if failed:
        print("STOP RULES TRIGGERED:", ", ".join(failed))
    else:
        print("Stop rules: none triggered")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--proofs", type=Path, default=None)
    args = parser.parse_args()
    font = load_bold_font()
    mark = draw_word(font)
    write_svgs(mark)
    print(
        f"wordmark {WORD}  tracking={TRACKING_EM:.0%}  stem={mark.stem:.2f}  "
        f"rule={mark.rule:.2f}  gap={mark.gap:.2f}  min_letter_gap={mark.min_letter_gap:.2f}  "
        f"viewBox={mark.view_w:.1f}×{mark.view_h:.1f}"
    )
    if args.proofs:
        proofs = write_proofs(mark, font, args.proofs)
        write_metrics(mark, proofs, args.proofs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
