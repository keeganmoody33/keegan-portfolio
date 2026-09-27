#!/usr/bin/env python3
"""Build the lecturesfrom Hathaway wordmark from outlined Fraunces glyphs.

Base: Fraunces (SIL OFL) at wght 900, SOFT 100, WONK 0, opsz 144.
Do not redraw letter skeletons. Customize only:
  - tighten neighbours until they touch, at most 1% overlap
  - solid dot in the o counter
  - round sharp serif ends that fight a Cooper feel

Output: public/brand/wordmark-hathaway.svg and wordmark-hathaway-sm.svg
with a reused <use> shadow stack on dark house tokens.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

WORD = "lecturesfrom"
FACE_INK = "#ececec"  # --house-ink on dark
SHADOW_NEAR = "#C8C8C8"
SHADOW_MID = "#A8A8A8"
SHADOW_FAR = "#8A8A8A"
KISS_PCT = 0.01
CURVE_STEPS = 20
SOFTEN_FRAC = 0.018  # of stem width; rounds ends, does not rewrite skeletons
TOTAL_OFFSET_STEMS = 0.72  # 3-step total offset as a fraction of stem width
PAD = 8.0

ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "brand" / "fraunces" / "Fraunces[SOFT,WONK,opsz,wght].ttf"
OUT_DIR = ROOT / "public" / "brand"
INSTANCE = {"wght": 900, "SOFT": 100, "WONK": 0, "opsz": 144}


class FlattenPen(BasePen):
    """Linearize TrueType outlines into point rings (font y-up)."""

    def __init__(self, glyph_set, steps: int = CURVE_STEPS):
        super().__init__(glyph_set)
        self.steps = steps
        self.contours: list[list[tuple[float, float]]] = []
        self._pts: list[tuple[float, float]] = []

    def _moveTo(self, pt):
        self._pts = [pt]

    def _lineTo(self, pt):
        self._pts.append(pt)

    def _curveToOne(self, p1, p2, p3):
        p0 = self._pts[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
            y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
            self._pts.append((x, y))

    def _qCurveToOne(self, p1, p2):
        p0 = self._pts[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            mt = 1 - t
            x = mt**2 * p0[0] + 2 * mt * t * p1[0] + t**2 * p2[0]
            y = mt**2 * p0[1] + 2 * mt * t * p1[1] + t**2 * p2[1]
            self._pts.append((x, y))

    def _closePath(self):
        if self._pts:
            if self._pts[0] != self._pts[-1]:
                self._pts.append(self._pts[0])
            if len(self._pts) >= 4:
                self.contours.append(self._pts)
            self._pts = []

    def _endPath(self):
        self._closePath()


def load_instance() -> TTFont:
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Fraunces VF missing: {FONT_PATH}")
    vf = TTFont(str(FONT_PATH))
    return instancer.instantiateVariableFont(vf, INSTANCE, overlap=True)


def contours_to_geom(contours: list[list[tuple[float, float]]]):
    polys: list[Polygon] = []
    for c in contours:
        p = Polygon(c)
        if not p.is_valid:
            p = p.buffer(0)
        if p.is_empty:
            continue
        if p.geom_type == "MultiPolygon":
            polys.extend([g for g in p.geoms if g.area > 0])
        elif p.area > 0:
            polys.append(p)
    if not polys:
        return Polygon()
    polys.sort(key=lambda p: p.area, reverse=True)
    result = polys[0]
    for p in polys[1:]:
        if result.contains(p.representative_point()) or result.contains(p):
            result = result.difference(p)
        else:
            result = result.union(p)
    return result


def glyph_geom(font: TTFont, name: str):
    gs = font.getGlyphSet()
    pen = FlattenPen(gs)
    gs[name].draw(pen)
    return contours_to_geom(pen.contours)


def glyph_width(font: TTFont, name: str) -> float:
    return float(font.getGlyphSet()[name].width)


def x_height(font: TTFont) -> float:
    os2 = font["OS/2"]
    return float(getattr(os2, "sxHeight", 0) or 0)


def measure_stem(l_geom, xh: float) -> float:
    """Longest horizontal chord through the l stem in the x-height band."""
    minx, miny, maxx, maxy = l_geom.bounds
    widths = []
    for frac in (0.35, 0.45, 0.55, 0.65, 0.75):
        y = miny + (min(xh, maxy) - miny) * frac
        hit = l_geom.intersection(LineString([(minx - 20, y), (maxx + 20, y)]))
        if hit.is_empty:
            continue
        geoms = list(hit.geoms) if hit.geom_type.startswith("Multi") else [hit]
        for g in geoms:
            widths.append(g.bounds[2] - g.bounds[0])
    if not widths:
        return (maxx - minx) * 0.7
    widths.sort()
    return widths[len(widths) // 2]


def soften_serif_ends(geom, radius: float):
    """Round sharp corners only. Small round join; skeletons stay the font's."""
    if radius <= 0 or geom.is_empty:
        return geom
    rounded = geom.buffer(radius, join_style="round", quad_segs=16).buffer(
        -radius, join_style="round", quad_segs=16
    )
    if rounded.is_empty:
        return geom
    return rounded


