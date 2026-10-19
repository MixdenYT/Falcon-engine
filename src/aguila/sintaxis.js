// Analizador sintáctico de Águila: fichas → árbol (AST).
// Se recupera de los errores línea a línea para poder mostrar varios problemas.

import { analizarLexico, finSinComentario } from './lexico.js';
import { ErrorAguila, PALABRAS_EXTRANJERAS } from './errores.js';

const NOMBRES_CONTEXTUALES = new Set(['y', 'o']);

const CABECERAS = {
  si: 'la condición', sino: '«sino»', mientras: 'la condición', para: '«para cada»',
  cuando: 'el evento', 'función': 'la función', clase: 'la clase', repetir: '«repetir»',
};

const EXPLICACION_DOS_PUNTOS = {
  si: 'Después de si siempre van dos puntos, para que Águila sepa dónde empiezan las órdenes que dependen de ella.',
  sino: 'Después de sino van dos puntos y, debajo, las órdenes que se hacen cuando la condición no se cumple.',
  mientras: 'Después de mientras van dos puntos; las órdenes de debajo se repiten mientras la condición sea verdadera.',
  para: 'Después de «para cada … en …» van dos puntos; las órdenes de debajo se repiten con cada elemento.',
  cuando: 'Después de cuando van dos puntos; debajo, con sangría, lo que pasa cuando ocurre el evento.',
  'función': 'Después de la función van dos puntos; debajo, con sangría, las órdenes que la forman.',
  clase: 'Después de la clase van dos puntos; debajo, con sangría, sus variables y eventos.',
  repetir: 'Después de «repetir N veces» van dos puntos; debajo, las órdenes que se repiten.',
};

export function analizar(fuente, archivo = null) {
  const { fichas, errores } = analizarLexico(fuente);
  const p = new Parser(fichas, fuente, archivo);
  p.errores.push(...errores);
  const programa = p.programa();
  for (const e of p.errores) e.archivo = archivo;
  // Ordena por línea y quita duplicados en la misma línea.
  const vistos = new Set();
  const lista = p.errores
    .sort((a, b) => a.linea - b.linea || a.columna - b.columna)
    .filter(e => { const k = e.linea + ':' + e.mensajeCorto; if (vistos.has(k)) return false; vistos.add(k); return true; });
  return { programa, errores: lista };
}

class Parser {
  constructor(fichas, fuente, archivo) {
    this.f = fichas;
    this.i = 0;
    this.errores = [];
    this.lineas = fuente.replace(/\r\n?/g, '\n').split('\n');
    this.archivo = archivo;
  }

  get actual() { return this.f[this.i]; }
  ver(n = 0) { return this.f[Math.min(this.i + n, this.f.length - 1)]; }
  avanzar() { const t = this.f[this.i]; if (this.i < this.f.length - 1) this.i++; return t; }
  es(tipo, valor) {
    const t = this.actual;
    return t.tipo === tipo && (valor === undefined || t.valor === valor);
  }
  esOp(v) { return this.es('OP', v); }
  esClave(v) { return this.es('CLAVE', v); }
  aceptar(tipo, valor) { if (this.es(tipo, valor)) return this.avanzar(); return null; }

  error(mensaje, ficha = this.actual, extra = {}) {
    return new ErrorAguila(mensaje, {
      linea: ficha.linea, columna: ficha.col, finColumna: Math.max(ficha.finCol, ficha.col + 1), ...extra,
    });
  }

  esperarOp(v, contexto) {
    if (this.esOp(v)) return this.avanzar();
    const t = this.actual;
    const desc = describir(t);
    throw this.error(`esperaba «${v}»${contexto ? ' ' + contexto : ''} pero encontré ${desc}.`, t);
  }

  esperarNombre(que) {
    if (this.es('NOMBRE')) return this.avanzar();
    // «y» y «o» son operadores solo entre dos valores; en otro sitio son nombres (la coordenada y).
    if (this.es('CLAVE') && NOMBRES_CONTEXTUALES.has(this.actual.valor)) return this.avanzar();
    const t = this.actual;
    if (t.tipo === 'CLAVE') {
      throw this.error(`«${t.valor}» es una palabra reservada de Águila y no se puede usar como ${que}.`, t, {
        explicacion: 'Elige otro nombre: por ejemplo añade una letra o un guion bajo, como «' + t.valor + '_2».',
      });
    }
    throw this.error(`aquí va ${que}, pero encontré ${describir(t)}.`, t);
  }

