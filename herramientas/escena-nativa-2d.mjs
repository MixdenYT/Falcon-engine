// El ejemplo nativo 2D (examples/native-2d): genera su escena desde la plantilla «plataformas» y lo compila a un .exe
// de Windows x64 con el compilador de Ara. También da a pruebas/nativo-2d.test.js el mismo nivel, con sus scripts y
// Blueprints de verdad, en un `Mundo` de Falcon (ruta wasm), y el mismo guion, para comparar paso a paso.
//
// Uso: node herramientas/escena-nativa-2d.mjs [salida.exe]   (por defecto examples/native-2d/build/falcon-2d.exe)
// Variables: ARA_DIR (el repositorio de Ara; por defecto ../ara-etapa5/ara junto a este) y ARA (su ara.exe).
//
// shortcut: la escena llega al .exe como un módulo de Ara generado (escena.ara), no como el .fscn: Ara no tiene JSON
// en su biblioteca y un lector propio no compensa para una escena. Leer el .fscn cuando Ara tenga JSON o haga falta
// cargar escenas sin recompilar.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../pruebas/dom.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { nivelPlataformas, bpJugador, SCRIPTS } from '../src/motor/plantillas.js';
import { claseBlueprint, generadoDe } from '../src/motor/blueprints.js';
import { cargarCompiladorBlueprints, compilarBlueprint } from '../src/motor/blueprints-ara.js';
import { claseDe } from '../src/ara/puente.js';
import { tipo as tipoNodo } from '../src/motor/tipos.js';

const falcon = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DT = 1 / 60;

/** El repositorio de Ara y su ara.exe, o null si no están (CI sin Windows, o sin Ara al lado). */
export function rutasAra() {
  const dir = process.env.ARA_DIR || resolve(falcon, '../ara-etapa5/ara');
  const exe = process.env.ARA || join(dir, 'target/x86_64-pc-windows-msvc/release/ara.exe');
  // Windows x64, o Windows ARM64, que corre el x64 emulado.
  return process.platform === 'win32' && existsSync(exe) && existsSync(join(dir, 'compilador/ara.ara')) ? { dir, exe } : null;
}

// ---------- El guion ----------

/** Un guion escrito por tramos: «b164 f» es 164 pasos de «b» y uno de «f». */
export const expandirGuion = (tramos) => tramos.split(' ').map((t) => t[0].repeat(+(t.slice(1) || 1))).join('');

/**
 * El guion de la prueba (1000 pasos), buscado con el propio Falcon: a la derecha recogiendo monedas, salta el primer
 * hueco, muere en los pinchos (que empujan, esperan 0,4 s y reinician el nivel), y en la segunda vida salta pinchos,
 * rocas y huecos hasta la meta (gana con 4 puntos en el paso 928).
 */
export const GUION = expandirGuion('b164 f b267 f b67 f b61 f b66 f b61 f b237 b71');

/** Las acciones del guion, en el orden en que se avisan `se_pulsa` y `se_suelta` (el .exe usa el mismo). */
export const ACCIONES = ['izquierda', 'derecha', 'saltar'];

/**
 * Un guion es un texto con una letra por paso: 'a' + 1 (derecha) + 2 (izquierda) + 4 (saltar). Esto lo pasa a las
 * acciones mantenidas en cada paso.
 */
export function accionesDelGuion(guion, i) {
  const b = guion.charCodeAt(Math.min(i, guion.length - 1)) - 97;
  return ACCIONES.filter((_, k) => b & [2, 1, 4][k]);
}

/** La entrada de Falcon (`Entrada`) movida por un guion: lo mismo que lee el .exe con FALCON_GUION. */
export function entradaDeGuion(guion) {
  let antes = [], ahora = [];
  return {
    paso(i) { antes = ahora; ahora = accionesDelGuion(guion, i); },
    actualizar() {},
    pulsadasAhora: () => ACCIONES.filter((a) => ahora.includes(a) && !antes.includes(a)),
    soltadasAhora: () => ACCIONES.filter((a) => antes.includes(a) && !ahora.includes(a)),
    pulsa: (a) => ahora.includes(a) && !antes.includes(a),
    mantiene: (a) => ahora.includes(a),
    suelta: (a) => antes.includes(a) && !ahora.includes(a),
    eje: (a, b) => (ahora.includes(b) ? 1 : 0) - (ahora.includes(a) ? 1 : 0),
    existe: () => true,
    raton: { clic: false, pulsado: false },
    acciones: {},
  };
}

