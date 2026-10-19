// Pruebas del lenguaje Águila. Ejecutar: npm test
import { crearInterprete, analizar, analizarCodigo, rutaEnLinea, formatear, InstanciaScript, ErrorAguila } from '../src/aguila/index.js';

let ok = 0, mal = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; }
  catch (e) { mal++; console.log('✗', nombre, '\n   ', e && (e.mensajeCompleto || e.stack || e)); }
}
function igual(a, b, msg = '') {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`${msg} esperaba ${jb} y obtuve ${ja}`);
}
function correr(codigo) {
  const salida = [];
  const i = crearInterprete({ salida: t => salida.push(t) });
  const r = i.ejecutar(codigo);
  return { salida, r, i };
}

prueba('aritmética', () => igual(correr('1 + 2 * 3').r, 7));
prueba('potencia y resto', () => igual(correr('2 ** 3 + 7 % 4').r, 11));
prueba('texto + número', () => igual(correr('"Monedas: " + 3').r, 'Monedas: 3'));
prueba('variables y si/sino', () => {
  const { salida } = correr(`variable monedas = 10
si monedas >= 10:
    mostrar("gana")
sino:
    mostrar("pierde")`);
  igual(salida, ['gana']);
});
prueba('≥ unicode', () => igual(correr('5 ≥ 3').r, true));
prueba('sino si', () => {
  const { salida } = correr(`variable n = 5
si n < 3:
    mostrar("a")
sino si n < 10:
    mostrar("b")
sino:
    mostrar("c")`);
  igual(salida, ['b']);
});
prueba('mientras', () => {
  const { salida } = correr(`variable i = 0
mientras i < 3:
    mostrar(i)
    i += 1`);
  igual(salida, ['0', '1', '2']);
});
prueba('para cada + romper/continuar', () => {
  const { salida } = correr(`para cada n en rango(10):
    si n == 2:
        continuar
    si n == 5:
        romper
    mostrar(n)`);
  igual(salida, ['0', '1', '3', '4']);
});
prueba('repetir', () => igual(correr(`variable s = 0
repetir 4 veces:
    s = s + 2
s`).r, 8));
prueba('funciones y recursión', () => igual(correr(`función fact(n):
    si n <= 1:
        devolver 1
    devolver n * fact(n - 1)
fact(5)`).r, 120));
prueba('parámetros por defecto', () => igual(correr(`función saludo(nombre = "mundo"):
    devolver "hola " + nombre
saludo()`).r, 'hola mundo'));
prueba('listas', () => igual(correr(`variable l = [3, 1, 2]
l.añadir(0)
l.ordenar()
l`).r, [0, 1, 2, 3]));
prueba('índices negativos', () => igual(correr('[1, 2, 3][-1]').r, 3));
prueba('diccionarios', () => igual(correr(`variable d = {"a": 1}
d["b"] = 2
d.claves()`).r, ['a', 'b']));
prueba('texto métodos', () => igual(correr('"Hola".mayusculas() + "x".repetir(2)').r, 'HOLAxx'));
prueba('en', () => igual(correr('2 en [1, 2] y "la" en "hola"').r, true));
prueba('no en', () => igual(correr('5 no en [1, 2]').r, true));
prueba('clases', () => igual(correr(`clase Punto:
    variable x = 0
    variable y = 0
    función iniciar(a, b):
        x = a
        yo.y = b
    función suma():
        devolver x + y
variable p = Punto(2, 3)
p.suma()`).r, 5));
prueba('una línea', () => igual(correr(`variable a = 1
si a == 1: a = 5
a`).r, 5));
prueba('constante', () => {
  try { correr(`constante A = 1
A = 2`); throw new Error('no falló'); }
  catch (e) { if (!(e instanceof ErrorAguila)) throw e; }
});

