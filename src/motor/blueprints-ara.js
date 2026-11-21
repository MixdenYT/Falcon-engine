// El compilador de Blueprints: escrito en Ara (src/motor/ara-blueprints/blueprints.ara) y precompilado a
// blueprints.wasm con herramientas/compilar-blueprints-ara.mjs. Es el único: no hay otro en JS. JS solo aplana el
// catálogo y la API (una vez, con llamadas escalares) y el `.bp` (un texto plano por compilación); Ara valida, tipa y
// genera, y devuelve el resultado por cuatro externas.

import { cargar } from '../ara/ara.mjs';
import { leerPropio, runtimeAra, compilado } from '../ara/puente.js';
import { API_MOTOR } from '../ara/api-motor.js';
import { NODOS } from './blueprints.js';

let promesa = null, ara = null, fallo = null;

/** Carga blueprints.wasm (una vez). Hay que esperarla antes de usar `compilarBlueprint`. */
export function cargarCompiladorBlueprints() {
  return (promesa ||= crear().then((c) => { ara = c; fallo = null; }, (e) => {
    promesa = null;
    throw (fallo = new Error('No se pudo cargar el compilador de Blueprints (blueprints.wasm): ' + (e?.message || e)));
  }));
}

/**
 * Compila un Blueprint a Ara (síncrono, tras `await cargarCompiladorBlueprints()`).
 * @param {object} bp  El Blueprint.
 * @param {string} archivo  Su ruta en el proyecto (da el nombre de la clase, ver `claseBlueprint`).
 * @returns {{ codigo: string, clase: string, errores: Array<{mensaje, nodo}>, avisos: Array<{mensaje, nodo}>, lineas: Object<string, number> }}
 *   `lineas` da la línea del código de cada bloque.
 */
export function compilarBlueprint(bp, archivo = 'blueprint.bp') {
  if (!ara) throw fallo || new Error('El compilador de Blueprints no está cargado: falta esperar a cargarCompiladorBlueprints().');
  return ara.compilar(bp, archivo);
}

async function crear() {
  const [bytes, runtime] = await Promise.all([leerPropio('../motor/ara-blueprints/blueprints.wasm', false), runtimeAra()]);
  let r = null; // el resultado de la compilación en curso
  const ara = await cargar(bytes, {
    runtime: compilado(runtime),
    anfitrion: (ara) => ({
      bp_codigo: (p) => { r.codigo = ara.leerTexto(p); },
      bp_clase: (p) => { r.clase = ara.leerTexto(p); },
      bp_error: (m, n, hay, aviso) => (aviso ? r.avisos : r.errores).push({ mensaje: ara.leerTexto(m), nodo: hay ? r.ids.get(ara.leerTexto(n)) : null }),
      bp_linea: (n, linea) => { r.lineas[ara.leerTexto(n)] = Number(linea); },
    }),
  });
  const E = ara.exports;
  const yo = E['Blueprints.crear'](0);
  const f = (nombre) => E['Blueprints.func.' + nombre].bind(null, yo);
  const T = (s) => ara.textoNuevo(s);
  // Un valor de JS cruza como su clase (1 null/undefined, 2 booleano, 3 número, 4 texto, 5 otro), String(v) y Number(v).
  const V = (v) => [v == null ? 1 : typeof v === 'boolean' ? 2 : typeof v === 'number' ? 3 : typeof v === 'string' ? 4 : 5, T(String(v)), Number(v)];
  const tipo = (t) => T(t == null ? '' : String(t));
  const comprobar = () => { const e = ara.error(); if (e) { ara.limpiarError(); throw new Error('compilador de Blueprints de Ara: ' + e.mensaje); } };

  const catNodo = f('cat_nodo'), catParam = f('cat_param'), catEntrada = f('cat_entrada'), catSalida = f('cat_salida');
  for (const [id, d] of Object.entries(NODOS)) {
    catNodo(T(id), T(d.titulo), T(d.evento || ''), T(d.filtro || ''), d.esEvento ? 1 : 0);
    for (const p of d.params || []) catParam(T(p));
    for (const p of d.entradas) catEntrada(T(p.n), T(p.t), T(p.etq), ...V(p.def));
    for (const p of d.salidas) catSalida(T(p.n), T(p.t));
  }
  const api = API_MOTOR, apiFirma = f('api_firma'), apiParam = f('api_param'), apiEvento = f('api_evento'), apiEventoParam = f('api_evento_param');
  for (const [t, b] of Object.entries(api.tipos)) f('api_tipo')(T(t), tipo(b));
  for (const [k, t] of Object.entries(api.propiedades)) f('api_propiedad')(T(k), tipo(t));
  for (const [k, firmas] of Object.entries(api.metodos)) for (const fi of firmas) { apiFirma(T(k), tipo(fi.retorno)); for (const p of fi.params) apiParam(tipo(p.tipo)); }
  for (const [k, ps] of Object.entries(api.eventos)) { apiEvento(T(k)); for (const p of ps) apiEventoParam(tipo(p.tipo)); }
  comprobar();

  // El `.bp` cruza en un solo texto (ver `leer_bp` en blueprints.ara): campos separados por \x1f, cada registro con
  // su letra delante y, dentro de los textos, \x1b escapa a \x1f y a sí mismo. Un valor va como clase, String y Number.
  const t = (s) => { s = String(s); return /[\x1b\x1f]/.test(s) ? s.replace(/[\x1b\x1f]/g, (c) => c === '\x1b' ? '\x1b0' : '\x1b2') : s; };
  const v = (x) => `${x == null ? 1 : typeof x === 'boolean' ? 2 : typeof x === 'number' ? 3 : typeof x === 'string' ? 4 : 5}\x1f${t(x)}\x1f${Number(x)}`;
  const compilar = f('bp_compilar');
  return {
    compilar(bp, archivo) {
      r = { codigo: '', clase: '', errores: [], avisos: [], lineas: {}, ids: new Map() };
      const regs = [`E\x1f${v(archivo)}\x1f${v(bp.base)}`];
      for (const x of bp.variables || []) regs.push(`V\x1f${v(x.nombre)}\x1f${t(x.tipo ?? '')}\x1f${v(x.valor)}\x1f${x.exportar ? 1 : 0}`);
      for (const fn of bp.funciones || []) {
        regs.push(`F\x1f${v(fn.nombre)}`);
        for (const p of fn.params || []) regs.push(`P\x1f${v(p.nombre)}\x1f${t(p.tipo ?? '')}`);
      }
      for (const [nombre, g] of Object.entries(bp.grafos || {})) {
        regs.push(`G\x1f${t(nombre)}`);
        for (const n of g.nodos || []) {
          const id = String(n.id);
          if (!r.ids.has(id)) r.ids.set(id, n.id);
          regs.push(`N\x1f${t(id)}\x1f${t(n.def)}\x1f${v(n.variable)}\x1f${v(n.funcion)}\x1f${Number(n.x)}\x1f${Number(n.y)}`);
          for (const [pin, x] of Object.entries(n.valores || {})) regs.push(`v\x1f${t(pin)}\x1f${v(x)}`);
        }
        for (const c of g.conexiones || []) regs.push(`C\x1f${t(c.de)}\x1f${t(c.salida)}\x1f${t(c.a)}\x1f${t(c.entrada)}`);
      }
      compilar(T(regs.join('\x1f')));
      comprobar();
      const { codigo, clase, errores, avisos, lineas } = r;
      r = null;
      return { codigo, clase, errores, avisos, lineas };
    },
  };
}
