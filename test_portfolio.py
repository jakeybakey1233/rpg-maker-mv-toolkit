"""Deterministic checks that do not depend on owning RPG Maker MV's runtime."""
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from install_demo import install, read_plugins

class PortfolioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.map=json.loads((ROOT/'demos'/'Map001.json').read_text())

    def test_js_syntax(self):
        files=list((ROOT/'plugins').glob('*.js'))
        self.assertEqual(len(files),9)
        for f in files:
            with self.subTest(f=f.name):
                p=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
                self.assertEqual(p.returncode,0,p.stderr)

    def test_stock_map_layout_and_event_commands(self):
        m=self.map
        self.assertEqual((m['width'],m['height'],m['tilesetId']),(27,19,2))
        self.assertEqual(len(m['data']),6*m['width']*m['height'])
        self.assertEqual(len([x for x in m['events'] if x]),14)
        self.assertEqual(m['data'][5*(27*19)+(3*27)+3],251)
        self.assertEqual(m['data'][5*(27*19)+(6*27)+12],250)
        found=set()
        for i,e in enumerate(m['events']):
            if i==0: self.assertIsNone(e); continue
            self.assertEqual(e['id'],i)
            self.assertTrue(0 < e['x'] < m['width']-1 and 0 < e['y'] < m['height']-1)
            for p in e['pages']:
                self.assertIn(p['image']['characterName'],['People1'])
                self.assertEqual(p['list'][-1]['code'],0)
                self.assertTrue(all(set(c)=={'code','indent','parameters'} for c in p['list']))
                found.update(c['parameters'][0].split(' ')[0] for c in p['list']
                    if c['code']==356)
        self.assertTrue({'Intox','Maze','ScreenWarp','Atmosphere','Cine'} <= found)
        self.assertIn('<MazeChaser>',str(m['events']))
        self.assertIn('<CineExtra>',str(m['events']))

    def test_no_original_media_assets_or_private_names(self):
        disallow=re.compile(r'private_project_name|private_actor|private_media|custom_face|custom_song',re.I)
        for f in ROOT.rglob('*'):
            if not f.is_file() or f == Path(__file__) or any(s in f.parts for s in ('__pycache__','.git')): continue
            if f.suffix in ('.js','.json','.md','.py'):
                with self.subTest(f=str(f.relative_to(ROOT))):
                    self.assertIsNone(disallow.search(f.read_text(encoding='utf8')))
        binaries=[f for f in ROOT.rglob('*') if f.is_file() and f.suffix.lower() in
                  ('.png','.jpg','.jpeg','.gif','.mp3','.ogg','.m4a','.webm','.mp4')]
        self.assertEqual(binaries,[],'The portfolio package must never contain game media')

    def make_fixture(self,p:Path):
        (p/'data').mkdir(); (p/'js'/'plugins').mkdir(parents=True)
        plain={'width':17,'height':13,'displayName':'Untouched map','events':[None]}
        for name,value in {
            'Map001.json':plain,'MapInfos.json':[None,{'id':1,'name':'Original'}],
            'System.json':{'startMapId':1,'startX':0,'startY':0,'switches':[''], 'variables':['']},
            'Tilesets.json':[None,{'id':1,'name':'Overworld'},{'id':2,'name':'Outside'}],
            'Items.json':[None,{'id':1,'name':'Item','itypeId':1,'note':'','damage':{}}],
        }.items(): (p/'data'/name).write_text(json.dumps(value))
        (p/'js'/'plugins.js').write_text('var $plugins = [];')

    def test_installer_and_idempotency(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);self.make_fixture(p)
            first=install(p)
            self.assertEqual(first['plugins'],8)
            self.assertEqual(first['events'],14)
            self.assertEqual(len(list((p/'js'/'plugins').glob('*.js'))),8)
            ids=first['sample_item_ids']
            items=json.loads((p/'data'/'Items.json').read_text())
            self.assertEqual(len(items),5)
            self.assertEqual({m['id'] for m in items if m}, {1,*ids.values()})
            self.assertEqual(len(read_plugins(p/'js'/'plugins.js')),8)
            installed=json.loads((p/'data'/'Map001.json').read_text())
            giver=next(e for e in installed['events'] if e and e['name']=='Item samples')
            gains=[c['parameters'][0] for c in giver['pages'][0]['list'] if c['code']==126]
            self.assertEqual(gains,list(ids.values()))
            self.assertTrue((p/'data'/'Map001.json.portfolio.bak').exists())
            original=json.loads((p/'data'/'Map001.json.portfolio.bak').read_text())
            self.assertEqual(original['displayName'],'Untouched map')
            again=install(p)
            self.assertEqual(again['sample_item_ids'],ids)
            self.assertEqual(len(json.loads((p/'data'/'Items.json').read_text())),5)
            self.assertEqual(len(read_plugins(p/'js'/'plugins.js')),8)

    def test_guard_prevents_replacing_populated_map(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);self.make_fixture(p)
            x=json.loads((p/'data'/'Map001.json').read_text())
            x['events']=[None,{'id':1,'name':'Existing event'}]
            (p/'data'/'Map001.json').write_text(json.dumps(x))
            with self.assertRaisesRegex(ValueError,'FRESH'):
                install(p)
            self.assertFalse((p/'data'/'Map001.json.portfolio.bak').exists())

if __name__=='__main__':unittest.main()
