"""Electric moped with a rider in a teal helmet. Map 1's smallest customer. Under 1,500 triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402

NAME = "scooter"


def build():
    c.reset_scene()
    col = c.collection(NAME)
    p = []
    # Wheels along Y.
    for y in (-0.62, 0.62):
        p.append(c.cylinder(f"wheel{y}", 0.26, 0.12, (0, y, 0.26), "tyre", verts=14, rot=(0, 1.5708, 0)))
        p.append(c.cylinder(f"hub{y}", 0.12, 0.13, (0, y, 0.26), "hub", verts=10, rot=(0, 1.5708, 0)))
    # Floorboard and rear body with the seat.
    p.append(c.box("deck", (0.36, 0.9, 0.1), (0, -0.05, 0.38), "teal", bevel=0.04))
    p.append(c.box("rear", (0.42, 0.7, 0.36), (0, -0.45, 0.6), "lime", bevel=0.12, segments=2))
    p.append(c.box("seat", (0.34, 0.6, 0.1), (0, -0.4, 0.82), "tyre", bevel=0.05))
    # Front shield, stem and handlebar.
    p.append(c.box("shield", (0.4, 0.16, 0.62), (0, 0.42, 0.68), "lime", bevel=0.08, segments=2, rot=(-0.25, 0, 0)))
    p.append(c.cylinder("stem", 0.04, 0.5, (0, 0.52, 1.02), "metal", verts=8, rot=(-0.3, 0, 0)))
    p.append(c.cylinder("bar", 0.035, 0.62, (0, 0.58, 1.26), "tyre", verts=8, rot=(0, 1.5708, 0)))
    p.append(c.cylinder("lamp", 0.08, 0.05, (0, 0.6, 1.18), "headlight", verts=10, rot=(1.5708, 0, 0)))
    # Rider: legs, body, arms, head with helmet.
    for sx in (-1, 1):
        p.append(c.box(f"thigh{sx}", (0.13, 0.4, 0.13), (sx * 0.11, -0.15, 0.9), "navy", bevel=0.03, segments=1))
        p.append(c.box(f"shin{sx}", (0.12, 0.12, 0.4), (sx * 0.11, 0.06, 0.62), "navy", bevel=0.03, segments=1))
        p.append(c.box(f"arm{sx}", (0.1, 0.62, 0.1), (sx * 0.22, 0.2, 1.3), "orange", bevel=0.03, segments=1, rot=(-0.08, 0, 0.0)))
    p.append(c.box("torso", (0.36, 0.26, 0.48), (0, -0.25, 1.18), "orange", bevel=0.1, segments=2, rot=(0.15, 0, 0)))
    p.append(c.sphere("head", 0.16, (0, -0.2, 1.58), "skin", segments=10, rings=6))
    p.append(c.sphere("helmet", 0.19, (0, -0.22, 1.63), "teal", segments=10, rings=5, scale=(1, 1.08, 0.85)))
    obj = c.join(p, NAME)
    c.shade_flat(obj)
    c.move_to_collection(obj, col)
    c.check_budget([obj], 1500, NAME)
    return obj


if __name__ == "__main__":
    obj = build()
    if c.wants_preview():
        c.render_preview(NAME, target=(0, 0, 0.8), ortho_scale=2.6)
    c.export_glb(NAME, [obj])
    c.save_blend(NAME)
