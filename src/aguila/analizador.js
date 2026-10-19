// Análisis de código Águila para el editor: errores, avisos, símbolos y formato.

import { analizar } from './sintaxis.js';
import { analizarLexico } from './lexico.js';
import { ErrorAguila, sugerir, PALABRAS_EXTRANJERAS } from './errores.js';
import { FUNCIONES, EVENTOS } from './biblioteca.js';

const NOMBRES_GLOBALES = new Set([...FUNCIONES.map(f => f.nombre), 'esperar', 'tangente', 'verdad']);
const NOMBRES_EVENTOS = new Set(EVENTOS.map(e => e.nombre));

function tipoLiteral(n) {
  if (!n) return 'nulo';
  switch (n.tipo) {
    case 'Num': return Number.isInteger(n.valor) ? 'entero' : 'decimal';
    case 'Texto': return 'texto';
    case 'Bool': return 'sí/no';
    case 'Lista': return 'lista';
    case 'Dicc': return 'diccionario';
    case 'Unaria': return n.op === '-' ? tipoLiteral(n.expr) : 'sí/no';
    case 'Binaria': {
      if (['==', '!=', '<', '>', '<=', '>=', 'en'].includes(n.op)) return 'sí/no';
      const a = tipoLiteral(n.izq), b = tipoLiteral(n.der);
      if (a === 'texto' || b === 'texto') return 'texto';
      if (a === 'decimal' || b === 'decimal' || n.op === '/') return 'decimal';
      if (a === 'entero' && b === 'entero') return 'entero';
      return 'valor';
    }
    case 'Logica': return 'sí/no';
    default: return 'valor';
  }
}

function valorLiteral(n) {
  if (!n) return null;
  if (n.tipo === 'Num' || n.tipo === 'Texto' || n.tipo === 'Bool') return n.valor;
  if (n.tipo === 'Unaria' && n.op === '-' && n.expr.tipo === 'Num') return -n.expr.valor;
  if (n.tipo === 'Nulo') return null;
  return undefined;
}

/**
 * @param {string} fuente
 * @param {object} contexto { miembros: Iterable<string>, nombresEscena: string[], archivo }
 */
