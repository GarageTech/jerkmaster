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
| 8x WS2812B chamber NeoPixel ring | NeoPixel | `P1.24` |
| BTT Relay V1.2 shutdown signal | Free output | `P2.0` |
| Blue button LED | BED | `P2.5` |
| Drying-chamber NTC | TH0 | `P0.24` |
| Electronics-bay NTC | TH1 | `P0.23` |
| Raspberry Pi temperature | Built-in SoC sensor | `temperature_host` |

These are common reference assignments, not a guarantee for a specific board revision or installation. Verify the BTT SKR 1.4 Turbo schematic, connector labels, and actual wiring before applying power.

## Momentary Button And BTT Shutdown Relay

The button contains two separate circuits. Verify them with a multimeter before
wiring:

- `COM` and `NO` are the dry momentary switch contacts. Connect these only to
  the BTT relay's documented button-input terminals.
- LED common receives the button manufacturer's specified 12 V polarity.
- The blue LED channel return connects to the BED low-side MOSFET output.
- Unused LED channels remain insulated and disconnected.

The BTT relay mains input may remain energized continuously, but its switched
output should be treated as normal power control only. Do not use the BTT board
as the only device that disconnects heater mains power. A relay board failure,
incorrect wiring, or welded contact must not defeat the thermal fuse, physical
E-stop, breaker, or protective earth.

The recommended power domains are:

| Domain | Power behavior |
|---|---|
| BTT shutdown relay input | Energized after the upstream fuse/breaker |
| Raspberry Pi, SKR, displays, and front fans | Powered from the BTT relay switched output |
| Two Noctua electronics-bay fans | Run continuously whenever electronics power is on |
| Heater and circulation-fan mains | Protected independently; never rely on the BTT relay as a safety disconnect |

Because the Raspberry Pi uses a writable filesystem, cutting its power directly
with the momentary button can corrupt the SD card. A normal shutdown sequence
must first stop drying, turn off heater and circulation fan, request Raspberry
Pi shutdown, wait until shutdown completes, and only then release the BTT relay.
Whether the BTT Power Shutdown Relay V1.2 provides the required hold time and
signal behavior must be verified against the exact module documentation before
connecting mains power.

### Button LED State Logic

Proposed visible states:

| State | Blue LED | Meaning |
|---|---|---|
| OFF | Off | Electronics power is off |
| READY | Steady | Klipper is ready and no drying process is active |
| RUNNING | Slow blink | A drying or cooling stage is active |
| COMPLETE | Fast blink | The last drying process completed normally |
| ERROR | Off | Error details are shown on the round displays and web interface |

Use `shutdown_value: 0` for every LED output. The LED ring must not illuminate
unexpectedly while firmware is restarting.

Suggested software ownership:

- Klipper owns the blue channel because `DRYER_STATE` already defines READY,
  RUNNING, and COMPLETE.
- Errors are shown on the round displays and web interface; the blue ring turns
  off because SKR outputs assume their shutdown value during a Klipper fault.
- OFF is a physical state after the BTT relay removes electronics power; it is
  not a software animation.

The SKR `PS_ON` output on `P2.0` is used as the BTT relay shutdown signal. In
Klipper it defaults high while the controller is alive and drops low on firmware
shutdown or after the programmed completion delay. Verify the exact relay
module behavior on the bench before relying on automatic power-off.

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
- Power the WS2812B ring from a suitable 5 V rail, observe data direction, and verify that the total LED current is within the regulator and wiring ratings.
- Verify the BTT Relay V1.2 shutdown input polarity before connecting `P2.0`.
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
