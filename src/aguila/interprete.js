// Intérprete de Águila.
// Las sentencias se ejecutan como generadores para que «esperar(segundos)» pueda
// pausar un evento «cuando» sin congelar el juego. Las expresiones son síncronas.

import { ErrorAguila, sugerir, PALABRAS_EXTRANJERAS } from './errores.js';
import { analizar } from './sintaxis.js';

// ---- Valores ----

export class FuncionAguila {
  constructor(nombre, params, cuerpo, cierre, linea) {
    this.nombre = nombre; this.params = params; this.cuerpo = cuerpo; this.cierre = cierre; this.linea = linea;
    this.yo = null;
  }
  ligar(yo, entornoInstancia) {
    const f = new FuncionAguila(this.nombre, this.params, this.cuerpo, entornoInstancia || this.cierre, this.linea);
    f.yo = yo;
    return f;
  }
}

export class ClaseAguila {
  constructor(nombre, base, cuerpo, cierre) {
    this.nombre = nombre; this.base = base; this.cuerpo = cuerpo; this.cierre = cierre;
  }
}

export class ObjetoAguila {
  constructor(clase) { this.clase = clase; this.campos = new Map(); this.metodos = new Map(); }
}

// Marca para funciones nativas que reciben el intérprete.
export function nativa(fn, nombre) { fn.nombreAguila = nombre || fn.name; return fn; }

const ROMPER = { senal: 'romper' };
const CONTINUAR = { senal: 'continuar' };

class Devolucion { constructor(valor) { this.senal = 'devolver'; this.valor = valor; } }

export class Entorno {
  constructor(padre = null, host = null) {
    this.vars = new Map();
    this.constantes = null;
    this.padre = padre;
    this.host = host;   // objeto del motor (nodo) asociado a este entorno de script
    this.yo = undefined;
  }
  definir(nombre, valor, constante = false) {
    this.vars.set(nombre, valor);
    if (constante) (this.constantes ||= new Set()).add(nombre);
  }
}

// ---- Utilidades de valores ----

export function tipoDe(v) {
  if (v === null || v === undefined) return 'nulo';
  if (typeof v === 'boolean') return 'sí/no';
  if (typeof v === 'number') return Number.isInteger(v) ? 'entero' : 'decimal';
  if (typeof v === 'string') return 'texto';
  if (Array.isArray(v)) return 'lista';
  if (v instanceof Map) return 'diccionario';
  if (v instanceof FuncionAguila || typeof v === 'function') return 'función';
  if (v instanceof ClaseAguila) return 'clase';
  if (v instanceof ObjetoAguila) return v.clase.nombre;
  if (v && v.aguilaTipo) return v.aguilaTipo;
  return 'objeto';
}

export function aTexto(v, anidado = false) {
  if (v === null || v === undefined) return 'nulo';
  if (v === true) return 'verdadero';
  if (v === false) return 'falso';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    if (!isFinite(v)) return v > 0 ? 'infinito' : v < 0 ? '-infinito' : 'no es un número';
    return String(Math.round(v * 10000) / 10000);
  }
  if (typeof v === 'string') return anidado ? JSON.stringify(v) : v;
  if (Array.isArray(v)) return '[' + v.map(x => aTexto(x, true)).join(', ') + ']';
  if (v instanceof Map) return '{' + [...v].map(([k, x]) => aTexto(k, true) + ': ' + aTexto(x, true)).join(', ') + '}';
  if (v instanceof FuncionAguila) return `función ${v.nombre}()`;
  if (typeof v === 'function') return `función ${v.nombreAguila || v.name || ''}()`;
  if (v instanceof ClaseAguila) return `clase ${v.nombre}`;
  if (v instanceof ObjetoAguila) {
    return v.clase.nombre + '(' + [...v.campos].map(([k, x]) => k + ': ' + aTexto(x, true)).join(', ') + ')';
  }
  if (v && v.aguilaTexto) return v.aguilaTexto();
  return String(v);
}

export function esVerdad(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Map) return v.size > 0;
  return true;
}

function iguales(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  if (a instanceof Map && b instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && iguales(v, b.get(k)));
  return false;
}

// ---- Intérprete ----

