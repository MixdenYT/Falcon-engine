// Prueba de integración real del renderizador en Chromium + SwiftShader (WebGL).
// Requiere CHROME_PATH y playwright-core, instalados por GitHub Actions.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.css': 'text/css; charset=utf-8' };
const servidor = createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const archivo = resolve(raiz, '.' + ruta);
    if (archivo !== raiz && !archivo.startsWith(raiz + sep)) { res.writeHead(403).end(); return; }
    const contenido = await readFile(archivo);
    res.writeHead(200, { 'content-type': tipos[extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(contenido);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
});

let navegador;
try {
  await new Promise((resolveListen, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolveListen);
  });
  const puerto = servidor.address().port;
  navegador = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const pagina = await navegador.newPage();
  const fallosConsola = [];
  pagina.on('pageerror', error => fallosConsola.push(error.message));
  pagina.on('console', mensaje => { if (mensaje.type() === 'error') fallosConsola.push(mensaje.text()); });
  // La consola no siempre incluye la URL de un 404; capturamos la respuesta para localizar el recurso exacto.
  pagina.on('response', respuesta => {
    if (respuesta.status() >= 400) fallosConsola.push(`HTTP ${respuesta.status()} ${respuesta.url()}`);
  });
  await pagina.goto(`http://127.0.0.1:${puerto}/pruebas/webgl.html`, { waitUntil: 'load' });
  await pagina.waitForFunction(() => window.__FALCON_WEBGL_RESULTADO__ !== undefined, { timeout: 30000 });
  const resultado = await pagina.evaluate(() => window.__FALCON_WEBGL_RESULTADO__);
  assert.deepEqual(recursosNoEncontrados, [], 'La prueba solicitó recursos que no existen: ' + recursosNoEncontrados.join(', '));
  assert.equal(fallosConsola.length, 0, 'La página WebGL produjo errores de consola o HTTP: ' + fallosConsola.join('\n'));
  assert.equal(resultado.ok, true, resultado.errores.join('\\n') || JSON.stringify(resultado));
  assert.equal(resultado.fotogramas, 6);
  assert.ok(resultado.llamadasDibujo > 0, 'No se registraron llamadas de dibujo');
  assert.ok(resultado.triangulos > 0, 'No se registraron triángulos');
  assert.ok(resultado.pixelesRenderizados > 0, 'La imagen renderizada solo contiene el color de borrado');
  console.log('WebGL real: correcto');
  console.log(JSON.stringify(resultado, null, 2));
} finally {
  await navegador?.close();
  await new Promise(resolveClose => servidor.close(resolveClose));
}
