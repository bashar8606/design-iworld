"""Boxy electric city taxi, built from the sedan: sunny yellow and white, blank rounded roof sign."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import common as c  # noqa: E402
from car import run  # noqa: E402
from sedan import SPEC as SEDAN  # noqa: E402


def roof_sign():
    return c.box("sign", (0.7, 0.32, 0.24), (0, -0.3, 1.58), "white", bevel=0.09, segments=2)


SPEC = {
    **SEDAN,
    "length": 4.4,
    "body": "yellow",
    "lower": "white",
    "roof": "yellow",
    "body_height": 0.64,
    "body_bevel": 0.1,
    "cabin_height": 0.6,
    "cabin_taper": 0.86,
    "cabin_shift": -0.04,
    "headlight_radius": 0.15,
    "wheel_covers": False,
    "hub": "hub",
    "extras": [roof_sign],
    "limit": 3000,
}

if __name__ == "__main__":
    run("taxi", SPEC)
