// Errores del lenguaje Águila.
// Todos los mensajes están pensados para alguien que empieza: dicen qué pasa,
// por qué, y cuando se puede, ofrecen un arreglo automático.

export class ErrorAguila extends Error {
  /**
   * @param {string} mensaje   Frase corta: «Línea 22: falta «:» al final de la condición.»
   * @param {object} opciones  { linea, columna, finColumna, explicacion, arreglo, tipo, archivo }
   */
  constructor(mensaje, opciones = {}) {
    super(mensaje);
    this.name = 'ErrorAguila';
    this.mensajeCorto = mensaje;
    this.linea = opciones.linea ?? 0;
    this.columna = opciones.columna ?? 0;
    this.finColumna = opciones.finColumna ?? (this.columna + 1);
    this.explicacion = opciones.explicacion ?? '';
    // arreglo: { titulo, cambios: [{ linea, desde, hasta, texto }] }  (columnas 0-based, hasta exclusivo)
    this.arreglo = opciones.arreglo ?? null;
    this.tipo = opciones.tipo ?? 'error'; // 'error' | 'aviso'
    this.archivo = opciones.archivo ?? null;
    this.fase = opciones.fase ?? 'sintaxis'; // 'sintaxis' | 'ejecucion' | 'analisis'
  }

  get mensajeCompleto() {
    const donde = this.linea ? `Línea ${this.linea}: ` : '';
    return donde + this.mensajeCorto;
  }

  aObjeto() {
    return {
      mensaje: this.mensajeCorto,
      explicacion: this.explicacion,
      linea: this.linea,
      columna: this.columna,
      finColumna: this.finColumna,
      arreglo: this.arreglo,
      tipo: this.tipo,
      archivo: this.archivo,
      fase: this.fase,
    };
  }
}

// Distancia de edición para sugerir «¿querías decir…?»
export function distancia(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    prev = cur;
  }
  return prev[n];
}

export function quitarTildes(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function sugerir(nombre, candidatos) {
  let mejor = null, mejorD = Infinity;
  const base = quitarTildes(nombre.toLowerCase());
  for (const c of candidatos) {
    if (!c || c === nombre) continue;
    const cc = quitarTildes(c.toLowerCase());
    if (cc === base) return c;
    const d = distancia(base, cc);
    const limite = Math.max(1, Math.floor(Math.max(base.length, cc.length) / 3));
    if (d <= limite && d < mejorD) { mejor = c; mejorD = d; }
  }
  return mejor;
}

// Palabras de otros lenguajes que la gente escribe por costumbre.
export const PALABRAS_EXTRANJERAS = {
  if: 'si', else: 'sino', elif: 'sino si', while: 'mientras', for: 'para cada',
  def: 'función', function: 'función', func: 'función', return: 'devolver', true: 'verdadero',
  false: 'falso', null: 'nulo', none: 'nulo', None: 'nulo', True: 'verdadero', False: 'falso',
  print: 'mostrar', and: 'y', or: 'o', not: 'no', var: 'variable', let: 'variable',
  const: 'constante', class: 'clase', extends: 'extiende', self: 'yo', this: 'yo',
  break: 'romper', continue: 'continuar', pass: 'pasar', when: 'cuando', in: 'en',
  export: 'exportar', len: 'largo', str: 'texto', int: 'entero', float: 'decimal',
  random: 'aleatorio', range: 'rango',
};
