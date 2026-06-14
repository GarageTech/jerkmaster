# Changelog

This file records the project history in chronological commit order. New functional,
hardware, interface, documentation, and safety changes must be added here as part of
the same commit.

## 2026-06-10

### Initial JerkMaster release

- Added the browser dashboard for Klipper and Moonraker dehydrator control.
- Added multi-stage and custom drying modes.
- Added recipe, ingredient, and drying-profile editors.
- Added recipe scaling, salinity calculations, and spice-mix dosage calculations.
- Added English, Russian, and Ukrainian translations.
- Added live telemetry, temperature history, diagnostics, and emergency-stop integration.
- Added initial Klipper, Moonraker, macro, G-code, hardware, installation, and wiring documentation.
- Added contribution, security, release, issue, and community documentation.

## 2026-06-13

### Tune dryer hardware configuration

- Tuned the generic heater PID configuration from real dryer tests.
- Updated controller pin mappings and hardware documentation.

### Run JerkMaster on Raspberry Pi

- Added Raspberry Pi installation tooling and deployment instructions.
- Updated Moonraker configuration for the Raspberry-hosted interface.

### Restore active drying session in dashboard

- Persisted the active drying session so dashboard navigation and browser reopening no longer reset its displayed state.
- Improved Moonraker drying-state handling.

### Make project story the main README

- Replaced the main README with the JerkMaster project story.
- Moved the original technical content to `docs/technical-readme.md`.

### Add dehydrator build notes

- Added build notes covering the VEVOR dehydrator, reusable hardware, heatsinks, the original control panel, and mains safety.

### Merge pull request #1

- Merged the initial Raspberry runtime, drying-state restoration, and documentation work.

### Add recipe background and unified docs navigation

- Added recipe background and attribution documentation.
- Added consistent navigation links across the project documentation.

### Add chamber light control

- Added chamber-light control to Klipper, Moonraker, and the web interface.
- Added chamber-light wiring and installation documentation.

### Correct chamber light connector to HE1

- Corrected the chamber-light output mapping and documentation from the earlier connector assignment to HE1.

### Add visual documentation and interface screenshots

- Added screenshots for the dashboard, ingredients, recipes, profiles, and jerky-making pages.
- Added dehydrator and terminal wiring illustrations to the documentation.

### Merge pull request #2

- Merged recipe documentation, chamber-light control, and visual documentation work.

### Update terminal illustration with female Faston connectors

- Updated the terminal illustration to include female Faston connectors.

### Fix dashboard screenshot and surface dehydrator sketch

- Replaced the broken dashboard screenshot.
- Added a clearly visible dehydrator blueprint illustration.

### Merge pull request #3

- Merged the corrected dashboard screenshot and updated hardware illustrations.

### Correct insulated Faston terminal illustration

- Corrected the insulated Faston terminal variants in the wiring illustration.

### Expand terminal and fastener blueprint documentation

- Expanded the terminal blueprint.
- Added a separate fastener and PCB-standoff blueprint.

### Separate crimper and terminal blueprint sheets

- Moved the Pro'sKit crimper to a dedicated blueprint sheet.
- Updated hardware documentation and simplified the terminal sheet.

### Merge pull request #4

- Merged the final terminal, fastener, and crimper illustration updates.

### Restore active drying state from Klipper

- Made Klipper the authoritative source for restoring an active drying process.
- Improved macro state reporting and dashboard recovery after reconnecting.

### Allow Raspberry hostnames in Moonraker CORS

- Allowed Raspberry Pi hostnames in Moonraker CORS configuration.
- Documented the hostname access configuration.

### Preserve active drying timer across navigation

- Preserved the drying timer and progress calculation when navigating away from and back to the dashboard.

### Add animated dual status displays

- Added support for two round GC9A01 status displays.
- Added large status layouts, periodic JerkMaster branding, and animated robot eyes.
- Added display installation and wiring documentation.

### Add post-drying cooling stage

- Extended the third standard drying stage to 210 minutes.
- Added a final fan-only cooling stage that runs until the chamber reaches 30°C.
- Updated profiles, macros, displays, calculations, editors, and translations for temperature-based stages.

### Refine dashboard controls and chart layout

- Added manual fan control and compact chamber-light control.
- Moved Moonraker status into the controller section.
- Removed the normal-work diagnostic badge so only actual errors are shown.
- Changed the chart to a taller, approximately 30-second view.

## 2026-06-14

### Simplify active profile display

- Removed the active-profile frame and background.
- Displayed the active profile name as blue text.

### Improve temperature chart and equipment status

- Changed the chart to always display chamber, Raspberry Pi, and electronics-bay temperatures.
- Removed the target-temperature line and displayed current and target values beside the chart legend.
- Formatted spice-mix and marinade quantities with exactly one decimal place.
- Spread the equipment status row across the available width and added text to fan and light controls.

### Restore active profile label

- Restored the translated `Active profile` label while keeping the profile name as unframed blue text.

## Unreleased

### Changed

- Moved user-created and edited ingredients, recipes, and profiles from browser local storage to persistent Raspberry Pi user-data files shared by every browser.
- Added an atomic Raspberry user-data API and documented backup of `/var/lib/jerkmaster/user-data/`; existing browser-local edits are intentionally not migrated.
- Added a credential-free Raspberry Pi updater that installs the public `main` archive without Git or a GitHub account.
- Audited all interface translations and CSS, and removed obsolete diagnostic-status styles.
- Fixed mobile navigation and ingredient-toolbar overflow found during the CSS audit.
- Refreshed the About-page dashboard screenshot.
- Added live heater and fan PWM percentages to the controller status row.
- Placed the `Active profile` label above the active profile name.
- Changed the temperature chart to a minute-based time axis with selectable 5, 15, 30, and 60 minute ranges.
- Made Klipper `DRYER_STATE` the only authoritative source for real drying-state restoration.
- Added the active recipe and final result to `DRYER_STATE` so browser reopening restores the exact running process without browser-side guesses.
- Synchronized the dashboard timer to Klipper elapsed time on every telemetry update.
- Made the deployable web service Raspberry-only and removed alternate Moonraker URL support.
- Replaced the generic Python static server with a Raspberry service that disables browser caching and exposes `/health`.
- Localized ingredient amount numbers and units for English, Russian, and Ukrainian.

### Fixed

- Moved lower status-display labels and temperatures fully inside the round screens.
- Prevented completed or stopped drying processes from being restored from stale browser storage.
- Fixed Russian `г` and Russian number formatting appearing in the English ingredient tables.
- Added the missing translation for the calculated-salinity label.

### Removed

- Removed browser-local active drying state, the local-computer development server, and temporary preview files.
- Removed duplicate chamber-light controls from secondary pages and their separate Moonraker client logic.
- Removed unused Klipper state variables, `save_variables`, and ambiguous `START`, `STOP`, and `ESTOP` aliases.

### Documentation

- Replaced the obsolete original-control-panel description with the dual-display, dual-fan, momentary-button front-panel concept.
- Documented BTT Power Shutdown Relay V1.2 power domains and the final single-blue-indicator front-panel wiring.
- Selected BED/P2.5 for the blue button LED while retaining the HE1 chamber light; unused button LED channels remain disconnected.
- Added rendered previews of the dual round status-display states.
- Replaced password-prone `git pull` update instructions with the public archive updater.
- Reconstructed the complete project changelog in chronological commit order with links to all existing commits.
- Added contributor and agent rules requiring `CHANGELOG.md` updates with future project changes.
- Reworked installation and technical documentation around a single Raspberry Pi deployment.
