"""Stylized electric hatchback: cream-white body, teal side stripe, round headlights. Under 3,000 triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from car import run  # noqa: E402

SPEC = {
    "length": 3.8,
    "width": 1.75,
    "body": "cream",
    "stripe": "teal",
    "body_height": 0.6,
    "body_bevel": 0.24,
    "clearance": 0.26,
    "cabin_length": 2.55,
    "cabin_height": 0.62,
    "cabin_offset": -0.52,
    "cabin_taper": 0.8,
    "cabin_shift": -0.1,
    "headlight_radius": 0.19,
    "wheel_radius": 0.38,
    "wheel_inset": 0.7,
    "limit": 3000,
}

if __name__ == "__main__":
    run("hatchback", SPEC)
