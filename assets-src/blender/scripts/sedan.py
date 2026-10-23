"""Sleek compact electric sedan: sky-blue body, dark glass roof, smooth wheel covers. Under 3,000 triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from car import run  # noqa: E402

SPEC = {
    "length": 4.6,
    "width": 1.85,
    "body": "sky",
    "roof": "glass",
    "body_height": 0.56,
    "clearance": 0.22,
    "cabin_length": 2.6,
    "cabin_height": 0.5,
    "cabin_offset": -0.2,
    "cabin_taper": 0.66,
    "cabin_shift": -0.1,
    "headlight_radius": 0.13,
    "wheel_radius": 0.34,
    "wheel_inset": 0.85,
    "wheel_covers": True,
    "hub": "#E4ECF2",
    "limit": 3000,
}

if __name__ == "__main__":
    run("sedan", SPEC)
