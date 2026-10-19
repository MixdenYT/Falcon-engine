// Proceso principal de Falcon Engine (Electron).
// Gestiona ventanas, acceso a archivos, la ventana de prueba del juego y la exportación.

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, screen, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { exportarJuego } = require('./exportar.js');
const { crearActualizaciones } = require('./actualizaciones.js');

const RAIZ_APP = path.resolve(__dirname, '..', '..');
const ICONO = path.join(RAIZ_APP, 'recursos', 'icono.png');
const VERSION = require(path.join(RAIZ_APP, 'package.json')).version;

protocol.registerSchemesAsPrivileged([
  { scheme: 'falcon', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// ---- Argumentos (modo captura para pruebas automáticas) ----
const args = {};
for (const a of process.argv.slice(1)) {
  const m = /^--([\w-]+)=(.*)$/.exec(a);
  if (m) args[m[1]] = m[2];
}
// Las pruebas del paquete no comparten ajustes ni proyectos con una sesión de usuario.
if (args.captura && args['datos-prueba']) {
  fs.mkdirSync(path.resolve(args['datos-prueba']), { recursive: true });
  app.setPath('userData', path.resolve(args['datos-prueba']));
}

// ---- Datos persistentes del usuario ----
const RUTA_DATOS = () => path.join(app.getPath('userData'), 'falcon-datos.json');
function leerDatos() {
  try { return JSON.parse(fs.readFileSync(RUTA_DATOS(), 'utf8')); }
  catch { return { recientes: [], ajustes: {} }; }
}
function escribirDatos(d) {
  fs.mkdirSync(path.dirname(RUTA_DATOS()), { recursive: true });
  fs.writeFileSync(RUTA_DATOS(), JSON.stringify(d, null, 2));
}

// ---- Protocolo falcon:// ----
// falcon://app/<ruta>   → archivos de la aplicación
// falcon://fs/<ruta>    → archivos del disco (proyectos del usuario)
function registrarProtocolo() {
  protocol.handle('falcon', async (req) => {
    const url = new URL(req.url);
    let ruta;
    const p = decodeURIComponent(url.pathname);
    if (url.host === 'app') ruta = path.join(RAIZ_APP, p);
    else if (url.host === 'fs') ruta = process.platform === 'win32' ? p.replace(/^\//, '') : p;
    else return new Response('No encontrado', { status: 404 });
    try {
      const r = await net.fetch(pathToFileURL(ruta).toString());
      const tipo = tipoMime(ruta);
      if (tipo) {
        const h = new Headers(r.headers);
        h.set('Content-Type', tipo);
        h.set('Cache-Control', 'no-cache');
        h.set('Access-Control-Allow-Origin', '*');
        return new Response(r.body, { status: r.status, headers: h });
      }
      return r;
    } catch {
      return new Response('No encontrado', { status: 404 });
    }
  });
}

function tipoMime(ruta) {
  const ext = path.extname(ruta).toLowerCase();
  return {
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  }[ext];
}

const urlApp = (rel, consulta = {}) => {
  const q = new URLSearchParams(consulta).toString();
  return `falcon://app/${rel}${q ? '?' + q : ''}`;
};

// ---- Ventanas ----
let ventanaPrincipal = null;
let sesionJuego = null; // { ventana, editor: webContents }

function crearVentana(opciones = {}) {
  const v = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680,
    frame: false, backgroundColor: '#050605', show: false, icon: ICONO,
    title: 'Falcon Engine',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
      spellcheck: false,
      backgroundThrottling: !args.captura,
      offscreen: !!args.captura,
    },
    ...opciones,
  });
  v.once('ready-to-show', () => { if (!args.captura) v.show(); });
  v.on('maximize', () => v.webContents.send('ventana:estado', { maximizada: true }));
  v.on('unmaximize', () => v.webContents.send('ventana:estado', { maximizada: false }));
  // F10 es una tecla de sistema en Windows (activa el menú de la ventana) y a veces no llega a la
  // página: se recoge aquí y se le pasa a la página como una pulsación normal.
  v.webContents.on('before-input-event', (ev, input) => {
    if (input.key !== 'F10' || input.type !== 'keyDown') return;
    ev.preventDefault();
    v.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', code: 'F10' }))").catch(() => {});
  });
  v.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // Evita que soltar un archivo en la ventana navegue fuera de la app.
  v.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('falcon://')) e.preventDefault(); });
  return v;
}

