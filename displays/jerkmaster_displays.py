#!/usr/bin/env python3
"""Read-only dual GC9A01 status displays for JerkMaster."""

import json
import math
import random
import subprocess
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import spidev
from gpiozero import Button, OutputDevice
from PIL import Image, ImageDraw, ImageFont, ImageOps


WIDTH = 240
HEIGHT = 240
BACKGROUND = "#07131d"
TRACK = "#193344"
CYAN = "#38bdf8"
GREEN = "#22c55e"
AMBER = "#f59e0b"
RED = "#ef4444"
WHITE = "#f3f4f6"
MUTED = "#94a3b8"
RESAMPLE_LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

PROFILE_STAGES = {
    "JERKY_STANDARD": [60, 90, 210, 15],
    "BANANA_CHIPS": [300],
}


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


FONTS = {
    "small": font(16),
    "label": font(19, True),
    "medium": font(28, True),
    "large": font(66, True),
    "logo": font(29, True),
}


class Backlight:
    """Backlight helper. These GC9A01 modules often use active LOW BL."""
    def __init__(self, pin, active_low=True):
        self.device = OutputDevice(int(pin), initial_value=False)
        self.active_low = active_low

    def on(self):
        if self.active_low:
            self.device.off()
        else:
            self.device.on()

    def off(self):
        if self.active_low:
            self.device.on()
        else:
            self.device.off()


class GC9A01:
    """Minimal GC9A01 driver for hardware SPI CE0/CE1.

    Wiring:
      left  display CS -> GPIO8  / CE0 -> spi.open(0, 0)
      right display CS -> GPIO7  / CE1 -> spi.open(0, 1)
      DC and RST are shared.
    """

    INIT_SEQUENCE = (
        (0xEF, b""),
        (0xEB, b"\x14"),
        (0xFE, b""),
        (0xEF, b""),
        (0xEB, b"\x14"),
        (0x84, b"\x40"),
        (0x85, b"\xFF"),
        (0x86, b"\xFF"),
        (0x87, b"\xFF"),
        (0x88, b"\x0A"),
        (0x89, b"\x21"),
        (0x8A, b"\x00"),
        (0x8B, b"\x80"),
        (0x8C, b"\x01"),
        (0x8D, b"\x01"),
        (0x8E, b"\xFF"),
        (0x8F, b"\xFF"),
        (0xB6, b"\x00\x20"),
        # Same MADCTL as your working gc9a01_test.py
        (0x36, b"\x48"),
        (0x3A, b"\x05"),
        (0x90, b"\x08\x08\x08\x08"),
        (0xBD, b"\x06"),
        (0xBC, b"\x00"),
        (0xFF, b"\x60\x01\x04"),
        (0xC3, b"\x13"),
        (0xC4, b"\x13"),
        (0xC9, b"\x22"),
        (0xBE, b"\x11"),
        (0xE1, b"\x10\x0E"),
        (0xDF, b"\x21\x0C\x02"),
        (0xF0, b"\x45\x09\x08\x08\x26\x2A"),
        (0xF1, b"\x43\x70\x72\x36\x37\x6F"),
        (0xF2, b"\x45\x09\x08\x08\x26\x2A"),
        (0xF3, b"\x43\x70\x72\x36\x37\x6F"),
        (0xED, b"\x1B\x0B"),
        (0xAE, b"\x77"),
        (0xCD, b"\x63"),
        (0x70, b"\x07\x07\x04\x0E\x0F\x09\x07\x08\x03"),
        (0xE8, b"\x34"),
        (0x62, b"\x18\x0D\x71\xED\x70\x70\x18\x0F\x71\xEF\x70\x70"),
        (0x63, b"\x18\x11\x71\xF1\x70\x70\x18\x13\x71\xF3\x70\x70"),
        (0x64, b"\x28\x29\xF1\x01\xF1\x00\x07"),
        (0x66, b"\x3C\x00\xCD\x67\x45\x45\x10\x00\x00\x00"),
        (0x67, b"\x00\x3C\x00\x00\x00\x01\x54\x10\x32\x98"),
        (0x74, b"\x10\x85\x80\x00\x00\x4E\x00"),
        (0x98, b"\x3E\x07"),
    )

    def __init__(self, spi, dc, reset, backlight, rotation=0, mirror=False, flip=False):
        self.spi = spi
        self.dc = dc
        self.reset = reset
        self.backlight = backlight
        self.rotation = rotation
        self.mirror = mirror
        self.flip = flip

    def initialize(self):
        self.backlight.on()
        for command, data in self.INIT_SEQUENCE:
            self.write(command, data)
        self.write(0x35)
        self.write(0x21)
        self.write(0x11)
        time.sleep(0.12)
        self.write(0x29)
        time.sleep(0.02)
        self.backlight.on()

    def write(self, command, data=b""):
        self.dc.off()
        self.spi.writebytes([command])
        if data:
            self.dc.on()
            self.spi.writebytes(list(data))

    def show(self, image):
        image = image.convert("RGB")
        if self.rotation:
            image = image.rotate(self.rotation, expand=False)
        if self.mirror:
            image = ImageOps.mirror(image)
        if self.flip:
            image = ImageOps.flip(image)

        pixels = bytearray(WIDTH * HEIGHT * 2)
        offset = 0
        for red, green, blue in image.getdata():
            value = ((red & 0xF8) << 8) | ((green & 0xFC) << 3) | (blue >> 3)
            pixels[offset] = value >> 8
            pixels[offset + 1] = value & 0xFF
            offset += 2

        self.write(0x2A, b"\x00\x00\x00\xEF")
        self.write(0x2B, b"\x00\x00\x00\xEF")

        self.dc.off()
        self.spi.writebytes([0x2C])
        self.dc.on()

        chunk = 4096
        for index in range(0, len(pixels), chunk):
            self.spi.writebytes(pixels[index:index + chunk])


