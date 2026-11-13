// Scripts de Ara dentro del mundo del juego (src/ara/puente.js + src/motor/mundo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { TIPOS } from '../src/motor/tipos.js';
import { FUNCIONES, EVENTOS } from '../src/aguila/biblioteca.js';
import { comprobarAra, formatearAra, claseDe, HAY_JSPI } from '../src/ara/puente.js';

import './dom.js'; // DOMMatrix y DOMPoint para las posiciones 2D

const nodo = (tipo, nombre, props = {}, extra = {}) => ({ id: nombre, tipo, nombre, props: { posicion: [0, 0], ...props }, hijos: [], ...extra });

/** Un mundo con una escena 2D y los scripts dados (`rel → texto`), ya iniciado. */
async function mundo(scripts, raiz) {
  const salida = [];
  const m = new Mundo({ proyecto: { datos: { nombre: 'Prueba' } }, lienzo: {}, alMostrar: (t) => salida.push(t) });
  m.raiz = new NodoVivo(m, raiz, null); // crea también los hijos
  m.indiceSucio = true;
  m.textos = new Map(Object.entries(scripts));
  m.audio = { sonar() {}, pararNodo() {}, reproducirNodo() {} };
  await m.compilarAra();
  m.iniciarScripts(m.raiz);
  return { m, salida };
}

const JUGADOR = `clase Jugador extiende Personaje2D:
    exportar velocidad = 100.0
    monedas = 0
    pasos = 0

    cuando empieza():
        imprimir("hola desde " + nombre)

    cuando se_actualiza(delta):
        x += velocidad * delta
        pasos += 1

    cuando se_pulsa("saltar"):
        monedas += 10

    cuando toca(otro):
        si otro.es("Moneda"):
            monedas += 1
            otro.eliminar()

    cuando recibe("premio", datos):
        monedas += entero(datos)
`;

function escena() {
  return nodo('Nodo2D', 'Escena', {}, {
    hijos: [
      nodo('Personaje2D', 'Jugador', { posicion: [10, 0] }, { script: 'scripts/jugador.ara', exportados: { velocidad: 50 } }),
      nodo('Area2D', 'Moneda', { posicion: [40, 0] }),
    ],
  });
}

test('un script de Ara mueve su nodo, responde a eventos con filtro y lee campos exportados', async () => {
  const { m, salida } = await mundo({ 'scripts/jugador.ara': JUGADOR }, escena());
  assert.deepEqual(m.errores, []);
  const j = m.buscarPorNombre('Jugador'), s = j.scripts[0];
  assert.deepEqual(salida, ['hola desde Jugador']);
  assert.equal(s.obtener('velocidad'), 50, 'el valor del Inspector sustituye al inicial');
  m.emitirNodo(j, 'se_actualiza', [0.5]);
  assert.equal(j.props.posicion[0], 35);
  m.emitirNodo(j, 'se_pulsa', ['disparar']);
  assert.equal(s.obtener('monedas'), 0, 'el filtro deja fuera otras acciones');
  m.emitirNodo(j, 'se_pulsa', ['saltar']);
  assert.equal(s.obtener('monedas'), 10);
  m.emitirNodo(j, 'toca', [m.buscarPorNombre('Moneda')]);
  assert.equal(s.obtener('monedas'), 11);
  assert.equal(m.buscarPorNombre('Moneda')?.eliminado ?? true, true);
  m.emitirNodo(j, 'recibe', ['premio', '5']);
  assert.equal(s.obtener('monedas'), 16);
  assert.equal(s.asignar('velocidad', 7), true);
  assert.equal(j.aguilaAsignar('monedas', 20), true, 'como en Águila, otro script puede cambiar un campo');
  assert.equal(s.asignar('no_existe', 1), false);
  assert.deepEqual(s.variables().map((v) => [v.nombre, v.valor, v.exportada]), [['velocidad', 7, true], ['monedas', 20, false], ['pasos', 1, false]]);

  // Recarga en caliente: el código nuevo se usa enseguida y los campos no exportados conservan su valor.
  m.textos.set('scripts/jugador.ara', JUGADOR.replace('monedas += 10', 'monedas += 100') + '    nuevo = "sí"\n');
  await m.recargarAra();
  assert.deepEqual(m.errores, []);
  const s2 = j.scripts[0];
  assert.notEqual(s2, s);
  assert.deepEqual(s2.variables().map((v) => [v.nombre, v.valor]), [['velocidad', 50], ['monedas', 20], ['pasos', 1], ['nuevo', 'sí']], 'velocidad vuelve al valor del Inspector');
  m.emitirNodo(j, 'se_pulsa', ['saltar']);
  assert.equal(s2.obtener('monedas'), 120);
  // Con un error, sigue el programa anterior y se informa.
  m.textos.set('scripts/jugador.ara', 'clase Jugador extiende Personaje2D:\n    cuando empieza():\n        x = "no"\n');
  await m.recargarAra();
  assert.equal(m.errores.length, 1); assert.equal(m.errores[0].linea, 3);
  assert.equal(j.scripts[0], s2);
  s.soltar();
  s2.soltar();
  assert.equal(s.obtener('monedas'), undefined);
  assert.equal(s.programa.ara.vivos(), 0, 'sin fugas al soltar');
  assert.equal(s2.programa.ara.vivos(), 0);
});

