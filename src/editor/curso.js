// Motor del curso guiado del modo Sencillo y catálogo de «Añadir algo al nivel».
import { est, bus, abrirDocumento, documento, refrescarArchivos, log, anotarEvento } from './estado.js';
import { seleccionar, nuevoBlueprint, nuevoScript, dialogoExportar, nombreUnico } from './acciones.js';
import { anadirNodo, cambiarNodo } from './operaciones.js';
import { LECCIONES } from './lecciones.js';
import { crearNodo, recorrer, buscarNodo } from '../motor/tipos.js';
import { SCRIPTS } from '../motor/plantillas.js';
import { blueprintVacio, idNodoBp, compilarBlueprint } from '../motor/blueprints.js';
import { sinExtension } from '../motor/proyecto.js';

// ---------- Catálogo de objetos ----------
const existe = (rel) => est.archivos.some(a => a.rel === rel);
async function asegurarScript(rel, texto) {
  if (!existe(rel)) { await est.proyecto.escribir(rel, texto); await refrescarArchivos(); }
  return rel;
}
const imagen = (rel, defecto = '') => existe(rel) ? rel : defecto;

export const CATALOGO = [
  { id: 'moneda', nombre: 'Moneda', desc: 'Para recoger', icono: 'moneda', color: 'var(--aviso)', crear: async () => {
    const script = await asegurarScript('scripts/moneda.agl', SCRIPTS.moneda);
    return crearNodo('Area2D', 'Moneda', {}, [crearNodo('Sprite', 'Sprite', { imagen: imagen('sprites/personajes/moneda.png'), ancho: 30, alto: 30, forma: 'circulo', color: '#F2C46D', animando: true, fps: 12 }), crearNodo('Colision', 'Colisión', { ancho: 26, alto: 26 })]);
  }, extra: (n) => { n.script = 'scripts/moneda.agl'; n.grupos = ['monedas']; } },
  { id: 'plataforma', nombre: 'Plataforma', desc: 'Para subirse encima', icono: 'plataforma', color: 'var(--turquesa)', crear: async () => crearNodo('Plataforma', 'Plataforma', { ancho: 200, alto: 28, color: '#22412E', color_borde: '#2F5E40' }) },
  { id: 'pinchos', nombre: 'Pinchos', desc: 'Peligro: hacen volver a empezar', icono: 'pinchos', color: 'var(--error)', crear: async () => {
    await asegurarScript('scripts/peligro.agl', SCRIPTS.peligro);
    return crearNodo('Area2D', 'Pinchos', {}, [crearNodo('Sprite', 'Sprite', { forma: 'triangulo', color: '#C2414F', ancho: 52, alto: 28 }), crearNodo('Colision', 'Colisión', { ancho: 40, alto: 20, posicion: [0, 4] })]);
  }, extra: (n) => { n.script = 'scripts/peligro.agl'; n.grupos = ['peligros']; } },
  { id: 'enemigo', nombre: 'Enemigo', desc: 'Va de un lado a otro', icono: 'enemigo', color: 'var(--rosa)', crear: async () => {
    await asegurarScript('scripts/enemigo.agl', SCRIPTS.enemigo);
    return crearNodo('Personaje2D', 'Enemigo', { velocidad: 90 }, [crearNodo('Sprite', 'Sprite', { imagen: imagen('sprites/personajes/enemigo.png'), forma: 'enemigo', color: '#B04A6A', ancho: 54, alto: 54, animando: true }), crearNodo('Colision', 'Colisión', { ancho: 44, alto: 40, posicion: [0, 6] })]);
  }, extra: (n) => { n.script = 'scripts/enemigo.agl'; n.grupos = ['enemigos']; } },
  { id: 'meta', nombre: 'Meta', desc: 'Al tocarla, ganas', icono: 'bandera', color: 'var(--verde)', crear: async () => {
    await asegurarScript('scripts/meta.agl', SCRIPTS.meta);
    return crearNodo('Area2D', 'Meta', {}, [crearNodo('Sprite', 'Sprite', { forma: 'bandera', color: '#3DDC84', ancho: 52, alto: 80 }), crearNodo('Colision', 'Colisión', { ancho: 36, alto: 80 })]);
  }, extra: (n) => { n.script = 'scripts/meta.agl'; } },
  { id: 'jugador', nombre: 'Jugador', desc: 'Tu personaje', icono: 'persona', color: 'var(--turquesa)', crear: async () => crearNodo('Personaje2D', 'Jugador', { controles: 'plataformas' }, [crearNodo('Sprite', 'Sprite', { imagen: imagen('sprites/personajes/jugador.png'), forma: 'personaje', ancho: 52, alto: 65 }), crearNodo('Colision', 'Colisión', { ancho: 40, alto: 62 })]) },
  { id: 'texto', nombre: 'Texto', desc: 'Un letrero en pantalla', icono: 'texto', color: 'var(--lila)', crear: async () => crearNodo('Etiqueta', 'Texto', { texto: '¡Hola!', posicion: [24, 24] }) },
  { id: 'marcador', nombre: 'Marcador de monedas', desc: 'Cuenta los puntos', icono: 'moneda', color: 'var(--lila)', crear: async () => {
    await asegurarScript('scripts/contador.agl', SCRIPTS.contador);
    return crearNodo('Etiqueta', 'Contador', { texto: '0', icono: 'moneda', fondo: true, tam: 26, posicion: [24, 22] });
  }, extra: (n) => { n.script = 'scripts/contador.agl'; } },
  { id: 'camara', nombre: 'Cámara que sigue', desc: 'Lo que ve el jugador', icono: 'camara', color: 'var(--turquesa)', crear: async () => crearNodo('Camara2D', 'Cámara', { seguir: 'Jugador', suavizado: 0.15 }) },
  { id: 'particulas', nombre: 'Chispas', desc: 'Efecto de partículas', icono: 'rayos', color: 'var(--aviso)', crear: async () => crearNodo('Particulas2D', 'Chispas', {}) },
];

