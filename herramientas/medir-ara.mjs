// Mide cuánto tardan los scripts de juegos de verdad por fotograma, en Águila y en Ara (solo los scripts: la física
// y el dibujo no se ejecutan en Node). Uso: node herramientas/medir-ara.mjs [fotogramas]
//  1. El shooter de la plantilla: scripts que sobre todo llaman al motor (buscar nodos, mover, mirar, disparar).
//     Águila: los scripts de Falcon 1.2 (pruebas/aguila/); Ara: los de la plantilla.
//  2. Una bandada: lógica de juego propia (listas y bucles, cada pájaro mira a los demás). Águila:
//     pruebas/aguila/bandada.agl; Ara: ese mismo script pasado por el conversor (src/ara/convertir.js).
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import '../pruebas/dom.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { plantillaShooter } from '../src/motor/shooters.js';
import { convertirAguila } from '../src/ara/convertir.js';

const FOTOGRAMAS = Number(process.argv[2]) || 600;
const leer = (n) => readFile(new URL(`../pruebas/aguila/${n}.agl`, import.meta.url), 'utf8');
const AGUILA = { 'scripts/jugador.agl': await leer('jugador_shooter'), 'scripts/enemigo.agl': await leer('enemigo_shooter') };

async function mundo(lenguaje, drones) {
  const s = plantillaShooter('Medida');
  const escena = structuredClone(s.archivos['escenas/base_abierta.fscn']);
  const ext = lenguaje === 'Águila' ? '.agl' : '.ara';
  const cambiar = (n) => { if (n.script) n.script = n.script.replace(/\.ara$/, ext); for (const h of n.hijos || []) cambiar(h); };
  cambiar(escena.raiz);
  // Más drones: copias de los que hay, repartidas por el mapa.
  const buscar = (n, f) => f(n) ? n : (n.hijos || []).map((h) => buscar(h, f)).find(Boolean);
  const enemigos = buscar(escena.raiz, (n) => n.nombre === 'Enemigos');
  const modelo = enemigos.hijos[0];
  for (let i = enemigos.hijos.length; i < drones; i++) {
    const d = structuredClone(modelo); d.nombre = 'Drone' + (i + 1); d.id = 'dron' + i;
    d.props.posicion = [(i % 20) * 3 - 30, 0, Math.floor(i / 20) * 3 - 30];
    enemigos.hijos.push(d);
  }
  const m = new Mundo({ proyecto: { datos: s.datos }, lienzo: {} });
  m.raiz = new NodoVivo(m, escena.raiz, null); m.indiceSucio = true;
  m.textos = new Map(Object.entries(lenguaje === 'Águila' ? AGUILA : Object.fromEntries(Object.entries(s.archivos).filter(([p]) => p.endsWith('.ara')))));
  m.audio = { sonar() {}, pararNodo() {} };
  // Ve al jugador a ratos (la mitad de los drones), para que la IA haga de todo: perseguir, atacar y patrullar.
  m.d3 = { posicionGlobal: (n) => n.props.posicion, lineaVision: (a) => a.id % 2 === 0, quitar() {}, fijarPosicionGlobal(n, ...p) { n.props.posicion = p; } };
  const t0 = performance.now();
  await m.compilarAra();
  m.iniciarScripts(m.raiz);
  const inicio = performance.now() - t0;
  const j = m.buscarPorNombre('Jugador');
  m.emitirNodo(j, 'se_pulsa', ['accion']);
  j.aguilaAsignar('vida', 1e9); // nadie gana ni pierde durante la medida
  const nodos = m.todos();
  const fotograma = () => { for (const n of nodos) m.emitirNodo(n, 'se_actualiza', [1 / 60]); };
  for (let i = 0; i < 60; i++) fotograma(); // calentamiento (JIT de JavaScript)
  const t = performance.now();
  for (let i = 0; i < FOTOGRAMAS; i++) fotograma();
  const ms = (performance.now() - t) / FOTOGRAMAS;
  if (m.errores.length) throw new Error(`${lenguaje}: ${m.errores[0].mensaje}`);
  return { ms, inicio };
}

async function bandada(lenguaje, pajaros) {
  const agl = await leer('bandada');
  const rel = lenguaje === 'Águila' ? 'scripts/bandada.agl' : 'scripts/bandada.ara';
  const texto = lenguaje === 'Águila' ? agl : convertirAguila(agl, { archivo: 'scripts/bandada.agl', base: 'Nodo2D' }).codigo;
  const m = new Mundo({ proyecto: { datos: { nombre: 'Bandada' } }, lienzo: {} });
  m.raiz = new NodoVivo(m, { id: 'r', tipo: 'Nodo2D', nombre: 'Cielo', props: { posicion: [0, 0] }, hijos: [{ id: 'b', tipo: 'Nodo2D', nombre: 'Bandada', props: { posicion: [0, 0] }, hijos: [], script: rel, exportados: { cantidad: pajaros } }] }, null);
  m.textos = new Map([[rel, texto]]);
  m.audio = { sonar() {}, pararNodo() {} };
  await m.compilarAra(); m.iniciarScripts(m.raiz);
  const b = m.buscarPorNombre('Bandada');
  const fotogramas = Math.max(5, Math.round(FOTOGRAMAS / 20));
  for (let i = 0; i < 3; i++) m.emitirNodo(b, 'se_actualiza', [1 / 60]);
  const t = performance.now();
  for (let i = 0; i < fotogramas; i++) m.emitirNodo(b, 'se_actualiza', [1 / 60]);
  if (m.errores.length) throw new Error(`${lenguaje}: ${m.errores[0].mensaje}`);
  return (performance.now() - t) / fotogramas;
}

console.log(`Scripts del shooter, ${FOTOGRAMAS} fotogramas (Node ${process.version})`);
console.log('| Drones | Águila (ms/fotograma) | Ara (ms/fotograma) | Ara es… | Arranque Águila / Ara |');
console.log('|---|---|---|---|---|');
for (const drones of (process.env.DRONES ? [Number(process.env.DRONES)] : [6, 60, 300])) {
  const a = process.env.SOLO === 'Ara' ? { ms: 1, inicio: 0 } : await mundo('Águila', drones), b = process.env.SOLO === 'Águila' ? { ms: 1, inicio: 0 } : await mundo('Ara', drones);
  console.log(`| ${drones} | ${a.ms.toFixed(3)} | ${b.ms.toFixed(3)} | ${(a.ms / b.ms).toFixed(1)}× más rápido | ${a.inicio.toFixed(0)} ms / ${b.inicio.toFixed(0)} ms |`);
}

console.log('\nBandada (lógica propia del script)');
console.log('| Pájaros | Águila (ms/fotograma) | Ara (ms/fotograma) | Ara es… |');
console.log('|---|---|---|---|');
for (const pajaros of [50, 150, 300]) {
  const a = await bandada('Águila', pajaros), b = await bandada('Ara', pajaros);
  console.log(`| ${pajaros} | ${a.toFixed(2)} | ${b.toFixed(3)} | ${(a / b).toFixed(0)}× más rápido |`);
}