  // Espera «:» al final de una cabecera de bloque.
  dosPuntos(cabecera, fichaInicio) {
    if (this.esOp(':')) return this.avanzar();
    const t = this.actual;
    const linea = fichaInicio.linea;
    const textoLinea = this.lineas[linea - 1] || '';
    const fin = finSinComentario(textoLinea);
    if (t.tipo === 'NUEVA_LINEA' || t.tipo === 'FIN' || t.linea !== linea) {
      throw new ErrorAguila(`falta «:» al final de ${CABECERAS[cabecera] || 'la línea'}.`, {
        linea, columna: Math.max(0, fin - 1), finColumna: fin + 1,
        explicacion: EXPLICACION_DOS_PUNTOS[cabecera] || 'Las líneas que abren un bloque terminan en dos puntos.',
        arreglo: { titulo: 'Añadir «:»', cambios: [{ linea, desde: fin, hasta: fin, texto: ':' }] },
      });
    }
    if (t.tipo === 'OP' && t.valor === '=' && (cabecera === 'si' || cabecera === 'mientras')) {
      throw this.error('para comparar se usa «==», no «=».', t, {
        explicacion: 'Un solo «=» guarda un valor en una variable. Para preguntar si dos cosas son iguales, usa dos: «==».',
        arreglo: { titulo: 'Cambiar por «==»', cambios: [{ linea: t.linea, desde: t.col, hasta: t.finCol, texto: '==' }] },
      });
    }
    throw this.error(`esperaba «:» al final de ${CABECERAS[cabecera] || 'la línea'} pero encontré ${describir(t)}.`, t, {
      explicacion: EXPLICACION_DOS_PUNTOS[cabecera] || '',
    });
  }

  finDeSentencia() {
    if (this.aceptar('NUEVA_LINEA')) return;
    if (this.es('FIN') || this.es('DESANGRIA')) return;
    const t = this.actual;
    if (t.tipo === 'OP' && t.valor === ':') {
      throw this.error('sobran los dos puntos «:» aquí.', t, {
        explicacion: 'Los dos puntos solo van al final de líneas que abren un bloque, como si, mientras, cuando o función.',
        arreglo: { titulo: 'Quitar «:»', cambios: [{ linea: t.linea, desde: t.col, hasta: t.finCol, texto: '' }] },
      });
    }
    throw this.error(`no esperaba ${describir(t)} aquí.`, t, {
      explicacion: 'Cada orden va en su propia línea. Puede que falte un operador (como + o y) o que sobre algo.',
    });
  }

  // Salta hasta la siguiente línea (y su bloque si lo tiene) tras un error.
  recuperar() {
    while (!this.es('NUEVA_LINEA') && !this.es('FIN') && !this.es('SANGRIA') && !this.es('DESANGRIA')) this.avanzar();
    this.aceptar('NUEVA_LINEA');
    if (this.es('SANGRIA')) {
      let nivel = 0;
      do {
        if (this.es('SANGRIA')) nivel++;
        else if (this.es('DESANGRIA')) nivel--;
        this.avanzar();
      } while (nivel > 0 && !this.es('FIN'));
    }
  }

  programa() {
    const cuerpo = [];
    while (!this.es('FIN')) {
      if (this.aceptar('NUEVA_LINEA')) continue;
      if (this.es('SANGRIA')) {
        const t = this.actual;
        this.errores.push(this.error('esta línea tiene sangría pero no está dentro de ningún bloque.', t, {
          finColumna: t.finCol,
          explicacion: 'Las órdenes sueltas empiezan al principio de la línea. La sangría solo se usa debajo de líneas que terminan en «:».',
          arreglo: { titulo: 'Quitar la sangría', cambios: [{ linea: t.linea, desde: 0, hasta: t.finCol, texto: '' }] },
        }));
        this.avanzar();
        continue;
      }
      if (this.es('DESANGRIA')) { this.avanzar(); continue; }
      const s = this.sentenciaSegura();
      if (s) cuerpo.push(s);
    }
    return { tipo: 'Programa', cuerpo };
  }

  sentenciaSegura() {
    const ini = this.i;
    try {
      return this.sentencia();
    } catch (e) {
      if (!(e instanceof ErrorAguila)) throw e;
      this.errores.push(e);
      if (this.i === ini) this.avanzar();
      this.recuperar();
      return null;
    }
  }

