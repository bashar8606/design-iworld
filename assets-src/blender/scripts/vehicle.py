"""Shared pieces for the big vehicles (truck.py, ski_bus.py): wheels, lights and the charge port.

Real-world scale in metres, origin at the centre of the ground contact, facing +Y.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402


def wheels(L, W, axles, radius=0.44, width=0.32):
    """Four or six wheels with hubcaps; `axles` are y positions."""
    parts = []
    for y in axles:
        for sx in (-1, 1):
            x = sx * (W / 2 - 0.14)
            parts.append(c.cylinder(f"wheel{sx}{y}", radius, width, (x, y, radius), "tyre", verts=14, rot=(0, 1.5708, 0)))
            parts.append(c.cylinder(f"hub{sx}{y}", radius * 0.48, 0.04, (x + sx * 0.16, y, radius), "hub", verts=10, rot=(0, 1.5708, 0)))
    return parts


def lights(L, W, z_head, z_tail, head_r=0.16):
    parts = []
    for sx in (-1, 1):
        parts.append(c.cylinder(f"headlight{sx}", head_r, 0.06, (sx * W * 0.33, L / 2 + 0.01, z_head), "headlight", verts=12, rot=(1.5708, 0, 0)))
        parts.append(c.box(f"tail{sx}", (0.32, 0.04, 0.14), (sx * W * 0.36, -L / 2 - 0.01, z_tail), "taillight"))
    return parts


def charge_port(L, W, y, z, body):
    """Open charging flap on the left side, like the cars."""
    return [
        c.box("port", (0.04, 0.24, 0.2), (-W / 2 - 0.01, y, z), "teal"),
        c.box("flap", (0.2, 0.02, 0.2), (-W / 2 - 0.12, y + 0.13, z), body),
    ]


def finish(name, parts, limit, length):
    obj = c.join(parts, name)
    c.shade_flat(obj)
    c.move_to_collection(obj, c.collection(name))
    c.check_budget([obj], limit, name)
    if c.wants_preview():
        c.render_preview(name, target=(0, 0, 1.0), ortho_scale=length * 1.35)
    c.export_glb(name, [obj])
    c.save_blend(name)
    return obj