export class Interprete {
  /**
   * @param {object} op
   *  globales: { nombre: valor } funciones y variables disponibles en todos los scripts
   *  resolverNombre(nombre): último recurso para nombres desconocidos (p. ej. nodos de la escena)
   *  salida(texto): donde va «mostrar»
   *  limitePasos: máximo de pasos por evento antes de declarar bucle infinito
   */
  constructor(op = {}) {
    this.globales = new Entorno(null);
    this.resolverNombre = op.resolverNombre || (() => undefined);
    this.salida = op.salida || ((t) => console.log(t));
    this.limitePasos = op.limitePasos || 2_000_000;
    this.pasos = 0;
    this.profundidad = 0;
    this.lineaActual = 0;
    this.archivoActual = null;
    this.miembrosNativos = op.miembrosNativos || null;
    for (const [k, v] of Object.entries(op.globales || {})) this.globales.definir(k, v);
  }

  definirGlobal(nombre, valor) { this.globales.definir(nombre, valor); }

  // Error de ejecución en la línea actual.
  fallo(mensaje, extra = {}) {
    return new ErrorAguila(mensaje, { linea: this.lineaActual, archivo: this.archivoActual, fase: 'ejecucion', ...extra });
  }

  contarPaso() {
    if (++this.pasos > this.limitePasos) {
      this.pasos = 0;
      throw this.fallo('parece un bucle infinito: el código lleva demasiado tiempo sin terminar.', {
        explicacion: 'Revisa que la condición de «mientras» llegue a ser falsa en algún momento, o usa «esperar(segundos)» dentro del bucle.',
      });
    }
  }

  // ---- Búsqueda de nombres ----
  buscar(nombre, env, nodoAst) {
    for (let e = env; e; e = e.padre) {
      if (e.vars.has(nombre)) return e.vars.get(nombre);
      if (e.host) {
        const v = e.host.aguilaObtener(nombre);
        if (v !== undefined) return v;
      }
    }
    const r = this.resolverNombre(nombre, env);
    if (r !== undefined) return r;
    throw this.errorNombre(nombre, env, nodoAst);
  }

  nombresVisibles(env) {
    const s = new Set();
    for (let e = env; e; e = e.padre) {
      for (const k of e.vars.keys()) s.add(k);
      if (e.host && e.host.aguilaMiembros) for (const k of e.host.aguilaMiembros()) s.add(k);
    }
    return s;
  }

  errorNombre(nombre, env, nodoAst) {
    const extra = { };
    if (nodoAst && nodoAst.col !== undefined) { extra.columna = nodoAst.col; extra.finColumna = nodoAst.finCol; }
    if (PALABRAS_EXTRANJERAS[nombre]) {
      const ok = PALABRAS_EXTRANJERAS[nombre];
      return this.fallo(`«${nombre}» no es de Águila; se escribe «${ok}».`, {
        ...extra, explicacion: `Águila usa palabras en español. En lugar de «${nombre}» escribe «${ok}».`,
      });
    }
    const s = sugerir(nombre, this.nombresVisibles(env));
    return this.fallo(`no conozco «${nombre}».` + (s ? ` ¿Querías decir «${s}»?` : ''), {
      ...extra,
      explicacion: s ? `Puede que sea una errata. Hay algo parecido que se llama «${s}».`
        : 'Si es una variable nueva, declárala antes con «variable ' + nombre + ' = …». Si es un nodo de la escena, comprueba que se llama exactamente así.',
    });
  }

  asignarNombre(nombre, valor, env, linea) {
    for (let e = env; e; e = e.padre) {
      if (e.vars.has(nombre)) {
        if (e.constantes && e.constantes.has(nombre)) {
          throw this.fallo(`«${nombre}» es una constante y no se puede cambiar.`, {
            explicacion: 'Si necesitas cambiar su valor, decláralo con «variable» en lugar de «constante».',
          });
        }
        e.vars.set(nombre, valor);
        return;
      }
      if (e.host && e.host.aguilaAsignar && e.host.aguilaAsignar(nombre, valor)) return;
      if (e === this.globales) break;
    }
    if (this.globales.vars.has(nombre) && typeof this.globales.vars.get(nombre) !== 'function') {
      this.globales.vars.set(nombre, valor);
      return;
    }
    const s = sugerir(nombre, this.nombresVisibles(env));
    throw this.fallo(`la variable «${nombre}» no existe todavía.` + (s ? ` ¿Querías decir «${s}»?` : ''), {
      explicacion: 'Antes de usar una variable hay que crearla con «variable», por ejemplo «variable ' + nombre + ' = 0».',
      arreglo: s ? null : { titulo: 'Declararla con «variable»', cambios: [{ linea, desde: -1, hasta: -1, texto: 'variable ' }] },
    });
  }