// Errores amables
function errorDe(codigo) { return analizar(codigo).errores; }
prueba('falta dos puntos', () => {
  const e = errorDe(`si monedas >= 10\n    ganar()`);
  igual(e[0].mensajeCompleto, 'Línea 1: falta «:» al final de la condición.');
  igual(e[0].arreglo.cambios[0], { linea: 1, desde: 16, hasta: 16, texto: ':' });
});
prueba('= en condición', () => {
  const e = errorDe(`si a = 3:\n    pasar`);
  igual(e[0].mensajeCorto, 'para comparar se usa «==», no «=».');
});
prueba('texto sin cerrar', () => {
  const e = errorDe(`mostrar("hola)`);
  if (!e.some(x => x.mensajeCorto.startsWith('el texto no está cerrado'))) throw new Error(JSON.stringify(e.map(x => x.mensajeCorto)));
});
prueba('palabra inglesa', () => {
  const e = errorDe(`if a:\n    pasar`);
  igual(e[0].arreglo.cambios[0].texto, 'si');
});
prueba('varios errores', () => {
  const e = errorDe(`si a\n    pasar\nmientras b\n    pasar`);
  igual(e.length, 2);
});
prueba('división entre cero', () => {
  try { correr('1 / 0'); throw new Error('no falló'); }
  catch (e) { igual(e.mensajeCorto, 'no se puede dividir entre cero.'); igual(e.linea, 1); }
});
prueba('nombre desconocido con sugerencia', () => {
  try { correr(`variable monedas = 1\nmostrar(monedsa)`); throw new Error('no falló'); }
  catch (e) { igual(e.mensajeCorto, 'no conozco «monedsa». ¿Querías decir «monedas»?'); igual(e.linea, 2); }
});
prueba('bucle infinito', () => {
  const i = crearInterprete({ salida: () => {}, limitePasos: 10000 });
  try { i.ejecutar('mientras verdadero:\n    pasar'); throw new Error('no falló'); }
  catch (e) { if (!e.mensajeCorto.startsWith('parece un bucle infinito')) throw e; }
});

// Script de nodo con host
prueba('script de nodo con eventos, host y esperar', () => {
  const salida = [];
  const i = crearInterprete({ salida: t => salida.push(t) });
  const host = {
    x: 0, saltos: 0,
    aguilaTipo: 'Personaje2D',
    aguilaObtener(n) {
      if (n === 'x') return this.x;
      if (n === 'saltar') return (f) => { this.saltos += f; return null; };
      if (n === 'en_el_suelo') return () => true;
      return undefined;
    },
    aguilaAsignar(n, v) { if (n === 'x') { this.x = v; return true; } return false; },
    aguilaMiembros() { return ['x', 'saltar', 'en_el_suelo']; },
  };
  i.definirGlobal('se_pulsa', (a) => a === 'saltar');
  const prog = i.compilar(`clase Jugador extiende Personaje2D:
    exportar variable velocidad = 220
    exportar variable altura_salto = 420
    variable monedas = 0

    cuando empieza():
        mostrar("¡Hola, aventurero!")
        esperar(1)
        mostrar("un segundo después")

    cuando se_actualiza(delta):
        x = x + velocidad * delta
        si se_pulsa("saltar") y en_el_suelo():
            saltar(altura_salto)

    cuando se_pulsa("saltar"):
        monedas = monedas + 1
`, 'jugador.agl');
  const s = new InstanciaScript(i, prog, host, 'jugador.agl');
  s.iniciar({ velocidad: 100 });
  s.emitir('empieza');
  igual(salida, ['¡Hola, aventurero!']);
  s.actualizarCorrutinas(0.5);
  igual(salida.length, 1);
  s.actualizarCorrutinas(0.6);
  igual(salida[1], 'un segundo después');
  s.emitir('se_actualiza', [0.5]);
  igual(host.x, 50);
  igual(host.saltos, 420);
  s.emitir('se_pulsa', ['saltar']);
  s.emitir('se_pulsa', ['otra']);
  igual(s.obtener('monedas'), 1);
  igual(s.exportadas, ['velocidad', 'altura_salto']);
});

// Analizador
prueba('analizador: símbolos, ruta y avisos', () => {
  const a = analizarCodigo(`clase Jugador extiende Personaje2D:
    exportar variable velocidad = 220
    variable monedas = 0
    cuando toca(otro):
        si otro.es("Moneda"):
            monedas = monedas + 1
            ganr_partida()
`, { miembros: ['mover', 'saltar'] });
  igual(a.errores.length, 0);
  igual(a.simbolos.variables.map(v => [v.nombre, v.tipo, v.exportar]), [['velocidad', 'entero', true], ['monedas', 'entero', false]]);
  igual(a.avisos[0].mensajeCorto, 'no conozco «ganr_partida». ¿Querías decir «ganar_partida»?');
  igual(rutaEnLinea(a, 6), ['Jugador', 'cuando toca(otro)']);
});
prueba('formatear', () => {
  igual(formatear(`si  a==1 :\n  mostrar( a ,2 )\n\n\n\n  x=-3+b\n`), `si a == 1:\n    mostrar(a, 2)\n\n\n    x = -3 + b\n`);
});

console.log(`Águila: ${ok} pruebas correctas, ${mal} fallidas`);
if (mal) process.exitCode = 1;