@dataclass
class Telemetry:
    connected: bool = False
    klipper_ready: bool = False
    running: bool = False
    profile: str = "NONE"
    stage: int = 0
    elapsed_seconds: Optional[float] = None
    current_temp: float = 0
    target_temp: float = 0
    bay_temp: float = 0
    rpi_temp: float = 0
    heater_on: bool = False
    fan_on: bool = False
    custom_minutes: float = 0
    last_result: str = "NONE"
    door_open: bool = False


class Moonraker:
    OBJECTS = (
        "heater_generic dryer_heater",
        "temperature_sensor electronics_bay",
        "temperature_sensor raspberry_pi",
        "output_pin dryer_fan",
        "gcode_macro DRYER_STATE",
        "gcode_macro INPUT_STATE",
        "toolhead",
        "webhooks",
    )

    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def read(self):
        query = "&".join(urllib.parse.quote(name, safe="") for name in self.OBJECTS)
        request = urllib.request.Request(f"{self.base_url}/printer/objects/query?{query}")
        with urllib.request.urlopen(request, timeout=2) as response:
            status = json.load(response)["result"]["status"]

        heater = status.get("heater_generic dryer_heater", {})
        state = status.get("gcode_macro DRYER_STATE", {})
        input_state = status.get("gcode_macro INPUT_STATE", {})
        toolhead = status.get("toolhead", {})
        webhooks = status.get("webhooks", {})
        stage_started = number(state.get("stage_started_at"))
        elapsed_before = number(state.get("elapsed_before_stage"))
        estimated_time = number(toolhead.get("estimated_print_time"))
        elapsed = None
        if stage_started > 0:
            elapsed = max(0, elapsed_before + estimated_time - stage_started)

        return Telemetry(
            connected=True,
            klipper_ready=str(webhooks.get("state", "")).lower() == "ready",
            running=number(state.get("running")) == 1,
            profile=str(state.get("profile", "NONE")),
            stage=int(number(state.get("stage"))),
            elapsed_seconds=elapsed,
            current_temp=number(heater.get("temperature")),
            target_temp=number(heater.get("target")),
            bay_temp=number(status.get("temperature_sensor electronics_bay", {}).get("temperature")),
            rpi_temp=number(status.get("temperature_sensor raspberry_pi", {}).get("temperature")),
            heater_on=number(heater.get("power")) > 0,
            fan_on=number(status.get("output_pin dryer_fan", {}).get("value")) > 0,
            custom_minutes=number(state.get("custom_minutes")),
            last_result=str(state.get("last_result", "NONE")),
            door_open=number(input_state.get("door_open")) == 1,
        )


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def centered(draw, xy, text, selected_font, fill=WHITE):
    box = draw.textbbox((0, 0), text, font=selected_font)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2), text, font=selected_font, fill=fill)


def status_dot(draw, center, label, active, color):
    x, y = center
    draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color if active else TRACK)
    draw.text((x + 13, y - 10), label, font=FONTS["small"], fill=WHITE if active else MUTED)


def render_temperature(telemetry):
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    ring_color = GREEN if telemetry.klipper_ready else RED
    draw.arc((8, 8, 232, 232), 140, 400, fill=TRACK, width=9)
    draw.arc((8, 8, 232, 232), 140, 400, fill=ring_color, width=9)
    centered(draw, (120, 38), "CHAMBER", FONTS["label"], MUTED)
    centered(draw, (120, 94), f"{telemetry.current_temp:.1f}°", FONTS["large"])
    centered(draw, (120, 143), f"TARGET {telemetry.target_temp:.0f}°", FONTS["medium"], AMBER)
    status_dot(draw, (42, 187), "HEAT", telemetry.heater_on, AMBER)
    status_dot(draw, (137, 187), "FAN", telemetry.fan_on, CYAN)
    centered(draw, (120, 207), "RUNNING" if telemetry.running else "IDLE", FONTS["label"], GREEN if telemetry.running else MUTED)
    return image