  // ---- Programas y scripts ----

  compilar(fuente, archivo) {
    const { programa, errores } = analizar(fuente, archivo);
    if (errores.length) {
      const e = errores[0];
      e.archivo = archivo;
      throw e;
    }
    return programa;
  }

  // Ejecuta un programa suelto (consola, pruebas). Devuelve el valor de la última expresión.
  ejecutar(fuente, archivo = 'consola') {
    const programa = typeof fuente === 'string' ? this.compilar(fuente, archivo) : fuente;
    const env = new Entorno(this.globales);
    this.archivoActual = archivo;
    let ultimo;
    for (const s of programa.cuerpo) {
      if (s.tipo === 'Expresion') {
        this.lineaActual = s.linea;
        ultimo = this.evaluar(s.expr, env);
      } else {
        this.correrSync(this.ejecutarSentencia(s, env));
        ultimo = undefined;
      }
    }
    return ultimo;
  }

  // Ejecuta un generador hasta el final; «esperar» no está permitido aquí.
  correrSync(gen) {
    let r = gen.next();
    while (!r.done) {
      throw this.fallo('«esperar()» solo se puede usar dentro de un evento «cuando» o de una función llamada desde él.', {
        explicacion: 'Para retrasar algo dentro de una expresión, usa «despues(segundos, función)».',
      });
    }
    return r.value;
  }

  // ---- Sentencias (generadores) ----

  *ejecutarBloque(cuerpo, env) {
    for (const s of cuerpo) {
      const r = yield* this.ejecutarSentencia(s, env);
      if (r) return r;
    }
    return undefined;
  }

  *ejecutarSentencia(s, env) {
    this.lineaActual = s.linea;
    switch (s.tipo) {
      case 'Expresion': {
        const e = s.expr;
        // esperar(segundos): pausa el evento actual.
        if (e.tipo === 'Llamada' && e.fn.tipo === 'Nombre' && e.fn.nombre === 'esperar' && !this.existeLocal('esperar', env)) {
          const seg = e.args.length ? this.evaluar(e.args[0], env) : 0;
          if (typeof seg !== 'number') throw this.fallo('«esperar» necesita un número de segundos, como «esperar(1.5)».');
          yield { esperar: Math.max(0, seg) };
          return undefined;
        }
        // Llamada a una función de Águila como sentencia: puede esperar dentro.
        if (e.tipo === 'Llamada') {
          let fn = e.fn.tipo === 'Nombre' ? this.buscar(e.fn.nombre, env, e.fn)
            : e.fn.tipo === 'Miembro' ? this.miembro(this.evaluar(e.fn.obj, env), e.fn.nombre, e.fn) : this.evaluar(e.fn, env);
          if (e.fn.tipo === 'Nombre' && !(fn instanceof FuncionAguila) && typeof fn !== 'function' && !(fn instanceof ClaseAguila)) {
            const g = this.globales.vars.get(e.fn.nombre);
            if (typeof g === 'function' || g instanceof FuncionAguila) fn = g;
          }
          if (fn instanceof FuncionAguila) {
            const args = e.args.map(a => this.evaluar(a, env));
            yield* this.llamarGen(fn, args, s.linea);
            return undefined;
          }
          this.llamarValor(fn, e.args.map(a => this.evaluar(a, env)), e);
          return undefined;
        }
        this.evaluar(e, env);
        return undefined;
      }
      case 'DeclVar': {
        const v = s.valor ? this.evaluar(s.valor, env) : null;
        env.definir(s.nombre, v, s.constante);
        return undefined;
      }
      case 'Asignar': return this.asignar(s, env);
      case 'Si': {
        for (const rama of s.ramas) {
          this.lineaActual = rama.linea;
          if (esVerdad(this.evaluar(rama.cond, env))) return yield* this.ejecutarBloque(rama.cuerpo, env);
        }
        if (s.sino) return yield* this.ejecutarBloque(s.sino, env);
        return undefined;
      }
      case 'Mientras': {
        while (true) {
          this.lineaActual = s.linea;
          if (!esVerdad(this.evaluar(s.cond, env))) break;
          this.contarPaso();
          const r = yield* this.ejecutarBloque(s.cuerpo, env);
          if (r === ROMPER) break;
          if (r === CONTINUAR) continue;
          if (r) return r;
        }
        return undefined;
      }
      case 'Repetir': {
        const n = this.evaluar(s.veces, env);
        if (typeof n !== 'number') throw this.fallo('«repetir» necesita un número, como «repetir 3 veces:».');
        for (let i = 0; i < n; i++) {
          this.contarPaso();
          const r = yield* this.ejecutarBloque(s.cuerpo, env);
          if (r === ROMPER) break;
          if (r === CONTINUAR) continue;
          if (r) return r;
        }
        return undefined;
      }
      case 'ParaCada': {
        let lista = this.evaluar(s.iterable, env);
        if (typeof lista === 'number') lista = Array.from({ length: Math.max(0, Math.floor(lista)) }, (_, i) => i);
        else if (typeof lista === 'string') lista = [...lista];
        else if (lista instanceof Map) lista = [...lista.keys()];
        else if (lista && lista.aguilaIterar) lista = lista.aguilaIterar();
        else if (!Array.isArray(lista)) {
          throw this.fallo(`no puedo recorrer ${tipoDe(lista) === 'nulo' ? 'algo que es nulo' : 'un valor de tipo ' + tipoDe(lista)}.`, {
            explicacion: '«para cada» recorre listas, textos, diccionarios o un número de vueltas, como «para cada i en rango(10):».',
          });
        }
        for (const x of [...lista]) {
          this.contarPaso();
          env.definir(s.variable, x);
          const r = yield* this.ejecutarBloque(s.cuerpo, env);
          if (r === ROMPER) break;
          if (r === CONTINUAR) continue;
          if (r) return r;
        }
        return undefined;
      }
      case 'Funcion': {
        env.definir(s.nombre, new FuncionAguila(s.nombre, s.params, s.cuerpo, env, s.linea));
        return undefined;
      }
      case 'Clase': {
        env.definir(s.nombre, new ClaseAguila(s.nombre, s.base, s.cuerpo, env));
        return undefined;
      }
      case 'Cuando': {
        // Un «cuando» suelto fuera de un script de nodo se registra en el entorno.
        const lista = env.cuando || (env.cuando = []);
        lista.push(s);
        return undefined;
      }
      case 'Devolver': return new Devolucion(s.valor ? this.evaluar(s.valor, env) : null);
      case 'Romper': return ROMPER;
      case 'Continuar': return CONTINUAR;
      case 'Pasar': return undefined;
    }
    throw this.fallo(`sentencia desconocida: ${s.tipo}`);
  }