test('los errores de compilación y de ejecución llevan su archivo y su línea', async () => {
  const mal = { 'scripts/jugador.ara': JUGADOR, 'scripts/mal.ara': 'clase Mal extiende Nodo2D:\n    cuando empieza():\n        x = "texto" + 1\n' };
  const { m } = await mundo(mal, escena());
  assert.equal(m.programaAra, null);
  assert.ok(m.errores.some((e) => e.archivo === 'scripts/mal.ara' && e.linea === 3), JSON.stringify(m.errores));
  assert.ok(m.errores.some((e) => /no se han podido compilar/.test(e.mensaje)), 'el nodo con script avisa');

  const ejec = { 'scripts/div.ara': 'clase Div extiende Nodo2D:\n    n = 0\n    cuando se_actualiza(delta):\n        n = 10 // n\n' };
  const raiz = nodo('Nodo2D', 'Escena', {}, { hijos: [nodo('Nodo2D', 'D', {}, { script: 'scripts/div.ara' })] });
  const r = await mundo(ejec, raiz);
  assert.deepEqual(r.m.errores, []);
  const d = r.m.buscarPorNombre('D');
  r.m.emitirNodo(d, 'se_actualiza', [0.1]);
  r.m.emitirNodo(d, 'se_actualiza', [0.1]);
  assert.equal(r.m.errores.length, 1, 'tras un error, ese caso deja de ejecutarse');
  assert.equal(r.m.errores[0].archivo, 'scripts/div.ara');
  assert.equal(r.m.errores[0].linea, 4);

  const huerfano = { 'scripts/x.ara': 'clase X extiende Nodo2D:\n    cuando empieza():\n        nodo("NoExiste").x = 1.0\n' };
  const h = await mundo(huerfano, nodo('Nodo2D', 'Escena', {}, { hijos: [nodo('Nodo2D', 'X', {}, { script: 'scripts/x.ara' })] }));
  assert.equal(h.m.errores.length, 1);
  assert.match(h.m.errores[0].mensaje, /no hay ningún nodo/);
  assert.equal(h.m.errores[0].linea, 3);
});

test('comprobarAra, formatearAra y claseDe (para el editor)', async () => {
  assert.deepEqual(await comprobarAra({ 'a.ara': JUGADOR }), []);
  const [e] = await comprobarAra(new Map([['a.ara', 'clase A extiende Nodo2D:\n    cuando empieza():\n        no_existe()\n']]));
  assert.equal(e.archivo, 'a.ara'); assert.equal(e.linea, 3);
  const f = await formatearAra('clase A extiende Nodo2D:\n  cuando empieza():\n      x = 1.0\n');
  assert.deepEqual(f, { ok: true, texto: 'clase A extiende Nodo2D:\n    cuando empieza():\n        x = 1.0\n' });
  assert.equal((await formatearAra('clase A extiende:\n')).ok, false);
  assert.equal(claseDe('# hola\nclase Jugador extiende Nodo2D:\n'), 'Jugador');
  assert.equal(claseDe('x = 1'), null);
});

