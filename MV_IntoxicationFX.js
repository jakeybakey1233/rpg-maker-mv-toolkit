/*:
 * @target MV
 * @plugindesc v1.0 Stacking, decaying item-driven status and configurable map-camera distortion. (RPG Maker MV)
 * @author Jake Mason (portfolio adaptation)
 *
 * @param Effect Threshold
 * @type number
 * @min 0
 * @max 100
 * @decimals 1
 * @default 25
 * @desc The intoxication level at which the screen effect begins.
 *
 * @param Maximum Intoxication
 * @type number
 * @min 1
 * @decimals 1
 * @default 300
 * @desc The value is capped. Overflow only ends the game when enabled below.
 *
 * @param Step Decay
 * @type number
 * @min 0
 * @decimals 3
 * @default 0.05
 * @desc Intoxication removed for every player step. Set to 0 to disable.
 *
 * @param Sway Strength
 * @type number
 * @min 0
 * @decimals 2
 * @default 0.8
 *
 * @param Overflow Game Over
 * @type boolean
 * @default false
 * @desc If true, another positive dose while already at max opens the standard Game Over scene.
 * @help
 * Generic status-camera plugin; uses engine effects only.
 * Items or skills: <Intoxication: 30>, <Intoxication: -15>,
 * <Set Intoxication: 60>. Standard Game Over is optional.
 * Commands: Intox Add 30 | Intox Remove 10 | Intox Set 45 |
 * Intox Clear | Intox Effect On | Intox Effect Off.
 * Numbers may be MV variables, e.g. v[2].
 * API: $gameSystem.intoxLevel(), setIntoxLevel(n), addIntoxLevel(n).
 * Warning: high values can cause nausea. Adjust intensity in Plugin Manager.
 */