def just_touch_then_kiss(prev, nxt, x_guess: float, bite: float) -> float:
    """Slide nxt left from x_guess until it touches prev, then overlap by bite."""

    def at(x: float):
        return affinity.translate(nxt, xoff=x)

    def overlaps(x: float) -> bool:
        g = at(x)
        return bool(prev.intersects(g)) or prev.distance(g) < 1e-4

    x = x_guess
    if overlaps(x):
        while overlaps(x) and x < x_guess + 4000:
            x += 30.0
        hi = x
        lo = x_guess
    else:
        hi = x
        lo = x
        while (not overlaps(lo)) and lo > x_guess - 5000:
            lo -= 40.0
        if not overlaps(lo):
            raise RuntimeError("letters never meet while tightening")
    for _ in range(32):
        mid = (lo + hi) / 2.0
        if overlaps(mid):
            lo = mid
        else:
            hi = mid
    return lo - bite


def o_dot_at(o_geom, radius: float):
    """Solid disc in the o counter. Second polygon; not a skeleton rewrite."""
    if o_geom.geom_type == "Polygon" and o_geom.interiors:
        hole = Polygon(o_geom.interiors[0])
        c = hole.centroid
        r = min(radius, math.sqrt(hole.area / math.pi) * 0.42)
        return Point(c.x, c.y).buffer(r, quad_segs=28)
    c = o_geom.centroid
    return Point(c.x, c.y).buffer(radius, quad_segs=28)


def ring_d(coords) -> str:
    coords = list(coords)
    if len(coords) > 1 and coords[0] == coords[-1]:
        coords = coords[:-1]
    parts = [f"M{coords[0][0]:.2f} {coords[0][1]:.2f}"]
    for x, y in coords[1:]:
        parts.append(f"L{x:.2f} {y:.2f}")
    parts.append("Z")
    return "".join(parts)


def geom_to_path(geom) -> str:
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    return "".join(
        ring_d(p.exterior.coords) + "".join(ring_d(i.coords) for i in p.interiors) for p in polys
    )


def flip_down(geom):
    """Font y-up -> SVG y-down, then origin at (0,0)."""
    minx, miny, maxx, maxy = geom.bounds
    geom = affinity.scale(geom, xfact=1.0, yfact=-1.0, origin=(0, 0))
    minx, miny, maxx, maxy = geom.bounds
    return affinity.translate(geom, xoff=-minx, yoff=-miny)


def place_word(font: TTFont, *, kiss: bool, soften: bool, add_dot: bool):
    cmap = font.getBestCmap()
    names = [cmap[ord(ch)] for ch in WORD]
    raw = [glyph_geom(font, n) for n in names]
    widths = [glyph_width(font, n) for n in names]
    xh = x_height(font)
    stem = measure_stem(raw[0], xh)
    radius = stem * SOFTEN_FRAC if soften else 0.0
    glyphs = [soften_serif_ends(g, radius) if soften else g for g in raw]

    xs = [0.0]
    placed = [glyphs[0]]
    for i in range(1, len(glyphs)):
        if kiss:
            bite = KISS_PCT * max(
                placed[-1].bounds[2] - placed[-1].bounds[0],
                glyphs[i].bounds[2] - glyphs[i].bounds[0],
            )
            x = just_touch_then_kiss(placed[-1], glyphs[i], xs[-1] + widths[i - 1], bite)
        else:
            x = xs[-1] + widths[i - 1]
        xs.append(x)
        placed.append(affinity.translate(glyphs[i], xoff=x))

    dots = []
    if add_dot:
        o_i = WORD.index("o")
        o_g = placed[o_i]
        dots.append(o_dot_at(o_g, stem * 0.16))

    body = unary_union(placed)
    face = unary_union([body, *dots]) if dots else body
    boxes = {}
    for i, (ch, g) in enumerate(zip(WORD, placed)):
        b = g.bounds
        boxes[f"{ch}{i}"] = (b[0], b[1], b[2], b[3], ch)
    return {
        "face": face,
        "placed": placed,
        "dots": dots,
        "boxes": boxes,
        "stem": stem,
        "xh": xh,
        "xs": xs,
        "widths": widths,
        "names": names,
    }


def svg_wrap(path_d: str, vb, step: float, small: bool) -> str:
    vx, vy, vw, vh = vb
    if small:
        steps = [(step, SHADOW_MID)]
    else:
        steps = [
            (step * 3, SHADOW_FAR),
            (step * 2, SHADOW_MID),
            (step * 1, SHADOW_NEAR),
        ]
    uses = [
        f'    <use href="#lf-wordmark-face" x="{off:.2f}" y="{off:.2f}" fill="{color}"/>'
        for off, color in steps
    ]
    uses.append(f'    <use href="#lf-wordmark-face" fill="{FACE_INK}"/>')
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="{vx:.2f} {vy:.2f} {vw:.2f} {vh:.2f}"
     fill="none"
     role="img"
     aria-label="lecturesfrom">
  <title>lecturesfrom</title>
  <!-- lecturesfrom outlined from Fraunces (SIL OFL), instance wght 900 SOFT 100 WONK 0 opsz 144.
       Custom: neighbour kiss (1% max), o center dot, rounded serif ends. Skeletons unchanged.
       Dark house: face house-ink #ececec, steps #C8C8C8 / #A8A8A8 / #8A8A8A. -->
  <defs>
    <path id="lf-wordmark-face" d="{path_d}"/>
  </defs>
  <g aria-hidden="true" fill-rule="evenodd">
{chr(10).join(uses)}
  </g>
