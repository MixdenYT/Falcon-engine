// La resolución de movimiento 3D en Ara se compara paso a paso con el algoritmo JS de referencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleoAra } from '../src/motor/nucleo-ara.js';
import { Mundo3D } from '../src/motor/mundo3d.js';

const nucleo = await nucleoAra();
const F = nucleo.fisica3d;
const caja = (x0, y0, z0, x1, y1, z1, dueno, cuerpo = false, movil = false) => ({
  x0, y0, z0, x1, y1, z1, dueno, cuerpo, movil,
});

function preparar(solidos) {
  F.empezar();
  for (const s of solidos) F.caja(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1, s.dueno, s.cuerpo, s.movil);
  F.preparar();
  F.empezarPersonaje();
}

function ara(solidos, p) {
  preparar(solidos);
  F.mover(
    p.x, p.y, p.z, p.radio, p.altura, p.alturaTecho ?? p.altura,
    p.vx, p.vz, p.empX || 0, p.empZ || 0, Math.pow(0.05, p.dt),
    p.vy || 0, !!p.gravedad, p.g, p.escalaG ?? 1, p.dt,
  );
  const banderas = F.banderas();
  return {
    x: F.x(), y: F.y(), z: F.z(), vx: F.vx(), vy: F.vy(), vz: F.vz(),
    empX: F.empX(), empZ: F.empZ(),
    suelo: !!(banderas & 1), pared: !!(banderas & 2), techo: !!(banderas & 4),
    contactos: Array.from({ length: F.contactos() }, (_, i) => F.contacto(i)),
  };
}

function referencia(solidos, p) {
  let x = p.x, y = p.y, z = p.z, vy = p.vy || 0;
  const yOriginal = y;
  let empX = (p.empX || 0) * Math.pow(0.05, p.dt);
  let empZ = (p.empZ || 0) * Math.pow(0.05, p.dt);
  let pared = false, techo = false, suelo = false;
  const contactos = [];
  const anotar = (id) => { if (!contactos.includes(id)) contactos.push(id); };
  const intersecta = (s, minY) =>
    x + p.radio > s.x0 && x - p.radio < s.x1 &&
    y + p.altura > s.y0 && minY < s.y1 &&
    z + p.radio > s.z0 && z - p.radio < s.z1;

  const dx = (p.vx + empX) * p.dt;
  if (dx !== 0 && !Number.isNaN(dx)) {
    x += dx;
    let offset = 0.05;
    for (const s of solidos) {
      if (!intersecta(s, y + offset)) continue;
      if (!s.movil && !s.cuerpo && s.y1 - y < 0.35) { y = s.y1; offset = 0; continue; }
      x = dx > 0 ? Math.min(x, s.x0 - p.radio - 0.001) : Math.max(x, s.x1 + p.radio + 0.001);
      pared = true; anotar(s.dueno); offset = 0;
    }
  }

  const dz = (p.vz + empZ) * p.dt;
  if (dz !== 0 && !Number.isNaN(dz)) {
    z += dz;
    let offset = 0.05;
    for (const s of solidos) {
      if (!intersecta(s, y + offset)) continue;
      if (!s.movil && !s.cuerpo && s.y1 - y < 0.35) { y = s.y1; offset = 0; continue; }
      z = dz > 0 ? Math.min(z, s.z0 - p.radio - 0.001) : Math.max(z, s.z1 + p.radio + 0.001);
      pared = true; anotar(s.dueno); offset = 0;
    }
  }

  const vyAnt = vy;
  if (p.gravedad) vy = Math.max(vy - p.g * (p.escalaG ?? 1) * p.dt, -60);
  const dy = (vyAnt + vy) * 0.5 * p.dt;
  y += dy;
  const yCaja = y;
  for (const s of solidos) {
    if (s.cuerpo || !(x + p.radio > s.x0 && x - p.radio < s.x1 && yCaja + p.altura > s.y0 && yCaja < s.y1 && z + p.radio > s.z0 && z - p.radio < s.z1)) continue;
    if (dy <= 0 && yOriginal >= s.y1 - 0.36) { y = s.y1; vy = 0; suelo = true; }
    else if (dy > 0 && yOriginal + (p.alturaTecho ?? p.altura) <= s.y0 + 0.05) {
      y = s.y0 - (p.alturaTecho ?? p.altura); vy = 0; techo = true;
    }
    anotar(s.dueno);
  }
  if (!p.gravedad) suelo = true;
  return {
    x, y, z, vx: p.dt > 0 ? (x - p.x) / p.dt : 0, vy,
    vz: p.dt > 0 ? (z - p.z) / p.dt : 0, empX, empZ,
    suelo, pared, techo, contactos,
  };
}

