# README media and verification checklist

For a GitHub presentation, record short MP4s or lightweight GIFs from an *actual playtested copy* of the stock demo after resolving any local engine differences. Do not use material from the original game. Suggested recordings:

1. **Pathfinding:** stand by the east doorway, enable one chaser, walk around corners and demonstrate the distance-field route and catch/checkpoint recovery. Capture the independent wandering NPC in the same shot.
2. **State machine:** press the item/status controls twice, walk and show persistence, decay, and a clear command. Highlight the item notetag and `Game_System` fields in a paired screenshot.
3. **Renderer:** show a stock map before/after a gradual shader transform, then stop it. Repeat with procedural clouds, including stopping mid-walk to freeze camera zoom while cloud drift continues.
4. **Cutscene:** trigger the stock extras, overlay event-command screenshots, and show that the background sequence does not require proprietary portraits or scripted dialogue.
5. **UI and battle:** use long neutral text in the speaker-label window, then open a stock battle to demonstrate the two moving background layers.

In README project descriptions, explain **how** these systems are implemented: breadth-first grid traversal and caching, proper plugin-command dispatch, independent per-map state, event tag metadata, method aliasing for inter-plugin compatibility, and separation of visual modules from narrative assets. Include a brief mention of AI-assisted development if relevant; only claim features you actually tested.

Before public release, perform this final manual audit: inspect every `.js` and `.json` file for project names, personal names, old audio/image filenames and unwitting third-party code; inspect `git status`; and avoid checking in an actual RPG Maker installation or stock licensed files. No full-engine playtest has been run in this generation environment.