  existeLocal(nombre, env) {
    for (let e = env; e && e !== this.globales; e = e.padre) if (e.vars.has(nombre)) return true;
    return false;
  }

  asignar(s, env) {
    const obj = s.objetivo;
    let valor = this.evaluar(s.valor, env);
    if (s.op !== '=') {
      const actual = this.evaluar(obj, env);
      valor = this.operar(s.op.slice(0, -1), actual, valor);
    }
    if (obj.tipo === 'Nombre') this.asignarNombre(obj.nombre, valor, env, s.linea);
    else if (obj.tipo === 'Miembro') this.asignarMiembro(this.evaluar(obj.obj, env), obj.nombre, valor);
    else if (obj.tipo === 'Indice') {
      const cont = this.evaluar(obj.obj, env);
      const i = this.evaluar(obj.indice, env);
      if (Array.isArray(cont)) {
        if (typeof i !== 'number') throw this.fallo('el índice de una lista tiene que ser un número.');
        const k = i < 0 ? cont.length + i : i;
        if (k < 0 || k > cont.length) throw this.fallo(`la posición ${i} está fuera de la lista (tiene ${cont.length} elementos).`);
        cont[k] = valor;
      } else if (cont instanceof Map) cont.set(i, valor);
      else if (cont instanceof ObjetoAguila) cont.campos.set(String(i), valor);
      else if (cont && cont.aguilaAsignar) cont.aguilaAsignar(String(i), valor);
      else throw this.fallo(`no puedo guardar dentro de ${tipoDe(cont)}.`);
    }
    return undefined;
  }

