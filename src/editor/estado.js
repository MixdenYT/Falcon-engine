// Estado compartido del editor: proyecto, documentos abiertos, selección y eventos.
import { normalizarEscena, extension, nombreBase, sinExtension, tipoRecurso } from '../motor/proyecto.js';
import { compilarBlueprint } from '../motor/blueprints.js';
import { buscarNodo, recorrer } from '../motor/tipos.js';

// ---------- Bus de eventos ----------
const oyentes = new Map();
export const bus = {
  on(ev, fn) { if (!oyentes.has(ev)) oyentes.set(ev, new Set()); oyentes.get(ev).add(fn); return () => oyentes.get(ev).delete(fn); },
  emit(ev, datos) { for (const fn of oyentes.get(ev) || []) { try { fn(datos); } catch (e) { console.error('[bus]', ev, e); } } },
};

// Registro de mensajes (Salida y Depurador), disponible desde el principio.
export const registros = { salida: [], depurador: [] };
bus.on('log', (e) => {
  const canal = e.canal === 'depurador' ? 'depurador' : 'salida';
  const r = { ...e, hora: new Date().toTimeString().slice(0, 8) };
  registros[canal].push(r);
  if (registros[canal].length > 500) registros[canal].shift();
  bus.emit('registro', { canal, r });
});

export const est = {
  proyecto: null,
  info: null,
  ajustes: {},
  docs: [],
  activo: null,
  archivos: [],          // lista de archivos del proyecto { rel, nombre, carpeta, tamano }
  modo: '2D',            // 2D | 3D | blueprints | aguila | recursos
  modoEditor: 'avanzado',
  juego: { activo: false, pausado: false },
  vivos: new Map(),      // nombre de nodo → { valores }
  eventos: new Map(),    // eventos de lecciones → número de veces
  portapapeles: null,
  ultimoDocDe: {},       // tipo → rel del último documento usado
};

export function tipoDocumento(rel) {
  const e = extension(rel);
  return { fscn: 'escena', bp: 'blueprint', agl: 'script', mat: 'material', malla: 'malla' }[e] || null;
}

// ---------- Documentos ----------
export class Documento {
  constructor(rel, tipo, datos) {
    this.rel = rel;
    this.tipo = tipo;
    this.datos = datos;
    this.sucio = false;
    this.historial = [];
    this.futuro = [];
    this.ultimaFusion = null;
    this.vista = {};
    this.seleccion = [];
    this.soloLectura = rel.startsWith('generado/');
  }

  get nombre() { return nombreBase(this.rel); }
  get titulo() { return this.tipo === 'escena' ? sinExtension(this.rel) : nombreBase(this.rel); }
  get dim() { return this.tipo === 'escena' ? this.datos.tipo : null; }

  instantanea() { return typeof this.datos === 'string' ? this.datos : JSON.stringify(this.datos); }

  /** Aplica un cambio guardando el estado anterior para deshacer. */
  cambiar(fn, op = {}) {
    const ahora = Date.now();
    const fusionar = op.fusionar && this.ultimaFusion && this.ultimaFusion.clave === op.fusionar && ahora - this.ultimaFusion.t < 900;
    if (!fusionar) {
      this.historial.push(this.instantanea());
      if (this.historial.length > 150) this.historial.shift();
    }
    this.futuro = [];
    this.ultimaFusion = op.fusionar ? { clave: op.fusionar, t: ahora } : null;
    const r = fn(this.datos);
    this.marcarSucio();
    bus.emit('doc:cambio', { doc: this, op });
    return r;
  }

  marcarSucio() {
    if (!this.sucio) { this.sucio = true; bus.emit('doc:sucio', this); }
  }

  restaurar(texto) {
    this.datos = this.tipo === 'script' ? texto : JSON.parse(texto);
    if (this.tipo === 'escena') this.datos = normalizarEscena(this.datos);
  }

  deshacer() {
    if (!this.historial.length) return false;
    this.futuro.push(this.instantanea());
    this.restaurar(this.historial.pop());
    this.ultimaFusion = null;
    this.marcarSucio();
    this.limpiarSeleccion();
    bus.emit('doc:cambio', { doc: this, op: { deshacer: true } });
    return true;
  }

  rehacer() {
    if (!this.futuro.length) return false;
    this.historial.push(this.instantanea());
    this.restaurar(this.futuro.pop());
    this.marcarSucio();
    this.limpiarSeleccion();
    bus.emit('doc:cambio', { doc: this, op: { rehacer: true } });
    return true;
  }

