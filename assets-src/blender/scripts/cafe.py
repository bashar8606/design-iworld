"""Shipping-container café: white with a teal and white striped awning, a serving window, two stools.
Under 2,500 triangles. Origin at the centre of the footprint, serving side facing -X."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402

NAME = "cafe"


def build():
    c.reset_scene()
    col = c.collection(NAME)
    p = []
    L, W, H = 5.2, 2.4, 2.5
    p.append(c.box("container", (W, L, H), (0, 0, H / 2 + 0.1), "white", bevel=0.05))
    p.append(c.box("base", (W + 0.1, L + 0.1, 0.12), (0, 0, 0.06), "metal"))
    # Corrugated ribs on the long sides.
    for side in (-1, 1):
        for i in range(9):
            y = -L / 2 + 0.45 + i * (L - 0.9) / 8
            if side == -1 and -1.2 < y < 1.2:
                continue
            p.append(c.box(f"rib{side}{i}", (0.06, 0.08, H - 0.3), (side * (W / 2 + 0.02), y, H / 2 + 0.1), "#E3E6E2"))
    # Serving window, counter and menu board on the -X side.
    p.append(c.box("window", (0.06, 2.2, 1.0), (-W / 2 - 0.01, 0, 1.55), "glass"))
    p.append(c.box("counter", (0.5, 2.4, 0.08), (-W / 2 - 0.2, 0, 1.02), "wood", bevel=0.02))
    p.append(c.box("board", (0.04, 0.9, 0.6), (-W / 2 - 0.03, -1.9, 1.55), "teal", bevel=0.02))
    # Striped awning sloping out over the window.
    stripes = 8
    for i in range(stripes):
        y = -1.4 + (i + 0.5) * 2.8 / stripes
        p.append(
            c.box(f"awning{i}", (1.3, 2.8 / stripes, 0.05), (-W / 2 - 0.55, y, 2.35), "teal" if i % 2 == 0 else "white", rot=(0, -0.38, 0))
        )
    p.append(c.box("valance", (0.04, 2.8, 0.2), (-W / 2 - 1.15, 0, 2.02), "teal"))
    # Two stools.
    for y in (-0.6, 0.6):
        p.append(c.cylinder(f"leg{y}", 0.05, 0.7, (-W / 2 - 0.8, y, 0.35), "metal", verts=8))
        p.append(c.cylinder(f"seat{y}", 0.22, 0.08, (-W / 2 - 0.8, y, 0.74), "orange", verts=12))
    # Rooftop sign blank and a little coffee cup.
    p.append(c.box("roofsign", (0.15, 2.0, 0.5), (0, 0, H + 0.45), "teal", bevel=0.05))
    p.append(c.cylinder("cup", 0.22, 0.4, (0, 1.35, H + 0.38), "white", verts=12))
    p.append(c.cylinder("lid", 0.24, 0.06, (0, 1.35, H + 0.61), "brown", verts=12))
    obj = c.join(p, NAME)
    c.shade_flat(obj)
    c.move_to_collection(obj, col)
    c.check_budget([obj], 2500, NAME)
    return obj


if __name__ == "__main__":
    obj = build()
    if c.wants_preview():
        c.render_preview(NAME, target=(0, 0, 1.3), ortho_scale=7.0, azimuth=-60)
    c.export_glb(NAME, [obj])
    c.save_blend(NAME)
