/*:
 * @target MV
 * @plugindesc v1.0 Extensible, data-driven consumables with temporary HP, random stat boosts and state cleansing.
 * @author Jake Mason (portfolio adaptation)
 *
 * @param Vitality Turns
 * @type number
 * @min 1
 * @default 2
 * @param Chaos Turns
 * @type number
 * @min 1
 * @default 4
 * @param Chaos Multiplier
 * @type number
 * @decimals 2
 * @min 1
 * @default 2
 * @param Vitality State ID
 * @type state
 * @default 0
 * @desc Optional display state; zero means the effect has no status icon.
 * @param Chaos State ID
 * @type state
 * @default 0
 *
 * @help
 * Apply exactly one item Note tag:
 *   <DemoEffect: vitality>         Full HP temporarily, then original HP.
 *   <DemoEffect: chaos>            Randomly multiply one stat per turn.
 *   <DemoEffect: random>           Random HP, MP or positive buff outcome.
 *   <DemoEffect: cleanse>          Only if <CleanseStates: 4,5> also present.
 * All tags work with ordinary MV items. No supplied database, art or sound.
 * Check result.isHit before applying a custom effect. This module intentionally
 * avoids project-specific item names and hardcoded state IDs.
 */
(function() {
    'use strict';
    var p = PluginManager.parameters('MV_ConsumableEffects');
    function number(name, fallback, min) {
        var raw = p[name], n = raw === undefined || raw === '' ? fallback : Number(raw);
        return isFinite(n) ? Math.max(min, n) : fallback;
    }
    var vitalityTurns = Math.floor(number('Vitality Turns', 2, 1));
    var chaosTurns = Math.floor(number('Chaos Turns', 4, 1));
    var chaosMultiplier = number('Chaos Multiplier', 2, 1);
    var vitalityState = Math.floor(number('Vitality State ID', 0, 0));
    var chaosState = Math.floor(number('Chaos State ID', 0, 0));
    function effect(item) {
        var m = /<DemoEffect\s*:\s*([^>]+)>/i.exec(item && item.note || '');
        return m ? m[1].trim().toLowerCase() : '';
    }
    function stateList(item) {
        var m = /<CleanseStates\s*:\s*([^>]+)>/i.exec(item.note || '');
        return m ? m[1].split(/[,\s]+/).map(Number).filter(function(id) {
            return id > 0 && Math.floor(id) === id && $dataStates[id];
        }) : [];
    }
    function randomInt(max) { return Math.floor(Math.random() * max); }
    var baseTest = Game_Action.prototype.testApply;
    Game_Action.prototype.testApply = function(target) {
        if (baseTest.call(this, target)) return true;
        var item = this.item();
        return !!(item && DataManager.isItem(item) && effect(item) && target &&
            target.isAlive && target.isAlive() && !this.isForOpponent() && !this.isForDeadFriend());
    };
    var baseApply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        baseApply.call(this, target);
        var item = this.item();
        if (!item || !DataManager.isItem(item) || !target ||
            !target.result || !target.result().isHit()) return;
        var mode = effect(item), roll;
        if (mode === 'vitality') {
            if (!(target._portfolioVitalityTurns > 0)) target._portfolioPreviousHp = target.hp;
            target._portfolioVitalityTurns = vitalityTurns;
            target.setHp(target.mhp);
            if (vitalityState > 0 && $dataStates[vitalityState]) target.addState(vitalityState);
        } else if (mode === 'chaos') {
            target._portfolioChaosTurns = chaosTurns;
            target._portfolioChaosParam = 2 + randomInt(6); // ATK through LUK
            if (chaosState > 0 && $dataStates[chaosState]) target.addState(chaosState);
            target.refresh();
        } else if (mode === 'cleanse') {
            stateList(item).forEach(function(id) { target.removeState(id); });
        } else if (mode === 'random') {
            roll = randomInt(5);
            if (roll === 0) target.gainHp(Math.floor(target.mhp * 0.4));
            else if (roll === 1) target.gainMp(Math.floor(target.mmp * 0.4));
            else if (roll === 2) target.gainHp(-Math.floor(target.mhp * 0.2));
            else if (roll === 3) target.addBuff(2 + randomInt(6), 3);
            else {
                for (var buff = 0; buff < 8; buff++) {
                    if (target.isBuffAffected(buff)) target.removeBuff(buff);
                }
            }
            if (target.startDamagePopup) target.startDamagePopup();
        }
    };
    var baseRate = Game_BattlerBase.prototype.paramRate;
    Game_BattlerBase.prototype.paramRate = function(paramId) {
        var rate = baseRate.call(this, paramId);
        if (this._portfolioChaosTurns > 0 && this._portfolioChaosParam === paramId)
            rate *= chaosMultiplier;
        return rate;
    };
    var baseTurn = Game_Battler.prototype.onTurnEnd;
    Game_Battler.prototype.onTurnEnd = function() {
        baseTurn.call(this);
        if (this._portfolioVitalityTurns > 0 && --this._portfolioVitalityTurns === 0) {
            if (vitalityState) this.removeState(vitalityState);
            var hp = this._portfolioPreviousHp;
            this._portfolioPreviousHp = null;
            this.setHp(Math.max(1, Math.min(this.mhp, hp == null ? this.hp : hp)));
        }
        if (this._portfolioChaosTurns > 0) {
            if (--this._portfolioChaosTurns === 0) {
                this._portfolioChaosParam = null;
                if (chaosState) this.removeState(chaosState);
            } else this._portfolioChaosParam = 2 + randomInt(6);
            this.refresh();
        }
    };
    var baseCleanup = Game_Battler.prototype.removeBattleStates;
    Game_Battler.prototype.removeBattleStates = function() {
        if (this._portfolioVitalityTurns > 0 && this._portfolioPreviousHp != null)
            this.setHp(Math.max(1, Math.min(this.mhp, this._portfolioPreviousHp)));
        baseCleanup.call(this);
        this._portfolioVitalityTurns = 0;
        this._portfolioPreviousHp = null;
        this._portfolioChaosTurns = 0;
        this._portfolioChaosParam = null;
        if (vitalityState) this.removeState(vitalityState);
        if (chaosState) this.removeState(chaosState);
    };
})();
