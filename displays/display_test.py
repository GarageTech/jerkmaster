#!/usr/bin/env python3
"""Simple GC9A01 wiring test: left display red, right display green."""

import time

from gpiozero import OutputDevice
from PIL import Image

from jerkmaster_displays import (
    BL_ACTIVE_LOW,
    DC_PIN,
    GC9A01,
    LEFT_BL_PIN,
    LEFT_FLIP,
    LEFT_MIRROR,
    LEFT_ROTATION,
    LEFT_SPI_DEVICE,
    RST_PIN,
    RIGHT_BL_PIN,
    RIGHT_FLIP,
    RIGHT_MIRROR,
    RIGHT_ROTATION,
    RIGHT_SPI_DEVICE,
    Backlight,
    open_spi,
)


def main():
    left_spi = open_spi(LEFT_SPI_DEVICE)
    right_spi = open_spi(RIGHT_SPI_DEVICE)
    dc = OutputDevice(DC_PIN, initial_value=True)
    reset = OutputDevice(RST_PIN, initial_value=True)

    reset.on()
    time.sleep(0.05)
    reset.off()
    time.sleep(0.05)
    reset.on()
    time.sleep(0.15)

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

    left.initialize()
    right.initialize()
    left.show(Image.new("RGB", (240, 240), "#ff0000"))
    right.show(Image.new("RGB", (240, 240), "#00ff00"))


if __name__ == "__main__":
    main()
