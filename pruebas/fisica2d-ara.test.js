// La física 2D del núcleo de Ara (src/motor/ara/fisica2d.ara) da exactamente lo mismo que la de JS (mundo.js),
// paso a paso: posiciones, velocidades, contactos con sólidos y pares de contactos2d; y src/motor/ara/nucleo.wasm
// corresponde a los .ara.
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
/** Los pares que se tocan (contactos2d), en su orden. */
const pares = (m) => [...m.pares.values()].map(([a, b]) => a.nombre + '|' + b.nombre).join();

/** Un paso de física y contactos en los dos mundos; exige el mismo resultado y devuelve el de Ara. */
function pasoIgual(js, ara, i, dt, mandar) {
  for (const m of [js, ara]) {
    const nodos = m.todos();
    mandar(i, (nombre) => nodos.find((n) => n.nombre === nombre), m);
    const vivos = m.todos(); // `mandar` puede crear, quitar o mover nodos
    m.fisica2d(dt, vivos);
    m.contactos2d(vivos);
  }
  const a = estado(js), b = estado(ara);
  assert.equal(a.length, b.length);
  for (let k = 0; k < a.length; k++) for (const c in a[k]) {
    const iguales = Array.isArray(a[k][c]) ? a[k][c].join() === b[k][c].join() : Object.is(a[k][c], b[k][c]);
    assert.ok(iguales, `paso ${i}, ${a[k].n}.${c}: JS ${a[k][c]} y Ara ${b[k][c]}`);
  }
  assert.equal(pares(ara), pares(js), `paso ${i}: pares de contactos2d`);
  return b;
}

/** Corre la escena con JS y con Ara, `pasos` veces, y exige el mismo estado en cada paso. Devuelve los estados. */
async function comparar(escena, mandar, pasos = 240) {
  const js = mundo(escena(), null), ara = mundo(escena(), await nucleoAra());
  const vistos = [];
  for (let i = 0; i < pasos; i++) vistos.push(...pasoIgual(js, ara, i, i % 7 === 3 ? 1 / 30 : 1 / 60, mandar), { pares: pares(ara) });
  return vistos;
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

test('física 2D en Ara = JS: padres anidados con escala y rotación, áreas y Fondo', async () => {
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    nodo('Nodo2D', 'Mundo', { posicion: [20, 10], escala: [1.5, 1.25], rotacion: 12 }, [
      nodo('Nodo2D', 'Sub', { posicion: [-30, 40], escala: [0.5, 2], rotacion: -27.5 }, [
        pj('Jugador', { posicion: [100, 120] }),
        bloque('SueloSub', 160, 160, 600, 30),
      ]),
      bloque('SueloMundo', 300, 380, 900, 40),
      nodo('Area2D', 'Zona', { posicion: [200, 300], vigilar: 'personajes' }, [nodo('Colision', 'ColZona', { posicion: [5, -3], ancho: 120, alto: 80 })]),
    ]),
    nodo('Fondo', 'Fondo', { posicion: [500, 500], escala: [3, 3] }, [pj('EnFondo'), bloque('SueloFondo', 0, 60, 400, 20)]),
    nodo('Area2D', 'Global', { posicion: [250, 300] }),
  ]);
  const v = await comparar(escena, (i, $, m) => {
    const j = $('Jugador');
    // Un área que cuelga del jugador: no se toca con su antepasado, sí con los demás.
    if (i === 0) j.hijos.push(new NodoVivo(m, nodo('Area2D', 'Detector', {}, [nodo('Colision', 'ColDet', { ancho: 60, alto: 60 })]), j));
    j.mueveX = i % 100 < 50 ? 180 : -180;
    if (i % 45 === 10 && j.enSuelo) j.vy = -500;
    $('EnFondo').mueveX = 100;
  });
  assert.ok(v.some((e) => e.nodoSuelo === 'SueloSub'), 'pisa el suelo del padre girado');
  assert.ok(v.some((e) => /Zona|Global/.test(e.pares)), 'hay pares de áreas');
  assert.ok(!v.some((e) => /Jugador\|Detector|Detector\|Jugador/.test(e.pares)), 'un área no toca a su antepasado');
});

