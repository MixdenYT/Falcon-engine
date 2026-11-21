// Todos los Blueprints que existen: los `.bp` que escribe cada plantilla (con crearProyecto, como
// pruebas/ejemplos.test.js), los 67 de la Academia y los del CQB. Lo usan pruebas/blueprints-ara.test.js y
// herramientas/medir-blueprints.mjs. Devuelve [[ruta, bp]], sin repetir ruta y contenido.
import { readFile } from 'node:fs/promises';
import './dom.js';
import { crearProyecto, PLANTILLAS } from '../src/motor/plantillas.js';
import { plantillaAcademia } from '../src/motor/academia.js';
import { blueprintsCQB } from '../src/motor/cqb-blueprints.js';

export async function corpusBlueprints() {
  const casos = new Map();
  const poner = (ruta, bp) => { const k = ruta + '\n' + JSON.stringify(bp); if (!casos.has(k)) casos.set(k, [ruta, bp]); };
  // Node no dibuja: un lienzo que acepta todo y da un PNG vacío basta (aquí importan los Blueprints).
  const antes = { OffscreenCanvas: globalThis.OffscreenCanvas, FileReader: globalThis.FileReader, fetch: globalThis.fetch, window: globalThis.window };
  const nada = new Proxy(function () {}, { get: (_, k) => k === 'convertToBlob' ? async () => new Blob([]) : k === 'measureText' ? () => ({ width: 0 }) : nada, apply: () => nada, set: () => true });
  globalThis.FileReader ||= class {
    leer(b, conv) { b.arrayBuffer().then((r) => { this.result = conv(r); this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
    readAsArrayBuffer(b) { this.leer(b, (r) => r); }
    readAsDataURL(b) { this.leer(b, (r) => 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64')); }
  };
  globalThis.OffscreenCanvas ||= class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return nada; } async convertToBlob() { return new Blob([]); } };
  globalThis.fetch = async (url) => new Response(await readFile(new URL(url)));
  try {
    for (const { id } of PLANTILLAS) {
      globalThis.window = { falcon: { fs: { existe: async () => false, crearCarpeta: async () => {}, escribir: async (p, d) => { if (p.endsWith('.bp')) poner(p.replace('/ejemplo/', ''), JSON.parse(d)); } } } };
      await crearProyecto('/ejemplo', id, id);
    }
  } finally { Object.assign(globalThis, antes); if (!antes.window) delete globalThis.window; }
  for (const [ruta, bp] of Object.entries(plantillaAcademia('Academia').archivos)) if (ruta.endsWith('.bp')) poner(ruta, bp);
  for (const [ruta, bp] of Object.entries(blueprintsCQB())) if (ruta.endsWith('.bp')) poner(ruta, bp);
  return [...casos.values()];
}
