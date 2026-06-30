#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

DEVICE = "hw:1,0"
SOUND_DIR = Path(__file__).resolve().parent

SOUNDS = {
    "startup": "jerkmaster_startup.wav",
    "shutdown": "jerkmaster_shutdown.wav",
    "action": "jerkmaster_r2d2.wav",
    "error": "jerkmaster_r2d2.wav",
    "complete": "jerkmaster_shutdown.wav",
    "r2d2": "jerkmaster_r2d2.wav",
    "beer": "jerkmaster_beer.wav",
}

def play(name):
    filename = SOUNDS.get(name)
    if not filename:
        print("Available:", ", ".join(SOUNDS))
        raise SystemExit(1)

    path = SOUND_DIR / filename
    subprocess.Popen(
        ["aplay", "-D", DEVICE, str(path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

if __name__ == "__main__":
    play(sys.argv[1] if len(sys.argv) > 1 else "r2d2")
