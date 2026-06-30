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

# JerkMaster Installation

JerkMaster is designed to run entirely on the Raspberry Pi that hosts Klipper and
Moonraker. Do not run a second JerkMaster server on another computer. Browsers on
the local network open the Raspberry-hosted interface.

## 1. Install MainsailOS And Klipper

1. Install MainsailOS on the Raspberry Pi.
2. Build Klipper firmware for the `LPC1769` used by the BTT SKR 1.4 Turbo and flash the board.
3. Download the public repository archive or copy the project to the Raspberry Pi.
4. Copy and adapt the contents of `klipper/` to `~/printer_data/config/`.
5. Run `ls /dev/serial/by-id/*` and place the correct result in the `[mcu]` section of `printer.cfg`.
6. Verify and adapt every pin, sensor type, temperature limit, and safety setting in `hardware.cfg`.
7. Copy examples from `klipper/gcodes/` to `~/printer_data/gcodes/`.
8. Merge the required sections from `klipper/moonraker.conf` into the active Moonraker configuration.
9. Restart Moonraker with `sudo systemctl restart moonraker`.
10. Run `RESTART` in the Klipper console and inspect `~/printer_data/logs/klippy.log`.

## 2. Install Or Update JerkMaster

The recommended update command downloads the public `main` archive. It does not
use Git, require a GitHub account, or ask for a repository password:

```bash
curl -fsSL https://raw.githubusercontent.com/GarageTech/jerkmaster/main/tools/update-raspberry-pi.sh -o /tmp/update-jerkmaster.sh
chmod +x /tmp/update-jerkmaster.sh
/tmp/update-jerkmaster.sh
```

The updater downloads a temporary ZIP archive, backs up the active `macros.cfg`,
installs the current macros, copies the interface to `/opt/jerkmaster`, installs
`jerkmaster.service`, and starts it automatically at boot. It removes its
temporary files when finished. Run the same commands for future updates.

User-created and edited ingredients, recipes, and profiles are stored separately
in `/var/lib/jerkmaster/user-data/`. This directory survives interface updates
and is shared by every browser. Back it up with:

```bash
sudo tar -czf ~/jerkmaster-user-data-backup.tar.gz -C /var/lib/jerkmaster user-data
```

Existing edits previously stored in a browser's local storage are not migrated.

Review changes to `printer.cfg`, `hardware.cfg`, and `moonraker.conf` before
copying or merging them, because the updater intentionally leaves these
machine-specific serial, pin, and network settings unchanged. Run `RESTART`
after updating Klipper configuration.

Developers working from a local repository checkout may still run:

```bash
sudo ./tools/install-raspberry-pi.sh
```

Open the interface using the Raspberry Pi hostname:

```text
http://jerkmaster.local:8080/
```

The interface always connects to Moonraker on port `7125` of the same Raspberry Pi
hostname. There is no alternate remote-Moonraker URL.

Useful commands:

```bash
sudo systemctl status jerkmaster
sudo systemctl restart jerkmaster
sudo journalctl -u jerkmaster -f
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/api/user-data/recipes
```

If `jerkmaster.local` does not resolve, verify the Raspberry Pi hostname with
`hostname`, ensure mDNS/Avahi is running, or use the Pi IP address. When using an
IP address, add the exact interface origin, for example
`http://192.0.2.24:8080`, to Moonraker's active `cors_domains` and restart
Moonraker.

Demo mode remains available from the Raspberry-hosted interface:

```text
http://jerkmaster.local:8080/?demo=1
```

## 3. State Restoration

Klipper's `DRYER_STATE` macro is the only authoritative source for an active
drying process. It stores the running flag, recipe, profile, stage, custom
settings, and elapsed time.

After closing or reopening a browser:

- if Klipper reports `running=1`, the dashboard restores that exact process;
- if Klipper reports `running=0`, the dashboard remains stopped and does not
  restore stale browser state;
- if Moonraker is temporarily unavailable, the dashboard waits for Klipper
  instead of guessing whether a process is active.

## 4. Test Before Connecting Mains Loads

Perform the first tests with the heater and fan physically disconnected from the
SSR outputs.

1. At room temperature, both NTC sensors must report plausible and stable values.
2. Run `SET_PIN PIN=dryer_fan VALUE=1`, then `SET_PIN PIN=dryer_fan VALUE=0`.
3. Verify the chamber NeoPixel line with `SET_CHAMBER_LIGHT ON=1`, then `SET_CHAMBER_LIGHT ON=0`.
4. Verify `PS_ON` stays high during normal operation with `SET_PIN PIN=PS_ON VALUE=1`; do not test automatic power-off until the relay behavior is understood.
5. Set a low target with `SET_HEATER_TEMPERATURE HEATER=dryer_heater TARGET=30`.
6. Verify the SSR input control signal, then stop heating with `STOP_DRYING`.
7. Verify that `DRYER_ESTOP` disables outputs and places Klipper into shutdown.
8. Verify the web-interface E-STOP button.

Only connect mains-powered loads after these checks and after the installation
has been reviewed by a qualified electrician.

## 5. Commands

```gcode
START_DRYING PROFILE=JERKY_STANDARD RECIPE=pork_classic
START_DRYING PROFILE=BANANA_CHIPS RECIPE=banana_chips
START_DRYING PROFILE=CUSTOM TEMP=60 MINUTES=240 RECIPE=pork_classic
STOP_DRYING
DRYER_ESTOP
```

After `DRYER_ESTOP`, run `FIRMWARE_RESTART`.

## 6. Optional Dual Round Status Displays

The display service is read-only and communicates with Moonraker locally. Wire
both GC9A01 displays as documented in [Wiring Notes](wiring.md), then install
the service:

```bash
JERKMASTER_INSTALL_DISPLAYS=1 /tmp/update-jerkmaster.sh
```

The display script uses the confirmed Raspberry Pi SPI0 mapping from
[Wiring Notes](wiring.md). The current display runtime keeps its active
hardware constants in the script, so there is no separate display configuration
layer to keep in sync.

The same display install also copies the optional MAX98357A sound assets to
`/opt/jerkmaster-displays/sounds/`. After wiring I2S audio, verify playback with:

```bash
aplay -D hw:1,0 /opt/jerkmaster-displays/sounds/jerkmaster_r2d2.wav
/opt/jerkmaster-displays/sounds/play_sound.py startup
```

Future runs of the standard updater automatically update an already-installed
display service and its sound assets.

Do not expose JerkMaster or Moonraker directly to the public internet. Use a
trusted LAN or VPN.