def render_process(telemetry):
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    progress, remaining = process_progress(telemetry)
    end_angle = -90 + 360 * progress
    draw.arc((8, 8, 232, 232), 0, 359, fill=TRACK, width=9)
    if progress > 0:
        draw.arc((8, 8, 232, 232), -90, end_angle, fill=CYAN, width=9)
    centered(draw, (120, 36), telemetry.profile.replace("_", " "), FONTS["small"], MUTED)
    centered(draw, (120, 72), f"STAGE {telemetry.stage or '-'}", FONTS["medium"])
    centered(draw, (120, 116), "COOLING" if telemetry.stage == 5 else format_duration(remaining), FONTS["medium"], CYAN)
    centered(draw, (120, 148), f"{progress * 100:.0f}%", FONTS["label"], MUTED)
    draw.line((43, 165, 197, 165), fill=TRACK, width=3)
    centered(draw, (75, 181), "BAY", FONTS["small"], MUTED)
    centered(draw, (75, 205), f"{telemetry.bay_temp:.0f}°", FONTS["medium"], temperature_color(telemetry.bay_temp, 50, 60))
    centered(draw, (165, 181), "RPI", FONTS["small"], MUTED)
    centered(draw, (165, 205), f"{telemetry.rpi_temp:.0f}°", FONTS["medium"], temperature_color(telemetry.rpi_temp, 65, 75))
    return image


def load_logo():
    logo_path = Path(__file__).with_name("logo.png")
    if logo_path.exists():
        return Image.open(logo_path).convert("RGBA")
    return None


