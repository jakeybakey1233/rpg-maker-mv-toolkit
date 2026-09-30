/* Isolated VM smoke test for a small game-data module; no MV runtime shipped. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const Game_System=function(){};
Game_System.prototype.initialize=function(){};
const Game_Interpreter=function(){};
Game_Interpreter.prototype.pluginCommand=function(){};
const Game_Party=function(){};
Game_Party.prototype.increaseSteps=function(){};
const Game_Action=function(){};
Game_Action.prototype.testApply=function(){return false;};
Game_Action.prototype.apply=function(){};
const Spriteset_Map=function(){};
Spriteset_Map.prototype.initialize=function(){};
Spriteset_Map.prototype.update=function(){};
const Scene_Base=function(){};
Scene_Base.prototype.update=function(){};
const Scene_Gameover=function(){};
const sandbox={console,Math,Game_System,Game_Interpreter,Game_Party,Game_Action,
  Spriteset_Map,Scene_Base,Scene_Gameover,
  PluginManager:{parameters:()=>({'Maximum Intoxication':'300','Step Decay':'0.1','Overflow Game Over':'false'})},
  $gameTemp:{},$gameVariables:{value:()=>0},$gameSystem:null,Graphics:{width:816,height:624},
  SceneManager:{goto(){throw Error('Game-over disabled for this smoke test');}}};
vm.createContext(sandbox);
const path=require('path');
vm.runInContext(fs.readFileSync(path.join(__dirname,'../plugins/MV_IntoxicationFX.js'),'utf8'),sandbox);
sandbox.$gameSystem=new Game_System(); sandbox.$gameSystem.initialize();
const event=new Game_Interpreter();
event.pluginCommand('Intox',['Add','65']); assert.equal(sandbox.$gameSystem.intoxLevel(),65);
event.pluginCommand('Intox',['Add','500']);assert.equal(sandbox.$gameSystem.intoxLevel(),300);
event.pluginCommand('Intox',['Remove','40']);assert.equal(sandbox.$gameSystem.intoxLevel(),260);
event.pluginCommand('Intox',['Effect','Off']);assert.equal(sandbox.$gameSystem.intoxEffectIntensity(),0);
event.pluginCommand('Intox',['Clear']);assert.equal(sandbox.$gameSystem.intoxLevel(),0);
const party=new Game_Party();
event.pluginCommand('Intox',['Add','10']);party.increaseSteps();
assert.ok(sandbox.$gameSystem.intoxLevel() < 10);
console.log('PASS: Intox plugin numeric commands, cap, effect toggle, save-like state and step decay');
