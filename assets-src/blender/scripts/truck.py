"""Electric box truck for the ski lodge: a rounded white cab, a big cargo box with a teal band
and a lightning-bolt panel, dual rear wheels. Under 3,000 triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402
from vehicle import charge_port, finish, lights, wheels  # noqa: E402

L, W = 5.4, 2.1
CLEAR = 0.3


def build():
    c.reset_scene()
    parts = []
    cab_l = 1.7
    cab_y = L / 2 - cab_l / 2
    box_l = L - cab_l - 0.1
    box_y = -L / 2 + box_l / 2
    # Chassis rail under everything.
    parts.append(c.box("chassis", (W * 0.8, L - 0.3, 0.25), (0, 0, CLEAR + 0.12), "boot", bevel=0.04, segments=1))
    # Cab: lower body, glass, roof cap.
    parts.append(c.box("cab", (W, cab_l, 1.05), (0, cab_y, CLEAR + 0.6), "white", bevel=0.18, segments=3))
    glass = c.box("windscreen", (W * 0.9, cab_l * 0.8, 0.62), (0, cab_y + 0.05, CLEAR + 1.4), "glass")
    c.taper_top(glass, factor_x=0.94, factor_y=0.78, shift_y=-0.12)
    parts.append(glass)
    parts.append(c.box("cabroof", (W * 0.94, cab_l * 0.66, 0.12), (0, cab_y - 0.12, CLEAR + 1.74), "white", bevel=0.05, segments=1))
    parts.append(c.box("bumper", (W + 0.04, 0.2, 0.22), (0, L / 2 - 0.02, CLEAR + 0.2), "navy", bevel=0.06, segments=1))
    # Cargo box.
    box_h = 2.05
    parts.append(c.box("cargo", (W + 0.06, box_l, box_h), (0, box_y, CLEAR + 0.32 + box_h / 2), "cream", bevel=0.08, segments=2))
    for sx in (-1, 1):
        parts.append(c.box(f"band{sx}", (0.03, box_l * 0.96, 0.34), (sx * (W / 2 + 0.035), box_y, CLEAR + 0.95), "teal"))
        parts.append(c.box(f"logo{sx}", (0.03, 0.9, 0.9), (sx * (W / 2 + 0.04), box_y + 0.4, CLEAR + 1.75), "yellow", bevel=0.1, segments=1))
        # A bolt on the logo panel.
        parts.append(c.box(f"bolt{sx}", (0.03, 0.16, 0.6), (sx * (W / 2 + 0.06), box_y + 0.4, CLEAR + 1.75), "navy", rot=(0.45, 0, 0)))
    parts.append(c.box("rearbar", (W, 0.12, 0.16), (0, -L / 2 + 0.02, CLEAR + 0.25), "navy"))
    parts += wheels(L, W, axles=(L / 2 - 0.85, -L / 2 + 1.0, -L / 2 + 1.75), radius=0.44)
    parts += lights(L, W, z_head=CLEAR + 0.55, z_tail=CLEAR + 0.6)
    parts += charge_port(L, W, y=cab_y - 0.55, z=CLEAR + 0.75, body="white")
    return finish("truck", parts, 3000, L)


if __name__ == "__main__":
    build()
