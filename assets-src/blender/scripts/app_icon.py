"""Placeholder app icon (until the Magnific icon from Phase 8): the hatchback plugged into a
charger in front of a big sun and a solar row, rendered at 1024 x 1024 with no transparency.

Writes ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402

OUT = os.path.join(c.ROOT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")


def build():
    c.reset_scene()
    # The hatchback from its export, turned three-quarters to the camera.
    bpy.ops.import_scene.gltf(filepath=os.path.join(c.EXPORT_DIR, "hatchback.glb"))
    car = [o for o in bpy.context.selected_objects if o.type == "MESH"][0]
    # The glTF importer already turns +Y-up into Blender's Z-up; face the car toward the camera.
    car.rotation_mode = "XYZ"
    car.rotation_euler = (0, 0, math.radians(-145))
    car.location = (0.3, -0.3, 0)
    car.scale = (1.15, 1.15, 1.15)

    # A solar row behind it.
    for i in range(4):
        panel = c.box(f"panel{i}", (1.5, 0.9, 0.06), (-2.6 + i * 1.6, 2.6, 1.2), "navy", rot=(math.radians(-25), 0, 0))
        c.box(f"grid{i}", (0.02, 0.92, 0.07), (-2.6 + i * 1.6, 2.6, 1.21), "#8FC8F0", rot=(math.radians(-25), 0, 0))
        c.cylinder(f"leg{i}", 0.05, 1.2, (-2.6 + i * 1.6, 2.7, 0.6), "metal", verts=8)
        del panel

    # Charger post and a cable looping to the car.
    c.box("post", (0.55, 0.5, 2.1), (2.3, 1.0, 1.05), "white", bevel=0.12, segments=2)
    c.box("postcap", (0.62, 0.56, 0.14), (2.3, 1.0, 2.15), "teal")
    c.box("strip", (0.08, 0.52, 1.3), (2.0, 1.0, 1.1), "lime")
    curve = bpy.data.curves.new("cable", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.07
    spline = curve.splines.new("BEZIER")
    pts = [(2.02, 0.85, 1.4), (1.75, 0.2, 0.25), (1.2, 0.35, 0.85)]
    spline.bezier_points.add(len(pts) - 1)
    for bp, co in zip(spline.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cable = bpy.data.objects.new("cable", curve)
    bpy.context.scene.collection.objects.link(cable)
    mat = bpy.data.materials.new("cable")
    mat.diffuse_color = c.color("tyre")
    cable.data.materials.append(mat)

    # Ground disc of sand.
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=6, depth=0.1, location=(0, 0, -0.05))
    c.paint(bpy.context.active_object, "sand")

    # Big sun disc behind everything (emissive).
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=2.4, fill_type="NGON", location=(-2.2, 7, 3.6), rotation=(math.radians(80), 0, math.radians(-30)))
    sun = bpy.context.active_object
    # Face the camera so the disc stays round.
    sun.rotation_euler = (Vector((4.6, -7.2, 3.6)) - sun.location).to_track_quat("Z", "Y").to_euler()
    sun_mat = bpy.data.materials.new("sun")
    sun_mat.use_nodes = True
    nodes = sun_mat.node_tree.nodes
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = c.color("#FFD36E")
    em.inputs["Strength"].default_value = 1.6
    sun_mat.node_tree.links.new(em.outputs[0], out.inputs[0])
    sun.data.materials.append(sun_mat)


def render():
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("IconCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("IconCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (4.6, -7.2, 3.6)
    cam.rotation_euler = (Vector((0.0, 0.9, 1.35)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
    sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-40))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("IconWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = c.color("#7DBDEB")
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print(f"[app_icon] {os.path.relpath(OUT, c.ROOT)}")


if __name__ == "__main__":
    build()
    render()