  limpiarSeleccion() {
    if (this.tipo !== 'escena') return;
    this.seleccion = this.seleccion.filter(id => buscarNodo(this.datos.raiz, id));
  }

  // Nodo seleccionado principal (escenas).
  get nodoSel() { return this.tipo === 'escena' && this.seleccion.length ? buscarNodo(this.datos.raiz, this.seleccion[this.seleccion.length - 1]) : null; }

  async guardar() {
    const p = est.proyecto;
    if (this.soloLectura) return;
    if (this.tipo === 'script') await p.escribir(this.rel, this.datos);
    else await p.escribirJSON(this.rel, this.datos);
    if (this.tipo === 'blueprint') {
      const r = compilarBlueprint(this.datos, this.nombre);
      const destino = 'generado/' + sinExtension(this.rel) + '.agl';
      await p.escribir(destino, r.codigo);
      this.ultimaCompilacion = r;
      bus.emit('bp:compilado', { doc: this, resultado: r });
    }
    this.sucio = false;
    bus.emit('doc:guardado', this);
  }
}

export async function cargarDocumento(rel) {
  const tipo = tipoDocumento(rel);
  if (!tipo) return null;
  const p = est.proyecto;
  let datos;
  if (tipo === 'script') datos = await p.leer(rel);
  else if (tipo === 'escena') datos = await p.leerEscena(rel);
  else datos = await p.leerJSON(rel);
  if (tipo === 'blueprint') {
    datos.variables ||= []; datos.funciones ||= []; datos.grafos ||= {};
    datos.grafos.eventos ||= { nodos: [], conexiones: [], comentarios: [] };
  }
  return new Documento(rel, tipo, datos);
}

export function documento(rel) { return est.docs.find(d => d.rel === rel) || null; }

export async function abrirDocumento(rel, op = {}) {
  let d = documento(rel);
  if (!d) {
    try { d = await cargarDocumento(rel); }
    catch (e) { bus.emit('log', { tipo: 'error', texto: `No se pudo abrir ${rel}: ${e.message}` }); return null; }
    if (!d) return null;
    est.docs.push(d);
    bus.emit('docs:lista');
  }
  if (op.activar !== false) activarDocumento(d);
  return d;
}

export function activarDocumento(d) {
  est.activo = d;
  if (d) est.ultimoDocDe[d.tipo === 'escena' ? 'escena' + d.dim : d.tipo] = d.rel;
  bus.emit('doc:activo', d);
}

export function cerrarDocumento(d) {
  const i = est.docs.indexOf(d);
  if (i < 0) return;
  est.docs.splice(i, 1);
  if (est.activo === d) {
    est.activo = null;
    const sig = est.docs[Math.min(i, est.docs.length - 1)];
    bus.emit('docs:lista');
    activarDocumento(sig || null);
  } else bus.emit('docs:lista');
}

// ---------- Archivos del proyecto ----------
export async function refrescarArchivos() {
  const lista = await est.proyecto.listar('', true);
  est.archivos = lista.map(a => ({ ...a, rel: a.rel.replace(/\\/g, '/') }));
  bus.emit('archivos', est.archivos);
  return est.archivos;
}

export function archivosDeTipo(tipo) { return est.archivos.filter(a => !a.carpeta && tipoRecurso(a.rel) === tipo); }

// Registro de eventos para las lecciones del modo sencillo.
export function anotarEvento(nombre) {
  est.eventos.set(nombre, (est.eventos.get(nombre) || 0) + 1);
  bus.emit('evento', nombre);
}

export function log(texto, tipo = 'info', extra = {}) { bus.emit('log', { texto, tipo, ...extra }); }

// Escenas que usan un recurso (para «Usado en» y referencias rotas).
export async function escenasQueUsan(rel) {
  const r = [];
  for (const a of est.archivos.filter(x => x.rel.endsWith('.fscn'))) {
    const d = documento(a.rel);
    const texto = d ? JSON.stringify(d.datos) : await est.proyecto.leer(a.rel).catch(() => '');
    if (texto.includes(JSON.stringify(rel).slice(1, -1))) r.push(sinExtension(a.rel));
  }
  return r;
}

export function nodosConLogica(raiz) {
  const r = [];
  recorrer(raiz, n => { if (n.script || n.blueprint) r.push(n); });
  return r;
}
