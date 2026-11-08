// Ayudas del editor para los scripts de Ara (.ara): errores en vivo con el compilador de verdad
// (src/ara/puente.js), símbolos para la ruta, «Variables» y el autocompletado, y el diccionario.
// Devuelve lo mismo que `analizarCodigo` de Águila, así la disposición de scripts trata igual los dos lenguajes.

import { comprobarAra, errorDeCompilacion } from '../ara/puente.js';
import { ErrorAguila } from '../aguila/index.js';
import { TIPOS } from '../motor/tipos.js';

export const esAra = (rel) => /\.ara$/i.test(rel || '');

const ID = '[\\p{L}_][\\p{L}\\p{N}_]*';
const RE_CLASE = new RegExp(`^clase\\s+(${ID})(?:\\s+extiende\\s+(${ID}))?\\s*:`, 'u');
const RE_CAMPO = new RegExp(`^    (exportar\\s+)?(${ID})\\s*(?::\\s*([^=]+?))?\\s*=(?!=)\\s*(.*)$`, 'u');
const RE_FUNC = new RegExp(`^(\\s*)func\\s+(${ID})\\s*\\(([^)]*)\\)`, 'u');
const RE_CUANDO = new RegExp(`^(\\s*)cuando\\s+(${ID})\\s*\\(([^)]*)\\)`, 'u');

