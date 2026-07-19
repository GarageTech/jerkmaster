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

# JerkMaster Installation

JerkMaster runs on the same Raspberry Pi that hosts Klipper and Moonraker. Do
not run a second local-computer server path; browsers on the LAN open the
Raspberry-hosted interface.

## 1. Prerequisites

1. Install MainsailOS on the Raspberry Pi 3B+.
2. Build and flash Klipper firmware for the BTT SKR 1.4 Turbo LPC1769.
3. Connect the SKR USB cable so it appears under `/dev/serial/by-id/`.
4. Clone or copy this repository to the Raspberry Pi.
5. Wire the hardware as documented in [Wiring Notes](wiring.md).

The bootstrap script is intentionally interactive where hardware-specific
choices matter. It does not guess between multiple MCU serial devices.

## 2. Bootstrap A Fresh Raspberry

From the repository checkout on the Raspberry Pi:

```bash
sudo ./tools/bootstrap.sh
```

The bootstrap performs the installation steps that used to be manual:

- installs only missing system packages;
- detects the SKR MCU serial device and writes it into `printer.cfg`;
- generates `printer.cfg` from `klipper/printer.cfg.template`;
- installs `hardware.cfg` from `klipper/hardware.cfg.template`;
- installs `macros.cfg` and example G-code files;
- merges the required Moonraker sections into the active `moonraker.conf`;
- backs up changed Klipper and Moonraker files before replacing or merging;
- installs the Raspberry web service;
- installs the dual-display and sound service;
- optionally enables MAX98357A I2S audio in the upper `[all]` section of
  `/boot/firmware/config.txt`;
- optionally runs the display and stereo audio tests.

If the I2S audio option changed `/boot/firmware/config.txt`, reboot the
Raspberry Pi before testing audio.

## 3. Update An Existing Install

The standard updater refreshes the Raspberry web service, Klipper macros,
display service, sound assets, and shutdown relay service without changing
machine-specific `printer.cfg`, `hardware.cfg`, or `moonraker.conf` values:

```bash
curl -fsSL https://raw.githubusercontent.com/GarageTech/jerkmaster/main/tools/update-raspberry-pi.sh -o /tmp/update-jerkmaster.sh
chmod +x /tmp/update-jerkmaster.sh
/tmp/update-jerkmaster.sh
```

Developers working from a local checkout may run:

```bash
sudo ./tools/install-raspberry-pi.sh
sudo ./tools/install-displays.sh
```

User-created and edited ingredients, recipes, and profiles are stored in
`/var/lib/jerkmaster/user-data/`. This directory survives interface updates.
Back it up with:

```bash
sudo tar -czf ~/jerkmaster-user-data-backup.tar.gz -C /var/lib/jerkmaster user-data
```

## 4. Open The Interface

Open the Raspberry-hosted interface:

```text
http://jerkmaster.local:8080/
```

The interface connects to Moonraker on port `7125` of the same Raspberry Pi
hostname. There is no alternate remote-Moonraker URL.

Useful service checks:

```bash
sudo systemctl status jerkmaster
sudo systemctl restart jerkmaster
sudo journalctl -u jerkmaster -f
curl -fsS http://127.0.0.1:8080/health
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

## 5. Required Verification

After bootstrap:

1. Run `RESTART` in the Klipper console.
2. Inspect `~/printer_data/logs/klippy.log`.
3. Run a short `CUSTOM` drying test with loads disconnected and verify that the
   timed stage enters cooling, waits for chamber temperature to reach 30 C, and
   only then schedules the ten-minute automatic power-off delay.
4. Complete [Final Hardware Checklist](final-checklist.md).

The first heater and fan tests must be performed with mains loads physically
disconnected from SSR outputs. Only connect mains-powered loads after the
checklist passes and the installation has been reviewed by a qualified
electrician.

## 6. Display And Audio Tests

The display service uses the confirmed Raspberry Pi SPI0 mapping from
[Wiring Notes](wiring.md). The display runtime keeps the active hardware
constants in `displays/jerkmaster_displays.py`; there is no separate display
configuration layer.

To test the display wiring, stop the service and paint the confirmed left
display red and right display green:

```bash
sudo systemctl stop jerkmaster-displays
sudo /opt/jerkmaster-displays/display_test.py
sudo systemctl start jerkmaster-displays
```

To test the MAX98357A output, play a short installed JerkMaster sound:

```bash
/opt/jerkmaster-displays/sounds/play_sound.py startup
/opt/jerkmaster-displays/sounds/play_sound.py action
```

Do not expose JerkMaster or Moonraker directly to the public internet. Use a
trusted LAN or VPN.