export async function anadirDelCatalogo(id, doc = est.activo) {
  const c = CATALOGO.find(x => x.id === id);
  if (!c || !doc || doc.tipo !== 'escena') return null;
  const nodo = await c.crear();
  if (c.extra) c.extra(nodo);
  // Posición: cerca del jugador o en el centro de la vista.
  if (Array.isArray(nodo.props.posicion) && nodo.tipo !== 'Etiqueta' && nodo.tipo !== 'Camara2D') {
    let j = null;
    recorrer(doc.datos.raiz, n => { if (!j && n.nombre === 'Jugador') j = n; });
    const cam = doc.vista.camara;
    const base = j ? [j.props.posicion[0] + 220, j.props.posicion[1] - (id === 'moneda' ? 110 : 0)] : cam ? [cam.x, cam.y] : [640, 360];
    nodo.props.posicion = [Math.round(base[0]), Math.round(base[1])];
  }
  const n = anadirNodo(doc, nodo.tipo, { nodo, nombre: nodo.nombre, padre: doc.datos.raiz.id });
  anotarEvento('anadido:' + c.nombre);
  return n;
}

// ---------- API para las lecciones ----------
const cache = { bp: new Map(), script: new Map() };

function escena() { return est.docs.find(d => d.tipo === 'escena' && d === est.activo) || est.docs.find(d => d.tipo === 'escena'); }
function nodo(nombre) { const d = escena(); let r = null; if (d) recorrer(d.datos.raiz, n => { if (!r && n.nombre === nombre) r = n; }); return r; }

function datosDe(rel, tipo) {
  if (!rel) return null;
  const d = documento(rel);
  if (d) return d.datos;
  if (!cache[tipo].has(rel)) {
    cache[tipo].set(rel, null);
    (tipo === 'bp' ? est.proyecto.leerJSON(rel) : est.proyecto.leer(rel)).then(v => { cache[tipo].set(rel, v); bus.emit('curso:revisar'); }).catch(() => {});
  }
  return cache[tipo].get(rel);
}