function tipoDeValor(v) {
  v = v.trim();
  if (/^-?\d+\.\d*$/.test(v)) return 'decimal';
  if (/^-?\d+$/.test(v)) return 'entero';
  if (/^"/.test(v)) return 'texto';
  if (/^(verdadero|falso)\b/.test(v)) return 'sí/no';
  if (/^\[/.test(v)) return 'lista';
  return 'valor';
}

/** El valor de un literal sencillo (para el Inspector), o undefined. */
function valorLiteral(v) {
  v = v.replace(/\s+#.*$/, '').trim();
  if (/^-?\d+(\.\d*)?$/.test(v)) return Number(v);
  if (v === 'verdadero' || v === 'falso') return v === 'verdadero';
  if (/^"(?:\\.|[^"\\])*"$/.test(v)) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
  return undefined;
}

const nombresParams = (p) => p.split(',').map((x) => x.split(':')[0].trim()).filter(Boolean);

/** Clase, campos, funciones, eventos y bloques (para la ruta) de un script de Ara, sin compilarlo. */
export function simbolosAra(texto) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const s = { clase: null, base: null, variables: [], funciones: [], eventos: [] };
  const bloques = [];
  const abrir = (titulo, desde, sangria) => {
    for (const b of bloques) if (b.hasta === Infinity && b.sangria >= sangria) b.hasta = desde - 1;
    bloques.push({ titulo, desde, hasta: Infinity, sangria });
  };
  lineas.forEach((l, i) => {
    const n = i + 1;
    let m;
    if ((m = RE_CLASE.exec(l))) {
      if (!s.clase) { s.clase = m[1]; s.base = m[2] || 'Nodo'; }
      abrir(`clase ${m[1]}`, n, 0);
    } else if ((m = RE_FUNC.exec(l))) {
      s.funciones.push({ nombre: m[2], params: nombresParams(m[3]), linea: n });
      abrir(`${m[2]}()`, n, m[1].length);
    } else if ((m = RE_CUANDO.exec(l))) {
      const params = m[3].split(',').map((x) => x.trim()).filter(Boolean);
      const literal = params[0] && /^(".*"|-?\d+(\.\d+)?|verdadero|falso)$/.test(params[0]);
      s.eventos.push({ evento: m[2], filtro: literal ? params[0].replace(/^"|"$/g, '') : null, params: literal ? params.slice(1) : params, linea: n });
      abrir(`cuando ${m[2]}`, n, m[1].length);
    } else if (s.clase && (m = RE_CAMPO.exec(l))) {
      if (!s.variables.some((v) => v.nombre === m[2])) {
        const tipo = m[3] ? m[3].trim().replace(/^booleano$/, 'sí/no') : tipoDeValor(m[4]);
        s.variables.push({ nombre: m[2], tipo, valor: valorLiteral(m[4]), exportar: !!m[1], linea: n });
      }
    } else if (l.trim() && !/^\s/.test(l) && !l.startsWith('#')) {
      for (const b of bloques) if (b.hasta === Infinity) b.hasta = n - 1;
    }
  });
  for (const b of bloques) if (b.hasta === Infinity) b.hasta = lineas.length;
  return { simbolos: s, bloques };
}

// Textos de los demás .ara del proyecto (todos se compilan juntos). Se vacía cuando cambian los archivos.
const cache = new Map();
export function olvidarTextosAra() { cache.clear(); }

/**
 * Analiza un script de Ara compilándolo con el resto de scripts .ara del proyecto.
 * @param {string} texto  El texto actual (aunque no esté guardado).
 * @param {string} rel  Su ruta.
 * @param {{ archivos: Array<{rel}>, docs: Array<{rel, tipo, datos}>, leer(rel): Promise<string> }} proyecto
 * @returns {Promise<{errores, avisos, simbolos, bloques}>} como `analizarCodigo` de Águila
 */
export async function analizarAra(texto, rel, proyecto) {
  const { simbolos, bloques } = simbolosAra(texto);
  const textos = new Map([[rel, texto]]);
  for (const a of proyecto.archivos) {
    if (!esAra(a.rel) || a.rel === rel || a.rel.startsWith('generado/')) continue;
    const abierto = proyecto.docs.find((d) => d.rel === a.rel && d.tipo === 'script');
    if (abierto) { textos.set(a.rel, abierto.datos); continue; }
    if (!cache.has(a.rel)) {
      try { cache.set(a.rel, await proyecto.leer(a.rel)); } catch { cache.set(a.rel, ''); }
    }
    textos.set(a.rel, cache.get(a.rel));
  }
  const errores = [], avisos = [];
  let lista;
  try { lista = await comprobarAra(textos); }
  catch (e) { lista = [{ archivo: rel, linea: 0, columna: 1, linea_fin: 0, columna_fin: 1, mensaje: `no se pudo cargar el compilador de Ara: ${e.message || e}`, nota: null }]; }
  for (const e of lista) {
    if (e.archivo === rel) errores.push(errorDeCompilacion(e));
    else {
      avisos.push(new ErrorAguila(`hay un error en ${e.archivo || 'otro script'}${e.linea ? ` (línea ${e.linea})` : ''}: ${e.mensaje}`, {
        tipo: 'aviso', archivo: rel, linea: 0,
        explicacion: 'Todos los scripts de Ara del proyecto se compilan juntos: mientras uno tenga errores, ninguno se puede ejecutar.',
      }));
    }
  }
  if (!simbolos.clase && !errores.length) {
    avisos.push(new ErrorAguila('este script no define ninguna clase, así que no se puede poner en un nodo', {
      tipo: 'aviso', archivo: rel, linea: 1, explicacion: 'Un script de Ara para un nodo es «clase Nombre extiende TipoDeNodo:» con sus campos, «cuando» y funciones.',
    }));
  }
  return { errores, avisos, simbolos, bloques };
}

/** La clase de un script nuevo a partir del nombre del archivo: «enemigo_volador» → «EnemigoVolador». */
export function claseParaArchivo(nombre) {
  let c = nombre.replace(/\.ara$/i, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  if (!/^\p{L}/u.test(c)) c = 'Script' + c;
  // No puede llamarse como un tipo de nodo de motor.ara («sprite.ara» → «SpriteScript»).
  return TIPOS[c] || c === 'Nodo' ? c + 'Script' : c;
}

/** Palabras de Ara para el diccionario del editor. */
export const PALABRAS_ARA = [
  { nombre: 'clase', titulo: 'clase Nombre extiende Tipo:', descripcion: 'El script de un nodo. «extiende» dice qué tipo de nodo es (Personaje2D, Sprite…).', ejemplo: 'clase Jugador extiende Personaje2D:\n    cuando empieza():\n        imprimir("¡Hola!")' },
  { nombre: 'exportar', titulo: 'exportar nombre = valor', descripcion: 'Un campo que se puede cambiar desde el Inspector.', ejemplo: 'exportar velocidad = 200.0' },
  { nombre: 'cuando', titulo: 'cuando evento(datos):', descripcion: 'Lo que hace el nodo cuando pasa algo. Con un texto, solo para esa acción.', ejemplo: 'cuando se_pulsa("saltar"):\n    saltar()' },
  { nombre: 'func', titulo: 'func nombre(dato: tipo) -> tipo:', descripcion: 'Una función de la clase. Los datos llevan su tipo: entero, decimal, texto, booleano o un tipo de nodo.', ejemplo: 'func curar(cantidad: entero):\n    vida += cantidad' },
  { nombre: 'devolver', titulo: 'devolver valor', descripcion: 'Termina la función y da un resultado.', ejemplo: 'func esta_vivo() -> booleano:\n    devolver vida > 0' },
  { nombre: 'si', titulo: 'si / sino', descripcion: 'Hace algo solo si se cumple una condición.', ejemplo: 'si vida <= 0:\n    perder_partida()\nsino:\n    imprimir("sigue")' },
  { nombre: 'mientras', titulo: 'mientras condición:', descripcion: 'Repite mientras se cumpla la condición.', ejemplo: 'mientras vida < 100:\n    vida += 1' },
  { nombre: 'para', titulo: 'para x en lista:', descripcion: 'Recorre una lista o un rango de números.', ejemplo: 'para enemigo en grupo("enemigos"):\n    enemigo.eliminar()' },
  { nombre: 'esperar', titulo: 'esperar(segundos)', descripcion: 'Pausa este evento sin parar el juego.', ejemplo: 'esperar(1.5)\nimprimir("ha pasado segundo y medio")' },
  { nombre: 'imprimir', titulo: 'imprimir(valor, …)', descripcion: 'Escribe en la consola de Salida.', ejemplo: 'imprimir("vida:", vida)' },
  { nombre: 'tipos', titulo: 'entero, decimal, texto, booleano', descripcion: 'Ara comprueba los tipos al compilar: 3 es entero y 3.0 es decimal. Convierte con entero(x), decimal(x) y texto(x).', ejemplo: 'monedas = 0\nvelocidad = 220.0\nmensaje = "Monedas: " + texto(monedas)' },
];
