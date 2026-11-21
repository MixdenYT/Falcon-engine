// Un juego exportado dentro del proyecto (<proyecto>/exportado, el destino por defecto) no se mezcla con el juego:
// Mundo.iniciar no recoge sus .ara (si no, «el tipo `Nodo` ya está definido» por su src/ara/motor.ara).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './dom.js';
import { Mundo, OMITIR_PROYECTO } from '../src/motor/mundo.js';

test('iniciar omite exportado/, capturas/... y compila solo los scripts del juego', async () => {
  const textos = {
    'scripts/jugador.ara': 'func empieza():\n    imprimir("hola")\n',
    'exportado/Juego-win32-x64/resources/app/src/ara/motor.ara': 'externa tipo Nodo\n',
    'exportado/Juego-win32-x64/resources/app/juego/escenas/nivel.fscn': '{}',
    'capturas/c.agl': 'x',
  };
  const proyecto = {
    datos: { nombre: 'Prueba', acciones: {} },
    listar: async () => Object.keys(textos).map((rel) => ({ rel, carpeta: false })),
    leer: async (rel) => textos[rel],
  };
  const anterior = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const m = new Mundo({ proyecto, lienzo: { addEventListener() {}, removeEventListener() {} } });
    await m.iniciar();
    assert.deepEqual(m.archivos, ['scripts/jugador.ara']);
    assert.deepEqual([...m.textos.keys()], ['scripts/jugador.ara']);
    assert.ok(m.programaAra, 'los scripts del juego compilan');
  } finally { globalThis.window = anterior; }
});

test('OMITIR_PROYECTO de mundo.js es el mismo que el de exportar.js', async () => {
  const fuente = await readFile(new URL('../src/principal/exportar.js', import.meta.url), 'utf8');
  const lista = /const OMITIR_PROYECTO = new Set\((\[[^\]]*\])\)/.exec(fuente)[1];
  assert.deepEqual([...OMITIR_PROYECTO], JSON.parse(lista.replace(/'/g, '"')));
});
