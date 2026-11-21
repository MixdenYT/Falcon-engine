// Rutas del protocolo falcon:// (sin Electron, para poder probarlas en Node).
const path = require('node:path');

/** Verdadero si `ruta`, una vez resuelta, es `raiz` o está dentro de ella. */
function dentroDe(raiz, ruta) {
  const r = path.resolve(ruta);
  return r === raiz || r.startsWith(raiz + path.sep);
}

/**
 * Traduce una URL falcon:// a una ruta del disco, o null si no se puede servir.
 * falcon://app/<ruta> → dentro de `raizApp` (se resuelve después de decodificar, así que `..%2f` no sale).
 * falcon://fs/<ruta>  → ruta absoluta del disco (proyectos del usuario).
 */
function rutaDeUrl(texto, raizApp, windows = process.platform === 'win32') {
  let url, p;
  try { url = new URL(texto); p = decodeURIComponent(url.pathname); } catch { return null; }
  if (url.host === 'app') {
    const r = path.resolve(raizApp, '.' + p);
    return dentroDe(raizApp, r) ? r : null;
  }
  if (url.host === 'fs') return windows ? p.replace(/^\//, '') : p;
  return null;
}

module.exports = { dentroDe, rutaDeUrl };
