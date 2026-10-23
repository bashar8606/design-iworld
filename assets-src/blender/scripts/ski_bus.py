"""Electric ski shuttle: a tall rounded minibus in sky blue and white with a wide window band,
an orange stripe and skis on a roof rack. Under 3,000 triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402
from vehicle import charge_port, finish, lights, wheels  # noqa: E402

L, W = 5.6, 2.05
CLEAR = 0.28
SKI_COLOURS = ["orange", "taillight", "lime", "yellow"]


def build():
    c.reset_scene()
    parts = []
    body_h = 1.25
    parts.append(c.box("lower", (W, L, body_h), (0, 0, CLEAR + body_h / 2), "sky", bevel=0.2, segments=3))
    # Window band and the white roof above it; the front slopes back a little.
    win = c.box("windows", (W * 0.98, L * 0.97, 0.7), (0, 0.02, CLEAR + body_h + 0.33), "glass")
    c.taper_top(win, factor_x=0.97, factor_y=0.96, shift_y=-0.08)
    parts.append(win)
    parts.append(c.box("roof", (W * 0.96, L * 0.92, 0.22), (0, -0.08, CLEAR + body_h + 0.76), "white", bevel=0.1, segments=2))
    # Pillars between the side windows.
    for i in range(4):
        y = -L / 2 + 1.0 + i * 1.2
        for sx in (-1, 1):
            parts.append(c.box(f"pillar{sx}{i}", (0.04, 0.12, 0.66), (sx * W * 0.49, y, CLEAR + body_h + 0.33), "white"))
    for sx in (-1, 1):
        parts.append(c.box(f"stripe{sx}", (0.03, L * 0.86, 0.16), (sx * (W / 2 + 0.005), 0, CLEAR + 0.62), "orange"))
    parts.append(c.box("bumper", (W + 0.04, 0.18, 0.24), (0, L / 2 - 0.02, CLEAR + 0.2), "navy", bevel=0.06, segments=1))
    parts.append(c.box("rearbumper", (W + 0.04, 0.18, 0.24), (0, -L / 2 + 0.02, CLEAR + 0.2), "navy", bevel=0.06, segments=1))
    # Roof rack with four pairs of skis.
    top = CLEAR + body_h + 0.88
    for y in (-1.3, 1.3):
        parts.append(c.box(f"rack{y}", (W * 0.86, 0.08, 0.08), (0, y, top), "metal"))
    for i, col in enumerate(SKI_COLOURS):
        x = -0.6 + i * 0.4
        for dx in (-0.06, 0.06):
            parts.append(c.box(f"ski{i}{dx}", (0.08, 3.4, 0.04), (x + dx, 0, top + 0.07), col))
    parts += wheels(L, W, axles=(L / 2 - 1.0, -L / 2 + 1.05), radius=0.42)
    parts += lights(L, W, z_head=CLEAR + 0.6, z_tail=CLEAR + 0.75)
    parts += charge_port(L, W, y=L / 2 - 1.3, z=CLEAR + 0.95, body="sky")
    return finish("ski_bus", parts, 3000, L)


if __name__ == "__main__":
    build()