export const ed = {
  seleccionado: () => est.activo && est.activo.tipo === 'escena' ? est.activo.nodoSel : null,
  nodo,
  ocurrio: (ev, minimo = 1) => (est.eventos.get(ev) || 0) - (estadoCurso.base.get(ev) || 0) >= minimo,
  blueprintDe: (n) => { const x = nodo(n); return x && x.blueprint ? datosDe(x.blueprint, 'bp') || {} : null; },
  scriptDe: (n) => { const x = nodo(n); return x && x.script ? datosDe(x.script, 'script') || '' : null; },
  valorVivo: (n, v) => { const vals = est.vivos.get(n); const x = vals && vals.find(y => y.nombre === v); return x ? (x.crudo ?? Number(x.valor)) : null; },
  seleccionarPorNombre: (n) => { const x = nodo(n); if (x) seleccionar([x.id], escena()); },
  async anadirBlueprintSencillo(nombreNodo = 'Jugador') {
    const d = escena(); const n = nodo(nombreNodo);
    if (!d || !n) return;
    if (n.blueprint) { await abrirDocumento(n.blueprint); return; }
    const bp = blueprintVacio(nombreNodo.toLowerCase(), n.tipo);
    bp.variables = [{ nombre: 'altura_salto', tipo: 'decimal', valor: n.props.salto || 420, exportar: true }];
    const a = idNodoBp(), b = idNodoBp(), v = idNodoBp();
    bp.grafos.eventos.nodos = [
      { id: a, def: 'ev_pulsar', x: 60, y: 80, valores: { accion: 'saltar' } },
      { id: b, def: 'mv_saltar', x: 460, y: 80 },
      { id: v, def: 'var_obtener', variable: 'altura_salto', x: 240, y: 230 },
    ];
    bp.grafos.eventos.conexiones = [{ de: v, salida: 'valor', a: b, entrada: 'fuerza' }];
    bp.grafos.eventos.comentarios = [{ id: 'c1', x: 40, y: 20, ancho: 600, alto: 300, texto: 'Une el triángulo de «Cuando se pulsa» con el de «Saltar».' }];
    const rel = await nuevoBlueprint(n, { sinPreguntar: true, nombre: nombreNodo.toLowerCase(), bp });
    if (!rel) return;
    cambiarNodo(d, n.id, x => { x.blueprint = rel; });
    await abrirDocumento(rel);
  },
  async conectarBloques(nombreNodo, defA, pinA, defB, pinB) {
    const n = nodo(nombreNodo);
    if (!n || !n.blueprint) return;
    const d = await abrirDocumento(n.blueprint);
    const g = d.datos.grafos.eventos;
    const a = g.nodos.find(x => x.def === defA), b = g.nodos.find(x => x.def === defB);
    if (a && b) d.cambiar(() => { g.conexiones = g.conexiones.filter(c => !(c.de === a.id && c.salida === pinA)); g.conexiones.push({ de: a.id, salida: pinA, a: b.id, entrada: pinB }); });
  },
  async abrirBlueprintDe(nombreNodo) { const n = nodo(nombreNodo); if (n && n.blueprint) await abrirDocumento(n.blueprint); else await ed.anadirBlueprintSencillo(nombreNodo); },
  async anadirBloques(nombreNodo, defs) {
    const n = nodo(nombreNodo); if (!n || !n.blueprint) return;
    const d = await abrirDocumento(n.blueprint);
    const g = d.datos.grafos.eventos;
    d.cambiar(() => { defs.forEach((def, i) => { if (!g.nodos.some(x => x.def === def)) g.nodos.push({ id: idNodoBp(), def, x: 260 + i * 10, y: 300 + i * 120 }); }); });
  },
  async solucionSueloBlueprint(nombreNodo) {
    await ed.anadirBloques(nombreNodo, ['lg_si', 'mv_suelo']);
    const n = nodo(nombreNodo);
    const d = documento(n.blueprint);
    const g = d.datos.grafos.eventos;
    const ev = g.nodos.find(x => x.def === 'ev_pulsar'), si = g.nodos.find(x => x.def === 'lg_si'), sal = g.nodos.find(x => x.def === 'mv_saltar'), su = g.nodos.find(x => x.def === 'mv_suelo');
    d.cambiar(() => {
      si.x = 300; si.y = 80; sal.x = 540; su.x = 60; su.y = 240;
      g.conexiones = g.conexiones.filter(c => !(c.de === ev.id && c.salida === 'salida') && !(c.a === si.id) && !(c.de === si.id));
      g.conexiones.push({ de: ev.id, salida: 'salida', a: si.id, entrada: 'entrada' }, { de: si.id, salida: 'verdadero', a: sal.id, entrada: 'entrada' }, { de: su.id, salida: 'valor', a: si.id, entrada: 'condicion' });
    });
  },
  async crearScriptSencillo(nombreNodo) {
    const d = escena(); const n = nodo(nombreNodo);
    if (!n) return;
    if (n.script) { await abrirDocumento(n.script); return; }
    const rel = await nuevoScript(n, { sinPreguntar: true, nombre: nombreNodo.toLowerCase() + '_reglas', texto: `# Reglas de ${nombreNodo} escritas en Águila\n\ncuando empieza():\n    pasar\n` });
    if (!rel) return;
    cambiarNodo(d, n.id, x => { x.script = rel; });
    await abrirDocumento(rel);
  },
  anadirPrefab: (id) => anadirDelCatalogo(id, escena()),
  abrirExportar: () => dialogoExportar(),
};

