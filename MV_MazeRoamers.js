/*:
 * @target MV
 * @plugindesc v1.0 Generic event AI: chase/wander/route, collision, checkpoints, safe regions and configurable capture/reset.
 * @author Jake Mason (portfolio adaptation)
 * @param Default Speed
 * @type number
 * @decimals 2
 * @default 4.5
 * @param Grace Frames
 * @type number
 * @default 120
 * @param Catch Pause Frames
 * @type number
 * @default 12
 * @param Catch SE
 * @type file
 * @dir audio/se
 * @default Damage5
 * @param Catch SE Volume
 * @type number
 * @default 85
 * @param Catch SE Pitch
 * @type number
 * @default 70
 * @param Catch Effects
 * @type boolean
 * @default true
 * @param Reset Chasers
 * @type boolean
 * @default true
 * @param Path Refresh Frames
 * @type number
 * @default 12
 * @help
 * Use stock NPC character sheets or your own licensed sprites. No custom assets required.
 * Event note: <MazeChaser>
 * Optional: <MazeMode: chase|wander|route> <MazeSpeed: 4.5>
 * Optional: <MazeSwitch: 1> <MazeOff>
 * Map note: <MazeStart: 3,3,2> <MazeSafeRegion: 251>
 * DEMO ONLY: <MazeDemo> makes region 250 an impassable wall.
 * Commands: Maze SetStart Here | Maze SetStart 3 3 2 | Maze Start |
 * Maze Stop | Maze Reset | Maze Speed This 4.5 | Maze Mode This wander |
 * Maze Count 1 | Maze Refresh
 * AI modes are independent and configurable per event.
 */
