// El ejemplo nativo 2D (examples/native-2d): genera su escena desde la plantilla «plataformas» y lo compila a un .exe
// de Windows x64 con el compilador de Ara. También da a pruebas/nativo-2d.test.js la misma escena y el mismo guion
// por la ruta wasm de Falcon, para comparar.
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
import { nivelPlataformas, bpJugador } from '../src/motor/plantillas.js';

const falcon = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DT = 1 / 60;

/** El repositorio de Ara y su ara.exe, o null si no están (CI sin Windows, o sin Ara al lado). */
export function rutasAra() {
  const dir = process.env.ARA_DIR || resolve(falcon, '../ara-etapa5/ara');
  const exe = process.env.ARA || join(dir, 'target/x86_64-pc-windows-msvc/release/ara.exe');
  // Windows x64, o Windows ARM64, que corre el x64 emulado.
  return process.platform === 'win32' && existsSync(exe) && existsSync(join(dir, 'compilador/ara.ara')) ? { dir, exe } : null;
}

/** La entrada del guion en el paso `i` (la misma regla que `guion_dx`/`guion_salta` de juego.ara). */
export const guion = (i) => ({ dx: Math.floor(i / 120) % 4 === 3 ? -1 : 1, salta: i % 35 === 10 });

/** El nivel de la plantilla «plataformas» como un Mundo de Falcon sin scripts, con el núcleo dado (o null: JS). */
export function mundoPlataformas(nucleo) {
  const m = new Mundo({ proyecto: { datos: { nombre: 'Plataformas' } }, lienzo: {} });
  m.raiz = new NodoVivo(m, nivelPlataformas(), null);
  m.indiceSucio = true;
  m.nucleo = nucleo;
  return m;
}

const variable = (nombre) => bpJugador().variables.find((v) => v.nombre === nombre).valor;
export const VELOCIDAD = variable('velocidad'), SALTO = variable('salto');

/**
 * Un paso del mundo de Falcon con el guion: lo que haría el Blueprint del jugador (`mover(eje · velocidad)`, y
 * `saltar(salto)` si se pulsa y toca el suelo) y después física y contactos, como en `Mundo.paso`.
 */
export function pasoFalcon(m, i) {
  const nodos = m.todos(), j = nodos.find((n) => n.nombre === 'Jugador'), g = guion(i);
  j.mueveX = g.dx * VELOCIDAD;
  if (g.salta && j.enSuelo) { j.vy = -SALTO; j.enSuelo = false; }
  m.fisica2d(DT, nodos);
  m.contactos2d(nodos);
}

/** El estado de los personajes y los pares que se tocan, con el formato que escribe el .exe con FALCON_PASOS. */
export function estadoFalcon(m) {
  const nodos = m.todos();
  return {
    personajes: nodos.filter((n) => n.tipo === 'Personaje2D').map((n) => ({
      nodo: n._ranura, x: n.props.posicion[0], y: n.props.posicion[1], vy: n.vy, empX: n.empX, empY: n.empY,
      suelo: n.enSuelo, nodoSuelo: n._nodoSuelo ? n._nodoSuelo._ranura : -1,
    })),
    pares: [...m.pares.values()].map(([a, b]) => [a._ranura, b._ranura]),
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
    if (p[0] === 'paso') pasos.set(+p[1], e = { personajes: [], pares: [] });
    else if (p[0] === 'personaje') e.personajes.push({ nodo: +p[1], x: +p[2], y: +p[3], vy: +p[4], empX: +p[5], empY: +p[6], suelo: p[7] === 'verdadero', nodoSuelo: +p[8] });
    else if (p[0] === 'par') e.pares.push([+p[1], +p[2]]);
    else if (p[0] === 'ms_por_paso') ms = +p[1];
  }
  return { pasos, ms };
}

const rgb = (hex) => (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : -1);
const ara = (x) => { const t = String(x); return /^-?\d+$/.test(t) ? t + '.0' : t; }; // decimal de Ara: un double, con su texto más corto

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

