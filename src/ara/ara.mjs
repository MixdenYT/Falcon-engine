//# allFunctionsCalledOnLoad
// Cargador de programas de Ara compilados a WebAssembly (`ara wasm`). Funciona en el navegador, en Node y en
// Electron, sin dependencias.
//
// Ejecutar un programa:
//   import { ejecutar } from './ara.mjs';
//   const r = await ejecutar(bytesPrograma, { runtime: bytesRuntime, escribir: (t) => consola.push(t) });
//   if (r.error) mostrar(r.error.mensaje, r.error.inicio, r.error.fin);
//
// Hacer de anfitrión (externas, clases y eventos; ver docs/JUEGOS.md):
//   const ara = await cargar(bytesPrograma, { runtime, anfitrion: { 'Nodo.x': (n) => nodos[n].x, ... } });
//   const objeto = ara.exports['Jugador.crear'](manejador);
//   await ara.llamar('Jugador.cuando.se_actualiza#1', objeto, 1 / 60);
//   if (ara.error()) { ...; ara.limpiarError(); }
//
// Desde la terminal: `node ara.mjs programa.wasm [ara_runtime.wasm]`.
//
// Un programa «fusionado» (el runtime y el programa en un solo .wasm, con solo las partes del runtime que usa; ver
// herramientas/construir-ara.mjs de mixden.net) no necesita `runtime`: se carga con una sola instancia.

/** Disposición de memoria que da por supuesta el compilador (`ara_wasm::DISPOSICION`). */
const DISPOSICION = 4 | 8 << 8 | 12 << 16 | 8 << 24;

