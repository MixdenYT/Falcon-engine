// Rutas y permisos del proceso principal (sin Electron, para poder probarlos en Node). Ver docs/SECURITY.md (A1, A2).
const path = require('node:path');
const fs = require('node:fs');

const WIN = process.platform === 'win32';

/**
 * Verdadero si `ruta`, una vez resuelta, es `raiz` o está dentro de ella.
 * En Windows no distingue mayúsculas (tampoco en la letra de unidad).
 */
function dentroDe(raiz, ruta, windows = WIN) {
  const P = windows ? path.win32 : path.posix;
  let a = P.resolve(raiz), b = P.resolve(ruta);
  if (windows) { a = a.toLowerCase(); b = b.toLowerCase(); }
  return b === a || b.startsWith(a.endsWith(P.sep) ? a : a + P.sep);
}

/**
 * Ruta resuelta con los enlaces simbólicos y las uniones (junctions) del disco ya seguidos.
 * Si la ruta aún no existe (un archivo que se va a crear), se resuelve el antepasado que sí existe.
 */
function rutaReal(ruta, real = fs.realpathSync.native) {
  let actual = path.resolve(ruta);
  const resto = [];
  for (;;) {
    try { return path.join(real(actual), ...[...resto].reverse()); } catch {}
    const padre = path.dirname(actual);
    if (padre === actual) return path.resolve(ruta);
    resto.push(path.basename(actual));
    actual = padre;
  }
}

/**
 * ¿Se puede usar `ruta` (ya pasada por rutaReal) con estas raíces?
 * `raices`: [{ ruta, escritura }], con la ruta de cada raíz también real.
 */
function permitida(raices, ruta, escritura = false, windows = WIN) {
  return raices.some(r => (!escritura || r.escritura) && dentroDe(r.ruta, ruta, windows));
}

/**
 * Borrar exige escritura y estar por debajo de una raíz, nunca la raíz misma. Única excepción: una raíz
 * marcada como proyecto (los recientes del gestor) si la carpeta contiene de verdad un proyecto (`esProyecto`).
 */
function puedeBorrar(raices, ruta, esProyecto, windows = WIN) {
  const P = windows ? path.win32 : path.posix;
  const igual = (a, b) => windows ? P.resolve(a).toLowerCase() === P.resolve(b).toLowerCase() : P.resolve(a) === P.resolve(b);
  return raices.some(r => r.escritura && dentroDe(r.ruta, ruta, windows) && (!igual(r.ruta, ruta) || (r.proyecto && esProyecto)));
}

const PAGINAS = { '/src/gestor/gestor.html': 'gestor', '/src/editor/editor.html': 'editor', '/src/juego/juego.html': 'juego' };

/** Qué página nuestra es una URL ('gestor', 'editor', 'juego'), o null si no es ninguna. */
function paginaDe(texto) {
  try {
    const u = new URL(texto);
    return u.protocol === 'falcon:' && u.host === 'app' ? PAGINAS[u.pathname] ?? null : null;
  } catch { return null; }
}

/** Solo se abren fuera de la app las páginas web (nunca file:, ni esquemas de otras aplicaciones). */
function urlExterna(texto) {
  try { return ['https:', 'http:'].includes(new URL(texto).protocol); } catch { return false; }
}

/**
 * Permisos web que Falcon usa de verdad: bloquear el ratón (cámara FPS y vuelo del visor 3D) y copiar
 * un enlace al portapapeles (gestor). Solo para nuestras páginas; cámara, micro, ubicación, avisos,
 * pantalla completa HTML, MIDI, USB/HID/serie, etc. se niegan. El mando (Gamepad API) no pide permiso.
 */
const PERMISOS_WEB = new Set(['pointerLock', 'clipboard-sanitized-write']);
function permisoWeb(permiso, origen) {
  try { const u = new URL(origen); return PERMISOS_WEB.has(permiso) && u.protocol === 'falcon:' && u.host === 'app'; } catch { return false; }
}

/**
 * Datos que una página puede guardar en falcon-datos.json. Los recientes solo se quitan o reordenan
 * (los añade el proceso principal al abrir un proyecto), y la carpeta de proyectos solo cambia a una
 * carpeta que el usuario eligió (`puedeCarpeta`).
 */
function datosSaneados(nuevo, actual, puedeCarpeta) {
  const porRuta = new Map((actual.recientes || []).map(r => [r.ruta, r]));
  const vistos = new Set();
  const recientes = (Array.isArray(nuevo?.recientes) ? nuevo.recientes : [])
    .map(r => porRuta.get(r?.ruta)).filter(r => r && !vistos.has(r) && vistos.add(r));
  const ajustes = nuevo?.ajustes && typeof nuevo.ajustes === 'object' && !Array.isArray(nuevo.ajustes) ? { ...nuevo.ajustes } : { ...(actual.ajustes || {}) };
  const anterior = actual.ajustes?.carpetaProyectos;
  if (ajustes.carpetaProyectos !== anterior && !(typeof ajustes.carpetaProyectos === 'string' && puedeCarpeta(ajustes.carpetaProyectos))) {
    if (anterior === undefined) delete ajustes.carpetaProyectos; else ajustes.carpetaProyectos = anterior;
  }
  return { ...actual, recientes, ajustes };
}

/**
 * Traduce una URL falcon:// a una ruta del disco, o null si no se puede servir.
 * falcon://app/<ruta> → dentro de `raizApp` (se resuelve después de decodificar, así que `..%2f` no sale).
 * falcon://fs/<ruta>  → ruta absoluta del disco; quien llama comprueba que esté en una raíz permitida.
 */
function rutaDeUrl(texto, raizApp, windows = WIN) {
  let url, p;
  try { url = new URL(texto); p = decodeURIComponent(url.pathname); } catch { return null; }
  if (url.host === 'app') {
    const r = path.resolve(raizApp, '.' + p);
    return dentroDe(raizApp, r, windows) ? r : null;
  }
  if (url.host === 'fs') return windows ? p.replace(/^\//, '') : p;
  return null;
}

module.exports = { dentroDe, rutaReal, permitida, puedeBorrar, paginaDe, urlExterna, permisoWeb, datosSaneados, rutaDeUrl };
