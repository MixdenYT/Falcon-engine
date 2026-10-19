"""Cuenta la geometría real del GLB, sin deducirla del presupuesto solicitado."""
import sys, json, struct, hashlib
from pathlib import Path
import numpy as np

p = Path(sys.argv[1]); b = p.read_bytes()
if b[:4] != b'glTF': raise ValueError('No es GLB')
offset = 12; j = None; binario = None
while offset < len(b):
    n, tipo = struct.unpack_from('<II', b, offset); datos = b[offset + 8:offset + 8 + n]; offset += 8 + n
    if tipo == 0x4e4f534a: j = json.loads(datos)
    if tipo == 0x004e4942: binario = datos
def accessor(i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    dtype = {5126:'<f4', 5125:'<u4', 5123:'<u2', 5121:'u1'}[a['componentType']]
    ancho = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT4':16}[a['type']]
    stride = v.get('byteStride', np.dtype(dtype).itemsize * ancho)
    return np.ndarray((a['count'], ancho), dtype=dtype, buffer=binario, offset=v.get('byteOffset', 0) + a.get('byteOffset', 0), strides=(stride, np.dtype(dtype).itemsize))
reporte = {'source':p.name, 'sha256':hashlib.sha256(b).hexdigest(), 'bytes':len(b), 'face_count':0, 'primitivas':[], 'texturas':len(j.get('images', []))}
for mi, m in enumerate(j['meshes']):
    for pi, pr in enumerate(m['primitives']):
        if pr.get('mode', 4) != 4: continue
        pos = accessor(pr['attributes']['POSITION']); ix = accessor(pr['indices']).reshape(-1) if 'indices' in pr else np.arange(len(pos))
        caras = ix.reshape(-1, 3); reporte['face_count'] += len(caras)
        _, inverso = np.unique(np.round(pos, 6), axis=0, return_inverse=True); padres = np.arange(max(inverso) + 1)
        def raiz(i):
            while padres[i] != i: padres[i] = padres[padres[i]]; i = padres[i]
            return i
        for a,c,d in inverso[caras]:
            r = raiz(a)
            for otro in (c,d):
                q = raiz(otro)
                if q != r: padres[q] = r
        grupos = {}
        for fi, cara in enumerate(caras): grupos.setdefault(int(raiz(inverso[cara[0]])), []).append(fi)
        componentes = []
        for k, faces in grupos.items():
            vertices = pos[np.unique(caras[faces])]
            componentes.append({'id':k,'caras':len(faces),'min':vertices.min(axis=0).round(6).tolist(),'max':vertices.max(axis=0).round(6).tolist()})
        componentes.sort(key=lambda x:-x['caras'])
        reporte['primitivas'].append({'mesh':mi,'primitiva':pi,'vertices':len(pos),'caras':len(caras),'componentes':componentes})
salida = p.with_suffix('.geometria.json'); salida.write_text(json.dumps(reporte, indent=2), encoding='utf8')
print(json.dumps({**reporte,'primitivas':[{**x,'componentes':x['componentes'][:16]} for x in reporte['primitivas']]}, indent=2))
