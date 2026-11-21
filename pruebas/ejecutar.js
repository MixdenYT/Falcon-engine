// Ejecuta todas las pruebas *.test.js de esta carpeta.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(aqui).filter(f => f.endsWith('.test.js')).sort()) {
  // Un archivo que falla al cargarse no debe impedir que se ejecuten los siguientes.
  try { await import(pathToFileURL(join(aqui, f)).href); }
  catch (e) { console.error(`✖ ${f} no se pudo cargar:`, e); process.exitCode = 1; }
}
