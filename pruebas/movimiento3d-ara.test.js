// El controlador de movimiento de Ara se contrasta con la fórmula JS original.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleoAra } from '../src/motor/nucleo-ara.js';
import { Controles3D } from '../src/motor/control3d.js';

const nucleo = await nucleoAra();
const A = nucleo.movimiento3d;

function ara(p) {
  A.actualizar(
    p.ejeX, p.ejeZ, p.velocidadBase, p.dt, p.tactico, p.agachado, p.lento, p.apuntando,
    p.teclaCorrer, p.muerto, p.suelo, p.yawActivo, p.yaw,
    p.adelanteX, p.adelanteZ, p.derechaX, p.derechaZ,
    p.vx, p.vz, p.vy, p.coyote, p.recordado, p.saltando,
    p.pulsaSaltar, p.mantieneSaltar, p.velocidadSalto, p.alturaActual, p.alturaObjetivo,
  );
  return {
    vx: A.vx(), vz: A.vz(), vy: A.vy(),
    mueveX: A.mueveX(), mueveZ: A.mueveZ(),
    coyote: A.coyote(), recordado: A.recordado(), altura: A.altura(),
    banderas: A.banderas(),
  };
}

function referencia(p) {
  let x = p.ejeX, z = p.ejeZ;
  const longitud = Math.hypot(x, z);
  if (longitud > 1) { x /= longitud; z /= longitud; }
  const correr = p.teclaCorrer && longitud > 0.1 &&
    (!p.tactico || !p.agachado && !p.apuntando && !p.lento);
  let velocidad = 0;
  if (!p.muerto) {
    if (p.tactico) velocidad = p.agachado ? 1.05 : p.lento ? 1.1 : p.apuntando ? 1.35 : correr ? 3.2 : 2.2;
    else velocidad = p.velocidadBase * (correr ? 1.7 : 1);
  }
  let objetivoX, objetivoZ;
  if (p.yawActivo) {
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    objetivoX = (c * x + s * z) * velocidad;
    objetivoZ = (-s * x + c * z) * velocidad;
  } else {
    objetivoX = (p.derechaX * x - p.adelanteX * z) * velocidad;
    objetivoZ = (p.derechaZ * x - p.adelanteZ * z) * velocidad;
  }
  const tasa = p.tactico ? (longitud > 0.05 ? 32 : 42) :
    p.suelo ? (longitud > 0.05 ? 14 : 20) : (longitud > 0.05 ? 4 : 1.2);
  const k = 1 - Math.exp(-tasa * p.dt);
  let vx = p.vx + (objetivoX - p.vx) * k;
  let vz = p.vz + (objetivoZ - p.vz) * k;
  if (Math.abs(vx) < 0.01 && objetivoX === 0) vx = 0;
  if (Math.abs(vz) < 0.01 && objetivoZ === 0) vz = 0;

  let coyote = p.suelo ? 0.12 : Math.max(0, p.coyote - p.dt);
  let recordado = p.pulsaSaltar ? 0.14 : Math.max(0, p.recordado - p.dt);
  let vy = p.vy, saltando = p.saltando, suelo = p.suelo, saltoEvento = false;
  if (!p.tactico && recordado > 0 && coyote > 0) {
    vy = p.velocidadSalto; suelo = false; coyote = 0; recordado = 0; saltando = true; saltoEvento = true;
  }
  if (saltando && !p.mantieneSaltar && vy > 0) { vy *= 0.55; saltando = false; }
  if (vy <= 0) saltando = false;

  let altura = p.alturaActual;
  const diferencia = p.alturaObjetivo - altura;
  altura += Math.sign(diferencia) * Math.min(Math.abs(diferencia), p.dt * 4.5);
  let banderas = (correr ? 1 : 0) + (saltando ? 2 : 0) + (suelo ? 4 : 0) +
    (longitud > 0.1 ? 8 : 0) + (saltoEvento ? 16 : 0);
  return { vx, vz, vy, mueveX: vx, mueveZ: vz, coyote, recordado, altura, banderas };
}

const base = {
  ejeX: 0.6, ejeZ: -0.8, velocidadBase: 5, dt: 1 / 60,
  tactico: false, agachado: false, lento: false, apuntando: false,
  teclaCorrer: false, muerto: false, suelo: true, yawActivo: true, yaw: 0.7,
  adelanteX: 0, adelanteZ: -1, derechaX: 1, derechaZ: 0,
  vx: 0, vz: 0, vy: 0, coyote: 0, recordado: 0, saltando: false,
  pulsaSaltar: false, mantieneSaltar: false, velocidadSalto: 6,
  alturaActual: 1.8, alturaObjetivo: 1.8,
};

