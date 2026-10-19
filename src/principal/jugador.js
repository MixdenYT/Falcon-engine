// Proceso principal de un juego exportado con Falcon Engine.
// Abre una ventana normal con el reproductor y el proyecto incluido en resources/app/juego.

const { app, BrowserWindow, ipcMain, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const RAIZ = path.resolve(__dirname, '..', '..');
const JUEGO = path.join(RAIZ, 'juego');
let datos = {};
try { datos = JSON.parse(fs.readFileSync(path.join(JUEGO, 'proyecto.falcon'), 'utf8')); } catch {}
const NOMBRE = datos.nombre || 'Juego';
app.setName(NOMBRE);

protocol.registerSchemesAsPrivileged([
  { scheme: 'falcon', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const TIPOS = {
  '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml',
};

// Solo se sirven archivos de la propia aplicación.
function dentro(ruta) { const r = path.resolve(ruta); return r === RAIZ || r.startsWith(RAIZ + path.sep); }

function registrarProtocolo() {
  protocol.handle('falcon', async (req) => {
    const url = new URL(req.url);
    const p = decodeURIComponent(url.pathname);
    let ruta = url.host === 'app' ? path.join(RAIZ, p) : (process.platform === 'win32' ? p.replace(/^\//, '') : p);
    if (!dentro(ruta)) return new Response('Prohibido', { status: 403 });
    try {
      const r = await net.fetch(pathToFileURL(ruta).toString());
      const t = TIPOS[path.extname(ruta).toLowerCase()];
      if (!t) return r;
      const h = new Headers(r.headers); h.set('Content-Type', t);
      return new Response(r.body, { status: r.status, headers: h });
    } catch { return new Response('No encontrado', { status: 404 }); }
  });
}

// IPC mínimo que usa el reproductor.
ipcMain.handle('fs:leer', async (e, ruta, cod = 'utf8') => {
  if (!dentro(ruta)) return { ok: false, error: 'Fuera del juego' };
  try { const d = await fsp.readFile(ruta, cod === 'binario' ? null : cod); return { ok: true, datos: cod === 'binario' ? new Uint8Array(d) : d }; }
  catch (err) { return { ok: false, error: err.message, codigo: err.code }; }
});
ipcMain.handle('fs:existe', (e, ruta) => dentro(ruta) && fs.existsSync(ruta));
ipcMain.handle('fs:listar', async (e, ruta, recursivo) => {
  const salida = [];
  async function rec(dir, rel) {
    let es = [];
    try { es = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of es) {
      if (d.name.startsWith('.')) continue;
      const abs = path.join(dir, d.name), r = rel ? rel + '/' + d.name : d.name;
      salida.push({ nombre: d.name, ruta: abs.split(path.sep).join('/'), rel: r, carpeta: d.isDirectory(), tamano: 0 });
      if (recursivo && d.isDirectory()) await rec(abs, r);
    }
  }
  if (dentro(ruta)) await rec(ruta, '');
  return salida;
});
ipcMain.handle('app:archivo-proyecto', () => path.join(JUEGO, 'proyecto.falcon').split(path.sep).join('/'));
ipcMain.handle('app:info', () => ({ version: datos.exportacion?.version || '1.0.0', plataforma: process.platform, arquitectura: process.arch }));
ipcMain.handle('app:datos', () => ({ ajustes: { mostrarFps: false } }));
ipcMain.handle('ventana:maximizada', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);
ipcMain.on('ventana:titulo', (e, t) => BrowserWindow.fromWebContents(e.sender)?.setTitle(t));
ipcMain.on('ventana:pantalla-completa', (e) => { const v = BrowserWindow.fromWebContents(e.sender); if (v) v.setFullScreen(!v.isFullScreen()); });
ipcMain.on('ventana:cerrar', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('ventana:minimizar', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('ventana:maximizar', (e) => { const v = BrowserWindow.fromWebContents(e.sender); if (v) v.isMaximized() ? v.unmaximize() : v.maximize(); });
ipcMain.on('juego:de', () => {});
ipcMain.handle('juego:captura', async (e) => {
  const v = BrowserWindow.fromWebContents(e.sender);
  const img = await v.webContents.capturePage();
  const dir = path.join(app.getPath('pictures'), NOMBRE);
  await fsp.mkdir(dir, { recursive: true });
  const f = path.join(dir, `captura-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await fsp.writeFile(f, img.toPNG());
  return f;
});

app.whenReady().then(() => {
  registrarProtocolo();
  const [ancho, alto] = datos.resolucion || [1280, 720];
  const v = new BrowserWindow({
    width: ancho, height: alto, useContentSize: true, backgroundColor: '#000000', title: NOMBRE,
    icon: path.join(RAIZ, 'recursos', 'icono.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  v.setMenu(null);
  // F10 es una tecla de sistema en Windows (activa el menú de la ventana) y a veces no llega a la
  // página: se recoge aquí y se le pasa a la página como una pulsación normal.
  v.webContents.on('before-input-event', (ev, input) => {
    if (input.key !== 'F10' || input.type !== 'keyDown') return;
    ev.preventDefault();
    v.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', code: 'F10' }))").catch(() => {});
  });
  v.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  const q = new URLSearchParams({ modo: 'exportado', proyecto: JUEGO.split(path.sep).join('/') });
  v.loadURL(`falcon://app/src/juego/juego.html?${q}`);
  // Captura automática para pruebas: FALCON_CAPTURA=ruta.png
  if (process.env.FALCON_CAPTURA) setTimeout(async () => { fs.writeFileSync(process.env.FALCON_CAPTURA, (await v.webContents.capturePage()).toPNG()); app.quit(); }, Number(process.env.FALCON_ESPERA || 5000));
  // Mediciones para pruebas: FALCON_GUION=guion.js ejecuta el guion en el juego (puede devolver una
  // promesa) y guarda lo que devuelve en FALCON_GUION_SALIDA (JSON); después cierra el juego.
  if (process.env.FALCON_GUION) v.webContents.once('did-finish-load', () => setTimeout(async () => {
    let r;
    try { r = await v.webContents.executeJavaScript(fs.readFileSync(process.env.FALCON_GUION, 'utf8')); } catch (err) { r = { error: String(err && err.message || err) }; }
    if (process.env.FALCON_GUION_SALIDA) fs.writeFileSync(process.env.FALCON_GUION_SALIDA, JSON.stringify(r, null, 1));
    app.quit();
  }, Number(process.env.FALCON_ESPERA || 3000)));
});
app.on('window-all-closed', () => app.quit());
