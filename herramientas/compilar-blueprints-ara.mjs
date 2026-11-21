// Compila el compilador de Blueprints escrito en Ara (src/motor/ara-blueprints/*.ara) a
// src/motor/ara-blueprints/blueprints.wasm. Como nucleo.wasm, ese .wasm va en el repositorio: el motor lo carga sin
// el compilador de Ara (src/motor/blueprints-ara.js).
// Uso: node herramientas/compilar-blueprints-ara.mjs [--comprobar]
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import '../pruebas/dom.js';
import { compiladorAra } from '../src/ara/puente.js';

const carpeta = fileURLToPath(new URL('../src/motor/ara-blueprints/', import.meta.url));
const destino = carpeta + 'blueprints.wasm';

export async function compilarBlueprintsAra() {
  const { compilador } = await compiladorAra();
  const nombres = (await readdir(carpeta)).filter((n) => n.endsWith('.ara')).sort();
  // Sin CR: el .wasm no depende de cómo saque git los finales de línea (CRLF en Windows).
  const archivos = await Promise.all(nombres.map(async (n) => [n, (await readFile(carpeta + n, 'utf8')).replace(/\r\n/g, '\n')]));
  const r = compilador.compilar(archivos);
  if (!r.ok) {
    const e = r.errores[0];
    throw new Error(`${e.archivo}:${e.linea}:${e.columna}: ${e.mensaje}${e.nota ? ` (${e.nota})` : ''}`);
  }
  return r.modulo;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const modulo = await compilarBlueprintsAra();
  if (process.argv.includes('--comprobar')) {
    const guardado = new Uint8Array(await readFile(destino).catch(() => new Uint8Array()));
    if (Buffer.compare(Buffer.from(guardado), Buffer.from(modulo)) !== 0) {
      console.error('src/motor/ara-blueprints/blueprints.wasm no corresponde a los .ara: ejecuta node herramientas/compilar-blueprints-ara.mjs');
      process.exit(1);
    }
    console.log('blueprints.wasm al día');
  } else {
    await writeFile(destino, modulo);
    console.log(`blueprints.wasm: ${modulo.length} bytes`);
  }
}
