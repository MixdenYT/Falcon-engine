// Ara en Falcon Engine: compila los scripts .ara del proyecto (con la API de motor.ara) a WebAssembly y los ejecuta
// en el mundo del juego. Cada script de un nodo es una `InstanciaAra`, que se usa igual que una `InstanciaScript`
// de Águila (tieneEvento, emitir, variables…), así que el resto del mundo no distingue los dos lenguajes.
//
// Las externas de motor.ara se implementan con la misma lógica que la API de Águila: propiedades con
// `nodo.aguilaObtener/aguilaAsignar`, métodos con `nodo.metodos()` y funciones con las globales del intérprete.

import { crearCompilador, situar } from './compilador.mjs';
import { cargar, HAY_JSPI } from './ara.mjs';
import { ErrorAguila, aTexto } from '../aguila/index.js';
import { tipo as tipoNodo } from '../motor/tipos.js';

export { HAY_JSPI };

/** Lee un archivo que va junto a este (en Electron, por el protocolo falcon://; en Node, del disco). */
async function leerPropio(nombre, comoTexto) {
  const url = new URL(nombre, import.meta.url);
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    const datos = await readFile(url);
    return comoTexto ? datos.toString('utf8') : new Uint8Array(datos);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no se pudo cargar ${nombre} (${r.status})`);
  return comoTexto ? r.text() : new Uint8Array(await r.arrayBuffer());
}

let compilador = null;
let motor = null;

// Lo ya compilado a código máquina en esta sesión: el runtime (siempre los mismos bytes) y los últimos programas
// (pulsar «Jugar» otra vez sin cambiar ningún script no vuelve a compilar nada).
const modulosCompilados = new WeakMap(); // bytes → Promise<WebAssembly.Module>
const compilado = (bytes) => {
  let m = modulosCompilados.get(bytes);
  if (!m) {
    m = WebAssembly.compile(bytes);
    m.catch(() => modulosCompilados.delete(bytes));
    modulosCompilados.set(bytes, m);
  }
  return m;
};
// El runtime de Ara es la versión ligera para la web (herramientas/runtime-web.sh del repositorio de Ara: 96 KB en vez
// de 226 KB); el mismo en el editor y en los juegos exportados. Se lee una vez.
let runtimePropio = null;
const runtimeAra = () => (runtimePropio ||= leerPropio('./ara_runtime.wasm', false).catch((e) => { runtimePropio = null; throw e; }));
const PROGRAMAS_GUARDADOS = 4;
const programas = new Map(); // textos de los scripts → { modulo: Promise<WebAssembly.Module>, archivos }

/** El compilador de Ara (se carga una vez) y el texto de motor.ara. */
export async function compiladorAra() {
  if (!compilador) {
    const [bytes, texto] = await Promise.all([leerPropio('./ara_web.wasm', false), leerPropio('./motor.ara', true)]);
    compilador = await crearCompilador(bytes);
    motor = texto;
  }
  return { compilador, motor };
}

/**
 * Comprueba los scripts sin ejecutarlos (para el editor). `textos` es un objeto o un Map `rel → texto`.
 * @returns {Promise<Array<{archivo, linea, columna, linea_fin, columna_fin, mensaje, nota}>>} los errores
 */
export async function comprobarAra(textos) {
  const { compilador, motor } = await compiladorAra();
  const archivos = [['motor.ara', motor], ...(textos instanceof Map ? [...textos] : Object.entries(textos))];
  return compilador.compilar(archivos).errores;
}

/** Da formato a un script de Ara: `{ ok, texto }`. */
export async function formatearAra(texto) {
  const { compilador } = await compiladorAra();
  return compilador.formatear(texto);
}

/** Un error de compilación de Ara convertido al formato que usa el editor (el de Águila). */
export function errorDeCompilacion(e) {
  return new ErrorAguila(e.mensaje, {
    archivo: e.archivo, linea: e.linea, columna: Math.max(0, e.columna - 1),
    finColumna: e.linea_fin === e.linea ? Math.max(e.columna, e.columna_fin - 1) : e.columna, explicacion: e.nota || '', fase: 'sintaxis',
  });
}

/** Versión del formato de `.falcon/ara.json`: cambia cuando cambia lo que se guarda o cómo se carga. */
const DISPOSICION_EXPORTADA = 1;

/**
 * Compila los scripts de Ara de un proyecto al exportarlo. Lanza un `ErrorAguila` (con `errores`) si alguno tiene
 * errores: un juego exportado no puede llevar scripts que no compilan.
 * @param {Map<string, string>|object} textos  `rel → texto` de los .ara del proyecto
 * @returns {Promise<{ modulo: Uint8Array, descripcion: object }>} lo que se guarda en `.falcon/ara.wasm` y `.falcon/ara.json`
 */
export async function compilarParaExportar(textos) {
  const { compilador, motor } = await compiladorAra();
  const lista = textos instanceof Map ? [...textos] : Object.entries(textos);
  const r = compilador.compilar([['motor.ara', motor], ...lista]);
  if (!r.ok) {
    const e = errorDeCompilacion(r.errores[0]);
    e.errores = r.errores;
    throw e;
  }
  return { modulo: r.modulo, descripcion: { disposicion: DISPOSICION_EXPORTADA, archivos: r.archivos } };
}

const esTipoNodo = (t) => /^[A-Z]/.test(t);

/** El programa de Ara de un proyecto (todos sus scripts .ara compilados juntos) dentro de un mundo. */
export class ProgramaAra {
  /**
   * Compila los scripts y monta el módulo. Lanza un `ErrorAguila` con el primer error de compilación.
   * @param {object} mundo  El `Mundo` (src/motor/mundo.js).
   * @param {Map<string, string>} textos  `rel → texto` de los .ara del proyecto.
   */
  static async crear(mundo, textos) {
    const { compilador, motor } = await compiladorAra();
    const p = new ProgramaAra(mundo, Object.fromEntries([['motor.ara', motor], ...textos]));
    const clave = Object.entries(p.textos).map(([rel, texto]) => `${rel}\0${texto}`).join('\0\0');
    let guardado = programas.get(clave);
    if (!guardado) {
      const r = compilador.compilar(Object.entries(p.textos));
      if (!r.ok) {
        const e = errorDeCompilacion(r.errores[0]);
        e.errores = r.errores;
        throw e;
      }
      guardado = { modulo: WebAssembly.compile(r.modulo), archivos: r.archivos };
      guardado.modulo.catch(() => programas.delete(clave)); // un fallo no se guarda: se vuelve a intentar
      if (programas.size >= PROGRAMAS_GUARDADOS) programas.delete(programas.keys().next().value);
    } else {
      programas.delete(clave); // pasa a ser el más reciente
    }
    programas.set(clave, guardado);
    await p.montar(await guardado.modulo, guardado.archivos, compilado(await runtimeAra()));
    return p;
  }

  /**
   * Monta un programa ya compilado al exportar el juego (`compilarParaExportar`): así el juego exportado no
   * necesita el compilador. `textos` son los .ara del proyecto (para situar los errores de ejecución).
   */
  static async desdeCompilado(mundo, textos, modulo, descripcion) {
    if (descripcion.disposicion !== DISPOSICION_EXPORTADA) throw new Error('los scripts de Ara se exportaron con otra versión de Falcon Engine; vuelve a exportar el juego');
    const [motor, runtime] = await Promise.all([leerPropio('./motor.ara', true), runtimeAra()]);
    const p = new ProgramaAra(mundo, Object.fromEntries([['motor.ara', motor], ...textos]));
    await p.montar(modulo, descripcion.archivos, compilado(runtime));
    return p;
  }

  async montar(modulo, archivos, runtime) {
    const mundo = this.mundo;
    this.archivos = archivos;
    this.ara = await cargar(modulo, {
      runtime,
      // `imprimir` escribe la línea entera de una vez: va a la consola de Salida, como `mostrar` en Águila.
      escribir: (t) => mundo.interp.salida(t.replace(/\n$/, '')),
      ahora: () => Date.now() / 1000,
      esperar: (s) => new Promise((resolver) => this.esperas.push({ fin: this.tiempo + Math.max(0, Number(s) || 0), resolver })),
      anfitrion: (ara) => this.anfitrion(ara),
    });
    this.clases = new Map(this.ara.juego.clases.map((c) => [c.nombre, c]));
  }

  constructor(mundo, textos) {
    this.mundo = mundo;
    this.textos = textos;
    this.archivos = [];
    this.nodos = [null]; // el manejador 0 es «ningún nodo»
    this.ids = new Map();
    this.tiempo = 0;
    this.esperas = [];
  }

  /** El manejador de un nodo (0 si no hay). */
  manejador(nodo) {
    if (!nodo) return 0;
    let id = this.ids.get(nodo);
    if (id === undefined) {
      id = this.nodos.length;
      this.nodos.push(nodo);
      this.ids.set(nodo, id);
    }
    return id;
  }

  nodoDe(id) {
    return this.nodos[id] || null;
  }

  /** Avanza el tiempo de juego y deja seguir a los eventos cuyo `esperar` terminó. */
  actualizar(dt) {
    this.tiempo += dt;
    if (!this.esperas.length) return;
    const listas = this.esperas.filter((e) => e.fin <= this.tiempo + 1e-9);
    this.esperas = this.esperas.filter((e) => !listas.includes(e));
    for (const e of listas.sort((a, b) => a.fin - b.fin)) e.resolver();
  }

  /** El error pendiente de Ara convertido en `ErrorAguila`, con su archivo y línea; lo borra. */
  errorPendiente() {
    const e = this.ara.error();
    if (!e) return null;
    this.ara.limpiarError();
    const donde = situar(e.inicio, this.archivos, this.textos);
    return new ErrorAguila(e.mensaje, { archivo: donde?.archivo ?? null, linea: donde?.linea ?? 0, columna: donde ? donde.columna - 1 : 0, fase: 'ejecucion' });
  }

  /** Convierte un valor de Ara (tal como llega por la frontera) a JavaScript. */
  aJs(tipo, v) { return this.convertidorJs(tipo)(v); }

  /** La función que convierte valores de Ara de ese tipo a JavaScript (se calcula una vez por externa). */
  convertidorJs(tipo) {
    if (tipo === 'decimal') return (v) => v;
    if (tipo === 'entero') return (v) => Number(v);
    if (tipo === 'booleano') return (v) => v !== 0;
    if (tipo === 'texto') return (v) => this.ara.leerTexto(v);
    if (esTipoNodo(tipo)) return (v) => this.nodos[v] || null;
    return (v) => v;
  }

  /** La función que convierte valores de JavaScript al tipo de Ara `tipo` (se calcula una vez por externa). */
  convertidorAra(tipo) {
    switch (tipo) {
      case 'nada': return () => undefined;
      case 'decimal': return (v) => Number(v) || 0;
      case 'entero': return (v) => BigInt(Math.trunc(Number(v) || 0));
      case 'booleano': return (v) => (v ? 1 : 0);
    }
    if (esTipoNodo(tipo)) return (v) => this.manejador(v && typeof v === 'object' && !v.eliminado ? v : null);
    return (v) => this.aAra(tipo, v);
  }

  /** Convierte un valor de JavaScript (lo que devuelve la API de Águila) al tipo de Ara que pide la externa. */
  aAra(tipo, v) {
    switch (tipo) {
      case 'nada': return undefined;
      case 'decimal': return Number(v) || 0;
      case 'entero': return BigInt(Math.trunc(Number(v) || 0));
      case 'booleano': return v ? 1 : 0;
      case 'texto': return this.ara.textoNuevo(v === null || v === undefined ? '' : typeof v === 'string' ? v : aTexto(v));
    }
    const lista = /^lista\[(.+)\]$/.exec(tipo);
    if (lista) {
      const elem = lista[1];
      const valores = Array.isArray(v) ? v : [];
      return this.ara.lista(esTipoNodo(elem) ? valores.map((n) => this.manejador(n)) : valores, esTipoNodo(elem) ? 'entero' : elem);
    }
    if (esTipoNodo(tipo)) return this.manejador(v && typeof v === 'object' && !v.eliminado ? v : null);
    return 0;
  }

  /** Las externas de motor.ara, a partir de su descripción en el módulo. */
  anfitrion(ara) {
    this.ara = ara;
    const m = this.mundo;
    const imports = {};
    const nombres = new Set(ara.juego.externas.map((x) => x.nombre));
    const nodo = (id, que) => {
      const n = this.nodoDe(id);
      if (!n || n.eliminado) throw new Error(`no hay ningún nodo para usar «${que}» (puede que se haya eliminado o que «nodo(...)» no lo encontrara)`);
      return n;
    };
    // Algunas no existen en Águila con ese nombre o esa forma.
    // Reciben los datos ya convertidos (el nodo, no su manejador).
    const leer = (n, campo) => {
      if (!n || n.eliminado) throw new Error(`no hay ningún nodo para leer «${campo}»`);
      const v = n.aguilaObtener(campo);
      if (v === undefined) throw new Error(`el nodo «${n.nombre}» no tiene «${campo}» (ni su script ni el nodo)`);
      return v;
    };
    const cambiar = (n, campo, v) => {
      if (!n || n.eliminado) throw new Error(`no hay ningún nodo para cambiar «${campo}»`);
      if (!n.aguilaAsignar(campo, v)) throw new Error(`el nodo «${n.nombre}» no tiene «${campo}» o no se puede cambiar`);
    };
    const llamarScript = (n, f, args) => {
      if (!n || n.eliminado) throw new Error(`no hay ningún nodo para llamar a «${f}»`);
      return m.llamarFuncion(n, f, args);
    };
    const propias = {
      'Nodo.existe': (n) => !!n && !n.eliminado,
      'Nodo.llamar': (n, f, ...args) => { llamarScript(n, f, args); },
      'Nodo.consultar': (n, f, ...args) => {
        const r = llamarScript(n, f, args);
        if (typeof r !== 'number' && typeof r !== 'boolean') throw new Error(`la función «${f}» de «${n.nombre}» no devuelve un número`);
        return Number(r);
      },
      'Nodo.leer_numero': (n, c) => { const v = leer(n, c); if (typeof v !== 'number' && typeof v !== 'boolean') throw new Error(`«${c}» de «${n.nombre}» no es un número`); return Number(v); },
      'Nodo.leer_texto': (n, c) => leer(n, c),
      'Nodo.leer_booleano': (n, c) => !!leer(n, c),
      'Nodo.leer_nodo': (n, c) => { const v = leer(n, c); return v && typeof v === 'object' && 'scripts' in v ? v : null; },
      'Nodo.cambiar_numero': cambiar, 'Nodo.cambiar_texto': cambiar, 'Nodo.cambiar_booleano': cambiar, 'Nodo.cambiar_nodo': cambiar,
      guardar_numero: (k, v) => m.interp.globales.vars.get('guardar')(k, v),
      cargar_numero: (k, def) => Number(m.interp.globales.vars.get('cargar')(k, def)) || 0,
      texto_numero: (n) => aTexto(n),
      puntos: () => m.interp.globales.vars.get('puntos') || 0,
      poner_puntos: (n) => { m.interp.globales.vars.set('puntos', n); },
      gravedad_global: () => m.interp.globales.vars.get('gravedad'),
      poner_gravedad_global: (g) => { m.interp.globales.vars.set('gravedad', g); },
    };
    for (const x of ara.juego.externas) {
      const base = x.nombre.split('#')[0];
      // Los convertidores se preparan aquí: estas funciones se llaman muchas veces por fotograma.
      const cs = x.params.map((t) => this.convertidorJs(t));
      const conv = (args) => { for (let i = 0; i < args.length; i++) args[i] = cs[i](args[i]); return args; };
      // `g` con los datos ya convertidos; sin `...args` en lo más común (hasta 3 datos).
      const convertidos = (g) => {
        const [c0, c1, c2] = cs;
        switch (cs.length) {
          case 0: return () => g();
          case 1: return (a) => g(c0(a));
          case 2: return (a, b) => g(c0(a), c1(b));
          case 3: return (a, b, c) => g(c0(a), c1(b), c2(c));
          default: return (...args) => g(...conv(args));
        }
      };
      let f;
      if (propias[base]) {
        f = convertidos(propias[base]);
      } else if (base.endsWith('=')) {
        const prop = base.slice(base.indexOf('.') + 1, -1);
        f = (id, v) => {
          const n = nodo(id, prop);
          if (!n.aguilaAsignar(prop, cs[1](v))) throw new Error(`el nodo «${n.nombre}» (${tipoNodo(n.tipo).nombreVisible}) no tiene la propiedad «${prop}» o no se puede cambiar`);
        };
      } else if (base.includes('.') && nombres.has(base + '=')) {
        const prop = base.slice(base.indexOf('.') + 1);
        f = (id) => {
          const n = nodo(id, prop);
          const v = n.aguilaObtener(prop);
          if (v === undefined) throw new Error(`el nodo «${n.nombre}» (${tipoNodo(n.tipo).nombreVisible}) no tiene la propiedad «${prop}»`);
          return v;
        };
      } else if (base.includes('.')) {
        const metodo = base.slice(base.indexOf('.') + 1);
        f = (id, ...args) => {
          const n = nodo(id, metodo);
          const met = n.metodo(metodo); // la misma regla que en Águila
          if (!met) {
            throw new Error(`el nodo «${n.nombre}» (${tipoNodo(n.tipo).nombreVisible}) no tiene «${metodo}»`);
          }
          for (let i = 0; i < args.length; i++) args[i] = cs[i + 1](args[i]);
          return met(...args);
        };
      } else {
        let g = null; // las funciones globales del motor no cambian: se buscan una vez
        f = convertidos((...args) => {
          g ||= m.interp.globales.vars.get(base);
          if (typeof g !== 'function') { g = null; throw new Error(`Falcon no tiene la función «${base}»`); }
          return g(...args);
        });
      }
      // Se llaman muchas veces por fotograma: con un número fijo de datos (sin `...args`) y la conversión del
      // resultado ya preparada.
      const aR = this.convertidorAra(x.retorno);
      const fallo = (e) => {
        ara.fallar(e && (e.mensajeCorto || e.message) || String(e));
        return aR(null);
      };
      switch (x.params.length) {
        case 0: imports[x.nombre] = () => { try { return aR(f()); } catch (e) { return fallo(e); } }; break;
        case 1: imports[x.nombre] = (a) => { try { return aR(f(a)); } catch (e) { return fallo(e); } }; break;
        case 2: imports[x.nombre] = (a, b) => { try { return aR(f(a, b)); } catch (e) { return fallo(e); } }; break;
        case 3: imports[x.nombre] = (a, b, c) => { try { return aR(f(a, b, c)); } catch (e) { return fallo(e); } }; break;
        default: imports[x.nombre] = (...args) => { try { return aR(f(...args)); } catch (e) { return fallo(e); } };
      }
    }
    return imports;
  }
}

/** El script de Ara de un nodo: un objeto de su clase. Se usa igual que una `InstanciaScript` de Águila. */
export class InstanciaAra {
  /**
   * @param {ProgramaAra} programa
   * @param {object} host  El `NodoVivo`.
   * @param {string} clase  El nombre de la clase (la que define el archivo).
   * @param {string} archivo  El .ara (para los errores).
   */
  constructor(programa, host, clase, archivo) {
    this.programa = programa;
    this.host = host;
    this.archivo = archivo;
    this.nombreClase = clase;
    this.desc = programa.clases.get(clase);
    if (!this.desc) throw new ErrorAguila(`«${archivo}» no define ninguna clase`, { archivo, explicacion: 'Un script de Ara es una «clase Nombre extiende TipoDeNodo:».' });
    this.base = this.desc.base;
    this.exportadas = this.desc.campos.filter((c) => c.exportar).map((c) => c.nombre);
    this.funciones = new Map((this.desc.funciones || []).map((f) => [f.nombre, f]));
    this.objeto = 0;
    this.desactivados = new Set();
    // Tablas por nombre (se consultan muchas veces por fotograma: `jugador.leer_booleano("activo")`, los eventos).
    this.campos = new Map(this.desc.campos.map((c) => [c.nombre, c]));
    this.eventos = new Map();
    for (const ev of this.desc.eventos) {
      if (!this.eventos.has(ev.evento)) this.eventos.set(ev.evento, []);
      this.eventos.get(ev.evento).push(ev);
    }
    this.lectores = new Map(); // nombre del campo → (objeto) => valor en JavaScript
  }

  get ara() { return this.programa.ara; }

  /** Crea el objeto y aplica los valores del Inspector. Lanza el error si falla. */
  iniciar(valoresExportados = {}) {
    this.objeto = this.ara.exports[`${this.nombreClase}.crear`](this.programa.manejador(this.host));
    const e = this.programa.errorPendiente();
    if (e) throw e;
    for (const c of this.desc.campos) {
      if (!c.exportar || !Object.prototype.hasOwnProperty.call(valoresExportados, c.nombre)) continue;
      this.asignar(c.nombre, valoresExportados[c.nombre]);
    }
  }

  tieneEvento(evento) { return this.eventos.has(evento); }

  /** Lanza un evento. Devuelve el error ocurrido (o null). Si un caso espera, su error llegará más tarde. */
  emitir(evento, args = []) {
    let error = null;
    const lista = this.eventos.get(evento);
    if (!lista) return null;
    for (const ev of lista) {
      if (!this.objeto || (this.desactivados.size && this.desactivados.has(ev.exportacion))) continue;
      if (ev.filtro !== null && aTexto(args[0]) !== ev.filtro) continue;
      let r;
      // Lo más frecuente (`se_actualiza(delta)`): un decimal, sin crear listas.
      if (ev.datos.length === 1 && ev.datos[0] === 'decimal') r = this.ara.llamar(ev.exportacion, this.objeto, Number(args[0]) || 0);
      else r = this.ara.llamar(ev.exportacion, this.objeto, ...ev.datos.map((t, i) => this.programa.aAra(t, args[i])));
      if (r && typeof r.then === 'function') {
        r.then(() => { const e = this.programa.errorPendiente(); if (e) this.programa.mundo.reportarError(e, this.host); });
      }
      const e = this.programa.errorPendiente();
      if (e) {
        // Como en Águila: tras un error, ese caso deja de ejecutarse para no inundar la consola.
        this.desactivados.add(ev.exportacion);
        error = e;
      }
    }
    return error;
  }

  /** Las esperas las lleva el programa entero (`ProgramaAra.actualizar`). */
  actualizarCorrutinas() { return null; }

  tieneFuncion(nombre) { return this.funciones.has(nombre); }

  /**
   * Llama a una función de la clase por su nombre (`nodo.llamar(...)`, las conexiones de señales, el CQB).
   * Solo están las que reciben números, booleanos, textos y nodos. Lanza el error si falla.
   */
  llamarFuncion(nombre, args = []) {
    const f = this.funciones.get(nombre);
    if (!f || !this.objeto) throw new ErrorAguila(`${this.host.nombre} no tiene ninguna función «${nombre}».`, { archivo: this.archivo, fase: 'ejecucion' });
    if (args.length !== f.params.length) {
      throw new ErrorAguila(`la función «${nombre}» de ${this.host.nombre} recibe ${f.params.length} dato(s), pero le llegan ${args.length}.`, { archivo: this.archivo, fase: 'ejecucion' });
    }
    const valores = f.params.map((t, i) => this.programa.aAra(t, args[i]));
    const r = this.ara.llamar(f.exportacion, this.objeto, ...valores);
    if (r && typeof r.then === 'function') {
      // Espera (`esperar`): el resultado llega más tarde y quien llama sigue sin él.
      r.then(() => { const e = this.programa.errorPendiente(); if (e) this.programa.mundo.reportarError(e, this.host); });
      return null;
    }
    const e = this.programa.errorPendiente();
    if (e) throw e;
    return f.retorno === 'nada' ? null : this.programa.aJs(f.retorno, r);
  }

  llamar(nombre, args = []) { return this.llamarFuncion(nombre, args); }

  /** ¿Tiene ese campo o esa función? (como `InstanciaScript.tiene`). */
  tiene(nombre) { return this.campos.has(nombre) || this.funciones.has(nombre); }

  obtener(nombre) {
    if (!this.objeto) return undefined;
    let leer = this.lectores.get(nombre);
    if (leer === undefined) {
      const c = this.campos.get(nombre);
      if (!c) return undefined;
      const exportada = this.ara.exports[`${this.nombreClase}.leer.${nombre}`];
      const aJs = this.programa.convertidorJs(c.tipo);
      leer = (o) => aJs(exportada(o));
      this.lectores.set(nombre, leer);
    }
    return leer(this.objeto);
  }

  /**
   * Cambia un campo desde fuera: el Inspector, la recarga en caliente o un script de Águila (`otro.vida = 3`).
   * Solo los de tipo número, texto o booleano (los demás no tienen `poner`). Devuelve si se pudo.
   */
  asignar(nombre, valor) {
    const c = this.campos.get(nombre);
    const poner = c && this.ara.exports[`${this.nombreClase}.poner.${nombre}`];
    if (!poner || !this.objeto) return false;
    poner(this.objeto, this.programa.aAra(c.tipo, valor));
    const e = this.programa.errorPendiente();
    if (e) throw e;
    return true;
  }

  /** Los campos con su valor (para «Valores en vivo»). */
  variables() {
    return this.desc.campos.map((c) => ({ nombre: c.nombre, valor: this.obtener(c.nombre), tipo: c.tipo, exportada: c.exportar }));
  }

  /** El nodo se ha eliminado: se suelta el objeto. */
  soltar() {
    if (this.objeto) this.ara.exports[`${this.nombreClase}.soltar`](this.objeto);
    this.objeto = 0;
  }
}

/** El nombre de la clase que define un script de Ara: la primera `clase Nombre` del texto. */
export function claseDe(texto) {
  const m = /^clase\s+([\p{L}_][\p{L}\p{N}_]*)/mu.exec(texto || '');
  return m ? m[1] : null;
}
