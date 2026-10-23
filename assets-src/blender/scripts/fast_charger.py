"""Tall DC fast-charging post: curved screen, lime light strip, thick looped cable. Under 1,500 triangles.
Origin at the base, front (screen) facing -X."""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402

NAME = "fast_charger"


def cable_loop():
    """A thick cable hanging from the side holster in a loop, as a bevelled curve."""
    curve = bpy.data.curves.new("cable", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.045
    curve.bevel_resolution = 1
    curve.resolution_u = 6
    spline = curve.splines.new("BEZIER")
    pts = [(-0.05, 0.36, 1.25), (-0.35, 0.55, 0.55), (-0.15, 0.4, 0.2), (0.05, 0.3, 0.75)]
    spline.bezier_points.add(len(pts) - 1)
    for bp, co in zip(spline.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("cable", curve)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    return c.paint(obj, "tyre")


def build():
    c.reset_scene()
    col = c.collection(NAME)
    p = []
    p.append(c.box("plinth", (0.8, 0.8, 0.12), (0, 0, 0.06), "#D6D2C4", bevel=0.03))
    p.append(c.box("post", (0.48, 0.62, 2.0), (0, 0, 1.1), "white", bevel=0.12, segments=2))
    p.append(c.box("cap", (0.56, 0.7, 0.12), (0, 0, 2.14), "navy", bevel=0.05))
    # Curved screen: a slice of a cylinder on the front face.
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.6, depth=0.5, location=(0.33, 0, 1.55), rotation=(math.pi / 2, 0, 0))
    screen = bpy.context.active_object
    me = screen.data
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(me)
    # Keep only the faces on the -X side (the front arc).
    for f in list(bm.faces):
        if f.calc_center_median().x > -0.45:
            bm.faces.remove(f)
    bm.to_mesh(me)
    bm.free()
    c._finish(screen, "screen", "screen")
    p.append(screen)
    p.append(c.box("strip", (0.04, 0.08, 1.3), (-0.25, 0, 0.9), "lime"))
    p.append(c.box("holster", (0.12, 0.16, 0.22), (-0.05, 0.36, 1.25), "teal", bevel=0.03))
    p.append(cable_loop())
    obj = c.join(p, NAME)
    c.shade_flat(obj)
    c.move_to_collection(obj, col)
    c.check_budget([obj], 1500, NAME)
    return obj


if __name__ == "__main__":
    obj = build()
    if c.wants_preview():
        c.render_preview(NAME, target=(0, 0, 1.1), ortho_scale=3.0, azimuth=-60)
    c.export_glb(NAME, [obj])
    c.save_blend(NAME)
