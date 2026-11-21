// La física 2D del núcleo de Ara (src/motor/ara/fisica2d.ara) da exactamente lo mismo que la de JS (mundo.js),
// paso a paso; y src/motor/ara/nucleo.wasm corresponde a los .ara.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './dom.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';
import { compilarNucleo } from '../herramientas/compilar-nucleo-ara.mjs';

const nodo = (tipo, nombre, props = {}, hijos = []) => ({ id: nombre, tipo, nombre, props: { posicion: [0, 0], ...props }, hijos });
const pj = (nombre, props = {}) => nodo('Personaje2D', nombre, { usa_gravedad: true, gravedad: 1200, velocidad: 220, ...props }, [nodo('Colision', 'Col' + nombre, { ancho: 24, alto: 40 })]);
const bloque = (nombre, x, y, ancho, alto, props = {}) => nodo('Plataforma', nombre, { posicion: [x, y], ancho, alto, solido: true, ...props });

function mundo(raiz, nucleo) {
  const m = new Mundo({ proyecto: { datos: { nombre: 'Prueba' } }, lienzo: {} });
  m.raiz = new NodoVivo(m, raiz, null);
  m.indiceSucio = true;
  m.nucleo = nucleo;
  return m;
}

/** Lo que la física deja en cada personaje, comparable con `===`. */
const estado = (m) => m.todos().filter((n) => n.tipo === 'Personaje2D').map((n) => ({
  n: n.nombre, x: n.props.posicion[0], y: n.props.posicion[1], vy: n.vy, empX: n.empX, empY: n.empY,
  suelo: n.enSuelo, pared: n.enPared, techo: n.enTecho, nodoSuelo: n._nodoSuelo?.nombre ?? null,
  contactos: [...n._contactosSolidos].map((s) => s.nombre),
}));

/** Corre la escena con JS y con Ara, `pasos` veces, y exige el mismo estado en cada paso. Devuelve los estados. */
async function comparar(escena, mandar, pasos = 240) {
  const js = mundo(escena(), null), ara = mundo(escena(), await nucleoAra());
  const vistos = [];
  for (let i = 0; i < pasos; i++) {
    const dt = i % 7 === 3 ? 1 / 30 : 1 / 60;
    for (const m of [js, ara]) {
      const nodos = m.todos();
      mandar(i, (nombre) => nodos.find((n) => n.nombre === nombre), m);
      m.fisica2d(dt, nodos);
    }
    const a = estado(js), b = estado(ara);
    for (let k = 0; k < a.length; k++) for (const c in a[k]) {
      const iguales = Array.isArray(a[k][c]) ? a[k][c].join() === b[k][c].join() : Object.is(a[k][c], b[k][c]);
      assert.ok(iguales, `paso ${i}, ${a[k].n}.${c}: JS ${a[k][c]} y Ara ${b[k][c]}`);
    }
    vistos.push(b);
  }
  return vistos.flat();
}

test('física 2D en Ara = JS: plataformas (andar, saltar, paredes, techo)', async () => {
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    pj('Jugador', { posicion: [100, 330] }),
    bloque('Suelo', 300, 400, 800, 40),
    bloque('Muro', 520, 300, 40, 200),
    bloque('Techo', 200, 250, 200, 20),
  ]);
  const v = await comparar(escena, (i, $) => {
    const j = $('Jugador');
    j.mueveX = i < 150 ? 220 : -220;
    if (i % 40 === 20 && j.enSuelo) j.vy = -600;
  });
  assert.ok(v.some((e) => e.suelo && e.nodoSuelo === 'Suelo'), 'llega al suelo');
  assert.ok(v.some((e) => e.pared), 'choca con el muro');
  assert.ok(v.some((e) => e.techo), 'choca con el techo');
});

