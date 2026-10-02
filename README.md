# Chaos Soccer

A browser-first 2v2 ragdoll soccer brawl using Three.js and Rapier 3D. No backend, accounts, API keys, or paid services.

## Files
- `index.html` — UI shell and CSS
- `game.js` — renderer, physics, input, abilities, particles, sound, game modes
- `manifest.webmanifest` — PWA metadata
- `sw.js` — offline cache after the first successful network load
- `icon.svg` — PWA icon

## External libraries / CDN
- Three.js 0.186.1: https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js
- Rapier 3D compat 0.21.0: https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/rapier.es.js

## Run
Use a local HTTP server (PWA/service workers do not work from `file://`).

Python:
`python -m http.server 8000`

Then open:
`http://localhost:8000/`

The game is also deployable as static files to any HTTPS host. On the first load, the service worker caches the app shell and CDN modules; subsequent loads can work offline as long as those requests were successfully cached.

## Notes
Browser APIs cannot guarantee a fixed 60 FPS on every four-year-old Android phone or 120 FPS on every desktop. Controller support depends on the browser/OS Gamepad API implementation. Touch controls appear on coarse-pointer/mobile layouts.

The 23 ability weights live in one config object (`ABILITY_CONFIG`), and a developer mode can force abilities for testing. The mythic entries preserve the supplied 0.1% mythic pool and their listed internal subweights, then normalize that mythic pool when rolling.
