"""Parametric low-poly car used by hatchback.py, sedan.py and taxi.py.

Real-world scale in metres, origin at the centre of the ground contact, facing +Y.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402


def build_car(name, spec):
    c.reset_scene()
    col = c.collection(name)
    L, W = spec["length"], spec["width"]
    body_h = spec.get("body_height", 0.62)
    clearance = spec.get("clearance", 0.24)
    wheel_r = spec.get("wheel_radius", 0.34)
    parts = []

    # Lower body, two tones for the taxi.
    body = c.box("body", (W, L, body_h), (0, 0, clearance + body_h / 2), spec["body"], bevel=spec.get("body_bevel", 0.16), segments=3)
    parts.append(body)
    if spec.get("lower"):
        parts.append(c.box("skirt", (W + 0.02, L - 0.5, 0.18), (0, 0, clearance + 0.09), spec["lower"], bevel=0.05, segments=1))

    # Cabin: a bevelled box with its top pulled in to a rounded glasshouse.
    cab_l = spec["cabin_length"]
    cab_h = spec.get("cabin_height", 0.55)
    cab = c.box(
        "cabin",
        (W * 0.86, cab_l, cab_h),
        (0, spec.get("cabin_offset", -0.15), clearance + body_h + cab_h / 2 - 0.04),
        spec.get("glass", "glass"),
        bevel=0.0,
    )
    c.taper_top(cab, factor_x=0.86, factor_y=spec.get("cabin_taper", 0.72), shift_y=spec.get("cabin_shift", -0.05))
    mod = cab.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.12
    mod.segments = 2
    c.apply_modifiers(cab)
    c.paint(cab, spec.get("glass", "glass"))
    parts.append(cab)

    # Roof panel in body colour over the glass (hatchback / taxi), or a dark glass roof (sedan).
    roof_col = spec.get("roof", spec["body"])
    roof = c.box(
        "roof",
        (W * 0.62, cab_l * spec.get("cabin_taper", 0.72) * 0.8, 0.07),
        (0, spec.get("cabin_offset", -0.15) + spec.get("cabin_shift", -0.05), clearance + body_h + cab_h - 0.02),
        roof_col,
        bevel=0.035,
        segments=1,
    )
    parts.append(roof)

    # Side stripe.
    if spec.get("stripe"):
        for sx in (-1, 1):
            parts.append(
                c.box(f"stripe{sx}", (0.03, L * 0.78, 0.12), (sx * (W / 2 + 0.005), 0, clearance + body_h * 0.55), spec["stripe"])
            )

    # Wheels with hubcaps.
    wy = L / 2 - spec.get("wheel_inset", 0.78)
    for sx in (-1, 1):
        for sy in (-1, 1):
            loc = (sx * (W / 2 - 0.12), sy * wy, wheel_r)
            parts.append(c.cylinder(f"wheel{sx}{sy}", wheel_r, 0.26, loc, "tyre", verts=14, rot=(0, 1.5708, 0)))
            cap_r = wheel_r * (0.8 if spec.get("wheel_covers") else 0.45)
            parts.append(
                c.cylinder(
                    f"hub{sx}{sy}", cap_r, 0.04, (sx * (W / 2 - 0.12 + 0.13), sy * wy, wheel_r), spec.get("hub", "hub"), verts=10, rot=(0, 1.5708, 0)
                )
            )

    # Big round headlights and small tail lights.
    hl = spec.get("headlight_radius", 0.17)
    for sx in (-1, 1):
        parts.append(
            c.cylinder(f"headlight{sx}", hl, 0.06, (sx * W * 0.3, L / 2 - 0.02, clearance + body_h * 0.62), "headlight", verts=12, rot=(1.5708, 0, 0))
        )
        parts.append(c.box(f"tail{sx}", (0.3, 0.04, 0.1), (sx * W * 0.32, -L / 2 + 0.01, clearance + body_h * 0.7), "taillight"))

    # Charging-port flap just behind the left front wheel, open, so it faces the charger when parked nose-in.
    port_y = L / 2 - 1.25
    parts.append(c.box("port", (0.04, 0.22, 0.18), (-W / 2 - 0.01, port_y, clearance + body_h * 0.8), "teal"))
    parts.append(c.box("flap", (0.2, 0.02, 0.18), (-W / 2 - 0.12, port_y + 0.12, clearance + body_h * 0.8), spec["body"]))

    for extra in spec.get("extras", []):
        parts.append(extra())

    car = c.join(parts, name)
    c.shade_flat(car)
    c.move_to_collection(car, col)
    c.check_budget([car], spec["limit"], name)
    return car


def run(name, spec):
    car = build_car(name, spec)
    if c.wants_preview():
        c.render_preview(name, target=(0, 0, 0.7), ortho_scale=spec["length"] * 1.35)
    c.export_glb(name, [car])
    c.save_blend(name)