/** El módulo de Ara con la escena: lo que `sincronizarAra` le manda al núcleo, más lo que hace falta para dibujar. */
export function escenaAra() {
  const m = mundoPlataformas(null), nodos = m.todos();
  const llamadas = [], celdas = [];
  // Lo que Falcon manda al núcleo, grabado tal cual: así el .exe parte del mismo estado que el motor.
  const grabadora = {
    empezar: (n) => llamadas.push(`    f.empezar(${n})`),
    nodo: (...a) => llamadas.push(`    f.nodo(${a.map((v, k) => (typeof v === 'boolean' ? (v ? 'verdadero' : 'falso') : [0, 1, 9, 14, 15].includes(k) ? v : ara(v))).join(', ')})`),
    vaciarCeldas: () => llamadas.push('    f.vaciar_celdas()'),
    celda: (mo, c, f) => { llamadas.push(`    f.celda(${mo}, ${c}, ${f})`); celdas.push([mo, c, f]); },
  };
  m.sincronizarAra(grabadora, nodos);
  const pjs = nodos.filter((n) => n.tipo === 'Personaje2D');
  const g = m.interp.globales.vars.get('gravedad'), base = m.proyecto.datos.gravedad || 1200;
  const escalaG = base ? g / base : 1; // como `Mundo.fisica2d`
  const lista = (tipo, v) => `lista[${tipo}] = [${v.join(', ')}]`;
  return `# Generado por herramientas/escena-nativa-2d.mjs desde el nivel de la plantilla «plataformas»: no editar.
# Lo que \`Mundo.sincronizarAra\` (src/motor/mundo.js) manda al núcleo de física, y lo que hace falta para dibujar.
importar fisica2d

const JUGADOR = ${nodos.findIndex((n) => n.nombre === 'Jugador')}
const VELOCIDAD = ${ara(VELOCIDAD)}  # las variables del Blueprint del jugador
const SALTO = ${ara(SALTO)}
const AMORT = ${ara(Math.pow(0.02, DT))}  # 0.02^dt, como \`Mundo.fisica2dAra\`
const ANCHO_NIVEL = ${ara(m.raiz.hijos.find((n) => n.nombre === 'Jugador').hijos.find((h) => h.tipo === 'Camara2D').props.limites[2])}
const FONDO = ${rgb('#10293A')}
const BORDE_MOSAICO = ${rgb(nodos.find((n) => n.tipo === 'Mosaicos').props.color_borde)}

func cargar(f: Fisica):
${llamadas.join('\n')}

func personajes() -> lista[entero]:
    r: ${lista('entero', pjs.map((n) => n._ranura))}
    devolver r

func gravedades() -> lista[decimal]:
    r: ${lista('decimal', pjs.map((n) => ara((n.props.gravedad ?? 1200) * escalaG)))}
    devolver r

func usan_gravedad() -> lista[booleano]:
    r: ${lista('booleano', pjs.map((n) => (n.props.usa_gravedad ? 'verdadero' : 'falso')))}
    devolver r

func colores() -> lista[entero]:
    r: ${lista('entero', nodos.map(colorDe))}
    devolver r

func celdas_mosaico() -> lista[entero]:
    r: ${lista('entero', celdas.map((c) => c[0]))}
    devolver r

func celdas_c() -> lista[entero]:
    r: ${lista('entero', celdas.map((c) => c[1]))}
    devolver r

func celdas_f() -> lista[entero]:
    r: ${lista('entero', celdas.map((c) => c[2]))}
    devolver r
`;
}

/** Genera la escena, junta los fuentes en `carpeta` y compila el .exe. Devuelve su ruta. */
export function compilarNativo2d({ dir, exe }, salida = join(falcon, 'examples/native-2d/build/falcon-2d.exe')) {
  const carpeta = dirname(salida);
  mkdirSync(join(carpeta, 'nativo'), { recursive: true });
  // Los módulos que importa juego.ara, junto a él: la física es la misma del motor, copiada, no reescrita.
  copyFileSync(join(falcon, 'examples/native-2d/juego.ara'), join(carpeta, 'juego.ara'));
  copyFileSync(join(falcon, 'src/motor/ara/fisica2d.ara'), join(carpeta, 'fisica2d.ara'));
  copyFileSync(join(dir, 'ejemplos/nativo/bufer.ara'), join(carpeta, 'nativo/bufer.ara'));
  writeFileSync(join(carpeta, 'escena.ara'), escenaAra());
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
  const salida = compilarNativo2d(rutas, process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`${salida}: ${readFileSync(salida).length} bytes`);
}