  bloque(cabecera, fichaInicio) {
    this.dosPuntos(cabecera, fichaInicio);
    // Bloque en la misma línea: «si x: hacer()»
    if (!this.es('NUEVA_LINEA')) {
      const s = this.sentenciaSimple();
      this.finDeSentencia();
      return [s];
    }
    this.avanzar();
    if (!this.es('SANGRIA')) {
      const linea = fichaInicio.linea;
      const t = this.actual;
      const base = (this.lineas[linea - 1].match(/^\s*/) || [''])[0].length;
      throw new ErrorAguila(`después de «:» hay que escribir las órdenes con sangría.`, {
        linea: t.tipo === 'FIN' ? linea : t.linea,
        columna: 0, finColumna: 1,
        explicacion: 'Las órdenes que dependen de una línea con «:» van debajo y un poco más a la derecha (4 espacios), para que se vea que van dentro.',
        arreglo: t.tipo === 'FIN' || t.linea === linea ? null : {
          titulo: 'Añadir sangría',
          cambios: [{ linea: t.linea, desde: 0, hasta: base, texto: ' '.repeat(base + 4) }],
        },
      });
    }
    this.avanzar();
    const cuerpo = [];
    while (!this.es('DESANGRIA') && !this.es('FIN')) {
      if (this.aceptar('NUEVA_LINEA')) continue;
      if (this.es('SANGRIA')) {
        const t = this.actual;
        this.errores.push(this.error('esta línea tiene más sangría de la esperada.', t, {
          finColumna: t.finCol,
          explicacion: 'Solo se añade sangría debajo de una línea que termina en «:». Alinea esta línea con la anterior.',
        }));
        this.recuperar();
        continue;
      }
      const s = this.sentenciaSegura();
      if (s) cuerpo.push(s);
    }
    this.aceptar('DESANGRIA');
    return cuerpo;
  }

  sentencia() {
    const t = this.actual;
    if (t.tipo === 'CLAVE') {
      switch (t.valor) {
        case 'clase': return this.clase();
        case 'exportar': case 'variable': case 'constante': {
          const s = this.declaracion(); this.finDeSentencia(); return s;
        }
        case 'si': return this.si();
        case 'mientras': {
          this.avanzar();
          const cond = this.expresion();
          return { tipo: 'Mientras', cond, cuerpo: this.bloque('mientras', t), linea: t.linea };
        }
        case 'para': return this.paraCada();
        case 'repetir': {
          this.avanzar();
          const veces = this.expresion();
          if (!this.aceptar('CLAVE', 'veces')) {
            throw this.error('después del número va la palabra «veces», como en «repetir 3 veces:».', this.actual);
          }
          return { tipo: 'Repetir', veces, cuerpo: this.bloque('repetir', t), linea: t.linea };
        }
        case 'función': return this.funcion();
        case 'cuando': return this.cuando();
        case 'sino': {
          throw this.error('este «sino» no tiene un «si» delante.', t, {
            explicacion: '«sino» va justo debajo de un bloque «si», alineado con él, para decir qué hacer cuando la condición no se cumple.',
          });
        }
      }
    }
    const s = this.sentenciaSimple();
    this.finDeSentencia();
    return s;
  }

  sentenciaSimple() {
    const t = this.actual;
    if (t.tipo === 'CLAVE') {
      switch (t.valor) {
        case 'devolver': {
          this.avanzar();
          const valor = (this.es('NUEVA_LINEA') || this.es('FIN') || this.es('DESANGRIA')) ? null : this.expresion();
          return { tipo: 'Devolver', valor, linea: t.linea };
        }
        case 'romper': this.avanzar(); return { tipo: 'Romper', linea: t.linea };
        case 'continuar': this.avanzar(); return { tipo: 'Continuar', linea: t.linea };
        case 'pasar': this.avanzar(); return { tipo: 'Pasar', linea: t.linea };
        case 'variable': case 'constante': case 'exportar': return this.declaracion();
      }
    }
    // Palabras de otros lenguajes al principio de la línea.
    if (t.tipo === 'NOMBRE' && PALABRAS_EXTRANJERAS[t.valor] && ['if', 'else', 'elif', 'while', 'for', 'def', 'function', 'return', 'class', 'var', 'let', 'const'].includes(t.valor)) {
      const ok = PALABRAS_EXTRANJERAS[t.valor];
      throw this.error(`«${t.valor}» no es de Águila; aquí se escribe «${ok}».`, t, {
        explicacion: 'Águila usa palabras en español. ' + `En lugar de «${t.valor}» escribe «${ok}».`,
        arreglo: { titulo: `Cambiar por «${ok}»`, cambios: [{ linea: t.linea, desde: t.col, hasta: t.finCol, texto: ok }] },
      });
    }
    const expr = this.expresion();
    if (this.es('OP') && ['=', '+=', '-=', '*=', '/=', '%=', '**='].includes(this.actual.valor)) {
      const op = this.avanzar();
      if (!['Nombre', 'Miembro', 'Indice'].includes(expr.tipo)) {
        throw this.error('a la izquierda del «=» tiene que haber una variable.', op, {
          explicacion: 'Para guardar un valor escribe el nombre de la variable, luego «=» y después el valor, como «monedas = 3». Para comparar usa «==».',
        });
      }
      const valor = this.expresion();
      return { tipo: 'Asignar', objetivo: expr, op: op.valor, valor, linea: t.linea };
    }
    return { tipo: 'Expresion', expr, linea: t.linea };
  }

