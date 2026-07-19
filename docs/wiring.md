<p align="center">
  <img src="../img/logo.png" alt="JerkMaster" width="560">
</p>

<p align="center">
  <a href="../README.md">About</a> |
  <a href="technical-readme.md">Technical overview</a> |
  <a href="build-notes.md">Build notes</a> |
  <a href="about-recipes.md">Recipes</a> |
  <a href="installation.md">Installation</a> |
  <a href="hardware.md">Hardware</a> |
  <a href="wiring.md">Wiring</a> |
  <a href="../SECURITY.md">Safety</a>
</p>

# Wiring Notes

This document describes the current JerkMaster `0.2.1-alpha` wiring
architecture for the reference hardware revision:

- Raspberry Pi 3B+ for UI, round displays, sound, animations, Moonraker access, and shutdown orchestration.
- BTT SKR 1.4 Turbo for heater, fan, sensors, door switch, action button, button LEDs, and power control.
- BTT Power Shutdown Relay V1.2 for controlled electronics power cut after shutdown.
- Two GC9A01 round status displays on Raspberry Pi SPI0.
- MAX98357A I2S amplifier on Raspberry Pi GPIO18/GPIO19/GPIO21.
- Factory chamber lighting was 4 pcs 12 V LEDs; JerkMaster control uses the
  replacement 8x WS2812B NeoPixel chamber-light line.
- One momentary power/wake button connected to BTT Relay RESET.
- One additional momentary action/shutdown button connected to SKR `Y-STOP` / `P1.28`.
- Two 12 V-ready button LEDs controlled by SKR MOSFET outputs.
- Two Noctua NF-A4x10 FLX electronics-bay cooling fans connected to SKR `FAN1`
  and `FAN3`.

These assignments are based on the current prototype. Verify the actual board
revision, connector labels, polarity, and wiring before applying power.

## System Ownership

JerkMaster is split into two control layers.

| Layer | Owns | Notes |
|---|---|---|
| Raspberry Pi 3B+ | Round displays, sound, UI personality, animations, Moonraker client, Linux shutdown orchestration | Requests shutdown, does not directly switch heater or fan power |
| BTT SKR 1.4 Turbo | Heater control, fan control, thermistors, door switch, action button, button LEDs, PS_ON | Owns real-time and safety-related low-voltage I/O |
| BTT Relay V1.2 | Electronics power cut after shutdown | Not a heater safety device |

The Raspberry Pi is the face of the product. The SKR is the hardware
controller. The BTT Relay is only a controlled electronics power switch.

## Reference SKR Pin Mapping

| Purpose | BTT SKR 1.4 Turbo connector | Klipper pin |
|---|---|---|
| Heater SSR input | HE0 | `P2.7` |
| Circulation fan SSR input | FAN0 | `P2.3` |
| 8x WS2812B chamber NeoPixel line | NeoPixel | `P1.24` |
| BTT Relay V1.2 shutdown / hold signal | Free output / PS_ON line | `P2.0` |
| Power button LED, 12 V-ready | BED MOSFET | `P2.5` |
| Action button LED, 12 V-ready | HE1 MOSFET | `P2.4` |
| Action button, NO | Y-STOP | `P1.28` |
| Drying-chamber NTC | TH0 | `P0.24` |
| Electronics-bay NTC | TH1 | `P0.23` |
| Door microswitch, NC | Z-STOP | `P1.29` |
| Raspberry Pi temperature | Built-in SoC sensor | `temperature_host` |

Do not connect LEDs to TH0/TH1 thermistor inputs. Button LEDs are 12 V-ready and
must be switched only by MOSFET outputs such as BED, HE0, HE1, or FAN outputs.

Electronics-bay cooling uses 2 pcs Noctua NF-A4x10 FLX fans connected to SKR
`FAN1` and `FAN3`. They are separate from the AC circulation fan on `FAN0`.

## BTT Power Shutdown Relay V1.2

Current confirmed behavior:

- On mains/input power application, the BTT Relay V1.2 turns on automatically.
- The RESET button is used to restart the relay after a relay shutdown.
- The BTT Relay firmware is not modified.
- The current RESET button wiring presents approximately 5 V on one contact and
  0 V on the other; pressing the button applies 5 V to the relay RESET input.