// ---------- El nivel en Falcon, con sus scripts ----------

/** Los textos de los scripts y Blueprints que usa el nivel (`rel → texto`), como los tiene un proyecto de la plantilla. `nivel` da su raíz. */
async function textosDelNivel(nivel) {
  await cargarCompiladorBlueprints();
  const textos = new Map();
  const visitar = (n) => {
    if (n.script) textos.set(n.script, SCRIPTS[n.script.replace(/^scripts\/|\.ara$/g, '')]);
    if (n.blueprint) textos.set(n.blueprint, JSON.stringify(bpJugador()));
    (n.hijos || []).forEach(visitar);
  };
  visitar(nivel());
  return textos;
}

/**
 * El nivel de la plantilla «plataformas» en un `Mundo` de Falcon con sus scripts y Blueprints compilados (Ara a
 * WebAssembly) y el núcleo de Ara para la física, movido por `guion`. `paso(i)` da un paso y espera a que termine
 * todo lo que deja pendiente (las esperas que acaban y la recarga del nivel).
 */
export async function mundoFalcon(nucleo, guion, nivel = nivelPlataformas) {
  const m = new Mundo({ proyecto: { datos: { nombre: 'Plataformas' }, leerEscena: async () => ({ tipo: '2D', raiz: nivel() }) }, lienzo: { style: {}, getContext: () => ({}) } });
  m.textos = await textosDelNivel(nivel);
  m.audio = { sonar() {}, musica() {}, pararNodo() {}, reproducirNodo() {} };
  m.nucleo = nucleo;
  Object.assign(m.entrada, entradaDeGuion(guion)); // la API de Águila guarda esta misma entrada
  m.dibujar = () => {};
  m.colocarCamaraInicial = () => {};
  m.actualizarCamara = () => {};
  m.avanzarAnimacion = () => {}; // sin imágenes en Node; solo avisa `termina` tras `animar()`, que el nivel no usa
  m.escenaRel = 'escenas/nivel1.fscn';
  await m.compilarAra();
  if (m.errores.length) throw new Error(m.errores.map((e) => e.mensaje).join('\n'));
  m.raiz = new NodoVivo(m, nivel(), null);
  m.indiceSucio = true;
  m.iniciarScripts(m.raiz);
  return {
    m,
    async paso(i) {
      m.entrada.paso(i);
      m.paso(DT);
      for (let k = 0; k < 4; k++) await new Promise((r) => setImmediate(r));
    },
  };
}

const ESTADOS = { jugando: 0, ganado: 1, perdido: 2 };

/**
 * El estado tras un paso, con el formato que escribe el .exe con FALCON_TRAZA: los personajes y los pares que se
 * tocan (por su posición en `todos()`), los puntos, el estado de la partida y cuántos nodos quedan.
 */
export function estadoFalcon(m) {
  const nodos = m.todos(), i = (n) => (n ? nodos.indexOf(n) : -1);
  return {
    personajes: nodos.filter((n) => n.tipo === 'Personaje2D').map((n) => ({
      nodo: i(n), x: n.props.posicion[0], y: n.props.posicion[1], vy: n.vy, empX: n.empX, empY: n.empY, suelo: n.enSuelo, nodoSuelo: i(n._nodoSuelo),
    })),
    pares: [...m.pares.values()].map(([a, b]) => [i(a), i(b)]),
    juego: { puntos: m.interp.globales.vars.get('puntos') || 0, estado: ESTADOS[m.estado], nodos: nodos.length },
  };
}

/**
 * Lee la salida del .exe con FALCON_PASOS: `{ pasos: Map(i → estado como el de estadoFalcon), ms }`. Los decimales
 * vienen con 17 cifras, así que `+texto` da el mismo double.
 */