def render_logo(logo, side, phase):
    image = Image.new("RGB", (WIDTH, HEIGHT), "#020507")
    draw = ImageDraw.Draw(image)
    glow = int(35 + 20 * math.sin(phase * math.tau))
    draw.ellipse((12, 12, 228, 228), outline=(0, 110 + glow, 180 + glow), width=5)

    if logo:
        if side == "left":
            crop = logo.crop((0, 0, min(510, logo.width), logo.height))
            crop.thumbnail((190, 160), RESAMPLE_LANCZOS)
            image.paste(crop, ((WIDTH - crop.width) // 2, 35), crop)
        else:
            crop = logo.crop((min(540, logo.width - 1), 0, logo.width, logo.height))
            crop.thumbnail((215, 100), RESAMPLE_LANCZOS)
            image.paste(crop, ((WIDTH - crop.width) // 2, 62), crop)
            centered(draw, (120, 182), "SMART DRYING", FONTS["small"], CYAN)
    else:
        centered(draw, (120, 105), "JERK", FONTS["logo"], WHITE)
        centered(draw, (120, 140), "MASTER", FONTS["logo"], CYAN)
    return image


def render_eye(side, animation_time):
    image = Image.new("RGB", (WIDTH, HEIGHT), "#000000")
    draw = ImageDraw.Draw(image)
    look_x, look_y, openness, pupil_scale, eye_fill, pupil_outline, lid_style = circular_eye_pose(side, animation_time)
    center_x = 120
    center_y = 120
    eye_diameter = 154
    eye_height = max(5, int(eye_diameter * openness))
    eye_box = (
        center_x - eye_diameter // 2,
        center_y - eye_height // 2,
        center_x + eye_diameter // 2,
        center_y + eye_height // 2,
    )
    draw.ellipse(eye_box, fill=eye_fill)

    if openness > 0.18:
        pupil_diameter = int(82 * pupil_scale)
        max_offset = (eye_diameter - pupil_diameter) // 2 - 13
        pupil_x = center_x + int(look_x * max_offset)
        pupil_y = center_y + int(look_y * max_offset)
        pupil_height = min(pupil_diameter, max(4, eye_height - 18))
        pupil_box = (
            pupil_x - pupil_diameter // 2,
            pupil_y - pupil_height // 2,
            pupil_x + pupil_diameter // 2,
            pupil_y + pupil_height // 2,
        )
        if pupil_outline:
            outline_width = 8
            draw.ellipse(pupil_box, fill=pupil_outline)
            draw.ellipse(
                (
                    pupil_box[0] + outline_width,
                    pupil_box[1] + outline_width,
                    pupil_box[2] - outline_width,
                    pupil_box[3] - outline_width,
                ),
                fill="#000000",
            )
        else:
            draw.ellipse(pupil_box, fill="#000000")

    if lid_style == "horizontal":
        lid_y = center_y - eye_diameter // 2 + 43
        draw.rectangle((center_x - eye_diameter // 2 - 2, center_y - eye_diameter // 2 - 2, center_x + eye_diameter // 2 + 2, lid_y), fill="#000000")
    elif lid_style == "diagonal":
        left_y, right_y = (72, 105) if side == "left" else (105, 72)
        draw.polygon(((38, 35), (202, 35), (202, right_y), (38, left_y)), fill="#000000")
    return image



def render_beer_progress(side, telemetry, animation_time, scene_duration=8.0):
    image = Image.new("RGB", (WIDTH, HEIGHT), "#020507")
    draw = ImageDraw.Draw(image)
    progress, remaining = process_progress(telemetry)

    # Beer animation is independent from dryer progress.
    # Slow enough to actually see the fill/foam transition.
    beer_fill_seconds = 10.0
    foam_grow_seconds = 7.0
    hold_seconds = max(3.0, scene_duration - beer_fill_seconds - foam_grow_seconds)

    t = animation_time % (beer_fill_seconds + foam_grow_seconds + hold_seconds)

    if t < beer_fill_seconds:
        beer_animation_progress = 0.80 * smooth_step(t / beer_fill_seconds)
    elif t < beer_fill_seconds + foam_grow_seconds:
        foam_progress = smooth_step((t - beer_fill_seconds) / foam_grow_seconds)
        beer_animation_progress = 0.80 + 0.20 * foam_progress
    else:
        beer_animation_progress = 1.0

    draw.arc((8, 8, 232, 232), 0, 359, fill=TRACK, width=8)
    if side == "left":
        render_beer_glass(draw, beer_animation_progress, animation_time)
    else:
        # Keep the DRINKING -> DRYING effect on the right screen.
        render_drinking_to_drying(draw, progress, remaining, animation_time)
    return image


def render_drinking_to_drying(draw, progress, remaining, animation_time):
    if animation_time < 1.75:
        centered(draw, (120, 108), "DRINKING", FONTS["medium"], AMBER)
        centered(draw, (120, 145), "PLEASE WAIT", FONTS["small"], MUTED)
        return

    if animation_time < 4.25:
        transition = smooth_step((animation_time - 1.75) / 2.5)
        crt_glitch_text(draw, (120, 108), "DRINKING", FONTS["medium"], AMBER, transition, False, animation_time)
        crt_glitch_text(draw, (120, 108), "DRYING", FONTS["medium"], AMBER, transition, True, animation_time)
        crt_noise(draw, transition, animation_time)
        if transition < 0.55:
            centered(draw, (120, 145), "PLEASE WAIT", FONTS["small"], mix_color(MUTED, BACKGROUND, transition / 0.55))
        return

    if animation_time < 6.25:
        centered(draw, (120, 108), "DRYING", FONTS["medium"], AMBER)
        return

    centered(draw, (120, 47), "DRYING", FONTS["label"], MUTED)
    centered(draw, (120, 111), f"{progress * 100:.0f}%", FONTS["large"], AMBER)
    centered(draw, (120, 158), "COMPLETE", FONTS["label"], WHITE)
    centered(draw, (120, 194), format_duration(remaining), FONTS["medium"], CYAN)


def crt_glitch_text(draw, center, text, selected_font, fill, transition, assembling, animation_time):
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    layer_draw = ImageDraw.Draw(layer)
    box = layer_draw.textbbox((0, 0), text, font=selected_font)
    text_width = box[2] - box[0]
    text_height = box[3] - box[1]
    x = int(center[0] - text_width / 2)
    y = int(center[1] - text_height / 2)
    layer_draw.text((x, y), text, font=selected_font, fill=fill)

    strength = math.sin(transition * math.pi)
    visibility = transition if assembling else 1 - transition
    randomizer = random.Random(int(animation_time * 16) + (937 if assembling else 419))
    band_height = 4
    for band_y in range(max(0, y - 3), min(HEIGHT, y + text_height + 6), band_height):
        if randomizer.random() > visibility + 0.25 * strength:
            continue
        jitter = int(randomizer.uniform(-24, 24) * strength)
        strip = layer.crop((0, band_y, WIDTH, min(HEIGHT, band_y + band_height)))
        draw._image.paste(strip, (jitter, band_y), strip)


def crt_noise(draw, transition, animation_time):
    strength = math.sin(transition * math.pi)
    if strength < 0.08:
        return
    randomizer = random.Random(int(animation_time * 24) + 2026)
    for _ in range(int(5 + strength * 15)):
        y = randomizer.randint(75, 138)
        x = randomizer.randint(38, 180)
        length = randomizer.randint(8, 42)
        color = CYAN if randomizer.random() > 0.55 else MUTED
        draw.line((x, y, min(205, x + length), y), fill=color, width=randomizer.choice((1, 1, 2)))
    if strength > 0.55:
        scan_y = 83 + int((animation_time * 95) % 48)
        draw.rectangle((35, scan_y, 205, scan_y + 2), fill="#dbeafe")


def mix_color(start, end, amount):
    amount = max(0.0, min(1.0, amount))
    start_rgb = tuple(int(start[index:index + 2], 16) for index in (1, 3, 5))
    end_rgb = tuple(int(end[index:index + 2], 16) for index in (1, 3, 5))
    mixed = tuple(round(first + (second - first) * amount) for first, second in zip(start_rgb, end_rgb))
    return f"#{mixed[0]:02x}{mixed[1]:02x}{mixed[2]:02x}"



def render_beer_glass(draw, progress, animation_time):
    """Full-screen beer fill with foam and bubbles.

    progress:
      0.00..0.80 = beer rises to 80% screen height
      0.80..1.00 = foam grows above beer, leaving black headspace
    """
    beer_color = "#f59e0b"
    beer_dark = "#d97706"
    beer_light = "#fbbf24"
    foam_color = "#fff7d6"
    foam_shadow = "#fde68a"

    progress = max(0.0, min(1.0, progress))

    # Keep black area at the top so foam movement is visible.
    headspace = 18

    beer_final_height = int(HEIGHT * 0.80)
    foam_final_height = HEIGHT - beer_final_height - headspace

    beer_progress = min(progress / 0.80, 1.0)
    foam_progress = smooth_step((progress - 0.80) / 0.20)

    beer_height = int(beer_final_height * beer_progress)
    beer_top = HEIGHT - beer_height

    foam_height = int(foam_final_height * foam_progress)
    foam_bottom = beer_top + 6
    foam_top = max(headspace, foam_bottom - foam_height)

    if beer_height > 0:
        draw.rectangle((0, beer_top, WIDTH, HEIGHT), fill=beer_color)

        wave_y = beer_top + 18 + int(7 * math.sin(animation_time * 1.1))
        if wave_y < HEIGHT:
            draw.rectangle((0, wave_y, WIDTH, HEIGHT), fill=beer_dark)
            draw.rectangle((0, wave_y + 14, WIDTH, HEIGHT), fill=beer_color)

        surface_wave = beer_top + int(3 * math.sin(animation_time * 1.7))
        draw.line((0, surface_wave, WIDTH, surface_wave), fill=beer_light, width=2)

    if foam_height > 0:
        draw.rectangle((0, foam_top + 10, WIDTH, foam_bottom), fill=foam_color)

        bubble_count = 12
        for index in range(bubble_count):
            x = int(index * WIDTH / (bubble_count - 1))
            radius = 13 + int(5 * math.sin(animation_time * 1.2 + index * 0.7))
            y = foam_top + 11 + int(6 * math.sin(animation_time * 1.0 + index * 0.55))
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=foam_color)

        boundary = foam_bottom - 3 + int(2 * math.sin(animation_time * 1.4))
        draw.rectangle((0, boundary, WIDTH, boundary + 4), fill=foam_shadow)

        for index in range(18):
            x = int((index * 37 + 23) % WIDTH)
            y_base = foam_top + 12 + ((index * 17) % max(1, foam_height))
            y = y_base + int(2 * math.sin(animation_time * 1.3 + index))
            radius = 1 + (index % 3)
            if headspace + 2 < y < foam_bottom - 4:
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline="#facc15", width=1)

    liquid_top = min(HEIGHT, beer_top + 6)
    liquid_height = HEIGHT - liquid_top
    if liquid_height > 12:
        bubble_columns = (
            (12, 0.05, 2), (25, 0.22, 3), (38, 0.48, 2),
            (52, 0.68, 4), (66, 0.15, 2), (79, 0.83, 3),
            (93, 0.36, 2), (108, 0.58, 5), (123, 0.10, 3),
            (139, 0.75, 2), (154, 0.27, 4), (169, 0.92, 2),
            (184, 0.43, 3), (199, 0.62, 2), (214, 0.31, 4),
            (228, 0.88, 2),
        )
        for x, offset, radius in bubble_columns:
            speed = 15 + radius * 4
            travel = (animation_time * speed + offset * liquid_height) % liquid_height
            y = HEIGHT - 6 - travel
            wobble = int(3 * math.sin(animation_time * 1.8 + x * 0.11))
            if y > liquid_top + radius:
                draw.ellipse(
                    (x + wobble - radius, y - radius, x + wobble + radius, y + radius),
                    outline=foam_color,
                    width=1 if radius <= 2 else 2,
                )


class BlackjackGame:
    def __init__(self):
        self.randomizer = random.Random()
        self.reset()

    def reset(self):
        self.active = False
        self.phase = "idle"
        self.deck = []
        self.player = []
        self.dealer = []
        self.last_action = 0.0
        self.dealer_step = 0.0
        self.result_started = 0.0
        self.result = ""

    def start(self, now):
        suits = ("heart", "spade", "heart", "spade")
        ranks = ("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")
        self.deck = [(rank, suit) for suit in suits for rank in ranks]
        self.randomizer.shuffle(self.deck)
        self.player = [self.deck.pop(), self.deck.pop()]
        self.dealer = [self.deck.pop(), self.deck.pop()]
        self.active = True
        self.phase = "player"
        self.last_action = now
        self.result = ""
        if hand_value(self.player) == 21:
            self.stand(now)

    def press(self, now):
        if not self.active:
            self.start(now)
        elif self.phase == "player":
            self.player.append(self.deck.pop())
            self.last_action = now
            if hand_value(self.player) >= 21:
                self.stand(now)

    def stand(self, now):
        if hand_value(self.player) > 21:
            self.finish(now)
            return
        self.phase = "dealer"
        self.dealer_step = now + 0.7

    def update(self, now, stand_timeout, result_duration):
        if not self.active:
            return
        if self.phase == "player" and now - self.last_action >= stand_timeout:
            self.stand(now)
        elif self.phase == "dealer" and now >= self.dealer_step:
            if hand_value(self.dealer) < 17:
                self.dealer.append(self.deck.pop())
                self.dealer_step = now + 0.7
            else:
                self.finish(now)
        elif self.phase == "result" and now - self.result_started >= result_duration:
            self.reset()

    def finish(self, now):
        player_value = hand_value(self.player)
        dealer_value = hand_value(self.dealer)
        if player_value > 21:
            self.result = "BUST"
        elif dealer_value > 21 or player_value > dealer_value:
            self.result = "YOU WIN"
        elif player_value < dealer_value:
            self.result = "DEALER WINS"
        else:
            self.result = "PUSH"
        self.phase = "result"
        self.result_started = now


def hand_value(cards):
    value = 0
    aces = 0
    for rank, _ in cards:
        if rank == "A":
            aces += 1
            value += 11
        elif rank in ("J", "Q", "K"):
            value += 10
        else:
            value += int(rank)
    while value > 21 and aces:
        value -= 10
        aces -= 1
    return value


def render_blackjack_game(side, game, now, stand_timeout):
    image = Image.new("RGB", (WIDTH, HEIGHT), "#06150e")
    draw = ImageDraw.Draw(image)
    draw.arc((8, 8, 232, 232), 0, 359, fill="#166534", width=8)
    draw.ellipse((28, 28, 212, 212), outline="#14532d", width=3)

    is_player = side == "left"
    cards = game.player if is_player else game.dealer
    hidden_dealer_card = not is_player and game.phase == "player"
    label = "PLAYER" if is_player else "DEALER"
    centered(draw, (120, 27), label, FONTS["label"], CYAN if is_player else AMBER)
    render_blackjack_hand(draw, cards, hidden_dealer_card)

    visible_cards = cards[:1] if hidden_dealer_card else cards
    centered(draw, (120, 184), str(hand_value(visible_cards)), FONTS["medium"], WHITE)
    if is_player and game.phase == "player":
        remaining = max(0, math.ceil(stand_timeout - (now - game.last_action)))
        centered(draw, (120, 210), f"HIT  {remaining}", FONTS["small"], AMBER)
    elif game.phase == "dealer":
        centered(draw, (120, 210), "DEALING", FONTS["small"], AMBER)
    elif game.phase == "result":
        result_color = GREEN if game.result == "YOU WIN" else AMBER if game.result == "PUSH" else RED
        centered(draw, (120, 210), game.result, FONTS["small"], result_color)
        render_casino_sparkles(draw, side, now)
    return image


def render_blackjack_hand(draw, cards, hide_second=False):
    count = len(cards)
    spacing = 42 if count <= 3 else 31
    start_x = 120 - spacing * (count - 1) / 2
    for index, (rank, suit) in enumerate(cards):
        center_x = int(start_x + index * spacing)
        render_playing_card(draw, center_x, 101, rank, suit, hidden=hide_second and index == 1)


def render_playing_card(draw, center_x, center_y, rank, suit, hidden=False):
    box = (center_x - 31, center_y - 48, center_x + 31, center_y + 48)
    if hidden:
        draw.rounded_rectangle(box, radius=8, fill="#1d4ed8", outline="#dbeafe", width=3)
        for y in range(box[1] + 8, box[3] - 4, 10):
            draw.line((box[0] + 7, y, box[2] - 7, y), fill="#93c5fd", width=2)
        return
    draw.rounded_rectangle(box, radius=12, fill="#f8fafc", outline="#d1d5db", width=3)
    color = RED if suit == "heart" else "#111827"
    card_font = FONTS["label"]
    draw.text((box[0] + 5, box[1] + 3), rank, font=card_font, fill=color)
    if suit == "heart":
        draw_heart(draw, center_x, center_y + 9, 13, color)
    else:
        draw_spade(draw, center_x, center_y + 9, 14, color)


def draw_heart(draw, center_x, center_y, radius, color):
    draw.ellipse((center_x - radius, center_y - radius, center_x, center_y), fill=color)
    draw.ellipse((center_x, center_y - radius, center_x + radius, center_y), fill=color)
    draw.polygon(((center_x - radius, center_y - 3), (center_x + radius, center_y - 3), (center_x, center_y + radius + 18)), fill=color)


def draw_spade(draw, center_x, center_y, radius, color):
    draw.polygon(((center_x, center_y - radius - 20), (center_x - radius, center_y + 4), (center_x + radius, center_y + 4)), fill=color)
    draw.ellipse((center_x - radius, center_y - 5, center_x, center_y + radius), fill=color)
    draw.ellipse((center_x, center_y - 5, center_x + radius, center_y + radius), fill=color)
    draw.polygon(((center_x - 8, center_y + radius - 4), (center_x + 8, center_y + radius - 4), (center_x + 18, center_y + radius + 20), (center_x - 18, center_y + radius + 20)), fill=color)


def render_casino_sparkles(draw, side, animation_time):
    randomizer = random.Random(int(animation_time * 12) + (21 if side == "left" else 42))
    for _ in range(9):
        angle = randomizer.random() * math.tau
        distance = randomizer.randint(68, 98)
        x = int(120 + math.cos(angle) * distance)
        y = int(120 + math.sin(angle) * distance)
        radius = randomizer.choice((2, 3, 4))
        color = randomizer.choice((AMBER, WHITE, RED))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def circular_eye_pose(side, animation_time):
    """Circular-eye sequence inspired by SpiderMaf's simple OLED eye motions."""
    sequence_time = animation_time % 10.0
    look_x = 0.0
    look_y = 0.0
    openness = 1.0
    pupil_scale = 1.0
    eye_fill = "#FFFFFF"
    pupil_outline = None
    lid_style = None

    if sequence_time < 1.0:
        look_x = smooth_step(sequence_time) * 0.9
    elif sequence_time < 2.0:
        look_x = 0.9 - smooth_step(sequence_time - 1.0) * 1.8
    elif sequence_time < 2.8:
        look_x = -0.9 + smooth_step((sequence_time - 2.0) / 0.8) * 0.9
    elif sequence_time < 3.6:
        look_y = -smooth_step((sequence_time - 2.8) / 0.8) * 0.85
    elif sequence_time < 4.4:
        look_y = -0.85 + smooth_step((sequence_time - 3.6) / 0.8) * 1.7
    elif sequence_time < 5.1:
        look_y = 0.85 - smooth_step((sequence_time - 4.4) / 0.7) * 0.85
    elif sequence_time < 5.9:
        look_x = 0.45 if side == "left" else -0.45
        pupil_outline = CYAN
    elif sequence_time < 6.7:
        lid_style = "horizontal"
        pupil_outline = AMBER
    elif sequence_time < 7.5:
        lid_style = "diagonal"
        pupil_outline = RED
    elif sequence_time < 8.1:
        openness = blink_openness((sequence_time - 7.5) / 0.6)
    elif sequence_time < 8.6:
        eye_fill = CYAN
        pupil_outline = "#FFFFFF"
    elif sequence_time < 9.0:
        eye_fill = AMBER
        pupil_outline = RED
    elif sequence_time < 9.4:
        eye_fill = RED
        pupil_outline = AMBER
    else:
        look_x = math.sin((sequence_time - 9.4) / 0.6 * math.tau) * 0.32
        look_y = math.cos((sequence_time - 9.4) / 0.6 * math.tau) * 0.2
        pupil_scale = 0.78

    return look_x, look_y, openness, pupil_scale, eye_fill, pupil_outline, lid_style


def smooth_step(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def blink_openness(value):
    value = max(0.0, min(1.0, value))
    return max(0.03, abs(value * 2 - 1))


def render_offline(message):
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.arc((8, 8, 232, 232), 0, 359, fill=RED, width=9)
    centered(draw, (120, 95), "OFFLINE", FONTS["medium"], RED)
    centered(draw, (120, 130), message, FONTS["small"], MUTED)
    return image


def process_progress(telemetry):
    stages = PROFILE_STAGES.get(telemetry.profile, [])
    if telemetry.profile == "CUSTOM":
        stages = [telemetry.custom_minutes]
    total = sum(stages) * 60
    elapsed = telemetry.elapsed_seconds
    if elapsed is None or total <= 0:
        return 0, None
    elapsed = min(max(0, elapsed), total)
    return elapsed / total, total - elapsed


def format_duration(seconds):
    if seconds is None:
        return "--:--"
    hours, remainder = divmod(max(0, int(seconds)), 3600)
    minutes = remainder // 60
    return f"{hours:02d}:{minutes:02d}"


def temperature_color(value, warning, critical):
    if value >= critical:
        return RED
    if value >= warning:
        return AMBER
    return GREEN


# ====== HARDWARE / APP SETTINGS, no external config.json needed ======
#
# Confirmed display pinout:
#   left  display CS -> CE0 / GPIO8 / physical pin 24
#   left  display BL -> GPIO5 / physical pin 29
#   right display CS -> CE1 / GPIO7 / physical pin 26
#   right display BL -> GPIO6 / physical pin 31
#
# Shared lines:
#   DIN / MOSI -> GPIO10 / pin 19
#   CLK / SCLK -> GPIO11 / pin 23
#   DC         -> GPIO25 / pin 22
#   RST        -> GPIO27 / pin 13

MOONRAKER_URL = "http://127.0.0.1:7125"

SPI_BUS = 0
SPI_SPEED_HZ = 4000000  # safe confirmed speed; later try 16000000/32000000

LEFT_SPI_DEVICE = 0      # CE0 / GPIO8 / pin 24
RIGHT_SPI_DEVICE = 1     # CE1 / GPIO7 / pin 26

DC_PIN = 25
RST_PIN = 27

LEFT_BL_PIN = 5          # GPIO5 / pin 29
RIGHT_BL_PIN = 6         # GPIO6 / pin 31

BL_ACTIVE_LOW = False    # confirmed: GPIO HIGH = backlight ON

# The final hardware architecture routes action/shutdown buttons to the SKR.
# Keep this disabled unless a temporary Raspberry Pi test button is connected.
BLACKJACK_BUTTON_PIN = None

LEFT_ROTATION = 0
RIGHT_ROTATION = 0
LEFT_MIRROR = True
RIGHT_MIRROR = True
LEFT_FLIP = False
RIGHT_FLIP = False

REFRESH_SECONDS = 0.08
TELEMETRY_REFRESH_SECONDS = 2.0

STATUS_DURATION_SECONDS = 45
LOGO_DURATION_SECONDS = 10
EYES_DURATION_SECONDS = 18
BEER_DURATION_SECONDS = 24

BLACKJACK_STAND_TIMEOUT_SECONDS = 7
BLACKJACK_RESULT_DURATION_SECONDS = 8

SOUNDS_DIR = Path(__file__).resolve().with_name("sounds")
SOUND_FILES = {
    "startup": "jerkmaster_startup.wav",
    "shutdown": "jerkmaster_shutdown.wav",
    "r2d2": "jerkmaster_r2d2.wav",
    "beer": "jerkmaster_beer.wav",
}


def play_sound(name):
    filename = SOUND_FILES.get(name)
    if not filename:
        return
    path = SOUNDS_DIR / filename
    if not path.exists():
        return
    try:
        subprocess.Popen(
            ["aplay", "-D", "hw:1,0", str(path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass


def open_spi(device):
    spi = spidev.SpiDev()
    spi.open(SPI_BUS, int(device))
    spi.max_speed_hz = int(SPI_SPEED_HZ)
    spi.mode = 0
    spi.no_cs = False
    return spi


def main():
    left_spi = open_spi(LEFT_SPI_DEVICE)
    right_spi = open_spi(RIGHT_SPI_DEVICE)

    dc = OutputDevice(DC_PIN, initial_value=True)
    reset = OutputDevice(RST_PIN, initial_value=True)

    left = GC9A01(
        left_spi,
        dc,
        reset,
        Backlight(LEFT_BL_PIN, BL_ACTIVE_LOW),
        LEFT_ROTATION,
        LEFT_MIRROR,
        LEFT_FLIP,
    )
    right = GC9A01(
        right_spi,
        dc,
        reset,
        Backlight(RIGHT_BL_PIN, BL_ACTIVE_LOW),
        RIGHT_ROTATION,
        RIGHT_MIRROR,
        RIGHT_FLIP,
    )

    blackjack_button = (
        Button(int(BLACKJACK_BUTTON_PIN), pull_up=True, bounce_time=0.08)
        if BLACKJACK_BUTTON_PIN is not None
        else None
    )

    reset.on()
    time.sleep(0.05)
    reset.off()
    time.sleep(0.05)
    reset.on()
    time.sleep(0.15)

    left.initialize()
    right.initialize()

    moonraker = Moonraker(MOONRAKER_URL)
    logo = load_logo()
    telemetry = Telemetry()
    last_telemetry_read = 0.0
    started_at = time.monotonic()

    blackjack_game = BlackjackGame()
    blackjack_was_pressed = False
    last_mode = None
    last_result_sound = None
    door_was_open = False

    play_sound("startup")

    while True:
        now = time.monotonic()
        try:
            telemetry_updated = False
            if now - last_telemetry_read >= TELEMETRY_REFRESH_SECONDS:
                telemetry = moonraker.read()
                last_telemetry_read = now
                telemetry_updated = True
                if telemetry.door_open and not door_was_open:
                    play_sound("r2d2")
                door_was_open = telemetry.door_open

            blackjack_pressed = blackjack_button.is_pressed if blackjack_button else False
            if blackjack_pressed and not blackjack_was_pressed and telemetry.running:
                blackjack_game.press(now)
                play_sound("r2d2")
            blackjack_was_pressed = blackjack_pressed

            if not telemetry.running:
                blackjack_game.reset()

            blackjack_game.update(
                now,
                BLACKJACK_STAND_TIMEOUT_SECONDS,
                BLACKJACK_RESULT_DURATION_SECONDS,
            )

            if telemetry.door_open:
                mode = "door"
                left.show(render_offline("DOOR"))
                right.show(render_offline("OPEN"))
            elif blackjack_game.active:
                mode = "blackjack"
                left.show(render_blackjack_game("left", blackjack_game, now, BLACKJACK_STAND_TIMEOUT_SECONDS))
                right.show(render_blackjack_game("right", blackjack_game, now, BLACKJACK_STAND_TIMEOUT_SECONDS))
            else:
                active_beer_duration = BEER_DURATION_SECONDS
                cycle_duration = (
                    STATUS_DURATION_SECONDS
                    + LOGO_DURATION_SECONDS
                    + EYES_DURATION_SECONDS
                    + active_beer_duration
                )
                cycle_time = (now - started_at) % cycle_duration

                if cycle_time < LOGO_DURATION_SECONDS:
                    mode = "logo"
                    phase = cycle_time / LOGO_DURATION_SECONDS
                    left.show(render_logo(logo, "left", phase))
                    right.show(render_logo(logo, "right", phase))

                elif cycle_time < LOGO_DURATION_SECONDS + STATUS_DURATION_SECONDS:
                    mode = "status"
                    if telemetry_updated or last_mode != mode:
                        left.show(render_temperature(telemetry))
                        right.show(render_process(telemetry))

                elif cycle_time < LOGO_DURATION_SECONDS + STATUS_DURATION_SECONDS + EYES_DURATION_SECONDS:
                    mode = "eyes"
                    animation_time = cycle_time - LOGO_DURATION_SECONDS - STATUS_DURATION_SECONDS
                    left.show(render_eye("left", animation_time))
                    right.show(render_eye("right", animation_time))

                else:
                    mode = "beer"
                    if last_mode != mode and telemetry.running:
                        play_sound("beer")
                    animation_time = (
                        cycle_time
                        - LOGO_DURATION_SECONDS
                        - STATUS_DURATION_SECONDS
                        - EYES_DURATION_SECONDS
                    )
                    left.show(render_beer_progress("left", telemetry, animation_time, BEER_DURATION_SECONDS))
                    right.show(render_beer_progress("right", telemetry, animation_time, BEER_DURATION_SECONDS))

            last_mode = mode
            normalized_result = telemetry.last_result.upper()
            if last_result_sound is None:
                last_result_sound = normalized_result
            elif (
                not telemetry.running
                and normalized_result in {"COMPLETE", "OPERATOR", "EMERGENCY", "SHUTDOWN"}
                and normalized_result != last_result_sound
            ):
                play_sound("shutdown")
                last_result_sound = normalized_result

        except Exception as error:
            message = type(error).__name__.upper()
            left.show(render_offline(message))
            right.show(render_offline("MOONRAKER"))

        time.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    main()