export function analizarCodigo(fuente, contexto = {}) {
  const { programa, errores } = analizar(fuente, contexto.archivo);
  const avisos = [];
  const simbolos = { clase: null, base: null, variables: [], funciones: [], eventos: [], clases: [] };
  const bloques = []; // { desde, hasta, titulo, nivel }
  const miembros = new Set(contexto.miembros || []);
  const escena = new Set(contexto.nombresEscena || []);
  const escenaMin = new Map([...escena].map(n => [normalizar(n), n]));

  // Cuerpo efectivo del script (si es una clase de nodo, su contenido).
  let cuerpo = programa.cuerpo;
  const claseNodo = cuerpo.find(s => s.tipo === 'Clase' && s.base);
  if (claseNodo) {
    simbolos.clase = claseNodo.nombre;
    simbolos.base = claseNodo.base;
    bloques.push({ desde: claseNodo.linea, hasta: ultimaLinea(claseNodo), titulo: claseNodo.nombre, nivel: 0 });
  }

  const nivelScript = new Map();
  const declarar = (ambito, nombre, info) => ambito.set(nombre, info);

  function recogerNivel(lista, enClase) {
    for (const s of lista) {
      if (s.tipo === 'DeclVar') {
        declarar(nivelScript, s.nombre, { tipo: 'variable' });
        simbolos.variables.push({ nombre: s.nombre, tipo: tipoLiteral(s.valor), exportar: s.exportar, constante: s.constante, linea: s.linea, valor: valorLiteral(s.valor) });
      } else if (s.tipo === 'Funcion') {
        declarar(nivelScript, s.nombre, { tipo: 'función' });
        simbolos.funciones.push({ nombre: s.nombre, params: s.params.map(p => p.nombre), linea: s.linea });
      } else if (s.tipo === 'Cuando') {
        simbolos.eventos.push({ evento: s.evento, params: s.params.map(p => p.nombre), filtro: s.filtro, linea: s.linea });
      } else if (s.tipo === 'Clase') {
        declarar(nivelScript, s.nombre, { tipo: 'clase' });
        if (s.base && !enClase) recogerNivel(s.cuerpo, true);
        else simbolos.clases.push({ nombre: s.nombre, linea: s.linea });
      }
    }
  }
  recogerNivel(cuerpo, false);

  const conocido = (nombre, ambitos) => {
    for (const a of ambitos) if (a.has(nombre)) return true;
    if (nivelScript.has(nombre) || miembros.has(nombre) || NOMBRES_GLOBALES.has(nombre)) return true;
    if (escena.has(nombre) || escenaMin.has(normalizar(nombre))) return true;
    if (contexto.globalesExtra && contexto.globalesExtra.has(nombre)) return true;
    return false;
  };

  const candidatos = (ambitos) => {
    const s = new Set([...nivelScript.keys(), ...miembros, ...NOMBRES_GLOBALES, ...escena]);
    for (const a of ambitos) for (const k of a.keys()) s.add(k);
    return s;
  };

  function avisoNombre(n, ambitos) {
    if (PALABRAS_EXTRANJERAS[n.nombre]) {
      const ok = PALABRAS_EXTRANJERAS[n.nombre];
      avisos.push(new ErrorAguila(`«${n.nombre}» no es de Águila; se escribe «${ok}».`, {
        linea: n.linea, columna: n.col, finColumna: n.finCol, tipo: 'error', fase: 'analisis',
        explicacion: `Águila usa palabras en español. En lugar de «${n.nombre}» escribe «${ok}».`,
        arreglo: { titulo: `Cambiar por «${ok}»`, cambios: [{ linea: n.linea, desde: n.col, hasta: n.finCol, texto: ok }] },
      }));
      return;
    }
    const s = sugerir(n.nombre, candidatos(ambitos));
    avisos.push(new ErrorAguila(`no conozco «${n.nombre}».` + (s ? ` ¿Querías decir «${s}»?` : ''), {
      linea: n.linea, columna: n.col, finColumna: n.finCol, tipo: 'aviso', fase: 'analisis',
      explicacion: s ? `Puede que sea una errata: existe «${s}».` : 'Si es una variable, créala antes con «variable». Si es un nodo de la escena, revisa que se llame exactamente así.',
      arreglo: s ? { titulo: `Cambiar por «${s}»`, cambios: [{ linea: n.linea, desde: n.col, hasta: n.finCol, texto: s }] } : null,
    }));
  }

  function expr(n, ambitos) {
    if (!n) return;
    switch (n.tipo) {
      case 'Nombre': if (!conocido(n.nombre, ambitos)) avisoNombre(n, ambitos); return;
      case 'Lista': n.elementos.forEach(e => expr(e, ambitos)); return;
      case 'Dicc': n.pares.forEach(([k, v]) => { expr(k, ambitos); expr(v, ambitos); }); return;
      case 'Unaria': expr(n.expr, ambitos); return;
      case 'Binaria': case 'Logica': expr(n.izq, ambitos); expr(n.der, ambitos); return;
      case 'Miembro': expr(n.obj, ambitos); return;
      case 'Indice': expr(n.obj, ambitos); expr(n.indice, ambitos); return;
      case 'Llamada': expr(n.fn, ambitos); n.args.forEach(a => expr(a, ambitos)); return;
    }
  }

  function bloque(lista, ambitos, nivel, titulo) {
    const local = new Map();
    const pila = [local, ...ambitos];
    for (const s of lista) sentencia(s, pila, nivel);
  }

  function sentencia(s, ambitos, nivel) {
    const local = ambitos[0];
    switch (s.tipo) {
      case 'DeclVar': expr(s.valor, ambitos); local.set(s.nombre, true); return;
      case 'Asignar':
        if (s.objetivo.tipo === 'Nombre' && !conocido(s.objetivo.nombre, ambitos)) {
          avisos.push(new ErrorAguila(`la variable «${s.objetivo.nombre}» no existe todavía.`, {
            linea: s.linea, columna: s.objetivo.col, finColumna: s.objetivo.finCol, tipo: 'error', fase: 'analisis',
            explicacion: 'Antes de usar una variable hay que crearla con «variable».',
            arreglo: { titulo: 'Declararla con «variable»', cambios: [{ linea: s.linea, desde: s.objetivo.col, hasta: s.objetivo.col, texto: 'variable ' }] },
          }));
          local.set(s.objetivo.nombre, true);
        } else expr(s.objetivo, ambitos);
        expr(s.valor, ambitos);
        return;
      case 'Expresion': expr(s.expr, ambitos); return;
      case 'Si':
        s.ramas.forEach(r => { expr(r.cond, ambitos); bloque(r.cuerpo, ambitos, nivel + 1); });
        if (s.sino) bloque(s.sino, ambitos, nivel + 1);
        return;
      case 'Mientras': expr(s.cond, ambitos); bloque(s.cuerpo, ambitos, nivel + 1); return;
      case 'Repetir': expr(s.veces, ambitos); bloque(s.cuerpo, ambitos, nivel + 1); return;
      case 'ParaCada': {
        expr(s.iterable, ambitos);
        const a = new Map([[s.variable, true]]);
        bloque(s.cuerpo, [a, ...ambitos], nivel + 1);
        return;
      }
      case 'Funcion': {
        const a = new Map(s.params.map(p => [p.nombre, true]));
        bloques.push({ desde: s.linea, hasta: ultimaLinea(s), titulo: `función ${s.nombre}(${s.params.map(p => p.nombre).join(', ')})`, nivel });
        bloque(s.cuerpo, [a, ...ambitos], nivel + 1);
        return;
      }
      case 'Cuando': {
        if (!NOMBRES_EVENTOS.has(s.evento)) {
          const sug = sugerir(s.evento, NOMBRES_EVENTOS);
          avisos.push(new ErrorAguila(`no conozco el evento «${s.evento}».` + (sug ? ` ¿Querías decir «${sug}»?` : ''), {
            linea: s.linea, columna: 7, finColumna: 7 + s.evento.length, tipo: 'aviso', fase: 'analisis',
            explicacion: 'Los eventos disponibles son: ' + [...NOMBRES_EVENTOS].join(', ') + '.',
          }));
        }
        const a = new Map(s.params.map(p => [p.nombre, true]));
        const arg = s.filtro !== null && s.filtro !== undefined ? JSON.stringify(s.filtro) : s.params.map(p => p.nombre).join(', ');
        bloques.push({ desde: s.linea, hasta: ultimaLinea(s), titulo: `cuando ${s.evento}(${arg})`, nivel });
        bloque(s.cuerpo, [a, ...ambitos], nivel + 1);
        return;
      }
      case 'Clase': {
        if (!s.base) bloques.push({ desde: s.linea, hasta: ultimaLinea(s), titulo: `clase ${s.nombre}`, nivel });
        const a = new Map();
        for (const m of s.cuerpo) if (m.tipo === 'DeclVar' || m.tipo === 'Funcion') a.set(m.nombre, true);
        bloque(s.cuerpo, [a, ...ambitos], nivel + 1);
        return;
      }
    }
  }

  bloque(cuerpo, [], 0);

  // El final de cada bloque se calcula por sangría, para que la ruta funcione aunque haya errores.
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n');
  const sangria = (l) => (l.match(/^ */) || [''])[0].length;
  for (const b of bloques) {
    const s0 = sangria(lineas[b.desde - 1] || '');
    let fin = b.desde;
    for (let i = b.desde; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      if (sangria(l) <= s0) break;
      fin = i + 1;
    }
    b.hasta = Math.max(b.hasta, fin);
  }

  return {
    programa,
    errores: errores.map(e => { e.fase = 'sintaxis'; return e; }),
    avisos,
    simbolos,
    bloques,
  };
}

