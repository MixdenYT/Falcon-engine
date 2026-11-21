// El juego 2D nativo (examples/native-2d) da lo mismo, bit a bit y en cada paso, que la ruta wasm de Falcon: el mismo
// nivel, la misma entrada guionizada y la misma física (src/motor/ara/fisica2d.ara, compilada a wasm y a x86-64).
// Necesita Windows y el compilador de Ara (ARA_DIR / ARA, ver herramientas/escena-nativa-2d.mjs); si no, se salta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './dom.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';
import { rutasAra, compilarNativo2d, mundoPlataformas, pasoFalcon, estadoFalcon, leerEstadoNativo } from '../herramientas/escena-nativa-2d.mjs';

const PASOS = 900;
const rutas = rutasAra();
const motivo = rutas ? false : 'falta el compilador de Ara para Windows x64 (ARA_DIR / ARA) o no es Windows: no se prueba el .exe nativo';
if (motivo) console.warn(`⚠ nativo-2d: ${motivo}`);

test('juego 2D nativo (.exe) = ruta wasm de Falcon, bit a bit en cada paso', { skip: motivo, timeout: 120000 }, async () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'falcon-nativo-2d-'));
  try {
    const exe = compilarNativo2d(rutas, join(carpeta, 'falcon-2d.exe'));
    const salida = execFileSync(exe, { env: { ...process.env, FALCON_PASOS: String(PASOS), FALCON_TRAZA: '1' }, encoding: 'utf8', maxBuffer: 64 << 20 });
    const { pasos } = leerEstadoNativo(salida);
    assert.equal(pasos.size, PASOS);

    const m = mundoPlataformas(await nucleoAra());
    const suelos = new Set();
    let pares = 0, paredes = 0;
    for (let i = 0; i < PASOS; i++) {
      pasoFalcon(m, i);
      const a = estadoFalcon(m), b = pasos.get(i);
      assert.equal(b.personajes.length, a.personajes.length, `paso ${i}: personajes`);
      a.personajes.forEach((p, k) => {
        for (const c in p) assert.ok(Object.is(p[c], b.personajes[k][c]), `paso ${i}, nodo ${p.nodo}.${c}: wasm ${p[c]} y nativo ${b.personajes[k][c]}`);
      });
      assert.deepEqual(b.pares, a.pares, `paso ${i}: pares de contactos2d`);
      const j = m.todos().find((n) => n.nombre === 'Jugador');
      if (j._nodoSuelo) suelos.add(j._nodoSuelo.tipo);
      pares += a.pares.length;
      paredes += j.enPared;
    }
    // El guion cubre algo: suelo de mosaicos y plataformas, paredes y contactos con monedas.
    assert.deepEqual([...suelos].sort(), ['Mosaicos', 'Plataforma']);
    assert.ok(pares > 0 && paredes > 0, `pares ${pares}, paredes ${paredes}`);
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});
