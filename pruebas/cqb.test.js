import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blueprintsCQB } from '../src/motor/cqb-blueprints.js';
import { compilarBlueprint } from '../src/motor/blueprints.js';
import { analizar } from '../src/aguila/index.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { Mundo3D } from '../src/motor/mundo3d.js';
import { crearNodo } from '../src/motor/tipos.js';
import { datosProyecto } from '../src/motor/proyecto.js';

const archivos = blueprintsCQB();
const N = (tipo, nombre, props = {}, hijos = [], extra = {}) => Object.assign(crearNodo(tipo, nombre, props, hijos), extra);
function mundo() {
  const m = new Mundo({ proyecto: { datos: { ...datosProyecto('CQB', '3D'), gravedad: 18 } }, lienzo: {} });
  m.raiz = new NodoVivo(m, N('Nodo3D', 'CQB', {}, [
    N('Personaje3D', 'Jugador', { posicion: [0, 0, 5], tactico: true, controles: 'primera_persona' }, [], { blueprint: 'blueprints/operador.bp' }),
    ...[0, 1, 2].map(i => N('Personaje3D', 'Enemigo' + i, { posicion: [i * 3, 0, -5] }, [], { blueprint: 'blueprints/enemigo_cqb.bp', grupos: ['enemigos', 'enemigos_cqb'] })),
    N('Nodo3D', 'Puerta', { posicion: [3, 0, 3] }, [N('Malla3D', 'Hoja', { posicion: [0.75, 1.1, 0], escala: [1.5, 2.2, 0.12] })], { blueprint: 'blueprints/puerta_cqb.bp', grupos: ['interactuable'] }),
    N('Malla3D', 'Terminal', {}, [], { blueprint: 'blueprints/terminal_cqb.bp' }),
  ]), null);
  m.textos = new Map(Object.entries(archivos).map(([p, a]) => [p, typeof a === 'string' ? a : JSON.stringify(a)]));
  m.audio = { sonar() {} }; m.d3 = new Mundo3D(m); m.d3.solidos = [];
  const j = m.buscarPorNombre('Jugador'), d = m.d3;
  for (const n of m.todos()) {
    const g = new THREE.Group(); g.position.fromArray(n.props.posicion || [0, 0, 0]); g.scale.fromArray(n.props.escala || [1, 1, 1]);
    if (n.tipo === 'Personaje3D') { g.userData.visual = new THREE.Group(); g.add(g.userData.visual); }
    if (n.tipo === 'Malla3D') { g.userData.malla = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); g.add(g.userData.malla); }
    d.escena.objetos.set(n.id, g); d.escena.nodos.set(n.id, n);
    const padre = n.padre ? d.obj(n.padre) : d.escena.scene; padre.add(g);
  }
  d.controles.jugador = j; d.controles.activo = true;
  d.camaraUsada = d.controles.camara; d.camaraUsada.position.set(0, 1.44, 5); d.camaraUsada.lookAt(0, 1.44, -5); d.camaraUsada.updateMatrixWorld();
  m.iniciarScripts(m.raiz); return m;
}
const actualizar = (m, n, delta) => { m.tiempo += delta; m.emitirNodo(n, 'se_actualiza', [delta]); };

