// El conversor de Águila a Ara (src/ara/convertir.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import './dom.js';
import { convertirAguila, convertirProyecto, necesitaConversion, claseDeArchivo } from '../src/ara/convertir.js';
import { comprobarAra } from '../src/ara/puente.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { plantillaShooter } from '../src/motor/shooters.js';

const carpeta = new URL('./aguila/', import.meta.url);
const antiguo = async (n) => readFile(new URL(n + '.agl', carpeta), 'utf8');
const BASES = { moneda: 'Area2D', peligro: 'Area2D', enemigo: 'Personaje2D', meta: 'Area2D', contador: 'Etiqueta', nivel: 'Nodo2D', jugador_escrito: 'Personaje2D', gema: 'Area2D', babosa: 'Personaje2D', jugador_cajas: 'Personaje2D', antorcha: 'Luz3D', menu: 'Nodo2D', ciclo_dia: 'Luz3D', orbita: 'Luz3D', zona: 'Etiqueta', jugador_shooter: 'Personaje3D', enemigo_shooter: 'Personaje3D', bandada: 'Nodo2D' };

/** Convierte un trozo de Águila (dentro de una clase) y devuelve el código, o falla con sus problemas. */
function ara(agl, op = {}) {
  const r = convertirAguila(agl, { archivo: 'scripts/prueba.agl', base: 'Nodo2D', ...op });
  assert.ok(r.ok, JSON.stringify(r.problemas));
  return r.codigo;
}

test('los scripts de Águila de Falcon 1.2 (y una bandada con listas y bucles) se convierten a Ara que compila', async () => {
  const nombres = (await readdir(carpeta)).filter((f) => f.endsWith('.agl')).map((f) => f.slice(0, -4));
  assert.equal(nombres.length, 18);
  for (const n of nombres) {
    const r = convertirAguila(await antiguo(n), { archivo: `scripts/${n}.agl`, base: BASES[n], nodos: ['Jugador', 'Muros', 'Entorno', 'Estado', 'Aviso', 'Instrucciones', 'Objetivo'] });
    assert.ok(r.ok, `${n}: ${JSON.stringify(r.problemas)}`);
    assert.deepEqual(await comprobarAra({ [`scripts/${n}.ara`]: r.codigo }), [], `${n}:\n${r.codigo}`);
  }
});

test('reglas: clase y campos, nulo, puntos, bucles, matemáticas, textos y nombres que chocan', () => {
  const codigo = ara(`# moneda.agl · se recoge
variable vida = 3
exportar variable velocidad = 90

función curar(n):
    vida = vida + n * 0.5

cuando toca(otro):
    # el jugador
    si otro != nulo y otro.vida > 2:
        puntos = puntos + 1
        mostrar("tocado {raro}", vida)
    para cada g en grupo("gemas"):
        g.eliminar()
    repetir 3 veces:
        mostrar(min(vida, 2), aleatorio(1, 5), redondear(vida, 2), 2 ** 3)
    variable x = 1
    x = x + 1
`);
  assert.equal(codigo, `# moneda.ara · se recoge
# (convertido de Águila por Falcon Engine)
clase Prueba extiende Nodo2D:
    vida = 3.0
    exportar velocidad = 90

    cuando toca(otro):
        # el jugador
        si otro.existe() y otro.leer_numero("vida") > 2.0:
            poner_puntos(puntos() + 1)
            imprimir("tocado {{raro}}", texto_numero(vida))
        para g en grupo("gemas"):
            g.eliminar()
        para vuelta en rango(3):
            imprimir(texto_numero(minimo(vida, 2.0)), texto_numero(1.0 + aleatorio() * (5.0 - 1.0)), texto_numero(decimal(redondear(vida * 100.0)) / 100.0), texto_numero(potencia(2.0, 3.0)))
        x_local = 1
        x_local = x_local + 1

    func curar(n: decimal):
        vida = vida + n * 0.5
`);
});

test('lo que no se puede convertir lo dice con su línea', () => {
  const no = (agl, frase) => {
    const r = convertirAguila(agl, { archivo: 'x.agl' });
    assert.equal(r.ok, false);
    assert.match(r.problemas[0].mensaje, frase, JSON.stringify(r.problemas));
    return r.problemas[0];
  };
  assert.equal(no('cuando empieza():\n    despues(3, empieza)\n', /despues/).linea, 2);
  no('variable d = {"a": 1}\n', /diccionario/);
  no('mostrar("suelto")\n', /órdenes sueltas/);
  no('cuando empieza():\n    volar()\n', /«volar\(\)», que no existe/);
  no('cuando empieza():\n    mostrar(fantasma)\n', /no sé qué es «fantasma»/);
  no('cuando empieza(\n', /no es Águila válido/);
});

test('nombres de clase: el del archivo, sin chocar con los tipos de nodo', () => {
  assert.equal(claseDeArchivo('scripts/enemigo_volador.agl'), 'EnemigoVolador');
  assert.equal(claseDeArchivo('scripts/sprite.agl'), 'SpriteScript');
  assert.ok(necesitaConversion(['scripts/a.agl']));
  assert.ok(!necesitaConversion(['scripts/a.ara', '.falcon/copia-aguila-x/scripts/a.agl']));
});

