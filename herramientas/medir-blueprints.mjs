// Mide compilar todos los Blueprints que existen (plantillas, Academia, CQB) con el compilador de JS
// (`compilarBlueprint`) y con el de Ara (src/motor/blueprints-ara.js, aplanado incluido).
// Uso: node herramientas/medir-blueprints.mjs [vueltas]   (por defecto 200, tras 20 de calentamiento)
import { compilarBlueprint } from '../src/motor/blueprints.js';
import { compiladorBlueprintsAra } from '../src/motor/blueprints-ara.js';
import { corpusBlueprints } from '../pruebas/corpus-blueprints.js';

const VUELTAS = Number(process.argv[2]) || 200;
const corpus = await corpusBlueprints();
const t0 = performance.now();
const ara = await compiladorBlueprintsAra();
const carga = performance.now() - t0;

/** ms por vuelta (todos los Blueprints una vez). */
function medir(compilar) {
  for (let i = 0; i < 20; i++) for (const [ruta, bp] of corpus) compilar(bp, ruta);
  const t = performance.now();
  for (let i = 0; i < VUELTAS; i++) for (const [ruta, bp] of corpus) compilar(bp, ruta);
  return (performance.now() - t) / VUELTAS;
}

console.log(`Node ${process.version}, ${corpus.length} Blueprints, ${VUELTAS} vueltas; cargar blueprints.wasm: ${carga.toFixed(1)} ms`);
for (let k = 0; k < 3; k++) {
  const js = medir(compilarBlueprint), a = medir((bp, ruta) => ara.compilar(bp, ruta));
  console.log(`ms por vuelta: JS ${js.toFixed(2)} · Ara ${a.toFixed(2)} (${(js / a).toFixed(2)}×)`);
}
