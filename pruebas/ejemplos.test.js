import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NODOS, pinesDe, compatibles, compilarBlueprint } from '../src/motor/blueprints.js';
import { plantillaAcademia } from '../src/motor/academia.js';
import { plantillaShooter } from '../src/motor/shooters.js';
import { analizar } from '../src/aguila/index.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { Mundo3D } from '../src/motor/mundo3d.js';
import { crearProyecto } from '../src/motor/plantillas.js';
import { readFile } from 'node:fs/promises';

const academia = plantillaAcademia('Academia'), shooter = plantillaShooter('Shooter');
const recorrer = n => [n, ...(n.hijos || []).flatMap(recorrer)];

test('academia cubre cada bloque real, también funciones ocultas, con grafos ejecutables y conexiones válidas', () => {
  assert.deepEqual(academia.archivos['cobertura-blueprints.json'].bloques.map(b => b.id).sort(), Object.keys(NODOS).sort());
  for (const id of Object.keys(NODOS)) {
    const bp = academia.archivos[`blueprints/${id}.bp`];
    assert.ok(Object.values(bp.grafos).some(g => g.nodos.some(n => n.def === id)), id);
    const compilado = compilarBlueprint(bp);
    assert.deepEqual(compilado.errores, [], id); assert.deepEqual(compilado.avisos, [], id);
    for (const g of Object.values(bp.grafos)) {
      const entradas = new Set();
      for (const c of g.conexiones) {
        const a = g.nodos.find(n => n.id === c.de), b = g.nodos.find(n => n.id === c.a);
        const salida = pinesDe(a, bp).salidas.find(p => p.n === c.salida), entrada = pinesDe(b, bp).entradas.find(p => p.n === c.entrada);
        assert.ok(salida && entrada && compatibles(salida.t, entrada.t), `${id}: ${JSON.stringify(c)}`);
        assert.ok(!entradas.has(c.a + ':' + c.entrada), `${id}: dos cables en una entrada`); entradas.add(c.a + ':' + c.entrada);
      }
    }
    assert.ok(academia.archivos['GUIA_BLUEPRINTS.md'].includes(`(${id})`), id);
  }
});

test('todas las escenas referencian archivos existentes y todo Águila generado y escrito es válido', () => {
  for (const proyecto of [academia, shooter]) for (const [ruta, archivo] of Object.entries(proyecto.archivos)) {
    if (ruta.endsWith('.agl')) assert.deepEqual(analizar(archivo, ruta).errores, [], ruta);
    if (!ruta.endsWith('.fscn')) continue;
    for (const n of recorrer(archivo.raiz)) {
      for (const ref of [n.script, n.blueprint, n.props.escena].filter(Boolean)) assert.ok(proyecto.archivos[ref], `${ruta}: ${ref}`);
    }
  }
});

function mundoShooter() {
  const m = new Mundo({ proyecto: { datos: shooter.datos }, lienzo: {} });
  m.raiz = new NodoVivo(m, shooter.archivos['escenas/base_abierta.fscn'].raiz, null); m.indiceSucio = true;
  m.textos = new Map(Object.entries(shooter.archivos).filter(([p]) => p.endsWith('.agl')));
  m.audio = { sonar() {}, pararNodo() {} };
  m.d3 = { posicionGlobal: n => n.props.posicion, lineaVision: () => true, quitar() {}, fijarPosicionGlobal(n, ...p) { n.props.posicion = p; } };
  m.iniciarScripts(m.raiz);
  return m;
}

test('combate real de scripts: inicio, tres impactos, cadencia, recarga, victoria y derrota', () => {
  const m = mundoShooter(), j = m.buscarPorNombre('Jugador');
  assert.deepEqual(m.errores, []);
  m.emitirNodo(j, 'se_pulsa', ['accion']);
  const drone = m.grupo('enemigos')[0]; m.d3.dispararRayo = () => drone;
  m.entrada.estado.set('disparar', true);
  m.emitirNodo(j, 'se_actualiza', [0.23]);
  m.emitirNodo(j, 'se_actualiza', [0.01]);
  assert.equal(j.aguilaObtener('municion'), 11, 'la cadencia impide el segundo tiro');
  m.emitirNodo(j, 'se_actualiza', [0.23]); m.emitirNodo(j, 'se_actualiza', [0.23]);
  assert.equal(drone.eliminado, true); assert.equal(j.aguilaObtener('bajas'), 1);
  m.emitirNodo(j, 'se_pulsa', ['recargar']); assert.equal(j.aguilaObtener('recargando'), true);
  for (const s of j.scripts) assert.equal(s.actualizarCorrutinas(1.5), null);
  assert.equal(j.aguilaObtener('municion'), 12); assert.equal(j.aguilaObtener('reserva'), 69);
  for (const enemigo of m.grupo('enemigos')) for (let i = 0; i < 3; i++) m.llamarFuncion(enemigo, 'recibir_dano', [34]);
  assert.equal(m.estado, 'ganado'); assert.equal(j.aguilaObtener('bajas'), 6);
  const derrota = mundoShooter(), jugador = derrota.buscarPorNombre('Jugador');
  derrota.emitirNodo(jugador, 'se_pulsa', ['accion']); derrota.llamarFuncion(jugador, 'recibir_dano', [150]);
  assert.equal(derrota.estado, 'perdido'); assert.equal(jugador.aguilaObtener('vida'), 0);
  assert.deepEqual(m.errores, []); assert.deepEqual(derrota.errores, []);
});

