// Cada personaje clona su propio esqueleto; solo comparte geometría y texturas.
import * as THREE from 'three';
import { clone as clonarRig } from 'three/addons/utils/SkeletonUtils.js';

export { clonarRig };

export function normalizarRig(raiz, altura) {
  // SkinnedMesh necesita actualizar también bindMatrixInverse antes de medir.
  // updateWorldMatrix/Box3 por sí solos miden el GLB de Meshy a 1/100 de altura.
  raiz.updateMatrixWorld(true);
  raiz.traverse(o => { if (o.isSkinnedMesh) o.computeBoundingBox(); });
  const caja = new THREE.Box3().setFromObject(raiz), factor = altura / Math.max(0.01, caja.max.y - caja.min.y);
  raiz.scale.multiplyScalar(factor); raiz.position.y -= caja.min.y * factor;
  raiz.updateMatrixWorld(true);
  return raiz;
}

// Modificador de importación, compartido por cuerpo y brazos. Mantiene el GLB
// fuente y sus texturas; identifica caras por UV, incluso si el rig reordena vértices.
export function aplicarRecorteUV(raiz, recorte) {
  const claves = new Set(recorte.uv_triangles || []); let retiradas = 0;
  raiz.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes.uv) return;
    const g = o.geometry, uv = g.attributes.uv, src = g.index ? Array.from(g.index.array) : Array.from({ length: g.attributes.position.count }, (_, i) => i), conservar = [];
    const key = i => Math.round(uv.getX(i) * 100000) + ',' + Math.round(uv.getY(i) * 100000);
    for (let i = 0; i < src.length; i += 3) {
      const k = [key(src[i]), key(src[i + 1]), key(src[i + 2])].sort().join('|');
      if (claves.has(k)) retiradas++; else conservar.push(src[i], src[i + 1], src[i + 2]);
    }
    if (conservar.length !== src.length) { o.geometry = g.clone(); o.geometry.setIndex(conservar); o.geometry.clearGroups(); }
  });
  if (retiradas < (recorte.triangulos_ocultos || claves.size) * 0.98) throw Error(`El recorte del operador no coincide con este rig (${retiradas}/${recorte.triangulos_ocultos}).`);
  return { retiradas, esperadas: recorte.triangulos_ocultos };
}

export function sinDesplazamiento(clip) {
  const copia = clip.clone();
  for (const t of copia.tracks) if (/hips.*\.position$/i.test(t.name)) {
    const x = t.values[0], z = t.values[2];
    for (let i = 0; i < t.values.length; i += 3) { t.values[i] = x; t.values[i + 2] = z; }
  }
  return copia;
}

