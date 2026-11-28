// Proceso principal de Falcon Engine (Electron).
// Gestiona ventanas, acceso a archivos, la ventana de prueba del juego y la exportación.

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, screen, nativeImage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { exportarJuego } = require('./exportar.js');
const { crearActualizaciones } = require('./actualizaciones.js');
const { rutaDeUrl, rutaReal, permitida, puedeBorrar, paginaDe, urlExterna, permisoWeb, datosSaneados } = require('./rutas.js');

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

// ---- Protocolo falcon:// (ver rutas.js) ----
function registrarProtocolo() {
  protocol.handle('falcon', async (req) => {
    const ruta = rutaDeUrl(req.url, RAIZ_APP);
    // falcon://fs solo sirve lo que alguna ventana puede leer (el protocolo no dice qué ventana lo pide).
    if (!ruta || (new URL(req.url).host === 'fs' && !permitidaEnAlguna(ruta))) return new Response('No encontrado', { status: 404 });
    try {
      const r = await net.fetch(pathToFileURL(ruta).toString());
      const tipo = tipoMime(ruta);
      if (tipo) {
        const h = new Headers(r.headers);
        h.set('Content-Type', tipo);
        h.set('Cache-Control', 'no-cache');
        // Las páginas viven en falcon://app y cargan texturas y modelos de falcon://fs (otro origen).
        h.set('Access-Control-Allow-Origin', 'falcon://app');
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

// ---- Permisos por ventana (A1 en docs/SECURITY.md) ----
// Cada webContents solo toca las raíces que le dio el proceso principal: el proyecto que abrió el
// usuario y lo que eligió en un diálogo nativo. Nunca lo que diga la página.
const permisos = new Map(); // id de webContents → { proyecto, raices: [{ ruta (real), escritura, proyecto }] }

function fijarPermisos(wc, proyecto, raices) {
  if (!permisos.has(wc.id)) wc.once('destroyed', () => permisos.delete(wc.id));
  permisos.set(wc.id, { proyecto, raices: raices.map(r => ({ ...r, ruta: rutaReal(r.ruta) })) });
}
function conceder(wc, ruta, escritura) { permisos.get(wc.id)?.raices.push({ ruta: rutaReal(ruta), escritura }); }

/** La página que envía el mensaje si es una de `paginas` y el marco principal de una ventana nuestra; si no, null. */
function de(e, ...paginas) {
  const f = e.senderFrame;
  const p = f && !f.parent ? paginaDe(f.url) : null;
  return p && paginas.includes(p) ? p : null;
}
const TODAS = ['gestor', 'editor', 'juego'];

/** La ruta resuelta si el remitente puede usarla (para leer o para escribir); si no, null. */
function rutaPermitida(e, ruta, escritura = false) {
  if (typeof ruta !== 'string' || !ruta) return null;
  const r = path.resolve(ruta); // sin `..`: lo que se comprueba es lo que se abre
  return permitida(permisos.get(e.sender.id)?.raices || [], rutaReal(r), escritura) ? r : null;
}
function permitidaEnAlguna(ruta) {
  const real = rutaReal(ruta);
  for (const p of permisos.values()) if (permitida(p.raices, real)) return true;
  return false;
}
const NO_PERMITIDA = 'Ruta no permitida: está fuera del proyecto y de las carpetas elegidas.';

function carpetaProyectos(d) { return d.ajustes?.carpetaProyectos || path.join(app.getPath('documents'), 'Falcon Engine Proyectos'); }
function permisosGestor(wc) {
  const d = leerDatos();
  fijarPermisos(wc, null, [
    { ruta: carpetaProyectos(d), escritura: true },
    ...(d.recientes || []).filter(r => typeof r?.ruta === 'string').map(r => ({ ruta: r.ruta, escritura: true, proyecto: true })),
  ]);
}

// ---- Ventanas ----
let ventanaPrincipal = null;
let sesionJuego = null; // { ventana, editor: webContents }

const preferenciasWeb = (preload = 'preload.js') => ({
  preload: path.join(__dirname, preload),
  contextIsolation: true, nodeIntegration: false, sandbox: true,
  spellcheck: false,
  backgroundThrottling: !args.captura,
  offscreen: !!args.captura,
});

function crearVentana(opciones = {}) {
  const v = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680,
    frame: false, backgroundColor: '#050605', show: false, icon: ICONO,
    title: 'Falcon engine',
    webPreferences: preferenciasWeb(),
    ...opciones,
  });
  v.setMenu(null); // Alt se reserva para el paso lento del juego; la app usa sus propios menús.
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
  v.webContents.setWindowOpenHandler(({ url }) => { if (urlExterna(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Evita que soltar un archivo en la ventana navegue fuera de la app.
  v.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('falcon://app/')) e.preventDefault(); });
  if (args.captura) {
    // Incluye la ventana de juego abierta por el editor: un fallo de carga no
    // debe quedar reducido a un timeout sin el error original en las pruebas.
    v.webContents.on('console-message', (ev) => {
      const texto = ev.message ?? '';
      if (args.consola || /error|Error|fallo|Uncaught/.test(texto)) console.log('[consola ventana ' + v.id + ']', texto);
    });
    v.webContents.on('did-fail-load', (ev, codigo, descripcion, url) => console.error('[carga ventana ' + v.id + ']', codigo, descripcion, url));
    v.webContents.on('render-process-gone', (ev, detalles) => console.error('[renderer ventana ' + v.id + ']', detalles.reason, detalles.exitCode));
  }
  return v;
}

function abrirGestor() {
  if (!ventanaPrincipal) ventanaPrincipal = crearVentana();
  permisosGestor(ventanaPrincipal.webContents);
  ventanaPrincipal.loadURL(urlApp('src/gestor/gestor.html'));
}

function abrirEditor(rutaProyecto) {
  if (!ventanaPrincipal) ventanaPrincipal = crearVentana();
  fijarPermisos(ventanaPrincipal.webContents, rutaProyecto, [{ ruta: rutaProyecto, escritura: true }]);
  ventanaPrincipal.loadURL(urlApp('src/editor/editor.html', { proyecto: rutaProyecto }));
}

// ---- IPC: ventana ----
// Cada manejador comprueba qué página lo llama (de) antes de hacer nada.
ipcMain.on('ventana:minimizar', (e) => { if (de(e, ...TODAS)) BrowserWindow.fromWebContents(e.sender)?.minimize(); });
ipcMain.on('ventana:maximizar', (e) => {
  const v = de(e, ...TODAS) && BrowserWindow.fromWebContents(e.sender);
  if (!v) return;
  v.isMaximized() ? v.unmaximize() : v.maximize();
});
ipcMain.on('ventana:cerrar', (e) => { if (de(e, ...TODAS)) BrowserWindow.fromWebContents(e.sender)?.close(); });
ipcMain.handle('ventana:maximizada', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false);
ipcMain.on('ventana:titulo', (e, t) => { if (de(e, ...TODAS)) BrowserWindow.fromWebContents(e.sender)?.setTitle(String(t)); });
ipcMain.on('ventana:enfocar-editor', (e) => { if (de(e, 'juego') && ventanaPrincipal) { if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore(); ventanaPrincipal.focus(); } });
ipcMain.on('ventana:pantalla-completa', (e) => {
  const v = de(e, ...TODAS) && BrowserWindow.fromWebContents(e.sender);
  if (v) v.setFullScreen(!v.isFullScreen());
});
ipcMain.on('ventana:tamano-contenido', (e, { ancho, alto } = {}) => {
  const v = de(e, 'juego') && BrowserWindow.fromWebContents(e.sender);
  if (!v || !(ancho > 0 && alto > 0)) return;
  if (v.isMaximized()) v.unmaximize();
  const area = screen.getDisplayMatching(v.getBounds()).workAreaSize;
  v.setContentSize(Math.round(Math.min(ancho, area.width)), Math.round(Math.min(alto, area.height)));
  v.center();
});

// ---- IPC: aplicación ----
ipcMain.handle('app:info', (e) => de(e, ...TODAS) && {
  version: VERSION, plataforma: process.platform, arquitectura: process.arch,
  electron: process.versions.electron, raizApp: RAIZ_APP,
  documentos: app.getPath('documents'), inicio: app.getPath('home'),
  usuario: require('node:os').userInfo().username,
});
// El juego solo necesita los ajustes, no la lista de proyectos recientes.
ipcMain.handle('app:datos', (e) => {
  const p = de(e, ...TODAS), d = leerDatos();
  return p === 'juego' ? { ajustes: d.ajustes || {} } : p ? d : null;
});
ipcMain.handle('app:guardar-datos', (e, d) => {
  if (!de(e, 'gestor', 'editor')) return false;
  escribirDatos(datosSaneados(d, leerDatos(), (c) => !!rutaPermitida(e, c, true)));
  return true;
});
// Solo el gestor abre proyectos: carpetas que ya puede usar y que contienen un proyecto.
ipcMain.on('app:abrir-proyecto', (e, ruta) => {
  if (!de(e, 'gestor') || !rutaPermitida(e, ruta, true) || !fs.existsSync(archivoProyecto(ruta))) return;
  const d = leerDatos();
  d.recientes = (d.recientes || []).filter(r => path.resolve(r.ruta) !== path.resolve(ruta));
  let info = {};
  try { info = JSON.parse(fs.readFileSync(archivoProyecto(ruta), 'utf8')); } catch {}
  d.recientes.unshift({
    ruta, nombre: String(info.nombre || path.basename(ruta)), tipo: info.tipo === '3D' ? '3D' : '2D',
    abierto: Date.now(), talon: archivoProyecto(ruta).endsWith('.talon'),
  });
  d.recientes = d.recientes.slice(0, 30);
  escribirDatos(d);
  abrirEditor(ruta);
});
ipcMain.on('app:gestor', (e) => { if (de(e, 'gestor', 'editor')) abrirGestor(); });
ipcMain.handle('app:archivo-proyecto', (e, ruta) => {
  if (!de(e, ...TODAS) || !rutaPermitida(e, ruta)) throw new Error(NO_PERMITIDA);
  return archivoProyecto(ruta);
});

function archivoProyecto(ruta) {
  const f = path.join(ruta, 'proyecto.falcon');
  if (fs.existsSync(f)) return f;
  const t = path.join(ruta, 'proyecto.talon');
  if (fs.existsSync(t)) return t;
  return f;
}

// ---- IPC: archivos ----
// Toda ruta pasa por rutaPermitida. El juego solo lee; escribir es cosa del editor y del gestor.
// Devuelve { ok, datos } para no llenar la consola de errores al leer archivos opcionales.
ipcMain.handle('fs:leer', async (e, ruta, codificacion = 'utf8') => {
  const r = de(e, ...TODAS) && rutaPermitida(e, ruta);
  if (!r) return { ok: false, error: NO_PERMITIDA, codigo: 'EACCES' };
  try {
    const datos = await fsp.readFile(r, codificacion === 'binario' ? null : codificacion);
    return { ok: true, datos: codificacion === 'binario' ? new Uint8Array(datos) : datos };
  } catch (err) { return { ok: false, error: err.message, codigo: err.code }; }
});
let ventanaCaptura = null; // modo --captura: su guion de prueba también escribe desde la página del juego
function paraEscribir(e, ruta) {
  const r = (de(e, 'gestor', 'editor') || (ventanaCaptura && e.sender === ventanaCaptura)) && rutaPermitida(e, ruta, true);
  if (!r) throw new Error(NO_PERMITIDA);
  return r;
}
ipcMain.handle('fs:escribir', async (e, ruta, datos) => {
  const r = paraEscribir(e, ruta);
  await fsp.mkdir(path.dirname(r), { recursive: true });
  // Escritura atómica: primero a un temporal y luego se renombra.
  const tmp = r + '.tmp-falcon';
  await fsp.writeFile(tmp, typeof datos === 'string' ? datos : Buffer.from(datos));
  await fsp.rename(tmp, r);
  return true;
});
ipcMain.handle('fs:existe', (e, ruta) => { const r = de(e, ...TODAS) && rutaPermitida(e, ruta); return !!r && fs.existsSync(r); });
ipcMain.handle('fs:crear-carpeta', (e, ruta) => fsp.mkdir(paraEscribir(e, ruta), { recursive: true }).then(() => true));
// Solo a la papelera y nunca una raíz entera (salvo un proyecto reciente desde el gestor). Si falla, se informa.
ipcMain.handle('fs:borrar', async (e, ruta) => {
  const r = paraEscribir(e, ruta);
  if (!puedeBorrar(permisos.get(e.sender.id).raices, rutaReal(r), fs.existsSync(archivoProyecto(r)))) throw new Error(NO_PERMITIDA);
  await shell.trashItem(r);
  return true;
});
ipcMain.handle('fs:renombrar', async (e, origen, destino) => {
  const a = paraEscribir(e, origen), b = paraEscribir(e, destino);
  await fsp.rename(a, b);
  return true;
});
// El origen puede estar fuera del proyecto si el usuario lo eligió (diálogo, o arrastrar y soltar).
ipcMain.handle('fs:copiar', async (e, origen, destino) => {
  const a = de(e, 'gestor', 'editor') && rutaPermitida(e, origen), b = paraEscribir(e, destino);
  if (!a) throw new Error(NO_PERMITIDA);
  await fsp.cp(a, b, { recursive: true, force: false, errorOnExist: false });
  return true;
});
// Archivo soltado en la ventana: el preload saca la ruta de un File real, que la página no puede inventar.
ipcMain.on('fs:soltado', (e, ruta) => { if (de(e, 'editor') && typeof ruta === 'string' && ruta) conceder(e.sender, ruta, false); });
ipcMain.handle('fs:info', async (e, ruta) => {
  const r = de(e, ...TODAS) && rutaPermitida(e, ruta);
  if (!r) return { existe: false };
  try {
    const s = await fsp.stat(r);
    return { existe: true, carpeta: s.isDirectory(), tamano: s.size, modificado: s.mtimeMs };
  } catch { return { existe: false }; }
});
ipcMain.handle('fs:listar', async (e, ruta, recursivo = false) => {
  const salida = [];
  const raiz = de(e, ...TODAS) && rutaPermitida(e, ruta);
  if (!raiz) return salida;
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
  await recorrer(raiz, '');
  return salida;
});
ipcMain.handle('fs:tamano', async (e, ruta) => {
  let total = 0;
  const raiz = de(e, 'gestor', 'editor') && rutaPermitida(e, ruta);
  if (!raiz) return total;
  async function rec(d) {
    let es = [];
    try { es = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const x of es) {
      const a = path.join(d, x.name);
      if (x.isDirectory()) await rec(a);
      else { try { total += (await fsp.stat(a)).size; } catch {} }
    }
  }
  await rec(raiz);
  return total;
});

// ---- IPC: diálogos y sistema ----
// Lo que el usuario elige en un diálogo nativo queda permitido en esa ventana hasta que cambie de página.
ipcMain.handle('dialogo:carpeta', async (e, op = {}) => {
  if (!de(e, 'gestor', 'editor')) return null;
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Elegir carpeta', defaultPath: op.ruta, properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled) return null;
  conceder(e.sender, r.filePaths[0], true);
  return r.filePaths[0];
});
ipcMain.handle('dialogo:archivos', async (e, op = {}) => {
  if (!de(e, 'gestor', 'editor')) return [];
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Elegir archivos', defaultPath: op.ruta,
    properties: ['openFile', ...(op.varios ? ['multiSelections'] : [])],
    filters: op.filtros || [],
  });
  if (r.canceled) return [];
  for (const f of r.filePaths) conceder(e.sender, f, false);
  return r.filePaths;
});
ipcMain.handle('dialogo:guardar', async (e, op = {}) => {
  if (!de(e, 'gestor', 'editor')) return null;
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
    title: op.titulo || 'Guardar', defaultPath: op.ruta, filters: op.filtros || [],
  });
  if (r.canceled || !r.filePath) return null;
  conceder(e.sender, r.filePath, true);
  return r.filePath;
});
ipcMain.handle('dialogo:mensaje', async (e, op = {}) => {
  if (!de(e, 'gestor', 'editor')) return null;
  const r = await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender), {
    type: op.tipo || 'question', title: op.titulo || 'Falcon engine', message: op.mensaje, detail: op.detalle,
    buttons: op.botones || ['Aceptar'], defaultId: 0, cancelId: op.cancelar ?? (op.botones ? op.botones.length - 1 : 0),
  });
  return r.response;
});
ipcMain.on('sistema:mostrar-en-carpeta', (e, ruta) => {
  const r = de(e, 'gestor', 'editor') && rutaPermitida(e, ruta);
  if (!r) return;
  if (fs.existsSync(r) && fs.statSync(r).isDirectory()) shell.openPath(r);
  else shell.showItemInFolder(r);
});
ipcMain.on('sistema:abrir-url', (e, url) => { if (de(e, 'gestor', 'editor') && urlExterna(url)) shell.openExternal(url); });

