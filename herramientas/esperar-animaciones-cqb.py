"""Espera y descarga las tareas ya aceptadas. No crea tareas ni repite cargos."""
import sys, json, subprocess
from pathlib import Path

tipo, directorio = sys.argv[1:3]; repo = Path(__file__).resolve().parents[1]; carpeta = Path(directorio)
archivo = carpeta / 'animaciones-enviadas.json'; estado = json.loads(archivo.read_text())
def cli(args):
    r = subprocess.run(['npm','exec','--yes','--package=meshy-cli@0.4.0','--','meshy',*args,'--output-schema','v1','--format','json','--no-update-check'],cwd=repo,capture_output=True,text=True)
    try: respuesta = json.loads(r.stdout)
    except Exception: raise SystemExit('Salida no interpretable: '+args[0])
    if r.returncode or not respuesta.get('ok'):
        error = respuesta.get('error') or {}; print(json.dumps({'comando':args[0],'error':error.get('code'),'mensaje':error.get('message')}),flush=True); raise SystemExit(r.returncode or 1)
    return respuesta['result']
for nombre, t in estado.items():
    if t.get('state') != 'accepted': raise SystemExit('La operación requiere reconciliación: '+nombre)
    snapshot = carpeta / ('task_'+t['id']+'.json')
    if t.get('status') != 'SUCCEEDED' or not snapshot.exists():
        print(json.dumps({'tipo':tipo,'esperando':nombre,'id':t['id']}),flush=True)
        r = cli(['animate','wait',t['id'],'--timeout','600','--project',str(carpeta),'--stage','animation-'+nombre,'--workspace',str(repo)])
        if r['task']['status'] != 'SUCCEEDED': raise SystemExit('La animación no terminó: '+nombre)
        t['status'] = 'SUCCEEDED'; t['consumed_credits'] = r['task'].get('consumed_credits'); archivo.write_text(json.dumps(estado,indent=2),encoding='utf8')
    salida = carpeta / (nombre+'.glb')
    if not t.get('downloaded') or not salida.exists():
        assets = cli(['download','--task-json',str(snapshot),'--list'])['assets']
        candidatos = [a for a in assets if a['kind']=='animation' and a.get('format')=='glb']
        candidatos.sort(key=lambda a:0 if 'armature' in a['key'] else 1)
        if not candidatos: raise SystemExit('No hay GLB de animación: '+nombre)
        r = cli(['download','--task-json',str(snapshot),'--asset',candidatos[0]['key'],'--output',str(salida),'--project',str(carpeta),'--stage','download-'+nombre,'--workspace',str(repo)])
        t['downloaded'] = True; t['file'] = str(salida); t['sha256'] = r['downloads']['files'][0]['sha256']; archivo.write_text(json.dumps(estado,indent=2),encoding='utf8')
    print(json.dumps({'tipo':tipo,'completada':nombre,'id':t['id'],'creditos':t.get('consumed_credits'),'archivo':str(salida)}),flush=True)
