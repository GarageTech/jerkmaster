# Wiring Notes

## Reference Pin Mapping

| Purpose | BTT SKR 1.4 Turbo connector | Klipper pin |
|---|---|---|
| Heater SSR input | HE0 | `P2.7` |
| Fan SSR input | FAN0 | `P2.3` |
| Drying-chamber NTC | TH0 | `P0.24` |
| Electronics-bay NTC | TH1 | `P0.25` |
| Raspberry Pi temperature | Built-in SoC sensor | `temperature_host` |

These are common reference assignments, not a guarantee for a specific board revision or installation. Verify the BTT SKR 1.4 Turbo schematic, connector labels, and actual wiring before applying power.

## Critical Safety Requirements

- Verify the exact SSR model, input voltage, output type, load rating, and heatsink requirements.
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