- PS_ON from SKR is connected to `P2.0`.

Current Klipper output:

```ini
[output_pin PS_ON]
pin: P2.0
value: 1
shutdown_value: 0
```

Expected behavior:

| State | PS_ON | Relay |
|---|---:|---|
| SKR/Klipper alive | 1 | Electronics remain powered |
| Shutdown / Klipper fault | 0 | Relay releases power |
| After relay shutdown | - | Press RESET button to wake/start again |

Important limitation: the BTT Relay V1.2 is not a PC-style soft power button. It
does not wait for the button when input power first appears. It auto-starts.

Recommended shutdown behavior from SKR `Y-STOP` / `P1.28` long press:

```text
Shutdown request from action button long press
  -> Klipper runs `SAFE_SHUTDOWN`
  -> Klipper stops the heater
  -> Klipper sets the circulation fan safe/off
  -> set `INPUT_STATE.shutdown_pending=1`
  -> display service shows the shutdown screen and plays the shutdown sound
  -> Raspberry Pi runs `sync`
  -> Raspberry Pi runs `systemctl poweroff`
  -> poweroff/halt-only systemd service releases `PS_ON` late during Linux shutdown
  -> delayed Klipper fallback releases `PS_ON` after 60 seconds if needed
  -> BTT Relay removes electronics power
```

Neither the Raspberry button handler nor the Klipper macro should immediately
cut `PS_ON`. The installed Raspberry service
`jerkmaster-poweroff-relay.service` is wanted only by `poweroff.target` and
`halt.target`; it is not wanted by `reboot.target`. Its helper also checks the
active systemd jobs and exits without touching `PS_ON` if a reboot is in
progress. The 60-second Klipper fallback is only a hardware failsafe in case the
Raspberry Pi never reaches the late shutdown service.

`SAFE_SHUTDOWN` is a Klipper load-safe/pending macro. It does not directly cut
power. The Raspberry Pi display service watches the Klipper shutdown-pending
state, starts Linux poweroff, and lets the late shutdown service release the
relay.

Do not use the BTT Relay as the only heater safety disconnect. It controls
electronics power only.

## Power / Wake Button

The existing momentary button remains connected to the BTT Relay RESET input.

| Button circuit | Connection |
|---|---|
| Momentary contacts | BTT Relay V1.2 RESET terminals |
| LED + | +12 V |
| LED - | SKR BED MOSFET negative output |

The RESET button is treated as a wake/restart button after BTT relay shutdown.
It is not used as the primary software shutdown request because its relay-side
signal is 5 V and belongs to the BTT Relay input circuit.
RESET is not a normal power button; software shutdown is initiated from the
SKR `Y-STOP` / `P1.28` action button.

Do not connect the BTT RESET 5 V signal directly to Raspberry Pi GPIO.

## User / Action Button

The second momentary button is connected to SKR `Y-STOP`, pin `P1.28`. The
other switch contact goes to GND. Klipper uses the SKR input pull-up:

```ini
[gcode_button action_button]
pin: ^!P1.28
press_gcode:
    ACTION_BUTTON_PRESSED
release_gcode:
    ACTION_BUTTON_RELEASED
```

Recommended wiring is normally open (NO):

```text
Button released -> input released by pull-up
Button pressed  -> input connected to GND
```

| Press type | Function |
|---|---|
| Short press | Local action / confirm / menu / display event |
| Long press, about 2.8 s | Request safe Raspberry shutdown |

Short presses are recorded by Klipper for the Raspberry Pi display service.
Long press is detected in Klipper, which sets the shutdown-pending state; the
Raspberry Pi display service then asks Linux to shut down. It does not cut
`PS_ON` directly before Linux shutdown begins.

Button LED wiring:

| Button LED terminal | Connection |
|---|---|
| LED + | +12 V |
| LED - | SKR HE1 MOSFET negative output |

Because the LEDs are 12 V-ready, no extra series resistor is required.

## Button LED Outputs

The two 12 V button LEDs are controlled as low-side MOSFET loads.

```text
+12 V  -> LED+
LED-   -> SKR MOSFET output negative terminal
```

Recommended ownership:

| LED | SKR output | Suggested meaning |
|---|---|---|
| Power/wake button LED | BED | Device ready / power state |
| Action button LED | HE1 | User action / running / warning state |

Implemented visible states:

| State | Power LED | Action LED |
|---|---|---|
| Ready / idle | Steady on | Off |
| Drying active | Steady on | Slow pulse |
| Complete | Steady on | Fast blink |
| Door open | Steady on | Fast warning blink |
| Emergency | Fast blink | Fast blink |
| Shutdown pending | Slow pulse | Off |
| Relay off | Off | Off |

Use `shutdown_value: 0` for both LED outputs.

Current Klipper placeholders:

```ini
[output_pin power_button_led]
pin: P2.5
pwm: True
cycle_time: 0.02
value: 0
shutdown_value: 0

[output_pin action_button_led]
pin: P2.4
pwm: True
cycle_time: 0.02
value: 0
shutdown_value: 0
```

The hardware outputs are PWM-capable. The current Klipper macros run these
effects through the `BUTTON_LED_EFFECTS` delayed-gcode loop, so the Raspberry Pi
does not generate button LED PWM patterns.

## Door Microswitch

The door microswitch is connected to the SKR `Z-STOP` input, `P1.29`.

Recommended wiring is normally closed (NC):

```text
Door closed  -> input connected to GND
Door open    -> input released by pull-up
Wire broken  -> input released by pull-up
```

This is fail-safer than normally open wiring because an open circuit looks like
an open door.

Implemented behavior when the door opens:

- Turn heater off immediately.
- Keep circulation fan in a safe state if needed.
- Pause the active drying stage timer.
- Show `DOOR OPEN` on the round displays.
- Play the warning/action sound.
- Turn the chamber NeoPixel light on.
- Blink the action button LED.

Example placeholder:

```ini
[gcode_button door_switch]
pin: ^!P1.29
press_gcode:
    DOOR_CLOSED
release_gcode:
    DOOR_OPEN
```

With the recommended NC wiring, closed-to-GND reads as `DOOR_CLOSED`; an open
door or broken wire releases the input and runs `DOOR_OPEN`. When the door
closes, `DRYER_RESUME_AFTER_DOOR` resumes the same drying stage with the saved
elapsed time and remaining duration.

If testing shows the active logic inverted on the specific SKR input, keep the
NC wiring concept and swap the `press_gcode` / `release_gcode` behavior instead.

## Raspberry Pi Round Displays

Two Waveshare / GC9A01 1.28-inch round displays share Raspberry Pi SPI0.

Confirmed current mapping:

| Display signal | Left display | Right display | Raspberry Pi BCM | Physical pin |
|---|---|---|---|---|
| VCC | Shared | Shared | 3.3 V | pin 17 |
| GND | Shared | Shared | GND | pin 20 |
| DIN / MOSI | Shared | Shared | GPIO10 | pin 19 |
| CLK / SCLK | Shared | Shared | GPIO11 | pin 23 |
| DC | Shared | Shared | GPIO25 | pin 22 |
| RST | Shared | Shared | GPIO27 | pin 13 |
| CS | CE1 | - | GPIO7 | pin 26 |
| CS | - | CE0 | GPIO8 | pin 24 |
| BL | GPIO6 | - | GPIO6 | pin 31 |
| BL | - | GPIO5 | GPIO5 | pin 29 |

Notes:

- `BL_ACTIVE_LOW = False` is confirmed for the current display modules.
- The left screen is on `SPI_DEVICE = 1`, BL `GPIO6`.
- The right screen is on `SPI_DEVICE = 0`, BL `GPIO5`.
- `RIGHT_MIRROR = True` is confirmed in the current display script.
- SPI speed `32 MHz` is confirmed for the current wiring.

## Raspberry Pi MAX98357A I2S Audio

The lower rows `1-5` in the current pinout sheet are the sound module wiring,
not additional display wiring.

MAX98357A wiring:

| MAX98357A signal | Wire color | Raspberry Pi signal | Physical pin |
|---|---|---|---|
| VIN | Violet | 5 V | pin 2 |
| GND | White 3 | GND | pin 6 or any GND |
| BCLK / BCK | Green | GPIO18 | pin 12 |
| LRC / WS | Orange | GPIO19 | pin 35 |
| DIN | Yellow | GPIO21 | pin 40 |