  declaracion() {
    const t = this.actual;
    let exportar = false, constante = false;
    if (this.aceptar('CLAVE', 'exportar')) exportar = true;
    if (this.aceptar('CLAVE', 'constante')) constante = true;
    else if (!this.aceptar('CLAVE', 'variable')) {
      throw this.error('después de «exportar» va «variable», como en «exportar variable velocidad = 220».', this.actual);
    }
    const nombre = this.esperarNombre('el nombre de la variable');
    let valor = null;
    if (this.aceptar('OP', '=')) valor = this.expresion();
    else if (constante) throw this.error('una constante necesita un valor: «constante nombre = valor».', this.actual);
    return { tipo: 'DeclVar', nombre: nombre.valor, valor, exportar, constante, linea: t.linea, col: nombre.col };
  }

  clase() {
    const t = this.avanzar();
    const nombre = this.esperarNombre('el nombre de la clase');
    let base = null;
    if (this.aceptar('CLAVE', 'extiende')) base = this.esperarNombre('el tipo del que se extiende').valor;
    const cuerpo = this.bloque('clase', t);
    return { tipo: 'Clase', nombre: nombre.valor, base, cuerpo, linea: t.linea };
  }

  si() {
    const t = this.avanzar();
    const ramas = [];
    const cond = this.expresion();
    ramas.push({ cond, cuerpo: this.bloque('si', t), linea: t.linea });
    let otro = null;
    while (this.esClave('sino')) {
      const ts = this.avanzar();
      if (this.aceptar('CLAVE', 'si')) {
        const c = this.expresion();
        ramas.push({ cond: c, cuerpo: this.bloque('si', ts), linea: ts.linea });
      } else {
        otro = this.bloque('sino', ts);
        break;
      }
    }
    return { tipo: 'Si', ramas, sino: otro, linea: t.linea };
  }

  paraCada() {
    const t = this.avanzar();
    if (!this.aceptar('CLAVE', 'cada')) {
      throw this.error('después de «para» va «cada», como en «para cada moneda en monedas:».', this.actual, {
        arreglo: { titulo: 'Añadir «cada»', cambios: [{ linea: t.linea, desde: t.finCol, hasta: t.finCol, texto: ' cada' }] },
      });
    }
    const nombre = this.esperarNombre('el nombre de cada elemento');
    if (!this.aceptar('CLAVE', 'en')) {
      throw this.error('falta «en»: escribe «para cada elemento en lista:».', this.actual);
    }
    const iterable = this.expresion();
    return { tipo: 'ParaCada', variable: nombre.valor, iterable, cuerpo: this.bloque('para', t), linea: t.linea };
  }

  parametros() {
    const params = [];
    this.esperarOp('(', 'después del nombre');
    if (!this.esOp(')')) {
      do {
        const n = this.esperarNombre('el nombre de un parámetro');
        let defecto = null;
        if (this.aceptar('OP', '=')) defecto = this.expresion();
        params.push({ nombre: n.valor, defecto });
      } while (this.aceptar('OP', ','));
    }
    this.esperarOp(')', 'para cerrar los parámetros');
    return params;
  }

  funcion() {
    const t = this.avanzar();
    const nombre = this.esperarNombre('el nombre de la función');
    if (!this.esOp('(')) {
      throw this.error('después del nombre de la función van los paréntesis, aunque estén vacíos: «función saludar():».', this.actual, {
        arreglo: { titulo: 'Añadir «()»', cambios: [{ linea: nombre.linea, desde: nombre.finCol, hasta: nombre.finCol, texto: '()' }] },
      });
    }
    const params = this.parametros();
    return { tipo: 'Funcion', nombre: nombre.valor, params, cuerpo: this.bloque('función', t), linea: t.linea };
  }

