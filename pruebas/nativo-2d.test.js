// El juego 2D nativo (examples/native-2d) da lo mismo, bit a bit y en cada paso, que Falcon: el mismo nivel, con sus
// scripts y Blueprints de verdad (en Falcon, compilados a WebAssembly con su anfitrión de JS; en el .exe, a código
// máquina con el anfitrión del motor escrito en Ara, src/motor/nativo/anfitrion2d.ara), la misma entrada guionizada y la
// misma física (src/motor/ara/fisica2d.ara). Necesita Windows y el compilador de Ara (ARA_DIR / ARA, ver
// herramientas/escena-nativa-2d.mjs); si no, se salta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './dom.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';
import { nivelPlataformas } from '../src/motor/plantillas.js';
import { rutasAra, compilarNativo2d, mundoFalcon, estadoFalcon, leerEstadoNativo, GUION, expandirGuion } from '../herramientas/escena-nativa-2d.mjs';

const rutas = rutasAra();
const motivo = rutas ? false : 'falta el compilador de Ara para Windows x64 (ARA_DIR / ARA) o no es Windows: no se prueba el .exe nativo';
if (motivo) console.warn(`⚠ nativo-2d: ${motivo}`);

/** Corre el .exe y Falcon con el mismo guion y compara su estado tras cada paso. Devuelve los estados de Falcon. */
async function comparar(exe, guion, pasos, nivel) {
  const salida = execFileSync(exe, { env: { ...process.env, FALCON_PASOS: String(pasos), FALCON_TRAZA: '1', FALCON_GUION: guion }, encoding: 'utf8', maxBuffer: 64 << 20 });
  const nativo = leerEstadoNativo(salida).pasos;
  assert.equal(nativo.size, pasos);
  const f = await mundoFalcon(await nucleoAra(), guion, nivel);
  const estados = [];
  for (let i = 0; i < pasos; i++) {
    await f.paso(i);
    const a = estadoFalcon(f.m), b = nativo.get(i);
    assert.equal(b.personajes.length, a.personajes.length, `paso ${i}: personajes`);
    a.personajes.forEach((p, k) => {
      for (const c in p) assert.ok(Object.is(p[c], b.personajes[k][c]), `paso ${i}, personaje ${k}.${c}: Falcon ${p[c]} y nativo ${b.personajes[k][c]}`);
    });
    assert.deepEqual(b.pares, a.pares, `paso ${i}: pares que se tocan`);
    assert.deepEqual(b.juego, a.juego, `paso ${i}: puntos, estado y nodos`);
    estados.push(a);
  }
  assert.deepEqual(f.m.errores, []);
  return estados;
}

test('juego 2D nativo (.exe) = Falcon con los scripts y Blueprints de la plantilla, en cada paso', { skip: motivo, timeout: 300000 }, async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'falcon-nativo-2d-'));
  try {
    const exe = await compilarNativo2d(rutas, join(carpeta, 'falcon-2d.exe'));
    const estados = await comparar(exe, GUION, GUION.length);
    // Lo que cubre el guion: el Blueprint del jugador anda y salta; recoge monedas (cada una se va con sus 2 hijos);
    // los pinchos lo empujan, esperan (`esperar(0.4)`) y reinician el nivel (vuelven los puntos y los nodos), y la meta
    // gana la partida. En la segunda vida cae encima del enemigo que patrulla (+5 y desaparece con sus hijos).
    const juego = estados.map((e) => e.juego), x = estados.map((e) => e.personajes[0].x);
    const reinicio = x.findIndex((v, i) => i > 0 && v < x[i - 1] - 200);
    assert.ok(reinicio > 0, 'muere y el nivel vuelve a empezar');
    assert.ok(juego[reinicio - 1].puntos > 0 && juego[reinicio].puntos === 0 && juego[reinicio].nodos === juego[0].nodos);
    const pinchos = estados.findIndex((e, i) => i > 0 && e.personajes[0].vy === -500);
    assert.ok(pinchos > 0 && reinicio - pinchos >= 24, `el reinicio espera 0,4 s tras los pinchos (pinchos ${pinchos}, reinicio ${reinicio})`);
    assert.deepEqual(juego.at(-1), { puntos: 9, estado: 1, nodos: juego[0].nodos - 15 });
    assert.equal(juego.findIndex((j) => j.estado === 1), 928);
  } finally {
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('juego 2D nativo: el enemigo patrulla igual que en Falcon', { skip: motivo, timeout: 300000 }, async () => {
  // Anda a la izquierda hasta la roca, se da la vuelta una sola vez y vuelve, igual en los dos.
  const nivel = nivelPlataformas;
  const carpeta = mkdtempSync(join(tmpdir(), 'falcon-nativo-2d-'));
  try {
    const exe = await compilarNativo2d(rutas, join(carpeta, 'falcon-2d.exe'), nivel);
    const estados = await comparar(exe, expandirGuion('a'), 300, nivel);
    const ex = estados.map((e) => e.personajes[1].x);
    const vuelta = ex.findIndex((v, i) => i > 0 && v > ex[i - 1]);
    assert.ok(ex[0] > 1690 && vuelta > 200 && ex[vuelta - 1] < 1400, `anda a la izquierda y se da la vuelta en la roca (paso ${vuelta}, x ${ex[vuelta - 1]})`);
    assert.ok(estados.slice(vuelta).every((e) => e.personajes[1].suelo), 'sin caerse');
    assert.ok(ex.slice(vuelta + 1).every((v, i) => v >= ex[vuelta + i]), 'tras la vuelta sigue a la derecha, sin vibrar');
  } finally {
    rmSync(carpeta, { recursive: true, force: true, maxRetries: 5 });
  }
});
