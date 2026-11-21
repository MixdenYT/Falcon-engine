// El compilador de Blueprints (escrito en Ara: src/motor/ara-blueprints/blueprints.ara) da, carácter a carácter, lo
// que guarda pruebas/blueprints-esperado.json: el texto de Ara, los errores y avisos (mensaje y bloque) y las líneas
// por bloque de todos los Blueprints que existen, de casos límite y de 608 variaciones al azar (muchas con errores).
// La referencia la generó el compilador de JS que había antes (commit 1a00017, retirado después). Si cambias a
// propósito una plantilla o el compilador: `FIJAR=1 node pruebas/blueprints-ara.test.js` y revisa el diff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NODOS } from '../src/motor/blueprints.js';
import { cargarCompiladorBlueprints, compilarBlueprint } from '../src/motor/blueprints-ara.js';
import { compilarBlueprintsAra } from '../herramientas/compilar-blueprints-ara.mjs';
import { corpusBlueprints } from './corpus-blueprints.js';

await cargarCompiladorBlueprints();
const corpus = await corpusBlueprints();
const REFERENCIA = new URL('./blueprints-esperado.json', import.meta.url);
// JSON, como en el archivo de referencia (sin `undefined`; NaN como null).
const resultado = (bp, ruta) => JSON.parse(JSON.stringify(compilarBlueprint(structuredClone(bp), ruta)));
const huella = (r) => createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 16);

// Casos límite: base desconocida, nombres reservados, números en notación científica, textos con escapes, vacíos.
const bp = (extra) => ({ formato: 'falcon-blueprint', version: 1, nombre: 'x', base: 'Personaje2D', variables: [], funciones: [], grafos: { eventos: { nodos: [], conexiones: [], comentarios: [] } }, ...extra });
const nodos = (...ns) => ({ eventos: { nodos: ns, conexiones: [], comentarios: [] } });
const limites = [
  bp({}), bp({ base: 'Nada' }), bp({ base: undefined }), bp({ grafos: {} }),
  bp({ variables: [{ nombre: 'si', valor: 1 }, { nombre: '1x', valor: 1 }, { valor: 2 }, { nombre: 'ñu', tipo: 'objeto', valor: 'Jugador' }, { nombre: 'l', tipo: 'lista', exportar: true }] }),
  bp({ variables: [1e21, 1e-7, 1.5e-7, 5e-5, 1e16, -0, 0.1 + 0.2, 123456789.125, 1.5e300, -2.5, '007', ' 4 ', NaN].map((valor, i) => ({ nombre: 'v' + i, tipo: i % 2 ? 'entero' : 'decimal', valor })) }),
  bp({ variables: ['{a}"\n\t\\\x01', '', null, true, 'ñandú 𐐨'].map((valor, i) => ({ nombre: 't' + i, tipo: 'texto', valor })) }),
  bp({ variables: [{ nombre: 'a\x1fb\x1b0', valor: 'x\x1f\x1b2\x1e' }, { nombre: 'c', tipo: 'texto', valor: '\x1b\x1f\x1b' }] }), // los separadores del texto plano
  bp({ funciones: [{ nombre: 'f', params:[{ nombre: 'a' }, { nombre: 'si' }] }, { nombre: 'yo' }] }),
  bp({ grafos: nodos({ id: 'e', def: 'ev_pulsar', valores: { accion: 'a"b{' }, x: 0, y: 0 }, { id: 'f', def: 'ev_empieza', x: 5, y: NaN }, { id: 'g', def: 'ev_empieza', x: -1, y: 0 }) }),
].map((c) => ['blueprints/x.bp', c]);
for (const ruta of ['blueprints/a b.bp', 'b\\c.BP', '', '9.bp', 'blueprints/𐐨x.bp', 'ßeta.bp']) limites.push([ruta, bp({})]);