(function() {
    'use strict';
    var P = PluginManager.parameters('MV_MazeRoamers');
    function number(value, fallback, min, max) {
        var n = value === undefined || value === '' ? fallback : Number(value);
        if (!isFinite(n)) n = fallback;
        return Math.max(min, Math.min(max, n));
    }
    var options = {
        speed: number(P['Default Speed'], 4.5, 1, 6),
        grace: Math.floor(number(P['Grace Frames'], 120, 0, 36000)),
        pause: Math.floor(number(P['Catch Pause Frames'], 12, 0, 600)),
        se: P['Catch SE'] === undefined ? 'Damage5' : P['Catch SE'],
        volume: number(P['Catch SE Volume'], 85, 0, 100),
        pitch: number(P['Catch SE Pitch'], 70, 50, 150),
        effects: P['Catch Effects'] !== 'false',
        reset: P['Reset Chasers'] !== 'false',
        refresh: Math.floor(number(P['Path Refresh Frames'], 12, 1, 600))
    };
    var directions = [2, 4, 6, 8];
    var field = null; // Rebuildable runtime cache: never serialized into saves.
    var ticks = 0;

    function tag(text, key) {
        var expression = new RegExp('<' + key + '(?:\\s*:\\s*([^>]*))?\\s*>', 'gi');
        var match, result = null;
        while ((match = expression.exec(text || ''))) result = (match[1] || '').trim();
        return result;
    }
    function state() { return $gameMap && $gameMap._portfolioMaze; }
    function tagged(event) { return !!(event && event._portfolioMaze && !event._erased && event.page()); }
    function enabled(event) {
        return tagged(event) && (!event._portfolioMaze.switchId || $gameSwitches.value(event._portfolioMaze.switchId));
    }
    function sceneReady() {
        var scene = SceneManager._scene;
        return scene instanceof Scene_Map && scene.isActive() && !SceneManager.isSceneChanging();
    }
    function ready() {
        var s = state();
        return !!(s && s.enabled && !s.resetting && s.grace <= 0 && sceneReady() &&
            !$gameMap.isEventRunning() && !$gameMessage.isBusy() &&
            !$gamePlayer.isTransferring() && !$gamePlayer.isInVehicle());
    }
    function safe(x, y) {
        var s = state();
        return !!(s && s.safeRegion && $gameMap.regionId(x, y) === s.safeRegion);
    }
    function next(x, y, d) {
        return {x: $gameMap.roundXWithDirection(x, d), y: $gameMap.roundYWithDirection(y, d)};
    }
    function edge(x, y, d) {
        var n = next(x, y, d);
        return $gameMap.isValid(x, y) && $gameMap.isValid(n.x, n.y) &&
            $gameMap.isPassable(x, y, d) && $gameMap.isPassable(n.x, n.y, 10 - d);
    }
    function occupied(x, y) {
        return $gameMap.eventsXyNt(x, y).some(function(e) {
            return !tagged(e) && e.isNormalPriority();
        }) || $gameMap.boat().posNt(x, y) || $gameMap.ship().posNt(x, y);
    }
    function openTile(x, y) {
        return $gameMap.isValid(x, y) && !occupied(x, y) &&
            directions.some(function(d) { return edge(x, y, d); });
    }
    function checkpoint(x, y, d) {
        x = Number(x); y = Number(y); d = Number(d || 2);
        if (x % 1 || y % 1 || !isFinite(x) || !isFinite(y) || !openTile(x, y)) {
            console.warn('MV_MazeRoamers: checkpoint must be an open, valid tile.', x, y);
            return false;
        }
        state().spawn = {x: x, y: y, d: directions.indexOf(d) >= 0 ? d : 2};
        return true;
    }
    function ensureCheckpoint() {
        var s = state();
        if (s && !s.spawn) checkpoint($gamePlayer.x, $gamePlayer.y, $gamePlayer.direction());
    }
    function closestOpen(spawn) {
        if (!spawn) return null;
        if (openTile(spawn.x, spawn.y)) return spawn;
        // This only handles a checkpoint invalidated by a later map edit.
        var best = null, distance = Infinity;
        for (var y = 0; y < $gameMap.height(); y++) {
            for (var x = 0; x < $gameMap.width(); x++) {
                var n = $gameMap.distance(x, y, spawn.x, spawn.y);
                if (n < distance && openTile(x, y)) {
                    best = {x: x, y: y, d: spawn.d}; distance = n;
                }
            }
        }
        return best;
    }
    function reset() {
        var s = state();
        if (!s) return;
        s.resetting = false; s.remaining = 0;
        var spawn = closestOpen(s.spawn);
        if (!spawn) {
            s.enabled = false;
            console.warn('MV_MazeRoamers: no open checkpoint; chase paused. Use Maze SetStart.');
            return;
        }
        if (options.reset) {
            $gameMap.events().forEach(function(e) {
                if (!tagged(e)) return;
                if (e.isMoveRouteForcing()) e.restoreMoveRoute();
                e._moveRouteForcing = false;
                e._moveRouteIndex = 0; e._waitCount = 0; e._stopCount = 0;
                e._locked = false; e._starting = false; e._portfolioMazeWait = 0;
                e._jumpCount = 0;
                e.locate(e.event().x, e.event().y);
                e.setMoveSpeed(e._portfolioMaze.speed);
            });
        }
        $gameTemp.clearDestination();
        $gamePlayer.locate(spawn.x, spawn.y);
        $gamePlayer.setDirection(spawn.d);
        $gamePlayer.followers().synchronize(spawn.x, spawn.y, spawn.d);
        s.grace = options.grace;
        field = null;
    }
    function catchPlayer(event) {
        if (!enabled(event) || !ready() || safe($gamePlayer.x, $gamePlayer.y) ||
            event.isJumping() || $gamePlayer.isJumping() ||
            $gamePlayer.isThrough() || $gamePlayer.isDebugThrough()) return false;
        ensureCheckpoint();
        if (!state().spawn) return false;
        var s = state();
        s.count++; s.resetting = true; s.remaining = options.pause;
        $gameTemp.clearDestination();
        if (options.se) AudioManager.playSe({name: options.se, volume: options.volume, pitch: options.pitch, pan: 0});
        if (options.effects) {
            $gameScreen.startFlash([255, 60, 50, 100], 12);
            $gameScreen.startShake(5, 6, 18);
        }
        if (!s.remaining) reset();
        return true;
    }
    function touchingAcross(x, y, tx, ty) {
        return directions.some(function(d) {
            var n = next(x, y, d);
            return n.x === tx && n.y === ty && edge(x, y, d);
        });
    }
    function buildField() {
        var mapId = $gameMap.mapId(), w = $gameMap.width(), h = $gameMap.height();
        var px = $gamePlayer.x, py = $gamePlayer.y;
        if (field && field.mapId === mapId && field.x === px && field.y === py &&
            ticks - field.tick < options.refresh) return field;
        var length = w * h, dist = new Int32Array(length), blocked = new Uint8Array(length);
        for (var i = 0; i < length; i++) dist[i] = -1;
        $gameMap.events().forEach(function(e) {
            if (!tagged(e) && !e.isThrough() && e.isNormalPriority() && $gameMap.isValid(e.x, e.y)) {
                blocked[e.x + e.y * w] = 1;
            }
        });
        [$gameMap.boat(), $gameMap.ship()].forEach(function(v) {
            if (v._mapId === mapId && !v.isThrough() && $gameMap.isValid(v.x, v.y)) blocked[v.x + v.y * w] = 1;
        });
        field = {mapId: mapId, x: px, y: py, tick: ticks, dist: dist};
        if (!$gameMap.isValid(px, py) || safe(px, py)) return field;
        var queue = new Int32Array(length), head = 0, tail = 0, start = px + py * w;
        dist[start] = 0; queue[tail++] = start;
        while (head < tail) {
            var cell = queue[head++], x = cell % w, y = Math.floor(cell / w);
            for (var j = 0; j < directions.length; j++) {
                var d = directions[j], n = next(x, y, d), index = n.x + n.y * w;
                if (!$gameMap.isValid(n.x, n.y) || dist[index] >= 0 || blocked[index] || safe(n.x, n.y)) continue;
                // Reverse expansion preserves both ends of directional tile passage.
                if (!edge(n.x, n.y, 10 - d)) continue;
                dist[index] = dist[cell] + 1; queue[tail++] = index;
            }
        }
        return field;
    }
    function pursue(event) {
        var f = buildField(), w = $gameMap.width(), best = Infinity, choice = 0;
        for (var i = 0; i < directions.length; i++) {
            var d = directions[i], n = next(event.x, event.y, d);
            if (!$gameMap.isValid(n.x, n.y) || !edge(event.x, event.y, d) || safe(n.x, n.y)) continue;
            var distance = f.dist[n.x + n.y * w];
            if (distance < 0 || distance >= best) continue;
            if (!event.canPass(event.x, event.y, d) && !$gamePlayer.pos(n.x, n.y)) continue;
            best = distance; choice = d;
        }
        if (choice) event.moveStraight(choice);
        else event._portfolioMazeWait = 6;
    }
    function wander(event) {
        var choices = directions.filter(function(d) {
            var n = next(event.x, event.y, d);
            return edge(event.x, event.y, d) && !safe(n.x, n.y) &&
                (event.canPass(event.x, event.y, d) || $gamePlayer.pos(n.x, n.y));
        });
        if (!choices.length) { event._portfolioMazeWait = 6; return; }
        var last = event._portfolioMazeLastDirection, forward = choices.indexOf(last) >= 0;
        if (choices.length > 1) choices = choices.filter(function(d) { return d !== 10 - last; });
        var choice = forward && Math.random() < 0.7 ? last : choices[Math.floor(Math.random() * choices.length)];
        event._portfolioMazeLastDirection = choice;
        event.moveStraight(choice);
    }

    var mapSetup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        this._portfolioMaze = null; field = null; ticks = 0;
        mapSetup.call(this, mapId);
        var note = $dataMap.note || '';
        this._portfolioMaze = {enabled: true, spawn: null, grace: options.grace, resetting: false,
            remaining: 0, count: 0, safeRegion: Math.floor(number(tag(note, 'MazeSafeRegion'), 0, 0, 255)),
            demo: tag(note, 'MazeDemo') !== null};
        var value = tag(note, 'MazeStart');
        if (value) {
            var coords = value.split(/\s*,\s*|\s+/);
            checkpoint(coords[0], coords[1], coords[2]);
        }
        if (!this._portfolioMaze.spawn) {
            this.events().some(function(e) {
                if (tag(e.event().note, 'MazeStart') === null) return false;
                return checkpoint(e.event().x, e.event().y, 2);
            });
        }
    };
    var mapPassable = Game_Map.prototype.isPassable;
    Game_Map.prototype.isPassable = function(x, y, d) {
        if (this._portfolioMaze && this._portfolioMaze.demo) return this.isValid(x, y) && this.regionId(x, y) !== 250;
        return mapPassable.call(this, x, y, d);
    };

    var setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
        this._portfolioMaze = null;
        setupPage.call(this);
        field = null;
        if (!this.page() || this._erased) return;
        var text = this.event().note || '';
        this.list().forEach(function(command) {
            if (command.code === 108 || command.code === 408) text += '\n' + command.parameters[0];
        });
        if (tag(text, 'MazeChaser') === null || tag(text, 'MazeOff') !== null) return;
        var mode = (tag(text, 'MazeMode') || 'chase').toLowerCase();
        this._portfolioMaze = {
            mode: ['chase', 'wander', 'route'].indexOf(mode) >= 0 ? mode : 'chase',
            speed: number(tag(text, 'MazeSpeed') === null ? undefined : tag(text, 'MazeSpeed'), options.speed, 1, 6),
            switchId: Math.floor(number(tag(text, 'MazeSwitch'), 0, 0, 999999))
        };
        this._portfolioMazeWait = 0;
        this.setWalkAnime(false); this.setStepAnime(false); this.setDirectionFix(true);
        this.setThrough(false); this.setPriorityType(1); this.setMoveFrequency(5);
        this.setMoveSpeed(this._portfolioMaze.speed); this.setPattern(1);
    };
    var selfMovement = Game_Event.prototype.updateSelfMovement;
    Game_Event.prototype.updateSelfMovement = function() {
        if (!tagged(this)) return selfMovement.call(this);
        if (!enabled(this) || !ready() || this._locked) return;
        if (this.pos($gamePlayer.x, $gamePlayer.y) && catchPlayer(this)) return;
        if (this._portfolioMazeWait > 0) { this._portfolioMazeWait--; return; }
        if (this._portfolioMaze.mode === 'route') return selfMovement.call(this);
        if (this._portfolioMaze.mode === 'wander') wander(this);
        else pursue(this);
    };
    // Forced routes are explicit event commands. Leave them alone so a
    // cutscene waiting for route completion cannot deadlock while AI is paused.
    var nearScreen = Game_Event.prototype.isNearTheScreen;
    Game_Event.prototype.isNearTheScreen = function() {
        return tagged(this) || nearScreen.call(this);
    };
    var eventPassage = Game_Event.prototype.isMapPassable;
    Game_Event.prototype.isMapPassable = function(x, y, d) {
        var n = next(x, y, d);
        if (tagged(this) && safe(n.x, n.y)) return false;
        return eventPassage.call(this, x, y, d);
    };
    var eventCollision = Game_Event.prototype.isCollidedWithEvents;
    Game_Event.prototype.isCollidedWithEvents = function(x, y) {
        if (!tagged(this)) return eventCollision.call(this, x, y);
        return $gameMap.eventsXyNt(x, y).some(function(e) { return !tagged(e) && e.isNormalPriority(); });
    };
    var playerCollision = Game_Event.prototype.isCollidedWithPlayerCharacters;
    Game_Event.prototype.isCollidedWithPlayerCharacters = function(x, y) {
        if (!tagged(this)) return playerCollision.call(this, x, y);
        return this.isNormalPriority() && !$gamePlayer.isThrough() && $gamePlayer.pos(x, y);
    };
    var eventTouch = Game_Event.prototype.checkEventTriggerTouch;
    Game_Event.prototype.checkEventTriggerTouch = function(x, y) {
        if (!tagged(this)) return eventTouch.call(this, x, y);
        if ($gamePlayer.pos(x, y) && touchingAcross(this.x, this.y, x, y)) catchPlayer(this);
    };
    var playerTouch = Game_Player.prototype.checkEventTriggerTouch;
    Game_Player.prototype.checkEventTriggerTouch = function(x, y) {
        var caught = false;
        if (touchingAcross(this.x, this.y, x, y)) {
            $gameMap.eventsXy(x, y).some(function(e) { caught = catchPlayer(e); return caught; });
        }
        if (!caught) playerTouch.call(this, x, y);
    };
    var canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        return !(state() && state().resetting) && canMove.call(this);
    };
    var transfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        var transferring = this.isTransferring();
        transfer.call(this);
        if (transferring) { field = null; ensureCheckpoint(); }
    };
    var updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        ensureCheckpoint();
        updateMain.call(this);
        var s = state();
        if (!s || !this.isActive() || !sceneReady()) return;
        ticks++;
        if (s.resetting) {
            if (--s.remaining <= 0) reset();
            return;
        }
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return;
        if (s.grace > 0) s.grace--;
        if (ready()) $gameMap.eventsXy($gamePlayer.x, $gamePlayer.y).some(catchPlayer);
    };
    var extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        extractSave.call(this, contents);
        field = null; ticks = 0;
    };
    var mapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        mapLoaded.call(this);
        field = null;
        // An old save created before this plugin has no state. Wait until its
        // correct $dataMap is loaded before reading event pages or map notes.
        if ($gameMap && !$gameMap._portfolioMaze) {
            var note = $dataMap.note || '';
            $gameMap._portfolioMaze = {enabled: true, spawn: null, grace: options.grace,
                resetting: false, remaining: 0, count: 0,
                safeRegion: Math.floor(number(tag(note, 'MazeSafeRegion'), 0, 0, 255)),
                demo: tag(note, 'MazeDemo') !== null};
            $gameMap.events().forEach(function(e) { e.setupPage(); });
            var value = tag(note, 'MazeStart');
            if (value) {
                var coords = value.split(/\s*,\s*|\s+/);
                checkpoint(coords[0], coords[1], coords[2]);
            }
            if (!state().spawn) $gameMap.events().some(function(e) {
                return tag(e.event().note, 'MazeStart') !== null && checkpoint(e.event().x, e.event().y, 2);
            });
        }
        ensureCheckpoint();
    };
    var command = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(name, args) {
        command.call(this, name, args);
        if (String(name).toLowerCase() !== 'maze' || !state()) return;
        var action = String(args[0] || '').toLowerCase(), s = state();
        if (action === 'setstart') {
            if (String(args[1]).toLowerCase() === 'here') checkpoint($gamePlayer.x, $gamePlayer.y, $gamePlayer.direction());
            else checkpoint(args[1], args[2], args[3]);
        } else if (action === 'stop') {
            s.enabled = false;
        } else if (action === 'start') {
            s.enabled = true; s.grace = options.grace; field = null;
        } else if (action === 'reset') {
            ensureCheckpoint(); reset();
        } else if (action === 'refresh') {
            field = null;
        } else if (action === 'count') {
            var variableId = Number(args[1]);
            if (variableId > 0 && variableId % 1 === 0 && variableId < $dataSystem.variables.length) {
                $gameVariables.setValue(variableId, s.count);
            }
        } else if (action === 'speed' || action === 'mode') {
            var id = String(args[1]).toLowerCase() === 'this' ? this._eventId : Number(args[1]);
            var e = $gameMap.event(id);
            if (!tagged(e)) return;
            if (action === 'speed') {
                e._portfolioMaze.speed = number(args[2], e._portfolioMaze.speed, 1, 6);
                e.setMoveSpeed(e._portfolioMaze.speed);
            } else if (['chase', 'wander', 'route'].indexOf(String(args[2]).toLowerCase()) >= 0) {
                e._portfolioMaze.mode = String(args[2]).toLowerCase();
            }
            field = null;
        }
    };
})();