  cuando() {
    const t = this.avanzar();
    const nombre = this.esperarNombre('el nombre del evento');
    const params = [];
    let filtro = null;
    if (!this.esOp('(')) {
      throw this.error('después del evento van paréntesis, como en «cuando empieza():».', this.actual, {
        arreglo: { titulo: 'Añadir «()»', cambios: [{ linea: nombre.linea, desde: nombre.finCol, hasta: nombre.finCol, texto: '()' }] },
      });
    }
    this.avanzar();
    if (!this.esOp(')')) {
      do {
        if (this.es('TEXTO') || this.es('NUMERO')) filtro = this.avanzar().valor;
        else params.push({ nombre: this.esperarNombre('un parámetro del evento').valor, defecto: null });
      } while (this.aceptar('OP', ','));
    }
    this.esperarOp(')', 'para cerrar el evento');
    return { tipo: 'Cuando', evento: nombre.valor, params, filtro, cuerpo: this.bloque('cuando', t), linea: t.linea };
  }

  // ---- Expresiones ----
  expresion() { return this.o(); }

  o() {
    let izq = this.y();
    while (this.esClave('o')) {
      const t = this.avanzar();
      izq = { tipo: 'Logica', op: 'o', izq, der: this.y(), linea: t.linea };
    }
    return izq;
  }

  y() {
    let izq = this.no();
    while (this.esClave('y')) {
      const t = this.avanzar();
      izq = { tipo: 'Logica', op: 'y', izq, der: this.no(), linea: t.linea };
    }
    return izq;
  }

  no() {
    if (this.esClave('no')) {
      const t = this.avanzar();
      return { tipo: 'Unaria', op: 'no', expr: this.no(), linea: t.linea };
    }
    return this.comparacion();
  }

  comparacion() {
    let izq = this.suma();
    while (true) {
      if (this.es('OP') && ['==', '!=', '<', '>', '<=', '>='].includes(this.actual.valor)) {
        const t = this.avanzar();
        izq = { tipo: 'Binaria', op: t.valor, izq, der: this.suma(), linea: t.linea };
      } else if (this.esClave('en')) {
        const t = this.avanzar();
        izq = { tipo: 'Binaria', op: 'en', izq, der: this.suma(), linea: t.linea };
      } else if (this.esClave('no') && this.ver(1).tipo === 'CLAVE' && this.ver(1).valor === 'en') {
        const t = this.avanzar(); this.avanzar();
        izq = { tipo: 'Unaria', op: 'no', expr: { tipo: 'Binaria', op: 'en', izq, der: this.suma(), linea: t.linea }, linea: t.linea };
      } else break;
    }
    return izq;
  }

  suma() {
    let izq = this.producto();
    while (this.es('OP') && (this.actual.valor === '+' || this.actual.valor === '-')) {
      const t = this.avanzar();
      izq = { tipo: 'Binaria', op: t.valor, izq, der: this.producto(), linea: t.linea };
    }
    return izq;
  }

  producto() {
    let izq = this.unaria();
    while (this.es('OP') && ['*', '/', '%'].includes(this.actual.valor)) {
      const t = this.avanzar();
      izq = { tipo: 'Binaria', op: t.valor, izq, der: this.unaria(), linea: t.linea };
    }
    return izq;
  }

  unaria() {
    if (this.esOp('-') || this.esOp('+')) {
      const t = this.avanzar();
      const expr = this.unaria();
      return t.valor === '-' ? { tipo: 'Unaria', op: '-', expr, linea: t.linea } : expr;
    }
    return this.potencia();
  }

  potencia() {
    const base = this.postfijo();
    if (this.esOp('**')) {
      const t = this.avanzar();
      return { tipo: 'Binaria', op: '**', izq: base, der: this.unaria(), linea: t.linea };
    }
    return base;
  }