test('IA real respeta inicio, visión, intervalo de ataque y patrulla sin visión', () => {
  const m = mundoShooter(), j = m.buscarPorNombre('Jugador'), e = m.grupo('enemigos')[0];
  m.emitirNodo(e, 'se_actualiza', [2]); assert.equal(j.aguilaObtener('vida'), 100);
  m.emitirNodo(j, 'se_pulsa', ['accion']);
  m.emitirNodo(e, 'se_actualiza', [2]); assert.equal(j.aguilaObtener('vida'), 92);
  m.emitirNodo(e, 'se_actualiza', [0.1]); assert.equal(j.aguilaObtener('vida'), 92);
  m.d3.lineaVision = () => false;
  m.emitirNodo(e, 'se_actualiza', [2]); assert.equal(j.aguilaObtener('vida'), 92);
  assert.ok(Number.isFinite(e.mueveX) && Number.isFinite(e.mueveZ)); assert.deepEqual(m.errores, []);
});

function rayos() {
  const jugador = { tipo: 'Personaje3D', props: { posicion: [0, 0, 0], altura: 1.8 }, visible: true };
  const enemigo = { tipo: 'Personaje3D', props: { posicion: [0, 0, -10], altura: 1.8 }, visible: true };
  const muro = { tipo: 'Malla3D', visible: true };
  const d = Object.create(Mundo3D.prototype);
  d.m = { todos: () => [jugador, enemigo] }; d.posicionGlobal = n => n.props.posicion;
  d.solidos = []; d.controles = { buscarJugador: () => jugador };
  d.camaraUsada = new THREE.PerspectiveCamera(); d.camaraUsada.position.set(0, 1.44, 4); d.camaraUsada.updateMatrixWorld();
  d.escena = { scene: new THREE.Scene() }; d.trazas = [];
  return { d, jugador, enemigo, muro };
}

test('rayos de combate y visión se detienen en paredes y respetan alcance', () => {
  const { d, jugador, enemigo, muro } = rayos();
  assert.equal(d.dispararRayo(100), enemigo); assert.equal(d.lineaVision(jugador, enemigo, 20), true);
  assert.equal(d.dispararRayo(5), null); assert.equal(d.lineaVision(jugador, enemigo, 5), false);
  d.solidos = [{ n: muro, b: new THREE.Box3(new THREE.Vector3(-4, 0, -5), new THREE.Vector3(4, 3, -4)) }];
  assert.equal(d.dispararRayo(100), muro); assert.equal(d.lineaVision(jugador, enemigo, 20), false);
  d.limpiarTrazas(true); assert.equal(d.escena.scene.children.length, 0);
});

test('cobertura entre cañón y objetivo impide disparar aunque la cámara lo vea', () => {
  const { d, muro, enemigo } = rayos();
  d.camaraUsada.position.set(2, 1.44, 4); d.camaraUsada.lookAt(0, 1.3, -10); d.camaraUsada.updateMatrixWorld();
  d.solidos = [{ n: muro, b: new THREE.Box3(new THREE.Vector3(-0.5, 0, -1.5), new THREE.Vector3(0.5, 2, -1)) }];
  assert.equal(d.primerImpacto(d.camaraUsada.position, new THREE.Vector3().subVectors(new THREE.Vector3(0, 1.3, -10), d.camaraUsada.position), 100).nodo, enemigo);
  assert.equal(d.dispararRayo(100), muro); d.limpiarTrazas(true);
});

test('crear las tres plantillas escribe proyectos completos, incluyendo WAV y metadatos', async () => {
  const fetchAnterior = globalThis.fetch;
  globalThis.fetch = async url => new Response(await readFile(new URL(url)));
  try {
  for (const id of ['academia_blueprints', 'shooter_tercera', 'shooter_primera']) {
    const escritos = new Map(); globalThis.window = { falcon: { fs: { existe: async () => false, crearCarpeta: async () => {}, escribir: async (p, d) => escritos.set(p, d) } } };
    await crearProyecto('/ejemplo', id, id);
    const datos = JSON.parse(escritos.get('/ejemplo/proyecto.falcon'));
    assert.ok(escritos.has('/ejemplo/' + datos.escena_principal)); assert.ok(escritos.has('/ejemplo/.falcon/importacion.json'));
    const audio = [...escritos].find(([p]) => p.endsWith('.wav'))[1]; assert.equal(new TextDecoder().decode(audio.slice(0, 4)), 'RIFF');
  }
  delete globalThis.window;
  } finally { globalThis.fetch = fetchAnterior; }
});
