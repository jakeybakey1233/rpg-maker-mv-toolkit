/*:
 * @target MV
 * @plugindesc v1.0 Animated scrolling battleback using default MV battleback images or developer-supplied pictures.
 * @author Jake Mason (portfolio adaptation)
 * @param Troop ID
 * @type number
 * @default 1
 * @desc Use 0 to affect every battle or a specific troop ID.
 * @param Image Source
 * @type select
 * @option battleback1
 * @option picture
 * @default battleback1
 * @param Image Name
 * @type string
 * @default Grassland
 * @param Scroll X
 * @type number
 * @decimals 2
 * @default 1.1
 * @param Scroll Y
 * @type number
 * @decimals 2
 * @default 0.8
 * @param Tile Scale
 * @type number
 * @decimals 2
 * @default 0.55
 * @param Hue Speed
 * @type number
 * @decimals 2
 * @default 0.75
 * @param Pulse Amount
 * @type number
 * @decimals 3
 * @default 0.04
 * @param Ghost Overlay
 * @type boolean
 * @default true
 * @help
 * Defaults to the RPG Maker MV stock Grassland battleback. No files shipped.
 * Procedural movement, colour cycling and additive parallax over a stock image.
 * For your own texture, choose Image Source = picture and Image Name = filename.
 * Works with front-view or side-view battles. Change Troop ID if your starter
 * game uses a different stock troop.
 */
(function() {
    'use strict';
    var p = PluginManager.parameters('MV_BattlebackFX');
    function n(key, fallback) {
        var raw = p[key], value = raw === undefined || raw === '' ? fallback : Number(raw);
        return isFinite(value) ? value : fallback;
    }
    var troopId = Math.max(0, Math.floor(n('Troop ID', 1)));
    var source = p['Image Source'] === 'picture' ? 'picture' : 'battleback1';
    var imageName = String(p['Image Name'] || 'Grassland');
    var scrollX = n('Scroll X', 1.1), scrollY = n('Scroll Y', 0.8);
    var tileScale = Math.max(0.05, n('Tile Scale', 0.55));
    var hueSpeed = n('Hue Speed', 0.75), pulseAmount = Math.max(0, n('Pulse Amount', 0.04));
    var ghost = p['Ghost Overlay'] !== 'false';
    function shouldRun() {
        var troop = $gameTroop && $gameTroop.troop && $gameTroop.troop();
        return !!(troop && (troopId === 0 || troop.id === troopId));
    }
    function colourFilter() {
        return typeof PIXI !== 'undefined' && PIXI.filters && PIXI.filters.ColorMatrixFilter ?
            new PIXI.filters.ColorMatrixFilter() : null;
    }
    function fallbackHue(degrees) {
        var h = ((degrees % 360) + 360) % 360, x = 1 - Math.abs((h / 60) % 2 - 1), r = 0, g = 0, b = 0;
        if (h < 60) { r = 1; g = x; } else if (h < 120) { r = x; g = 1; }
        else if (h < 180) { g = 1; b = x; } else if (h < 240) { g = x; b = 1; }
        else if (h < 300) { r = x; b = 1; } else { r = 1; b = x; }
        return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
    }
    function layer(bitmap, scale, alpha, filter) {
        var sprite = new TilingSprite(bitmap);
        sprite.move(0, 0, Graphics.width, Graphics.height);
        sprite.tileScale.x = scale; sprite.tileScale.y = scale;
        sprite.alpha = alpha;
        if (filter) sprite.filters = [filter];
        return sprite;
    }
    var create = Spriteset_Battle.prototype.createBattleback;
    Spriteset_Battle.prototype.createBattleback = function() {
        create.call(this);
        if (!shouldRun()) return;
        var bitmap = source === 'picture' ? ImageManager.loadPicture(imageName) :
            ImageManager.loadBattleback1(imageName);
        this._portfolioBattleFrame = 0; this._portfolioBattleHue = 0;
        this._portfolioBattleFilter = colourFilter();
        this._portfolioBattleMain = layer(bitmap, tileScale, 1, this._portfolioBattleFilter);
        this._battleField.addChild(this._portfolioBattleMain);
        if (ghost) {
            this._portfolioGhostFilter = colourFilter();
            this._portfolioGhost = layer(bitmap, tileScale * 0.8, 0.22, this._portfolioGhostFilter);
            if (typeof PIXI !== 'undefined' && PIXI.BLEND_MODES)
                this._portfolioGhost.blendMode = PIXI.BLEND_MODES.ADD;
            this._battleField.addChild(this._portfolioGhost);
        }
    };
    function paint(sprite, filter, hue) {
        if (filter) {
            if (filter.reset) filter.reset();
            if (filter.hue) filter.hue(hue, false);
            if (filter.saturate) filter.saturate(1.2, false);
            sprite.tint = 0xFFFFFF;
        } else sprite.tint = fallbackHue(hue);
    }
    var update = Spriteset_Battle.prototype.update;
    Spriteset_Battle.prototype.update = function() {
        update.call(this);
        if (!this._portfolioBattleMain) return;
        this._portfolioBattleFrame++;
        this._portfolioBattleHue = (this._portfolioBattleHue + hueSpeed + 360) % 360;
        var t = this._portfolioBattleFrame, pulse = 1 + Math.sin(t * 0.035) * pulseAmount;
        var main = this._portfolioBattleMain;
        main.origin.x -= scrollX; main.origin.y += scrollY;
        main.tileScale.x = tileScale * pulse; main.tileScale.y = tileScale * pulse;
        paint(main, this._portfolioBattleFilter, this._portfolioBattleHue);
        var overlay = this._portfolioGhost;
        if (overlay) {
            overlay.origin.x -= scrollX * 1.32; overlay.origin.y += scrollY * 1.32;
            overlay.tileScale.x = tileScale * 0.8 * (2 - pulse);
            overlay.tileScale.y = tileScale * 0.8 * (2 - pulse);
            paint(overlay, this._portfolioGhostFilter, this._portfolioBattleHue + 120);
        }
    };
})();