test('física 2D en Ara = JS: los scripts cambian padres, posiciones, escalas y celdas entre pasos', async () => {
  const celdas = {};
  for (let c = 0; c < 30; c++) celdas[`${c},12`] = 1;
  const escena = () => nodo('Nodo2D', 'Escena', {}, [
    nodo('Nodo2D', 'Grupo', {}, [pj('A', { posicion: [100, 200] }), bloque('Ascensor', 120, 300, 200, 20)]),
    pj('B', { posicion: [400, 100] }),
    nodo('Mosaicos', 'Mapa', { tam_celda: 32, solido: true, celdas }),
    nodo('Sprite', 'Moneda', { posicion: [300, 340], ancho: 20, alto: 20 }),
  ]);
  const v = await comparar(escena, (i, $, m) => {
    const a = $('A'), b = $('B'), g = $('Grupo'), ascensor = $('Ascensor');
    a.mueveX = i % 60 < 30 ? 150 : -150;
    b.mueveX = i % 80 < 40 ? -120 : 120;
    g.props.posicion[0] = Math.sin(i / 15) * 40; // el padre se mueve
    if (i === 20) g.props.escala = [1.25, 0.75];
    if (i === 30) $('Moneda').scripts = [{ tieneEvento: () => false }]; // ahora participa en contactos2d
    if (i === 40) a.props.posicion = [100, 200]; // vuelve a su posición inicial
    if (i === 50) ascensor.visible = false;
    if (i === 60) { ascensor.visible = true; ascensor.props.solo_arriba = true; }
    if (i === 70) { g.hijos.splice(g.hijos.indexOf(a), 1); a.padre = m.raiz; m.raiz.hijos.push(a); } // cambia de padre
    if (i === 80) m.raiz.hijos.unshift(new NodoVivo(m, pj('Nuevo', { posicion: [200, 50] }), m.raiz)); // desplaza los índices
    if (i === 90) $('Mapa').metodos().poner(8, 11);
    if (i === 95) $('Mapa').metodos().quitar(3, 12);
    if (i === 100) $('Mapa').props.celdas = { ...$('Mapa').props.celdas, '20,11': 1 };
    if (i === 110) { const n = $('Nuevo'); n.eliminado = true; m.raiz.hijos.splice(m.raiz.hijos.indexOf(n), 1); }
    if (i === 120) $('ColB').props.ancho = 40;
    if (i === 130) a.props.posicion = [NaN, 150]; // NaN sigue siendo NaN (y la caja se queda en x = 0)
    if (i === 131) a.props.posicion = [150, 150];
  }, 200);
  assert.ok(v.some((e) => e.n === 'Nuevo'), 'el nodo creado se mueve');
  assert.ok(v.some((e) => /Moneda/.test(e.pares)), 'la moneda con script entra en contactos2d');
});

test('física 2D en Ara = JS: dos mundos se turnan el núcleo', async () => {
  const escenaA = () => nodo('Nodo2D', 'Escena', {}, [pj('Jugador', { posicion: [100, 330] }), bloque('Suelo', 300, 400, 800, 40)]);
  const escenaB = () => nodo('Nodo2D', 'Escena', {}, [bloque('Suelo', 200, 300, 800, 40), pj('Jugador', { posicion: [150, 100] })]);
  const nucleo = await nucleoAra();
  const mundos = [[mundo(escenaA(), null), mundo(escenaA(), nucleo)], [mundo(escenaB(), null), mundo(escenaB(), nucleo)]];
  for (let i = 0; i < 120; i++) for (const [js, ara] of mundos) pasoIgual(js, ara, i, 1 / 60, (k, $) => { $('Jugador').mueveX = k % 50 < 25 ? 200 : -200; });
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
