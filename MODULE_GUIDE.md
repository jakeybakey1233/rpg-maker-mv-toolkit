# Technical notes and public configuration

All plugins use RPG Maker MV `/*: ... */` headers and `PluginManager.parameters(name)`, except the additional integration helper `MV_MazeVideoHook.js`, which must stay disabled until you supply original films. Event commands use MV **Plugin Command** instructions, i.e. event command code 356, not JavaScript `eval` or MZ-specific command code 357.

### Event AI — `MV_MazeRoamers.js`

This is the largest algorithmic system: a breadth-first field for chasing events across navigable map tiles, dynamic obstruction handling, independent wander/route modes, save-friendly map state, catch events, safe regions and checkpoint recovery. The demo makes region 250 into walls **only** on maps with `<MazeDemo>` in the map note. Other maps use their real tileset passage rules unchanged. Event tags: `<MazeChaser>`, optionally `<MazeMode: chase>`, `<MazeSpeed: 4>`, `<MazeSwitch: 1>`. Map tags: `<MazeStart: 3,3,2>`, `<MazeSafeRegion: 251>`. Commands: `Maze Start`, `Maze Stop`, `Maze Reset`, `Maze SetStart Here`, `Maze Count 1`. `Maze Count` writes capture count into a game variable; declare the variable before using it. The demo declares variable 1 and switch 1.

### Dialogue and items

`MV_DialogueLayout.js` wraps using font metrics rather than character counts. A standalone last message line `\n<Speaker>` displays a label above the dialogue; `\IT[1]` and `\IT[0]` toggle italics. (MV's editor may display the backslash escaping differently; verify during playtest.)

`MV_IntoxicationFX.js` stores level in `Game_System` so the value survives save/load. `Intox Add 30` and `Intox Remove 10` modify it, `Intox Set 60` sets it, and `Intox Clear` resets it. Database notetags work on items/skills: `<Intoxication: 30>`, `<Intoxication: -15>`, and `<Set Intoxication: 60>`. The default Game Over overflow option is **off**. Effects can be intense at high settings; preview at mild values first.

`MV_ConsumableEffects.js` uses ordinary MV items with a `<DemoEffect: vitality>`, `<DemoEffect: chaos>`, `<DemoEffect: random>`, or `<DemoEffect: cleanse>` note. Vitality and chaos durations are measured in **battle turns**; using the item on a map retains the temporary effect until battle-turn processing occurs. Cleansing also requires an explicit state ID list such as `<CleanseStates: 4,5>`; those IDs refer to the *target game's* states, not any bundled user content.

### Visual systems

`MV_ScreenWarp.js`: `ScreenWarp START 0.35 90`; `ScreenWarp SET 0.7 120`; `ScreenWarp STOP 90`. Parameters after the command are strength and number of frames. Visual fallback is a physical map transform when a PIXI shader cannot run.

`MV_AtmosphereCamera.js`: add `<AtmosphereAllowed>` in map notes, then `Atmosphere Start`, `Atmosphere Stop` or `Atmosphere Reset`. Moving changes zoom; waiting holds zoom; cloud drift is independent.

`MV_BattlebackFX.js`: in Plugin Manager, set a target troop ID, texture source (`battleback1` or `picture`), filename without extension, hue speed and layer motion. The demo uses troop 1 and stock battleback1 `Grassland`.

### Scripted cutscene orchestration

`MV_CinematicDirector.js` acts on events whose **event Note** field contains `<CineExtra>`. A director event executes `Cine Start`, `Cine Crowd On`, optional `Cine Shake 2 4 22`, `Cine Crowd Off`, and `Cine End`. Ordinary RPG Maker events own all message content, wait commands, sound cues and fight triggers. No hardcoded map ID, party IDs, dialogue, character art or proprietary sound references are present.

### Optional video hook

Load `MV_MazeVideoHook.js` *below* `MV_MazeRoamers.js` and enable it only after supplying **your own** `movies/demo_clip_1.webm` through the configured clip count. It is not in the installed demo or any automatic test. Keep the underlying maze catch pause above zero.

### Known compatibility considerations

- Several plugins alias native MV prototype methods. Check plugin load order and avoid overlapping third-party replacements of the same methods.
- `MV_IntoxicationFX`, `MV_ScreenWarp` and `MV_AtmosphereCamera` alter camera visuals through different mechanisms. They are separately demonstrated, not guaranteed to compose perfectly when enabled at once. Disable or reset one before starting another.
- If stock tile IDs or troop IDs differ in your installation, adjust the map/troop configuration. This demo was designed for a typical new MV project's stock Outside tileset and People1 characters.
- Movie playback and complete graphical effects depend on the renderer and deployment target. Full-engine manual verification is a separate step; static and targeted stub tests are not equivalent to an in-game run.