test('física 2D en Ara = JS: vista superior con empuje y padre escalado', async () => {
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    nodo('Nodo2D', 'Grupo', { posicion: [30, -10], escala: [2, 1.5] }, [pj('Heroe', { posicion: [50, 80], usa_gravedad: false })]),
    bloque('Pared', 400, 200, 40, 400),
    bloque('Caja', 150, 330, 60, 60),
  ]);
  const v = await comparar(escena, (i, $) => {
    const h = $('Heroe');
    const l = Math.hypot(1, 0.6);
    h.mueveX = (i < 120 ? 1 : -1) / l * 220;
    h.mueveY = (i % 60 < 30 ? 0.6 : -0.6) / l * 220;
    if (i === 10) { h.empX = 500; h.empY = -300; }
    if (i === 90) h.empY = 800;
  });
  assert.ok(v.some((e) => e.pared), 'choca con la pared');
});

test('física 2D en Ara = JS: plataforma móvil arrastra al personaje', async () => {
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    pj('Jugador', { posicion: [200, 250] }),
    bloque('Ascensor', 200, 300, 160, 20),
  ]);
  const v = await comparar(escena, (i, $) => {
    const p = $('Ascensor').props.posicion;
    p[0] = 200 + Math.sin(i / 20) * 80;
    p[1] = 300 - Math.cos(i / 30) * 40;
  });
  assert.ok(v.some((e) => e.nodoSuelo === 'Ascensor'), 'va encima del ascensor');
});

test('física 2D en Ara = JS: solo_arriba se atraviesa desde abajo', async () => {
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    pj('Jugador', { posicion: [200, 360] }),
    bloque('Suelo', 200, 400, 600, 40),
    bloque('Repisa', 200, 280, 200, 16, { solo_arriba: true }),
  ]);
  const v = await comparar(escena, (i, $) => {
    const j = $('Jugador');
    if (i === 5 || i === 120) j.vy = -700;
    j.mueveX = i > 150 ? 220 : 0;
  });
  assert.ok(v.some((e) => e.nodoSuelo === 'Repisa'), 'acaba de pie en la repisa');
});

test('física 2D en Ara = JS: mosaicos (suelo, pared y claves raras)', async () => {
  const celdas = { '1.5,2': 0, '-0,9': 0, 'x,y': 0, '0,0': 0 };
  for (let c = -2; c < 20; c++) celdas[`${c},10`] = 1;
  for (let f = 5; f < 10; f++) celdas[`12,${f}`] = 1;
  celdas['4,6'] = 2;
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    nodo('Mosaicos', 'Mapa', { posicion: [-16, 8], tam_celda: 32, solido: true, celdas }),
    nodo('Mosaicos', 'Decorado', { tam_celda: 32, solido: false, celdas: { '5,9': 0 } }),
    pj('Jugador', { posicion: [60, 200] }),
    pj('Otro', { posicion: [300, 100], gravedad: 2000 }),
  ]);
  const v = await comparar(escena, (i, $) => {
    $('Jugador').mueveX = 220;
    $('Otro').mueveX = i % 80 < 40 ? -150 : 150;
    if (i % 50 === 25 && $('Otro').enSuelo) $('Otro').vy = -500;
  });
  assert.ok(v.some((e) => e.nodoSuelo === 'Mapa'), 'pisa el mosaico');
  assert.ok(v.some((e) => e.pared && e.contactos.includes('Mapa')), 'choca con la pared de mosaicos');
});

test('nucleo.wasm está al día con src/motor/ara/*.ara', async () => {
  const guardado = await readFile(new URL('../src/motor/ara/nucleo.wasm', import.meta.url));
  assert.ok(Buffer.from(await compilarNucleo()).equals(guardado), 'ejecuta node herramientas/compilar-nucleo-ara.mjs');
});

test('cargar una escena conserva el núcleo de Ara que precargó iniciar()', async () => {
  const nucleo = await nucleoAra();
  const m = mundo(nodo('Nodo2D', 'Vieja'), nucleo);
  m.proyecto.leerEscena = async () => ({ tipo: '2D', raiz: nodo('Nodo2D', 'Nueva', {}, [pj('Jugador')]) });
  m.ctx = {}; // no se dibuja: basta con que exista
  m.audio = { sonar() {}, pararNodo() {}, reproducirNodo() {}, pararTodo() {} };
  await m.cargarEscena('principal.fscn');
  assert.equal(m.nucleo, nucleo);
});
