#!/usr/bin/env python3
"""Construct a custom lowercase lecturesfrom wordmark as SVG path data.

Letterforms are drawn geometrically (not from a font). Weight and roundness
follow Cooper Black / Souvenir Bold as references. Metrics from the Hathaway
brief: stem ~24% of x-height, ascenders ~1.3x, 1–2% neighbour overlap, o-dot.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, unary_union

XH = 100.0
STEM = 24.0
ASC = 130.0
BASE = 130.0
XH_TOP = BASE - XH  # 30
R = STEM / 2.0  # 12
SHADOW_STEP = 4.0  # 4% of x-height
OVERLAP = 0.016  # 1.6% of the wider neighbour; raised if ink does not kiss
QUAD = 64
BOWL_WALL = 20.0

OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "brand"


def disc(cx: float, cy: float, radius: float, segs: int | None = None):
    n = segs or max(24, min(72, int(QUAD * max(1.0, radius / 18.0))))
    return Point(cx, cy).buffer(radius, quad_segs=n)


def capsule(x1: float, y1: float, x2: float, y2: float, radius: float):
    if (x1, y1) == (x2, y2):
        return disc(x1, y1, radius)
    return LineString([(x1, y1), (x2, y2)]).buffer(
        radius, cap_style="round", join_style="round", quad_segs=max(20, QUAD // 2)
    )


def arc_line(cx: float, cy: float, radius: float, a0: float, a1: float, n: int = 40):
    pts = []
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + (a1 - a0) * t)
        pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return LineString(pts)


def fat_arc(cx: float, cy: float, radius: float, a0: float, a1: float, half: float):
    return arc_line(cx, cy, radius, a0, a1).buffer(
        half, cap_style="round", join_style="round", quad_segs=24
    )


def cubic_line(p0, p1, p2, p3, n: int = 48):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return LineString(pts)


def round_rect(x0, y0, x1, y1, r):
    r = min(r, (x1 - x0) / 2.0, (y1 - y0) / 2.0)
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, join_style="round", quad_segs=32)


def puff(geom, extra: float = 0.25):
    return geom.buffer(extra, join_style="round", quad_segs=24).buffer(
        -extra, join_style="round", quad_segs=24
    )


def letter_l():
    cx = R
    return puff(capsule(cx, R, cx, BASE - R, R))


def letter_t():
    w = 58.0
    cx = w / 2.0
    stem = capsule(cx, R, cx, BASE - R, R)
    # Long enough on both sides to kiss c on the left and u on the right.
    bar = capsule(3.0, XH_TOP + 1.5, w - 2.0, XH_TOP + 1.5, 10.5)
    return puff(stem.union(bar))


def letter_f():
    w = 58.0
    cx = 22.0
    stem = capsule(cx, R, cx, BASE - R, R)
    bar = capsule(2.0, XH_TOP + 1.5, w - 1.0, XH_TOP + 1.5, 10.5)
    finial = disc(cx + 10.0, R + 3.0, 10.5)
    return puff(stem.union(bar).union(finial))


def letter_e():
    w = 100.0
    cx, cy = w / 2.0, XH_TOP + XH / 2.0
    ring = disc(cx, cy, XH / 2.0).difference(disc(cx, cy, XH / 2.0 - BOWL_WALL))
    inner = XH / 2.0 - BOWL_WALL
    bar = capsule(cx - inner + 2.0, cy - 2.0, cx + inner - 2.0, cy - 2.0, 6.2)
    return puff(ring.union(bar))


def letter_c():
    cx, cy = 50.0, XH_TOP + XH / 2.0
    spine_r = XH / 2.0 - BOWL_WALL / 2.0
    # Opening on the right; terminals are round from the stroke caps.
    return puff(fat_arc(cx, cy, spine_r, 50.0, 310.0, BOWL_WALL / 2.0))


def letter_u():
    w = 88.0
    r_out = 34.0
    body = round_rect(0.0, XH_TOP, w, BASE, r_out)
    # Hole punches through the top so the U stays open, and sits on the baseline.
    hole = round_rect(STEM, XH_TOP - 18.0, w - STEM, BASE - STEM, r_out - STEM)
    return puff(body.difference(hole))


def letter_r():
    cx = R
    stem = capsule(cx, XH_TOP + R, cx, BASE - R, R)
    ear = disc(cx + 19.0, XH_TOP + 21.5, 17.5)
    shoulder = capsule(cx + 4.0, XH_TOP + 9.0, cx + 18.0, XH_TOP + 15.0, 8.5)
    return puff(stem.union(ear).union(shoulder))


def wedge(cx: float, cy: float, radius: float, a0: float, a1: float):
    pts = [(cx, cy)]
    n = 28
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + radius * math.cos(t), cy + radius * math.sin(t)))
    return Polygon(pts)


def letter_s():
    w = 86.0
    cx = w / 2.0
    r_out = 30.0
    uy, ly = XH_TOP + 30.0, BASE - 30.0
    u_cx, l_cx = cx - 6.0, cx + 6.0
    upper = disc(u_cx, uy, r_out).difference(disc(u_cx, uy, r_out - STEM + 1.5))
    upper = upper.difference(wedge(u_cx, uy, r_out + 10.0, -48.0, 62.0))
    lower = disc(l_cx, ly, r_out).difference(disc(l_cx, ly, r_out - STEM + 1.5))
    lower = lower.difference(wedge(l_cx, ly, r_out + 10.0, 132.0, 242.0))

    def term(cx_, cy_, ang):
        a = math.radians(ang)
        rr = r_out - R
        return disc(cx_ + rr * math.cos(a), cy_ + rr * math.sin(a), R)

    caps = [
        term(u_cx, uy, -48.0),
        term(u_cx, uy, 62.0),
        term(l_cx, ly, 132.0),
        term(l_cx, ly, 242.0),
    ]
    waist = capsule(u_cx + 4.0, uy + 12.0, l_cx - 4.0, ly - 12.0, R)
    return puff(unary_union([upper, lower, waist, *caps]))


def letter_o():
    w = 100.0
    cx, cy = w / 2.0, XH_TOP + XH / 2.0
    ring = disc(cx, cy, XH / 2.0).difference(disc(cx, cy, XH / 2.0 - BOWL_WALL))
    dot = disc(cx, cy, 11.0)
    return puff(ring), puff(dot)


def letter_m():
    w = 128.0
    xs = (R + 1.0, w / 2.0, w - R - 1.0)
    top, bot = XH_TOP + R, BASE - R
    stems = unary_union([capsule(x, top, x, bot, R) for x in xs])
    arches = []
    for a, b in ((xs[0], xs[1]), (xs[1], xs[2])):
        mid = (a + b) / 2.0
        arches.append(capsule(a, top - 1.0, b, top - 1.0, R + 2.0))
        arches.append(disc(mid, top + 2.0, (b - a) / 2.0 * 0.72))
    return puff(stems.union(unary_union(arches)))


MAKERS = {
    "l": letter_l,
    "e": letter_e,
    "c": letter_c,
    "t": letter_t,
    "u": letter_u,
    "r": letter_r,
    "s": letter_s,
    "f": letter_f,
    "o": letter_o,
    "m": letter_m,
}


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


def simplify_face(geom, tol: float = 0.12):
    simple = geom.simplify(tol, preserve_topology=True)
    if simple.is_empty:
        return geom
    return simple


def build_word(word: str = "lecturesfrom"):
    placed_bodies = []
    welds = []
    dots = []
    boxes = {}
    prev_w = None
    prev_maxx = None
    for i, ch in enumerate(word):
        made = MAKERS[ch]()
        if ch == "o":
            geom, dot = made
        else:
            geom, dot = made, None
        minx, _, maxx, _ = geom.bounds
        width = maxx - minx
        if prev_maxx is None:
            x = -minx
            g = affinity.translate(geom, xoff=x, yoff=0.0)
        else:
            overlap = max(width, prev_w) * OVERLAP
            overlap = min(max(overlap, 1.55), max(width, prev_w) * 0.02)
            x = prev_maxx - overlap - minx
            g = affinity.translate(geom, xoff=x, yoff=0.0)
            prev = placed_bodies[-1]
            kiss = g.intersection(prev)
            if kiss.is_empty or kiss.area < 3.5:
                p1, p2 = nearest_points(prev, g)
                mx, my = (p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0
                gap = p1.distance(p2)
                welds.append(disc(mx, my, max(7.2, gap / 2.0 + 5.5)))
        placed_bodies.append(g)
        if dot is not None:
            dots.append(affinity.translate(dot, xoff=x, yoff=0.0))
        b = g.bounds
        boxes[f"{ch}{i}"] = (b[0], b[1], b[2], b[3], ch)
        prev_w = width
        prev_maxx = g.bounds[2]
    body = unary_union(placed_bodies + welds)
    body = body.buffer(0.55, join_style="round", quad_segs=16).buffer(
        -0.40, join_style="round", quad_segs=16
    )
    face = body.union(unary_union(dots)) if dots else body
    face = simplify_face(face)
    return face, boxes


def svg_wrap(path_d: str, vb, small: bool) -> str:
    vx, vy, vw, vh = vb
    if small:
        steps = [(SHADOW_STEP, "#7A7A7A")]
    else:
        steps = [
            (SHADOW_STEP * 3, "#A8A8A8"),
            (SHADOW_STEP * 2, "#7A7A7A"),
            (SHADOW_STEP * 1, "#4A4A4A"),
        ]
    uses = []
    for off, color in steps:
        uses.append(f'    <use href="#lf-wordmark-face" x="{off:.2f}" y="{off:.2f}" fill="{color}"/>')
    uses.append('    <use href="#lf-wordmark-face" fill="#111111"/>')
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="{vx:.2f} {vy:.2f} {vw:.2f} {vh:.2f}"
     fill="none"
     role="img"
     aria-label="lecturesfrom">
  <title>lecturesfrom</title>
  <!-- Custom lowercase lecturesfrom, drawn as path data (not a live font).
       Cooper Black / Souvenir Bold used only as weight and roundness references.
       Stem ~24% of x-height, ascenders ~1.3×, o center dot, 1–2% neighbour overlap.
       Face #111111 with equal 4% down-right shadow steps (print layers, not extrusion). -->
  <defs>
    <path id="lf-wordmark-face" d="{path_d}"/>
  </defs>
  <g aria-hidden="true" fill-rule="evenodd">
{chr(10).join(uses)}
  </g>
</svg>
"""


