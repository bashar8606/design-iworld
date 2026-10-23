"""Rebuilds every Blender asset from its script: npm run assets:blender [-- name ...] [--no-preview]

Uses `blender -b -P` when Blender is on the PATH, otherwise a Python with the `bpy` module
(set BLENDER_PYTHON to its interpreter, e.g. a venv with `pip install bpy`).
"""

import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPTS = os.path.join(ROOT, "assets-src", "blender", "scripts")
ASSETS = ["hatchback", "sedan", "taxi", "scooter", "truck", "ski_bus", "cafe", "fast_charger", "worker"]


def main():
    args = sys.argv[1:]
    names = [a for a in args if not a.startswith("-")] or ASSETS
    flags = [a for a in args if a.startswith("-")]
    blender = shutil.which("blender")
    python = os.environ.get("BLENDER_PYTHON")
    for name in names:
        script = os.path.join(SCRIPTS, f"{name}.py")
        if blender:
            cmd = [blender, "-b", "--factory-startup", "-P", script, "--", *flags]
        elif python:
            cmd = [python, script, *flags]
        else:
            sys.exit("Install Blender (on PATH) or set BLENDER_PYTHON to a Python with the bpy module.")
        print(f"→ {name}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        for line in result.stdout.splitlines():
            if line.startswith("["):
                print("  " + line)
        if result.returncode != 0:
            print(result.stdout[-2000:], result.stderr[-2000:])
            sys.exit(f"{name} failed")


if __name__ == "__main__":
    main()