  asignarMiembro(obj, nombre, valor) {
    if (obj instanceof ObjetoAguila) { obj.campos.set(nombre, valor); return; }
    if (obj instanceof Map) { obj.set(nombre, valor); return; }
    if (obj && obj.aguilaAsignar) {
      if (obj.aguilaAsignar(nombre, valor)) return;
      throw this.fallo(`no se puede cambiar «${nombre}» de ${aTexto(obj)}.`, {
        explicacion: 'Esa propiedad no existe o es de solo lectura.',
      });
    }
    if (obj === null || obj === undefined) throw this.fallo(`no puedo cambiar «${nombre}» porque el objeto es nulo.`);
    throw this.fallo(`no puedo cambiar «${nombre}» en un valor de tipo ${tipoDe(obj)}.`);
  }

  // ---- Expresiones ----

  evaluar(n, env) {
    switch (n.tipo) {
      case 'Num': return n.valor;
      case 'Texto': return n.valor;
      case 'Bool': return n.valor;
      case 'Nulo': return null;
      case 'Nombre': return this.buscar(n.nombre, env, n);
      case 'Yo': {
        for (let e = env; e; e = e.padre) {
          if (e.yo !== undefined) return e.yo;
          if (e.host) return e.host;
        }
        throw this.fallo('«yo» solo tiene sentido dentro de un script de un nodo o de una clase.');
      }
      case 'Lista': return n.elementos.map(x => this.evaluar(x, env));
      case 'Dicc': {
        const m = new Map();
        for (const [k, v] of n.pares) m.set(this.evaluar(k, env), this.evaluar(v, env));
        return m;
      }
      case 'Unaria': {
        const v = this.evaluar(n.expr, env);
        if (n.op === 'no') return !esVerdad(v);
        if (typeof v !== 'number') throw this.fallo(`no puedo poner un «-» delante de ${tipoDe(v)}.`);
        return -v;
      }
      case 'Logica': {
        const a = this.evaluar(n.izq, env);
        if (n.op === 'y') return esVerdad(a) ? esVerdad(this.evaluar(n.der, env)) : false;
        return esVerdad(a) ? true : esVerdad(this.evaluar(n.der, env));
      }
      case 'Binaria': {
        this.lineaActual = n.linea || this.lineaActual;
        return this.operar(n.op, this.evaluar(n.izq, env), this.evaluar(n.der, env));
      }
      case 'Miembro': return this.miembro(this.evaluar(n.obj, env), n.nombre, n);
      case 'Indice': return this.indice(this.evaluar(n.obj, env), this.evaluar(n.indice, env));
      case 'Llamada': {
        const linea = n.linea;
        let fn = this.evaluar(n.fn, env);
        // «texto(x)» dentro de una Etiqueta: la propiedad «texto» no es una función,
        // así que se usa la función global con el mismo nombre.
        if (n.fn.tipo === 'Nombre' && !(fn instanceof FuncionAguila) && typeof fn !== 'function' && !(fn instanceof ClaseAguila)) {
          const g = this.globales.vars.get(n.fn.nombre);
          if (typeof g === 'function' || g instanceof FuncionAguila) fn = g;
        }
        const args = n.args.map(a => this.evaluar(a, env));
        this.lineaActual = linea;
        return this.llamarValor(fn, args, n);
      }
    }
    throw this.fallo(`expresión desconocida: ${n.tipo}`);
  }

