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

## 1. Prepare Klipper

1. Install MainsailOS on the Raspberry Pi.
2. Build Klipper firmware for the `LPC1769` used by the BTT SKR 1.4 Turbo, then flash the board.
3. Copy the contents of `klipper/` to `~/printer_data/config/`.
4. Run `ls /dev/serial/by-id/*` and place the correct result in the `[mcu]` section of `printer.cfg`.
5. Verify and adapt every pin in `hardware.cfg`.
6. Copy examples from `klipper/gcodes/` to `~/printer_data/gcodes/`.
7. Merge the required sections from `klipper/moonraker.conf` into the active Moonraker configuration.
8. Restart Moonraker with `sudo systemctl restart moonraker`.
9. Run `RESTART` and inspect the Klipper log.

## 2. Test Before Connecting Mains Loads

Perform the first tests with the heater and fan physically disconnected from the SSR outputs.

1. At room temperature, both NTC sensors must report plausible and stable values.
2. Run `SET_PIN PIN=dryer_fan VALUE=1`, then `SET_PIN PIN=dryer_fan VALUE=0`.
3. Set a low target with `SET_HEATER_TEMPERATURE HEATER=dryer_heater TARGET=30`.
4. Verify the SSR input control signal, then stop heating with `STOP_DRYING`.
5. Verify that `DRYER_ESTOP` disables outputs and places Klipper into shutdown.
6. Verify the web-interface E-STOP button, which calls Moonraker's `/printer/emergency_stop` endpoint.

Only connect mains-powered loads after these checks and after the installation has been reviewed by a qualified electrician.

## 3. Commands

```gcode
START_DRYING PROFILE=JERKY_STANDARD
START_DRYING PROFILE=BANANA_CHIPS
START_DRYING PROFILE=CUSTOM TEMP=60 MINUTES=240
STOP_DRYING
DRYER_ESTOP
```

After `DRYER_ESTOP`, run `FIRMWARE_RESTART`.

## 4. Web Interface And Moonraker

### Run JerkMaster On The Raspberry Pi

Clone or copy the complete JerkMaster repository to the Raspberry Pi, then run:

```bash
cd ~/jerkmaster
chmod +x tools/install-raspberry-pi.sh
./tools/install-raspberry-pi.sh
```

The installer copies the web interface to `/opt/jerkmaster`, installs the
`jerkmaster.service` system service, and starts it automatically on every boot.
Open the interface from another computer or phone on the same network:

```text
http://<raspberry-pi-hostname>.local:8080/
```

To update the installed interface, pull or copy a newer repository version and
run `./tools/install-raspberry-pi.sh` again.

Useful service commands:

```bash
sudo systemctl status jerkmaster
sudo systemctl restart jerkmaster
sudo journalctl -u jerkmaster -f
```

The interface connects to Moonraker on port `7125` of the current hostname by default.

An alternate URL can be provided:

```text
http://jerkmaster.local:8080/?moonraker=http://192.168.1.50:7125
```

If the interface reports `Moonraker unavailable: Failed to fetch`, add its
exact origin to the `[authorization]` section of the active
`~/printer_data/config/moonraker.conf`:

```ini
[authorization]
cors_domains:
  http://jerkmaster.local:8080
```

Keep any existing `cors_domains` entries, then restart Moonraker:

```bash
sudo systemctl restart moonraker
```

Demo mode:

```text
http://jerkmaster.local:8080/?demo=1
```

Do not expose Moonraker directly to the public internet. Use a trusted LAN or VPN.
