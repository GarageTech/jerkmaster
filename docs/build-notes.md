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

# Build Notes

This project did not start with choosing a dehydrator specifically for modification. I originally bought the VEVOR dehydrator for normal use, and only later started modifying it after running into the limitations of the factory controller.

By coincidence, this particular model turned out to be a very good platform for this type of conversion.

![JerkMaster dehydrator cutaway blueprint](../img/docs/illustrations/jerkmaster-cutaway-blueprint.png)

VEVOR sells several dehydrators in this line, differing in size, power and number of drying trays. However, they appear to share a very similar layout: a stainless steel drying chamber, rear-mounted fan and heater assembly, and a separate electronics bay located at the top of the unit.

My unit is the smallest model in the range, with 6 trays measuring approximately 20 × 28 cm. In practice, it can hold around 1.2–1.4 kg of meat sliced to about 5 mm thickness.

After briefly looking around, it is clear that many food dehydrators from other manufacturers use a similar construction: a metal box with a rear fan and heater assembly. I believe many of these machines could also be suitable for a similar conversion, as long as they provide enough internal space and a reasonable separation between the drying chamber and the electronics.

One important practical note: the body of this dehydrator is made from thin but very strong stainless steel. Working with it is not as easy as it may seem. Even simple operations such as drilling holes can become surprisingly difficult without proper tools, sharp drill bits, low speed, cutting oil and patience.

As mentioned earlier, my internal hardware build was based partly on components I already had available from previous projects. However, the architecture is flexible. You do not have to use exactly the same hardware. Any controller board supported by Klipper can be used, and you are free to choose your own host controller, SSRs, power supplies, wiring layout and mounting approach.

In other words, use what you already have — especially if, like many DIY and 3D printing enthusiasts, you have old controller boards, power supplies, connectors and other useful parts gathering dust on a shelf.

Regarding SSR heatsinks: in my build I used oversized heatsinks. This was mainly because I was building the project away from my main workshop, where I do not have access to my usual stock of parts. During early testing, the rear wall of the dehydrator became quite hot, so I decided to use large heatsinks from the beginning rather than buy and test several smaller options. It was a conservative choice intended to remove one possible thermal problem from the project.

## Safety Warning

This project involves modifying a mains-powered household appliance with a metal enclosure and 220–240 V AC wiring.

Work carefully and responsibly.

If you do not clearly understand what you are doing, do not attempt this modification yourself. Either abandon the project or ask a qualified electrician to help with the mains wiring, grounding, fusing and safety checks.

Use proper wire, reliable terminals and heat-resistant insulation where required. Pay special attention to wiring near the heater and any high-temperature areas.

Use suitable crimp terminals and a proper crimping tool. Do not crimp electrical terminals with pliers, a vise, a hammer, or anything else that only “looks good enough”. A poor crimp may work for a while, but sooner or later the wire can loosen, pull out, touch the metal case, and create a dangerous failure.

This is not a low-voltage toy project. Treat it like real electrical equipment.

## Original Control Panel

At the moment, the original front control panel remains installed and untouched.

The factory touch buttons and display are no longer used for controlling the drying process, but removing the panel offered little practical benefit during the initial stages of development. Leaving it in place also preserves the original appearance of the dehydrator and avoids creating unnecessary openings in the front panel.

The current JerkMaster interface is entirely web-based and accessed through Moonraker and the custom web UI.

However, the front panel area remains an interesting location for future upgrades. One possible direction is replacing the original display with a small dedicated status screen that could show information such as:

- Current temperature
- Target temperature
- Active drying stage
- Remaining time
- System status

This would provide basic local monitoring without requiring a phone, tablet or computer.

For now, the original panel remains part of the appliance and serves as a reminder of where the project started.