// Lo que acepta `str::parse::<f64>` de Rust (sin espacios: el runtime ya los quita).
const DECIMAL = /^[+-]?(?:inf|infinity|nan|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i;
/** Un decimal como lo escribe Ara (como `repr` de Python): `2.0`, `0.1`, `1e+16`, `1.5e-05`, `nan`, `inf`. */
function decimalATexto(x) {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-4 || a >= 1e16)) {
    const [mantisa, exp] = x.toExponential().split('e');
    const e = Number(exp);
    return `${mantisa}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  }
  if (Number.isInteger(x)) return (Object.is(x, -0) ? '-0' : String(x)) + '.0';
  return String(x);
}

/** ¿Hay JSPI (integración de promesas de WebAssembly)? Sin él, `esperar` no puede pausar. */
export const HAY_JSPI = typeof WebAssembly.Suspending === 'function' && typeof WebAssembly.promising === 'function';

// ---------- La foto de la memoria ----------
//
// Todo el estado de un programa de Ara está en su memoria (un solo bloque, con direcciones que son posiciones dentro
// de él) y en las variables globales de sus módulos. Una foto es una copia de las dos cosas: restaurarla deja el
// programa como estaba, en el mismo juego o en otro recién cargado, con una sola copia de bytes.

const MARCA_FOTO = 'ARAFOTO2';

/** Los bytes de un BufferSource. */
const aBytes = (x) => (x instanceof Uint8Array ? x : ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : new Uint8Array(x));

/** Una huella de unos bytes (FNV-1a de 32 bits), para saber si una foto es de este programa y este runtime. */
const huellaDe = (bytes, h = 0x811c9dc5) => {
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return h >>> 0;
};

/**
 * El mismo módulo exportando además todas sus variables globales (`__ara_g0`, `__ara_g1`...), para poder leerlas y
 * cambiarlas desde fuera. Solo se toca la sección de exportaciones.
 */
function exportarGlobales(modulo) {
  const b = aBytes(modulo);
  const leb = (p) => { let n = 0, d = 0; for (;;) { const x = b[p++]; n += (x & 127) * 2 ** d; d += 7; if (x < 128) return [n, p]; } };
  const aLeb = (n) => { const r = []; do { r.push((n & 127) | (n > 127 ? 128 : 0)); n = Math.floor(n / 128); } while (n > 0); return r; };
  let importadas = 0, propias = 0, exportaciones = null;
  for (let p = 8; p < b.length;) {
    const id = b[p];
    const [largo, ini] = leb(p + 1);
    if (id === 2) {
      // Las globales importadas van antes que las propias al numerarlas.
      let [n, q] = leb(ini);
      for (; n > 0; n--) {
        for (let k = 0; k < 2; k++) { const [l, r] = leb(q); q = r + l; }
        const que = b[q++];
        if (que === 0) q = leb(q)[1];
        else if (que === 3) { q += 2; importadas++; }
        else { if (que === 1) q++; const maximo = b[q++] & 1; q = leb(q)[1]; if (maximo) q = leb(q)[1]; }
      }
    } else if (id === 6) propias = leb(ini)[0];
    else if (id === 7) exportaciones = { desde: p, ini, fin: ini + largo };
    p = ini + largo;
  }
  if (!exportaciones) throw new Error('el módulo no tiene sección de exportaciones');
  const [cuantas, primera] = leb(exportaciones.ini);
  const nuevas = [];
  for (let i = 0; i < propias; i++) {
    const nombre = `__ara_g${i}`;
    nuevas.push(nombre.length, ...[...nombre].map((c) => c.charCodeAt(0)), 3, ...aLeb(importadas + i));
  }
  const contenido = [...aLeb(cuantas + propias), ...b.subarray(primera, exportaciones.fin), ...nuevas];
  return new Uint8Array([...b.subarray(0, exportaciones.desde), 7, ...aLeb(contenido.length), ...contenido, ...b.subarray(exportaciones.fin)]);
}

/** Las globales que exportó `exportarGlobales`, en orden. */
const globalesDe = (exportaciones) => {
  const gs = [];
  for (let i = 0; `__ara_g${i}` in exportaciones; i++) gs.push(exportaciones[`__ara_g${i}`]);
  return gs;
};

/**
 * Monta el runtime y el programa sin ejecutar nada todavía.
 * @param {BufferSource|WebAssembly.Module|Promise} programa  El módulo que genera `ara wasm` (sus bytes, o ya compilado
 *   con WebAssembly.compileStreaming para no esperar a que termine de descargarse).
 * @param {object} opciones
 *   - `runtime`: `ara_runtime.wasm` (bytes, módulo compilado o una promesa de cualquiera de los dos).
 *   - `escribir(texto)`: salida de `imprimir`.
 *   - `ahora()`: segundos desde 1970.
 *   - `esperar(segundos)`: promesa que se resuelve cuando hay que seguir. Por defecto, tiempo real.
 *   - `sistema`: archivos y entrada, para el runtime de consola (`ara_runtime_sistema.wasm`): `leerArchivo(ruta)`
 *     (sus bytes, o null si no existe), `escribirArchivo(ruta, bytes, alFinal)`, `existeArchivo(ruta)` y
 *     `leerLinea()` (una línea de la entrada con su salto, como texto o bytes, o null si se acabó).
 *   - `anfitrion`: las externas, por su nombre de importación (`f`, `Tipo.m`, `Tipo.p`, `Tipo.p=`, `f#2`...),
 *     u otra función que recibe el objeto devuelto y devuelve esas externas.
 *   - `foto`: `true` para poder hacer fotos de la memoria (`ara.foto()` y `ara.restaurar(foto)`), o una foto ya
 *     hecha, de la que arranca el programa en vez de empezar de cero. El programa y el runtime tienen que llegar
 *     como bytes (no ya compilados). Lo que guarda el anfitrión (sus nodos, sus texturas) no va en la foto.
 */
export async function cargar(programa, opciones = {}) {
  const {
    runtime,
    escribir = (t) => console.log(t.replace(/\n$/, '')),
    ahora = () => Date.now() / 1000,
    esperar = (s) => new Promise((r) => setTimeout(r, s * 1000)),
    anfitrion = {},
    sistema = {},
    foto = null,
  } = opciones;
  const decodificador = new TextDecoder();
  const codificador = new TextEncoder();
  const ara = {};
  let memoria = null, E = null, ctx = 0;
  const delRuntime = {
    escribir: (p, n) => escribir(decodificador.decode(new Uint8Array(memoria.buffer, p, n), { stream: true })),
    ahora,
    // El runtime «ligero» (ver ara_runtime/src/wasm.rs) deja a JavaScript lo que en Rust lleva tablas grandes:
    // mayúsculas y minúsculas de Unicode (op 0 y 1) y el decimal `x` como texto (op 2). Devuelve `puntero << 32 | largo`.
    __ara_convertir: (op, p, n, x) => {
      const s = op === 2 ? decimalATexto(x) : textoDeMemoria(p, n);
      const datos = codificador.encode(op === 0 ? s.toUpperCase() : op === 1 ? s.toLowerCase() : s);
      if (datos.length === 0) return 0n;
      const destino = E.ara_wasm_reservar(datos.length) >>> 0;
      new Uint8Array(memoria.buffer, destino, datos.length).set(datos);
      return (BigInt(destino) << 32n) | BigInt(datos.length);
    },
    // Un decimal como lo lee Rust (`str::parse::<f64>`): 1 y el valor en `salida`, o 0 si el texto no es un decimal.
    __ara_a_decimal: (p, n, salida) => {
      const s = textoDeMemoria(p, n);
      if (!DECIMAL.test(s)) return 0;
      const sin = s.replace(/^[+-]/, '').toLowerCase();
      const x = sin === 'nan' ? NaN : sin === 'inf' || sin === 'infinity' ? Infinity : Number(sin);
      new DataView(memoria.buffer).setFloat64(salida, s[0] === '-' ? -x : x, true);
      return 1;
    },
  };
  // El runtime de consola (característica `sistema`, ver ara_runtime/src/wasm.rs) pide aquí los archivos y la entrada.
  // Devuelve `puntero << 32 | largo` con los bytes leídos, 0 o 1, o todo unos si no se puede.
  const NO_SE_PUEDE = 0xffffffffffffffffn;
  delRuntime.__ara_sistema = (op, pRuta, nRuta, pDatos, nDatos) => {
    const devolver = (datos) => {
      if (datos == null) return NO_SE_PUEDE;
      if (typeof datos === 'string') datos = codificador.encode(datos);
      if (datos.length === 0) return 0n;
      const destino = E.ara_wasm_reservar(datos.length) >>> 0;
      new Uint8Array(memoria.buffer, destino, datos.length).set(datos);
      return (BigInt(destino) << 32n) | BigInt(datos.length);
    };
    try {
      const ruta = textoDeMemoria(pRuta, nRuta);
      if (op === 0) return devolver(sistema.leerArchivo?.(ruta));
      if (op === 1 || op === 2) {
        if (!sistema.escribirArchivo) return NO_SE_PUEDE;
        sistema.escribirArchivo(ruta, new Uint8Array(memoria.buffer, pDatos, nDatos).slice(), op === 2);
        return 0n;
      }
      if (op === 3) return sistema.existeArchivo?.(ruta) ? 1n : 0n;
      if (op === 4) return devolver(sistema.leerLinea?.());
    } catch {
      // Un archivo que no se puede leer o escribir: el programa recibe el error de Ara.
    }
    return NO_SE_PUEDE;
  };
  // Su propio TextDecoder: el de `escribir` va «en flujo» (una letra puede llegar partida entre dos escrituras).
  const decodificadorRuntime = new TextDecoder();
  const textoDeMemoria = (p, n) => decodificadorRuntime.decode(new Uint8Array(memoria.buffer, p, n));
  /** Comprueba que el runtime es el de este compilador y prepara la memoria y el contexto. */
  const montar = (exportaciones) => {
    // `instance.exports` es un getter: se guarda una vez (los textos y errores se leen en cada llamada a una externa).
    E = exportaciones;
    memoria = E.memory;
    const disposicion = E.ara_wasm_disposicion() >>> 0;
    if (disposicion !== DISPOSICION) {
      throw new Error(`el runtime no corresponde a este compilador (disposición ${disposicion.toString(16)}, se esperaba ${DISPOSICION.toString(16)})`);
    }
    ctx = E.ara_wasm_ctx();
  };
  // Para las fotos, los dos módulos exportan sus variables globales; la huella dice de qué módulos es una foto.
  let huella = 0;
  const preparar = (fuente) => {
    if (!foto || !fuente) return fuente;
    if (fuente instanceof WebAssembly.Module) throw new Error('para las fotos de memoria, el programa y el runtime tienen que llegar como bytes');
    huella = huellaDe(aBytes(fuente), huella || undefined);
    return exportarGlobales(fuente);
  };
  const fuente = preparar(await programa);
  const modulo = fuente instanceof WebAssembly.Module ? fuente : await WebAssembly.compile(fuente);
  const fusionado = !WebAssembly.Module.imports(modulo).some((i) => i.module === 'ara');
  let delModuloRuntime = {};
  if (!fusionado) {
    if (!runtime) throw new Error('falta el runtime de Ara (ara_runtime.wasm)');
    const instanciado = await WebAssembly.instantiate(preparar(await runtime), { anfitrion: delRuntime });
    // Con un módulo ya compilado, instantiate devuelve la instancia; con bytes, { module, instance }.
    montar((instanciado instanceof WebAssembly.Instance ? instanciado : instanciado.instance).exports);
    delModuloRuntime = E;
  }
  const seccion = WebAssembly.Module.customSections(modulo, 'ara.juego')[0];
  ara.juego = seccion ? JSON.parse(new TextDecoder().decode(seccion)) : { clases: [], externas: [] };

  // Vistas de la memoria: se rehacen solo si la memoria crece (entonces cambia `memoria.buffer`).
  let bytes = new Uint8Array(0), palabras = new Uint32Array(0);
  // Al crecer, el buffer anterior se separa y su tamaño pasa a 0 (más barato que leer `memoria.buffer` cada vez).
  const vistas = () => { if (bytes.byteLength === 0) { bytes = new Uint8Array(memoria.buffer); palabras = new Uint32Array(memoria.buffer); } };
  const lector = new TextDecoder();
  /** Los bytes `[p, p + n)` como texto. Los textos cortos y ASCII (nombres, acciones, grupos) no pasan por TextDecoder. */
  const decodificar = (p, n) => {
    vistas();
    if (n <= 64) {
      let s = '';
      for (let i = p; i < p + n; i++) {
        const c = bytes[i];
        if (c >= 0x80) return lector.decode(bytes.subarray(p, p + n));
        s += String.fromCharCode(c);
      }
      return s;
    }
    return lector.decode(bytes.subarray(p, p + n));
  };

  /** Lee un texto de Ara (prestado). */
  ara.leerTexto = (p) => p ? decodificar(E.ara_wasm_texto_puntero(p), E.ara_wasm_texto_largo(p)) : '';
  /** Copia `datos` a la memoria de Ara y llama a `f(puntero, largo)`. */
  const conBytes = (datos, f) => {
    const p = E.ara_wasm_reservar(datos.length);
    vistas();
    bytes.set(datos, p);
    try { return f(p, datos.length); } finally { E.ara_wasm_liberar(p, datos.length); }
  };
  /** Un texto nuevo de Ara: para devolverlo desde una externa o pasárselo a una función del programa. */
  ara.textoNuevo = (s) => conBytes(codificador.encode(String(s)), (p, n) => E.ara_wasm_texto(p, n));
  /** Hace fallar la externa en curso: el programa lo ve como un error en la posición de la llamada. */
  ara.fallar = (mensaje) => conBytes(codificador.encode(String(mensaje)), (p, n) => E.ara_wasm_fallar(ctx, p, n));
  /** El error pendiente, si lo hay: `{ mensaje, inicio, fin }` (posiciones en bytes del código fuente). */
  ara.error = () => {
    vistas();
    if (palabras[ctx >>> 2] === 0 && palabras[(ctx >>> 2) + 1] === 0) return null; // lo normal: sin error
    const largo = E.ara_wasm_mensaje(ctx);
    const mensaje = decodificar(E.ara_wasm_mensaje_puntero(), largo);
    vistas();
    const pos = new DataView(memoria.buffer).getBigUint64(ctx + 16, true);
    return { mensaje, inicio: pos ? Number(pos >> 32n) : null, fin: pos ? Number(pos & 0xffffffffn) : null };
  };
  ara.limpiarError = () => E.ara_wasm_limpiar_error(ctx);
  ara.vivos = () => Number(E.ara_wasm_vivos());
  /** Una lista nueva de Ara con enteros u objetos del anfitrión (sus manejadores), para devolverla desde una externa. */
  ara.listaDeManejadores = (valores) => ara.lista(valores, 'entero');
  /**
   * Una lista nueva de Ara (para devolverla desde una externa) con valores de tipo `elemento`: 'entero' (o un tipo
   * del anfitrión: manejadores), 'decimal', 'booleano' o 'texto'.
   */
  ara.lista = (valores, elemento = 'entero') => {
    const clase = { decimal: 1n, texto: 2n, booleano: 3n }[elemento] ?? 0n;
    const l = E.ara_lista_nueva(clase, BigInt(valores.length));
    const bits = new DataView(new ArrayBuffer(8));
    for (const v of valores) {
      let crudo;
      if (elemento === 'decimal') { bits.setFloat64(0, Number(v) || 0, true); crudo = bits.getBigUint64(0, true); }
      else if (elemento === 'texto') crudo = BigInt(ara.textoNuevo(v ?? ''));
      else if (elemento === 'booleano') crudo = v ? 1n : 0n;
      else crudo = BigInt(Math.trunc(Number(v) || 0));
      E.ara_lista_push(l, crudo);
    }
    return l;
  };

  const importaciones = {};
  if (!fusionado) {
    importaciones.memory = memoria;
    for (const [nombre, valor] of Object.entries(E)) if (nombre.startsWith('ara_')) importaciones[nombre] = valor;
  }
  const propias = typeof anfitrion === 'function' ? anfitrion(ara) : anfitrion;
  const delAnfitrion = {};
  for (const i of WebAssembly.Module.imports(modulo)) {
    if (i.module !== 'anfitrion') continue;
    // En un programa fusionado, el runtime también pide sus funciones al anfitrión.
    if (fusionado && i.name in delRuntime && !(i.name in (propias || {}))) { delAnfitrion[i.name] = delRuntime[i.name]; continue; }
    if (i.name === 'esperar') {
      delAnfitrion.esperar = HAY_JSPI
        ? new WebAssembly.Suspending(async (s) => { await esperar(s); })
        : () => ara.fallar('`esperar` necesita JSPI (WebAssembly con promesas): usa Electron 44+, Chrome 137+ o Node 25+');
      continue;
    }
    const f = propias[i.name];
    // Una externa que el anfitrión no da falla al llamarla (y devuelve un cero del tipo que toca).
    const retorno = ara.juego.externas.find((x) => x.nombre === i.name)?.retorno;
    const cero = retorno === 'entero' ? 0n : 0;
    delAnfitrion[i.name] = typeof f === 'function' ? f : () => { ara.fallar(`el anfitrión no da \`${i.name}\``); return retorno === 'nada' ? undefined : cero; };
  }
  const importacionesModulo = fusionado ? { anfitrion: delAnfitrion } : { ara: importaciones, anfitrion: delAnfitrion };
  // El módulo ya está compilado: se instancia en el acto (es casi instantáneo). Con `await WebAssembly.instantiate` el
  // navegador se pondría a hacer otras cosas antes de seguir y la página tardaría más en responder. Si el navegador no
  // deja instanciar así un módulo tan grande (RangeError), se hace como siempre.
  let instancia;
  try {
    instancia = new WebAssembly.Instance(modulo, importacionesModulo);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    instancia = await WebAssembly.instantiate(modulo, importacionesModulo);
  }
  const { exports } = instancia;
  if (fusionado) montar(exports);
  ara.exports = exports;

  const sinFotos = () => { throw new Error('las fotos de memoria se activan al cargar, con la opción `foto`'); };
  /**
   * Una foto del programa: lo que hay en su memoria (sin los ceros) y sus variables globales. Se hace entre dos
   * llamadas al programa, nunca mientras un evento está esperando.
   */
  ara.foto = !foto ? sinFotos : () => {
    // El runtime escrito en Ara sabe poner a cero la memoria que ya está libre: así no va en la foto.
    (fusionado ? exports : delModuloRuntime).rt_limpiar_libres?.();
    // Solo se guardan los tramos con algo: `[desde, hasta)`, en palabras de 4 bytes. Los ceros (32 bytes seguidos
    // o más) se saltan.
    const palabrasAhora = new Uint32Array(memoria.buffer);
    const total = palabrasAhora.length;
    const tramos = [];
    let guardadas = 0;
    for (let i = 0; i < total;) {
      while (i < total && palabrasAhora[i] === 0) i++;
      if (i === total) break;
      const desde = i;
      let hasta = i;
      for (let ceros = 0; i < total && ceros < 8; i++) {
        if (palabrasAhora[i] === 0) ceros++;
        else { ceros = 0; hasta = i + 1; }
      }
      tramos.push(desde, hasta);
      guardadas += hasta - desde;
      i = hasta;
    }
    const valor = (g) => (typeof g.value === 'bigint' ? `i${g.value}` : `n${Object.is(g.value, -0) ? '-0' : g.value}`);
    const cabecera = codificador.encode(JSON.stringify({ huella, ctx, paginas: total / 16384, globales: [globalesDe(delModuloRuntime).map(valor), globalesDe(exports).map(valor)] }));
    const f = new Uint8Array(16 + cabecera.length + tramos.length * 4 + guardadas * 4);
    const vista = new DataView(f.buffer);
    f.set(codificador.encode(MARCA_FOTO));
    vista.setUint32(8, cabecera.length, true);
    f.set(cabecera, 12);
    let p = 12 + cabecera.length;
    vista.setUint32(p, tramos.length / 2, true);
    p += 4;
    for (const t of tramos) { vista.setUint32(p, t, true); p += 4; }
    const todo = new Uint8Array(memoria.buffer);
    for (let k = 0; k < tramos.length; k += 2) {
      f.set(todo.subarray(tramos[k] * 4, tramos[k + 1] * 4), p);
      p += (tramos[k + 1] - tramos[k]) * 4;
    }
    return f;
  };
  /** Deja el programa como estaba al hacer la foto. Tiene que ser de este mismo programa y este mismo runtime. */
  ara.restaurar = !foto ? sinFotos : (f) => {
    f = aBytes(f);
    if (f.length < 16 || new TextDecoder().decode(f.subarray(0, 8)) !== MARCA_FOTO) throw new Error('esto no es una foto de memoria de Ara');
    const vista = new DataView(f.buffer, f.byteOffset, f.byteLength);
    const largo = vista.getUint32(8, true);
    const cabecera = JSON.parse(new TextDecoder().decode(f.subarray(12, 12 + largo)));
    if (cabecera.huella !== huella) throw new Error('la foto es de otro programa o de otro runtime');
    const faltan = cabecera.paginas - memoria.buffer.byteLength / 65536;
    if (faltan > 0) memoria.grow(faltan);
    const todo = new Uint8Array(memoria.buffer);
    todo.fill(0);
    let p = 12 + largo;
    const cuantos = vista.getUint32(p, true);
    let datos = p + 4 + cuantos * 8;
    for (let k = 0; k < cuantos; k++) {
      const desde = vista.getUint32(p + 4 + k * 8, true) * 4, hasta = vista.getUint32(p + 8 + k * 8, true) * 4;
      todo.set(f.subarray(datos, datos + hasta - desde), desde);
      datos += hasta - desde;
    }
    [delModuloRuntime, exports].forEach((modulo, k) => globalesDe(modulo).forEach((g, i) => {
      const v = cabecera.globales[k][i];
      // Las que no se pueden cambiar (constantes del módulo) ya valen lo mismo.
      try { g.value = v[0] === 'i' ? BigInt(v.slice(1)) : Number(v.slice(1)); } catch { /* fija */ }
    }));
    ctx = cabecera.ctx;
    // Las vistas de la memoria se rehacen en el siguiente uso.
    bytes = new Uint8Array(0);
  };
  // Con una foto ya hecha, el programa arranca de ella: no hay nada que iniciar.
  if (foto && foto !== true) ara.restaurar(foto);
  else exports.iniciar(ctx);

  // Las exportaciones que pueden quedarse esperando se llaman con `WebAssembly.promising`.
  const esperan = new Set();
  if (WebAssembly.Module.imports(modulo).some((i) => i.module === 'anfitrion' && i.name === 'esperar')) esperan.add('principal');
  for (const c of ara.juego.clases) for (const e of [...c.eventos, ...(c.funciones || [])]) if (e.espera) esperan.add(e.exportacion);
  const conPromesa = new Map();
  /**
   * Llama a una exportación. Si puede esperar (y hay JSPI), devuelve una promesa que se cumple al terminar; si no,
   * lo que devuelva la función. Los errores de pila o internos se convierten en errores de Ara.
   */
  ara.llamar = (nombre, ...args) => {
    const f = exports[nombre];
    if (!f) throw new Error(`el programa no exporta \`${nombre}\``);
    try {
      if (HAY_JSPI && esperan.has(nombre)) {
        if (!conPromesa.has(nombre)) conPromesa.set(nombre, WebAssembly.promising(f));
        return conPromesa.get(nombre)(...args).catch(convertir);
      }
      return f(...args);
    } catch (e) {
      return convertir(e);
    }
  };
  const convertir = (e) => {
    // Ara limita la recursión a 10 000 llamadas, pero la pila del navegador puede acabarse antes.
    if (e instanceof RangeError) ara.fallar('demasiada recursión: se acabó la pila de WebAssembly');
    else if (e instanceof WebAssembly.RuntimeError) ara.fallar(`error interno del runtime de Ara: ${e.message}`);
    else throw e;
    return undefined;
  };
  ara.principal = async () => { await ara.llamar('principal', ctx); };
  return ara;
}

/**
 * Monta el runtime y el programa, y ejecuta el programa.
 * @returns {Promise<{error: null | {mensaje: string, inicio: number | null, fin: number | null}, vivos: number}>}
 *   `vivos` son los objetos que quedaron en memoria (0 si no hay fugas).
 */
export async function ejecutar(programa, opciones = {}) {
  const ara = await cargar(programa, opciones);
  await ara.principal();
  return { error: ara.error(), vivos: ara.vivos() };
}

// `node ara.mjs programa.wasm [ara_runtime.wasm]`
const esNode = typeof process !== 'undefined' && process.versions?.node;
if (esNode && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href) {
  const { readFile } = await import('node:fs/promises');
  const fs = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const [archivo, rutaRuntime] = process.argv.slice(2);
  if (!archivo) {
    console.error('uso: node ara.mjs programa.wasm [ara_runtime.wasm]');
    process.exit(2);
  }
  // Un programa fusionado no necesita el runtime aparte; si está, se usa.
  const runtime = await readFile(rutaRuntime ?? join(dirname(archivo), 'ara_runtime.wasm')).catch(() => undefined);
  // Para el runtime de consola: los archivos de Node y la entrada estándar, leída a trozos y servida por líneas.
  let entrada = Buffer.alloc(0), acabada = false;
  const leerLinea = () => {
    for (;;) {
      const salto = entrada.indexOf(10);
      if (salto >= 0 || acabada) {
        if (entrada.length === 0) return null;
        const linea = entrada.subarray(0, salto >= 0 ? salto + 1 : entrada.length);
        entrada = entrada.subarray(linea.length);
        return linea;
      }
      const trozo = Buffer.alloc(65536);
      let n = 0;
      try {
        n = fs.readSync(0, trozo, 0, trozo.length, null);
      } catch (e) {
        if (e.code === 'EAGAIN') continue;
        if (e.code !== 'EOF') throw e;
      }
      if (n === 0) acabada = true;
      else entrada = Buffer.concat([entrada, trozo.subarray(0, n)]);
    }
  };
  const sistema = {
    leerArchivo: (ruta) => fs.readFileSync(ruta),
    escribirArchivo: (ruta, bytes, alFinal) => (alFinal ? fs.appendFileSync : fs.writeFileSync)(ruta, bytes),
    existeArchivo: (ruta) => fs.statSync(ruta, { throwIfNoEntry: false })?.isFile() ?? false,
    leerLinea,
  };
  const r = await ejecutar(await readFile(archivo), { runtime, sistema, escribir: (t) => process.stdout.write(t) });
  if (r.error) {
    console.error(`error en ejecución: ${r.error.mensaje}` + (r.error.inicio != null ? ` (bytes ${r.error.inicio}..${r.error.fin} del código)` : ''));
    process.exitCode = 1;
  } else if (r.vivos > 0) {
    // Lo que queda al terminar bien son datos que se apuntan en círculo (el conteo de referencias no los libera).
    console.error(`aviso: al terminar quedaron ${r.vivos} objeto(s) sin liberar: datos que se apuntan en círculo (a través de listas)`);
  }
}
