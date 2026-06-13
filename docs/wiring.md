<p align="center">
  <img src="../img/logo.png" alt="JerkMaster" width="560">
</p>

<p align="center">
  <a href="../README.md">About</a> ·
  <a href="technical-readme.md">Technical overview</a> ·
  <a href="build-notes.md">Build notes</a> ·
  <a href="about-recipes.md">Recipes</a> ·
  <a href="installation.md">Installation</a> ·
  <a href="hardware.md">Hardware</a> ·
  <a href="wiring.md">Wiring</a> ·
  <a href="../SECURITY.md">Safety</a>
</p>

# Wiring Notes

## Reference Pin Mapping

| Purpose | BTT SKR 1.4 Turbo connector | Klipper pin |
|---|---|---|
| Heater SSR input | HE0 | `P2.7` |
| Fan SSR input | FAN0 | `P2.3` |
| 12 V chamber LED light | HE1 | `P2.4` |
| Drying-chamber NTC | TH0 | `P0.24` |
| Electronics-bay NTC | TH1 | `P0.23` |
| Raspberry Pi temperature | Built-in SoC sensor | `temperature_host` |

These are common reference assignments, not a guarantee for a specific board revision or installation. Verify the BTT SKR 1.4 Turbo schematic, connector labels, and actual wiring before applying power.

## Optional Dual Round Status Displays

Two Waveshare 1.28-inch GC9A01 displays can share one Raspberry Pi SPI bus.
They are read-only status displays; they do not control the drying process.

| Display signal | Left display | Right display | Raspberry Pi BCM pin |
|---|---|---|---|
| VCC | Shared | Shared | 3.3 V |
| GND | Shared | Shared | GND |
| DIN / MOSI | Shared | Shared | GPIO10 |
| CLK / SCLK | Shared | Shared | GPIO11 |
| DC | Shared | Shared | GPIO25 |
| RST | Shared | Shared | GPIO27 |
| CS | Dedicated | - | GPIO8 / CE0 |
| CS | - | Dedicated | GPIO7 / CE1 |
| BL | Dedicated | - | GPIO18 |
| BL | - | Dedicated | GPIO19 |

The left screen shows chamber temperature, target temperature, heater and fan
state. The right screen shows stage, circular progress, remaining time, bay
temperature and Raspberry Pi temperature.

## Critical Safety Requirements

- Verify the exact SSR model, input voltage, output type, load rating, and heatsink requirements.
- Supply the HE1 power section with exactly 12 V and verify that the LED light current is within the board output rating before connecting it.
- Observe LED polarity. The SKR HE1 MOSFET output switches the negative side of the load.
- Install an independent one-shot thermal fuse in series with the heater.
- Install a physical emergency stop that removes heater power.
- Use protective earth, correctly rated breakers/fuses, suitable conductors, strain relief, and a closed non-combustible enclosure.
- Do not use the software E-stop as the only protection.
- Assume an SSR can fail closed.
- Keep low-voltage control wiring separated from mains wiring.
- Have mains wiring inspected by a qualified electrician.

## Suggested Verification Order

1. Continuity and protective-earth checks.
2. Sensor readings with mains loads disconnected.
3. Low-voltage controller-output checks.
4. SSR input checks without connected loads.
5. Heater and fan tests under supervision.
6. Thermal-fuse and physical E-stop verification.
