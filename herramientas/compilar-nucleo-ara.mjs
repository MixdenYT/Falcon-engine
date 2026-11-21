// Compila el núcleo del motor escrito en Ara (src/motor/ara/*.ara) a src/motor/ara/nucleo.wasm.
// Ese .wasm va en el repositorio: el motor lo carga sin necesitar el compilador (los juegos exportados no lo llevan).
// Uso: node herramientas/compilar-nucleo-ara.mjs [--comprobar]
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import '../pruebas/dom.js';
import { compiladorAra } from '../src/ara/puente.js';

const carpeta = fileURLToPath(new URL('../src/motor/ara/', import.meta.url));
const destino = carpeta + 'nucleo.wasm';

export async function compilarNucleo() {
  const { compilador } = await compiladorAra();
  const nombres = (await readdir(carpeta)).filter((n) => n.endsWith('.ara')).sort();
  const archivos = await Promise.all(nombres.map(async (n) => [n, await readFile(carpeta + n, 'utf8')]));
  const r = compilador.compilar(archivos);
  if (!r.ok) {
    const e = r.errores[0];
    throw new Error(`${e.archivo}:${e.linea}:${e.columna}: ${e.mensaje}${e.nota ? ` (${e.nota})` : ''}`);
  }
  return r.modulo;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const modulo = await compilarNucleo();
  if (process.argv.includes('--comprobar')) {
    const guardado = new Uint8Array(await readFile(destino).catch(() => new Uint8Array()));
    if (Buffer.compare(Buffer.from(guardado), Buffer.from(modulo)) !== 0) {
      console.error('src/motor/ara/nucleo.wasm no corresponde a los .ara: ejecuta node herramientas/compilar-nucleo-ara.mjs');
      process.exit(1);
    }
    console.log('nucleo.wasm al día');
  } else {
    await writeFile(destino, modulo);
    console.log(`nucleo.wasm: ${modulo.length} bytes`);
  }
}