(function() {
    'use strict';

    var pluginName = 'MV_IntoxicationFX';
    var p = PluginManager.parameters(pluginName);

    function numberParam(name, fallback) {
        var raw = p[name];
        if (raw === undefined || raw === '') return fallback;
        var value = Number(raw);
        return isFinite(value) ? value : fallback;
    }

    var threshold = Math.max(0, numberParam('Effect Threshold', 25));
    var maximum = Math.max(1, numberParam('Maximum Intoxication', 300));
    var stepDecay = Math.max(0, numberParam('Step Decay', 0.05));
    var overflowGameOver = p['Overflow Game Over'] === 'true';
    var swayStrength = Math.max(0, numberParam('Sway Strength', 0.8));

    function clampLevel(value) {
        value = Number(value);
        if (!isFinite(value)) value = 0;
        return Math.max(0, Math.min(maximum, value));
    }

    function resolveNumber(text) {
        text = String(text || '').trim();
        var match = /^v\[(\d+)\]$/i.exec(text);
        return match ? Number($gameVariables.value(Number(match[1]))) : Number(text);
    }

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._portfolioIntoxLevel = 0;
        this._portfolioIntoxEffectEnabled = true;
    };

    Game_System.prototype.intoxLevel = function() {
        if (this._portfolioIntoxLevel === undefined) this._portfolioIntoxLevel = 0;
        return clampLevel(this._portfolioIntoxLevel);
    };

    Game_System.prototype.setIntoxLevel = function(value) {
        this._portfolioIntoxLevel = clampLevel(value);
        return this._portfolioIntoxLevel;
    };

    Game_System.prototype.addIntoxLevel = function(value) {
        value = Number(value || 0);
        if (overflowGameOver && value > 0 && this.intoxLevel() >= maximum) {
            if ($gameTemp) $gameTemp._portfolioIntoxOverdoseGameOver = true;
            return this.intoxLevel();
        }
        return this.setIntoxLevel(this.intoxLevel() + value);
    };

    Game_System.prototype.isIntoxEffectEnabled = function() {
        if (this._portfolioIntoxEffectEnabled === undefined) this._portfolioIntoxEffectEnabled = true;
        return this._portfolioIntoxEffectEnabled;
    };

    Game_System.prototype.setIntoxEffectEnabled = function(enabled) {
        this._portfolioIntoxEffectEnabled = !!enabled;
    };

    Game_System.prototype.intoxEffectIntensity = function() {
        if (!this.isIntoxEffectEnabled()) return 0;
        if (maximum <= threshold) return this.intoxLevel() >= threshold ? 1 : 0;
        return Math.max(0, Math.min(12, (this.intoxLevel() - threshold) / 75));
    };

    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update.call(this);
        if ($gameTemp && $gameTemp._portfolioIntoxOverdoseGameOver &&
                !(this instanceof Scene_Gameover)) {
            $gameTemp._portfolioIntoxOverdoseGameOver = false;
            SceneManager.goto(Scene_Gameover);
        }
    };

    var _Game_Party_increaseSteps = Game_Party.prototype.increaseSteps;
    Game_Party.prototype.increaseSteps = function() {
        _Game_Party_increaseSteps.call(this);
        if ($gameSystem && stepDecay > 0 && $gameSystem.intoxLevel() > 0) {
            $gameSystem.addIntoxLevel(-stepDecay);
        }
    };

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (String(command).toLowerCase() !== 'intox' || !$gameSystem) return;
        var action = String(args[0] || '').toLowerCase();
        var value = resolveNumber(args[1]);
        if (action === 'add' && isFinite(value)) $gameSystem.addIntoxLevel(value);
        if (action === 'remove' && isFinite(value)) $gameSystem.addIntoxLevel(-value);
        if (action === 'set' && isFinite(value)) $gameSystem.setIntoxLevel(value);
        if (action === 'clear') $gameSystem.setIntoxLevel(0);
        if (action === 'effect') {
            $gameSystem.setIntoxEffectEnabled(String(args[1] || '').toLowerCase() !== 'off');
        }
    };

    function applyItemNotetag(item) {
        if (!item || !$gameSystem) return;
        var setMatch = /<Set\s+Intoxication\s*:\s*([+-]?\d+(?:\.\d+)?)\s*>/i.exec(item.note || '');
        var addMatch = /<Intoxication\s*:\s*([+-]?\d+(?:\.\d+)?)\s*>/i.exec(item.note || '');
        if (setMatch) $gameSystem.setIntoxLevel(Number(setMatch[1]));
        else if (addMatch) $gameSystem.addIntoxLevel(Number(addMatch[1]));
    }

    function hasIntoxicationNotetag(item) {
        if (!item) return false;
        return /<(?:Set\s+)?Intoxication\s*:/i.test(item.note || '');
    }

    var _Game_Action_testApply = Game_Action.prototype.testApply;
    Game_Action.prototype.testApply = function(target) {
        if (_Game_Action_testApply.call(this, target)) return true;
        return hasIntoxicationNotetag(this.item()) && target && target.isAlive &&
            target.isAlive() && !this.isForOpponent() && !this.isForDeadFriend();
    };

    var _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        _Game_Action_apply.call(this, target);
        if (!this._portfolioIntoxicationApplied) {
            var item = this.item();
            var result = target && target.result ? target.result() : null;
            if (!result || result.isHit()) {
                applyItemNotetag(item);
                this._portfolioIntoxicationApplied = true;
            }
        }
    };

    var _Spriteset_Map_initialize = Spriteset_Map.prototype.initialize;
    Spriteset_Map.prototype.initialize = function() {
        _Spriteset_Map_initialize.call(this);
        this._portfolioIntoxTime = 0;
        this.pivot.x = Graphics.width / 2;
        this.pivot.y = Graphics.height / 2;
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if (!$gameSystem) return;
        var intensity = $gameSystem.intoxEffectIntensity();
        this._portfolioIntoxTime += 1 / 60;
        var sway = intensity * swayStrength;
        var spinSpeed = 0.80 + intensity * 0.30;
        this.rotation = (Math.sin(this._portfolioIntoxTime * spinSpeed) * 0.038 +
            Math.sin(this._portfolioIntoxTime * 0.37) * 0.012) * sway;
        var zoom = 1 + 0.042 * sway + Math.sin(this._portfolioIntoxTime * 0.68) * 0.010 * sway;
        var stretch = Math.sin(this._portfolioIntoxTime * 2.17) * 0.012 * sway;
        this.scale.x = zoom * (1 + stretch);
        this.scale.y = zoom * (1 - stretch);
        this.x = Graphics.width / 2 + Math.sin(this._portfolioIntoxTime * 1.31) * 11 * sway +
            Math.sin(this._portfolioIntoxTime * 5.7) * 1.5 * sway;
        this.y = Graphics.height / 2 + Math.cos(this._portfolioIntoxTime * 1.07) * 8 * sway +
            Math.cos(this._portfolioIntoxTime * 4.9) * 1.2 * sway;
    };
})();
