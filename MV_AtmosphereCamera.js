/*:
 * @target MV
 * @plugindesc v1.0 Procedural drifting mist with movement-driven, reversible camera zoom for RPG Maker MV.
 * @author Jake Mason (portfolio adaptation)
 * @param Cloud Count
 * @type number
 * @min 1
 * @default 15
 * @param Zoom Minimum
 * @type number
 * @decimals 2
 * @default 0.88
 * @param Zoom Maximum
 * @type number
 * @decimals 2
 * @default 1.14
 * @param Zoom Speed
 * @type number
 * @decimals 4
 * @default 0.002
 * @param Cloud Alpha
 * @type number
 * @decimals 2
 * @default 0.30
 * @help
 * No imported textures, dialogue or copyrighted assets are required.
 * Map note <AtmosphereAllowed> authorizes effects on that map. Effects remain
 * inactive until an event calls a plugin command:
 *   Atmosphere Start
 *   Atmosphere Stop
 *   Atmosphere Reset
 * The mist uses a generated PIXI canvas texture. It has a simple graphics
 * fallback if canvas-backed textures are unavailable. Mist is rendered under
 * windows, and transforms affect the world layer only.
 * The camera only changes its scale while the player moves; standing still
 * freezes its current zoom. Avoid using simultaneous map-camera plugins.
 */
(function() {
    'use strict';
    var P = PluginManager.parameters('MV_AtmosphereCamera');
    function numberParam(k, fallback) {
        var raw = P[k], n = raw === undefined || raw === '' ? fallback : Number(raw);
        return isFinite(n) ? n : fallback;
    }
    var count = Math.max(1, Math.min(50, Math.floor(numberParam('Cloud Count', 15))));
    var zoomMin = Math.max(0.65, Math.min(1.0, numberParam('Zoom Minimum', 0.88)));
    var zoomMax = Math.max(1.0, Math.min(1.45, numberParam('Zoom Maximum', 1.14)));
    var zoomSpeed = Math.max(0.0001, Math.min(0.02, numberParam('Zoom Speed', 0.002)));
    var alpha = Math.max(0, Math.min(0.75, numberParam('Cloud Alpha', 0.30)));
    function validMap() { return !!($dataMap && /<AtmosphereAllowed>/i.test($dataMap.note || '')); }
    function state() {
        if (!$gameSystem._portfolioAtmosphere) {
            $gameSystem._portfolioAtmosphere = { enabled: false, scale: 1, direction: 1 };
        }
        return $gameSystem._portfolioAtmosphere;
    }
    var baseCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        baseCommand.call(this, command, args);
        if (String(command).toLowerCase() !== 'atmosphere' || !$gameSystem || !validMap()) return;
        var action = String(args[0] || '').toLowerCase(), s = state();
        if (action === 'start') s.enabled = true;
        else if (action === 'stop') s.enabled = false;
        else if (action === 'reset') { s.enabled = false; s.scale = 1; s.direction = 1; }
    };
    function random(min, max) { return min + Math.random() * (max - min); }
    function mistTexture() {
        if (typeof document === 'undefined' || !PIXI.Texture.fromCanvas) return null;
        var canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;
        var gradient = ctx.createRadialGradient(128, 128, 9, 128, 128, 127);
        gradient.addColorStop(0, 'rgba(210,230,245,0.42)');
        gradient.addColorStop(0.52, 'rgba(180,210,236,0.23)');
        gradient.addColorStop(1, 'rgba(166,202,240,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        return PIXI.Texture.fromCanvas(canvas);
    }
    var baseCreate = Spriteset_Map.prototype.createUpperLayer;
    Spriteset_Map.prototype.createUpperLayer = function() {
        baseCreate.call(this);
        if (!validMap() || typeof PIXI === 'undefined') return;
        this._portfolioMist = new PIXI.Container();
        this._portfolioMistClouds = [];
        this._portfolioMistTexture = mistTexture();
        for (var i = 0; i < count; i++) {
            var w = random(170, 350), h = random(130, 260);
            var sp;
            if (this._portfolioMistTexture) {
                sp = new PIXI.Sprite(this._portfolioMistTexture);
                sp.anchor.set(0.5);
                sp.width = w; sp.height = h;
            } else {
                sp = new PIXI.Graphics();
                sp.beginFill(0xb6c9ee, 0.22);
                sp.drawEllipse(0, 0, w / 2, h / 2);
                sp.endFill();
            }
            sp.x = random(-140, Graphics.width + 140);
            sp.y = random(-120, Graphics.height + 120);
            sp.alpha = random(0.12, alpha);
            var cloud = { sprite: sp, vx: random(-0.32, 0.32), vy: random(-0.20, 0.20),
                t: random(0, Math.PI * 2), base: sp.alpha };
            this._portfolioMist.addChild(sp);
            this._portfolioMistClouds.push(cloud);
        }
        // Attach to the world, not the window layer.
        this._baseSprite.addChild(this._portfolioMist);
        this._portfolioMist.visible = false;
    };
    var baseUpdate = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        baseUpdate.call(this);
        if (!this._portfolioMist || !$gameSystem) return;
        var s = state(), on = validMap() && s.enabled;
        this._portfolioMist.visible = on;
        if (!on) {
            if (this._portfolioAtmosphereZoomed && $gameScreen) {
                // Only restore the camera if this plugin set its current zoom.
                $gameScreen.setZoom(0, 0, 1);
                this._portfolioAtmosphereZoomed = false;
            }
            return;
        }
        if ($gamePlayer && $gamePlayer.isMoving()) {
            s.scale += s.direction * zoomSpeed;
            if (s.scale >= zoomMax) { s.scale = zoomMax; s.direction = -1; }
            if (s.scale <= zoomMin) { s.scale = zoomMin; s.direction = 1; }
        }
        // MV's Game_Screen zoom is centered in actual pixels.
        $gameScreen.setZoom(Graphics.width / 2, Graphics.height / 2, s.scale);
        this._portfolioAtmosphereZoomed = true;
        for (var i = 0; i < this._portfolioMistClouds.length; i++) {
            var c = this._portfolioMistClouds[i], sp = c.sprite;
            c.t += 0.013;
            sp.x += c.vx;
            sp.y += c.vy + Math.cos(c.t + i) * 0.10;
            sp.alpha = Math.max(0, c.base * (0.84 + Math.sin(c.t) * 0.16));
            if (sp.x < -290) sp.x = Graphics.width + 290;
            if (sp.x > Graphics.width + 290) sp.x = -290;
            if (sp.y < -240) sp.y = Graphics.height + 240;
            if (sp.y > Graphics.height + 240) sp.y = -240;
        }
    };
    var baseTerminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        if (this._spriteset && this._spriteset._portfolioAtmosphereZoomed && $gameScreen) {
            $gameScreen.setZoom(0, 0, 1);
        }
        baseTerminate.call(this);
    };
})();