  operar(op, a, b) {
    switch (op) {
      case '+':
        if (typeof a === 'number' && typeof b === 'number') return a + b;
        if (typeof a === 'string' || typeof b === 'string') return aTexto(a) + aTexto(b);
        if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
        throw this.fallo(`no puedo sumar ${tipoDe(a)} y ${tipoDe(b)}.`, {
          explicacion: a === null || b === null ? 'Uno de los valores es nulo: puede que una variable no tenga valor todavía.' : 'Solo se pueden sumar números, unir textos o unir listas.',
        });
      case '-': case '*': case '/': case '%': case '**': {
        if (op === '*' && typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
        if (op === '*' && Array.isArray(a) && typeof b === 'number') { let r = []; for (let i = 0; i < b; i++) r = r.concat(a); return r; }
        if (typeof a !== 'number' || typeof b !== 'number') {
          const verbo = { '-': 'restar', '*': 'multiplicar', '/': 'dividir', '%': 'calcular el resto de', '**': 'elevar' }[op];
          throw this.fallo(`no puedo ${verbo} ${tipoDe(a)} y ${tipoDe(b)}.`, {
            explicacion: 'Esta operación solo funciona con números. Si tienes un texto con un número dentro, conviértelo con «numero(texto)».',
          });
        }
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '**') return a ** b;
        if (b === 0) throw this.fallo('no se puede dividir entre cero.', { explicacion: 'Comprueba que el número de abajo no sea 0 antes de dividir.' });
        if (op === '/') return a / b;
        return ((a % b) + b) % b;
      }
      case '==': return iguales(a, b);
      case '!=': return !iguales(a, b);
      case '<': case '>': case '<=': case '>=': {
        if (!((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string'))) {
          throw this.fallo(`no puedo comparar ${tipoDe(a)} con ${tipoDe(b)}.`, {
            explicacion: 'Solo se pueden comparar números entre sí o textos entre sí.',
          });
        }
        if (op === '<') return a < b;
        if (op === '>') return a > b;
        if (op === '<=') return a <= b;
        return a >= b;
      }
      case 'en':
        if (Array.isArray(b)) return b.some(x => iguales(x, a));
        if (typeof b === 'string') return b.includes(aTexto(a));
        if (b instanceof Map) return b.has(a);
        if (b && b.aguilaContiene) return b.aguilaContiene(a);
        throw this.fallo(`no puedo buscar dentro de ${tipoDe(b)}.`);
    }
    throw this.fallo(`operador desconocido «${op}»`);
  }

  indice(obj, i) {
    if (Array.isArray(obj) || typeof obj === 'string') {
      if (typeof i !== 'number') throw this.fallo('la posición tiene que ser un número entero.');
      const k = i < 0 ? obj.length + i : Math.floor(i);
      if (k < 0 || k >= obj.length) {
        throw this.fallo(`la posición ${i} está fuera ${Array.isArray(obj) ? 'de la lista' : 'del texto'} (tiene ${obj.length} elementos y se cuenta desde 0).`, {
          explicacion: 'El primer elemento está en la posición 0 y el último en la posición largo - 1.',
        });
      }
      return obj[k];
    }
    if (obj instanceof Map) return obj.has(i) ? obj.get(i) : null;
    if (obj instanceof ObjetoAguila) return obj.campos.get(String(i)) ?? null;
    if (obj && obj.aguilaObtener) return obj.aguilaObtener(String(i)) ?? null;
    throw this.fallo(`no puedo usar corchetes en ${tipoDe(obj)}.`);
  }

  miembro(obj, nombre, nodoAst) {
    if (obj === null || obj === undefined) {
      throw this.fallo(`no puedo usar «.${nombre}» porque el valor es nulo.`, {
        explicacion: 'Puede que el nodo se haya eliminado o que la variable no tenga valor todavía.',
      });
    }
    if (obj instanceof ObjetoAguila) {
      if (obj.campos.has(nombre)) return obj.campos.get(nombre);
      if (obj.metodos.has(nombre)) return obj.metodos.get(nombre);
      const s = sugerir(nombre, [...obj.campos.keys(), ...obj.metodos.keys()]);
      throw this.fallo(`${obj.clase.nombre} no tiene «${nombre}».` + (s ? ` ¿Querías decir «${s}»?` : ''));
    }
    if (obj && obj.aguilaObtener) {
      const v = obj.aguilaObtener(nombre);
      if (v !== undefined) return v;
      const s = obj.aguilaMiembros ? sugerir(nombre, obj.aguilaMiembros()) : null;
      throw this.fallo(`${aTexto(obj)} no tiene «${nombre}».` + (s ? ` ¿Querías decir «${s}»?` : ''), {
        explicacion: 'Mira en la ayuda qué propiedades y acciones tiene este tipo de nodo.',
      });
    }
    if (this.miembrosNativos) {
      const v = this.miembrosNativos(obj, nombre, this);
      if (v !== undefined) return v;
    }
    if (obj instanceof Map && obj.has(nombre)) return obj.get(nombre);
    throw this.fallo(`un valor de tipo ${tipoDe(obj)} no tiene «${nombre}».`);
  }

  llamarValor(fn, args, nodoAst) {
    if (fn instanceof FuncionAguila) return this.correrSync(this.llamarGen(fn, args, nodoAst && nodoAst.linea));
    if (fn instanceof ClaseAguila) return this.instanciar(fn, args);
    if (typeof fn === 'function') {
      try {
        const r = fn.apply(this, args);
        return r === undefined ? null : r;
      } catch (e) {
        if (e instanceof ErrorAguila) { if (!e.linea) e.linea = this.lineaActual; throw e; }
        if (e && e.esErrorAguilaNativo) throw this.fallo(e.message, { explicacion: e.explicacion || '' });
        throw this.fallo(e && e.message ? e.message : String(e));
      }
    }
    const nombre = nodoAst && nodoAst.fn && (nodoAst.fn.nombre || nodoAst.fn.tipo);
    throw this.fallo(`«${nombre || aTexto(fn)}» no es una función, no se puede llamar con paréntesis.`, {
      explicacion: tipoDe(fn) === 'nulo' ? 'Su valor es nulo.' : `Es un valor de tipo ${tipoDe(fn)}. Quita los paréntesis para usar su valor.`,
    });
  }

  *llamarGen(fn, args, linea) {
    if (++this.profundidad > 250) {
      this.profundidad = 0;
      throw this.fallo('demasiadas llamadas una dentro de otra.', {
        explicacion: 'Una función se está llamando a sí misma sin parar. Añade una condición para que deje de hacerlo.',
      });
    }
    const env = new Entorno(fn.cierre);
    if (fn.yo !== null && fn.yo !== undefined) env.yo = fn.yo;
    const obligatorios = fn.params.filter(p => !p.defecto).length;
    if (args.length < obligatorios || args.length > fn.params.length) {
      this.profundidad--;
      throw this.fallo(`«${fn.nombre}» necesita ${fn.params.length === obligatorios ? fn.params.length : `entre ${obligatorios} y ${fn.params.length}`} dato${fn.params.length === 1 ? '' : 's'} y le has dado ${args.length}.`, {
        explicacion: fn.params.length ? `Sus datos son: ${fn.params.map(p => p.nombre).join(', ')}.` : 'Esta función no recibe datos: llámala con paréntesis vacíos.',
      });
    }
    fn.params.forEach((p, i) => env.definir(p.nombre, i < args.length ? args[i] : this.evaluar(p.defecto, fn.cierre)));
    const lineaAnterior = this.lineaActual;
    try {
      const r = yield* this.ejecutarBloque(fn.cuerpo, env);
      if (r instanceof Devolucion) return r.valor;
      if (r === ROMPER || r === CONTINUAR) throw this.fallo(`«${r.senal}» solo se puede usar dentro de un bucle.`);
      return null;
    } finally {
      this.profundidad--;
      this.lineaActual = lineaAnterior;
    }
  }

  instanciar(clase, args) {
    const obj = new ObjetoAguila(clase);
    // Dentro de los métodos, los nombres sueltos buscan primero en los campos,
    // luego en los métodos y después fuera de la clase.
    const envMet = new Entorno(clase.cierre);
    envMet.vars = obj.metodos;
    const envInst = new Entorno(envMet);
    envInst.vars = obj.campos;
    envInst.yo = obj;
    for (const s of clase.cuerpo) {
      if (s.tipo === 'Funcion') obj.metodos.set(s.nombre, new FuncionAguila(s.nombre, s.params, s.cuerpo, envInst, s.linea).ligar(obj, envInst));
    }
    for (const s of clase.cuerpo) {
      if (s.tipo === 'DeclVar') obj.campos.set(s.nombre, s.valor ? this.evaluar(s.valor, envInst) : null);
    }
    const iniciar = obj.metodos.get('iniciar');
    if (iniciar) this.llamarValor(iniciar, args, null);
    else if (args.length) throw this.fallo(`${clase.nombre} no recibe datos al crearse (no tiene «función iniciar(...)»).`);
    return obj;
  }
}

// ---- Script de nodo ----
// Un archivo .agl asociado a un nodo. Puede ser una «clase X extiende Tipo:» o
// directamente eventos «cuando …» sueltos.

export class InstanciaScript {
  constructor(interprete, programa, host, archivo) {
    this.interp = interprete;
    this.programa = programa;
    this.host = host;
    this.archivo = archivo;
    this.entorno = new Entorno(interprete.globales, host);
    this.entorno.yo = host;
    this.manejadores = new Map();
    this.exportadas = [];
    this.nombreClase = null;
    this.base = null;
    this.corrutinas = [];
    this.desactivados = new Set();
  }

  iniciar(valoresExportados = {}) {
    const interp = this.interp;
    interp.archivoActual = this.archivo;
    let cuerpo = this.programa.cuerpo;
    const clase = cuerpo.find(s => s.tipo === 'Clase');
    const resto = cuerpo.filter(s => s.tipo !== 'Clase');
    if (clase && (clase.base || resto.every(s => s.tipo === 'Funcion' || s.tipo === 'DeclVar'))) {
      this.nombreClase = clase.nombre;
      this.base = clase.base;
      cuerpo = [...resto.filter(s => s.tipo !== 'Clase'), ...clase.cuerpo];
      // Otras clases auxiliares del archivo.
      for (const c of this.programa.cuerpo) if (c.tipo === 'Clase' && c !== clase) this.entorno.definir(c.nombre, new ClaseAguila(c.nombre, c.base, c.cuerpo, this.entorno));
    }
    interp.pasos = 0;
    for (const s of cuerpo) {
      interp.lineaActual = s.linea;
      if (s.tipo === 'Cuando') {
        if (!this.manejadores.has(s.evento)) this.manejadores.set(s.evento, []);
        this.manejadores.get(s.evento).push(s);
        continue;
      }
      if (s.tipo === 'DeclVar') {
        let v;
        if (s.exportar && Object.prototype.hasOwnProperty.call(valoresExportados, s.nombre)) v = valoresExportados[s.nombre];
        else v = s.valor ? interp.evaluar(s.valor, this.entorno) : null;
        this.entorno.definir(s.nombre, v, s.constante);
        if (s.exportar) this.exportadas.push(s.nombre);
        continue;
      }
      interp.correrSync(interp.ejecutarSentencia(s, this.entorno));
    }
  }

  tieneEvento(evento) { return this.manejadores.has(evento); }

  // Lanza un evento. Devuelve la lista de errores ocurridos (vacía si todo fue bien).
  emitir(evento, args = []) {
    const lista = this.manejadores.get(evento);
    if (!lista) return null;
    let error = null;
    for (const h of lista) {
      if (this.desactivados.has(h)) continue;
      if (h.filtro !== null && h.filtro !== undefined) {
        if (args[0] !== h.filtro) continue;
      }
      const env = new Entorno(this.entorno);
      const valores = h.filtro !== null && h.filtro !== undefined ? args.slice(1) : args;
      h.params.forEach((p, i) => env.definir(p.nombre, valores[i] ?? null));
      const gen = this.interp.ejecutarBloque(h.cuerpo, env);
      const e = this.paso({ gen, espera: 0, manejador: h });
      if (e) error = e;
    }
    return error;
  }

  paso(c) {
    const interp = this.interp;
    interp.archivoActual = this.archivo;
    interp.pasos = 0;
    interp.profundidad = 0;
    try {
      const r = c.gen.next();
      if (!r.done) {
        c.espera = r.value.esperar;
        this.corrutinas.push(c);
      }
      return null;
    } catch (e) {
      // Tras un error, ese evento deja de ejecutarse para no inundar la consola.
      this.desactivados.add(c.manejador);
      if (e instanceof ErrorAguila) { e.archivo = e.archivo || this.archivo; return e; }
      return new ErrorAguila(String(e && e.message || e), { linea: interp.lineaActual, archivo: this.archivo, fase: 'ejecucion' });
    }
  }

  actualizarCorrutinas(dt) {
    if (!this.corrutinas.length) return null;
    const pendientes = this.corrutinas;
    this.corrutinas = [];
    let error = null;
    for (const c of pendientes) {
      c.espera -= dt;
      if (c.espera > 0) { this.corrutinas.push(c); continue; }
      const e = this.paso(c);
      if (e) error = e;
    }
    return error;
  }

  llamar(nombre, args = []) {
    const f = this.entorno.vars.get(nombre);
    if (!(f instanceof FuncionAguila)) return undefined;
    return this.interp.llamarValor(f, args, null);
  }

  obtener(nombre) { return this.entorno.vars.get(nombre); }
  tiene(nombre) { return this.entorno.vars.has(nombre); }
  asignar(nombre, valor) {
    if (!this.entorno.vars.has(nombre)) return false;
    this.entorno.vars.set(nombre, valor);
    return true;
  }

  // Variables del script (para «Valores en vivo»).
  variables() {
    const r = [];
    for (const [k, v] of this.entorno.vars) {
      if (v instanceof FuncionAguila || v instanceof ClaseAguila || typeof v === 'function') continue;
      r.push({ nombre: k, valor: v, tipo: tipoDe(v), exportada: this.exportadas.includes(k) });
    }
    return r;
  }
}