export function leerEstadoNativo(texto) {
  const pasos = new Map();
  let e = null, ms = NaN;
  for (const linea of texto.split(/\r?\n/)) {
    const p = linea.trim().split(' ');
    if (p[0] === 'paso') pasos.set(+p[1], e = { personajes: [], pares: [], juego: null });
    else if (p[0] === 'personaje') e.personajes.push({ nodo: +p[1], x: +p[2], y: +p[3], vy: +p[4], empX: +p[5], empY: +p[6], suelo: p[7] === 'verdadero', nodoSuelo: +p[8] });
    else if (p[0] === 'par') e.pares.push([+p[1], +p[2]]);
    else if (p[0] === 'juego') e.juego = { puntos: +p[1], estado: +p[2], nodos: +p[3] };
    else if (p[0] === 'ms_por_paso') ms = +p[1];
  }
  return { pasos, ms };
}

// ---------- La escena para el .exe ----------

const rgb = (hex) => (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : -1);
const ara = (x) => { const t = String(x); return /^-?\d+$/.test(t) ? t + '.0' : t; }; // decimal de Ara: un double, con su texto más corto
const txt = (s) => JSON.stringify(String(s)).replace(/\{/g, '{{').replace(/\}/g, '}}');
const bool = (b) => (b ? 'verdadero' : 'falso');

/** El color con el que se dibuja cada nodo (-1: no se dibuja). */
function colorDe(n) {
  const hijo = (t) => n.hijos.find((h) => h.tipo === t);
  switch (n.tipo) {
    case 'Personaje2D': return n.nombre === 'Jugador' ? 0x3DDC84 : rgb(hijo('Sprite')?.props.color);
    case 'Area2D': return rgb(hijo('Sprite')?.props.color);
    case 'Plataforma': return rgb(n.props.color);
    case 'Mosaicos': return rgb(n.props.color);
    default: return -1;
  }
}

/**
 * Los módulos de Ara del juego: la escena (`escena.ara`, los nodos del nivel y lo que une sus scripts con el
 * anfitrión) y un módulo por cada clase de script o Blueprint que usa (`clase_<nombre>.ara`). Devuelve `nombre → texto`.
 */
