#!/usr/bin/env python3
"""Install the portfolio demo into a *fresh* RPG Maker MV project, locally.

Never include RPG Maker's licensed runtime/stock assets in the portfolio archive.
The user creates a new, blank MV game themselves and runs this installer.
The tool refuses to overwrite populated map 1 unless --force is explicitly given.
"""
from __future__ import annotations
import argparse
import copy
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['MV_MazeRoamers', 'MV_DialogueLayout', 'MV_ScreenWarp',
            'MV_IntoxicationFX', 'MV_ConsumableEffects', 'MV_BattlebackFX',
            'MV_AtmosphereCamera', 'MV_CinematicDirector']


def get_root(value: Path) -> Path:
    """Accept both desktop MV game root and NW.js deployments with www/."""
    if not (value/'data').is_dir() and (value/'www'/'data').is_dir():
        return value/'www'
    return value


def read_plugins(path: Path) -> list[dict]:
    text = path.read_text(encoding='utf-8-sig')
    m = re.search(r'\bvar\s+\$plugins\s*=\s*(\[.*\])\s*;?\s*$', text, re.S)
    if not m:
        raise ValueError('Could not parse MV js/plugins.js. Its format may be unsupported.')
    plugins = json.loads(m.group(1))
    if not isinstance(plugins, list):
        raise ValueError('Invalid plugin manager array')
    return plugins


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')


def backup(path: Path) -> None:
    dest=path.with_name(path.name+'.portfolio.bak')
    if path.exists() and not dest.exists():
        shutil.copy2(path,dest)


def sample_item(original: dict, id_: int, label: str, note: str, desc: str) -> dict:
    x=copy.deepcopy(original)
    x.update(id=id_, name=label, description=desc, note=note, occasion=0,
             consumable=True, itypeId=1, scope=7, repeats=1, successRate=100,
             price=0, effects=[], traits=x.get('traits', []))
    x['damage']={'critical':False,'elementId':0,'formula':'0','type':0,'variance':0}
    x['iconIndex']=x.get('iconIndex',0) or 0
    return x


def install(project:Path, force:bool=False) -> dict:
    project = get_root(project.expanduser().resolve())
    data=project/'data'; js=project/'js'; plugins_dir=js/'plugins'
    required=[data/n for n in ('Map001.json','MapInfos.json','System.json','Tilesets.json','Items.json')]
    required += [js/'plugins.js']
    missing=[str(p) for p in required if not p.is_file()]
    if missing:
        raise ValueError('Not a complete local RPG Maker MV project. Missing: '+', '.join(missing))
    tilesets=json.loads((data/'Tilesets.json').read_text(encoding='utf-8-sig'))
    if len(tilesets)<=2 or not tilesets[2] or tilesets[2].get('name')!='Outside':
        raise ValueError('Demo expects an unmodified stock Outside tileset at ID 2.')
    old_map=json.loads((data/'Map001.json').read_text(encoding='utf-8-sig'))
    events=[e for e in (old_map.get('events') or []) if e]
    already=old_map.get('displayName')=='Plugin Demo Lab' and '<MazeDemo>' in old_map.get('note','')
    if not force and not already and events:
        raise ValueError('Map001 already has events. Use a FRESH MV project or --force if you accept replacing map 1.')
    # Validate inputs and parse *before* writing anything.
    db=json.loads((data/'Items.json').read_text(encoding='utf-8-sig'))
    info=json.loads((data/'MapInfos.json').read_text(encoding='utf-8-sig'))
    system=json.loads((data/'System.json').read_text(encoding='utf-8-sig'))
    plugin_records=read_plugins(js/'plugins.js')
    template=json.loads((ROOT/'demos'/'Map001.json').read_text(encoding='utf8'))
    if not isinstance(db,list) or not isinstance(info,list) or not isinstance(plugin_records,list):
        raise ValueError('Project database is invalid.')
    existing={v.get('note','').split('\n')[0]:v['id'] for v in db if isinstance(v,dict) and v.get('note','').startswith('<PortfolioSample:')}
    prototypes=[x for x in db if isinstance(x,dict) and x.get('itypeId') == 1]
    if not prototypes:
        raise ValueError('There is no standard item to use as a stock database template.')
    definitions=[
      ('<PortfolioSample: 1>', 'Vitality Sample','<DemoEffect: vitality>','Temporarily restores HP using a custom notetag.'),
      ('<PortfolioSample: 2>', 'Chaos Sample','<DemoEffect: chaos>','Demonstrates configurable random stat modification.'),
      ('<PortfolioSample: 3>', 'Recovery Sample','<Intoxication: -30>\n<DemoEffect: random>','Reduces screen status and applies a random bonus.')]
    assigned={}
    for i,(key,name,effect_note,desc) in enumerate(definitions,1):
        if key in existing:
            assigned[9000+i]=existing[key]
        else:
            new_id=len(db)
            db.append(sample_item(prototypes[0],new_id,name,key+'\n'+effect_note,desc))
            assigned[9000+i]=new_id
    map_obj=copy.deepcopy(template)
    for ev in map_obj['events'][1:]:
        for page_ in ev['pages']:
            for command in page_['list']:
                if command['code']==126 and command['parameters'][0] in assigned:
                    command['parameters'][0]=assigned[command['parameters'][0]]
    while len(info)<=1: info.append(None)
    info[1]={'id':1,'expanded':True,'name':'Plugin Demo Lab','order':1,
             'parentId':0,'scrollX':0,'scrollY':0}
    system['startMapId']=1; system['startX']=3; system['startY']=3
    while len(system['switches'])<=1: system['switches'].append('')
    while len(system['variables'])<=1: system['variables'].append('')
    system['switches'][1]='Demo: Roamer enabled'
    system['variables'][1]='Demo: Capture count'
    # Names are used exactly by PluginManager.parameters() at runtime.
    by_name={p.get('name'):p for p in plugin_records if isinstance(p,dict)}
    for name in REQUIRED:
        if name not in by_name:
            plugin_records.append({'name':name,'status':True,'description':name+' portfolio example',
                                   'parameters':{}})
        else:
            by_name[name]['status']=True
    # Explicit selection of a stock audio/image demonstration: no asset copying.
    for target in [*required]: backup(target)
    plugins_dir.mkdir(parents=True,exist_ok=True)
    for name in REQUIRED:
        dest=plugins_dir/(name+'.js')
        backup(dest)
        shutil.copy2(ROOT/'plugins'/(name+'.js'),dest)
    write_json(data/'Map001.json',map_obj)
    write_json(data/'MapInfos.json',info)
    write_json(data/'Items.json',db)
    write_json(data/'System.json',system)
    (js/'plugins.js').write_text('// Generated by the MV portfolio demo installer.\nvar $plugins = '+
        json.dumps(plugin_records,ensure_ascii=False,indent=2)+';\n', encoding='utf8')
    return {'project':str(project),'plugins':len(REQUIRED),'events':len(map_obj['events'])-1,
            'sample_item_ids':assigned,'backups':'.portfolio.bak'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mv_project',type=Path,help='Fresh RPG Maker MV project directory')
    parser.add_argument('--force',action='store_true',help='Permit replacing a populated Map001.json')
    a=parser.parse_args()
    try:
        result=install(a.mv_project,a.force)
    except (ValueError,OSError,json.JSONDecodeError) as ex:
        parser.error(str(ex))
    print('Installed:',result)
    print('Launch RPG Maker MV, open the project, select New Game, then walk among the stock NPCs.')

if __name__=='__main__': main()
