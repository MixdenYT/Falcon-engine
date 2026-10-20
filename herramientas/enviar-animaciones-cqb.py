"""Envía una vez las cinco animaciones presupuestadas; conserva ID y operación.
No reintenta fallos ni envíos de resultado desconocido. Usa exclusivamente Meshy CLI.
"""
import sys, json, uuid, subprocess
from pathlib import Path

tipo, rig, carpeta = sys.argv[1:4]
repo = Path(__file__).resolve().parents[1]; carpeta = Path(carpeta)
archivo = carpeta / 'animaciones-enviadas.json'
estado = json.loads(archivo.read_text()) if archivo.exists() else {}
for nombre, accion in [('aim',585),('fire',234),('reload',170),('hit',178),('death',188)]:
    anterior = estado.get(nombre)
    if anterior and anterior.get('state') == 'accepted':
        print(json.dumps({'tipo':tipo,'animacion':nombre,'id':anterior['id'],'reutilizada':True}),flush=True); continue
    if anterior:
        raise SystemExit('La operación anterior requiere reconciliación; no se repite el envío: '+nombre)
    operacion = str(uuid.uuid5(uuid.NAMESPACE_URL,'Falcon-engine/CQB/2026-10-19/'+rig+'/'+nombre))
    estado[nombre] = {'resource':'animate','action_id':accion,'operation_id':operacion,'state':'pending'}
    archivo.write_text(json.dumps(estado,indent=2),encoding='utf8')
    cmd = ['npm','exec','--yes','--package=meshy-cli@0.4.0','--','meshy','animate','create','--rig-task-id',rig,'--action-id',str(accion),'--async','--operation-id',operacion,'--project',str(carpeta),'--stage','animation-'+nombre,'--workspace',str(repo),'--output-schema','v1','--format','json','--no-update-check']
    r = subprocess.run(cmd,cwd=repo,capture_output=True,text=True)
    try: respuesta = json.loads(r.stdout)
    except Exception: raise SystemExit('Respuesta no interpretable; conservar operación '+operacion)
    envio = (respuesta.get('result') or {}).get('submission') or {}
    if r.returncode or not respuesta.get('ok') or envio.get('state') != 'accepted' or not envio.get('task_id'):
        estado[nombre]['state'] = 'requires_reconciliation'; estado[nombre]['error'] = respuesta.get('error')
        archivo.write_text(json.dumps(estado,indent=2),encoding='utf8')
        print(json.dumps({'tipo':tipo,'animacion':nombre,'error':respuesta.get('error'),'operation_id':operacion}),flush=True)
        raise SystemExit(r.returncode or 10)
    estado[nombre].update({'state':'accepted','id':envio['task_id']}); archivo.write_text(json.dumps(estado,indent=2),encoding='utf8')
    print(json.dumps({'tipo':tipo,'animacion':nombre,'id':envio['task_id'],'operation_id':operacion}),flush=True)
