<p align="center">
  <img src="../img/logo.png" alt="JerkMaster" width="560">
</p>

# Final Hardware Checklist

Use this checklist after bootstrap and before connecting mains loads or running a
real drying cycle.

## Software And Services

- [ ] Bootstrap completed with the correct SKR MCU serial from `/dev/serial/by-id/`.
- [ ] `RESTART` succeeds in the Klipper console.
- [ ] `~/printer_data/logs/klippy.log` has no pin, include, or heater errors.
- [ ] Moonraker is running: `sudo systemctl status moonraker`.
- [ ] JerkMaster web service is running: `sudo systemctl status jerkmaster`.
- [ ] Display service is running: `sudo systemctl status jerkmaster-displays`.
- [ ] Web health check passes: `curl -fsS http://127.0.0.1:8080/health`.
- [ ] Wi-Fi and `jerkmaster.local` still work after reboot.

## Displays And Audio

- [ ] Display wiring test passes:
  `sudo systemctl stop jerkmaster-displays && sudo /opt/jerkmaster-displays/display_test.py`.
- [ ] Left display is red during the display test.
- [ ] Right display is green during the display test.
- [ ] Display service starts again:
  `sudo systemctl start jerkmaster-displays`.
- [ ] MAX98357A short sound test plays:
  `/opt/jerkmaster-displays/sounds/play_sound.py startup`.

## Safety Inputs

- [ ] Door switch is wired NC between SKR Z-STOP / `P1.29` and GND.
- [ ] Door closed triggers `DOOR_CLOSED`.
- [ ] Door open or disconnected wire triggers `DOOR_OPEN`.
- [ ] Door open turns the heater off immediately.
- [ ] Door open shows the warning state on the displays.
- [ ] Door open blinks the action button LED.
- [ ] Action button is wired between SKR Y-STOP / `P1.28` and GND.
- [ ] Action button short press triggers the UI action.
- [ ] Action button long press requests safe shutdown.

## Low-Voltage Outputs

- [ ] Power button LED on BED / `P2.5` turns on in ready state.
- [ ] Action button LED on HE1 / `P2.4` pulses during drying.
- [ ] Action button LED blink patterns work for complete, error, and door-open states.
- [ ] 8x WS2812B chamber LED line on `P1.24` responds to `SET_CHAMBER_LIGHT ON=1`.
- [ ] Chamber light turns on when the door opens.
- [ ] Electronics-bay Noctua fans on SKR FAN1 and FAN3 run as wired.

## Heater, Fan, And Mains Safety

Run these checks with mains-powered loads physically disconnected from SSR
outputs first.

- [ ] Chamber thermistor reports plausible room temperature.
- [ ] Electronics-bay thermistor reports plausible room temperature.
- [ ] Fan SSR control signal responds:
  `SET_PIN PIN=dryer_fan VALUE=1` then `SET_PIN PIN=dryer_fan VALUE=0`.
- [ ] Heater SSR control signal responds to a low target test.
- [ ] `STOP_DRYING` disables heater and fan outputs.
- [ ] `DRYER_ESTOP` disables outputs and requires `FIRMWARE_RESTART`.
- [ ] Independent thermal fuse is installed in series with the heater.
- [ ] Protective earth, enclosure, breaker/fuse, and physical E-stop are installed.

## Relay Shutdown

- [ ] `PS_ON` is high during normal operation.
- [ ] SKR Y-STOP / `P1.28` long press starts the Raspberry-owned shutdown sequence.
- [ ] Shutdown shows the shutdown-pending display state.
- [ ] Shutdown sound plays.
- [ ] Late shutdown service releases BTT Relay `PS_ON`.
- [ ] BTT Relay removes power after Linux enters poweroff/halt.
- [ ] `sudo reboot` does not release the relay and does not interrupt power.

Only connect mains-powered loads after these checks pass and the installation
has been reviewed by a qualified electrician.
