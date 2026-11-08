// Conversor de scripts de Águila (.agl) a Ara (.ara).
//
// Recorre el árbol de Águila (src/aguila/sintaxis.js) y escribe Ara con tipos: deduce el tipo de cada campo,
// variable, parámetro y resultado (dos pasadas: los campos que reciben un decimal pasan a ser decimales), añade
// las conversiones que Águila hacía sola (`texto(x)`, `x != 0`, `.existe()`…) y traduce lo que cambia de nombre.
// Lo que no sabe traducir lo dice en `problemas`: ese script se queda en Águila (ver `convertirProyecto`).

import { analizar } from '../aguila/index.js';
import { API_MOTOR } from './api-motor.js';
import { miembroDe } from './api.js';

const NUM = new Set(['entero', 'decimal']);
const PALABRAS_ARA = new Set(['importar', 'const', 'global', 'func', 'estructura', 'enumeracion', 'externa', 'clase', 'extiende', 'cuando', 'exportar', 'segun', 'caso', 'devolver', 'si', 'sino', 'mientras', 'para', 'en', 'romper', 'continuar', 'pasar', 'verdadero', 'falso', 'y', 'o', 'no', 'yo', 'este']);
// Precedencias (como en Ara): para poner paréntesis solo donde hacen falta.
const P = { o: 1, y: 2, no: 3, comp: 4, suma: 5, mul: 6, unaria: 7, pot: 8, atomo: 10 };
const PREC_BIN = { '+': P.suma, '-': P.suma, '*': P.mul, '/': P.mul, '%': P.mul, '//': P.mul, '==': P.comp, '!=': P.comp, '<': P.comp, '>': P.comp, '<=': P.comp, '>=': P.comp };
const DEFECTO = { decimal: '0.0', entero: '0', texto: '""', booleano: 'falso', Nodo: 'nodo("")', 'lista[Nodo]': '[]', 'lista[texto]': '[]', 'lista[decimal]': '[]' };

