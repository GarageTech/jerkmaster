# Community Announcement

## JerkMaster: an open-source smart dehydrator controller

I am sharing **JerkMaster**, an open-source controller and browser interface for programmable food dehydration.

The project started as a VEVOR dehydrator conversion using a Raspberry Pi 3 B+, BTT SKR 1.4 Turbo, Klipper, Moonraker, SSR-controlled heater and fan outputs, and multiple temperature sensors.

JerkMaster currently includes:

- multi-stage and custom drying cycles;
- recipe, ingredient, and drying-profile editors;
- recipe scaling, salinity calculation, and explicit spice-mix dosage per kilogram;
- English, Russian, and Ukrainian UI;
- live telemetry and temperature history;
- safety-oriented diagnostic statuses for sensors, MCU connection, electronics temperature, Raspberry Pi temperature, emergency stop, and possible SSR/heating-chain timeout;
- example Klipper configuration, macros, G-code files, hardware notes, and wiring guidance;
- a demo mode that works without connected hardware.

The project is looking for feedback from dehydrator builders, Klipper users, food-safety enthusiasts, electronics engineers, frontend contributors, and anyone with good jerky recipes.

Repository: https://github.com/GarageTech/jerkmaster

VEVOR, Raspberry Pi, BTT, Omron, Mean Well, and the other hardware manufacturers used in the reference build are not sponsors or affiliates. Their equipment was useful, though, and sponsorship offers would not be rejected on principle.

Please remember that the project controls mains-powered heating equipment. Independent thermal protection, protective earth, correctly rated breakers, a physical emergency stop, and qualified electrical work are essential.
