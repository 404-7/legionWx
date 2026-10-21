# Classic unit visuals

The game uses 123 local PNG sprites, matched to all 187 spreadsheet unit records plus summons, mercenaries, creeps and kings. Original showcase images come from Blizzard Entertainment's [classic Warcraft III guide](https://classic.battle.net/war3/). Image rights remain with Blizzard Entertainment; this directory does not claim ownership of them.

`classic-sources.json` records original asset and page URLs. `mapping.json` records each original map model path, source tint and chosen render. Entries marked `closest-classic` use a similar available classic unit; they do not represent an exact render of the map's custom MDL/MDX model. Land mines and the egg sack use dedicated Canvas shapes. The project displays two-dimensional model renders, not live Warcraft 3D models.

`scripts/import-classic-art.cjs` downloads original GIF showcase files. The raw GIFs stay local and are ignored by Git and Docker. `scripts/build-classic-art.cjs` generates the source mapping and `js/art-manifest.js`. `scripts/prepare-classic-art.cjs` prepares transparent sprite PNGs for the game renderer, leaving the originals unchanged. The final PNGs are checked into Git and require no external requests at runtime, including offline mode.

The attempted built-in image generation requests failed with network errors; no generated artwork is used in this version.