/** Un texto de Ara (escapa y duplica las llaves: en Ara los textos interpolan). */
export function textoAra(s) {
  const esc = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\t': '\\t', '\r': '\\r', '{': '{{', '}': '}}' };
  return '"' + String(s ?? '').replace(/[\\"\n\t\r{}]/g, (c) => esc[c]) + '"';
}

const numero = (n, tipo) => {
  if (tipo === 'entero' && Number.isInteger(n)) return String(n);
  const s = String(n);
  return /[.e]/i.test(s) ? s : s + '.0';
};

/** La clase de un script por el nombre de su archivo: «scripts/enemigo_volador.agl» → «EnemigoVolador». */
export function claseDeArchivo(rel) {
  const base = String(rel).split('/').pop().replace(/\.(agl|ara)$/i, '');
  const c = base.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  const n = /^\p{L}/u.test(c) ? c : 'Script' + c;
  return n in API_MOTOR.tipos ? n + 'Script' : n;
}

class NoSe extends Error {
  constructor(linea, mensaje) { super(mensaje); this.linea = linea; }
}

/**
 * Convierte un script de Águila.
 * @param {string} fuente  El texto del .agl.
 * @param {object} op  { archivo, base (tipo del nodo que lo usa), clase (nombre que debe tener), nodos (nombres de
 *   los nodos de las escenas, para los nombres sueltos que Águila buscaba en la escena) }
 * @returns {{ ok: boolean, codigo: string, clase: string, problemas: Array<{linea, mensaje}> }}
 */
export function convertirAguila(fuente, op = {}) {
  const archivo = op.archivo || 'script.agl';
  const { programa, errores } = analizar(fuente, archivo);
  if (errores.length) return { ok: false, codigo: '', clase: null, problemas: errores.map((e) => ({ linea: e.linea, mensaje: `no es Águila válido: ${e.mensajeCorto}` })) };
  const api = API_MOTOR;
  const problemas = [];

  // ---------- Estructura: una clase con campos, eventos y funciones ----------
  let cuerpo = programa.cuerpo, nombreClase = null, base = null;
  const clases = cuerpo.filter((s) => s.tipo === 'Clase');
  if (clases.length > 1) return { ok: false, codigo: '', clase: null, problemas: [{ linea: clases[1].linea, mensaje: 'tiene más de una clase: en Ara, cada script de un nodo es una sola clase' }] };
  if (clases.length === 1) {
    const sueltos = cuerpo.filter((s) => s.tipo !== 'Clase' && s.tipo !== 'Pasar');
    if (sueltos.length) return { ok: false, codigo: '', clase: null, problemas: [{ linea: sueltos[0].linea, mensaje: 'tiene código fuera de la clase' }] };
    nombreClase = clases[0].nombre; base = clases[0].base; cuerpo = clases[0].cuerpo;
  }
  if (!base || !(base in api.tipos)) base = op.base && op.base in api.tipos ? op.base : 'Nodo';
  if (op.clase) nombreClase = op.clase;
  if (!nombreClase || nombreClase in api.tipos || PALABRAS_ARA.has(nombreClase)) nombreClase = claseDeArchivo(archivo);

  const campos = new Map();     // nombre → { tipo, decl }
  const funciones = new Map();  // nombre → { params: [{nombre, tipo}], retorno, decl }
  const eventos = [];
  for (const s of cuerpo) {
    if (s.tipo === 'DeclVar') campos.set(s.nombre, { tipo: null, decl: s });
    else if (s.tipo === 'Funcion') funciones.set(s.nombre, { params: s.params.map((p) => ({ nombre: p.nombre, tipo: null })), retorno: null, decl: s });
    else if (s.tipo === 'Cuando') eventos.push(s);
    else if (s.tipo !== 'Pasar') problemas.push({ linea: s.linea, mensaje: 'tiene órdenes sueltas fuera de los eventos y funciones: en Ara van dentro de «cuando empieza()»' });
  }
  for (const [n, c] of campos) {
    if (PALABRAS_ARA.has(n)) problemas.push({ linea: c.decl.linea, mensaje: `la variable «${n}» se llama como una palabra de Ara` });
    if (c.decl.valor === null) problemas.push({ linea: c.decl.linea, mensaje: `la variable «${n}» no tiene valor inicial` });
  }
  if (problemas.length) return { ok: false, codigo: '', clase: nombreClase, problemas };

  // ---------- Tipos ----------
  // Los campos y parámetros se ensanchan (entero → decimal) según lo que se les asigna; se repite hasta que no cambia.
  const juntar = (a, b) => !a ? b : !b ? a : a === b ? a : NUM.has(a) && NUM.has(b) ? 'decimal' : a === 'nada' ? b : b === 'nada' ? a : a;
  const nodosEscena = new Set(op.nodos || []);
  const propiedad = (nombre) => { const m = miembroDe(api, base, nombre); return m && m.propiedad ? m.propiedad : null; };
  const metodo = (nombre) => { const m = miembroDe(api, 'Nodo', nombre); return m && m.firmas ? m.firmas : null; };

  let ambito;       // nombre → { tipo, ara }   variables locales y parámetros
  let cambios;
  let lineasComentario;

  const R = (codigo, tipo, prec = P.atomo) => ({ codigo, tipo, prec });
  const par = (r, prec) => r.prec < prec ? `(${r.codigo})` : r.codigo;
  const esNulo = (e) => e && e.tipo === 'Nulo';

  /** Convierte un valor al tipo que se pide (null: el que tenga). */
  function conv(r, destino, linea) {
    if (!destino || !r.tipo || r.tipo === destino || r.tipo === '?') return r;
    if (destino === 'decimal' && r.tipo === 'entero') return /^-?\d+$/.test(r.codigo) ? R(r.codigo + '.0', 'decimal', r.prec) : { ...r, tipo: 'decimal' };
    if (destino === 'entero' && r.tipo === 'decimal') return /^-?\d+\.0$/.test(r.codigo) ? R(r.codigo.slice(0, -2), 'entero', r.prec) : R(`entero(${r.codigo})`, 'entero');
    if (destino === 'texto') {
      if (r.tipo === 'Nodo') return R(`${par(r, P.atomo)}.nombre`, 'texto');
      if (r.tipo === 'decimal') return R(`texto_numero(${r.codigo})`, 'texto');
      return R(`texto(${r.codigo})`, 'texto');
    }
    if (destino === 'booleano') {
      if (NUM.has(r.tipo)) return R(`${par(r, P.comp + 1)} != 0`, 'booleano', P.comp);
      if (r.tipo === 'texto') return R(`${par(r, P.comp + 1)} != ""`, 'booleano', P.comp);
      if (r.tipo === 'Nodo') return R(`${par(r, P.atomo)}.existe()`, 'booleano');
      if (r.tipo.startsWith('lista')) return R(`largo(${r.codigo}) > 0`, 'booleano', P.comp);
    }
    if (destino === 'Nodo' && r.codigo === 'nodo("")') return r;
    throw new NoSe(linea, `aquí hace falta ${destino} y llega ${r.tipo}`);
  }

  // Lo que se escribe sin nada delante: variable local, campo, propiedad del nodo o algo global.
  function nombre(n, linea) {
    if (ambito.has(n)) return R(ambito.get(n).ara, ambito.get(n).tipo);
    if (campos.has(n)) return R(n, campos.get(n).tipo);
    if (n === 'puntos') return R('puntos()', 'entero');
    if (n === 'gravedad' && !propiedad('gravedad')) return R('gravedad_global()', 'decimal');
    const p = propiedad(n);
    if (p) return R(`yo.${n}`, p);
    const nodoEscena = [...nodosEscena].find((x) => x === n) || [...nodosEscena].find((x) => normalizar(x) === normalizar(n));
    if (nodoEscena) return R(`nodo(${textoAra(nodoEscena)})`, 'Nodo');
    throw new NoSe(linea, `no sé qué es «${n}»`);
  }

  /** Una expresión de Águila → { codigo, tipo, prec }. `quiero` es el tipo esperado, si se sabe (para leer campos de otros scripts). */
  function expr(e, quiero = null) {
    switch (e.tipo) {
      case 'Num': return R(numero(e.valor, Number.isInteger(e.valor) && quiero !== 'decimal' ? 'entero' : 'decimal'), Number.isInteger(e.valor) && quiero !== 'decimal' ? 'entero' : 'decimal', e.valor < 0 ? P.unaria : P.atomo);
      case 'Texto': return R(textoAra(e.valor), 'texto');
      case 'Bool': return R(e.valor ? 'verdadero' : 'falso', 'booleano');
      case 'Nulo': return R('nodo("")', 'Nodo');
      case 'Yo': return R('yo', 'Nodo');
      case 'Nombre': return nombre(e.nombre, e.linea);
      case 'Lista': {
        if (!e.elementos.length) return R('[]', quiero && quiero.startsWith('lista') ? quiero : 'lista[decimal]');
        const xs = e.elementos.map((x) => expr(x));
        let t = xs.map((x) => x.tipo).reduce(juntar);
        if (t === 'entero') t = 'decimal';
        return R(`[${xs.map((x) => conv(x, t, e.linea).codigo).join(', ')}]`, `lista[${t}]`);
      }
      case 'Dicc': throw new NoSe(e.linea, 'usa un diccionario: en los scripts de Ara para juegos todavía no se convierten');
      case 'Indice': {
        const o = expr(e.obj), i = conv(expr(e.indice, 'entero'), 'entero', e.linea);
        const m = /^lista\[(.+)\]$/.exec(o.tipo || '');
        if (!m) throw new NoSe(e.linea, 'usa corchetes con algo que no es una lista');
        return R(`${par(o, P.atomo)}[${i.codigo}]`, m[1]);
      }
      case 'Unaria': {
        if (e.op === 'no') return R(`no ${par(conv(expr(e.expr, 'booleano'), 'booleano', e.linea), P.no)}`, 'booleano', P.no);
        const x = expr(e.expr, quiero);
        if (!NUM.has(x.tipo) && x.tipo !== '?') throw new NoSe(e.linea, 'cambia de signo algo que no es un número');
        return R(`-${par(x, P.unaria)}`, x.tipo, P.unaria);
      }
      case 'Logica': {
        const a = conv(expr(e.izq, 'booleano'), 'booleano', e.linea), b = conv(expr(e.der, 'booleano'), 'booleano', e.linea);
        const p = e.op === 'y' ? P.y : P.o;
        return R(`${par(a, p)} ${e.op} ${par(b, p + 1)}`, 'booleano', p);
      }
      case 'Binaria': return binaria(e, quiero);
      case 'Miembro': return miembro(e, quiero);
      case 'Llamada': return llamada(e, quiero);
      default: throw new NoSe(e.linea, `no sé convertir «${e.tipo}»`);
    }
  }

  function binaria(e, quiero) {
    const op = e.op;
    if (op === 'en') throw new NoSe(e.linea, 'usa «en» como operador');
    if ((op === '==' || op === '!=') && (esNulo(e.izq) || esNulo(e.der))) {
      const x = conv(expr(esNulo(e.izq) ? e.der : e.izq, 'Nodo'), 'Nodo', e.linea);
      return op === '==' ? R(`no ${par(x, P.atomo)}.existe()`, 'booleano', P.no) : R(`${par(x, P.atomo)}.existe()`, 'booleano');
    }
    if (op === '**') {
      const a = conv(expr(e.izq, 'decimal'), 'decimal', e.linea), b = conv(expr(e.der, 'decimal'), 'decimal', e.linea);
      return R(`potencia(${a.codigo}, ${b.codigo})`, 'decimal');
    }
    const pista = quiero && NUM.has(quiero) ? quiero : null;
    let a = expr(e.izq, pista), b = expr(e.der, pista);
    const p = PREC_BIN[op] || P.comp;
    if (op === '+' && (a.tipo === 'texto' || b.tipo === 'texto')) {
      a = conv(a, 'texto', e.linea); b = conv(b, 'texto', e.linea);
      return R(`${par(a, p)} + ${par(b, p + 1)}`, 'texto', p);
    }
    if (p === P.comp) {
      if (op === '==' || op === '!=') {
        if (a.tipo === 'texto' || b.tipo === 'texto') { a = conv(a, 'texto', e.linea); b = conv(b, 'texto', e.linea); }
        else if (!(a.tipo === b.tipo && ['booleano', 'Nodo'].includes(a.tipo))) { a = conv(a, 'decimal', e.linea); b = conv(b, 'decimal', e.linea); }
      } else { a = conv(a, 'decimal', e.linea); b = conv(b, 'decimal', e.linea); }
      return R(`${par(a, p + 1)} ${op} ${par(b, p + 1)}`, 'booleano', p);
    }
    // Aritmética: entero con entero sigue entero (salvo /), si no decimal.
    const t = a.tipo === 'entero' && b.tipo === 'entero' && op !== '/' ? 'entero' : 'decimal';
    a = conv(a, t, e.linea); b = conv(b, t, e.linea);
    return R(`${par(a, p)} ${op} ${par(b, p + 1)}`, t, p);
  }

  function miembro(e, quiero) {
    if (e.obj.tipo === 'Yo') return nombre(e.nombre, e.linea);
    const o = conv(expr(e.obj, 'Nodo'), 'Nodo', e.linea);
    const p = miembroDe(api, 'Nodo', e.nombre);
    if (p && p.propiedad) return R(`${par(o, P.atomo)}.${e.nombre}`, p.propiedad);
    // Un campo del script de otro nodo: por su nombre, con el tipo que se espere aquí.
    const t = quiero === 'texto' ? 'texto' : quiero === 'booleano' ? 'booleano' : quiero === 'Nodo' ? 'Nodo' : 'decimal';
    const leer = { texto: 'leer_texto', booleano: 'leer_booleano', Nodo: 'leer_nodo', decimal: 'leer_numero' }[t];
    return R(`${par(o, P.atomo)}.${leer}(${textoAra(e.nombre)})`, t);
  }

  /** Argumentos convertidos a los tipos de una firma. */
  const argumentos = (args, tipos, linea) => args.map((a, i) => conv(expr(a, tipos[i]), tipos[i], linea).codigo);

  function llamarFirma(prefijo, nombre, firmas, args, linea) {
    const f = firmas.find((x) => x.params.length === args.length);
    if (!f) throw new NoSe(linea, `«${nombre}» recibe ${[...new Set(firmas.map((x) => x.params.length))].join(' o ')} dato(s), no ${args.length}`);
    return R(`${prefijo}${nombre}(${argumentos(args, f.params.map((p) => p.tipo), linea).join(', ')})`, f.retorno);
  }

  function llamada(e, quiero) {
    const args = e.args, l = e.linea;
    if (e.fn.tipo === 'Miembro') {
      const objeto = e.fn.obj, n = e.fn.nombre;
      const lista = objeto.tipo !== 'Yo' ? (() => { try { return expr(objeto); } catch { return null; } })() : null;
      if (lista && lista.tipo && lista.tipo.startsWith('lista')) {
        if (n === 'añadir' || n === 'agregar') return R(`agregar(${lista.codigo}, ${conv(expr(args[0]), lista.tipo.slice(6, -1), l).codigo})`, 'nada');
        throw new NoSe(l, `usa el método de lista «${n}»`);
      }
      const o = objeto.tipo === 'Yo' ? R('yo', 'Nodo') : conv(expr(objeto, 'Nodo'), 'Nodo', l);
      if (n === 'llamar' && args.length >= 1 && args[0].tipo === 'Texto') {
        const resto = args.slice(1).map((a) => conv(expr(a, 'decimal'), 'decimal', l).codigo);
        if (resto.length > 3) throw new NoSe(l, 'llama a una función de otro nodo con más de tres datos');
        return R(`${par(o, P.atomo)}.${quiero && quiero !== 'nada' ? 'consultar' : 'llamar'}(${[textoAra(args[0].valor), ...resto].join(', ')})`, quiero && quiero !== 'nada' ? 'decimal' : 'nada');
      }
      if (objeto.tipo === 'Yo' && funciones.has(n)) return llamadaFuncion(n, args, l);
      const firmas = metodo(n);
      if (!firmas) throw new NoSe(l, `usa «.${n}()», que los nodos no tienen en Ara`);
      return llamarFirma(`${par(o, P.atomo)}.`, n, firmas, args, l);
    }
    if (e.fn.tipo !== 'Nombre') throw new NoSe(l, 'llama a algo que no es una función por su nombre');
    const n = e.fn.nombre;
    if (funciones.has(n) && !ambito.has(n)) return llamadaFuncion(n, args, l);
    const num = (i, t = 'decimal') => conv(expr(args[i], t), t, l);
    switch (n) {
      case 'mostrar': return R(`imprimir(${args.map((a) => { const r = expr(a); return (r.tipo === 'decimal' || r.tipo === 'Nodo' ? conv(r, 'texto', l) : r).codigo; }).join(', ')})`, 'nada');
      case 'texto': return conv(expr(args[0]), 'texto', l);
      case 'entero': return conv(num(0), 'entero', l);
      case 'decimal': return num(0);
      case 'largo': return R(`largo(${expr(args[0]).codigo})`, 'entero');
      case 'min': case 'max': case 'minimo': case 'maximo': {
        if (args.length !== 2) throw new NoSe(l, `usa ${n} con ${args.length} datos`);
        const a = expr(args[0]), b = expr(args[1]);
        const t = a.tipo === 'entero' && b.tipo === 'entero' ? 'entero' : 'decimal';
        return R(`${n.startsWith('min') ? 'minimo' : 'maximo'}(${conv(a, t, l).codigo}, ${conv(b, t, l).codigo})`, t);
      }
      case 'abs': { const a = expr(args[0]); return R(`abs(${conv(a, a.tipo === 'entero' ? 'entero' : 'decimal', l).codigo})`, a.tipo === 'entero' ? 'entero' : 'decimal'); }
      case 'raiz': return R(`raiz(${num(0).codigo})`, 'decimal');
      case 'potencia': return R(`potencia(${num(0).codigo}, ${num(1).codigo})`, 'decimal');
      case 'redondear_abajo': return R(`piso(${num(0).codigo})`, 'entero');
      case 'redondear_arriba': return R(`techo(${num(0).codigo})`, 'entero');
      case 'redondear': {
        if (args.length === 1) return R(`redondear(${num(0).codigo})`, 'entero');
        if (args[1].tipo !== 'Num') throw new NoSe(l, 'redondea con un número de decimales que no es fijo');
        const f = numero(10 ** args[1].valor, 'decimal');
        return R(`decimal(redondear(${par(num(0), P.mul)} * ${f})) / ${f}`, 'decimal', P.mul);
      }
      case 'aleatorio': {
        if (!args.length) return R('aleatorio()', 'decimal');
        const a = num(0), b = num(1);
        return R(`${par(a, P.suma)} + aleatorio() * (${b.codigo} - ${par(a, P.suma + 1)})`, 'decimal', P.suma);
      }
      case 'aleatorio_entero': return R(`aleatorio_entre(${num(0, 'entero').codigo}, ${num(1, 'entero').codigo})`, 'entero');
      case 'rango': return R(`rango(${args.map((_, i) => num(i, 'entero').codigo).join(', ')})`, 'lista[entero]');
      case 'esperar': return R(`esperar(${num(0).codigo})`, 'nada');
      case 'despues': throw new NoSe(l, 'usa despues(segundos, función): en Ara se escribe con esperar(segundos) dentro del evento');
      case 'nodo': return R(`nodo(${conv(expr(args[0]), 'texto', l).codigo})`, 'Nodo');
    }
    const global = api.funciones[n];
    if (global) return llamarFirma('', n, global, args, l);
    const firmas = metodo(n);
    if (firmas) return llamarFirma('', n, firmas, args, l);
    throw new NoSe(l, `usa «${n}()», que no existe en Ara`);
  }

  function llamadaFuncion(n, args, l) {
    const f = funciones.get(n);
    if (args.length > f.params.length) throw new NoSe(l, `llama a «${n}» con más datos de los que recibe`);
    const codigos = f.params.map((p, i) => {
      if (i >= args.length) throw new NoSe(l, `llama a «${n}» sin todos sus datos (Ara no tiene valores por defecto)`);
      const r = expr(args[i], p.tipo);
      const t = juntar(p.tipo, r.tipo === '?' ? null : r.tipo);
      if (t !== p.tipo) { p.tipo = t; cambios = true; }
      return conv(r, p.tipo || r.tipo, l).codigo;
    });
    return R(`${n}(${codigos.join(', ')})`, f.retorno || 'nada');
  }

  // ---------- Órdenes ----------
  let salida, funcionActual, contadorLocal;
  // Escribe una línea; antes, los comentarios del original que iban por encima de ella.
  const L = (nivel, texto, linea) => {
    if (linea) {
      let k = lineasComentario.findIndex((x) => x.linea >= linea);
      if (k === -1) k = lineasComentario.length;
      for (const c of lineasComentario.splice(0, k)) salida.push('    '.repeat(nivel) + c.texto);
    }
    salida.push('    '.repeat(nivel) + texto);
  };

  function local(n, tipo) {
    // Un nombre local que choca con un campo o una propiedad del nodo cambiaría el campo: se renombra.
    let ara = n;
    if (campos.has(n) || propiedad(n) || PALABRAS_ARA.has(n) || n === 'puntos') ara = `${n}_local`;
    ambito.set(n, { tipo, ara });
    return ara;
  }

  function bloque(cuerpo, nivel) {
    if (!cuerpo.length) { L(nivel, 'pasar'); return; }
    for (const s of cuerpo) orden(s, nivel);
  }

  function orden(s, nivel) {
    const l = s.linea;
    switch (s.tipo) {
      case 'Pasar': return L(nivel, 'pasar', l);
      case 'Romper': return L(nivel, 'romper', l);
      case 'Continuar': return L(nivel, 'continuar', l);
      case 'Expresion': {
        if (s.expr.tipo !== 'Llamada') throw new NoSe(l, 'tiene una expresión suelta que no hace nada');
        return L(nivel, expr(s.expr, 'nada').codigo, l);
      }
      case 'DeclVar': {
        if (s.valor === null) throw new NoSe(l, `declara «${s.nombre}» sin valor`);
        let r = esNulo(s.valor) ? R('nodo("")', 'Nodo') : expr(s.valor);
        const previa = ambito.get(s.nombre);
        if (previa) return L(nivel, `${previa.ara} = ${conv(r, previa.tipo, l).codigo}`, l);
        const tipo = juntar(asignadosLocales.get(funcionActual + ':' + s.nombre), r.tipo);
        const original = r.tipo;
        r = conv(r, tipo, l);
        const ara = local(s.nombre, tipo);
        // Ara deduce el tipo del valor: si la variable va a ser decimal pero empieza con un entero, se anota.
        const anotado = tipo.startsWith('lista') || r.codigo === 'nodo("")' || (original !== tipo && !/^-?\d+\.\d+$/.test(r.codigo));
        return L(nivel, `${ara}${anotado ? ': ' + tipo : ''} = ${r.codigo}`, l);
      }
      case 'Asignar': return asignar(s, nivel);
      case 'Si': {
        s.ramas.forEach((r, i) => {
          L(nivel, `${i ? 'sino si' : 'si'} ${conv(expr(r.cond, 'booleano'), 'booleano', r.linea).codigo}:`, r.linea);
          bloque(r.cuerpo, nivel + 1);
        });
        if (s.sino) { L(nivel, 'sino:'); bloque(s.sino, nivel + 1); }
        return;
      }
      case 'Mientras': L(nivel, `mientras ${conv(expr(s.cond, 'booleano'), 'booleano', l).codigo}:`, l); return bloque(s.cuerpo, nivel + 1);
      case 'Repetir': {
        const v = `vuelta${contadorLocal++ || ''}`;
        ambito.set(v, { tipo: 'entero', ara: v });
        L(nivel, `para ${v} en rango(${conv(expr(s.veces, 'entero'), 'entero', l).codigo}):`, l);
        return bloque(s.cuerpo, nivel + 1);
      }
      case 'ParaCada': {
        const it = expr(s.iterable);
        const m = /^lista\[(.+)\]$/.exec(it.tipo || '');
        if (!m) throw new NoSe(l, '«para cada» recorre algo que no es una lista');
        const ara = local(s.variable, m[1]);
        L(nivel, `para ${ara} en ${it.codigo}:`, l);
        return bloque(s.cuerpo, nivel + 1);
      }
      case 'Devolver': {
        const f = funciones.get(funcionActual);
        if (!s.valor) return L(nivel, 'devolver', l);
        if (!f) throw new NoSe(l, 'devuelve un valor desde un evento');
        let r = esNulo(s.valor) ? R('nodo("")', 'Nodo') : expr(s.valor, f.retorno);
        const t = juntar(f.retorno, r.tipo);
        if (t !== f.retorno) { f.retorno = t; cambios = true; }
        r = conv(r, f.retorno, l);
        return L(nivel, `devolver ${r.codigo}`, l);
      }
      default: throw new NoSe(l, `no sé convertir «${s.tipo}»`);
    }
  }

  const asignadosLocales = new Map(); // "función:variable" → tipo que acaba teniendo (se ensancha)

  function asignar(s, nivel) {
    const l = s.linea, op = s.op, o = s.objetivo;
    const compuesto = op !== '=';
    const valor = (tipo) => {
      const r = esNulo(s.valor) ? R('nodo("")', 'Nodo') : expr(s.valor, tipo);
      return r;
    };
    if (o.tipo === 'Nombre' || (o.tipo === 'Miembro' && o.obj.tipo === 'Yo')) {
      const n = o.tipo === 'Nombre' ? o.nombre : o.nombre;
      if (ambito.has(n)) {
        const v = ambito.get(n), r = valor(v.tipo);
        const t = juntar(v.tipo, r.tipo);
        if (t !== v.tipo) { asignadosLocales.set(funcionActual + ':' + n, t); cambios = true; }
        return L(nivel, `${v.ara} ${op} ${conv(r, v.tipo, l).codigo}`, l);
      }
      if (campos.has(n)) {
        const c = campos.get(n), r = valor(c.tipo);
        const t = juntar(c.tipo, r.tipo);
        if (t !== c.tipo) { c.tipo = t; cambios = true; }
        return L(nivel, `${n} ${op} ${conv(r, c.tipo, l).codigo}`, l);
      }
      if (n === 'puntos') {
        const r = conv(valor('entero'), 'entero', l);
        return L(nivel, compuesto ? `poner_puntos(puntos() ${op[0]} ${par(r, P.mul + 1)})` : `poner_puntos(${r.codigo})`, l);
      }
      const p = propiedad(n);
      if (p) return L(nivel, `yo.${n} ${op} ${conv(valor(p), p, l).codigo}`, l);
      if (n === 'gravedad') {
        const r = conv(valor('decimal'), 'decimal', l);
        return L(nivel, compuesto ? `poner_gravedad_global(gravedad_global() ${op[0]} ${par(r, P.mul + 1)})` : `poner_gravedad_global(${r.codigo})`, l);
      }
      if (o.tipo === 'Nombre') throw new NoSe(l, `asigna «${n}», que no está declarada con «variable»`);
      throw new NoSe(l, `cambia «yo.${n}», que el nodo no tiene`);
    }
    if (o.tipo === 'Miembro') {
      const obj = conv(expr(o.obj, 'Nodo'), 'Nodo', l);
      const p = miembroDe(api, 'Nodo', o.nombre);
      if (p && p.propiedad) return L(nivel, `${par(obj, P.atomo)}.${o.nombre} ${op} ${conv(valor(p.propiedad), p.propiedad, l).codigo}`, l);
      if (compuesto) throw new NoSe(l, `cambia «${o.nombre}» de otro nodo con «${op}»`);
      const r = valor(null);
      const t = NUM.has(r.tipo) ? 'numero' : r.tipo === 'booleano' ? 'booleano' : r.tipo === 'Nodo' ? 'nodo' : 'texto';
      const destino = { numero: 'decimal', booleano: 'booleano', nodo: 'Nodo', texto: 'texto' }[t];
      return L(nivel, `${par(obj, P.atomo)}.cambiar_${t}(${textoAra(o.nombre)}, ${conv(r, destino, l).codigo})`, l);
    }
    if (o.tipo === 'Indice') {
      const lista = expr(o.obj), m = /^lista\[(.+)\]$/.exec(lista.tipo || '');
      if (!m) throw new NoSe(l, 'usa corchetes con algo que no es una lista');
      return L(nivel, `${par(lista, P.atomo)}[${conv(expr(o.indice, 'entero'), 'entero', l).codigo}] ${op} ${conv(valor(m[1]), m[1], l).codigo}`, l);
    }
    throw new NoSe(l, 'asigna a algo que no es una variable');
  }

  // ---------- Generación (se repite mientras los tipos cambien) ----------
  const comentarios = fuente.replace(/\r\n?/g, '\n').split('\n').map((t, i) => ({ linea: i + 1, texto: t.trim().replace(/\b([\w.-]+)\.agl\b/g, '$1.ara') })).filter((c) => c.texto.startsWith('#'));
  // Los comentarios de antes del primer campo, evento o función van encima de la clase.
  const primera = Math.min(...[...campos.values()].map((c) => c.decl.linea), ...eventos.map((e) => e.linea), ...[...funciones.values()].map((f) => f.decl.linea), Infinity);
  const comentariosCabecera = comentarios.filter((c) => c.linea < primera && !/^#\s*$/.test(c.texto));
  const comentariosCuerpo = comentarios.filter((c) => c.linea >= primera);
  // Los parámetros de las funciones que se usan como nodos (p. ej. `c.x`) son Nodo; los demás, decimales salvo que
  // las llamadas digan otra cosa.
  for (const f of funciones.values()) {
    for (const p of f.params) {
      const usado = JSON.stringify(f.decl.cuerpo);
      if (new RegExp(`"obj":\\{"tipo":"Nombre","nombre":"${p.nombre}"`).test(usado)) p.tipo = 'Nodo';
    }
  }
  let error = null;
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    cambios = false; salida = []; contadorLocal = 0; error = null;
    lineasComentario = comentariosCuerpo.slice();
    try {
      // Campos: el tipo sale del valor inicial (y se ensancha con lo que se les asigna).
      ambito = new Map(); funcionActual = null;
      const lineasCampos = [];
      for (const [n, c] of campos) {
        let r = esNulo(c.decl.valor) ? R('nodo("")', 'Nodo') : expr(c.decl.valor, c.tipo);
        const t = juntar(c.tipo, r.tipo);
        if (t !== c.tipo) { c.tipo = t; cambios = true; }
        r = conv(r, c.tipo, c.decl.linea);
        const anotado = c.tipo.startsWith('lista') || r.codigo === 'nodo("")';
        lineasCampos.push([c.decl.linea, `${c.decl.exportar ? 'exportar ' : ''}${n}${anotado ? ': ' + c.tipo : ''} = ${r.codigo}`]);
        if (c.decl.exportar && !['decimal', 'entero', 'texto', 'booleano'].includes(c.tipo)) throw new NoSe(c.decl.linea, `exporta «${n}», que no es un número, un texto ni un sí/no`);
      }
      const cabecera = salida;
      salida = [];
      for (const [linea, t] of lineasCampos) L(1, t, linea);
      const cuerpoClase = salida; salida = [];
      for (const ev of eventos) {
        ambito = new Map(); funcionActual = null;
        const datos = api.eventos[ev.evento];
        if (!datos) throw new NoSe(ev.linea, `responde al evento «${ev.evento}», que no existe`);
        const nombres = ev.params.map((p) => p.nombre);
        const huecos = ev.filtro !== null ? 1 : 0;
        if (nombres.length + huecos > datos.length) throw new NoSe(ev.linea, `«${ev.evento}» da ${datos.length} dato(s)`);
        const args = nombres.map((n, i) => local(n, datos[i + huecos].tipo));
        const filtro = ev.filtro === null ? [] : [typeof ev.filtro === 'string' ? textoAra(ev.filtro) : String(ev.filtro)];
        salida.push('');
        L(1, `cuando ${ev.evento}(${[...filtro, ...args].join(', ')}):`, ev.linea);
        bloque(ev.cuerpo, 2);
      }
      for (const [n, f] of funciones) {
        ambito = new Map(); funcionActual = n;
        for (const p of f.params) if (!p.tipo) p.tipo = 'decimal';
        const params = f.params.map((p) => `${local(p.nombre, p.tipo)}: ${p.tipo}`);
        salida.push('');
        L(1, '', f.decl.linea);
        const cabeceraF = salida.length - 1;
        bloque(f.decl.cuerpo, 2);
        // El tipo del resultado se sabe al terminar el cuerpo (lo que llega a «devolver»).
        salida[cabeceraF] = `    func ${n}(${params.join(', ')})${f.retorno && f.retorno !== 'nada' ? ' -> ' + f.retorno : ''}:`;
      }
      salida = [...cabecera, ...cuerpoClase, ...salida];
    } catch (e) {
      if (!(e instanceof NoSe)) throw e;
      error = e;
    }
    if (!cambios) break;
  }
  if (error) return { ok: false, codigo: '', clase: nombreClase, problemas: [{ linea: error.linea, mensaje: error.message }] };
  const restantes = lineasComentario.map((c) => '    ' + c.texto);
  const cabecera = [...comentariosCabecera.map((c) => c.texto), `# (convertido de Águila por Falcon Engine)`, `clase ${nombreClase} extiende ${base}:`];
  const codigo = [...cabecera, ...salida, ...restantes];
  if (codigo.length === cabecera.length) codigo.push('    pasar');
  return { ok: true, codigo: codigo.join('\n').replace(/\n{3,}/g, '\n\n') + '\n', clase: nombreClase, problemas: [] };
}

const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '');

// ---------- Proyectos enteros ----------

/** ¿Tiene el proyecto algo de Águila que convertir? (`archivos`: las rutas del proyecto). */
export function necesitaConversion(archivos) {
  return archivos.some((r) => /\.agl$/i.test(r) && !r.startsWith('.falcon/'));
}

const recorrerNodos = (n, f) => { f(n); for (const h of n.hijos || []) recorrerNodos(h, f); };

/**
 * Convierte a Ara los scripts de Águila de un proyecto.
 *  - Guarda una copia de los .agl y de las escenas que cambian en `.falcon/copia-aguila-<fecha>/`.
 *  - Cada .agl que se puede convertir pasa a ser un .ara con el mismo nombre (su clase toma el nombre del archivo
 *    si hace falta para no repetirse), y las escenas lo usan; el .agl se borra (va a la papelera).
 *  - Lo que no se puede convertir se queda en Águila, que sigue funcionando, y el informe dice por qué.
 *  - Los generado/*.agl de los Blueprints se borran: los Blueprints ya se compilan a Ara.
 * Antes de escribir nada comprueba que todo el Ara del proyecto compila junto.
 *
 * @param {{ archivos: string[], leer(rel): Promise<string>, escribir(rel, datos): Promise, borrar(rel): Promise,
 *   comprobar(textos: Map): Promise<Array<{archivo, linea, mensaje}>>, clasesBlueprint: string[], fecha?: string }} p
 * @returns {Promise<{ convertidos: Array<{agl, ara, clase}>, quedan: Array<{agl, problemas}>, borrados: string[], copia: string, informe: string }>}
 */
export async function convertirProyecto(p) {
  const fecha = p.fecha || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const copia = `.falcon/copia-aguila-${fecha}`;
  const agls = p.archivos.filter((r) => /\.agl$/i.test(r) && !r.startsWith('generado/') && !r.startsWith('.falcon/'));
  const generados = p.archivos.filter((r) => /\.agl$/i.test(r) && r.startsWith('generado/'));

  // Escenas: qué tipo de nodo usa cada script y qué nodos hay (Águila encontraba los nodos por su nombre).
  const escenas = new Map(), tipos = new Map(), nodos = new Set();
  for (const rel of p.archivos.filter((r) => /\.fscn$/i.test(r))) {
    let e;
    try { e = JSON.parse(await p.leer(rel)); } catch { continue; }
    escenas.set(rel, e);
    if (e.raiz) recorrerNodos(e.raiz, (n) => {
      if (n.nombre) nodos.add(n.nombre);
      if (n.script && /\.agl$/i.test(n.script)) (tipos.get(n.script) || tipos.set(n.script, new Set()).get(n.script)).add(n.tipo);
    });
  }

  // Los nombres de clase ya usados (scripts de Ara y Blueprints): todo el Ara del proyecto se compila junto.
  const textosAra = new Map();
  for (const rel of p.archivos.filter((r) => /\.ara$/i.test(r) && !r.startsWith('generado/'))) textosAra.set(rel, await p.leer(rel));
  const usadas = new Set([...(p.clasesBlueprint || [])]);
  for (const t of textosAra.values()) for (const m of t.matchAll(/^clase\s+([\p{L}_][\p{L}\p{N}_]*)/gmu)) usadas.add(m[1]);

  const convertidos = [], quedan = [], fuentes = new Map();
  for (const rel of agls) {
    const fuente = await p.leer(rel);
    fuentes.set(rel, fuente);
    const ts = [...(tipos.get(rel) || [])];
    const base = ts.length === 1 ? ts[0] : 'Nodo';
    // La clase: la del script si no se repite; si no, la del archivo (con un número si hace falta).
    const propia = /^clase\s+([\p{L}_][\p{L}\p{N}_]*)/mu.exec(fuente)?.[1];
    let clase = propia && !usadas.has(propia) && !(propia in API_MOTOR.tipos) ? propia : claseDeArchivo(rel);
    for (let i = 2; usadas.has(clase); i++) clase = claseDeArchivo(rel) + i;
    const r = convertirAguila(fuente, { archivo: rel, base, clase, nodos: [...nodos] });
    if (!r.ok) { quedan.push({ agl: rel, problemas: r.problemas }); continue; }
    let ara = rel.replace(/\.agl$/i, '.ara');
    if (textosAra.has(ara) || p.archivos.includes(ara)) ara = rel.replace(/\.agl$/i, '_aguila.ara');
    usadas.add(clase);
    convertidos.push({ agl: rel, ara, clase, codigo: r.codigo });
  }

  // Todo junto tiene que compilar; un convertido que no compila se queda en Águila.
  for (;;) {
    const textos = new Map([...textosAra, ...convertidos.map((c) => [c.ara, c.codigo])]);
    const errores = convertidos.length ? await p.comprobar(textos) : [];
    const malos = new Set(errores.map((e) => e.archivo).filter((a) => convertidos.some((c) => c.ara === a)));
    if (!malos.size) break;
    for (const a of malos) {
      const i = convertidos.findIndex((c) => c.ara === a);
      const e = errores.find((x) => x.archivo === a);
      quedan.push({ agl: convertidos[i].agl, problemas: [{ linea: 0, mensaje: `el Ara convertido no compila (línea ${e.linea}: ${e.mensaje})` }] });
      convertidos.splice(i, 1);
    }
  }

  // Copia de seguridad, antes de cambiar nada.
  const cambiadas = [...escenas].filter(([, e]) => { let usa = false; if (e.raiz) recorrerNodos(e.raiz, (n) => { if (convertidos.some((c) => c.agl === n.script)) usa = true; }); return usa; });
  for (const rel of [...agls, ...generados]) await p.escribir(`${copia}/${rel}`, fuentes.get(rel) ?? await p.leer(rel));
  for (const [rel] of cambiadas) await p.escribir(`${copia}/${rel}`, await p.leer(rel));

  for (const c of convertidos) await p.escribir(c.ara, c.codigo);
  for (const [rel, e] of cambiadas) {
    recorrerNodos(e.raiz, (n) => { const c = convertidos.find((x) => x.agl === n.script); if (c) n.script = c.ara; });
    await p.escribir(rel, JSON.stringify(e, null, 2));
  }
  const borrados = [...convertidos.map((c) => c.agl), ...generados];
  for (const rel of borrados) await p.borrar(rel);

  const informe = [
    '# Conversión de Águila a Ara',
    '',
    `Fecha: ${fecha.slice(0, 10)}. Los archivos originales están en \`${copia}/\`.`,
    '',
    `## Convertidos (${convertidos.length})`,
    '',
    ...(convertidos.length ? convertidos.map((c) => `- \`${c.agl}\` → \`${c.ara}\` (clase \`${c.clase}\`)`) : ['Ninguno.']),
    '',
    `## Se quedan en Águila (${quedan.length})`,
    '',
    ...(quedan.length ? quedan.flatMap((q) => [`- \`${q.agl}\`: ${q.problemas.map((x) => (x.linea ? `línea ${x.linea}: ` : '') + x.mensaje).join('; ')}.`]) : ['Ninguno: todo el proyecto está en Ara.']),
    ...(quedan.length ? ['', 'Siguen funcionando con Águila. Puedes pasarlos a Ara a mano (la guía «El lenguaje Ara» del menú Ayuda explica las diferencias) y quitar el .agl.'] : []),
    ...(generados.length ? ['', `Se han borrado ${generados.length} archivo(s) generado/*.agl: los Blueprints ahora se compilan a Ara.`] : []),
    '',
  ].join('\n');
  await p.escribir('CONVERSION_ARA.md', informe);
  return { convertidos: convertidos.map(({ agl, ara, clase }) => ({ agl, ara, clase })), quedan, borrados, copia, informe };
}
