<p align="center">
  <img src="img/logo.png" alt="JerkMaster" width="560">
</p>

<p align="center">
  An open-source smart dehydrator for repeatable jerky making.
</p>

<p align="center">
  <a href="README.md">About</a> ·
  <a href="docs/technical-readme.md">Technical overview</a> ·
  <a href="docs/build-notes.md">Build notes</a> ·
  <a href="docs/about-recipes.md">Recipes</a> ·
  <a href="docs/installation.md">Installation</a> ·
  <a href="docs/hardware.md">Hardware</a> ·
  <a href="docs/wiring.md">Wiring</a> ·
  <a href="SECURITY.md">Safety</a>
</p>

# About JerkMaster

Jerky is one of the oldest and most practical ways of preserving meat. By removing most of the moisture, the product becomes lightweight, shelf-stable, rich in flavor, and highly concentrated in protein.

Today jerky is often associated with a snack for beer, but in reality it can be much more than that. It is a convenient high-protein snack during the workday, a practical source of nutrition on long trips, and a staple food for hikers, campers, hunters, and anyone who values lightweight, compact, and nutritious food. Properly prepared jerky stores well, requires no refrigeration, and delivers a remarkable amount of protein in a very small package.

JerkMaster was not created as a hardware experiment or simply as another DIY project. It was born from a practical problem.

Over the years I made jerky using several different dehydrators. Some were simple, some were more advanced, but all of them shared the same limitation: they treated drying as a fixed temperature and time process. In practice, good jerky is more nuanced than that.

One of the key ideas behind JerkMaster is staged temperature drying. Instead of immediately exposing the meat to high temperatures, the product is dried gradually. This allows moisture to leave the meat more evenly. When meat is placed directly into a dehydrator running at 65°C, the outer layer can dry too quickly, forming a surface crust while the inside still retains excess moisture. A gradual temperature profile helps achieve a more consistent texture, better moisture distribution, and a more predictable final result.

The project also grew out of another reality familiar to many home jerky makers: every batch already involved a computer. I kept spreadsheets with recipes, calculators for spice blends, marinade formulas, drying notes, and adjustments for different types of meat. Every new batch required calculations, scaling ingredients, checking drying profiles, and comparing previous results. Eventually it became obvious that the dehydrator and the recipe calculator should be part of the same system.

The hardware choice was equally practical. As a 3D printing enthusiast, I already had several components sitting on a shelf from previous projects: power supplies, electronics, connectors, and most importantly a BigTreeTech SKR controller board. Looking at the requirements of a dehydrator, I realized that the architecture commonly used in modern 3D printers was almost a perfect fit. Klipper, Moonraker and a Raspberry Pi provided a robust platform with remote access, monitoring, automation and a surprisingly low amount of custom software required to get started.

Of course, appetite comes with eating.

What started as a simple controller replacement gradually evolved into a complete ecosystem: recipe management, ingredient databases, spice blend calculations, drying profiles, process monitoring and a dedicated web interface. Looking at the project today, the hardware may seem like overkill for a food dehydrator. In many ways, it probably is. But it also provides capabilities that are difficult to find even in commercial equipment.

I am not a professional software developer. The idea, recipes, drying methodology, hardware design, testing, assembly and overall vision are mine. The software itself became possible thanks to modern AI tools. Much of the JavaScript code, configuration logic and user interface were created with the assistance of AI, transforming ideas and requirements into working software. Without tools such as Codex and modern language models, JerkMaster would likely have remained a collection of spreadsheets, notes and unfinished prototypes.

JerkMaster is therefore not only a dehydrator controller. It is an experiment in combining traditional food preservation, open-source hardware, 3D printing technologies and AI-assisted software development into a single practical tool.

The goal is simple: when a recipe turns out exceptionally well, it should be possible to reproduce it months later with the same ingredients, the same drying profile and the same result.

---

Technical details, installation steps, architecture, commands, and safety information are available in the [technical overview](docs/technical-readme.md).