// Variaciones al azar de cada Blueprint (cables, valores, tipos, nombres, bloques), con semilla fija.
function variaciones() {
  let s = 20261121;
  const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const elige = (a) => a[Math.floor(r() * a.length)];
  const VALORES = [null, undefined, true, false, 0, -3, 2.5, 7, '12', ' -4.50 ', '007', 'abc', '', 'si', 'x.y', 'en_el_suelo', 'vida', 'mover', 1e21, 1e-7, -0, 0.1 + 0.2, '{a}"\n\t\\\x01', 'ñandú', '==', '<', '3', 'Jugador', 1e16, 5e-5, ['x'], {}];
  const PINES = ['entrada', 'salida', 'a', 'b', 'c', 'valor', 'resultado', 'condicion', 'verdadero', 'falso', 'cuerpo', 'indice', 'delta', 'otro', 'objeto', 'miembro', 'x', 'y', 'datos', 'nodo', 'pulsada', 'primero', 'despues', 'cantidad'];
  const NOMBRES = ['vida', 'puntos', 'si', '1x', '', 'ñu', 'yo', 'x', 'objetivo', undefined, 'a b', 'velocidad', 'texto'];
  const TIPOS = ['decimal', 'entero', 'texto', 'bool', 'objeto', 'lista', 'cualquiera', undefined, 'raro'];
  const mutar = (bp) => {
    const g = elige(Object.values(bp.grafos)), n = elige(g.nodos), id = () => (elige(g.nodos) || {}).id;
    switch (Math.floor(r() * 14)) {
      case 0: g.conexiones.splice(Math.floor(r() * g.conexiones.length), 1); break;
      case 1: { const c = elige(g.conexiones); if (c) c[elige(['de', 'a'])] = id(); break; }
      case 2: { const c = elige(g.conexiones); if (c) c[elige(['salida', 'entrada'])] = elige(PINES); break; }
      case 3: case 4: if (n) { n.valores ||= {}; n.valores[elige([...Object.keys(n.valores), ...PINES])] = elige(VALORES); } break;
      case 5: if (n) n.def = elige([...Object.keys(NODOS), 'nada']); break;
      case 6: { const v = elige(bp.variables); if (!v) bp.variables.push({ nombre: elige(NOMBRES), tipo: elige(TIPOS), valor: elige(VALORES), exportar: r() < 0.5 }); else { const k = elige(['nombre', 'tipo', 'valor', 'exportar']); v[k] = k === 'nombre' ? elige(NOMBRES) : k === 'tipo' ? elige(TIPOS) : elige(VALORES); } break; }
      case 7: if (n) n[elige(['variable', 'funcion'])] = elige([...NOMBRES, ...bp.variables.map((v) => v.nombre), ...bp.funciones.map((f) => f.nombre)]); break;
      case 8: { const f = elige(bp.funciones); if (f && r() < 0.6) (f.params ||= []).push({ nombre: elige(NOMBRES), tipo: elige(TIPOS) }); else bp.funciones.push({ nombre: elige(NOMBRES), params: [] }); break; }
      case 9: bp.base = elige(['Sprite', 'Nada', '', undefined, 'Personaje3D', 'Nodo', 'Area2D']); break;
      case 10: if (n) n.id = id(); break;
      case 11: if (n) g.conexiones.push({ de: id(), salida: elige(PINES), a: id(), entrada: elige(PINES) }); break;
      case 12: if (n) g.nodos.splice(g.nodos.indexOf(n), 1); break;
      case 13: if (n) { n.x = elige([0, 10, NaN, undefined, '5', 100]); n.y = elige([0, 10, NaN, undefined, '5', 100]); } break;
    }
  };
  const casos = [];
  for (let ronda = 0; ronda < 8; ronda++) {
    for (const [ruta, original] of corpus) {
      const bp = structuredClone(original);
      bp.variables ||= []; bp.funciones ||= [];
      for (let k = 1 + Math.floor(r() * 6); k > 0; k--) mutar(bp);
      casos.push([`${ruta}, ronda ${ronda}`, ruta, bp]);
    }
  }
  return casos;
}

const obtenido = {
  corpus: corpus.map(([ruta, bp]) => [ruta, resultado(bp, ruta)]),
  limites: limites.map(([ruta, bp]) => [ruta, resultado(bp, ruta)]),
  // Solo la huella de cada resultado: los 608 enteros harían la referencia diez veces más grande.
  variaciones: variaciones().map(([nombre, ruta, bp]) => { const r = resultado(bp, ruta); return [nombre, r.errores.length, huella(r)]; }),
};
if (process.env.FIJAR) await writeFile(REFERENCIA, JSON.stringify(obtenido, null, 1) + '\n');
const esperado = JSON.parse(await readFile(REFERENCIA, 'utf8'));

test('blueprints.wasm corresponde a los .ara', async () => {
  const guardado = await readFile(new URL('../src/motor/ara-blueprints/blueprints.wasm', import.meta.url));
  assert.ok(Buffer.from(await compilarBlueprintsAra()).equals(guardado), 'ejecuta node herramientas/compilar-blueprints-ara.mjs');
});

test('todos los Blueprints que existen (plantillas, Academia, CQB): el Ara de referencia, carácter a carácter', () => {
  assert.ok(corpus.length >= 76, `solo ${corpus.length} Blueprints`);
  for (const id of Object.keys(NODOS)) assert.ok(corpus.some(([, bp]) => Object.values(bp.grafos).some((g) => g.nodos.some((n) => n.def === id))), id);
  assert.deepEqual(obtenido.corpus.map(([ruta]) => ruta), esperado.corpus.map(([ruta]) => ruta), 'cambió la lista de Blueprints');
  obtenido.corpus.forEach(([ruta, r], i) => assert.deepEqual(r, esperado.corpus[i][1], ruta));
});

test('casos límite: base desconocida, nombres reservados, números en notación científica, textos con escapes, vacíos', () => {
  obtenido.limites.forEach(([ruta, r], i) => assert.deepEqual(r, esperado.limites[i][1], `${ruta} ${JSON.stringify(limites[i][1])}`));
});

test('variaciones al azar de cada Blueprint: los mismos errores y código que la referencia', () => {
  assert.equal(obtenido.variaciones.length, esperado.variaciones.length);
  obtenido.variaciones.forEach((v, i) => assert.deepEqual(v, esperado.variaciones[i], v[0]));
  const conErrores = obtenido.variaciones.filter(([, n]) => n > 0).length;
  assert.ok(conErrores > obtenido.variaciones.length / 5, `solo ${conErrores} de ${obtenido.variaciones.length} variaciones con errores`);
});