function normalizar(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

function ultimaLinea(s) {
  let max = s.linea || 0;
  const visitar = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(visitar); return; }
    if (typeof x.linea === 'number' && x.linea > max) max = x.linea;
    for (const k of ['cuerpo', 'ramas', 'sino', 'expr', 'valor', 'cond', 'args', 'izq', 'der', 'elementos']) if (x[k]) visitar(x[k]);
  };
  visitar(s.cuerpo); visitar(s.ramas); visitar(s.sino);
  return max;
}

// Ruta de la posición del cursor: «Jugador › cuando toca(otro)».
export function rutaEnLinea(analisis, linea) {
  const partes = analisis.bloques
    .filter(b => linea >= b.desde && linea <= Math.max(b.hasta, b.desde))
    .sort((a, b) => a.desde - b.desde);
  return partes.map(b => b.titulo);
}

// ---- Formateo («Ordenar código») ----

const SIN_ESPACIO_ANTES = new Set([',', ')', ']', '}', ':', '.']);
const SIN_ESPACIO_DESPUES = new Set(['(', '[', '{', '.']);

export function formatear(fuente) {
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n');
  const { errores } = analizarLexico(fuente);
  if (errores.length) return fuente; // no tocar código con errores de escritura

  const salida = [];
  const pila = [0];
  let profundidad = 0;
  let blancos = 0;
  for (const original of lineas) {
    const sinFin = original.replace(/\s+$/, '');
    if (!sinFin.trim()) { blancos++; continue; }
    const ancho = medirSangria(sinFin);
    if (profundidad === 0) {
      while (pila.length > 1 && ancho < pila[pila.length - 1]) pila.pop();
      if (ancho > pila[pila.length - 1]) pila.push(ancho);
    }
    const nivel = pila.length - 1;
    if (blancos) salida.push(...Array(Math.min(blancos, 2)).fill(''));
    blancos = 0;
    const cuerpo = profundidad === 0 ? ' '.repeat(nivel * 4) + espaciar(sinFin.trim()) : sinFin;
    salida.push(cuerpo);
    // Contar paréntesis abiertos para líneas partidas.
    for (const c of quitarTextos(sinFin)) {
      if ('([{'.includes(c)) profundidad++;
      else if (')]}'.includes(c)) profundidad = Math.max(0, profundidad - 1);
    }
  }
  while (salida.length && !salida[salida.length - 1]) salida.pop();
  return salida.join('\n') + '\n';
}