/** Un juego de prueba: el shooter de la plantilla con los scripts que se den. */
async function shooter(scripts) {
  const s = plantillaShooter('Prueba');
  const escena = structuredClone(s.archivos['escenas/base_abierta.fscn']);
  const ext = Object.keys(scripts)[0].endsWith('.agl') ? '.agl' : '.ara';
  const cambiar = (n) => { if (n.script) n.script = n.script.replace(/\.ara$/, ext); for (const h of n.hijos || []) cambiar(h); };
  cambiar(escena.raiz);
  const m = new Mundo({ proyecto: { datos: s.datos }, lienzo: {} });
  m.raiz = new NodoVivo(m, escena.raiz, null); m.indiceSucio = true;
  m.textos = new Map(Object.entries(scripts));
  m.audio = { sonar() {}, pararNodo() {} };
  m.d3 = { posicionGlobal: (n) => n.props.posicion, lineaVision: () => true, quitar() {}, fijarPosicionGlobal(n, ...p) { n.props.posicion = p; } };
  await m.compilarAra();
  m.iniciarScripts(m.raiz);
  return m;
}

/** Juega una partida corta y anota lo que pasa. */
function partida(m) {
  const j = m.buscarPorNombre('Jugador'), notas = [];
  const nota = () => notas.push(['vida', 'municion', 'reserva', 'bajas'].map((k) => j.aguilaObtener(k)).join(' ') + ' ' + m.buscarPorNombre('Estado').props.texto);
  m.emitirNodo(j, 'se_pulsa', ['accion']);
  const drone = m.grupo('enemigos')[0];
  m.d3.dispararRayo = () => drone;
  m.entrada.estado.set('disparar', true);
  for (let i = 0; i < 4; i++) { m.emitirNodo(j, 'se_actualiza', [0.23]); nota(); }
  for (const e of m.grupo('enemigos')) m.emitirNodo(e, 'se_actualiza', [2]);
  nota();
  return notas;
}

test('el shooter convertido juega igual que el de Águila', async () => {
  const [jugador, enemigo] = [await antiguo('jugador_shooter'), await antiguo('enemigo_shooter')];
  const conv = (t, n) => convertirAguila(t, { archivo: `scripts/${n}.agl`, base: 'Personaje3D', clase: n === 'jugador' ? 'Jugador' : 'Enemigo', nodos: ['Aviso', 'Estado', 'Objetivo', 'Instrucciones'] }).codigo;
  const conAguila = await shooter({ 'scripts/jugador.agl': jugador, 'scripts/enemigo.agl': enemigo });
  const conAra = await shooter({ 'scripts/jugador.ara': conv(jugador, 'jugador'), 'scripts/enemigo.ara': conv(enemigo, 'enemigo') });
  assert.deepEqual(conAguila.errores, []); assert.deepEqual(conAra.errores, []);
  const a = partida(conAguila), b = partida(conAra);
  assert.deepEqual(b, a);
  assert.match(a[0], /VIDA \/ HP 100 /, 'el texto del marcador no cambia (sin «100.0»)');
  assert.ok(conAra.buscarPorNombre('Jugador').scripts[0].programa, 'el jugador va en Ara');
});

test('convertirProyecto: copia, convierte, cambia las escenas, deja en Águila lo imposible y escribe el informe', async () => {
  const disco = new Map(Object.entries({
    'proyecto.falcon': '{}',
    'escenas/nivel.fscn': JSON.stringify({ raiz: { tipo: 'Nodo2D', nombre: 'Nivel', hijos: [
      { tipo: 'Area2D', nombre: 'Moneda', script: 'scripts/moneda.agl', hijos: [] },
      { tipo: 'Personaje2D', nombre: 'Jugador', script: 'scripts/raro.agl', hijos: [] },
    ] } }),
    'scripts/moneda.agl': await antiguo('moneda'),
    'scripts/raro.agl': 'cuando empieza():\n    despues(1, empieza)\n',
    'scripts/otra.ara': 'clase Moneda extiende Nodo2D:\n    pasar\n',
    'generado/blueprints/viejo.agl': 'cuando empieza():\n    pasar\n',
  }));
  const borrados = [];
  const r = await convertirProyecto({
    archivos: [...disco.keys()], fecha: '2026-11-08-12-00-00',
    leer: async (k) => disco.get(k), escribir: async (k, v) => disco.set(k, v), borrar: async (k) => { borrados.push(k); disco.delete(k); },
    comprobar: (t) => comprobarAra(t), clasesBlueprint: ['JugadorBp'],
  });
  assert.deepEqual(r.convertidos, [{ agl: 'scripts/moneda.agl', ara: 'scripts/moneda.ara', clase: 'Moneda2' }], 'Moneda ya existe: otra clase');
  assert.equal(r.quedan[0].agl, 'scripts/raro.agl');
  assert.deepEqual(borrados, ['scripts/moneda.agl', 'generado/blueprints/viejo.agl']);
  assert.ok(disco.get('.falcon/copia-aguila-2026-11-08-12-00-00/scripts/moneda.agl').includes('ganar_puntos'));
  assert.ok(disco.has('.falcon/copia-aguila-2026-11-08-12-00-00/escenas/nivel.fscn'));
  const escena = JSON.parse(disco.get('escenas/nivel.fscn'));
  assert.deepEqual(escena.raiz.hijos.map((n) => n.script), ['scripts/moneda.ara', 'scripts/raro.agl']);
  assert.match(disco.get('scripts/moneda.ara'), /^clase Moneda2 extiende Area2D:$/m);
  assert.match(disco.get('CONVERSION_ARA.md'), /`scripts\/raro\.agl`: línea 2: usa despues/);
  assert.deepEqual(await comprobarAra(new Map([...disco].filter(([k]) => k.endsWith('.ara')))), []);
});
