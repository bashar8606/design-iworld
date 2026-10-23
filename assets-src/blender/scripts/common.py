"""Shared helpers for the Solar Oasis Blender build scripts.

Every asset is built from bevelled primitives, coloured with vertex colours on one shared
material (one draw call per model), and exported as a glTF binary with +Y up.

Run a script headless with Blender:   blender -b -P assets-src/blender/scripts/hatchback.py
or with the bpy module:               python assets-src/blender/scripts/hatchback.py
"""

import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
EXPORT_DIR = os.path.join(ROOT, "assets-src", "export")
BLEND_DIR = os.path.join(ROOT, "assets-src", "blender")
PREVIEW_DIR = os.path.join(ROOT, "assets-src", "previews")

# Palette from the build plan (sRGB hex). Adjust against the style frame.
PALETTE = {
    "sand": "#E9D8B4",
    "sky": "#8FC8F0",
    "navy": "#1E3557",
    "teal": "#19B5A5",
    "lime": "#A6E22E",
    "cream": "#F3EEDF",
    "white": "#F7F7F2",
    "glass": "#22303C",
    "tyre": "#2B2B2E",
    "hub": "#BFC6CC",
    "headlight": "#FFF4C2",
    "taillight": "#E5484D",
    "yellow": "#F7C948",
    "orange": "#F29E4C",
    "skin": "#F2C6A0",
    "brown": "#7A5230",
    "boot": "#3A3A3F",
    "metal": "#9AA3AB",
    "screen": "#123B4A",
    "wood": "#C99A6B",
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def color(name_or_hex):
    h = PALETTE.get(name_or_hex, name_or_hex).lstrip("#")
    rgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[srgb_to_linear(c) for c in rgb], 1.0)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


_material = None


def palette_material():
    """One material for everything: base colour from the vertex colour attribute."""
    global _material
    if _material and _material.name in bpy.data.materials:
        return _material
    mat = bpy.data.materials.new("SolarOasisPalette")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.65
    bsdf.inputs["Metallic"].default_value = 0.0
    _material = mat
    return mat


def paint(obj, col):
    """Fills an object's vertex colour attribute with one colour."""
    mesh = obj.data
    if "Col" not in mesh.color_attributes:
        mesh.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    attr = mesh.color_attributes["Col"]
    value = color(col)
    for item in attr.data:
        item.color = value
    if not mesh.materials:
        mesh.materials.append(palette_material())
    return obj


def _finish(obj, name, col, bevel=0.0, segments=2):
    obj.name = name
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        apply_modifiers(obj)
    paint(obj, col)
    return obj


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, size, loc, col, bevel=0.0, segments=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, col, bevel, segments)


def cylinder(name, radius, depth, loc, col, verts=12, rot=(0, 0, 0), bevel=0.0, segments=1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, name, col, bevel, segments)


def sphere(name, radius, loc, col, segments=12, rings=8, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, col)


def cone(name, r1, r2, depth, loc, col, verts=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, name, col)


def taper_top(obj, factor_x=1.0, factor_y=1.0, shift_y=0.0):
    """Scales the top half of a mesh, e.g. to slope a car cabin."""
    me = obj.data
    zs = [v.co.z for v in me.vertices]
    mid = (max(zs) + min(zs)) / 2
    for v in me.vertices:
        if v.co.z > mid:
            v.co.x *= factor_x
            v.co.y = v.co.y * factor_y + shift_y
    me.update()
    return obj


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    return obj


def shade_flat(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False


def collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def move_to_collection(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)


def triangle_count(objects):
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        for poly in obj.data.polygons:
            total += len(poly.vertices) - 2
    return total


def check_budget(objects, limit, name):
    tris = triangle_count(objects)
    print(f"[{name}] {tris} triangles (limit {limit})")
    if tris > limit:
        raise SystemExit(f"{name}: {tris} triangles is over the {limit} limit")
    return tris


def export_glb(name, objects, animations=False):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    path = os.path.join(EXPORT_DIR, f"{name}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=animations,
        export_vertex_color="ACTIVE",
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        kwargs.pop("export_vertex_color")
        bpy.ops.export_scene.gltf(**kwargs)
    print(f"[{name}] exported {os.path.relpath(path, ROOT)}")
    return path


def save_blend(name):
    os.makedirs(BLEND_DIR, exist_ok=True)
    path = os.path.join(BLEND_DIR, f"{name}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f"[{name}] saved {os.path.relpath(path, ROOT)}")


def render_preview(name, target=(0, 0, 0.6), distance=9.0, ortho_scale=6.0, size=512, azimuth=45):
    """Renders the model from the game camera: orthographic, 35 degrees down, `azimuth` degrees round."""
    scene = bpy.context.scene
    elev = math.radians(35)
    azim = math.radians(azimuth)
    loc = Vector(target) + Vector(
        (distance * math.cos(elev) * math.sin(azim), -distance * math.cos(elev) * math.cos(azim), distance * math.sin(elev))
    )
    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    direction = Vector(target) - loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    sun_data = bpy.data.lights.new("PreviewSun", "SUN")
    sun_data.energy = 3.5
    sun = bpy.data.objects.new("PreviewSun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-60))

    world = bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = color("#CFE7F3")
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[{name}] preview {os.path.relpath(scene.render.filepath, ROOT)}")
    # Keep the preview rig out of the export and the .blend.
    for obj in (cam, sun):
        bpy.data.objects.remove(obj, do_unlink=True)


def wants_preview():
    return "--no-preview" not in sys.argv
