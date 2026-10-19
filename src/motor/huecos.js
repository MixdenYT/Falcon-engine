// Huecos: una Malla3D en modo «hueco» resta su forma a las mallas sólidas que toca (puertas,
// ventanas, pasos). La geometría se recorta con CSG (three-bvh-csg) y la colisión se parte en cajas.
import * as THREE from 'three';

// Formas cerradas que se pueden recortar (el plano y el terreno no tienen interior).
export const RECORTABLES = ['cubo', 'esfera', 'cilindro', 'capsula', 'cono'];
const EPS = 1e-4;

// La librería pesa ~450 KB: solo se carga si la escena tiene huecos.
let csg = null, cargando = null;
export function cargarCSG() {
  if (!cargando) cargando = import('../../node_modules/three-bvh-csg/build/index.module.js').then((m) => {
    const ev = new m.Evaluator();
    ev.useGroups = false;
    ev.attributes = ['position', 'uv', 'normal'];
    csg = { m, ev };
    return csg;
  });
  return cargando;
}
export const csgListo = () => !!csg;

// Una copia preparada (con su BVH) por forma básica, reutilizada en cada recorte.
const preparadas = new WeakMap();
function geometriaPreparada(geo) {
  let g = preparadas.get(geo);
  if (!g) {
    g = geo.clone();
    g.userData = {};
    for (const k of Object.keys(g.attributes)) if (!['position', 'uv', 'normal'].includes(k)) g.deleteAttribute(k);
    preparadas.set(geo, g);
  }
  return g;
}

const _inv = new THREE.Matrix4();
/**
 * Resta los huecos a una geometría, en el espacio local de la malla sólida.
 * base: geometría de la forma; matrizSolido: matrixWorld de la malla sólida;
 * huecos: [{ geo, matriz }] con la geometría y la matrixWorld de cada hueco.
 */
export function recortar(base, matrizSolido, huecos) {
  const { m, ev } = csg;
  _inv.copy(matrizSolido).invert();
  let a = new m.Brush(geometriaPreparada(base));
  a.updateMatrixWorld();
  for (const h of huecos) {
    const b = new m.Brush(geometriaPreparada(h.geo));
    b.matrixAutoUpdate = false;
    b.matrix.multiplyMatrices(_inv, h.matriz);
    b.updateMatrixWorld(true);
    a = ev.evaluate(a, b, m.SUBTRACTION);
  }
  const r = a.geometry;
  for (const k of Object.keys(r.attributes)) if (!['position', 'uv', 'normal'].includes(k)) r.deleteAttribute(k);
  r.computeBoundingBox();
  r.computeBoundingSphere();
  return r;
}

export function solapan(a, b, eps = EPS) {
  return a.min.x < b.max.x - eps && a.max.x > b.min.x + eps
    && a.min.y < b.max.y - eps && a.max.y > b.min.y + eps
    && a.min.z < b.max.z - eps && a.max.z > b.min.z + eps;
}

/** Caja menos huecos (cajas alineadas a los ejes) → trozos de caja que quedan, para la colisión. */
export function restarCajas(caja, huecos) {
  let trozos = [caja];
  for (const h of huecos) {
    const sig = [];
    for (const t of trozos) {
      if (!solapan(t, h)) { sig.push(t); continue; }
      const i = t.clone().intersect(h);
      const r = t.clone();
      const anadir = (x0, y0, z0, x1, y1, z1) => { if (x1 - x0 > EPS && y1 - y0 > EPS && z1 - z0 > EPS) sig.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))); };
      // Se rebana alrededor de la intersección: primero en X, luego en Y y por último en Z.
      anadir(r.min.x, r.min.y, r.min.z, i.min.x, r.max.y, r.max.z);
      anadir(i.max.x, r.min.y, r.min.z, r.max.x, r.max.y, r.max.z);
      r.min.x = i.min.x; r.max.x = i.max.x;
      anadir(r.min.x, r.min.y, r.min.z, r.max.x, i.min.y, r.max.z);
      anadir(r.min.x, i.max.y, r.min.z, r.max.x, r.max.y, r.max.z);
      r.min.y = i.min.y; r.max.y = i.max.y;
      anadir(r.min.x, r.min.y, r.min.z, r.max.x, r.max.y, i.min.z);
      anadir(r.min.x, r.min.y, i.max.z, r.max.x, r.max.y, r.max.z);
    }
    trozos = sig;
  }
  return trozos;
}