export class Animador3D {
  constructor(raiz, clips, config = {}) {
    this.raiz = raiz; this.config = config; this.mixer = new THREE.AnimationMixer(raiz);
    this.acciones = new Map(Object.entries(clips).map(([k, c]) => [k, this.mixer.clipAction(sinDesplazamiento(c))]));
    this.bones = [];
    this.modificados = new Map();
    raiz.traverse(o => { if (o.isBone) this.bones.push(o); });
    this.huesos = {};
    const nombre = (lado, parte) => {
      const opciones = this.bones.filter(b => new RegExp(lado === 'r' ? 'right|(^|_)r(_|$)' : 'left|(^|_)l(_|$)', 'i').test(b.name));
      return opciones.find(b => parte === 'mano' ? /hand(?!.*(thumb|index|middle|ring|pinky))|wrist/i.test(b.name) : parte === 'antebrazo' ? /forearm|lowerarm|lower_arm/i.test(b.name) : /upperarm|upper_arm|rightarm|leftarm|(^|[^a-z])arm/i.test(b.name) && !/forearm|lowerarm|lower_arm/i.test(b.name));
    };
    for (const lado of ['l', 'r']) this.huesos[lado] = { brazo: nombre(lado, 'brazo'), antebrazo: nombre(lado, 'antebrazo'), mano: nombre(lado, 'mano') };
  }
  reproducir(nombre, reiniciar = false) {
    const accion = this.acciones.get(nombre) || this.acciones.get('aim') || this.acciones.values().next().value;
    if (!accion || accion === this.actual && !reiniciar) return;
    const unaVez = ['fire', 'reload', 'hit', 'death'].includes(nombre);
    accion.reset().setLoop(unaVez ? THREE.LoopOnce : THREE.LoopRepeat, unaVez ? 1 : Infinity);
    accion.clampWhenFinished = unaVez;
    accion.enabled = true; accion.setEffectiveWeight(1).play();
    if (this.actual && this.actual !== accion) this.actual.crossFadeTo(accion, nombre === 'death' ? 0.08 : 0.12, false);
    this.actual = accion; this.nombre = nombre;
  }
  actualizar(n, tiempo, dt) {
    for (const [b, p] of this.modificados) { b.position.copy(p.posicion); b.quaternion.copy(p.rotacion); }
    this.modificados.clear();
    const e = n._tactico;
    const moviendo = Math.hypot(n.vx || 0, n.vz || 0) > 0.15;
    const nombre = e && tiempo < e.hasta && this.acciones.has(e.animacion) ? e.animacion : moviendo ? (n._correr ? 'run' : 'walk') : 'aim';
    this.reproducir(nombre, !!e && e.evento !== this.ultimoEvento && ['fire', 'reload', 'hit', 'death'].includes(nombre));
    this.ultimoEvento = e?.evento;
    if (this.actual) this.actual.setEffectiveTimeScale(['walk', 'run'].includes(nombre) ? Math.max(0.3, Math.min(1.6, Math.hypot(n.vx || 0, n.vz || 0) / (nombre === 'run' ? 3.6 : 1.6))) : ['fire', 'reload', 'hit'].includes(nombre) && e?.duracion ? this.actual.getClip().duration / e.duracion : 1);
    this.mixer.update(Math.min(0.05, Math.max(0, dt)));
    this.agachar(n);
  }
  recordar(...huesos) { for (const b of huesos) if (b && !this.modificados.has(b)) this.modificados.set(b, { posicion: b.position.clone(), rotacion: b.quaternion.clone() }); }
  agachar(n) {
    if (this.config.primeraPersona || n._muerto) return;
    const altura = n.props?.altura || 1.8, bajada = altura - (n._alturaColision || altura);
    if (bajada < 0.001) return;
    const hips = this.bones.find(b => b.name === 'Hips'); if (!hips) return;
    this.raiz.updateWorldMatrix(true, true);
    const piernas = ['Left', 'Right'].map(lado => {
      const brazo = this.bones.find(b => b.name === lado+'UpLeg'), antebrazo = this.bones.find(b => b.name === lado+'Leg'), mano = this.bones.find(b => b.name === lado+'Foot');
      return brazo && antebrazo && mano ? { brazo, antebrazo, mano, destino: mano.getWorldPosition(new THREE.Vector3()), rotacion: mano.getWorldQuaternion(new THREE.Quaternion()), lado } : null;
    }).filter(Boolean);
    this.recordar(hips); const p = hips.getWorldPosition(new THREE.Vector3()); p.y -= bajada; hips.position.copy(hips.parent.worldToLocal(p)); this.raiz.updateWorldMatrix(true, true);
    for (const pierna of piernas) this.resolver(pierna, pierna.destino, this.raiz.localToWorld(new THREE.Vector3(pierna.lado === 'Left' ? 0.18 : -0.18, 0.2, 0.55)), pierna.rotacion);
  }
  // IK analítica de dos huesos: conserva las longitudes y hace coincidir la palma
  // con el agarre real del arma. La animación sigue controlando el resto del rig.
  agarrar(lado, objetivo, codo, orientacion) {
    return this.resolver(this.huesos[lado], objetivo, codo, orientacion);
  }
  resolver(cadena, objetivo, codo, orientacion) {
    const { brazo, antebrazo, mano } = cadena;
    if (!brazo || !antebrazo || !mano) return false;
    this.recordar(brazo, antebrazo, mano);
    this.raiz.updateWorldMatrix(true, true);
    const a = brazo.getWorldPosition(new THREE.Vector3()), b = antebrazo.getWorldPosition(new THREE.Vector3()), c = mano.getWorldPosition(new THREE.Vector3());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), v = objetivo.clone().sub(a), d = Math.max(Math.abs(l1 - l2) + 0.0001, Math.min(l1 + l2 - 0.0001, v.length())); v.normalize();
    const normal = codo.clone().sub(a).addScaledVector(v, -codo.clone().sub(a).dot(v)).normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const puntoCodo = a.clone().addScaledVector(v, x).addScaledVector(normal, h);
    const rotar = (hueso, hijo, destino) => {
      hueso.updateWorldMatrix(true, true);
      const p = hueso.getWorldPosition(new THREE.Vector3()), desde = hijo.getWorldPosition(new THREE.Vector3()).sub(p).normalize(), hasta = destino.clone().sub(p).normalize();
      const mundo = hueso.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(desde, hasta));
      const padre = hueso.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      hueso.quaternion.copy(padre.multiply(mundo)); hueso.updateWorldMatrix(true, true);
    };
    rotar(brazo, antebrazo, puntoCodo); rotar(antebrazo, mano, objetivo);
    if (orientacion) mano.quaternion.copy(mano.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientacion));
    return true;
  }
  destruir() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.raiz); }
}

export function soloBrazos(raiz) {
  const copia = clonarRig(raiz);
  copia.traverse(o => {
    o.layers.set(0);
    if (!o.isSkinnedMesh) { if (o.isMesh) o.visible = false; return; }
    const indices = new Set();
    o.skeleton.bones.forEach((b, i) => { if (/arm|hand|wrist|finger|thumb|index|middle|ring|pinky/i.test(b.name)) indices.add(i); });
    const g = o.geometry.clone(), skin = g.getAttribute('skinIndex'), peso = g.getAttribute('skinWeight'), seleccion = [];
    const src = g.index ? Array.from(g.index.array) : Array.from({ length: g.getAttribute('position').count }, (_, i) => i);
    const brazo = i => {
      let suma = 0; for (let j = 0; j < 4; j++) if (indices.has(skin.getComponent(i, j))) suma += peso.getComponent(i, j);
      return suma > 0.7;
    };
    if (!skin || !peso || !indices.size) { o.visible = false; return; }
    for (let i = 0; i < src.length; i += 3) if ([src[i], src[i + 1], src[i + 2]].every(brazo)) seleccion.push(src[i], src[i + 1], src[i + 2]);
    g.clearGroups(); g.setIndex(seleccion); o.geometry = g; o.frustumCulled = false; o.castShadow = false;
  });
  return copia;
}
