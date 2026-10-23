"""Chunky worker character: big head, teal overalls, yellow helmet, tool belt, A-pose.

Rigged with a simple armature (each body part follows one bone) and two actions, Walk and Idle,
so the glTF plays them with three.js AnimationMixer. Under 4,000 triangles. Faces +Y.
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402

NAME = "worker"
FPS = 24

# Bone layout: (name, head, tail, parent)
BONES = [
    ("root", (0, 0, 0), (0, 0.3, 0), None),
    ("hips", (0, 0, 0.62), (0, 0, 0.8), "root"),
    ("spine", (0, 0, 0.8), (0, 0, 1.12), "hips"),
    ("head", (0, 0, 1.12), (0, 0, 1.6), "spine"),
    ("arm.L", (0.27, 0, 1.05), (0.46, 0, 0.66), "spine"),
    ("arm.R", (-0.27, 0, 1.05), (-0.46, 0, 0.66), "spine"),
    ("leg.L", (0.11, 0, 0.62), (0.11, 0, 0.08), "hips"),
    ("leg.R", (-0.11, 0, 0.62), (-0.11, 0, 0.08), "hips"),
]


def bind(obj, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    return obj


def build_mesh():
    p = []
    # Legs and boots.
    for side, sx in (("L", 1), ("R", -1)):
        p.append(bind(c.box(f"leg{side}", (0.16, 0.18, 0.5), (sx * 0.11, 0, 0.37), "teal", bevel=0.05, segments=1), f"leg.{side}"))
        p.append(bind(c.box(f"boot{side}", (0.19, 0.28, 0.13), (sx * 0.11, 0.04, 0.065), "boot", bevel=0.05, segments=1), f"leg.{side}"))
    # Torso: overalls with a bib, belt with pouches.
    p.append(bind(c.box("pelvis", (0.42, 0.26, 0.22), (0, 0, 0.7), "teal", bevel=0.07, segments=2), "hips"))
    p.append(bind(c.box("belt", (0.46, 0.3, 0.08), (0, 0, 0.8), "brown", bevel=0.02, segments=1), "hips"))
    p.append(bind(c.box("pouch", (0.12, 0.08, 0.12), (0.16, 0.16, 0.78), "brown", bevel=0.02, segments=1), "hips"))
    p.append(bind(c.box("hammer", (0.04, 0.04, 0.2), (-0.2, 0.12, 0.76), "metal"), "hips"))
    p.append(bind(c.box("shirt", (0.44, 0.27, 0.34), (0, 0, 0.98), "white", bevel=0.09, segments=2), "spine"))
    p.append(bind(c.box("bib", (0.3, 0.05, 0.24), (0, 0.13, 0.96), "teal", bevel=0.02, segments=1), "spine"))
    for sx in (-1, 1):
        p.append(bind(c.box(f"strap{sx}", (0.06, 0.29, 0.04), (sx * 0.12, 0, 1.13), "teal"), "spine"))
    # Arms in an A-pose with gloved hands.
    for side, sx in (("L", 1), ("R", -1)):
        angle = -sx * math.radians(27)
        arm = c.box(f"arm{side}", (0.13, 0.14, 0.38), (sx * 0.36, 0, 0.86), "white", bevel=0.05, segments=1, rot=(0, angle, 0))
        p.append(bind(arm, f"arm.{side}"))
        p.append(bind(c.sphere(f"hand{side}", 0.08, (sx * 0.46, 0, 0.64), "yellow", segments=8, rings=5), f"arm.{side}"))
    # Big head with a hard hat.
    p.append(bind(c.sphere("head", 0.27, (0, 0, 1.38), "skin", segments=14, rings=9, scale=(1, 0.95, 1)), "head"))
    p.append(bind(c.sphere("hat", 0.3, (0, 0, 1.5), "yellow", segments=14, rings=6, scale=(1, 1, 0.75)), "head"))
    p.append(bind(c.cylinder("brim", 0.33, 0.04, (0, 0.05, 1.46), "yellow", verts=16), "head"))
    for sx in (-1, 1):
        p.append(bind(c.sphere(f"eye{sx}", 0.035, (sx * 0.095, 0.245, 1.38), "tyre", segments=6, rings=4), "head"))
    p.append(bind(c.sphere("nose", 0.045, (0, 0.265, 1.32), "#E8A984", segments=6, rings=4), "head"))
    body = c.join(p, NAME)
    c.shade_flat(body)
    return body


def build_armature():
    arm_data = bpy.data.armatures.new(f"{NAME}_rig")
    rig = bpy.data.objects.new(f"{NAME}_rig", arm_data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    edit = {}
    for name, head, tail, parent in BONES:
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = edit[parent]
        edit[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def key(rig, frame, poses):
    """poses: bone -> (rot_x_degrees, rot_y, rot_z, loc_z)"""
    for bone, (rx, ry, rz, lz) in poses.items():
        pb = rig.pose.bones[bone]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
        pb.location = (0, lz, 0) if bone == "hips" else (0, 0, 0)
        pb.keyframe_insert("rotation_euler", frame=frame)
        if bone == "hips":
            pb.keyframe_insert("location", frame=frame)


def make_action(rig, name, frames):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, poses in frames:
        key(rig, frame, poses)
    # Linear-ish loops: make the curves cycle.
    fcurves = getattr(action, "fcurves", None)
    if fcurves is None:
        # Blender 4.4+ layered actions.
        fcurves = [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
    for fc in fcurves:
        fc.modifiers.new("CYCLES")
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(frames[0][0]), action)
    rig.animation_data.action = None
    return action


def walk(rig):
    swing, arm_swing = 32, 28
    frames = []
    for f, phase in ((1, 1), (7, 0), (13, -1), (19, 0), (25, 1)):
        bob = 0.03 if phase == 0 else 0.0
        frames.append(
            (
                f,
                {
                    "hips": (0, 0, 0, bob),
                    "spine": (4, 0, phase * 4, 0),
                    "head": (-3, 0, -phase * 3, 0),
                    "leg.L": (phase * swing, 0, 0, 0),
                    "leg.R": (-phase * swing, 0, 0, 0),
                    "arm.L": (-phase * arm_swing, 0, 0, 0),
                    "arm.R": (phase * arm_swing, 0, 0, 0),
                },
            )
        )
    return make_action(rig, "Walk", frames)


def idle(rig):
    frames = []
    for f, t in ((1, 0), (25, 1), (49, 0)):
        frames.append(
            (
                f,
                {
                    "hips": (0, 0, 0, -0.012 * t),
                    "spine": (2 * t, 0, 0, 0),
                    "head": (-4 * t, 0, 3 * t, 0),
                    "leg.L": (0, 0, 0, 0),
                    "leg.R": (0, 0, 0, 0),
                    "arm.L": (0, 6 * t, 0, 0),
                    "arm.R": (0, -6 * t, 0, 0),
                },
            )
        )
    return make_action(rig, "Idle", frames)


def build():
    c.reset_scene()
    col = c.collection(NAME)
    body = build_mesh()
    rig = build_armature()
    body.parent = rig
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    bpy.context.scene.render.fps = FPS
    walk(rig)
    idle(rig)
    for obj in (body, rig):
        c.move_to_collection(obj, col)
    c.check_budget([body], 4000, NAME)
    return body, rig


if __name__ == "__main__":
    body, rig = build()
    if c.wants_preview():
        c.render_preview(NAME, target=(0, 0, 0.8), ortho_scale=2.4, azimuth=150)
    c.export_glb(NAME, [body, rig], animations=True)
    c.save_blend(NAME)
