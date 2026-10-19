// Analizador léxico de Águila: convierte el texto en fichas (tokens).
// Águila usa la sangría para marcar bloques, como Python: el léxico genera
// fichas SANGRIA / DESANGRIA cuando cambia el nivel.

import { ErrorAguila } from './errores.js';

export const PALABRAS_CLAVE = new Set([
  'clase', 'extiende', 'exportar', 'variable', 'constante', 'cuando', 'si', 'sino',
  'mientras', 'para', 'cada', 'en', 'función', 'funcion', 'devolver', 'romper',
  'continuar', 'y', 'o', 'no', 'verdadero', 'falso', 'nulo', 'yo', 'repetir', 'veces', 'pasar',
]);

// Operadores, de más largo a más corto para casar primero los compuestos.
const OPERADORES = [
  '**=', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**',
  '≤', '≥', '≠', '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.',
];
const EQUIVALENTES = { '≤': '<=', '≥': '>=', '≠': '!=' };

const ES_LETRA = /[\p{L}_]/u;
const ES_LETRA_O_DIGITO = /[\p{L}\p{N}_]/u;

export class Ficha {
  constructor(tipo, valor, linea, col, finCol) {
    this.tipo = tipo;   // NOMBRE NUMERO TEXTO OP CLAVE NUEVA_LINEA SANGRIA DESANGRIA FIN
    this.valor = valor;
    this.linea = linea;
    this.col = col;
    this.finCol = finCol;
  }
}

/**
 * Devuelve { fichas, errores }. Nunca lanza: los errores se recogen para
 * poder mostrar varios a la vez en el editor.
 */