export async function modulosDelJuego(nivel = nivelPlataformas) {
  const textos = await textosDelNivel(nivel);
  const m = new Mundo({ proyecto: { datos: { nombre: 'Plataformas' } }, lienzo: {} });
  m.raiz = new NodoVivo(m, nivel(), null);
  m.indiceSucio = true;
  const nodos = m.todos();
  // Las clases que usa la escena, en orden de aparición, con su código y el tipo que extienden.
  const clases = new Map();
  const claseDeRel = (rel) => {
    if (/\.bp$/i.test(rel)) {
      const r = compilarBlueprint(JSON.parse(textos.get(rel)), rel);
      if (r.errores.length) throw new Error(`${rel}: ${r.errores[0].mensaje}`);
      return [claseBlueprint(rel), r.codigo, generadoDe(rel)];
    }
    return [claseDe(textos.get(rel)), textos.get(rel), rel];
  };
  for (const n of nodos) {
    for (const rel of [n.datos.blueprint, n.datos.script].filter(Boolean)) {
      if (n.datos.exportados && Object.keys(n.datos.exportados).length) throw new Error(`${n.nombre}: los valores del Inspector (exportados) aún no llegan al .exe`);
      const [nombre, codigo, archivo] = claseDeRel(rel);
      if (!clases.has(nombre)) {
        const base = /^clase\s+\S+\s+extiende\s+([\p{L}_][\p{L}\p{N}_]*)/mu.exec(codigo)?.[1] || 'Nodo';
        clases.set(nombre, { indice: clases.size, codigo: `# ${archivo}\n${codigo}`, base, modulo: `clase_${nombre.toLowerCase()}` });
      }
      (n._clases ||= []).push(clases.get(nombre).indice);
      n.scripts.push({}); // para `papel`: un Sprite o una Plataforma con script participa en los contactos
    }
  }
  // Lo que Falcon manda al núcleo de cada nodo (`sincronizarAra`), grabado: así el .exe parte del mismo estado.
  const fisica = [], celdas = nodos.map(() => []);
  m.sincronizarAra({
    empezar() {},
    nodo: (i, ...a) => { fisica[i] = a; },
    vaciarCeldas() {},
    celda: (mo, c, f) => celdas[mo].push([c, f]),
  }, nodos);
  const g = m.interp.globales.vars.get('gravedad'), base = m.proyecto.datos.gravedad || 1200;
  const escalaG = base ? g / base : 1; // como `Mundo.fisica2d`
  const lineas = [];
  nodos.forEach((n, i) => {
    const [p, sinMatriz, x, y, grados, esc, sx, sy, ctipo, ox, oy, w, h, solido, papel] = fisica[i];
    lineas.push(`    h = m.nuevo(${txt(n.nombre)}, ${txt(n.tipo)}, ${txt(tipoNodo(n.tipo).nombreVisible)}, ${p < 0 ? 0 : `b + ${p + 1}`})`);
    lineas.push(`    m.fisica(h, ${bool(sinMatriz)}, ${ara(x)}, ${ara(y)}, ${ara(grados)}, ${bool(esc)}, ${ara(sx)}, ${ara(sy)}, ${ctipo}, ${ara(ox)}, ${ara(oy)}, ${ara(w)}, ${ara(h)}, ${solido}, ${papel})`);
    if (n.tipo === 'Personaje2D') lineas.push(`    m.personaje(h, ${bool(n.props.usa_gravedad)}, ${ara((n.props.gravedad ?? 1200) * escalaG)}, ${ara(n.props.salto ?? 0)})`);
    for (const grupo of n.grupos) lineas.push(`    agregar(m.grupos[h], ${txt(grupo)})`);
    for (const [c, f] of celdas[i]) lineas.push(`    agregar(m.celdas_c[h], ${c})`, `    agregar(m.celdas_f[h], ${f})`);
    for (const c of n._clases || []) lineas.push(`    agregar(m.script_clase[h], ${c})`);
    if (colorDe(n) >= 0) lineas.push(`    m.color[h] = ${colorDe(n)}`);
    if (n.props.voltear_h) lineas.push('    m.voltear_h[h] = verdadero');
    if (typeof n.props.texto === 'string' && n.props.texto) lineas.push(`    m.texto[h] = ${txt(n.props.texto)}`);
  });
  const lista = [...clases.entries()];
  const despacho = (nombre, params, evento, datos) => `func avisar_${nombre}(cl: entero, objeto: entero${params}):
${lista.map(([c, k], i) => `    ${i ? 'sino si' : 'si'} cl == ${k.indice}:\n        avisar(objetos_${k.indice}[objeto], ${txt(evento)}${datos})`).join('\n')}
`;
  const escena = `# Generado por herramientas/escena-nativa-2d.mjs desde el nivel de la plantilla «plataformas»: no editar.
# Los nodos del nivel (lo que \`Mundo.sincronizarAra\` manda al núcleo, grabado tal cual, más lo que usan los scripts y
# el dibujo) y lo que une sus scripts y Blueprints con el anfitrión (src/motor/nativo/anfitrion2d.ara): crearlos con
# \`Clase(yo)\` y avisarlos con \`avisar\`.
importar motor
importar anfitrion2d
${lista.map(([, k]) => `importar ${k.modulo}`).join('\n')}

const DT = ${ara(DT)}  # el paso fijo de la física
const AMORT = ${ara(Math.pow(0.02, DT))}  # 0.02^dt, como \`Mundo.fisica2dAra\`
const ANCHO_NIVEL = ${ara(m.raiz.hijos.find((n) => n.nombre === 'Jugador').hijos.find((h) => h.tipo === 'Camara2D').props.limites[2])}
const FONDO = ${rgb('#10293A')}
const BORDE_MOSAICO = ${rgb(nodos.find((n) => n.tipo === 'Mosaicos').props.color_borde)}

# Los nodos de la escena, con manejadores nuevos (cada uno antes que sus hijos).
func nodos(m: Mundo2D):
    b = largo(m.nombre) - 1
    h = 0
${lineas.join('\n')}

# Los objetos de cada clase.
${lista.map(([c, k]) => `global objetos_${k.indice}: lista[${c}] = []`).join('\n')}

func nombre_clase(cl: entero) -> texto:
    nombres = [${lista.map(([c]) => txt(c)).join(', ')}]
    devolver nombres[cl]

# Crea el objeto del script de la clase \`clase\` para el nodo \`yo\`; devuelve su número en la lista de su clase.
func crear_script(cl: entero, yo: entero) -> entero:
${lista.map(([c, k], i) => `    ${i ? 'sino si' : 'si'} cl == ${k.indice}:\n        agregar(objetos_${k.indice}, ${c}(${k.base}(yo)))\n        devolver largo(objetos_${k.indice}) - 1`).join('\n')}
    devolver -1

${despacho('empieza', '', 'empieza', '')}
${despacho('se_actualiza', ', delta: decimal', 'se_actualiza', ', delta')}
${despacho('toca', ', otro: entero', 'toca', ', Nodo(otro)')}
${despacho('deja_de_tocar', ', otro: entero', 'deja_de_tocar', ', Nodo(otro)')}
${despacho('se_pulsa', ', accion: texto', 'se_pulsa', ', accion')}
${despacho('se_suelta', ', accion: texto', 'se_suelta', ', accion')}
${despacho('se_elimina', '', 'se_elimina', '')}`;
  return new Map([['escena.ara', escena], ...lista.map(([, k]) => [`${k.modulo}.ara`, k.codigo])]);
}

