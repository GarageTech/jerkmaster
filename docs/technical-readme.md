<p align="center">
  <img src="../img/logo.png" alt="JerkMaster" width="560">
</p>

<p align="center">
  An open-source smart dehydrator controller for repeatable jerky, fruit, and vegetable drying.
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

# Technical Overview

JerkMaster turns a conventional food dehydrator into a programmable, monitored drying system. It combines a Raspberry Pi, Klipper, Moonraker, a BTT SKR controller, temperature sensors, and SSR-controlled loads with a browser-based control panel.

The project was built around a modified VEVOR dehydrator, but the software and configuration can be adapted to other machines after checking their electrical design, sensors, loads, and safety limits.

## Highlights

- Multi-stage drying profiles with temperature, duration, fan power, and optional target weight loss.
- Custom one-shot drying mode: choose temperature and time, then start.
- Recipe calculator scaled by meat weight.
- Explicit spice-mix dosage per kilogram of meat.
- Salinity presets with soy-sauce salt contribution.
- Ingredient encyclopedia with multilingual names and descriptions.
- CRUD management for ingredients, recipes, and drying profiles.
- Protection against deleting ingredients or profiles that are still in use.
- English, Russian, and Ukrainian interface.
- Live chamber, electronics-bay, and Raspberry Pi temperatures.
- Temperature history chart.
- Moonraker and Klipper integration.
- Emergency-stop command.
- Diagnostic status reporting.
- Demo mode for testing the interface without connected hardware.
- Responsive browser UI with no build step.

## Hardware Used In The Reference Build

- VEVOR H6-C001 food dehydrator
- Raspberry Pi 3 Model B+
- BTT SKR 1.4 Turbo
- Omron G3NA-210B SSRs for heater and circulation fan
- EPCOS 100K NTC sensors for chamber and electronics bay
- Mean Well power supplies
- Independent thermal fuse, protective earth, breaker, and physical emergency stop

VEVOR, Raspberry Pi, BTT, Omron, Mean Well, and the other manufacturers mentioned here are not sponsors or affiliates of this project. Their hardware was simply useful for the build.

## Software Architecture

| Layer | Responsibility |
|---|---|
| Browser UI | Dashboard, calculators, CRUD editors, translations, telemetry, diagnostics |
| Moonraker | HTTP API between the browser and Klipper |
| Klipper | Heater/fan control, sensors, safety limits, and non-blocking drying macros |
| Local storage | User-created and edited ingredients, recipes, profiles, and active drying state |
| JSON files | Default ingredients, recipes, profiles, categories, and translations |

The UI is plain HTML, CSS, and JavaScript. It can be served by any static web server. Default project data remains in the repository; user edits are stored in the browser.

## Quick Start

### Interface Demo

Start the included development server:

```powershell
node tools/dev-server.mjs
```

Then open:

```text
http://127.0.0.1:8080/?demo=1
```

Use `?lang=en`, `?lang=ru`, or `?lang=ua` to choose a language.

### Hardware Installation

1. Read [the installation guide](installation.md).
2. Review [the hardware list](hardware.md) and [wiring notes](wiring.md).
3. Copy and adapt the files from `../klipper/`.
4. Run `tools/install-raspberry-pi.sh` on the Raspberry Pi to install and start the UI.
5. Verify every pin, sensor type, temperature limit, and electrical protection device.
6. Test with mains-powered loads physically disconnected.
7. Connect the UI to Moonraker only after the controller is operating safely.

## Moonraker Connection

By default, the UI connects to port `7125` on the same hostname:

```text
http://<current-host>:7125
```

An alternate Moonraker URL can be supplied:

```text
http://jerkmaster.local:8080/?moonraker=http://192.0.2.50:7125
```

Do not expose Moonraker directly to the public internet. Use a trusted LAN or VPN.

## Klipper Commands

```gcode
START_DRYING PROFILE=JERKY_STANDARD
START_DRYING PROFILE=BANANA_CHIPS
START_DRYING PROFILE=CUSTOM TEMP=60 MINUTES=240
STOP_DRYING
DRYER_ESTOP
```

## Safety

This project controls mains-powered heating equipment. Software is not a substitute for electrical protection.

- Use a qualified electrician for mains wiring.
- Install an independent thermal fuse in series with the heater.
- Use protective earth, correctly rated breakers/fuses, proper enclosures, and a physical emergency stop.
- Assume an SSR can fail closed.
- Never rely on the web UI or software E-stop as the only safety mechanism.
- Verify all configuration values against the actual hardware before energizing loads.

See [SECURITY.md](../SECURITY.md) for reporting software vulnerabilities.

## Project Structure

```text
css/           Interface styles
data/          Default ingredients, categories, and profiles
docs/          Hardware, installation, and wiring notes
img/           Project logo
js/            UI, storage, calculation, telemetry, and diagnostics
klipper/       Klipper, Moonraker, macros, and example G-code
recipes/       Default recipe data
translations/  EN, RU, and UA dictionaries
tools/         Local development server and Raspberry Pi installer
```

## Contributing

Contributions, hardware adaptations, recipes, translations, testing, and safety reviews are welcome. Read [CONTRIBUTING.md](../CONTRIBUTING.md) before opening a pull request.

## License

JerkMaster is released under the [GNU General Public License v3.0](../LICENSE).

Project home: [github.com/GarageTech/jerkmaster](https://github.com/GarageTech/jerkmaster)
