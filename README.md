# RPG Maker MV — JavaScript systems portfolio

Nine standalone, data-driven RPG Maker MV extensions and a **stock-asset-only** playable showcase. The source demonstrates event AI, state persistence, rendering effects, plugin APIs, runtime event orchestration, animation, and reusable item mechanics.

**Original game dialogue, real-person likenesses, character sprites, commissioned/copyrighted pictures and music are not included.** All demo text and event configurations were written as neutral examples. The install script references assets *already provided by your own licensed RPG Maker MV installation*; this repository does not distribute the engine or its assets.

> **Status:** JavaScript syntax, installer behavior, demo JSON shape, source privacy scans and selected plugin logic are tested automatically. The package has **not** been manually playtested inside the full, licensed RPG Maker MV editor. Please run the guided smoke test before calling a game module production-ready. Some systems mutate camera transforms; test them independently rather than stacking several simultaneously.

## Run the stock demo

1. Create a **fresh RPG Maker MV game** in the editor. Do not start with an existing project you want to preserve.
2. Run `python tools/install_demo.py "/path/to/your/New MV Game"` from the root of this repository. On Windows, `py tools\install_demo.py "C:\Users\You\Documents\Games\Demo"` also works.
3. Open the game in MV. **New Game** starts on the 27×19 sample map. Each NPC demonstrates one system, and the maze entrance is on the east side.
4. Test features separately: speak to the dialogue guide, status controller, distortion console, weather console, cinematic director, item giver, maze controller and battleback trial.

The installer copies eight standard plugins into `js/plugins/`, updates the plugin manifest, and installs original demo `data/Map001.json` and `MapInfos`/`System` references. It appends three sample items rather than replacing your complete item database. Original target files receive a first-run `.portfolio.bak` backup. It refuses to overwrite a populated Map001 without `--force`.

The demo uses stock `Outside` tileset **ID 2**, stock `People1` character sheet, and engine sounds and battleback graphics (`Decision1`, `Damage5`, `Grassland`). It expects a new MV database with troop ID 1 present. No portraits or custom images are needed. The standalone sample map deliberately uses region **250** to demonstrate dynamic wall collision and region **251** as a safe checkpoint zone.

## Modules

| File | Feature demonstrated | Demo / entry point |
| --- | --- | --- |
| `MV_MazeRoamers.js` | Multi-agent chase/wander/route behavior, breadth-first distance field, cached routes, safe regions, resets and checkpoints | `Maze Start`, event tags `<MazeChaser>` |
| `MV_DialogueLayout.js` | Font-aware text wrapping, speaker label window, help-window fit and inline italics | Named stock NPC dialogue, `\n<Speaker>` |
| `MV_ScreenWarp.js` | GLSL distortion, timed easing and physical-transform fallback | `ScreenWarp START 0.35 90` |
| `MV_IntoxicationFX.js` | Save-persistent stacking scalar state, decay, item tags and camera animation | `Intox Add 65`; `<Intoxication: 30>` |
| `MV_ConsumableEffects.js` | Extensible item notetags, temporary HP, state cleansing and random modifiers | Three sample consumables |
| `MV_BattlebackFX.js` | Tiled scrolling, hue cycling, additive dual layers and pulsating battleback | Battle trial against stock troop 1 |
| `MV_AtmosphereCamera.js` | Procedurally textured drifting clouds and movement-gated reversing zoom | `Atmosphere Start` |
| `MV_CinematicDirector.js` | Event-tagged extras, asynchronous choreography, tone/audio preservation and event-driven sequencing | `Cine Start` through `Cine End` |
| `MV_MazeVideoHook.js` | **Optional** custom-video transition with timeouts, skip and audio restoration | Disabled by default; supply your own licensed clips |

See [`docs/MODULE_GUIDE.md`](docs/MODULE_GUIDE.md) for configuration and [`docs/SHOWCASE_CHECKLIST.md`](docs/SHOWCASE_CHECKLIST.md) for short recordings that demonstrate real engineering rather than only visual effects.

## Structure

```text
plugins/               9 independently readable JavaScript plugins
demos/                 freshly generated MV map + MapInfos data
tools/build_demo.py    reproducible stock event/map generator
tools/install_demo.py  guarded installer with backup and idempotent item patching
tests/                 installer, data-layout, privacy and syntax checks
docs/                  module guide and recording checklist
```

A complete RPG Maker MV runtime is **not** included: it is proprietary and must come from your licensed copy of RPG Maker MV. If you have a custom plugin list, review load order and plugin compatibility before enabling these modules.

## Engineering notes and provenance

The portfolio modules are adapted and restructured from an independently developed experimental game project, with some modules freshly implemented as generic equivalents from recovered specifications. Development included AI-assisted coding and human-directed iteration. The work here is packaged to show algorithm selection, engineering decisions, integration and validation; the original game's unreleasable content has deliberately been omitted. This package is a shareable **source portfolio and demonstration scaffold**, not a claim that every recovered historical game module has been ported or runtime-certified.

**Licensing:** Sample code in this portfolio is offered under MIT (see `LICENSE`). This does *not* grant rights to RPG Maker MV itself, its bundled images/audio, or any additional externally sourced assets you supply.
