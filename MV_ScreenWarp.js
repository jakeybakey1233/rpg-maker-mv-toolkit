/*:
 * @target MV
 * @plugindesc v1.0 Parameterized map-space distortion with optional PIXI shader and canvas-friendly physical fallback.
 * @author Jake Mason (portfolio adaptation)
 *
 * @help
 * Distorts the map and character layer while leaving windows readable.
 * Includes a physical transform fallback that remains visible without WebGL.
 *
 * Plugin commands:
 *
 *   ScreenWarp START 0.8 180
 *   ScreenWarp SET 0.6 180
 *   ScreenWarp STOP 120
 *
 * Strength is from 0.0 to 1.0. Duration is measured in frames.
 */

(function() {
    'use strict';

    var fragmentShader = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        'uniform float uTime;',
        'uniform float uStrength;',
        '',
        'void main(void) {',
        '    vec2 sourceUv = vTextureCoord;',
        '    vec2 p = sourceUv - 0.5;',
        '    float strength = clamp(uStrength, 0.0, 1.0);',
        '    float extreme = smoothstep(0.45, 1.0, strength);',
        '    float radius = length(p);',
        '    float angle = atan(p.y, p.x);',
        '',
        '    angle += sin(radius * 30.0 - uTime * 3.0) * 0.14 * strength;',
        '    radius *= 1.0 + sin(angle * 7.0 + uTime * 2.2) * 0.10 * strength;',
        '    vec2 uv = 0.5 + vec2(cos(angle), sin(angle)) * radius;',
        '',
        '    uv.x += sin(uv.y * 16.0 + uTime * 2.4) * 0.022 * strength;',
        '    uv.y += sin(uv.x * 13.0 - uTime * 1.8) * 0.020 * strength;',
        '    uv.y += (sin(uv.x * 9.0 + uTime * 1.3) +',
        '             sin(uv.x * 27.0 - uTime * 0.8)) * 0.013 * strength;',
        '',
        '    vec2 folded = abs(fract(uv * 1.5 + 0.25) - 0.5) * 1.333333;',
        '    uv = mix(uv, folded, extreme * 0.28);',
        '    uv = clamp(uv, vec2(0.002), vec2(0.998));',
        '',
        '    vec2 split = vec2(',
        '        sin(uTime * 1.7 + uv.y * 8.0),',
        '        cos(uTime * 1.3 + uv.x * 7.0)',
        '    ) * (0.004 + extreme * 0.010) * strength;',
        '',
        '    vec4 center = texture2D(uSampler, uv);',
        '    vec4 redSample = texture2D(uSampler, clamp(uv + split, vec2(0.002), vec2(0.998)));',
        '    vec4 blueSample = texture2D(uSampler, clamp(uv - split, vec2(0.002), vec2(0.998)));',
        '    vec3 colour = vec3(redSample.r, center.g, blueSample.b);',
        '',
        '    vec3 cycled = vec3(',
        '        colour.r * (0.72 + 0.28 * sin(uTime * 1.9 + uv.y * 11.0)) + colour.b * 0.30,',
        '        colour.g * (0.72 + 0.28 * sin(uTime * 2.1 + uv.x * 9.0 + 2.1)) + colour.r * 0.22,',
        '        colour.b * (0.72 + 0.28 * sin(uTime * 1.7 + radius * 18.0 + 4.2)) + colour.g * 0.28',
        '    );',
        '    colour = mix(colour, cycled, strength * 0.78);',
        '',
        '    float bands = sin((uv.y + sin(uv.x * 8.0 + uTime)) * 42.0 - uTime * 4.0);',
        '    float pulse = 1.0 + sin(uTime * 3.2 + radius * 24.0) * 0.10 * strength;',
        '    colour = colour * pulse + bands * 0.055 * strength;',
        '    colour += vec3(',
        '        sin(uTime + uv.x * 6.0),',
        '        sin(uTime + uv.y * 7.0 + 2.1),',
        '        sin(uTime + radius * 12.0 + 4.2)',
        '    ) * 0.075 * extreme;',
        '',
        '    gl_FragColor = vec4(clamp(colour, 0.0, 1.0), center.a);',
        '}'
    ].join('\n');

    function clampStrength(value) {
        value = Number(value);
        if (!isFinite(value)) value = 0;
        return Math.max(0, Math.min(1, value));
    }

    function psychedelicState() {
        if (!$gameScreen._portfolioScreenWarp) {
            $gameScreen._portfolioScreenWarp = {
                current: 0,
                start: 0,
                target: 0,
                duration: 0,
                elapsed: 0,
                time: 0
            };
        }
        return $gameScreen._portfolioScreenWarp;
    }

    function setTarget(strength, duration) {
        var state = psychedelicState();
        state.start = state.current;
        state.target = clampStrength(strength);
        state.duration = Math.max(0, Number(duration) || 0);
        state.elapsed = 0;
        if (state.duration === 0) state.current = state.target;
    }

    var originalGameScreenClear = Game_Screen.prototype.clear;
    Game_Screen.prototype.clear = function() {
        originalGameScreenClear.call(this);
        this._portfolioScreenWarp = null;
    };

    var originalPluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        originalPluginCommand.call(this, command, args);
        if (String(command).toUpperCase() !== 'SCREENWARP') return;

        var action = String(args[0] || '').toUpperCase();
        if (action === 'START' || action === 'SET') {
            setTarget(args[1], args[2]);
        } else if (action === 'STOP') {
            setTarget(0, args[1]);
        }
    };

    var originalCreateLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        originalCreateLowerLayer.call(this);
        // Canvas and headless scenes have no WebGL shader path: the transform
        // fallback below remains active and no PIXI filter is constructed.
        if (typeof PIXI !== 'undefined' && PIXI.Filter &&
            (!Graphics.isWebGL || Graphics.isWebGL())) {
            this._portfolioPsychedelicFilter = new PIXI.Filter(null, fragmentShader, {uTime: 0, uStrength: 0});
            this._portfolioPsychedelicFilter.padding = 32;
            this.filters = (this.filters || []).concat(this._portfolioPsychedelicFilter);
            this.filterArea = new PIXI.Rectangle(-32, -32, Graphics.width + 64, Graphics.height + 64);
        }
    };

    Spriteset_Map.prototype.updatePortfolioPhysicalDistortion = function(strength, time) {
        var base = this._baseSprite;
        var characterSprites = this._characterSprites || [];
        var index;

        if (!base || !base.scale || !base.pivot) return;

        if (strength <= 0.001) {
            base.x = 0;
            base.y = 0;
            base.pivot.x = 0;
            base.pivot.y = 0;
            base.scale.x = 1;
            base.scale.y = 1;
            base.rotation = 0;
            if (base.skew) {
                base.skew.x = 0;
                base.skew.y = 0;
            }
            for (index = 0; index < characterSprites.length; index += 1) {
                characterSprites[index].rotation = 0;
                characterSprites[index].scale.x = 1;
                characterSprites[index].scale.y = 1;
                if (characterSprites[index].skew) {
                    characterSprites[index].skew.x = 0;
                    characterSprites[index].skew.y = 0;
                }
            }
            return;
        }

        var zoomWave = Math.sin(time * 2.7) * 0.030 +
            Math.sin(time * 6.1) * 0.012;
        var zoom = 1.035 + strength * 0.075 + zoomWave * strength;

        base.pivot.x = Graphics.width / 2;
        base.pivot.y = Graphics.height / 2;
        base.x = Graphics.width / 2 +
            (Math.sin(time * 1.8) * 11 + Math.sin(time * 5.3) * 5) * strength;
        base.y = Graphics.height / 2 +
            (Math.cos(time * 1.5) * 9 + Math.sin(time * 4.7) * 5) * strength;
        base.scale.x = zoom * (1 + Math.sin(time * 3.4) * 0.030 * strength);
        base.scale.y = zoom * (1 + Math.cos(time * 2.9) * 0.045 * strength);
        base.rotation = (Math.sin(time * 1.25) * 0.055 +
            Math.sin(time * 4.6) * 0.018) * strength;
        if (base.skew) {
            base.skew.x = Math.sin(time * 2.2) * 0.060 * strength;
            base.skew.y = Math.cos(time * 1.9) * 0.040 * strength;
        }

        for (index = 0; index < characterSprites.length; index += 1) {
            var sprite = characterSprites[index];
            var phase = time * 3.0 + index * 1.731;
            sprite.rotation = Math.sin(phase) * 0.075 * strength;
            sprite.scale.x = 1 + Math.sin(phase * 1.3) * 0.16 * strength;
            sprite.scale.y = 1 + Math.cos(phase * 1.1) * 0.20 * strength;
            if (sprite.skew) {
                sprite.skew.x = Math.sin(phase * 0.9) * 0.08 * strength;
                sprite.skew.y = Math.cos(phase * 1.2) * 0.05 * strength;
            }
        }
    };

    var originalSpritesetMapUpdate = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        originalSpritesetMapUpdate.call(this);
        if (!$gameScreen) return;

        var state = psychedelicState();
        if (state.duration > 0 && state.elapsed < state.duration) {
            state.elapsed += 1;
            var ratio = Math.min(1, state.elapsed / state.duration);
            ratio = ratio * ratio * (3 - 2 * ratio);
            state.current = state.start + (state.target - state.start) * ratio;
        } else {
            state.current = state.target;
        }

        state.time += 1 / 60;
        if (this._portfolioPsychedelicFilter) {
            this._portfolioPsychedelicFilter.uniforms.uTime = state.time;
            this._portfolioPsychedelicFilter.uniforms.uStrength = state.current;
            this._portfolioPsychedelicFilter.enabled = state.current > 0.001;
        }
        this.updatePortfolioPhysicalDistortion(state.current, state.time);
    };
})();