function comparar(solidos, p, etiqueta) {
  const esperado = referencia(solidos, p);
  const obtenido = ara(solidos, p);
  for (const k of Object.keys(esperado)) {
    if (Array.isArray(esperado[k])) assert.deepEqual(obtenido[k], esperado[k], etiqueta + ': ' + k);
    else assert.ok(Object.is(obtenido[k], esperado[k]), etiqueta + ': ' + k + ' JS=' + esperado[k] + ' Ara=' + obtenido[k]);
  }
}

function azar(semilla) {
  return () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

test('física 3D en Ara: pared, suelo, techo, escalones e impulsos', () => {
  const suelo = caja(-20, -1, -20, 20, 0, 20, 1);
  const pared = caja(1, 0, -4, 2, 4, 4, 2);
  const techo = caja(-2, 2, -2, 2, 3, 2, 3);
  comparar([suelo, pared], { x: 0, y: 0, z: 0, radio: 0.38, altura: 1.8, vx: 10, vz: 0, vy: 0, gravedad: true, g: 18, dt: 0.1 }, 'pared y suelo');
  comparar([suelo, techo], { x: 0, y: 0, z: 0, radio: 0.38, altura: 1.8, vx: 0, vz: 0, vy: 10, gravedad: true, g: 18, dt: 0.1 }, 'techo');
  comparar([caja(0.5, 0, -1, 1.5, 0.2, 1, 4)], { x: 0, y: 0, z: 0, radio: 0.38, altura: 1.8, vx: 5, vz: 0, vy: 0, gravedad: false, g: 18, dt: 0.1 }, 'escalón bajo');
  comparar([pared], { x: 0, y: 0, z: 0, radio: 0.42, altura: 1.12, vx: 0, vz: 0, empX: 4, empZ: 1, vy: 0, gravedad: false, g: 18, dt: 0.1 }, 'impulso amortiguado');
  comparar([caja(-2, -1, -2, 2, 0.1, 2, 5), caja(-2, -1, -2, 2, 0.05, 2, 6)], { x: 0, y: 0, z: 0, radio: 0.38, altura: 1.8, vx: 0, vz: 0, vy: 0, gravedad: true, g: 18, dt: 0.1 }, 'varias superficies en la misma caja vertical');
});

test('física 3D en Ara: los cuerpos bloquean horizontalmente, no el eje vertical', () => {
  const cuerpo = caja(0.4, 0, -1, 1.4, 1.8, 1, 22, true);
  comparar([cuerpo], { x: 0, y: 0, z: 0, radio: 0.38, altura: 1.8, vx: 8, vz: 0, vy: -4, gravedad: true, g: 18, dt: 0.1 }, 'cuerpo táctico');
});

test('física 3D en Ara = referencia JS: 500 pasos deterministas con AABB aleatorias', () => {
  const r = azar(0xFA1C0);
  for (let caso = 0; caso < 500; caso++) {
    const solidos = Array.from({ length: caso % 8 }, (_, i) => {
      const x = Math.round((r() * 8 - 4) * 4) / 4;
      const y = Math.round((r() * 2 - 0.5) * 4) / 4;
      const z = Math.round((r() * 8 - 4) * 4) / 4;
      const cuerpo = caso % 3 === 0 && i === 0;
      return caja(x, y, z, x + 0.2 + r() * 1.2, y + 0.2 + r() * 2.2, z + 0.2 + r() * 1.2, i + 1, cuerpo);
    });
    const p = {
      x: r() * 4 - 2, y: r() * 2, z: r() * 4 - 2,
      radio: caso % 2 ? 0.38 : 0.42, altura: caso % 5 === 0 ? 1.12 : 1.8,
      alturaTecho: 1.8, vx: r() * 18 - 9, vz: r() * 18 - 9,
      empX: r() * 4 - 2, empZ: r() * 4 - 2, vy: r() * 20 - 10,
      gravedad: caso % 4 !== 0, g: 18 + r() * 8, escalaG: 0.5 + r() * 1.5,
      dt: [1 / 30, 1 / 60, 1 / 120, 0.1][caso % 4],
    };
    comparar(solidos, p, 'caso aleatorio ' + caso);
  }
});


test('Mundo3D usa Ara para resolver la física y conserva el mapeo de contactos', () => {
  const d = Object.create(Mundo3D.prototype);
  d.m = { nucleo };
  const pared = { nombre: 'Pared' };
  const personaje = {
    props: { tactico: false, altura: 1.8, usa_gravedad: true, gravedad: 18 },
    grupos: new Set(), mueveX: 10, mueveZ: 0, empX: 0, empZ: 0, vy: 0, _contactosSolidos: new Set(),
  };
  const pos = [0, 0, 0];
  const usado = d.resolverFisicaPersonajeAra(
    personaje, pos, 0.1, 1, [personaje],
    [{ n: pared, movil: false, b: { min: { x: 1, y: 0, z: -2 }, max: { x: 2, y: 3, z: 2 } } }],
  );
  assert.equal(usado, true);
  assert.equal(pos[0], 0.619);
  assert.equal(personaje.enPared, true);
  assert.equal(personaje.enSuelo, false);
  assert.deepEqual([...personaje._contactosSolidos], [pared]);
  assert.equal(personaje.vy, -1.8);
  assert.equal(d.m.nucleo, nucleo, 'el núcleo no ha sufrido errores');
});


test('Mundo3D carga las cajas estáticas una vez y limpia los cuerpos entre personajes', () => {
  const d = Object.create(Mundo3D.prototype);
  d.m = { nucleo };
  d.posicionGlobal = n => n.props.posicion;
  const solidos = [{
    n: { nombre: 'Muro' }, movil: false,
    b: { min: { x: 8, y: 0, z: 8 }, max: { x: 9, y: 3, z: 9 } },
  }];
  const a = {
    tipo: 'Personaje3D', props: { tactico: true, altura: 1.8, usa_gravedad: false },
    grupos: new Set(), posicion: [0, 0, 0], mueveX: 0, mueveZ: 0, empX: 0, empZ: 0, vy: 0,
    _contactosSolidos: new Set(),
  };
  const b = {
    tipo: 'Personaje3D', props: { tactico: false, altura: 1.8, posicion: [3, 0, 0], usa_gravedad: false },
    grupos: new Set(), mueveX: 0, mueveZ: 0, empX: 0, empZ: 0, vy: 0,
    _contactosSolidos: new Set(),
  };
  const original = F.caja;
  let llamadas = 0;
  F.caja = (...args) => { llamadas++; return original(...args); };
  try {
    assert.equal(d.resolverFisicaPersonajeAra(a, [0, 0, 0], 1 / 60, 1, [a, b], solidos), true);
    assert.equal(d.resolverFisicaPersonajeAra(b, [3, 0, 0], 1 / 60, 1, [a, b], solidos), true);
    assert.equal(llamadas, 2, 'una caja estática y un cuerpo dinámico; la caja estática no se reenvía');
  } finally {
    F.caja = original;
  }
});

test('Mundo3D conserva el respaldo JS cuando hay cuerpos empujables', () => {
  const d = Object.create(Mundo3D.prototype);
  d.m = { nucleo };
  const personaje = {
    props: { tactico: false, altura: 1.8, usa_gravedad: true, gravedad: 18 },
    grupos: new Set(), mueveX: 0, mueveZ: 0, empX: 0, empZ: 0, vy: 0,
  };
  const pos = [0, 0, 0];
  const usado = d.resolverFisicaPersonajeAra(
    personaje, pos, 1 / 60, 1, [personaje],
    [{ n: {}, movil: true, b: { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } } }],
  );
  assert.equal(usado, false);
  assert.deepEqual(pos, [0, 0, 0]);
});

test('el núcleo expone la física 3D escrita en Ara', () => {
  assert.equal(typeof nucleo.fisica3d.mover, 'function');
  assert.equal(typeof nucleo.fisica3d.caja, 'function');
});