Confirmed ALSA result:

```text
card 1: sndrpirpidac [snd_rpi_rpi_dac]
device 0: RPi-DAC HiFi pcm1794a-hifi-0
```

Confirmed speaker test:

```bash
speaker-test -D hw:1,0 -c 2 -t sine
```

Mono `-c 1` is not supported by this card. Use 2 channels or `plughw`.

Example playback:

```bash
aplay -D hw:1,0 jerkmaster_r2d2.wav
```

The display service plays the installed sounds directly:

| Event | Sound |
|---|---|
| Display service startup | `jerkmaster_startup.wav` |
| Action button press | `jerkmaster_r2d2.wav` |
| Door open / warning | `jerkmaster_r2d2.wav` |
| Active drying beer scene starts | `jerkmaster_beer.wav` |
| Local action feedback | `jerkmaster_r2d2.wav` |
| Completed, stopped, emergency, or shutdown result | `jerkmaster_shutdown.wav` |

Playback uses ALSA device `hw:1,0` with stereo output. Mono `-c 1` is not
supported on the current MAX98357A card.

Important config note: on the current system, I2S overlay placement in
`/boot/firmware/config.txt` matters. The working I2S configuration was added in
the upper `[all]` section, not in the lower Mainsail-specific `[all]` block.

## Safe Shutdown Architecture

The current practical safe-cut sequence is:

```text
Shutdown request from SKR Y-STOP / P1.28 long press
  -> Klipper runs `SAFE_SHUTDOWN`
  -> Klipper stops dryer process
  -> Klipper turns heater output off
  -> Klipper sets circulation fan safe/off
  -> chamber light off
  -> button LEDs enter shutdown-pending pattern
  -> display service sees shutdown-pending state
  -> displays show the shutdown screen and play the shutdown sound
  -> Raspberry Pi syncs the filesystem
  -> Raspberry Pi starts Linux poweroff
  -> Raspberry shutdown syncs/stops services
  -> `jerkmaster-poweroff-relay.service` sends `SET_PIN PIN=PS_ON VALUE=0`
  -> BTT Relay removes electronics power
```

This is a software-controlled safe shutdown path. Do not pull the mains plug as
the normal shutdown method. If Moonraker host shutdown is unavailable, the
Klipper fallback releases `PS_ON` after 60 seconds as a hardware failsafe.
Normal reboot must keep `PS_ON` high.

## Critical Safety Requirements

- Verify the exact SSR model, input voltage, output type, load rating, and heatsink requirements.
- Power the WS2812B line from a suitable 5 V rail, observe data direction, and verify that total LED current is within the regulator and wiring ratings.
- Verify the BTT Relay V1.2 PS_ON / shutdown polarity before relying on automatic power-off.
- Install an independent one-shot thermal fuse in series with the heater.
- Install a physical emergency stop that removes heater power.
- Use protective earth, correctly rated breakers/fuses, suitable conductors, strain relief, and a closed non-combustible enclosure.
- Do not use software E-stop, Klipper, Raspberry Pi, or BTT Relay as the only protection.
- Assume an SSR can fail closed.
- Keep low-voltage control wiring separated from mains wiring.
- Have mains wiring inspected by a qualified electrician.

## Suggested Verification Order

1. Continuity and protective-earth checks.
2. Confirm Raspberry Pi boots and Wi-Fi survives reboot.
3. Confirm SKR connection and Klipper readiness.
4. Confirm PS_ON high keeps BTT Relay on.
5. Confirm PS_ON low releases BTT Relay on the bench.
6. Confirm display test: left red / right green.
7. Confirm final display script with mirroring.
8. Confirm MAX98357A sound with `speaker-test -D hw:1,0 -c 2 -t sine`.
9. Confirm button LED outputs with no mains loads connected.
10. Confirm action button input on SKR `Y-STOP` / `P1.28`.
11. Confirm door microswitch input on SKR `Z-STOP` / `P1.29`.
12. Confirm heater/fan SSR input checks without connected loads.
13. Heater and fan tests under supervision.
14. Thermal-fuse and physical E-stop verification.