function abrirGestor() {
  if (!ventanaPrincipal) ventanaPrincipal = crearVentana();
  ventanaPrincipal.loadURL(urlApp('src/gestor/gestor.html'));
}

function abrirEditor(rutaProyecto) {
  if (!ventanaPrincipal) ventanaPrincipal = crearVentana();
  ventanaPrincipal.loadURL(urlApp('src/editor/editor.html', { proyecto: rutaProyecto }));
}

// ---- IPC: ventana ----
ipcMain.on('ventana:minimizar', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('ventana:maximizar', (e) => {
  const v = BrowserWindow.fromWebContents(e.sender);
  if (!v) return;
  v.isMaximized() ? v.unmaximize() : v.maximize();
});
ipcMain.on('ventana:cerrar', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle('ventana:maximizada', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);
ipcMain.on('ventana:titulo', (e, t) => BrowserWindow.fromWebContents(e.sender)?.setTitle(t));
ipcMain.on('ventana:enfocar-editor', () => { if (ventanaPrincipal) { if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore(); ventanaPrincipal.focus(); } });
ipcMain.on('ventana:pantalla-completa', (e) => {
  const v = BrowserWindow.fromWebContents(e.sender);
  if (v) v.setFullScreen(!v.isFullScreen());
});
ipcMain.on('ventana:tamano-contenido', (e, { ancho, alto }) => {
  const v = BrowserWindow.fromWebContents(e.sender);
  if (!v) return;
  if (v.isMaximized()) v.unmaximize();
  const area = screen.getDisplayMatching(v.getBounds()).workAreaSize;
  v.setContentSize(Math.min(ancho, area.width), Math.min(alto, area.height));
  v.center();
});

// ---- IPC: aplicación ----
ipcMain.handle('app:info', () => ({
  version: VERSION, plataforma: process.platform, arquitectura: process.arch,
  electron: process.versions.electron, raizApp: RAIZ_APP,
  documentos: app.getPath('documents'), inicio: app.getPath('home'),
  usuario: require('node:os').userInfo().username,
}));
ipcMain.handle('app:datos', () => leerDatos());
ipcMain.handle('app:guardar-datos', (e, d) => { escribirDatos(d); return true; });
ipcMain.on('app:abrir-proyecto', (e, ruta) => {
  const d = leerDatos();
  d.recientes = (d.recientes || []).filter(r => path.resolve(r.ruta) !== path.resolve(ruta));
  let info = {};
  try { info = JSON.parse(fs.readFileSync(archivoProyecto(ruta), 'utf8')); } catch {}
  d.recientes.unshift({
    ruta, nombre: info.nombre || path.basename(ruta), tipo: info.tipo || '2D',
    abierto: Date.now(), talon: archivoProyecto(ruta).endsWith('.talon'),
  });
  d.recientes = d.recientes.slice(0, 30);
  escribirDatos(d);
  abrirEditor(ruta);
});
ipcMain.on('app:gestor', () => abrirGestor());
ipcMain.handle('app:archivo-proyecto', (e, ruta) => archivoProyecto(ruta));

function archivoProyecto(ruta) {
  const f = path.join(ruta, 'proyecto.falcon');
  if (fs.existsSync(f)) return f;
  const t = path.join(ruta, 'proyecto.talon');
  if (fs.existsSync(t)) return t;
  return f;
}

// ---- IPC: archivos ----
// Devuelve { ok, datos } para no llenar la consola de errores al leer archivos opcionales.
ipcMain.handle('fs:leer', async (e, ruta, codificacion = 'utf8') => {
  try {
    const datos = await fsp.readFile(ruta, codificacion === 'binario' ? null : codificacion);
    return { ok: true, datos: codificacion === 'binario' ? new Uint8Array(datos) : datos };
  } catch (err) { return { ok: false, error: err.message, codigo: err.code }; }
});
ipcMain.handle('fs:escribir', async (e, ruta, datos) => {
  await fsp.mkdir(path.dirname(ruta), { recursive: true });
  // Escritura atómica: primero a un temporal y luego se renombra.
  const tmp = ruta + '.tmp-falcon';
  await fsp.writeFile(tmp, typeof datos === 'string' ? datos : Buffer.from(datos));
  await fsp.rename(tmp, ruta);
  return true;
});
ipcMain.handle('fs:existe', (e, ruta) => fs.existsSync(ruta));
ipcMain.handle('fs:crear-carpeta', (e, ruta) => fsp.mkdir(ruta, { recursive: true }).then(() => true));
ipcMain.handle('fs:borrar', async (e, ruta) => {
  try { await shell.trashItem(ruta); }
  catch { await fsp.rm(ruta, { recursive: true, force: true }); }
  return true;
});
ipcMain.handle('fs:renombrar', (e, de, a) => fsp.rename(de, a).then(() => true));
ipcMain.handle('fs:copiar', (e, de, a) => fsp.cp(de, a, { recursive: true, force: false, errorOnExist: false }).then(() => true));
ipcMain.handle('fs:info', async (e, ruta) => {
  try {
    const s = await fsp.stat(ruta);
    return { existe: true, carpeta: s.isDirectory(), tamano: s.size, modificado: s.mtimeMs };
  } catch { return { existe: false }; }
});
ipcMain.handle('fs:listar', async (e, ruta, recursivo = false) => {
  const salida = [];
  async function recorrer(dir, rel) {
    let entradas = [];
    try { entradas = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const d of entradas) {
      if (d.name.startsWith('.') || d.name.endsWith('.tmp-falcon')) continue;
      const abs = path.join(dir, d.name);
      const r = rel ? rel + '/' + d.name : d.name;
      let tamano = 0, modificado = 0;
      if (!d.isDirectory()) { try { const s = await fsp.stat(abs); tamano = s.size; modificado = s.mtimeMs; } catch {} }
      salida.push({ nombre: d.name, ruta: abs.split(path.sep).join('/'), rel: r, carpeta: d.isDirectory(), tamano, modificado });
      if (recursivo && d.isDirectory()) await recorrer(abs, r);
    }
  }
  await recorrer(ruta, '');
  return salida;
});
ipcMain.handle('fs:tamano', async (e, ruta) => {
  let total = 0;
  async function rec(d) {
    let es = [];
    try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const x of es) {
      const a = path.join(d, x.name);
      if (x.isDirectory()) await rec(a);
      else { try { total += (await fsp.stat(a)).size; } catch {} }
    }
  }
  await rec(ruta);
  return total;
});

// ---- IPC: diálogos y sistema ----
ipcMain.handle('dialogo:carpeta', async (e, op = {}) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Elegir carpeta', defaultPath: op.ruta, properties: ['openDirectory', 'createDirectory'],
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialogo:archivos', async (e, op = {}) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Elegir archivos', defaultPath: op.ruta,
    properties: ['openFile', ...(op.varios ? ['multiSelections'] : [])],
    filters: op.filtros || [],
  });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('dialogo:guardar', async (e, op = {}) => {
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Guardar', defaultPath: op.ruta, filters: op.filtros || [],
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('dialogo:mensaje', async (e, op) => {
  const r = await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender), {
    type: op.tipo || 'question', title: op.titulo || 'Falcon Engine', message: op.mensaje, detail: op.detalle,
    buttons: op.botones || ['Aceptar'], defaultId: 0, cancelId: op.cancelar ?? (op.botones ? op.botones.length - 1 : 0),
  });
  return r.response;
});
ipcMain.on('sistema:mostrar-en-carpeta', (e, ruta) => {
  if (fs.existsSync(ruta) && fs.statSync(ruta).isDirectory()) shell.openPath(ruta);
  else shell.showItemInFolder(ruta);
});
ipcMain.on('sistema:abrir-url', (e, url) => shell.openExternal(url));