</svg>
"""


def origin_face(face, boxes):
    minx, miny, maxx, maxy = face.bounds
    face = affinity.translate(face, xoff=-minx, yoff=-miny)
    boxes = {
        k: (a - minx, b - miny, c - minx, d - miny, ch)
        for k, (a, b, c, d, ch) in boxes.items()
    }
    return face, boxes


def write_svg(face, step: float, small: bool, dest: Path) -> tuple[float, float, tuple]:
    face, _ = origin_face(face, {})
    minx, miny, maxx, maxy = face.bounds
    fw, fh = maxx - minx, maxy - miny
    layers = 1 if small else 3
    vb = (0.0, 0.0, fw + step * layers + PAD * 2, fh + step * layers + PAD * 2)
    shifted = affinity.translate(face, xoff=PAD, yoff=PAD)
    dest.write_text(svg_wrap(geom_to_path(shifted), vb, step, small))
    return fw, fh, vb


def main() -> None:
    font = load_instance()
    custom = place_word(font, kiss=True, soften=True, add_dot=True)
    plain = place_word(font, kiss=False, soften=False, add_dot=False)

    custom_face = flip_down(custom["face"])
    plain_face = flip_down(plain["face"])
    custom_boxes = {}
    minx, miny, maxx, maxy = custom["face"].bounds
    # flip boxes into SVG space after flip_down (scale y -1 around 0, then shift)
    flipped_boxes = {}
    for k, (a, b, c, d, ch) in custom["boxes"].items():
        fa, fb = a, -d
        fc, fd = c, -b
        flipped_boxes[k] = (fa, fb, fc, fd, ch)
    custom_face, custom_boxes = origin_face(custom_face, flipped_boxes)

    stem = custom["stem"]
    step = (stem * TOTAL_OFFSET_STEMS) / 3.0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fw, fh, vb_full = write_svg(custom_face, step, False, OUT_DIR / "wordmark-hathaway.svg")
    _, _, vb_sm = write_svg(custom_face, step, True, OUT_DIR / "wordmark-hathaway-sm.svg")

    # Plain Fraunces (metrics as shipped) for the v6 side-by-side proof, not a site asset.
    tmp = Path("/tmp/fraunces")
    tmp.mkdir(parents=True, exist_ok=True)
    write_svg(plain_face, step, False, tmp / "wordmark-fraunces-plain.svg")
    write_svg(custom_face, step, False, tmp / "wordmark-fraunces-custom.svg")

    print("glyphs:", custom["names"])
    print("stem font-units:", round(stem, 2), "xh:", round(custom["xh"], 2))
    print("shadow step font-units:", round(step, 2), "total:", round(step * 3, 2))
    print("face:", round(fw, 2), "x", round(fh, 2))
    print("viewBox full:", tuple(round(v, 2) for v in vb_full))
    scale32 = 32.0 / vb_full[3]
    print("at 32px: stem", round(stem * scale32, 3), "px  step", round(step * scale32, 3),
          "px  total offset", round(step * 3 * scale32, 3), "px")
    print("pair:")
    for i in range(1, len(custom["placed"])):
        a, b = custom["placed"][i - 1], custom["placed"][i]
        inter = a.intersection(b)
        ov = 0.0 if inter.is_empty else inter.area
        dist = a.distance(b)
        aw = a.bounds[2] - a.bounds[0]
        bw = b.bounds[2] - b.bounds[0]
        bbox_ov = a.bounds[2] - b.bounds[0]
        print(
            f"  {WORD[i-1]}{WORD[i]} dist={dist:.3f} ink={ov:.1f} "
            f"bbox%={100 * bbox_ov / max(1, max(aw, bw)):.2f}"
        )
    n_polys = 1 if custom_face.geom_type == "Polygon" else len(custom_face.geoms)
    print("geom:", custom_face.geom_type, "parts:", n_polys)

    Path("/tmp/wordmark-meta.json").write_text(
        json.dumps(
            {
                "stem": stem,
                "xh": custom["xh"],
                "step": step,
                "face_w": fw,
                "face_h": fh,
                "vb_full": vb_full,
                "vb_sm": vb_sm,
                "scale32_stem_px": stem * scale32,
                "scale32_step_px": step * scale32,
                "scale32_total_px": step * 3 * scale32,
                "boxes": {k: list(v) for k, v in custom_boxes.items()},
                "names": custom["names"],
                "instance": INSTANCE,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