/** Genera la escena, junta los fuentes en la carpeta de `salida` y compila el .exe. Devuelve su ruta. */
export async function compilarNativo2d({ dir, exe }, salida = join(falcon, 'examples/native-2d/build/falcon-2d.exe'), nivel = nivelPlataformas) {
  const carpeta = dirname(salida);
  mkdirSync(join(carpeta, 'nativo'), { recursive: true });
  // Los módulos que importa juego.ara, junto a él: la física, el anfitrión y la API son los del motor, copiados.
  copyFileSync(join(falcon, 'examples/native-2d/juego.ara'), join(carpeta, 'juego.ara'));
  copyFileSync(join(falcon, 'src/motor/ara/fisica2d.ara'), join(carpeta, 'fisica2d.ara'));
  copyFileSync(join(falcon, 'src/motor/nativo/anfitrion2d.ara'), join(carpeta, 'anfitrion2d.ara'));
  copyFileSync(join(falcon, 'src/ara/motor.ara'), join(carpeta, 'motor.ara'));
  copyFileSync(join(dir, 'ejemplos/nativo/bufer.ara'), join(carpeta, 'nativo/bufer.ara'));
  for (const [nombre, texto] of await modulosDelJuego(nivel)) writeFileSync(join(carpeta, nombre), texto);
  const R = join(dir, 'crates/ara_wasm/runtime/ara_runtime.wasm'), wasm = join(carpeta, 'juego.wasm');
  const r = spawnSync(exe, ['compilador/ara.ara'], { cwd: dir, input: `runtime ${R}\nwasm ${join(carpeta, 'juego.ara')} ${wasm}\nnativo ${wasm} ${R} ${salida}\n`, encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(salida) || /error/i.test(r.stdout + r.stderr)) {
    // Los mensajes de error de `wasm` salen como listas de bytes UTF-8: se pasan a texto.
    const legible = (r.stdout + r.stderr).replace(/\[(\d+(?:, \d+)*)\]/g, (_, b) => '«' + Buffer.from(b.split(', ').map(Number)).toString('utf8') + '»');
    throw new Error(`el compilador de Ara falló (${r.status}):\n${legible}`);
  }
  return salida;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rutas = rutasAra();
  if (!rutas) { console.error('Falta el compilador de Ara para Windows x64 (ARA_DIR / ARA).'); process.exit(1); }
  const salida = await compilarNativo2d(rutas, process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`${salida}: ${readFileSync(salida).length} bytes`);
}
