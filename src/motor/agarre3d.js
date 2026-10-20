// Adaptación de las palmas del rig: pliega los dedos en la geometría de reposo
// y alinea el hueso de la muñeca con los agarres reales del arma. No sustituye
// la lógica de disparo ni las animaciones de locomoción del personaje.
import * as THREE from 'three';

export function prepararManos(raiz, datos) {
  let modificados = 0;
  raiz.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const g = m.geometry.clone(), p = g.attributes.position, n = g.attributes.normal, ji = g.attributes.skinIndex, we = g.attributes.skinWeight;
    if (!ji || !we) throw Error('El modelo no tiene pesos de rig para preparar las manos.');
    const usados = new Set(g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i));
    for (const perfil of Object.values(datos.perfiles)) {
      const idx = m.skeleton.bones.findIndex(b => b.name === perfil.hueso); if (idx < 0) throw Error('Falta el hueso '+perfil.hueso);
      if (!perfil.curva) continue;
      const hacia = m.skeleton.boneInverses[idx].clone().multiply(m.bindMatrix), desde = hacia.clone().invert();
      const f = new THREE.Vector3(...perfil.f), u = new THREE.Vector3(...perfil.u), v = new THREE.Vector3(...perfil.v);
      for (const i of usados) {
        let peso = 0; for (let k = 0; k < 4; k++) if (ji.getComponent(i, k) === idx) peso += we.getComponent(i, k);
        if (peso < 0.6) continue;
        const original = new THREE.Vector3().fromBufferAttribute(p, i), local = original.clone().applyMatrix4(hacia), t = local.dot(f);
        if (t <= perfil.inicio) continue;
        const angulo = Math.min(perfil.angulo_max, (t - perfil.inicio) / perfil.radio) * perfil.curva;
        const ancho = local.dot(u), fondo = local.dot(v), s = Math.sin(angulo), c = Math.cos(angulo);
        const nuevo = u.clone().multiplyScalar(ancho).addScaledVector(f, perfil.inicio + perfil.radio * s - fondo * s).addScaledVector(v, perfil.radio * (1 - c) + fondo * c).applyMatrix4(desde);
        const mezcla = Math.min(1, (peso - 0.6) / 0.25); nuevo.lerp(original, 1 - mezcla);
        if (![nuevo.x, nuevo.y, nuevo.z].every(Number.isFinite)) throw Error('Coordenadas de mano inválidas.');
        p.setXYZ(i, nuevo.x, nuevo.y, nuevo.z);
        if (n) {
          const viejo = new THREE.Vector3().fromBufferAttribute(n, i), normal = viejo.clone().transformDirection(hacia).applyAxisAngle(u, -angulo).transformDirection(desde).lerp(viejo, 1 - mezcla).normalize(); n.setXYZ(i, normal.x, normal.y, normal.z);
        }
        modificados++;
      }
    }
    p.needsUpdate = true; if (n) n.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); m.geometry = g;
  });
  return { vertices: modificados };
}

export function objetivoMano(animador, lado, arma, palma, pistola = false) {
  const perfil = animador.config.perfiles_manos?.perfiles?.[lado], mano = animador.huesos[lado]?.mano;
  if (!perfil || !mano) return { posicion: palma, rotacion: null };
  const origen = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...perfil.u), new THREE.Vector3(...perfil.v), new THREE.Vector3(...perfil.f)));
  const f = lado === 'l' && !pistola ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const u = new THREE.Vector3(0, 0, lado === 'r' ? 1 : -1), v = new THREE.Vector3().crossVectors(f, u);
  const destino = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, f));
  const rotacion = arma.getWorldQuaternion(new THREE.Quaternion()).multiply(destino).multiply(origen.invert());
  const escala = mano.getWorldScale(new THREE.Vector3()); escala.set(Math.abs(escala.x), Math.abs(escala.y), Math.abs(escala.z));
  const offset = new THREE.Vector3(...perfil.palma).multiply(escala).applyQuaternion(rotacion);
  return { posicion: palma.clone().sub(offset), rotacion };
}