test('motor.ara declara toda la API de Falcon: tipos de nodo, sus miembros, funciones del motor y eventos', async () => {
  const motor = await readFile(new URL('../src/ara/motor.ara', import.meta.url), 'utf8');
  const tipos = new Set([...motor.matchAll(/^externa tipo (\w+)/gm)].map((x) => x[1]));
  for (const t of Object.keys(TIPOS)) assert.ok(tipos.has(t), `falta el tipo ${t}`);
  const miembros = new Set([...motor.matchAll(/^externa (?:func|propiedad) Nodo\w*\.([\p{L}_][\p{L}\p{N}_]*)/gmu)].map((x) => x[1]));
  for (const [id, t] of Object.entries(TIPOS)) for (const mb of t.miembros || []) assert.ok(miembros.has(mb.nombre) || motor.includes(`${id}.${mb.nombre}`) || new RegExp(`\\.${mb.nombre}\\b`).test(motor), `falta ${id}.${mb.nombre}`);
  const funciones = new Set([...motor.matchAll(/^externa func ([\p{L}_][\p{L}\p{N}_]*)\(/gmu)].map((x) => x[1]));
  // En Ara: `despues` (recibe una función) se escribe con `esperar`; las variables `puntos` y `gravedad` se usan
  // con funciones.
  const equivalente = { despues: 'esperar', puntos: 'poner_puntos', gravedad: 'gravedad_global' };
  for (const f of FUNCIONES) {
    if (!f.motor) continue;
    if (equivalente[f.nombre] === 'esperar') continue;
    assert.ok(funciones.has(f.nombre) || funciones.has(equivalente[f.nombre]), `falta la función ${f.nombre}`);
  }
  for (const ev of EVENTOS) assert.match(motor, new RegExp(`^externa evento ${ev.nombre}\\(`, 'm'), `falta el evento ${ev.nombre}`);
});

test('esperar pausa solo ese evento y sigue con el tiempo del juego (JSPI)', { skip: !HAY_JSPI && 'este Node no tiene JSPI (hace falta Node 25 o Electron)' }, async () => {
  const s = 'clase T extiende Nodo2D:\n    fase = 0\n    cuando empieza():\n        fase = 1\n        esperar(1.0)\n        fase = 2\n';
  const { m } = await mundo({ 'scripts/t.ara': s }, nodo('Nodo2D', 'Escena', {}, { hijos: [nodo('Nodo2D', 'T', {}, { script: 'scripts/t.ara' })] }));
  const t = m.buscarPorNombre('T').scripts[0];
  assert.equal(t.obtener('fase'), 1);
  m.programaAra.actualizar(0.5); await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.obtener('fase'), 1);
  m.programaAra.actualizar(0.6); await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.obtener('fase'), 2);
  assert.deepEqual(m.errores, []);
});