// ---- Prueba del juego en otra ventana ----
// Se prueba el proyecto abierto en el editor (no el que diga la página), con un preload reducido y solo lectura.
ipcMain.handle('juego:probar', async (e, op = {}) => {
  const proyecto = de(e, 'editor') && permisos.get(e.sender.id)?.proyecto;
  if (!proyecto) return false;
  const editor = e.sender;
  if (sesionJuego && !sesionJuego.ventana.isDestroyed()) sesionJuego.ventana.close();
  const [ancho, alto] = (Array.isArray(op.resolucion) ? op.resolucion : [1280, 720]).map(n => Math.max(160, Math.min(7680, Number(n) || 720)));
  const area = screen.getPrimaryDisplay().workAreaSize;
  const escala = Math.min(1, (area.width - 80) / ancho, (area.height - 140) / (alto + 96));
  const v = crearVentana({
    width: Math.round(ancho * escala), height: Math.round(alto * escala) + 96,
    minWidth: 480, minHeight: 360, useContentSize: true,
    title: `${op.nombre || 'Juego'} · Prueba`,
    webPreferences: preferenciasWeb('preload-juego.js'),
  });
  fijarPermisos(v.webContents, proyecto, [{ ruta: proyecto, escritura: false }]);
  sesionJuego = { ventana: v, editor };
  v.loadURL(urlApp('src/juego/juego.html', { proyecto, escena: String(op.escena || ''), modo: 'prueba' }));
  v.on('closed', () => {
    if (sesionJuego && sesionJuego.ventana === v) {
      if (!editor.isDestroyed()) editor.send('juego:de', { tipo: 'cerrado' });
      sesionJuego = null;
    }
  });
  return true;
});
ipcMain.on('juego:a', (e, msg) => {
  if (!de(e, 'editor') || !msg) return;
  if (sesionJuego && !sesionJuego.ventana.isDestroyed()) {
    if (msg.tipo === 'detener') { sesionJuego.ventana.close(); return; }
    sesionJuego.ventana.webContents.send('juego:a', msg);
  }
});
ipcMain.on('juego:de', (e, msg) => {
  if (!de(e, 'juego') || sesionJuego?.ventana.webContents !== e.sender) return;
  if (!sesionJuego.editor.isDestroyed()) sesionJuego.editor.send('juego:de', msg);
});
// Las capturas van a la carpeta capturas del proyecto que se prueba.
ipcMain.handle('juego:captura', async (e) => {
  if (!de(e, 'juego')) return null;
  const v = BrowserWindow.fromWebContents(e.sender);
  const img = await v.webContents.capturePage();
  const rutaProyecto = permisos.get(e.sender.id)?.proyecto;
  const dir = rutaProyecto ? path.join(rutaProyecto, 'capturas') : path.join(app.getPath('pictures'), 'Capturas de juegos');
  await fsp.mkdir(dir, { recursive: true });
  const f = path.join(dir, `captura-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await fsp.writeFile(f, img.toPNG());
  return f;
});

// ---- Exportación ----
// Se exporta el proyecto abierto a una carpeta permitida (la del proyecto o una elegida con «Examinar»),
// con el icono de la app: la página no decide qué se lee ni qué se borra.
ipcMain.handle('exportar', async (e, op = {}) => {
  if (!de(e, 'editor')) return { ok: false, error: 'No permitido.' };
  const wc = e.sender;
  const proyecto = permisos.get(wc.id)?.proyecto;
  const destino = rutaPermitida(e, op.destino, true);
  if (!proyecto || !destino) return { ok: false, error: 'Elige la carpeta de destino con «Examinar».' };
  const progreso = (p) => { if (!wc.isDestroyed()) wc.send('exportar:progreso', p); };
  try {
    const salidas = await exportarJuego({
      proyecto, destino, plataformas: Array.isArray(op.plataformas) ? op.plataformas : [],
      nombre: op.nombre, version: op.version, pantallaCompleta: !!op.pantallaCompleta, licenciaPublicacion: !!op.licenciaPublicacion,
      icono: path.join(RAIZ_APP, 'recursos', 'icono.ico'),
      raizApp: RAIZ_APP, progreso, cache: path.join(app.getPath('userData'), 'cache-exportacion'),
    });
    return { ok: true, salidas };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

// ---- Inicio ----
app.whenReady().then(async () => {
  registrarProtocolo();
  // M1 en docs/SECURITY.md: solo los permisos web que usa Falcon (ver permisoWeb en rutas.js).
  session.defaultSession.setPermissionRequestHandler((wc, permiso, cb, d) => cb(permisoWeb(permiso, d.requestingUrl)));
  session.defaultSession.setPermissionCheckHandler((wc, permiso, origen) => permisoWeb(permiso, origen));
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
  // Permisos y preload como si el usuario hubiera abierto esa página (la línea de comandos es de confianza).
  const pagina = new URL('falcon://app/' + args.pagina), proyecto = pagina.searchParams.get('proyecto');
  // Un guion de prueba guarda sus evidencias con falcon.fs.escribir, que el preload reducido no tiene;
  // el juego real con preload-juego se prueba desde el editor («Probar») y en el juego exportado.
  const v = crearVentana({
    width: ancho, height: alto, minWidth: ancho, minHeight: alto, show: false, paintWhenInitiallyHidden: true, useContentSize: true,
    webPreferences: preferenciasWeb(paginaDe(pagina.href) === 'juego' && !args.guion ? 'preload-juego.js' : 'preload.js'),
  });
  v.webContents.setFrameRate(60);
  ventanaPrincipal = v;
  if (paginaDe(pagina.href) === 'gestor') permisosGestor(v.webContents);
  else fijarPermisos(v.webContents, proyecto, proyecto ? [{ ruta: proyecto, escritura: paginaDe(pagina.href) === 'editor' }] : []);
  // Las carpetas de la captura y del guion las da la línea de comandos (de confianza): ahí escribe la prueba.
  for (const a of [args.captura, args.guion]) if (a) conceder(v.webContents, path.dirname(path.resolve(a)), true);
  if (args.guion) ventanaCaptura = v.webContents;
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

