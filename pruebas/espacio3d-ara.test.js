// Rayos y A* de la parte 3D en el núcleo de Ara (src/motor/ara/espacio3d.ara) dan exactamente lo mismo que la ruta
// en JS (three.js): mismo nodo, punto y distancia bit a bit en cada rayo, y la misma ruta celda a celda.
// No hay trigonometría en estas cuentas (solo + - * / y raíz, IEEE-754 en los dos lados): se exige igualdad exacta.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Mundo3D } from '../src/motor/mundo3d.js';
import { Tactico3D } from '../src/motor/tactico3d.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';

const nucleo = await nucleoAra();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const caja = (n, x0, y0, z0, x1, y1, z1) => ({ n, b: new THREE.Box3(V(x0, y0, z0), V(x1, y1, z1)) });
function azar(semilla) { // mulberry32
  return () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Un Mundo3D mínimo (sin escena): personajes en `todos`, sólidos dados; con o sin núcleo. */
function espacio(solidos, personajes = [], conAra) {
  const d = Object.create(Mundo3D.prototype);
  d.m = { todos: () => personajes, nucleo: conAra ? nucleo : null, proyecto: { datos: {} } };
  d.solidos = solidos; d.posicionGlobal = n => n.props.posicion.slice();
  return d;
}
const igual = (a, b, msg) => {
  if (!a || !b) return assert.equal(a, b, msg);
  assert.equal(a.nodo, b.nodo, msg);
  for (const k of ['x', 'y', 'z']) assert.ok(Object.is(a.punto[k], b.punto[k]), `${msg}: punto.${k} JS ${a.punto[k]} y Ara ${b.punto[k]}`);
  assert.ok(Object.is(a.distancia, b.distancia), `${msg}: distancia JS ${a.distancia} y Ara ${b.distancia}`);
};

test('rayos en Ara = JS: escena al azar, direcciones con ceros (también -0), orígenes dentro y en las caras, ignorados', () => {
  const r = azar(7), nodos = Array.from({ length: 12 }, (_, i) => ({ nombre: 'M' + i, tipo: 'Malla3D' }));
  const solidos = [];
  for (let i = 0; i < 60; i++) {
    const x = Math.round(r() * 40 - 20) / 2, z = Math.round(r() * 40 - 20) / 2, y = r() < 0.3 ? 0 : Math.round(r() * 4) / 2;
    solidos.push(caja(nodos[i % 12], x, y, z, x + 0.25 + r() * 3, y + 0.5 + r() * 2, z + 0.25 + r() * 3));
  }
  solidos.push(caja(nodos[3], 1, 0, 1, 2, 2, 2), caja(nodos[4], 1, 0, 1, 2, 2, 2)); // la misma caja, dos dueños: empate
  const pj = { tipo: 'Personaje3D', props: { posicion: [0.3, 0, 0.2], altura: 1.8 }, visible: true };
  const js = espacio(solidos, [pj], false), ara = espacio(solidos, [pj], true);
  const ejes = [0, -0, 1, -1, 0.5];
  let impactos = 0;
  for (let i = 0; i < 3000; i++) {
    const o = i % 5 === 0 ? V(1, 1, 1.5) : i % 7 === 0 ? V(Math.round(r() * 20 - 10) / 2, 1, Math.round(r() * 20 - 10) / 2) : V(r() * 30 - 15, r() * 3, r() * 30 - 15);
    const d = i % 3 === 0 ? V(ejes[i % 5], ejes[(i >> 2) % 5], ejes[(i >> 4) % 5]) : V(r() * 2 - 1, r() * 0.6 - 0.3, r() * 2 - 1);
    const alcance = [100, 5, 0, 1e9, 'x', 2.5][i % 6];
    const ignorados = [[], [nodos[i % 12]], [nodos[3], pj], [nodos[1], nodos[2], nodos[3]]][i % 4];
    const a = js.primerImpacto(o, d, alcance, ignorados), b = ara.primerImpacto(o, d, alcance, ignorados);
    igual(a, b, `rayo ${i}`);
    if (a) impactos++;
  }
  assert.ok(impactos > 1000, `hay impactos de sobra (${impactos})`);
  assert.equal(nucleo.espacio3d.dueno, ara, 'el núcleo se usó');
  assert.equal(ara.m.nucleo, nucleo, 'sin errores del núcleo');
});

test('Ara resuelve las colisiones de cámara: margen 0,18, pivote dentro y distancia máxima', () => {
  const r = azar(23), M = { nombre: 'Obstáculo' };
  const solidos = Array.from({ length: 36 }, () => {
    const x = r() * 18 - 9, y = r() * 3, z = r() * 18 - 9;
    return caja(M, x, y, z, x + 0.3 + r() * 2, y + 0.3 + r() * 2, z + 0.3 + r() * 2);
  });
  const d = espacio(solidos, [], true), punto = new THREE.Vector3();
  for (let i = 0; i < 600; i++) {
    const origen = i % 9 === 0
      ? solidos[i % solidos.length].b.getCenter(new THREE.Vector3())
      : V(r() * 24 - 12, r() * 5, r() * 24 - 12);
    const direccion = V(r() * 2 - 1, r() * 1.2 - 0.6, r() * 2 - 1).normalize();
    const alcance = [0.3, 1, 2.5, 5, 30][i % 5];
    const ray = new THREE.Ray(origen, direccion);
    let esperado = null, cerca = alcance;
    for (const s of solidos) {
      const b = s.b.clone().expandByScalar(0.18);
      if (b.containsPoint(origen)) continue;
      const hit = ray.intersectBox(b, punto);
      if (!hit) continue;
      const distancia = origen.distanceTo(hit);
      if (distancia <= cerca) { cerca = distancia; esperado = distancia; }
    }
    const real = d.distanciaCamaraAra(origen, direccion, alcance);
    if (esperado === null) assert.equal(real, null, `sin obstáculo ${i}`);
    else assert.ok(Math.abs(real - esperado) < 1e-10, `rayo ${i}: ${real} != ${esperado}`);
  }
  assert.equal(d.m.nucleo, nucleo, 'el núcleo Ara sigue operativo');
});

test('rayos en Ara = JS: nodo eliminado u oculto tras la física, y la lista de sólidos cambia', () => {
  const a = { nombre: 'A' }, b = { nombre: 'B' }, solidos = [caja(a, -1, 0, -3, 1, 2, -2), caja(b, -1, 0, -6, 1, 2, -5)];
  const js = espacio(solidos, [], false), ara = espacio(solidos, [], true), o = V(0, 1, 0), d = V(0, 0, -1);
  igual(ara.primerImpacto(o, d, 50), js.primerImpacto(o, d, 50), 'A delante');
  a.visible = false;
  igual(ara.primerImpacto(o, d, 50), js.primerImpacto(o, d, 50), 'A oculto: B');
  assert.equal(ara.primerImpacto(o, d, 50).nodo, b);
  a.visible = true; a.eliminado = true;
  igual(ara.primerImpacto(o, d, 50), js.primerImpacto(o, d, 50), 'A eliminado: B');
  ara.solidos = js.solidos = [caja(b, -1, 0, -9, 1, 2, -8)];
  igual(ara.primerImpacto(o, d, 50), js.primerImpacto(o, d, 50), 'lista nueva');
  assert.equal(ara.primerImpacto(o, d, 50).distancia, 8);
});

/** calcularRuta en JS y en Ara para el personaje en `desde` hacia `hasta`; exige la misma ruta y la devuelve. */
function rutas(solidos, desde, hasta, extra = {}) {
  const res = [false, true].map(conAra => {
    const d = espacio(solidos, [], conAra); d.m.proyecto.datos.navegacion = extra.navegacion;
    const t = Object.create(Tactico3D.prototype); t.d3 = d;
    const ruta = t.calcularRuta({ props: { posicion: desde }, _alturaColision: extra.altura }, hasta);
    if (conAra) assert.equal(d.m.nucleo, nucleo, 'sin errores del núcleo');
    return ruta;
  });
  assert.deepEqual(res[1], res[0], `ruta ${desde} → ${hasta}`);
  return res[1];
}

test('A* en Ara = JS: obstáculos, esquinas, radio, sin camino, meta dentro de un obstáculo, altura', () => {
  const M = { nombre: 'Muro' };
  const muro = caja(M, -0.5, 0, -2, 0.5, 3, 2);
  const r1 = rutas([muro], [-3, 0, 0], [3, 0, 0]);
  assert.ok(r1.length > 12 && r1.some(p => Math.abs(p[2]) >= 2.5), 'rodea el muro');
  assert.ok(r1.every(p => !muro.b.clone().expandByScalar(0.39).containsPoint(V(p[0], 1, p[2]))), 'respeta el radio');
  // Una L y un pasillo de una celda.
  const L = [caja(M, -4, 0, -4, 4, 2, -3.5), caja(M, 3.5, 0, -4, 4, 2, 4), caja(M, -4, 0, 1, 2.6, 2, 1.4), caja(M, 3.4, 0, 1, 4, 2, 1.4)];
  rutas(L, [0, 0, -2], [0, 0, 3]);
  rutas(L, [-8, 0, 11], [8.5, 0, -11.5]);
  // Sin camino: la meta encerrada. Meta dentro de un obstáculo. Salida dentro de un obstáculo.
  const jaula = [caja(M, 4, 0, 4, 7, 2, 4.2), caja(M, 4, 0, 7, 7, 2, 7.2), caja(M, 4, 0, 4, 4.2, 2, 7.2), caja(M, 6.8, 0, 4, 7, 2, 7.2)];
  assert.deepEqual(rutas(jaula, [-5, 0, -5], [5.5, 0, 5.5]), []);
  assert.deepEqual(rutas([muro], [-3, 0, 0], [0, 0, 0]), []);
  assert.deepEqual(rutas([muro], [0, 0, 0], [3, 0, 1]), [], 'desde dentro del muro no sale (los vecinos también chocan)');
  assert.ok(rutas([muro], [0, 0, 1.9], [3, 0, 1]).length > 0, 'desde el borde sí');
  // Cajas fuera de la franja de altura (un dintel alto o una alfombra) no bloquean; con altura baja el dintel tampoco.
  const dintel = caja(M, -9, 2.1, -1, 9, 3, 1), alfombra = caja(M, -9, 0, -1, 9, 0.3, 1);
  assert.equal(rutas([dintel, alfombra], [0, 0, -5], [0, 0, 5]).length, 20);
  rutas([caja(M, -9, 1.5, -1, 9, 3, 1)], [0, 0, -5], [0, 0, 5]);
  rutas([caja(M, -9, 1.5, -1, 9, 3, 1)], [0, 0, -5], [0, 0, 5], { altura: 1.2 });
  // Misma celda, fuera de los límites (se recorta) y otros límites.
  assert.deepEqual(rutas([], [1, 0, 1], [1.1, 0, 0.9]), []);
  rutas([muro], [-30, 0, 0], [30, 0, 40]);
  rutas([muro], [-3, 0, 0], [3, 0, 0], { navegacion: [-5, -5, 5, 5] });
  // Hay camino (por x < -38), pero el A* se rinde tras 4000 celdas en los dos lados; con el hueco cerca, llega.
  const grande = { navegacion: [-40, -40, 40, 40] };
  assert.deepEqual(rutas([caja(M, -38, 0, -1, 40, 3, 1)], [30, 0, -10], [30, 0, 10], grande), []);
  assert.ok(rutas([caja(M, 10, 0, -1, 40, 3, 1)], [30, 0, -10], [30, 0, 10], grande).length > 40);
});

test('A* en Ara = JS: 40 mapas al azar (incluye el límite de 4000 visitas)', () => {
  const r = azar(11), M = { nombre: 'M' };
  let largas = 0;
  for (let mapa = 0; mapa < 40; mapa++) {
    const solidos = Array.from({ length: 5 + mapa }, () => {
      const x = Math.round(r() * 36 - 18) / 2, z = Math.round(r() * 48 - 24) / 2;
      return caja(M, x, r() < 0.1 ? 2 : 0, z, x + 0.2 + r() * (r() < 0.5 ? 4 : 0.6), 2.5, z + 0.2 + r() * (r() < 0.5 ? 0.6 : 4));
    });
    const p = () => [r() * 18 - 9, 0, r() * 24 - 12];
    for (let i = 0; i < 5; i++) largas += rutas(solidos, p(), p(), mapa % 10 === 9 ? { navegacion: [-40, -40, 40, 40] } : {}).length > 10;
  }
  assert.ok(largas > 100, `rutas largas: ${largas} de 200`);
});
