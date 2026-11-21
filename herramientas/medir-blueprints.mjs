// Mide compilar todos los Blueprints que existen (plantillas, Academia, CQB) con el compilador de Blueprints
// (en Ara, src/motor/blueprints-ara.js, aplanado incluido). El de JS con el que se comparaba ya no existe: las
// cifras de entonces están en docs/BENCHMARKS.md.
// Uso: node herramientas/medir-blueprints.mjs [vueltas]   (por defecto 200, tras 20 de calentamiento)
import { cargarCompiladorBlueprints, compilarBlueprint } from '../src/motor/blueprints-ara.js';
import { corpusBlueprints } from '../pruebas/corpus-blueprints.js';

const VUELTAS = Number(process.argv[2]) || 200;
const t0 = performance.now();
await cargarCompiladorBlueprints();
const carga = performance.now() - t0;
const corpus = await corpusBlueprints();

/** ms por vuelta (todos los Blueprints una vez). */
function medir(compilar) {
  for (let i = 0; i < 20; i++) for (const [ruta, bp] of corpus) compilar(bp, ruta);
  const t = performance.now();
  for (let i = 0; i < VUELTAS; i++) for (const [ruta, bp] of corpus) compilar(bp, ruta);
  return (performance.now() - t) / VUELTAS;
}

console.log(`Node ${process.version}, ${corpus.length} Blueprints, ${VUELTAS} vueltas; cargar blueprints.wasm: ${carga.toFixed(1)} ms`);
for (let k = 0; k < 3; k++) {
  console.log(`ms por vuelta: ${medir(compilarBlueprint).toFixed(2)}`);
}
