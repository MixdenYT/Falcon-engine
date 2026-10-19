// Modelo de proyecto de Falcon Engine y acceso a sus archivos.
import { normalizarNodo } from './tipos.js';

export const VERSION_FORMATO = 1;

export const TIPOS_RECURSO = {
  imagen: { ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'], etiqueta: 'IMG', nombre: 'Imágenes', color: 'var(--turquesa)', icono: 'imagen' },
  modelo: { ext: ['glb', 'gltf'], etiqueta: '3D', nombre: 'Modelos 3D', color: 'var(--ambar)', icono: 'cubo' },
  sonido: { ext: ['wav', 'ogg', 'mp3'], etiqueta: 'SFX', nombre: 'Sonidos', color: 'var(--naranja)', icono: 'onda' },
  fuente: { ext: ['ttf', 'otf', 'woff', 'woff2'], etiqueta: 'FUENTE', nombre: 'Fuentes', color: 'var(--lila)', icono: 'fuente' },
  escena: { ext: ['fscn'], etiqueta: 'ESCENA', nombre: 'Escenas', color: 'var(--verde)', icono: 'escena' },
  blueprint: { ext: ['bp'], etiqueta: 'BP', nombre: 'Blueprints', color: 'var(--verde)', icono: 'blueprint' },
  script: { ext: ['agl'], etiqueta: 'ÁGUILA', nombre: 'Scripts', color: 'var(--aviso)', icono: 'codigo' },
  material: { ext: ['mat'], etiqueta: 'MAT', nombre: 'Materiales', color: 'var(--ambar)', icono: 'material' },
  malla: { ext: ['malla'], etiqueta: 'MALLA', nombre: 'Mallas', color: 'var(--ambar)', icono: 'malla' },
};

export function extension(ruta) {
  const m = /\.([^./\\]+)$/.exec(ruta || '');
  return m ? m[1].toLowerCase() : '';
}

export function tipoRecurso(ruta) {
  const e = extension(ruta);
  for (const [k, t] of Object.entries(TIPOS_RECURSO)) if (t.ext.includes(e)) return k;
  return 'otro';
}

export function nombreBase(ruta) { return (ruta || '').split(/[\\/]/).pop(); }
export function sinExtension(ruta) { return nombreBase(ruta).replace(/\.[^.]+$/, ''); }
export function carpetaDe(ruta) { const i = ruta.replace(/\\/g, '/').lastIndexOf('/'); return i < 0 ? '' : ruta.slice(0, i); }
export function unir(...partes) {
  return partes.filter(p => p !== '' && p !== null && p !== undefined).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

export const ACCIONES_POR_DEFECTO = {
  izquierda: ['ArrowLeft', 'KeyA'],
  derecha: ['ArrowRight', 'KeyD'],
  arriba: ['ArrowUp', 'KeyW'],
  abajo: ['ArrowDown', 'KeyS'],
  adelante: ['KeyW', 'ArrowUp'],
  atras: ['KeyS', 'ArrowDown'],
  saltar: ['Space'],
  accion: ['KeyE', 'Enter'],
  correr: ['ShiftLeft', 'ShiftRight'],
  disparar: ['KeyJ', 'Raton0'],
  pausa: ['Escape', 'KeyP'],
  cambiar_vista: ['KeyV'],
};

// Botones del mando (API Gamepad estándar) por acción.
export const MANDO_POR_DEFECTO = {
  izquierda: ['eje0-', 'b14'], derecha: ['eje0+', 'b15'], arriba: ['eje1-', 'b12'], abajo: ['eje1+', 'b13'],
  adelante: ['eje1-', 'b12'], atras: ['eje1+', 'b13'],
  saltar: ['b0'], accion: ['b2'], correr: ['b1'], disparar: ['b7'], pausa: ['b9'], cambiar_vista: ['b3'],
};

export const NOMBRES_TECLAS = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Espacio', Enter: 'Intro',
  Escape: 'Esc', ShiftLeft: 'Mayús', ShiftRight: 'Mayús der.', ControlLeft: 'Ctrl', Raton0: 'Clic', Raton2: 'Clic der.',
};
export function nombreTecla(c) {
  if (NOMBRES_TECLAS[c]) return NOMBRES_TECLAS[c];
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  return c;
}

export function datosProyecto(nombre, tipo = '2D') {
  return {
    formato: 'falcon-proyecto',
    version: VERSION_FORMATO,
    nombre,
    tipo,
    motor: 'Falcon Engine',
    creado: Date.now(),
    escena_principal: '',
    resolucion: [1280, 720],
    ajuste_ventana: 'mantener',
    fondo: '#0B0F0D',
    gravedad: 1200,
    filtro_pixel: false,
    acciones: structuredClone(ACCIONES_POR_DEFECTO),
    mando: structuredClone(MANDO_POR_DEFECTO),
    volumen: { general: 1, musica: 0.7, efectos: 1 },
    modo_editor: 'avanzado',
    calidad_grafica: 'automatica',
    lumbre: true,
    lecciones: {},
    exportacion: { nombre_ejecutable: nombre, version: '1.0.0', pantalla_completa: false },
  };
}

export function escenaVacia(tipo, raiz) {
  return { formato: 'falcon-escena', version: VERSION_FORMATO, tipo, raiz };
}

/** Normaliza una escena leída de disco (añade lo que falte). */
export function normalizarEscena(datos) {
  const e = typeof datos === 'string' ? JSON.parse(datos) : datos;
  e.formato ||= 'falcon-escena';
  e.version ||= VERSION_FORMATO;
  e.tipo ||= '2D';
  e.raiz = normalizarNodo(e.raiz || { tipo: e.tipo === '3D' ? 'Nodo3D' : 'Nodo2D', nombre: 'Escena' });
  e.editor ||= {};
  return e;
}

/**
 * Acceso a los archivos de un proyecto (funciona en cualquier página con window.falcon).
 */
export class Proyecto {
  constructor(ruta) {
    this.ruta = ruta.replace(/\\/g, '/').replace(/\/$/, '');
    this.datos = null;
    this.archivo = null;
    this.importacion = {};
    this.esTalon = false;
  }

  abs(rel) { return rel.includes(':') || rel.startsWith('/') ? rel : unir(this.ruta, rel); }
  rel(abs) {
    const a = abs.replace(/\\/g, '/');
    return a.toLowerCase().startsWith(this.ruta.toLowerCase() + '/') ? a.slice(this.ruta.length + 1) : a;
  }

  async cargar() {
    this.archivo = (await window.falcon.app.archivoProyecto(this.ruta)).replace(/\\/g, '/');
    this.esTalon = this.archivo.endsWith('.talon');
    const texto = await window.falcon.fs.leer(this.archivo);
    const leidos = JSON.parse(texto);
    this.datos = { ...datosProyecto(leidos.nombre || nombreBase(this.ruta), leidos.tipo || '2D'), ...leidos };
    this.datos.acciones = { ...ACCIONES_POR_DEFECTO, ...(leidos.acciones || {}) };
    this.datos.mando = { ...MANDO_POR_DEFECTO, ...(leidos.mando || {}) };
    try { this.importacion = JSON.parse(await window.falcon.fs.leer(this.abs('.falcon/importacion.json'))); } catch { this.importacion = {}; }
    return this;
  }

  async guardar() {
    await window.falcon.fs.escribir(this.archivo, JSON.stringify(this.datos, null, 2));
  }

  async guardarImportacion() {
    await window.falcon.fs.escribir(this.abs('.falcon/importacion.json'), JSON.stringify(this.importacion, null, 2));
  }

  ajustesImportacion(rel) {
    return { filtro: this.datos.filtro_pixel ? 'pixel' : 'suave', repetir: false, comprimir: true, columnas: 1, filas: 1, ...(this.importacion[rel] || {}) };
  }

  leer(rel) { return window.falcon.fs.leer(this.abs(rel)); }
  leerBinario(rel) { return window.falcon.fs.leer(this.abs(rel), 'binario'); }
  escribir(rel, datos) { return window.falcon.fs.escribir(this.abs(rel), datos); }
  existe(rel) { return window.falcon.fs.existe(this.abs(rel)); }
  async leerJSON(rel) { return JSON.parse(await this.leer(rel)); }
  escribirJSON(rel, obj) { return this.escribir(rel, JSON.stringify(obj, null, 2)); }
  listar(rel = '', recursivo = true) { return window.falcon.fs.listar(this.abs(rel), recursivo); }

  async leerEscena(rel) { return normalizarEscena(await this.leer(rel)); }

  url(rel) {
    return 'falcon://fs/' + encodeURI(this.abs(rel)).replace(/#/g, '%23').replace(/\?/g, '%3F');
  }
}