def main() -> None:
    face, boxes = build_word()
    minx, miny, maxx, maxy = face.bounds
    face = affinity.translate(face, xoff=-minx, yoff=-miny)
    boxes = {k: (a - minx, b - miny, c - minx, d - miny, ch) for k, (a, b, c, d, ch) in boxes.items()}
    minx, miny, maxx, maxy = face.bounds
    pad = 2.0
    face_w, face_h = maxx - minx, maxy - miny
    vb_full = (0.0, 0.0, face_w + SHADOW_STEP * 3 + pad * 2, face_h + SHADOW_STEP * 3 + pad * 2)
    vb_sm = (0.0, 0.0, face_w + SHADOW_STEP + pad * 2, face_h + SHADOW_STEP + pad * 2)
    path_d = geom_to_path(face)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "wordmark-hathaway.svg").write_text(svg_wrap(path_d, vb_full, small=False))
    (OUT_DIR / "wordmark-hathaway-sm.svg").write_text(svg_wrap(path_d, vb_sm, small=True))

    n_polys = 1 if face.geom_type == "Polygon" else len(face.geoms)
    print("geom:", face.geom_type, "parts:", n_polys)
    print("face size:", round(face_w, 2), "x", round(face_h, 2))
    print("viewBox full:", tuple(round(v, 2) for v in vb_full))
    print("path chars:", len(path_d), "M", path_d.count("M"), "Z", path_d.count("Z"))
    holes = 0
    polys = [face] if face.geom_type == "Polygon" else list(face.geoms)
    for p in polys:
        holes += len(p.interiors)
    print("holes:", holes)
    print("letter boxes (minx maxx):")
    items = list(boxes.items())
    for i, (k, v) in enumerate(items):
        gap = ""
        if i:
            prev = items[i - 1][1]
            ov = prev[2] - v[0]
            gap = f" overlap={ov:.2f} ({100 * ov / max(1, prev[2] - prev[0]):.1f}% of prev)"
        print(f"  {k:4} {v[0]:7.2f}..{v[2]:7.2f}  y {v[1]:6.2f}..{v[3]:6.2f}{gap}")

    Path("/tmp/wordmark-meta.json").write_text(
        json.dumps(
            {
                "face_w": face_w,
                "face_h": face_h,
                "vb_full": vb_full,
                "vb_sm": vb_sm,
                "xh": XH,
                "stem": STEM,
                "n_polys": n_polys,
                "holes": holes,
                "boxes": {k: list(v) for k, v in boxes.items()},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
