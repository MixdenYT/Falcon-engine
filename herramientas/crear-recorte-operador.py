"""Describe el recorte de importación, sin modificar el modelo fuente de Meshy."""
import sys, json, struct, math
from pathlib import Path
import numpy as np

p, salida = map(Path, sys.argv[1:3]); b = p.read_bytes(); n = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20+n]); raw = b[28+n:]
def a(i):
    x = j['accessors'][i]; v = j['bufferViews'][x['bufferView']]; dtype = {5126:'<f4',5125:'<u4',5123:'<u2'}[x['componentType']]; w = {'VEC3':3,'VEC2':2,'SCALAR':1}[x['type']]
    return np.frombuffer(raw, dtype=dtype, count=x['count']*w, offset=v.get('byteOffset',0)+x.get('byteOffset',0)).reshape(-1,w)
m=j['meshes'][0]['primitives'][0]; pos=a(m['attributes']['POSITION']); uv=a(m['attributes']['TEXCOORD_0']); ix=a(m['indices']).reshape(-1,3); c=pos[ix].mean(axis=1)
seleccion=(c[:,0]>-.09)&(c[:,0]<.07)&(c[:,1]>.065)&(c[:,1]<.495)&(c[:,2]>.145)
keys=['|'.join(sorted(','.join(str(math.floor(float(x)*100000+.5)) for x in u) for u in uv[ix[i]])) for i in np.flatnonzero(seleccion)]
salida.parent.mkdir(parents=True,exist_ok=True)
salida.write_text(json.dumps({'origen':'Recorte de una pieza de arma incorporada al operador; el GLB de Meshy se conserva.', 'triangulos_originales':len(ix), 'triangulos_ocultos':len(keys), 'uv_triangles':keys},indent=2),encoding='utf8')
print(json.dumps({'triangulos_originales':len(ix),'triangulos_ocultos':len(keys)}))
