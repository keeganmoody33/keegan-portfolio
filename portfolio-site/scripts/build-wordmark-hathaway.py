#!/usr/bin/env python3
"""Construct a custom lowercase lecturesfrom wordmark as SVG path data.

Letterforms are filled outlines (not offset strokes, not a live font).
Weight and roundness follow Cooper Black / Souvenir Bold as references.
Metrics from the Hathaway brief: stem ~24% of x-height, ascenders ~1.3x,
1–2% neighbour kiss, o-dot as the only flourish.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

XH = 100.0
STEM = 24.0
THIN = 17.0  # bowls where they meet openings / joins
ASC = 130.0
BASE = 130.0
XH_TOP = BASE - XH  # 30
R = STEM / 2.0  # 12
BULB = R * 1.18  # slightly bulbous terminals vs a round-cap stroke
SHADOW_STEP = 4.0
KISS = 1.7  # ~1–2% of a typical bowl width
QUAD = 48

OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "brand"


def disc(cx: float, cy: float, radius: float, segs: int | None = None):
    n = segs or max(20, min(64, int(QUAD * max(1.0, radius / 16.0))))
    return Point(cx, cy).buffer(radius, quad_segs=n)


def round_rect(x0, y0, x1, y1, r):
    r = min(r, (x1 - x0) / 2.0, (y1 - y0) / 2.0)
    if r <= 0:
        return box(x0, y0, x1, y1)
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, join_style="round", quad_segs=28)


def inflate(geom, extra: float = 0.9):
    """Soften boolean joins without turning the shape into a constant-width stroke."""
    return geom.buffer(extra, join_style="round", quad_segs=20).buffer(
        -extra * 0.55, join_style="round", quad_segs=20
    )


def stem_body(x_left: float, y_top: float, y_bot: float, width: float = STEM, *, cap_top: bool = True, cap_bot: bool = True):
    """Filled stem with optional bulbous terminals and a slightly narrower waist."""
    cx = x_left + width / 2.0
    waist = width * 0.88
    top_in = width * (0.22 if cap_top else 0.06)
    bot_in = width * (0.22 if cap_bot else 0.06)
    body = round_rect(
        cx - waist / 2.0,
        y_top + top_in,
        cx + waist / 2.0,
        y_bot - bot_in,
        waist * 0.20,
    )
    parts = [body]
    if cap_top:
        parts.append(disc(cx, y_top + width * 0.50, width * 0.58))
    if cap_bot:
        parts.append(disc(cx, y_bot - width * 0.50, width * 0.58))
    return unary_union(parts)


def pie(cx: float, cy: float, radius: float, a0: float, a1: float, n: int = 36):
    """Wedge in y-down degrees: 0 east, 90 south, 180 west, 270 north."""
    pts = [(cx, cy)]
    span = a1 - a0
    steps = max(12, int(n * abs(span) / 180.0))
    for i in range(steps + 1):
        a = math.radians(a0 + span * i / steps)
        pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return Polygon(pts)


def annulus_sector(cx, cy, r_out, r_in, a0, a1):
    """Filled outline of an arc: outer pie minus inner pie. Radial ends, not round caps."""
    return pie(cx, cy, r_out, a0, a1).difference(pie(cx, cy, r_in, a0, a1))


def teardrop(cx: float, cy: float, radius: float, ang_deg: float, tail: float = 1.35):
    """Soft teardrop terminal: disc + a slightly stretched disc along the spine."""
    a = math.radians(ang_deg)
    blob = disc(cx, cy, radius)
    tail_c = disc(cx - math.cos(a) * radius * 0.35, cy - math.sin(a) * radius * 0.35, radius * 0.82)
    stretch = affinity.scale(disc(cx, cy, radius), xfact=tail, yfact=1.0, origin=(cx, cy))
    stretch = affinity.rotate(stretch, ang_deg, origin=(cx, cy))
    return unary_union([blob, tail_c, stretch])


def terminal_on_arc(cx, cy, spine_r, ang, radius):
    a = math.radians(ang)
    return teardrop(cx + spine_r * math.cos(a), cy + spine_r * math.sin(a), radius, ang)


def clip_y(geom, y0, y1):
    minx, _, maxx, _ = geom.bounds
    return geom.intersection(box(minx - 40, y0, maxx + 40, y1))


def letter_l():
    return inflate(stem_body(0.0, 0.0, BASE, STEM))


def letter_e():
    """Round 70s e: heavy left, open eye, bar locked into the ring walls."""
    cx, cy = 52.0, XH_TOP + XH / 2.0
    r_out = 52.0
    r_in = 33.0
    outer = disc(cx, cy, r_out)
    inner = disc(cx + 4.0, cy - 1.0, r_in)
    ring = outer.difference(inner)
    bar_h = 13.0
    bar_y = cy - 4.0
    # Bar must overlap the ring walls or it floats as a second polygon inside the eye.
    bar = round_rect(cx - r_out + 10.0, bar_y, cx + r_out - 6.0, bar_y + bar_h, bar_h * 0.42)
    return inflate(ring.union(bar), 0.55)


def letter_c():
    cx, cy = 50.0, XH_TOP + XH / 2.0
    r_out = 52.0
    r_in = 52.0 - THIN - 2.0
    # Non-concentric hole: heavy left vertical, lighter toward the opening.
    outer = disc(cx, cy, r_out)
    inner = disc(cx + 4.5, cy + 0.6, r_in)
    ring = outer.difference(inner)
    a0, a1 = 52.0, 308.0
    opening = pie(cx + 2.0, cy, r_out + 18.0, a1 - 360.0, a0)
    body = ring.difference(opening)
    spine = (r_out + r_in) / 2.0
    t_r = 10.6
    # Matching round terminals — same disc at both cuts, no extra stretch lump.
    caps = unary_union(
        [
            disc(cx + spine * math.cos(math.radians(a0)), cy + spine * math.sin(math.radians(a0)), t_r),
            disc(cx + spine * math.cos(math.radians(a1)), cy + spine * math.sin(math.radians(a1)), t_r),
        ]
    )
    return inflate(body.union(caps), 0.45)


def letter_t():
    w = 64.0
    cx = w / 2.0
    stem = stem_body(cx - STEM / 2.0, 0.0, BASE, STEM)
    bar_h = 14.5
    bar = round_rect(1.0, XH_TOP - 1.0, w - 1.0, XH_TOP - 1.0 + bar_h, bar_h * 0.40)
    right_term = disc(w - 8.0, XH_TOP - 1.0 + bar_h / 2.0, 9.2)
    left_term = disc(9.0, XH_TOP - 1.0 + bar_h / 2.0, 8.6)
    return inflate(unary_union([stem, bar, right_term, left_term]), 0.55)


def letter_f():
    """Open Cooper-style f: stem, hook curving right (no enclosed eye), crossbar at x-height.

    A closed oval hook unions with the stem and becomes a loop — that reads as t + blob.
    Keep a gap between hook and crossbar so the underside stays open.
    """
    stem_x = 10.0
    stem = stem_body(stem_x, 5.0, BASE, STEM)

    bar_h = 14.0
    bar_y = XH_TOP
    bar = round_rect(1.0, bar_y, 56.0, bar_y + bar_h, 5.2)
    bar_term = disc(53.5, bar_y + bar_h / 2.0, 8.6)

    # Arc centre in the stem cap; sweep over the top and end to the right.
    hx = stem_x + STEM * 0.20
    hy = 16.5
    r_out, r_in = 20.5, 8.6
    hook = annulus_sector(hx, hy, r_out, r_in, 232.0, 378.0)
    hook = affinity.scale(hook, xfact=1.48, yfact=0.90, origin=(hx, hy))
    spine = (r_out + r_in) / 2.0
    end_ang = 12.0
    hook_term = disc(
        hx + spine * 1.48 * math.cos(math.radians(end_ang)),
        hy + spine * 0.90 * math.sin(math.radians(end_ang)),
        9.8,
    )
    # Hard gap above the crossbar so hook + bar cannot enclose an eye.
    ceiling = bar_y - 4.0
    hook = hook.intersection(box(stem_x - 2.0, -8.0, 90.0, ceiling))
    hook_term = hook_term.intersection(box(stem_x - 2.0, -8.0, 90.0, ceiling + 1.0))
    face = unary_union([stem, bar, bar_term, hook, hook_term])
    return inflate(clip_y(face, -2.0, BASE + 2.0), 0.35)


def letter_u():
    """Inverted n: round trough, two even stems, open at the top."""
    w = 92.0
    g = n_arch(w, 0.0, XH, STEM)
    g = affinity.scale(g, xfact=1.0, yfact=-1.0, origin=(w / 2.0, XH / 2.0))
    g = affinity.translate(g, yoff=XH_TOP)
    return inflate(g, 0.6)


def letter_r():
    stem = stem_body(0.0, XH_TOP, BASE, STEM)
    # Filled ear with an open counter — a small bowl, not a monoline bump.
    ex, ey, r_out = STEM + 10.0, XH_TOP + 24.0, 23.0
    ear = disc(ex, ey, r_out).difference(disc(ex + 3.6, ey + 1.4, 11.8))
    ear = ear.difference(pie(ex, ey, r_out + 10.0, 28.0, 158.0))
    term = disc(
        ex + ((r_out + 11.8) / 2.0) * math.cos(math.radians(22.0)),
        ey + ((r_out + 11.8) / 2.0) * math.sin(math.radians(22.0)),
        9.6,
    )
    shoulder = round_rect(STEM * 0.40, XH_TOP + 2.0, STEM + 16.0, XH_TOP + 15.5, 6.5)
    return inflate(unary_union([stem, ear, term, shoulder]), 0.5)


def letter_s():
    r_out = 30.0
    wall = THIN + 0.5
    r_in = r_out - wall
    u_cx, u_cy = 36.0, XH_TOP + 31.5
    l_cx, l_cy = 50.0, BASE - 31.5
    # Upper bowl opens right; lower bowl opens left. Matching round terminals.
    upper = disc(u_cx, u_cy, r_out).difference(disc(u_cx + 2.4, u_cy, r_in))
    upper = upper.difference(pie(u_cx, u_cy, r_out + 12.0, -44.0, 56.0))
    lower = disc(l_cx, l_cy, r_out).difference(disc(l_cx - 2.4, l_cy, r_in))
    lower = lower.difference(pie(l_cx, l_cy, r_out + 12.0, 136.0, 236.0))
    spine_u = (r_out + r_in) / 2.0
    spine_l = (r_out + r_in) / 2.0
    t_r = 10.8
    caps = [
        disc(u_cx + spine_u * math.cos(math.radians(-44.0)), u_cy + spine_u * math.sin(math.radians(-44.0)), t_r),
        disc(u_cx + spine_u * math.cos(math.radians(56.0)), u_cy + spine_u * math.sin(math.radians(56.0)), t_r),
        disc(l_cx + spine_l * math.cos(math.radians(136.0)), l_cy + spine_l * math.sin(math.radians(136.0)), t_r),
        disc(l_cx + spine_l * math.cos(math.radians(236.0)), l_cy + spine_l * math.sin(math.radians(236.0)), t_r),
    ]
    # Thin waist where the bowls meet — filled connection, no extra blob above x-height.
    waist = disc((u_cx + l_cx) / 2.0, (u_cy + l_cy) / 2.0, 10.2)
    face = unary_union([upper, lower, waist, *caps])
    return inflate(clip_y(face, XH_TOP - 1.5, BASE + 1.5), 0.45)


def letter_o():
    cx, cy = 52.0, XH_TOP + XH / 2.0
    r_out = 52.0
    r_in = 33.0
    ring = disc(cx, cy, r_out).difference(disc(cx + 1.6, cy + 0.8, r_in))
    dot = disc(cx, cy, 10.0)
    return inflate(ring, 0.5), inflate(dot, 0.25)


def n_arch(w: float, y_top: float, y_bot: float, wall: float = STEM):
    """One n: two stems + a full semicircular top (no flat roof). Crown thinner than stems."""
    r_out = w / 2.0
    cx = w / 2.0
    cy = y_top + r_out
    outer = disc(cx, cy, r_out)
    cap = outer.intersection(box(-4.0, y_top - 4.0, w + 4.0, cy + 4.0))
    r_in = r_out - wall + 6.0
    inner = disc(cx, cy + 3.0, r_in)
    arch = cap.difference(inner)
    left = stem_body(0.0, y_top + wall * 0.45, y_bot, wall, cap_top=False, cap_bot=True)
    right = stem_body(w - wall, y_top + wall * 0.45, y_bot, wall, cap_top=False, cap_bot=True)
    hole = box(wall * 0.92, cy - 1.0, w - wall * 0.92, y_bot + 8.0)
    body = unary_union([arch, left, right]).difference(hole)
    feet = unary_union(
        [
            disc(wall / 2.0, y_bot - wall * 0.50, wall * 0.58),
            disc(w - wall / 2.0, y_bot - wall * 0.50, wall * 0.58),
        ]
    )
    return unary_union([body, feet])


def letter_m():
    """Two full, even arches sharing a middle stem. Not rn, not a clipped round-rect."""
    unit = 80.0
    wall = STEM
    left = n_arch(unit, XH_TOP, BASE, wall)
    right = affinity.translate(n_arch(unit, XH_TOP, BASE, wall), xoff=unit - wall)
    return inflate(left.union(right), 0.5)


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


def simplify_face(geom, tol: float = 0.18):
    simple = geom.simplify(tol, preserve_topology=True)
    if simple.is_empty:
        return geom
    return simple


def _ink_overlap(a, b) -> float:
    inter = a.intersection(b)
    if inter.is_empty:
        return 0.0
    return inter.area


def _band(g, y0, y1):
    band = g.intersection(box(-8000.0, y0, 8000.0, y1))
    return band


def place_with_kiss(prev, geom, ch: str, prev_ch: str):
    """Nudge until a 1–2% bowl/baseline kiss. No weld discs. No merged blobs."""
    # Kiss in the x-height band so an f hook / t bar cannot fake a bbox overlap.
    prev_k = _band(prev, XH_TOP + 6.0, BASE - 4.0)
    geom_k = _band(geom, XH_TOP + 6.0, BASE - 4.0)
    if prev_k.is_empty or geom_k.is_empty:
        prev_k, geom_k = prev, geom
    width = geom_k.bounds[2] - geom_k.bounds[0]
    prev_w = prev_k.bounds[2] - prev_k.bounds[0]
    x_flush = prev_k.bounds[2] - geom_k.bounds[0]
    round_pair = prev_ch in "ecos" and ch in "ecos"
    goal_bbox = min(width, prev_w) * (0.010 if round_pair else 0.014)
    goal_bbox = min(max(goal_bbox, 0.9), 2.2 if round_pair else 2.6)
    high_band = box(-4000.0, -80.0, 4000.0, XH_TOP - 0.5)
    best_x = x_flush - goal_bbox
    best_score = 1e9
    max_ink = 6.0 if round_pair else 8.5
    for i in range(-40, 28):
        dx = i * 0.25
        trial = affinity.translate(geom, xoff=x_flush + dx)
        ov = _ink_overlap(prev, trial)
        trial_k = _band(trial, XH_TOP + 6.0, BASE - 4.0)
        bbox_ov = prev_k.bounds[2] - (trial_k.bounds[0] if not trial_k.is_empty else trial.bounds[0])
        high = prev.intersection(trial).intersection(high_band)
        high_a = 0.0 if high.is_empty else high.area
        if prev_ch == "s" and ch == "f" and high_a > 0.5:
            continue
        score = abs(bbox_ov - goal_bbox) + abs(ov - 1.4) * 0.4
        if ov > max_ink:
            score += (ov - max_ink) * 3.0
        if ov < 0.08:
            score += 14.0
        if score < best_score:
            best_score = score
            best_x = x_flush + dx
    return affinity.translate(geom, xoff=best_x)


def build_word(word: str = "lecturesfrom"):
    raw = []
    for ch in word:
        made = MAKERS[ch]()
        if ch == "o":
            raw.append((ch, made[0], made[1]))
        else:
            raw.append((ch, made, None))

    placed_bodies = []
    xs = []
    prev_ch = None
    for i, (ch, geom, _dot) in enumerate(raw):
        minx = geom.bounds[0]
        if not placed_bodies:
            x = -minx
            g = affinity.translate(geom, xoff=x)
        else:
            g = place_with_kiss(placed_bodies[-1], geom, ch, prev_ch)
            x = g.bounds[0] - minx
        placed_bodies.append(g)
        xs.append(x)
        prev_ch = ch

    high_band = box(-4000.0, -80.0, 4000.0, XH_TOP - 0.5)
    for i in range(1, len(placed_bodies)):
        nudge = 0.0
        for _ in range(36):
            ov = placed_bodies[i - 1].intersection(placed_bodies[i])
            area = 0.0 if ov.is_empty else ov.area
            if area >= 0.45:
                break
            trial = affinity.translate(placed_bodies[i], xoff=-0.30)
            high = placed_bodies[i - 1].intersection(trial).intersection(high_band)
            if not high.is_empty and high.area > 0.5:
                break
            if _ink_overlap(placed_bodies[i - 1], trial) > 9.0:
                break
            placed_bodies[i] = trial
            nudge -= 0.30
        if nudge:
            xs[i] += nudge
            for j in range(i + 1, len(placed_bodies)):
                placed_bodies[j] = affinity.translate(placed_bodies[j], xoff=nudge)
                xs[j] += nudge

    dots = []
    boxes = {}
    for i, (ch, geom, dot) in enumerate(raw):
        b = placed_bodies[i].bounds
        boxes[f"{ch}{i}"] = (b[0], b[1], b[2], b[3], ch)
        if dot is not None:
            dots.append(affinity.translate(dot, xoff=xs[i]))

    body = unary_union(placed_bodies)
    face = body.union(unary_union(dots)) if dots else body
    face = simplify_face(face)
    return face, boxes, placed_bodies, dots


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
        uses.append(
            f'    <use href="#lf-wordmark-face" x="{off:.2f}" y="{off:.2f}" fill="{color}"/>'
        )
    uses.append('    <use href="#lf-wordmark-face" fill="#111111"/>')
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="{vx:.2f} {vy:.2f} {vw:.2f} {vh:.2f}"
     fill="none"
     role="img"
     aria-label="lecturesfrom">
  <title>lecturesfrom</title>
  <!-- Custom lowercase lecturesfrom, drawn as filled outline path data (not a live font).
       Cooper Black / Souvenir Bold used only as weight and roundness references.
       Stem ~24% of x-height, ascenders ~1.3×, o center dot, 1–2% neighbour kiss.
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
    face, boxes, bodies, _dots = build_word()
    word = "lecturesfrom"
    print("pair ink:")
    high_band0 = box(-4000.0, -80.0, 4000.0, XH_TOP - 0.5)
    for i in range(1, len(bodies)):
        ov = _ink_overlap(bodies[i - 1], bodies[i])
        high = bodies[i - 1].intersection(bodies[i]).intersection(high_band0)
        high_a = 0.0 if high.is_empty else high.area
        print(f"  {word[i - 1]}{word[i]} ink={ov:.2f} high={high_a:.2f}")

    minx, miny, maxx, maxy = face.bounds
    face = affinity.translate(face, xoff=-minx, yoff=-miny)
    boxes = {
        k: (a - minx, b - miny, c - minx, d - miny, ch)
        for k, (a, b, c, d, ch) in boxes.items()
    }
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
    f_holes = 0
    fx0, fy0, fx1, fy1, _ = boxes["f8"]
    for p in polys:
        for inter in p.interiors:
            xs = [c[0] for c in inter.coords]
            ys = [c[1] for c in inter.coords]
            mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
            if fx0 <= mx <= fx1 and fy0 <= my <= fy1:
                f_holes += 1
    print("f enclosed holes (should be 0):", f_holes)
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