test('nodo.llamar, las señales y el CQB llaman a funciones de Ara (y de Águila) por su nombre', async () => {
  const enemigo = 'clase Enemigo extiende Nodo2D:\n    vida = 100\n    func recibir_dano(cantidad: entero):\n        vida -= cantidad\n        si vida <= 0:\n            ganar_puntos(5)\n';
  const jugador = 'clase Disparo extiende Nodo2D:\n    cuando se_pulsa("disparar"):\n        nodo("Malo").llamar("recibir_dano", 60.0)\n        imprimir("puntos", puntos())\n';
  const raiz = nodo('Nodo2D', 'Escena', {}, { hijos: [
    nodo('Nodo2D', 'Malo', {}, { script: 'scripts/enemigo.ara' }),
    nodo('Nodo2D', 'Yo', {}, { script: 'scripts/disparo.ara', senales: [{ evento: 'hace_clic', destino: 'Malo', funcion: 'recibir_dano' }] }),
  ] });
  const { m, salida } = await mundo({ 'scripts/enemigo.ara': enemigo, 'scripts/disparo.ara': jugador }, raiz);
  const malo = m.buscarPorNombre('Malo'), yo = m.buscarPorNombre('Yo');
  assert.equal(malo.scripts[0].tiene('recibir_dano'), true);
  m.emitirNodo(yo, 'se_pulsa', ['disparar']);
  assert.equal(malo.aguilaObtener('vida'), 40);
  assert.equal(m.llamarFuncion(malo, 'recibir_dano', [40]), null);
  assert.deepEqual(salida, ['puntos 0']);
  assert.equal(m.interp.globales.vars.get('puntos'), 5);
  m.emitirNodo(yo, 'se_pulsa', ['disparar']);
  assert.deepEqual(salida, ['puntos 0', 'puntos 10'], 'la vida ya está en 0: vuelve a dar puntos');
  assert.deepEqual(m.errores, []);
  // Una señal sin datos llama a una función que pide uno: error claro con el archivo.
  m.emitirNodo(yo, 'hace_clic', []);
  assert.match(m.errores[0].mensaje, /recibe 1 dato\(s\), pero le llegan 0/);
  assert.throws(() => m.llamarFuncion(malo, 'no_existe', []), /no tiene ninguna función «no_existe»/);
});

test('el editor: símbolos, errores en vivo de todo el proyecto y nombres de clase para scripts nuevos', async () => {
  const { simbolosAra, analizarAra, claseParaArchivo } = await import('../src/editor/ara.js');
  const { simbolos, bloques } = simbolosAra(JUGADOR + '\n    func curar(n: entero, de: texto):\n        monedas += n\n');
  assert.equal(simbolos.clase, 'Jugador'); assert.equal(simbolos.base, 'Personaje2D');
  assert.deepEqual(simbolos.variables.map((v) => [v.nombre, v.tipo, v.valor, v.exportar]), [['velocidad', 'decimal', 100, true], ['monedas', 'entero', 0, false], ['pasos', 'entero', 0, false]]);
  assert.deepEqual(simbolos.funciones.map((f) => [f.nombre, f.params]), [['curar', ['n', 'de']]]);
  assert.deepEqual(simbolos.eventos.map((e) => [e.evento, e.filtro, e.params]), [['empieza', null, []], ['se_actualiza', null, ['delta']], ['se_pulsa', 'saltar', []], ['toca', null, ['otro']], ['recibe', 'premio', ['datos']]]);
  const toca = bloques.find((b) => b.titulo === 'cuando toca');
  assert.ok(toca.desde < toca.hasta && bloques.find((b) => b.titulo === 'clase Jugador').hasta >= toca.hasta);

  const leidos = [];
  const proyecto = {
    archivos: [{ rel: 'scripts/jugador.ara' }, { rel: 'scripts/otro.ara' }, { rel: 'scripts/viejo.agl' }],
    docs: [],
    leer: async (rel) => { leidos.push(rel); return 'clase Otro extiende Nodo2D:\n    cuando empieza():\n        x = verdadero\n'; },
  };
  const r = await analizarAra('clase Jugador extiende Personaje2D:\n    cuando empieza():\n        saltar(1, 2, 3)\n', 'scripts/jugador.ara', proyecto);
  assert.deepEqual(leidos, ['scripts/otro.ara'], 'solo lee los demás .ara');
  assert.equal(r.errores.length, 1); assert.equal(r.errores[0].linea, 3);
  assert.equal(r.avisos.length, 1); assert.match(r.avisos[0].mensajeCorto, /scripts\/otro\.ara \(línea 3\)/);
  assert.equal(claseParaArchivo('enemigo_volador'), 'EnemigoVolador');
  assert.equal(claseParaArchivo('sprite.ara'), 'SpriteScript');
  assert.equal(claseParaArchivo('2d'), 'Script2d');
});