test('CQB: todos los grafos compilan sin avisos y el Águila generado se analiza de verdad', () => {
  for (const [p, a] of Object.entries(archivos)) {
    if (p.endsWith('.bp')) { const r = compilarBlueprint(a, p); assert.deepEqual(r.errores, []); assert.deepEqual(r.avisos, []); }
    if (p.endsWith('.agl')) assert.deepEqual(analizar(a, p).errores, [], p);
  }
});
test('CQB: munición, daño por rayo real, disparo manual, recarga cancelada y dos inventarios', () => {
  const m = mundo(), j = m.buscarPorNombre('Jugador'), e = m.buscarPorNombre('Enemigo0');
  assert.deepEqual(m.errores, []);
  m.emitirNodo(j, 'se_pulsa', ['disparar']); assert.equal(j.aguilaObtener('municion'), 23); assert.equal(e.aguilaObtener('vida'), 60);
  m.entrada.estado.set('disparar', true);
  for (let i = 0; i < 20; i++) actualizar(m, j, 0.05);
  assert.equal(j.aguilaObtener('municion'), 23, 'mantener no provoca disparos automáticos');
  m.emitirNodo(j, 'se_pulsa', ['recargar']); assert.equal(j.aguilaObtener('recargando'), true);
  m.emitirNodo(j, 'se_pulsa', ['arma_2']); assert.equal(j.aguilaObtener('municion'), 12); assert.equal(j.aguilaObtener('recargando'), false);
  actualizar(m, j, 3); assert.equal(j.aguilaObtener('municion'), 12);
  m.emitirNodo(j, 'se_pulsa', ['arma_1']); assert.equal(j.aguilaObtener('municion'), 23);
  m.emitirNodo(j, 'se_pulsa', ['recargar']); actualizar(m, j, 2.3);
  assert.equal(j.aguilaObtener('municion'), 24); assert.equal(j.aguilaObtener('reserva'), 95); assert.deepEqual(m.errores, []);
});
test('CQB: reacción enemiga, cobertura tras impacto, bajas y objetivo final de Blueprint', () => {
  const m = mundo(), j = m.buscarPorNombre('Jugador'), e = m.buscarPorNombre('Enemigo0');
  e._mirarYaw = Math.PI; m.d3.obj(e).userData.visual.rotation.y = Math.PI;
  actualizar(m, e, 0.05); assert.equal(e.aguilaObtener('alerta'), true); assert.equal(j.aguilaObtener('vida'), 100);
  actualizar(m, e, 0.5); assert.equal(j.aguilaObtener('vida'), 100);
  actualizar(m, e, 0.7); assert.equal(j.aguilaObtener('vida'), 92);
  m.llamarFuncion(e, 'recibir_dano', [40]); assert.ok(e.aguilaObtener('retirada') > 0);
  actualizar(m, e, 0.05); assert.equal(e.aguilaObtener('estado'), 'COBERTURA');
  m.llamarFuncion(m.buscarPorNombre('Terminal'), 'usar', []); assert.equal(m.estado, 'jugando');
  for (const enemigo of m.grupo('enemigos')) m.llamarFuncion(enemigo, 'recibir_dano', [150]);
  assert.equal(j.aguilaObtener('bajas'), 3); assert.equal(m.grupo('enemigos').filter(e => e._muerto).length, 3);
  m.llamarFuncion(m.buscarPorNombre('Terminal'), 'usar', []); assert.equal(m.estado, 'ganado'); assert.deepEqual(m.errores, []);
});
test('CQB: puerta Blueprint se abre y el barrido se detiene ante un personaje', () => {
  const m = mundo(), puerta = m.buscarPorNombre('Puerta'), j = m.buscarPorNombre('Jugador');
  m.llamarFuncion(puerta, 'usar', []);
  for (let i = 0; i < 30; i++) actualizar(m, puerta, 0.05);
  assert.equal(puerta.props.rotacion[1], 92);
  m.llamarFuncion(puerta, 'usar', []);
  for (let i = 0; i < 30; i++) actualizar(m, puerta, 0.05);
  assert.equal(puerta.props.rotacion[1], 0);
  m.d3.fijarPosicionGlobal(j, 4, 0, 2.7); m.llamarFuncion(puerta, 'usar', []);
  for (let i = 0; i < 30; i++) actualizar(m, puerta, 0.05);
  assert.ok(puerta.props.rotacion[1] < 92, 'no atraviesa al jugador'); assert.equal(m.d3.tactico.estado(puerta).bloqueada, true);
  assert.deepEqual(m.errores, []);
});
test('CQB: A* rodea obstáculos respetando el radio de colisión', () => {
  const m = mundo(), e = m.buscarPorNombre('Enemigo0'); m.d3.fijarPosicionGlobal(e, -3, 0, 0);
  const b = new THREE.Box3(new THREE.Vector3(-0.5, 0, -2), new THREE.Vector3(0.5, 3, 2)); m.d3.solidos = [{ n: {}, b }];
  const ruta = m.d3.tactico.calcularRuta(e, [3, 0, 0]); assert.ok(ruta.length > 12); assert.ok(ruta.some(p => Math.abs(p[2]) >= 2.5));
  assert.ok(ruta.every(p => !b.clone().expandByScalar(0.39).containsPoint(new THREE.Vector3(p[0], 1, p[2]))));
});
test('CQB: un muro entre cámara y boca impide que el arma alcance un enemigo por el lateral', () => {
  const m = mundo(), e = m.buscarPorNombre('Enemigo0');
  const pared = { nombre: 'Cobertura' };
  m.d3.solidos = [{ n: pared, b: new THREE.Box3(new THREE.Vector3(0.10, 0, 4.2), new THREE.Vector3(0.18, 3, 5.2)) }];
  m.d3.tactico.boca = () => new THREE.Vector3(0.28, 1.3, 4.6);
  assert.equal(m.d3.dispararRayo(65), pared); assert.equal(e.aguilaObtener('vida'), 100);
});
test('CQB: el enemigo consume seis disparos y recarga sin disparar durante 2,6 segundos', () => {
  const m = mundo(), j = m.buscarPorNombre('Jugador'), e = m.buscarPorNombre('Enemigo0');
  m.d3.obj(e).userData.visual.rotation.y = Math.PI;
  actualizar(m, e, 0.05);
  for (let i = 0; i < 6; i++) actualizar(m, e, 1.16);
  assert.equal(e.aguilaObtener('municion'), 0); assert.equal(e.aguilaObtener('recargando'), true);
  const vida = j.aguilaObtener('vida'); actualizar(m, e, 2.5); assert.equal(j.aguilaObtener('vida'), vida);
  actualizar(m, e, 0.11); assert.equal(e.aguilaObtener('municion'), 6); assert.equal(e.aguilaObtener('recargando'), false);
  assert.deepEqual(m.errores, []);
});
test('CQB: a quemarropa los personajes reciben el rayo aunque la boca entre en su collider', () => {
  const m = mundo(), j = m.buscarPorNombre('Jugador'), e = m.buscarPorNombre('Enemigo0'), d = m.d3;
  d.fijarPosicionGlobal(e, 0, 0, 4.1);
  d.obj(e).userData.visual.rotation.y = Math.PI;
  d.tactico.boca = n => n === j ? new THREE.Vector3(0, 1.3, 4.2) : new THREE.Vector3(0, 1.37, 4.95);
  m.emitirNodo(j, 'se_pulsa', ['disparar']);
  assert.equal(e.aguilaObtener('vida'), 60, 'un cuerpo cercano no baja el arma ni evita el daño');
  assert.equal(d.tactico.disparar(e, 8, 20), true);
  assert.equal(j.aguilaObtener('vida'), 92, 'el puente de la boca enemiga también resuelve el contacto cercano');
  assert.deepEqual(m.errores, []);
});
