// Mide los rayos (`Mundo3D.primerImpacto`) y el A* (`Tactico3D.calcularRuta`) en JS y con el núcleo de Ara
// (src/motor/ara/espacio3d.ara). Uso: node herramientas/medir-espacio3d.mjs [repeticiones]
// Escena parecida al mapa CQB (20 × 26 m): N cajas al azar (muros, mesas, columnas) y 4 personajes.
// Rayos: orígenes y direcciones al azar a la altura de los ojos, ignorando a un personaje (como `lineaVision`).
// A*: rutas entre puntos al azar del mapa con los límites por defecto (-9, -12, 9, 12), celdas de 50 cm.
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { Mundo3D } from '../src/motor/mundo3d.js';
import { Tactico3D } from '../src/motor/tactico3d.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';

const REP = Number(process.argv[2]) || 3;
const nucleo = await nucleoAra();
function azar(semilla) { // mulberry32: las dos rutas ven la misma escena
  return () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function escena(cajas) {
  const r = azar(3), solidos = [];
  for (let i = 0; i < cajas; i++) {
    const n = { nombre: 'M' + i, tipo: 'Malla3D' }, x = r() * 18 - 9, z = r() * 24 - 12, largo = r() < 0.5;
    solidos.push({ n, b: new THREE.Box3(V(x, 0, z), V(x + (largo ? 0.2 + r() * 3 : 0.2 + r() * 0.6), 0.8 + r() * 2, z + (largo ? 0.2 + r() * 0.6 : 0.2 + r() * 3))) });
  }
  const pjs = Array.from({ length: 4 }, (_, i) => ({ tipo: 'Personaje3D', visible: true, props: { posicion: [i * 2 - 3, 0, 4 - i * 3], altura: 1.8 } }));
  return { solidos, pjs };
}

function espacio({ solidos, pjs }, conAra) {
  const d = Object.create(Mundo3D.prototype);
  d.m = { todos: () => pjs, nucleo: conAra ? nucleo : null, proyecto: { datos: {} } };
  d.solidos = solidos; d.posicionGlobal = n => n.props.posicion.slice();
  const t = Object.create(Tactico3D.prototype); t.d3 = d;
  return { d, t };
}

/** µs por llamada de `f(i)`, tras calentar. */
function medir(f, veces) {
  for (let i = 0; i < Math.min(veces, 2000); i++) f(i);
  const t = performance.now();
  for (let i = 0; i < veces; i++) f(i);
  return (performance.now() - t) * 1000 / veces;
}

const rayos = (e, conAra) => {
  const { d } = espacio(e, conAra), r = azar(5), casos = Array.from({ length: 4096 }, () => [V(r() * 18 - 9, 1.5, r() * 24 - 12), V(r() * 2 - 1, r() * 0.2 - 0.1, r() * 2 - 1)]);
  const ignorar = [e.pjs[0]];
  return medir(i => { const [o, dir] = casos[i & 4095]; d.primerImpacto(o, dir, 30, ignorar); }, 40000);
};
const astar = (e, conAra) => {
  const { t } = espacio(e, conAra), r = azar(9), casos = Array.from({ length: 64 }, () => [[r() * 18 - 9, 0, r() * 24 - 12], [r() * 18 - 9, 0, r() * 24 - 12]]);
  return medir(i => { const [a, b] = casos[i & 63]; t.calcularRuta({ props: { posicion: a } }, b); }, 400);
};

console.log(`Node ${process.version}, ${REP} ejecuciones (µs por llamada: JS / Ara)`);
for (const cajas of [20, 80, 300]) {
  const e = escena(cajas), fila = { rayo: [], astar: [] };
  for (let k = 0; k < REP; k++) {
    fila.rayo.push([rayos(e, false), rayos(e, true)]);
    fila.astar.push([astar(e, false), astar(e, true)]);
  }
  const txt = (v) => v.map(([a, b]) => `${a.toFixed(2)} / ${b.toFixed(2)} (${(a / b).toFixed(1)}×)`).join(' · ');
  console.log(`${cajas} cajas · rayo: ${txt(fila.rayo)}`);
  console.log(`${cajas} cajas · A*:   ${txt(fila.astar)}`);
}
