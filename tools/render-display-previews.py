#!/usr/bin/env python3
"""Render documentation previews for the dual JerkMaster status displays."""

import argparse
import importlib.util
import sys
import types
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DISPLAY_MODULE = ROOT / "displays" / "jerkmaster_displays.py"
OUTPUT = ROOT / "img" / "docs" / "screenshots" / "status-displays.png"
SCREEN_SIZE = 240
SCALE = 2
GAP = 28
LABEL_WIDTH = 280
BACKGROUND = "#080d12"
PANEL = "#101820"
TEXT = "#f3f4f6"
MUTED = "#94a3b8"


def load_display_module():
    sys.modules.setdefault("spidev", types.SimpleNamespace(SpiDev=object))
    sys.modules.setdefault("gpiozero", types.SimpleNamespace(OutputDevice=object))
    spec = importlib.util.spec_from_file_location("jerkmaster_displays", DISPLAY_MODULE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def font(size, bold=False):
    path = Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(path, size) if path.exists() else ImageFont.load_default()


def circle_screen(image):
    scaled = image.resize((SCREEN_SIZE * SCALE, SCREEN_SIZE * SCALE), Image.Resampling.LANCZOS)
    mask = Image.new("L", scaled.size)
    ImageDraw.Draw(mask).ellipse((0, 0, scaled.width - 1, scaled.height - 1), fill=255)
    result = Image.new("RGB", scaled.size, BACKGROUND)
    result.paste(scaled, mask=mask)
    ImageDraw.Draw(result).ellipse((1, 1, scaled.width - 2, scaled.height - 2), outline="#334155", width=4)
    return result


def pair(module, telemetry):
    return circle_screen(module.render_temperature(telemetry)), circle_screen(module.render_process(telemetry))


def offline_pair(module):
    return circle_screen(module.render_offline("TIMEOUT")), circle_screen(module.render_offline("MOONRAKER"))


def render_sheet(module):
    running = module.Telemetry(
        connected=True, klipper_ready=True, running=True, profile="JERKY_STANDARD",
        stage=3, elapsed_seconds=3.25 * 3600, current_temp=64.8, target_temp=65,
        bay_temp=39, rpi_temp=53, heater_on=True, fan_on=True,
    )
    idle = module.Telemetry(
        connected=True, klipper_ready=True, running=False, profile="NONE",
        current_temp=25.4, target_temp=0, bay_temp=31, rpi_temp=47,
    )
    cooling = module.Telemetry(
        connected=True, klipper_ready=True, running=True, profile="JERKY_STANDARD",
        stage=5, elapsed_seconds=6.1 * 3600, current_temp=37.2, target_temp=30,
        bay_temp=35, rpi_temp=49, fan_on=True,
    )
    rows = [
        ("ACTIVE DRYING", "Heater and fan running", pair(module, running)),
        ("IDLE", "Ready for a new process", pair(module, idle)),
        ("COOLING", "Final fan-only stage", pair(module, cooling)),
        ("OFFLINE", "Moonraker connection lost", offline_pair(module)),
    ]

    screen = SCREEN_SIZE * SCALE
    width = LABEL_WIDTH + screen * 2 + GAP * 4
    row_height = screen + GAP * 2
    image = Image.new("RGB", (width, row_height * len(rows) + GAP), BACKGROUND)
    draw = ImageDraw.Draw(image)
    title_font = font(25, True)
    body_font = font(18)

    for index, (title, subtitle, screens) in enumerate(rows):
        top = GAP + index * row_height
        draw.rounded_rectangle((GAP, top, width - GAP, top + screen + GAP), radius=24, fill=PANEL, outline="#263746", width=2)
        draw.text((GAP * 2, top + 42), title, font=title_font, fill=TEXT)
        draw.multiline_text((GAP * 2, top + 82), subtitle, font=body_font, fill=MUTED, spacing=5)
        left_x = LABEL_WIDTH + GAP * 2
        image.paste(screens[0], (left_x, top + GAP // 2))
        image.paste(screens[1], (left_x + screen + GAP, top + GAP // 2))

    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    module = load_display_module()
    image = render_sheet(module)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output)
    print(args.output)


if __name__ == "__main__":
    main()