function comparar(p, nombre) {
  const esperado = referencia(p), obtenido = ara(p);
  for (const k of Object.keys(esperado)) {
    if (k === 'banderas') assert.equal(obtenido[k], esperado[k], nombre + ': ' + k);
    else assert.ok(Math.abs(obtenido[k] - esperado[k]) <= 1e-12,
      nombre + ': ' + k + ' JS=' + esperado[k] + ' Ara=' + obtenido[k]);
  }
}

function azar(semilla) {
  return () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

test('movimiento Ara: orientación de cámara, inercia, carrera y control aéreo', () => {
  comparar({ ...base }, 'andar relativo a cámara');
  comparar({ ...base, ejeX: 1, ejeZ: 1, teclaCorrer: true, vx: 1, vz: -1 }, 'diagonal y correr');
  comparar({ ...base, tactico: true, apuntando: true, teclaCorrer: true, suelo: false, vx: 0.4 }, 'apuntar táctico en aire');
  comparar({ ...base, tactico: true, agachado: true, lento: true, teclaCorrer: true }, 'agachado prevalece');
  comparar({ ...base, muerto: true, teclaCorrer: true, ejeX: 1 }, 'personaje muerto');
});

test('movimiento Ara: coyote-time, salto recordado y altura variable', () => {
  comparar({ ...base, suelo: false, coyote: 0.05, pulsaSaltar: true, mantieneSaltar: true }, 'salto de coyote');
  comparar({ ...base, suelo: true, pulsaSaltar: true, mantieneSaltar: false }, 'salto recordado y corte temprano');
  comparar({ ...base, suelo: false, coyote: 0.001, recordado: 0.03, pulsaSaltar: false }, 'salto recordado al aterrizar');
  comparar({ ...base, tactico: true, agachado: true, alturaActual: 1.8, alturaObjetivo: 1.12 }, 'agacharse gradualmente');
});

test('movimiento Ara = referencia JS: 500 entradas deterministas', () => {
  const r = azar(0xC0A7A);
  for (let i = 0; i < 500; i++) {
    const p = {
      ejeX: r() * 2 - 1, ejeZ: r() * 2 - 1, velocidadBase: 1 + r() * 8,
      dt: [1 / 30, 1 / 60, 1 / 120, 0.1][i % 4],
      tactico: i % 3 === 0, agachado: i % 5 === 0, lento: i % 7 === 0, apuntando: i % 4 === 0,
      teclaCorrer: i % 2 === 0, muerto: i % 29 === 0, suelo: i % 3 !== 0,
      yawActivo: i % 2 === 0, yaw: r() * Math.PI * 2 - Math.PI,
      adelanteX: r() * 2 - 1, adelanteZ: r() * 2 - 1, derechaX: r() * 2 - 1, derechaZ: r() * 2 - 1,
      vx: r() * 10 - 5, vz: r() * 10 - 5, vy: r() * 12 - 6,
      coyote: r() * 0.15, recordado: r() * 0.15, saltando: i % 5 === 0,
      pulsaSaltar: i % 13 === 0, mantieneSaltar: i % 3 !== 0, velocidadSalto: 3 + r() * 5,
      alturaActual: 1.12 + r() * 0.68, alturaObjetivo: i % 2 ? 1.12 : 1.8,
    };
    comparar(p, 'entrada ' + i);
  }
});


test('Controles3D delega el movimiento del jugador al núcleo Ara', () => {
  const entrada = {
    eje: (izq, der) => izq === 'izquierda' ? 1 : 0,
    pulsa: () => false,
    mantiene: nombre => nombre === 'correr',
  };
  const eventos = [];
  const d3 = {
    m: { nucleo, entrada, telemetria: nombre => eventos.push(nombre) },
    posicionGlobal: () => [0, 0, 0],
    ejesCamara: () => ({ f: { x: 0, z: -1 }, r: { x: 1, z: 0 } }),
    errorAra: () => false,
  };
  const controles = Object.create(Controles3D.prototype);
  controles.d3 = d3;
  controles.activo = false;
  controles.jugador = null;
  controles.yaw = 0;
  const personaje = {
    props: { tactico: false, altura: 1.8, velocidad: 5, salto: 6, controles: 'tercera_persona', cambiar_vista: false },
    enSuelo: true, vy: 0, _vx: 0, _vz: 0, _coyote: 0, _recordado: 0, _saltando: false,
  };
  const original = nucleo.movimiento3d.actualizar;
  let llamadas = 0;
  nucleo.movimiento3d.actualizar = (...args) => { llamadas++; return original(...args); };
  try {
    controles.moverJugador(personaje, 1 / 60);
  } finally {
    nucleo.movimiento3d.actualizar = original;
  }
  assert.equal(llamadas, 1);
  assert.ok(personaje._vx > 0);
  assert.equal(personaje._correr, true);
  assert.equal(personaje.mueveX, personaje._vx);
  assert.deepEqual(eventos, ['andar']);
});

test('el núcleo expone el controlador de movimiento escrito en Ara', () => {
  assert.equal(typeof nucleo.movimiento3d.actualizar, 'function');
});
