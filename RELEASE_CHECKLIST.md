# Release Checklist

## Repository

- [ ] Confirm the repository URL is `https://github.com/GarageTech/jerkmaster`
- [ ] Use `main` as the default branch
- [ ] Add a short GitHub repository description
- [ ] Add topics such as `dehydrator`, `jerky`, `klipper`, `moonraker`, `raspberry-pi`, `btt-skr`, and `food-drying`
- [ ] Enable private vulnerability reporting

## Verification

- [ ] Validate every JSON file
- [ ] Check JavaScript syntax
- [ ] Open all five pages through HTTP
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