// ---- Prueba del juego en otra ventana ----
ipcMain.handle('juego:probar', async (e, op) => {
  const editor = e.sender;
  if (sesionJuego && !sesionJuego.ventana.isDestroyed()) sesionJuego.ventana.close();
  const [ancho, alto] = op.resolucion || [1280, 720];
  const area = screen.getPrimaryDisplay().workAreaSize;
  const escala = Math.min(1, (area.width - 80) / ancho, (area.height - 140) / (alto + 96));
  const v = crearVentana({
    width: Math.round(ancho * escala), height: Math.round(alto * escala) + 96,
    minWidth: 480, minHeight: 360, useContentSize: true,
    title: `${op.nombre || 'Juego'} · Prueba`,
  });
  sesionJuego = { ventana: v, editor };
  v.loadURL(urlApp('src/juego/juego.html', { proyecto: op.proyecto, escena: op.escena || '', modo: 'prueba' }));
  v.on('closed', () => {
    if (sesionJuego && sesionJuego.ventana === v) {
      if (!editor.isDestroyed()) editor.send('juego:de', { tipo: 'cerrado' });
      sesionJuego = null;
    }
  });
  return true;
});
ipcMain.on('juego:a', (e, msg) => {
  if (sesionJuego && !sesionJuego.ventana.isDestroyed()) {
    if (msg.tipo === 'detener') { sesionJuego.ventana.close(); return; }
    sesionJuego.ventana.webContents.send('juego:a', msg);
  }
});
ipcMain.on('juego:de', (e, msg) => {
  if (sesionJuego && !sesionJuego.editor.isDestroyed()) sesionJuego.editor.send('juego:de', msg);
});
ipcMain.handle('juego:captura', async (e, rutaProyecto) => {
  const v = BrowserWindow.fromWebContents(e.sender);
  const img = await v.webContents.capturePage();
  const dir = rutaProyecto ? path.join(rutaProyecto, 'capturas') : path.join(app.getPath('pictures'), 'Capturas de juegos');
  await fsp.mkdir(dir, { recursive: true });
  const f = path.join(dir, `captura-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await fsp.writeFile(f, img.toPNG());
  return f;
});

// ---- Exportación ----
ipcMain.handle('exportar', async (e, op) => {
  const wc = e.sender;
  const progreso = (p) => { if (!wc.isDestroyed()) wc.send('exportar:progreso', p); };
  try {
    const salidas = await exportarJuego({ ...op, raizApp: RAIZ_APP, progreso, cache: path.join(app.getPath('userData'), 'cache-exportacion') });
    return { ok: true, salidas };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

// ---- Inicio ----
app.whenReady().then(async () => {
  registrarProtocolo();
  crearActualizaciones({
    app, ipcMain, net,
    esGestor: (wc) => wc === ventanaPrincipal?.webContents && wc.getURL().split('?')[0] === urlApp('src/gestor/gestor.html'),
    publicar: (estado) => {
      const wc = ventanaPrincipal?.webContents;
      if (wc && !wc.isDestroyed() && wc.getURL().split('?')[0] === urlApp('src/gestor/gestor.html')) wc.send('actualizaciones:estado', estado);
    },
  });
  if (process.platform === 'win32') app.setAppUserModelId('com.falcon.engine');
  if (args.captura) return modoCaptura();
  const rutaArg = process.argv.slice(1).find(a => !a.startsWith('-') && a !== '.' && fs.existsSync(path.join(a, 'proyecto.falcon')));
  if (rutaArg) abrirEditor(path.resolve(rutaArg));
  else abrirGestor();
});

app.on('window-all-closed', () => app.quit());

// Modo de captura: abre una página, opcionalmente ejecuta un guion y guarda una imagen.
// Uso: electron . --captura=salida.png --pagina=src/editor/editor.html?proyecto=... --espera=1500 --guion=archivo.js
async function modoCaptura() {
  const [ancho, alto] = (args.tamano || '1389x868').split('x').map(Number);
  const v = crearVentana({ width: ancho, height: alto, show: false, paintWhenInitiallyHidden: true, useContentSize: true });
  v.webContents.setFrameRate(60);
  ventanaPrincipal = v;
  v.webContents.on('console-message', (ev) => {
    const texto = ev.message ?? '';
    if (args.consola || /error|Error|fallo|Uncaught/.test(texto)) console.log('[consola]', texto);
  });
  await v.loadURL('falcon://app/' + args.pagina);
  const espera = (ms) => new Promise(r => setTimeout(r, ms));
  await espera(Number(args.espera || 1200));
  if (args.guion) {
    const codigo = fs.readFileSync(args.guion, 'utf8');
    try { const r = await v.webContents.executeJavaScript(codigo); if (r !== undefined) console.log('[guion]', JSON.stringify(r)); }
    catch (err) { console.log('[guion] error', err.message); }
    await espera(Number(args.esperaGuion || 800));
  }
  // Si el guion abrió la ventana de juego, capturamos esa.
  const objetivo = args.ventana === 'juego' && sesionJuego ? sesionJuego.ventana : v;
  const img = await objetivo.webContents.capturePage();
  fs.writeFileSync(args.captura, img.toPNG());
  console.log('captura guardada', args.captura);
  app.quit();
}