test('al exportar, los scripts de Ara van compilados y el juego los carga sin el compilador', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createRequire } = await import('node:module');
  const { compilarAra } = createRequire(import.meta.url)('../src/principal/exportar.js');
  const raizApp = fileURLToPath(new URL('..', import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), 'falcon-ara-'));
  try {
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await mkdir(join(dir, 'exportado', 'juego', 'scripts'), { recursive: true });
    await mkdir(join(dir, 'generado'), { recursive: true });
    await writeFile(join(dir, 'scripts', 'jugador.ara'), JUGADOR);
    await writeFile(join(dir, 'exportado', 'juego', 'scripts', 'jugador.ara'), JUGADOR); // una exportación anterior: no cuenta
    await writeFile(join(dir, 'generado', 'x.ara'), 'esto no se compila');
    const r = await compilarAra(dir, raizApp);
    assert.ok(r.modulo instanceof Uint8Array);
    assert.deepEqual(r.descripcion.archivos.map((a) => a.clave), ['motor.ara', 'scripts/jugador.ara']);

    // El juego exportado: lee .falcon/ara.wasm y .falcon/ara.json en vez de compilar.
    const json = JSON.parse(JSON.stringify(r.descripcion));
    const salida = [];
    const proyecto = {
      datos: { nombre: 'Exportado' },
      leerBinario: async (rel) => { assert.equal(rel, '.falcon/ara.wasm'); return r.modulo; },
      leer: async (rel) => { assert.equal(rel, '.falcon/ara.json'); return JSON.stringify(json); },
    };
    const m = new Mundo({ proyecto, lienzo: {}, modo: 'exportado', alMostrar: (t) => salida.push(t) });
    m.raiz = new NodoVivo(m, escena(), null);
    m.textos = new Map([['scripts/jugador.ara', JUGADOR]]);
    m.audio = { sonar() {}, pararNodo() {} };
    const { ProgramaAra } = await import('../src/ara/puente.js');
    const crear = ProgramaAra.crear;
    ProgramaAra.crear = () => { throw new Error('no debería compilar'); };
    try { await m.compilarAra(); } finally { ProgramaAra.crear = crear; }
    m.iniciarScripts(m.raiz);
    assert.deepEqual(m.errores, []);
    assert.deepEqual(salida, ['hola desde Jugador']);

    // Con errores, la exportación se para y dice dónde.
    await writeFile(join(dir, 'scripts', 'mal.ara'), 'clase Mal extiende Nodo2D:\n    cuando empieza():\n        x = "no"\n');
    await assert.rejects(compilarAra(dir, raizApp), /scripts\/mal\.ara tiene un error en la línea 3/);
    // Sin scripts de Ara no hay nada que compilar.
    await rm(join(dir, 'scripts'), { recursive: true });
    assert.equal(await compilarAra(dir, raizApp), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('api-motor.js está al día con motor.ara', async () => {
  const { analizarMotor, miembroDe } = await import('../src/ara/api.js');
  const { API_MOTOR } = await import('../src/ara/api-motor.js');
  const api = analizarMotor(await readFile(new URL('../src/ara/motor.ara', import.meta.url), 'utf8'));
  assert.deepEqual(API_MOTOR, api, 'ejecuta «node herramientas/api-ara.mjs»');
  assert.deepEqual(miembroDe(api, 'Personaje2D', 'x'), { clave: 'Nodo.x', propiedad: 'decimal' });
  assert.deepEqual(miembroDe(api, 'Sprite', 'mover').firmas.map((f) => f.params.length), [1, 2]);
  assert.equal(miembroDe(api, 'Nodo', 'volar'), null);
  assert.deepEqual(api.eventos.recibe, [{ nombre: 'senal', tipo: 'texto' }, { nombre: 'datos', tipo: 'texto' }]);
});

test('existe, y los campos y funciones de otro nodo por su nombre (de Ara, Águila o Blueprint)', async () => {
  const aguila = 'clase Viejo extiende Nodo2D:\n    variable vida = 7\n    variable nombre_jefe = "Zor"\n    función doble(n):\n        devolver n * 2\n';
  const ara = `clase Lector extiende Nodo2D:
    cuando empieza():
        v = nodo("Viejo")
        imprimir(v.existe(), nodo("Nadie").existe())
        imprimir(v.leer_numero("vida"), v.leer_texto("nombre_jefe"), v.leer_booleano("visible"))
        v.cambiar_numero("vida", 3.0)
        imprimir(v.consultar("doble", 21.0), v.leer_numero("vida"))
        v.cambiar_texto("nombre_jefe", "Kal")
        imprimir(v.leer_numero("no_existe"))
`;
  const raiz = nodo('Nodo2D', 'Escena', {}, { hijos: [nodo('Nodo2D', 'Viejo', {}, { script: 'scripts/viejo.agl' }), nodo('Nodo2D', 'Lector', {}, { script: 'scripts/lector.ara' })] });
  const { m, salida } = await mundo({ 'scripts/viejo.agl': aguila, 'scripts/lector.ara': ara }, raiz);
  assert.deepEqual(salida, ['verdadero falso', '7.0 Zor verdadero', '42.0 3.0']);
  assert.equal(m.buscarPorNombre('Viejo').aguilaObtener('nombre_jefe'), 'Kal');
  assert.equal(m.errores.length, 1);
  assert.match(m.errores[0].mensaje, /no tiene «no_existe»/);
  assert.equal(m.errores[0].linea, 9);
});

test('al exportar, los Blueprints van compilados en el mismo módulo, y uno con errores para la exportación', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createRequire } = await import('node:module');
  const { blueprintVacio } = await import('../src/motor/blueprints.js');
  const { compilarAra } = createRequire(import.meta.url)('../src/principal/exportar.js');
  const raizApp = fileURLToPath(new URL('..', import.meta.url));
  const dir = await mkdtemp(join(tmpdir(), 'falcon-bp-'));
  try {
    await mkdir(join(dir, 'blueprints'), { recursive: true });
    const bp = blueprintVacio('puerta', 'Nodo2D');
    bp.grafos.eventos.nodos = [{ id: 'e', def: 'ev_empieza', x: 0, y: 0 }, { id: 'm', def: 'es_mostrar', x: 0, y: 0 }];
    bp.grafos.eventos.conexiones = [{ de: 'e', salida: 'salida', a: 'm', entrada: 'entrada' }];
    await writeFile(join(dir, 'blueprints', 'puerta.bp'), JSON.stringify(bp));
    const r = await compilarAra(dir, raizApp);
    assert.deepEqual(r.descripcion.archivos.map((a) => a.clave), ['motor.ara', 'generado/blueprints/puerta.ara']);
    bp.variables = [{ nombre: 'si', tipo: 'decimal', valor: 0 }];
    await writeFile(join(dir, 'blueprints', 'puerta.bp'), JSON.stringify(bp));
    await assert.rejects(compilarAra(dir, raizApp), /El Blueprint blueprints\/puerta\.bp tiene un error: La variable «si»/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('el gestor, el editor y el juego permiten compilar WebAssembly (Ara) con su política de seguridad', async () => {
  // Sin 'wasm-unsafe-eval', Electron no deja compilar el compilador ni los scripts de Ara (Node no aplica la
  // política, así que el resto de pruebas no lo vería; probar-instalado.cjs sí, con la aplicación de verdad).
  for (const pagina of ['src/gestor/gestor.html', 'src/editor/editor.html', 'src/juego/juego.html']) {
    const html = await readFile(new URL('../' + pagina, import.meta.url), 'utf8');
    const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] || '';
    const script = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) || '';
    assert.match(script, /'wasm-unsafe-eval'/, `${pagina}: script-src no permite WebAssembly`);
  }
});