// ---------- Estado del curso ----------
export const estadoCurso = { leccion: 0, hechos: new Set(), base: new Map() };

export function cargarCurso() {
  const l = est.proyecto.datos.lecciones ||= {};
  estadoCurso.leccion = Math.min(LECCIONES.length - 1, l.leccion || 0);
  estadoCurso.hechos = new Set((l.pasos && l.pasos[LECCIONES[estadoCurso.leccion].id]) || []);
  estadoCurso.base = new Map(est.eventos);
}

async function guardarCurso() {
  const l = est.proyecto.datos.lecciones ||= {};
  l.leccion = estadoCurso.leccion;
  l.pasos ||= {};
  l.pasos[LECCIONES[estadoCurso.leccion].id] = [...estadoCurso.hechos];
  await est.proyecto.guardar();
}

export function leccionActual() { return LECCIONES[estadoCurso.leccion]; }
export function pasoActual() { const l = leccionActual(); return l.pasos.findIndex((_, i) => !estadoCurso.hechos.has(i)); }

// Revisa los pasos de la lección actual. Devuelve true si cambió algo.
export function revisar() {
  const l = leccionActual();
  let cambio = false;
  l.pasos.forEach((p, i) => {
    if (estadoCurso.hechos.has(i)) return;
    // Los pasos se completan en orden.
    if ([...Array(i).keys()].some(j => !estadoCurso.hechos.has(j))) return;
    let ok = false;
    try { ok = !!p.comprobar(ed); } catch {}
    if (ok) { estadoCurso.hechos.add(i); cambio = true; }
  });
  if (cambio) { guardarCurso(); bus.emit('curso:cambio'); }
  return cambio;
}

export async function irALeccion(i) {
  estadoCurso.leccion = Math.max(0, Math.min(LECCIONES.length - 1, i));
  const l = est.proyecto.datos.lecciones ||= {};
  estadoCurso.hechos = new Set((l.pasos && l.pasos[LECCIONES[estadoCurso.leccion].id]) || []);
  estadoCurso.base = new Map(est.eventos);
  await guardarCurso();
  bus.emit('curso:cambio');
  revisar();
}

export async function solucionPaso() {
  const i = pasoActual();
  const p = leccionActual().pasos[i];
  if (p && p.solucion) { await p.solucion(ed); setTimeout(revisar, 300); return true; }
  return false;
}

let revisando = false;
export function iniciarRevisiones() {
  if (revisando) return;
  revisando = true;
  const r = () => setTimeout(revisar, 30);
  for (const ev of ['evento', 'seleccion', 'doc:cambio', 'doc:guardado', 'juego:vivos', 'curso:revisar', 'doc:activo']) bus.on(ev, r);
  bus.on('doc:guardado', (d) => { if (d.tipo === 'script') cache.script.set(d.rel, d.datos); if (d.tipo === 'blueprint') cache.bp.set(d.rel, d.datos); });
  bus.on('script:texto', (d) => { cache.script.set(d.rel, d.datos); r(); });
}
