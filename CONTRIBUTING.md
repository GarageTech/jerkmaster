# Contributing to JerkMaster

Thank you for helping improve JerkMaster.

## Useful Contributions

- Hardware adaptations and tested pin mappings
- Safety reviews and failure-mode analysis
- New recipes and drying profiles
- UI, accessibility, and mobile-layout improvements
- Translation corrections for EN, RU, and UA
- Moonraker/Klipper integration improvements
- Documentation and installation reports

## Before Opening A Pull Request

1. Keep changes focused and explain the problem they solve.
2. Do not remove or weaken safety limits without a clear technical justification.
3. Validate all edited JSON files.
4. Check JavaScript syntax.
5. Test all five pages through a local HTTP server.
6. Confirm recipes reference existing ingredients and profiles.
7. Update documentation when behavior or hardware requirements change.

## Local Testing

```powershell
node tools/dev-server.mjs
```

Open `http://127.0.0.1:8080/?demo=1`.

## Safety Reports

Do not publicly disclose a vulnerability that could create unsafe heater behavior. Follow [SECURITY.md](SECURITY.md).
