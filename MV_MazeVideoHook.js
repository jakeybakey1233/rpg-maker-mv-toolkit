/*:
 * @target MV
 * @plugindesc v1.0 Optional developer-supplied movie transitions before maze resets. Load below MV_MazeRoamers.
 * @author Jake Mason (portfolio adaptation)
 * @param Enabled
 * @type boolean
 * @default false
 * @param Clip Count
 * @type number
 * @min 1
 * @default 7
 * @param Extension
 * @type select
 * @option webm
 * @option mp4
 * @default webm
 * @param Volume
 * @type number
 * @min 0
 * @max 100
 * @default 90
 * @help
 * No movies are included. Only use clips you created or may legally redistribute.
 * Keep Enabled false until clips are installed in your project's movies folder.
 * With Clip Count 7 and Extension webm, supply demo_clip_1.webm through demo_clip_7.webm.
 * All numbers must exist, with no gaps. Use plain lowercase filenames.
 * On catch: play a random clip, then reset. Escape skips the clip.
 * Music pauses during playback and resumes afterward. Missing/unsupported files
 * fall back to the normal reset. Loading times out after 10 seconds.
 * Clips have a five-minute safety timeout. No common events/switches required.
 * Keep MV_MazeRoamers's Catch Pause Frames at 1 or higher (default 12).
 * Disable 'Exclude unused files' during deployment or copy movies manually:
 * dynamic movie filenames cannot be detected by MV's deployment scanner.
 */
(function() {
    'use strict';
    var p = PluginManager.parameters('MV_MazeVideoHook');
    var enabled = p.Enabled === 'true';
    var count = Math.max(1, Math.min(999, Math.floor(Number(p['Clip Count']) || 7)));
    var extension = p.Extension === 'mp4' ? 'mp4' : 'webm';
    var volume = Math.max(0, Math.min(100, p.Volume === undefined ? 90 : Number(p.Volume))) / 100;
    var active = null;
    function play(state) {
        var video = document.createElement('video');
        var bgm = AudioManager.saveBgm(), bgs = AudioManager.saveBgs();
        var ctx = {video:video, state:state, scene:SceneManager._scene, done:false};
        active = ctx;
        function finish() {
            if (ctx.done) return;
            ctx.done = true;
            clearTimeout(ctx.loadTimer); clearTimeout(ctx.maxTimer);
            document.removeEventListener('keydown', ctx.key, true);
            video.pause(); video.removeAttribute('src'); video.load();
            if (video.parentNode) video.parentNode.removeChild(video);
            if (active === ctx) active = null;
            if ($gameMap._portfolioMaze === state && SceneManager._scene === ctx.scene) {
                AudioManager.replayBgm(bgm); AudioManager.replayBgs(bgs);
                state.remaining = 1;
            }
            Input.clear(); TouchInput.clear();
        }
        ctx.finish = finish;
        ctx.key = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault(); e.stopPropagation(); finish();
            }
        };
        video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:black;z-index:99999';
        video.playsInline = true; video.volume = isFinite(volume) ? volume : 0.9;
        video.onended = finish; video.onerror = finish;
        video.onplaying = function() { clearTimeout(ctx.loadTimer); };
        video.src = 'movies/demo_clip_' + (1 + Math.floor(Math.random() * count)) + '.' + extension;
        document.body.appendChild(video);
        document.addEventListener('keydown', ctx.key, true);
        AudioManager.stopBgm(); AudioManager.stopBgs();
        ctx.loadTimer = setTimeout(finish, 10000);
        ctx.maxTimer = setTimeout(finish, 300000);
        try {
            var promise = video.play();
            if (promise && promise.catch) promise.catch(finish);
        } catch (e) { finish(); }
    }
    var update = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        if (active) return;
        update.call(this);
        var s = $gameMap._portfolioMaze;
        if (enabled && s && s.resetting && s._movieCatch !== s.count) {
            s._movieCatch = s.count;
            try { play(s); } catch (e) {
                console.warn('MV_MazeVideoHook: movie unavailable; continuing reset.', e);
                if (active && active.finish) active.finish();
                active = null; s.remaining = 1;
            }
        }
    };
    var menu = Scene_Map.prototype.isMenuEnabled;
    Scene_Map.prototype.isMenuEnabled = function() {
        return !(active || ($gameMap._portfolioMaze && $gameMap._portfolioMaze.resetting)) && menu.call(this);
    };
    var terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        if (active) active.finish();
        terminate.call(this);
    };
})();
