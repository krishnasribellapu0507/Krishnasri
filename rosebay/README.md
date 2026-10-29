# Rosebay — Krishnasri’s playable portfolio

Live game: https://krishnasris-rosebay.dineshara.chatgpt.site/play

This folder contains the full portfolio, playable seaside world, hand-authored character, moving traffic, local models, textures, and browser libraries. No AI service, API key, paid generation, or package installation is required to run it.

## Run locally

Install Node.js 22 or newer, open a terminal in this folder, and run:

```sh
npm start
```

Open http://127.0.0.1:4173 for the portfolio, or http://127.0.0.1:4173/play for the game. Serve the files over HTTP; opening the HTML directly does not support the module and model loaders.

## Controls

- WASD or arrow keys: walk; drive and steer while in the car.
- Shift: run or drive faster. Space: jump.
- E: interact, enter/leave buildings, get in/out of the car.
- Drag: look. Scroll: zoom. V: pointer lock. Escape: release pointer lock.
- C or Character close-up: inspect the actual playable character.
- M: map and destinations. R: return to the square.
- Phones: use the joystick and touch buttons.

## Tests

```sh
npm test
```

Tests cover traffic spacing and collision behavior, stopping and recovery, road clearance, character skinning, motion, eye blinking, material data, and mobile geometry budgets.

## Files

- `dist/index.html`, `portfolio.js`, `portfolio.css`: portfolio.
- `dist/play.html`, `world.js`, `style.css`: playable world and controls.
- `dist/character.js`: authored anatomy, skeleton, face, hair, clothes, material textures, and animation.
- `dist/town-details.js`, `traffic-sim.js`: world additions and traffic.
- `dist/models/`, `dist/media/`, `dist/vendor/`: local runtime assets and libraries.
- `preview.mjs`: dependency-free local preview server.

## Hosting and credits

Deploy `dist/` as a static site with `/play` mapped to `play.html`. Keep the model and vendor files at their existing relative paths. Hosting-account credentials and deployment identity are not needed for local use and are excluded from the GitHub export.

Third-party assets retain their original licenses and credits. Read `dist/models/CREDITS.txt`, `dist/vendor/THREE-LICENSE.txt`, and `dist/vendor/VRM-LICENSE.txt` before reusing those assets. The existing illustrated entrance is retained; the current playable character and its new detail are authored geometry and procedural textures, not an AI-generated replacement.
