"""Descarga solo los esqueletos de caminar/correr incluidos con cada rig."""
import sys,json,subprocess
from pathlib import Path
tipo,rig,dirproyecto=sys.argv[1:4]; carpeta=Path(dirproyecto); repo=Path(__file__).resolve().parents[1]
for nombre,api in [('walk','walking'),('run','running')]:
    salida=carpeta/(nombre+'.glb')
    if salida.exists(): print(tipo,nombre,'ya existe'); continue
    cmd=['npm','exec','--yes','--package=meshy-cli@0.4.0','--','meshy','download','--task-json',str(carpeta/('task_'+rig+'.json')),'--asset','result.basic_animations.'+api+'_armature_glb_url','--output',str(salida),'--project',str(carpeta),'--stage','locomocion-'+nombre,'--workspace',str(repo),'--output-schema','v1','--format','json','--no-update-check']
    r=subprocess.run(cmd,cwd=repo,capture_output=True,text=True)
    respuesta=json.loads(r.stdout)
    if r.returncode or not respuesta.get('ok'): print(respuesta.get('error')); raise SystemExit(r.returncode or 1)
    print(json.dumps({'tipo':tipo,'clip':nombre,'archivo':str(salida),'bytes':respuesta['result']['downloads']['files'][0]['bytes']}),flush=True)
