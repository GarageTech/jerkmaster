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

This document describes the current JerkMaster `0.2.0-alpha` wiring
architecture for the reference hardware revision:

- Raspberry Pi 3B+ for UI, round displays, sound, animations, and Moonraker access.
- BTT SKR 1.4 Turbo for heater, fan, sensors, door switch, buttons, button LEDs, and power control.
- BTT Power Shutdown Relay V1.2 for controlled electronics power cut after shutdown.
- Two GC9A01 round status displays on Raspberry Pi SPI0.
- MAX98357A I2S amplifier on Raspberry Pi GPIO18/GPIO19/GPIO21.
- Factory chamber lighting was 4 pcs 12 V LEDs; JerkMaster control uses the
  replacement 8x WS2812B NeoPixel chamber-light ring.
- One momentary power/wake button connected to BTT Relay RESET.
- One additional momentary action/shutdown button connected to the SKR.
- Two 12 V-ready button LEDs controlled by SKR MOSFET outputs.

These assignments are based on the current prototype. Verify the actual board
revision, connector labels, polarity, and wiring before applying power.

## System Ownership

JerkMaster is split into two control layers.

| Layer | Owns | Notes |
|---|---|---|
| Raspberry Pi 3B+ | Round displays, sound, UI personality, animations, Moonraker client | Does not directly switch heater or fan power |
| BTT SKR 1.4 Turbo | Heater control, fan control, thermistors, door switch, buttons, button LEDs, PS_ON | Owns real-time and safety-related low-voltage I/O |
| BTT Relay V1.2 | Electronics power cut after shutdown | Not a heater safety device |

The Raspberry Pi is the face of the product. The SKR is the hardware
controller. The BTT Relay is only a controlled electronics power switch.

## Reference SKR Pin Mapping

| Purpose | BTT SKR 1.4 Turbo connector | Klipper pin |
|---|---|---|
| Heater SSR input | HE0 | `P2.7` |
| Circulation fan SSR input | FAN0 | `P2.3` |
| 8x WS2812B chamber NeoPixel ring | NeoPixel | `P1.24` |
| BTT Relay V1.2 shutdown / hold signal | Free output / PS_ON line | `P2.0` |
| Power button LED, 12 V-ready | BED MOSFET | `P2.5` |
| Action/shutdown button LED, 12 V-ready | HE1 MOSFET | `P2.4` |
| Drying-chamber NTC | TH0 | `P0.24` |
| Electronics-bay NTC | TH1 | `P0.23` |
| Action/shutdown button contacts | X_MIN | `P1.29` |
| Door microswitch, NC | Y_MIN | `P1.27` |
| Raspberry Pi temperature | Built-in SoC sensor | `temperature_host` |

Do not connect LEDs to TH0/TH1 thermistor inputs. Button LEDs are 12 V-ready and
must be switched only by MOSFET outputs such as BED, HE0, HE1, or FAN outputs.

## BTT Power Shutdown Relay V1.2

Current confirmed behavior:

- On mains/input power application, the BTT Relay V1.2 turns on automatically.
- The RESET button is used to restart the relay after a relay shutdown.
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

Recommended shutdown behavior:

```text
Shutdown request through the `SAFE_SHUTDOWN` Klipper macro
  -> display service plays shutdown sound on the next state update
  -> stop heater
  -> place circulation fan in a safe state
  -> send SET_PIN PIN=PS_ON VALUE=0
  -> BTT Relay removes electronics power
```

The current Klipper macro performs the load shutdown and `PS_ON` cut. Filesystem
sync or a full Linux halt must be handled by Raspberry-side service logic if a
future deployment requires that extra shutdown path.

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

Do not connect the BTT RESET 5 V signal directly to Raspberry Pi GPIO.

## Action Button

The second momentary button is connected to the SKR `X_MIN` input.

| Press type | Function |
|---|---|
| Short press | Reserved for future UI action / confirm / menu handling |
| Long press, about 3 s | Reserved for local display action |

Current Klipper input:

```ini
[gcode_button action_button]
pin: ^!P1.29
press_gcode:
    ACTION_BUTTON_PRESSED
release_gcode:
    ACTION_BUTTON_RELEASED
```

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
| Action/shutdown button LED | HE1 | User action / running / warning state |

Implemented visible states:

| State | Power LED | Action LED |
|---|---|---|
| Ready / idle | Steady on | Off |
| Action button held | Steady on | Steady on |
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

The door microswitch is connected to the SKR `Y_MIN` input.

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
pin: ^!P1.27
press_gcode:
    DOOR_CLOSED
release_gcode:
    DOOR_OPEN
```

With the recommended NC wiring, closed-to-GND reads as `DOOR_CLOSED`; an open
door or broken wire releases the input and runs `DOOR_OPEN`. When the door
closes, `DRYER_RESUME_AFTER_DOOR` resumes the same drying stage with the saved
elapsed time and remaining duration.

## Raspberry Pi Round Displays

Two Waveshare / GC9A01 1.28-inch round displays share Raspberry Pi SPI0.

Confirmed current mapping:

| Display signal | Left display | Right display | Raspberry Pi BCM | Physical pin |
|---|---|---|---|---|
| VCC | Shared | Shared | 3.3 V | pin 17 |
| GND | Shared | Shared | GND | pin 14 or any GND |
| DIN / MOSI | Shared | Shared | GPIO10 | pin 19 |
| CLK / SCLK | Shared | Shared | GPIO11 | pin 23 |
| DC | Shared | Shared | GPIO25 | pin 22 |
| RST | Shared | Shared | GPIO27 | pin 13 |
| CS | CE0 | - | GPIO8 | pin 24 |
| CS | - | CE1 | GPIO7 | pin 26 |
| BL | GPIO5 | - | GPIO5 | pin 29 |
| BL | - | GPIO6 | GPIO6 | pin 31 |

Notes:

- `BL_ACTIVE_LOW = False` is confirmed for the current display modules.
- The left screen is on `SPI_DEVICE = 0`, BL `GPIO5`.
- The right screen is on `SPI_DEVICE = 1`, BL `GPIO6`.
- Both screens are mirrored in the current display script.
- SPI speed `4 MHz` is the confirmed safe speed; higher speeds can be tested later.

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
| Active drying beer scene starts | `jerkmaster_beer.wav` |
| Temporary Raspberry test/game button, if enabled | `jerkmaster_r2d2.wav` |
| Completed, stopped, emergency, or shutdown result | `jerkmaster_shutdown.wav` |

Important config note: on the current system, I2S overlay placement in
`/boot/firmware/config.txt` matters. The working I2S configuration was added in
the upper `[all]` section, not in the lower Mainsail-specific `[all]` block.

## Safe Shutdown Architecture

The current practical safe-cut sequence is:

```text
Shutdown request through the `SAFE_SHUTDOWN` Klipper macro
  -> stop dryer process
  -> heater output off
  -> circulation fan safe/off
  -> chamber light off
  -> button LEDs enter shutdown-pending pattern
  -> display service plays shutdown sound on the next state update
  -> SET_PIN PIN=PS_ON VALUE=0
  -> BTT Relay removes electronics power
```

This is not the same as a full PC-style soft shutdown. It is a controlled
Klipper/Moonraker power cut for the BTT Relay. Add Raspberry-side filesystem
sync/halt logic later if the installation needs a full Linux shutdown path
before relay release.

The exact implementation can be done through Moonraker remote methods, a
Klipper macro, and/or a systemd shutdown service. Do not rely on pulling the
mains plug as a normal shutdown method.

## Critical Safety Requirements

- Verify the exact SSR model, input voltage, output type, load rating, and heatsink requirements.
- Power the WS2812B ring from a suitable 5 V rail, observe data direction, and verify that total LED current is within the regulator and wiring ratings.
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
10. Confirm door microswitch input.
11. Confirm heater/fan SSR input checks without connected loads.
12. Heater and fan tests under supervision.
13. Thermal-fuse and physical E-stop verification.
