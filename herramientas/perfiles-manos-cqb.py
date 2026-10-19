"""Calcula ejes de palma a partir del rig recibido; no modifica el GLB fuente."""
from pathlib import Path
import json, struct, hashlib
import numpy as np

raiz = Path(__file__).resolve().parents[1] / 'recursos/cqb/modelos/personajes'
for tipo in ['operador','enemigo']:
    p=raiz/(tipo+'.glb'); b=p.read_bytes(); n=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+n]); raw=b[28+n:]
    def a(i):
        x=j['accessors'][i]; v=j['bufferViews'][x['bufferView']]; dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[x['componentType']]; w={'VEC3':3,'VEC2':2,'SCALAR':1,'VEC4':4,'MAT4':16}[x['type']]; stride=v.get('byteStride',np.dtype(dtype).itemsize*w)
        return np.ndarray((x['count'],w),dtype=dtype,buffer=raw,offset=v.get('byteOffset',0)+x.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize))
    pr=j['meshes'][0]['primitives'][0]; attrs=pr['attributes']; pos=a(attrs['POSITION']); ji=a(attrs['JOINTS_0']); we=a(attrs['WEIGHTS_0']); uv=a(attrs['TEXCOORD_0']); ix=a(pr['indices']).reshape(-1,3); keep=np.ones(len(ix),bool)
    if tipo=='operador':
        mask=set(json.loads((raiz/'operador-recorte.json').read_text())['uv_triangles'])
        keys=['|'.join(sorted(','.join(str(int(np.floor(float(x)*100000+.5))) for x in u) for u in uv[t])) for t in ix]; keep=np.array([k not in mask for k in keys])
    used=np.zeros(len(pos),bool); used[np.unique(ix[keep])]=True; invs=a(j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    resultado={'sha256_fuente':hashlib.sha256(b).hexdigest(),'perfiles':{}}
    nombres=[j['nodes'][i]['name'] for i in j['skins'][0]['joints']]
    for lado,prefijo in [('r','Right'),('l','Left')]:
        idx=nombres.index(prefijo+'Hand'); w=np.where(ji==idx,we,0).sum(1); pts=(np.c_[pos[used&(w>.6)],np.ones(sum(used&(w>.6)))]@invs[idx].T)[:,:3]
        vals,vecs=np.linalg.eigh(np.cov(pts.T)); f=vecs[:,2]
        if np.dot(f,pts.mean(0))<0: f=-f
        v=vecs[:,0]; mundo=np.linalg.inv(invs[idx])[:3,:3]@v
        if mundo[2]<0: v=-v
        u=np.cross(v,f); u=u/np.linalg.norm(u); v=np.cross(f,u)
        palma=f*6.5 + u*np.dot(pts.mean(0),u)*.3
        resultado['perfiles'][lado]={'hueso':prefijo+'Hand','f':f.tolist(),'u':u.tolist(),'v':v.tolist(),'palma':palma.tolist(),'inicio':7.5,'radio':3.3 if lado=='r' else 4.5,'angulo_max':2 if lado=='r' else 1.8,'curva':0 if tipo=='operador' and lado=='r' else 1}
    (raiz/(tipo+'-manos.json')).write_text(json.dumps(resultado,indent=2),encoding='utf8'); print(tipo,'perfiles de ambas manos guardados')
