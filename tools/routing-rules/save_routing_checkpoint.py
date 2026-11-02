#!/usr/bin/env python3
"""Save routing source fingerprints and test outputs now, including failed runs."""
import argparse,hashlib,json,os,subprocess,sys,zipfile
from pathlib import Path
from datetime import datetime,timezone

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--graph',type=Path,required=True);ap.add_argument('--snapshot',type=Path);ap.add_argument('--output',type=Path,default=Path('data/routing-checkpoints'));a=ap.parse_args()
    code=Path(__file__).resolve().parent
    if not (a.graph/'metadata.json').is_file():ap.error('Thiếu graph metadata.json')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');run=a.output/stamp;run.mkdir(parents=True,exist_ok=False)
    info={'created_at':datetime.now(timezone.utc).isoformat(),'purpose':'Synthetic/model baseline, not verification against real flooding','graph_metadata':json.loads((a.graph/'metadata.json').read_text(encoding='utf-8-sig')),'python':sys.version,'steps':[],'source_hashes':{}}
    files=[p for p in code.iterdir() if p.is_file() and p.suffix in {'.py','.json','.md','.geojson'}]
    files+=list((code/'graph-viewer').rglob('*')) if (code/'graph-viewer').exists() else []
    files=[p for p in files if p.is_file()]
    with zipfile.ZipFile(run/'routing-source.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(files):
            name=p.relative_to(code).as_posix();content=p.read_bytes();info['source_hashes'][name]=hashlib.sha256(content).hexdigest();z.writestr('tools/routing-rules/'+name,content)
    for name in ['metadata.json','policy-used.json']:
        p=a.graph/name
        if p.exists():(run/('graph-'+name)).write_bytes(p.read_bytes())
    if a.snapshot and (a.snapshot/'metadata.json').is_file():(run/'snapshot-metadata.json').write_bytes((a.snapshot/'metadata.json').read_bytes())
    commands=[('unit-tests',[sys.executable,'-m','unittest','discover','-s',str(code),'-p','test_*.py','-v']),('regression',[sys.executable,str(code/'routing_regression.py'),'--graph',str(a.graph.resolve()),'--cases',str(code/'routing-regression-cases.json'),'--output',str((run/'regression').resolve())]),('synthetic-flood',[sys.executable,str(code/'flood_overlay.py'),'--graph',str(a.graph.resolve()),'--flood',str(code/'flood-demo.synthetic.geojson'),'--profile','car','--start','105.813533,20.998173','--end','105.841535,21.005882','--diagnostic','--output',str((run/'synthetic-flood').resolve())])]
    for label,cmd in commands:
        print('Đang lưu:',label,flush=True)
        with (run/(label+'.log')).open('wb') as log:
            result=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=False,env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONUTF8':'1'})
        info['steps'].append({'name':label,'exit_code':result.returncode});print(label,'exit',result.returncode,flush=True)
    info['passed']=all(s['exit_code']==0 for s in info['steps']);(run/'checkpoint.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Đã lưu checkpoint:',run.resolve());print('PASS' if info['passed'] else 'CÓ BƯỚC LỖI — đã giữ log để kiểm tra');return 0 if info['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