function medirSangria(s) {
  let a = 0;
  for (const c of s) { if (c === ' ') a++; else if (c === '\t') a += 4 - (a % 4); else break; }
  return a;
}

function quitarTextos(s) {
  return s.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|«[^»]*»/g, '""').replace(/#.*$/, '');
}

// Espaciado alrededor de operadores, respetando textos y comentarios.
function espaciar(linea) {
  const { fichas } = analizarLexico(linea);
  const utiles = fichas.filter(f => !['NUEVA_LINEA', 'SANGRIA', 'DESANGRIA', 'FIN'].includes(f.tipo));
  if (!utiles.length) return linea;
  const ultimo = utiles[utiles.length - 1];
  const comentario = linea.slice(ultimo.finCol).trim();
  let r = '';
  let prev = null;
  for (const f of utiles) {
    const crudo = linea.slice(f.col, f.finCol);
    if (prev) {
      const unarioPrevio = prev.tipo === 'OP' && prev.valor === '-' && esUnario(prev._anterior);
      let espacio = true;
      if (f.tipo === 'OP' && SIN_ESPACIO_ANTES.has(f.valor)) espacio = false;
      if (prev.tipo === 'OP' && SIN_ESPACIO_DESPUES.has(prev.valor)) espacio = false;
      if (f.tipo === 'OP' && (f.valor === '(' || f.valor === '[') && (prev.tipo === 'NOMBRE' || (prev.tipo === 'OP' && (prev.valor === ')' || prev.valor === ']')))) espacio = false;
      if (unarioPrevio) espacio = false;
      if (prev.tipo === 'CLAVE' && f.tipo === 'OP' && f.valor === '(' && prev.valor !== 'y' && prev.valor !== 'o' && prev.valor !== 'no' && prev.valor !== 'en' && prev.valor !== 'si' && prev.valor !== 'mientras' && prev.valor !== 'devolver') espacio = false;
      r += espacio ? ' ' : '';
    }
    f._anterior = prev;
    r += crudo;
    prev = f;
  }
  return comentario ? r + '  ' + comentario : r;
}

function esUnario(antes) {
  if (!antes) return true;
  if (antes.tipo === 'OP' && ![')', ']', '}'].includes(antes.valor)) return true;
  if (antes.tipo === 'CLAVE' && !['verdadero', 'falso', 'nulo', 'yo'].includes(antes.valor)) return true;
  return false;
}