export function analizarLexico(fuente) {
  const fichas = [];
  const errores = [];
  const lineas = fuente.replace(/\r\n?/g, '\n').split('\n');
  const pilaSangria = [0];
  let profundidadParentesis = 0;
  const pilaAperturas = [];

  for (let numLinea = 0; numLinea < lineas.length; numLinea++) {
    const texto = lineas[numLinea];
    const linea = numLinea + 1;
    let i = 0;

    // Sangría: solo cuenta al principio de una línea lógica.
    if (profundidadParentesis === 0) {
      let ancho = 0;
      while (i < texto.length && (texto[i] === ' ' || texto[i] === '\t')) {
        ancho += texto[i] === '\t' ? 4 - (ancho % 4) : 1;
        i++;
      }
      // Línea vacía o solo comentario: no cambia la sangría.
      if (i >= texto.length || texto[i] === '#') continue;

      const actual = pilaSangria[pilaSangria.length - 1];
      if (ancho > actual) {
        pilaSangria.push(ancho);
        fichas.push(new Ficha('SANGRIA', ancho, linea, 0, i));
      } else if (ancho < actual) {
        while (pilaSangria.length > 1 && ancho < pilaSangria[pilaSangria.length - 1]) {
          pilaSangria.pop();
          fichas.push(new Ficha('DESANGRIA', ancho, linea, 0, i));
        }
        if (ancho !== pilaSangria[pilaSangria.length - 1]) {
          errores.push(new ErrorAguila('la sangría no coincide con ningún bloque anterior.', {
            linea, columna: 0, finColumna: i,
            explicacion: 'Cada bloque tiene que empezar en la misma columna. Usa múltiplos de 4 espacios para que las órdenes queden alineadas.',
            arreglo: {
              titulo: 'Alinear la línea',
              cambios: [{ linea, desde: 0, hasta: i, texto: ' '.repeat(pilaSangria[pilaSangria.length - 1]) }],
            },
          }));
        }
      }
    }

    while (i < texto.length) {
      const c = texto[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;

      // Números: 12, 3.5, 1_000
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(texto[i + 1] || ''))) {
        const ini = i;
        while (i < texto.length && /[0-9_]/.test(texto[i])) i++;
        if (texto[i] === '.' && /[0-9]/.test(texto[i + 1] || '')) {
          i++;
          while (i < texto.length && /[0-9_]/.test(texto[i])) i++;
        }
        const crudo = texto.slice(ini, i).replace(/_/g, '');
        fichas.push(new Ficha('NUMERO', Number(crudo), linea, ini, i));
        if (i < texto.length && ES_LETRA.test(texto[i])) {
          let j = i; while (j < texto.length && ES_LETRA_O_DIGITO.test(texto[j])) j++;
          errores.push(new ErrorAguila(`«${texto.slice(ini, j)}» no es un número ni un nombre válido.`, {
            linea, columna: ini, finColumna: j,
            explicacion: 'Los nombres no pueden empezar por un número. Prueba a ponerle letras delante, por ejemplo «nivel1» en vez de «1nivel».',
          }));
          i = j;
        }
        continue;
      }

      // Nombres y palabras clave (admite tildes y ñ).
      if (ES_LETRA.test(c)) {
        const ini = i;
        while (i < texto.length && ES_LETRA_O_DIGITO.test(texto[i])) i++;
        const palabra = texto.slice(ini, i);
        const tipo = PALABRAS_CLAVE.has(palabra) ? 'CLAVE' : 'NOMBRE';
        fichas.push(new Ficha(tipo, palabra === 'funcion' ? 'función' : palabra, linea, ini, i));
        continue;
      }

      // Textos entre comillas: "hola" o 'hola', también «hola».
      if (c === '"' || c === "'" || c === '«' || c === '“') {
        const cierre = c === '«' ? '»' : c === '“' ? '”' : c;
        const ini = i;
        i++;
        let valor = '';
        let cerrado = false;
        while (i < texto.length) {
          const d = texto[i];
          if (d === '\\' && i + 1 < texto.length) {
            const e = texto[i + 1];
            valor += e === 'n' ? '\n' : e === 't' ? '\t' : e;
            i += 2;
            continue;
          }
          if (d === cierre) { cerrado = true; i++; break; }
          valor += d;
          i++;
        }
        if (!cerrado) {
          errores.push(new ErrorAguila(`el texto no está cerrado: falta la comilla ${cierre === '"' ? '«"»' : `«${cierre}»`} del final.`, {
            linea, columna: ini, finColumna: texto.length,
            explicacion: 'Los textos van entre comillas, una al principio y otra al final, como en "¡Hola!".',
            arreglo: { titulo: 'Cerrar el texto', cambios: [{ linea, desde: texto.length, hasta: texto.length, texto: cierre }] },
          }));
        }
        fichas.push(new Ficha('TEXTO', valor, linea, ini, i));
        continue;
      }

      // Operadores
      let op = null;
      for (const o of OPERADORES) {
        if (texto.startsWith(o, i)) { op = o; break; }
      }
      if (op) {
        const valor = EQUIVALENTES[op] || op;
        if (op === '(' || op === '[' || op === '{') { profundidadParentesis++; pilaAperturas.push({ op, linea, col: i }); }
        if (op === ')' || op === ']' || op === '}') {
          if (profundidadParentesis > 0) { profundidadParentesis--; pilaAperturas.pop(); }
        }
        fichas.push(new Ficha('OP', valor, linea, i, i + op.length));
        i += op.length;
        continue;
      }

      errores.push(new ErrorAguila(`no entiendo el símbolo «${c}».`, {
        linea, columna: i, finColumna: i + 1,
        explicacion: 'Este carácter no forma parte de Águila. Puede que se haya colado al copiar y pegar.',
        arreglo: { titulo: 'Quitar el símbolo', cambios: [{ linea, desde: i, hasta: i + 1, texto: '' }] },
      }));
      i++;
    }

    // Fin de línea lógica (salvo dentro de paréntesis).
    if (profundidadParentesis === 0) {
      const ultima = fichas[fichas.length - 1];
      if (ultima && ultima.tipo !== 'NUEVA_LINEA' && ultima.tipo !== 'SANGRIA' && ultima.tipo !== 'DESANGRIA') {
        fichas.push(new Ficha('NUEVA_LINEA', '\n', linea, texto.length, texto.length + 1));
      }
    }
  }

  const ultimaLinea = lineas.length;
  if (profundidadParentesis > 0) {
    const ab = pilaAperturas[pilaAperturas.length - 1];
    const cierre = { '(': ')', '[': ']', '{': '}' }[ab.op];
    const textoLinea = lineas[ab.linea - 1];
    errores.push(new ErrorAguila(`falta cerrar «${ab.op}» con «${cierre}».`, {
      linea: ab.linea, columna: ab.col, finColumna: ab.col + 1,
      explicacion: 'Cada paréntesis o corchete que se abre tiene que cerrarse, para que Águila sepa dónde termina.',
      arreglo: { titulo: `Añadir «${cierre}»`, cambios: [{ linea: ab.linea, desde: finSinComentario(textoLinea), hasta: finSinComentario(textoLinea), texto: cierre }] },
    }));
    fichas.push(new Ficha('NUEVA_LINEA', '\n', ultimaLinea, 0, 0));
  }
  while (pilaSangria.length > 1) {
    pilaSangria.pop();
    fichas.push(new Ficha('DESANGRIA', 0, ultimaLinea + 1, 0, 0));
  }
  fichas.push(new Ficha('FIN', null, ultimaLinea + 1, 0, 0));
  return { fichas, errores };
}

// Columna donde acaba el código de una línea (antes de un comentario y espacios).
export function finSinComentario(texto) {
  let enTexto = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enTexto) {
      if (c === '\\') { i++; continue; }
      if (c === enTexto) enTexto = null;
      continue;
    }
    if (c === '"' || c === "'") { enTexto = c; continue; }
    if (c === '«') { enTexto = '»'; continue; }
    if (c === '#') return texto.slice(0, i).trimEnd().length;
  }
  return texto.trimEnd().length;
}
