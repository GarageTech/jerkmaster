# Reference Hardware

The reference JerkMaster build uses the components below. Equivalent parts can be used only after checking electrical compatibility, sensor behavior, power requirements, and safety limits.

## Dehydrator

- VEVOR H6-C001 food dehydrator
- AC 220–240 V, 50 Hz, 400 W
- Reference fan: 220 V, approximately 1320 RPM
- Reference heater: 220 V
- Original/reference sensor: NTC 100K

## Controller And Compute

- Raspberry Pi 3 Model B+
- BTT SKR 1.4 Turbo
- USB A-to-B host/controller cable

## Power

- Mean Well RS-25-5
- Mean Well LRS-150-12

## Load Switching

- Two Omron G3NA-210B SSRs
  - Heater SSR
  - Circulation-fan SSR
- Appropriately sized SSR heatsinks

## Temperature Sensors

- EPCOS 100K NTC for drying chamber
- EPCOS 100K NTC for electronics bay
- Raspberry Pi SoC temperature sensor

## Cooling And Distribution

- Waveshare PI-FAN-3007 or equivalent Raspberry Pi cooling
- AC distribution terminals/connectors appropriate for the installation

## Required Safety Components

- Independent 115°C thermal fuse, correctly rated for the heater circuit
- Protective earth
- Correctly rated breaker or fuse
- Physical emergency stop
- Closed non-combustible electronics enclosure
- Correctly rated wiring, ferrules, terminals, insulation sleeves, and strain relief

## Materials Used In The Reference Build

- Thermal paste
- M2.5/M3 standoffs
- M3/M4 fasteners
- Fiberglass insulation sleeve
- JST-XH connectors
- Insulated Faston terminals
- Bootlace ferrules
- Ring terminals

## Manufacturer Note

The reference build uses hardware from VEVOR, Raspberry Pi, BTT, Omron, Mean Well, Waveshare, and other manufacturers. None of these companies sponsor or endorse JerkMaster. Their products were selected because they were available and useful. Friendly sponsorship conversations are welcome.