  postfijo() {
    let e = this.primaria();
    while (true) {
      if (this.esOp('(')) {
        const t = this.avanzar();
        const args = [];
        if (!this.esOp(')')) {
          do {
            if (this.esOp(')')) break;
            args.push(this.expresion());
          } while (this.aceptar('OP', ','));
        }
        if (!this.esOp(')')) {
          throw this.error(`falta cerrar el paréntesis de la llamada con «)».`, this.actual, {
            explicacion: 'Los datos que se le pasan a una función van entre paréntesis y separados por comas: «mover(1, 2)».',
          });
        }
        this.avanzar();
        e = { tipo: 'Llamada', fn: e, args, linea: t.linea };
      } else if (this.esOp('.')) {
        this.avanzar();
        const n = this.actual;
        if (n.tipo !== 'NOMBRE' && n.tipo !== 'CLAVE') throw this.error('después del punto va el nombre de algo, como «jugador.saltar()».', n);
        this.avanzar();
        e = { tipo: 'Miembro', obj: e, nombre: n.valor, linea: n.linea, col: n.col };
      } else if (this.esOp('[')) {
        const t = this.avanzar();
        const indice = this.expresion();
        this.esperarOp(']', 'para cerrar el índice');
        e = { tipo: 'Indice', obj: e, indice, linea: t.linea };
      } else break;
    }
    return e;
  }

  primaria() {
    const t = this.actual;
    switch (t.tipo) {
      case 'NUMERO': this.avanzar(); return { tipo: 'Num', valor: t.valor, linea: t.linea };
      case 'TEXTO': this.avanzar(); return { tipo: 'Texto', valor: t.valor, linea: t.linea };
      case 'NOMBRE': this.avanzar(); return { tipo: 'Nombre', nombre: t.valor, linea: t.linea, col: t.col, finCol: t.finCol };
      case 'CLAVE':
        if (NOMBRES_CONTEXTUALES.has(t.valor)) { this.avanzar(); return { tipo: 'Nombre', nombre: t.valor, linea: t.linea, col: t.col, finCol: t.finCol }; }
        if (t.valor === 'verdadero' || t.valor === 'falso') { this.avanzar(); return { tipo: 'Bool', valor: t.valor === 'verdadero', linea: t.linea }; }
        if (t.valor === 'nulo') { this.avanzar(); return { tipo: 'Nulo', linea: t.linea }; }
        if (t.valor === 'yo') { this.avanzar(); return { tipo: 'Yo', linea: t.linea }; }
        break;
      case 'OP':
        if (t.valor === '(') {
          this.avanzar();
          const e = this.expresion();
          this.esperarOp(')', 'para cerrar el paréntesis');
          return e;
        }
        if (t.valor === '[') {
          this.avanzar();
          const elementos = [];
          while (!this.esOp(']')) {
            elementos.push(this.expresion());
            if (!this.aceptar('OP', ',')) break;
          }
          this.esperarOp(']', 'para cerrar la lista');
          return { tipo: 'Lista', elementos, linea: t.linea };
        }
        if (t.valor === '{') {
          this.avanzar();
          const pares = [];
          while (!this.esOp('}')) {
            const k = this.expresion();
            this.esperarOp(':', 'entre la clave y el valor');
            pares.push([k, this.expresion()]);
            if (!this.aceptar('OP', ',')) break;
          }
          this.esperarOp('}', 'para cerrar el diccionario');
          return { tipo: 'Dicc', pares, linea: t.linea };
        }
        break;
    }
    if (t.tipo === 'NUEVA_LINEA' || t.tipo === 'FIN') {
      const ant = this.f[Math.max(0, this.i - 1)];
      throw this.error('la línea se ha quedado a medias: falta algo al final.', ant, {
        explicacion: 'Después de un operador como +, y, o, == tiene que venir otro valor.',
      });
    }
    if (t.tipo === 'CLAVE') {
      throw this.error(`no esperaba la palabra «${t.valor}» aquí.`, t, {
        explicacion: palabraFueraDeSitio(t.valor),
      });
    }
    throw this.error(`no esperaba ${describir(t)} aquí.`, t);
  }
}

function palabraFueraDeSitio(p) {
  switch (p) {
    case 'si': case 'mientras': case 'cuando': case 'para':
      return `«${p}» tiene que ir al principio de la línea.`;
    case 'sino': return '«sino» va en su propia línea, alineado con el «si» al que acompaña.';
    case 'variable': return 'Las variables se declaran al principio de la línea: «variable nombre = valor».';
    default: return '';
  }
}

function describir(t) {
  switch (t.tipo) {
    case 'NUEVA_LINEA': return 'el final de la línea';
    case 'FIN': return 'el final del archivo';
    case 'SANGRIA': return 'una sangría';
    case 'DESANGRIA': return 'el final del bloque';
    case 'TEXTO': return `el texto "${t.valor}"`;
    case 'NUMERO': return `el número ${t.valor}`;
    case 'CLAVE': return `la palabra «${t.valor}»`;
    case 'NOMBRE': return `«${t.valor}»`;
    default: return `«${t.valor}»`;
  }
}
