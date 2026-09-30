"""Build a new, stock-asset-only RPG Maker MV showcase map from structured event data.

The map is intentionally original. It contains no exported event dialogue, image or
map data from any existing game, and no RPG Maker stock asset binaries.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
W, H = 27, 19
AREA = W * H
DATA = [0] * (6 * AREA)
FLOOR, WALL, WALL_REGION, SAFE_REGION = 1536, 5888, 250, 251
for y in range(H):
    for x in range(W):
        DATA[y * W + x] = FLOOR

# The maze combines a visible stock-tile wall with an explicit, isolated demo
# region rule. Region 250 is only treated specially on <MazeDemo> maps.
walls = set()
for x in range(W):
    walls.add((x, 0)); walls.add((x, H-1))
for y in range(H):
    walls.add((0, y)); walls.add((W-1, y))
for x in range(12, 26):
    walls.add((x, 5)); walls.add((x, 15))
for y in range(5, 16):
    walls.add((12, y)); walls.add((25, y))
walls -= {(12, 9)}  # Main entrance to the pathfinding demonstration.
for x0, y0, x1, y1, gaps in [
    (15, 6, 15, 14, {(15, 8), (15, 13)}),
    (19, 6, 19, 14, {(19, 7), (19, 11)}),
    (22, 6, 22, 14, {(22, 9), (22, 13)}),
    (13, 8, 24, 8, {(15,8), (19,8), (23,8)}),
    (13, 12, 24, 12, {(14,12), (17,12), (21,12)}),
]:
    if x0 == x1:
        walls.update((x0, y) for y in range(y0, y1 + 1) if (x0, y) not in gaps)
    else:
        walls.update((x, y0) for x in range(x0, x1 + 1) if (x, y0) not in gaps)
walls -= {(15, 8), (19, 8), (23, 8), (14, 12), (17, 12), (21, 12)}
for x, y in walls:
    DATA[y * W + x] = WALL
    DATA[5 * AREA + y * W + x] = WALL_REGION
for y in range(1, 5):
    for x in range(1, 8):
        DATA[5 * AREA + y * W + x] = SAFE_REGION

CONDITIONS = dict(actorId=1, actorValid=False, itemId=1, itemValid=False,
                  selfSwitchCh='A', selfSwitchValid=False, switch1Id=1,
                  switch1Valid=False, switch2Id=1, switch2Valid=False,
                  variableId=1, variableValid=False, variableValue=0)

def cmd(code:int, params:list | None = None, indent:int = 0):
    return {'code':code,'indent':indent,'parameters':params if params is not None else []}

def msg(text, speaker='Guide', indent=0):
    # The stock game doesn't use portraits. MV_DialogueLayout recognizes the
    # literal backslash-n naming tag at the end of this message.
    lines = [cmd(101,['',0,0,2],indent)]
    for line in text.split('\n'):
        lines.append(cmd(401,[line],indent))
    if speaker:
        lines.append(cmd(401,['\\n<' + speaker + '>'],indent))
    return lines

def plugin(text, indent=0): return cmd(356,[text],indent)

def choices(labels, branches, intro=None, speaker='Guide'):
    result = []
    if intro: result += msg(intro,speaker)
    result.append(cmd(102,[labels, -2,0,2,0]))
    for idx, content in enumerate(branches):
        result.append(cmd(402,[idx,labels[idx]]))
        result.extend(content)
    result.append(cmd(404))
    return result

def page(commands, char='People1', char_index=0, direction=2,trigger=0,priority=1):
    return {'conditions':CONDITIONS.copy(),'directionFix':False,
            'image':{'characterIndex':char_index,'characterName':char,
                     'direction':direction,'pattern':1,'tileId':0},
            'list':commands+[cmd(0)], 'moveFrequency':3,
            'moveRoute':{'list':[{'code':0,'parameters':[]}], 'repeat':True,
                         'skippable':False, 'wait':False}, 'moveSpeed':3,
            'moveType':0,'priorityType':priority,'stepAnime':False,'through':False,
            'trigger':trigger,'walkAnime':True}

EVENTS = [None]
def event(name,x,y,commands,note='',char='People1',index=0):
    i=len(EVENTS)
    EVENTS.append({'id':i,'name':name,'note':note,'pages':[page(commands,char,index)],
                   'x':x,'y':y})
    return i

# NPCs have completely original, functional placeholder dialogue, with no
# faces, cutscenes, sound or art carried from the user's original project.
event('Welcome / module index',4,3,
    msg('Welcome to the plugin demonstration map. Each nearby NPC tests one isolated module. This world uses fresh event text and the stock RPG Maker MV assets.','Demonstration Guide')
    + msg('The left area is a safe testing zone. Enter the region maze on the right only after enabling the roamer.','Demonstration Guide'),index=0)
event('Maze controller',8,9,
    choices(['Start chase','Pause chase','Set checkpoint','Reset player','Read captures'],[
        [cmd(121,[1,1,0],1),plugin('Maze Start',1)]+msg('The roamer is now enabled. Enter the maze at the east opening.','Maze Control',1),
        [cmd(121,[1,1,1],1),plugin('Maze Stop',1)]+msg('Roamer AI paused.','Maze Control',1),
        [plugin('Maze SetStart Here',1)]+msg('Your current tile is the new checkpoint.','Maze Control',1),
        [plugin('Maze Reset',1)]+msg('Checkpoint restored.','Maze Control',1),
        [plugin('Maze Count 1',1)]+msg('Captures are stored in variable 1. Open F9 while playtesting to inspect it.','Maze Control',1),
    ],intro='Which pathfinding feature would you like to test?',speaker='Maze Control'),index=1)
event('Persistent status controller',3,7,
    choices(['Increase status','Reduce status','Set to moderate','Clear status','Effect toggle'],[
        [plugin('Intox Add 65',1)]+msg('The effect stacks and decays slightly as you walk.','Status Laboratory',1),
        [plugin('Intox Remove 30',1)]+msg('The accumulated level has been reduced.','Status Laboratory',1),
        [plugin('Intox Set 60',1)]+msg('The level is now sixty.','Status Laboratory',1),
        [plugin('Intox Clear',1)]+msg('The status level is now zero.','Status Laboratory',1),
        [plugin('Intox Effect Off',1)]+msg('Display disabled. Talk again to restore it.','Status Laboratory',1),
    ],intro='Choose a status effect operation.',speaker='Status Laboratory'),index=2)
event('Effect re-enable',5,7,[plugin('Intox Effect On')]+msg('Status visual effects are enabled again.','Status Laboratory'),index=3)
event('Distortion controls',8,3,
    choices(['Start mild warp','Increase warp','Restore visuals'],[
        [plugin('ScreenWarp START 0.35 90',1)]+msg('The map begins distorting over ninety frames.','Effects Console',1),
        [plugin('ScreenWarp SET 0.7 120',1)]+msg('Distortion intensity is increasing.','Effects Console',1),
        [plugin('ScreenWarp STOP 90',1)]+msg('Returning to normal visuals.','Effects Console',1),
    ],intro='Test the renderer effect independently.',speaker='Effects Console'),index=4)
event('Atmosphere controls',8,6,
    choices(['Enable clouds','Disable clouds','Reset zoom'],[
        [plugin('Atmosphere Start',1)]+msg('Clouds drift independently; the camera zoom only changes when you walk.','Atmosphere Console',1),
        [plugin('Atmosphere Stop',1)]+msg('Clouds are hidden and the camera is restored.','Atmosphere Console',1),
        [plugin('Atmosphere Reset',1)]+msg('Atmosphere state has been reset.','Atmosphere Console',1),
    ],intro='Try the procedural camera-and-weather controller.',speaker='Atmosphere Console'),index=5)
event('Cinematic demonstration',4,12,
    [*msg('This event orchestrates stock NPCs while leaving dialogue and audio to ordinary MV event commands.','Director'),
     plugin('Cine Start'),plugin('Cine Crowd On'),cmd(250,[{'name':'Decision1','pan':0,'pitch':100,'volume':70}]),
     *msg('Three background performers will rotate independently during the next scene.','Director'),
     cmd(230,[75]),plugin('Cine Shake 2 4 22'),
     *msg('The cutscene now restores its prior screen tone and background music.','Director'),
     plugin('Cine Crowd Off'),plugin('Cine End')],index=6)
for name,x,y,idx in [('Performer A',3,15,2),('Performer B',5,15,3),('Performer C',7,15,4)]:
    event(name,x,y,msg('I am an ordinary stock-sprite event.','Extra'),note='<CineExtra>',index=idx)
event('Item samples',10,12,
    [*msg('Receive three safe demonstration consumables. Open the Item menu and use them on a party member.','Consumable Lab'),
     cmd(126,[9001,0,0,1]),cmd(126,[9002,0,0,1]),cmd(126,[9003,0,0,1]),
     *msg('The examples use item note tags instead of special-case item IDs in JavaScript.','Consumable Lab')],index=5)
event('Battleback trial',10,3,
    choices(['Start stock battle','Never mind'],[
       [*msg('This launches the first default enemy troop. Configure the battleback plugin troop ID if your project differs.','Battle Console',1),cmd(301,[0,1,True,True],1)],
       [*msg('You can return to this station later.','Battle Console',1)]
    ],intro='Would you like to test the animated stock battleback?',speaker='Battle Console'),index=6)
event('Maze roamer A',17,7,
    msg('The AI manages my movement when enabled.','Roamer'),
    note='<MazeChaser>\n<MazeMode: chase>\n<MazeSwitch: 1>\n<MazeSpeed: 4>',index=7)
event('Maze roamer B',23,13,
    msg('You can configure pursuit and independent wandering per event.','Roamer'),
    note='<MazeChaser>\n<MazeMode: wander>\n<MazeSwitch: 1>\n<MazeSpeed: 3.5>',index=0)
MAP={'autoplayBgm':False,'autoplayBgs':False,'battleback1Name':'','battleback2Name':'',
     'bgm':{'name':'','pan':0,'pitch':100,'volume':90},
     'bgs':{'name':'','pan':0,'pitch':100,'volume':90},
     'disableDashing':False,'displayName':'Plugin Demo Lab',
     'encounterList':[],'encounterStep':30,'height':H,'width':W,
     'note':'<MazeDemo>\n<MazeStart: 3,3,2>\n<MazeSafeRegion: 251>\n<AtmosphereAllowed>',
     'parallaxLoopX':False,'parallaxLoopY':False,'parallaxName':'',
     'parallaxShow':False,'parallaxSx':0,'parallaxSy':0,
     'scrollType':0,'specifyBattleback':False,'tilesetId':2,'data':DATA,'events':EVENTS}

def main():
    out=ROOT/'demos'/'Map001.json'
    out.write_text(json.dumps(MAP,ensure_ascii=False,separators=(',', ':'))+'\n',encoding='utf8')
    (ROOT/'demos'/'MapInfos.json').write_text(json.dumps([None,{'id':1,'expanded':True,
        'name':'Plugin Demo Lab','order':1,'parentId':0,'scrollX':0,'scrollY':0}],separators=(',',':'))+'\n')
    print('Generated stock MV demo:',W,'x',H,len(EVENTS)-1,'events',len(DATA),'layer values')
if __name__ == '__main__': main()
