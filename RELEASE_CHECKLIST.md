# Release Checklist

## Repository

- [x] Confirm the repository URL is `https://github.com/GarageTech/jerkmaster`
- [x] Use `main` as the default branch
- [ ] Confirm no passwords, API keys, SSH keys, personal configs, exact local IPs, or device serials exist in files or Git history
- [ ] Make the repository public only after the secret/history audit is clean
- [ ] Add a short GitHub repository description
- [ ] Add topics such as `dehydrator`, `jerky`, `klipper`, `moonraker`, `raspberry-pi`, `btt-skr`, and `food-drying`
- [ ] Enable private vulnerability reporting

## Verification

- [ ] Validate every JSON file
- [ ] Check JavaScript syntax
- [ ] Install the current repository version on the Raspberry Pi
- [ ] Open all five pages from the Raspberry-hosted service
- [ ] Test demo mode
- [ ] Test EN, RU, and UA
- [ ] Verify ingredient, recipe, and profile CRUD
- [ ] Verify deletion protection
- [ ] Verify custom and profile drying controls
- [ ] Verify diagnostics with simulated or controlled failure cases

## Hardware Safety

- [ ] Verify every controller pin against the actual board
- [ ] Verify all temperature sensors
- [ ] Verify physical emergency stop
- [ ] Verify independent thermal fuse
- [ ] Verify protective earth and over-current protection
- [ ] Test with mains loads disconnected before powered-load testing

## Announcement

- [ ] Review `COMMUNITY_ANNOUNCEMENT.md`
- [ ] Add real build photos or a short demo video
- [ ] Publish the first tagged release
- [ ] Invite hardware adaptations, safety reviews, recipes, and translations
