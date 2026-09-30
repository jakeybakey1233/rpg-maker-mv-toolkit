/*:
 * @target MV
 * @plugindesc v1.0 Event-driven cinematic sequencer: asynchronous extras, tone transitions and nonblocking camera shake.
 * @author Jake Mason (portfolio adaptation)
 * @param Crowd Move Interval
 * @type number
 * @default 22
 * @param Cinematic Tint
 * @type string
 * @default -30,-30,25,35
 * @help
 * Stock character assets only. Label crowd member events <CineExtra> in
 * their event Note field. Start a scene from an event with plugin commands:
 *   Cine Start
 *   Cine Crowd On
 *   Cine Shake 3 5 20
 *   Cine Crowd Off
 *   Cine End
 * Use regular Show Text, Wait, Play SE, Move Picture and Battle Processing
 * event commands for your actual narrative. This is an independent orchestration
 * helper, not a prewritten game scene. Tone and BGM are restored on Cine End.
 * All effects stop when changing map. The module does not swap actors, faces,
 * movies, audio or character sheets, and it never edits game dialogue.
 */
(function() {
    'use strict';
    var P = PluginManager.parameters('MV_CinematicDirector');
    var interval = Math.max(8, Math.floor(Number(P['Crowd Move Interval']) || 22));
    var tint = String(P['Cinematic Tint'] || '-30,-30,25,35').split(',').map(Number);
    if (tint.length !== 4 || tint.some(function(n) { return !isFinite(n); })) tint = [-30, -30, 25, 35];
    var scene = { active: false, crowd: false, frame: 0, tone: null, bgm: null,
        mapId: 0, original: {} };
    function extras() {
        return $gameMap.events().filter(function(ev) {
            return ev && !ev._erased && /<CineExtra>/i.test(ev.event().note || '');
        });
    }
    function restore() {
        if (!scene.active) return;
        if ($gameMap && $gameMap.mapId() === scene.mapId) {
            extras().forEach(function(ev) {
                var old = scene.original[ev.eventId()];
                if (old) { ev.setDirectionFix(old.fix); ev.setStepAnime(old.step); ev.setMoveSpeed(old.speed); }
            });
        }
        if ($gameScreen && scene.tone) $gameScreen.startTint(scene.tone, 24);
        if (scene.bgm) AudioManager.replayBgm(scene.bgm);
        scene.active = false; scene.crowd = false; scene.original = {};
    }
    var oldCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        oldCommand.call(this, command, args);
        if (String(command).toLowerCase() !== 'cine' || !$gameMap) return;
        var action = String(args[0] || '').toLowerCase();
        if (action === 'end') { restore(); return; }
        if (action === 'start') {
            restore();
            scene.active = true; scene.crowd = false; scene.frame = 0;
            scene.mapId = $gameMap.mapId();
            scene.tone = $gameScreen.tone().slice();
            scene.bgm = AudioManager.saveBgm();
            scene.original = {};
            extras().forEach(function(ev) {
                scene.original[ev.eventId()] = { fix: ev.isDirectionFixed(),
                    step: ev.hasStepAnime(), speed: ev.moveSpeed() };
            });
            $gameScreen.startTint(tint, 48);
            return;
        }
        if (!scene.active || scene.mapId !== $gameMap.mapId()) return;
        if (action === 'crowd') scene.crowd = String(args[1] || '').toLowerCase() === 'on';
        else if (action === 'shake') {
            $gameScreen.startShake(Math.max(0, Number(args[1]) || 3),
                Math.max(0, Number(args[2]) || 5), Math.max(0, Number(args[3]) || 20));
        }
    };
    var oldUpdate = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        oldUpdate.call(this);
        if (!scene.active) return;
        if ($gameMap.mapId() !== scene.mapId) { restore(); return; }
        if (!scene.crowd || $gameMessage.isBusy() || $gameMap.isEventRunning() === false) return;
        scene.frame++;
        if (scene.frame % interval !== 0) return;
        extras().forEach(function(ev, i) {
            if (ev.isMoving()) return;
            ev.setDirectionFix(false);
            ev.setStepAnime(true);
            // Three-step synchronized choreography, staggered per extra.
            ev.setDirection([2, 4, 6, 8][(Math.floor(scene.frame / interval) + i) % 4]);
        });
    };
    var oldTransfer = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        if (scene.active) restore();
        oldTransfer.call(this, mapId);
    };
})();
