// Línea base gráfica (GFX-00): mide las escenas patrón en Chromium y compara cada captura con su referencia.
//
//   node herramientas/linea-base-grafica.mjs                 mide y compara; sale con 1 si algo no coincide
//   node herramientas/linea-base-grafica.mjs --actualizar    guarda las capturas como nuevas referencias
//   node herramientas/linea-base-grafica.mjs S02 S03         solo esas escenas
//
// Variables: CHROME_PATH (navegador; por defecto el de Playwright), LINEA_BASE_GPU=1 (usar la GPU real en
// vez de SwiftShader), LINEA_BASE_SALIDA (carpeta de resultados; por defecto pruebas/linea-base/salida).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const carpeta = join(raiz, 'pruebas/linea-base');
const salida = process.env.LINEA_BASE_SALIDA || join(carpeta, 'salida');
const args = process.argv.slice(2);
const actualizar = args.includes('--actualizar');
const { ESCENAS } = await import(join(carpeta, 'escenas.js'));
const ids = args.filter(a => !a.startsWith('--'));
const lista = ids.length ? ids : Object.keys(ESCENAS);

// playwright-core en CI; playwright si está instalado a nivel global (NODE_PATH).
const requerir = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright-core', 'playwright']) { try { ({ chromium } = requerir(m)); break; } catch {} }
if (!chromium) { console.error('Falta playwright-core (npm install --no-save playwright-core).'); process.exit(2); }

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.wasm': 'application/wasm' };
const servidor = createServer(async (req, res) => {
  let archivo;
  try { archivo = resolve(raiz, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { return res.writeHead(400).end(); }
  if (!archivo.startsWith(raiz + sep)) return res.writeHead(403).end();
  try { res.writeHead(200, { 'content-type': tipos[extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(await readFile(archivo)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${servidor.address().port}`;

const gpuReal = process.env.LINEA_BASE_GPU === '1';
const navegador = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl', ...(gpuReal ? [] : ['--use-gl=angle', '--use-angle=swiftshader']),
    '--enable-features=WebGLDraftExtensions', '--enable-privileged-webgl-extensions', '--force-device-scale-factor=1'],
});

async function ejecutar(id, extra = '') {
  const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
  const fallos = [];
  pagina.on('pageerror', e => fallos.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error') fallos.push(m.text()); });
  const ref = actualizar ? '' : `&referencia=/pruebas/linea-base/referencias/${id}.png`;
  await pagina.goto(`${base}/pruebas/linea-base/pagina.html?escena=${id}${ref}${extra}`);
  await pagina.waitForFunction(() => window.__LINEA_BASE__, null, { timeout: 180000 });
  const r = await pagina.evaluate(() => window.__LINEA_BASE__);
  await pagina.close();
  if (fallos.length) r.errores.push(...fallos);
  return r;
}

const resultados = { fecha: new Date().toISOString(), commit: null, plataforma: { so: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, nucleos: os.cpus().length, node: process.version, navegador: navegador.version(), rasterizador: gpuReal ? 'GPU del sistema' : 'SwiftShader (CPU)' }, escenas: {} };
try { resultados.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8' }).trim(); } catch {}
let fallidas = 0;
await mkdir(salida, { recursive: true });
try {
  for (const id of lista) {
    const r = await ejecutar(id);
    const png = Buffer.from(r.captura.split(',')[1], 'base64');
    delete r.captura;
    await writeFile(join(salida, `${id}.png`), png);
    const bien = r.ok && !r.errores.length && (actualizar || r.comparacion?.estado === 'IGUAL');
    // Una escena con errores no se convierte en referencia.
    if (actualizar && bien) await writeFile(join(carpeta, 'referencias', `${id}.png`), png);
    if (!bien) fallidas++;
    resultados.escenas[id] = r;
    console.log(`${bien ? 'ok' : 'FALLO'} ${id} ${r.nombre}: CPU media ${r.cpuMs?.media} ms, p95 ${r.cpuMs?.p95}, p99 ${r.cpuMs?.p99}; GPU ${typeof r.gpuMs === 'string' ? r.gpuMs : r.gpuMs?.media + ' ms'}; dibujos ${r.render?.llamadasDibujo}; ${r.comparacion ? r.comparacion.estado + ' (' + r.comparacion.pixelesDistintos + ' px)' : 'referencia guardada'}`);
    if (r.errores.length) console.log(r.errores.join('\n'));
  }
  // Un cambio deliberado de material tiene que notarse; si no, la comparación no sirve.
  if (!actualizar && lista.includes('S02')) {
    const r = await ejecutar('S02', '&alterar=1');
    const detectado = r.comparacion?.estado === 'DISTINTA';
    if (!detectado) fallidas++;
    resultados.cambioDeliberado = { escena: 'S02', detectado, comparacion: r.comparacion };
    console.log(`${detectado ? 'ok' : 'FALLO'} cambio deliberado de material en S02: ${r.comparacion?.estado} (${r.comparacion?.pixelesDistintos} px)`);
  }
} finally {
  await navegador.close();
  servidor.close();
}
await writeFile(join(salida, 'resultados.json'), JSON.stringify(resultados, null, 2));
console.log(`Resultados en ${join(salida, 'resultados.json')}`);
assert.equal(fallidas, 0, `${fallidas} comprobaciones de la línea base fallaron`);
