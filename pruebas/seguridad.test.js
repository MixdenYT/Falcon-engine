// Pruebas de seguridad: datos de proyectos ajenos (C1) y rutas del protocolo falcon:// (A2). Ver docs/SECURITY.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { normalizarNodo, valoresPorDefecto } from '../src/motor/tipos.js';
import { normalizarEscena } from '../src/motor/proyecto.js';

const { rutaDeUrl } = createRequire(import.meta.url)('../src/principal/rutas.js');
const HTML = '1"><img src=x onerror="alert(1)">';

test('normalizarNodo descarta valores de tipo incorrecto y deja los válidos', () => {
  const def = valoresPorDefecto('Personaje2D');
  const n = normalizarNodo({
    id: 'x" onmouseover="alert(1)', tipo: 'Personaje2D', nombre: 42, script: { a: 1 }, blueprint: ['b'], visible: 'no',
    grupos: ['enemigos', { malo: 1 }], senales: [null, { evento: 'toca' }], exportados: 'x',
    props: { velocidad: HTML, salto: '300', usa_gravedad: 'false', posicion: [HTML, 5, 7], escala: 'grande', color: 7, z: Infinity, extra: 'se conserva' },
  });
  assert.match(n.id, /^[\w.-]+$/);
  assert.equal(typeof n.nombre, 'string');
  assert.equal(n.script, null);
  assert.equal(n.blueprint, null);
  assert.equal(n.visible, true);
  assert.deepEqual(n.grupos, ['enemigos']);
  assert.deepEqual(n.senales, [{ evento: 'toca' }]);
  assert.deepEqual(n.exportados, {});
  assert.equal(n.props.velocidad, def.velocidad);
  assert.equal(n.props.salto, 300);
  assert.equal(n.props.usa_gravedad, def.usa_gravedad);
  assert.deepEqual(n.props.posicion, [def.posicion[0], 5]);
  assert.deepEqual(n.props.escala, def.escala);
  assert.equal(n.props.z, def.z);
  assert.equal(n.props.extra, 'se conserva');
});

test('normalizarNodo mantiene un nodo válido tal cual', () => {
  const nodo = { id: 'n1', tipo: 'Etiqueta', nombre: 'Marcador', script: 'scripts/a.ara', blueprint: null, visible: false, grupos: ['ui'], senales: [], exportados: { vidas: 3 },
    props: { texto: '<b>no es HTML</b>', posicion: [10, 20] }, hijos: [] };
  const n = normalizarNodo(structuredClone(nodo));
  for (const k of ['id', 'tipo', 'nombre', 'script', 'blueprint', 'visible', 'grupos', 'exportados']) assert.deepEqual(n[k], nodo[k], k);
  assert.equal(n.props.texto, nodo.props.texto);
  assert.deepEqual(n.props.posicion, [10, 20]);
});

test('normalizarEscena valida los hijos y el tipo de escena', () => {
  const e = normalizarEscena(JSON.stringify({ tipo: HTML, raiz: { tipo: 'Nodo2D', hijos: [null, { tipo: 'Sprite', props: { opacidad: HTML } }] } }));
  assert.equal(e.tipo, '2D');
  assert.equal(e.raiz.hijos.length, 2);
  assert.equal(e.raiz.hijos[1].props.opacidad, valoresPorDefecto('Sprite').opacidad);
});

test('falcon://app no sale de la carpeta de la aplicación', () => {
  const raiz = path.resolve('/falcon/app');
  assert.equal(rutaDeUrl('falcon://app/src/editor/editor.html', raiz), path.join(raiz, 'src/editor/editor.html'));
  assert.equal(rutaDeUrl('falcon://app/src/a%20b.png', raiz), path.join(raiz, 'src/a b.png'));
  for (const u of ['falcon://app/..%2f..%2fsecreto.txt', 'falcon://app/src/..%2F..%2F..%2Fsecreto.txt', 'falcon://app/..%5c..%5csecreto.txt',
    'falcon://app/..%2fapp-otra%2fx', 'falcon://app/%E0%A4%A']) assert.equal(rutaDeUrl(u, raiz), null, u);
  assert.equal(rutaDeUrl('falcon://otro/x', raiz), null);
});

test('falcon://fs da la ruta absoluta en cada plataforma', () => {
  assert.equal(rutaDeUrl('falcon://fs/C:/Juegos/mi%20juego/a.png', '/x', true), 'C:/Juegos/mi juego/a.png');
  assert.equal(rutaDeUrl('falcon://fs/home/u/a.png', '/x', false), '/home/u/a.png');
});

test('las CSP no permiten script en línea y su hash coincide con el import map', () => {
  for (const pagina of ['editor/editor.html', 'gestor/gestor.html', 'juego/juego.html']) {
    const html = readFileSync(new URL(`../src/${pagina}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
    const scriptSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'));
    assert.ok(!scriptSrc.includes('unsafe-inline'), pagina);
    const mapa = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1];
    assert.ok(scriptSrc.includes(`'sha256-${createHash('sha256').update(mapa).digest('base64')}'`), `${pagina}: actualiza el hash del import map en la CSP`);
    assert.ok(!/\son[a-z]+=/.test(html), pagina);
  }
});

// ---- A1: permisos del IPC (src/principal/rutas.js) ----
const R = createRequire(import.meta.url)('../src/principal/rutas.js');

test('dentroDe en Windows: mayúsculas, unidades, .., prefijos y rutas raras', () => {
  const W = (a, b) => R.dentroDe(a, b, true), r = String.raw;
  const raiz = r`C:\Proyectos\Juego`;
  assert.ok(W(raiz, raiz));
  assert.ok(W(raiz, 'c:/proyectos/JUEGO/sprites/a.png'));
  assert.ok(W('c:/proyectos/juego/', r`C:\Proyectos\Juego\x`));
  assert.ok(W('C:/', r`C:\Windows\win.ini`));
  assert.ok(!W(raiz, r`C:\Proyectos\Juego2\a.png`));
  assert.ok(!W(raiz, r`C:\Proyectos\Juego\..\..\Windows\win.ini`));
  assert.ok(!W(raiz, 'C:/Windows/win.ini'));
  assert.ok(!W(raiz, r`D:\Proyectos\Juego\a.png`));
  assert.ok(!W(raiz, r`C:\Proyectos\Juego:secreto`));
  assert.ok(!W(raiz, r`\\?\C:\Proyectos\Juego\a.png`));
  assert.ok(!W(raiz, r`\\servidor\c$\Proyectos\Juego`));
});

test('dentroDe en Linux distingue mayúsculas y no deja salir con ..', () => {
  const L = (a, b) => R.dentroDe(a, b, false);
  assert.ok(L('/home/u/juego', '/home/u/juego/a.png'));
  assert.ok(!L('/home/u/juego', '/home/u/Juego/a.png'));
  assert.ok(!L('/home/u/juego', '/home/u/juego/../.ssh/id_rsa'));
  assert.ok(!L('/home/u/juego', '/home/u/juego-otro'));
});

test('rutaReal sigue enlaces y uniones, también si el archivo aún no existe', async () => {
  const { mkdtempSync, mkdirSync, symlinkSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const base = R.rutaReal(mkdtempSync(path.join(tmpdir(), 'falcon-seg-')));
  try {
    const proyecto = path.join(base, 'proyecto'), fuera = path.join(base, 'fuera');
    mkdirSync(proyecto); mkdirSync(fuera);
    const enlace = path.join(proyecto, 'enlace');
    symlinkSync(fuera, enlace, 'junction'); // una unión no pide permisos de administrador en Windows
    const raices = [{ ruta: proyecto, escritura: true }];
    assert.ok(R.permitida(raices, R.rutaReal(path.join(proyecto, 'nuevo', 'a.txt'))));
    assert.equal(R.rutaReal(path.join(enlace, 'nuevo.txt')), path.join(fuera, 'nuevo.txt'));
    assert.ok(!R.permitida(raices, R.rutaReal(path.join(enlace, 'secreto.txt'))));
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('permitida y puedeBorrar respetan lectura, escritura y la raíz', () => {
  const w = process.platform === 'win32';
  const P = (s) => path.resolve(s);
  const raices = [{ ruta: P('/p/juego'), escritura: true }, { ruta: P('/descargas/a.png'), escritura: false },
    { ruta: P('/p/reciente'), escritura: true, proyecto: true }];
  assert.ok(R.permitida(raices, P('/p/juego/x.fscn'), true, w));
  assert.ok(R.permitida(raices, P('/descargas/a.png'), false, w));
  assert.ok(!R.permitida(raices, P('/descargas/a.png'), true, w));
  assert.ok(!R.permitida(raices, P('/descargas/b.png'), false, w));
  assert.ok(!R.permitida([], P('/p/juego/x'), false, w));
  assert.ok(R.puedeBorrar(raices, P('/p/juego/sprites'), false, w));
  assert.ok(!R.puedeBorrar(raices, P('/p/juego'), true, w), 'nunca la raíz del proyecto abierto');
  assert.ok(!R.puedeBorrar(raices, P('/descargas/a.png'), false, w), 'solo lectura');
  assert.ok(R.puedeBorrar(raices, P('/p/reciente'), true, w), 'un proyecto reciente desde el gestor');
  assert.ok(!R.puedeBorrar(raices, P('/p/reciente'), false, w), 'si no contiene un proyecto, no');
  assert.ok(!R.puedeBorrar(raices, P('/p'), true, w));
});

test('paginaDe solo reconoce nuestras páginas en falcon://app', () => {
  assert.equal(R.paginaDe('falcon://app/src/editor/editor.html?proyecto=C:/x'), 'editor');
  assert.equal(R.paginaDe('falcon://app/src/gestor/gestor.html'), 'gestor');
  assert.equal(R.paginaDe('falcon://app/src/juego/juego.html?modo=prueba'), 'juego');
  for (const u of ['falcon://fs/C:/x/src/editor/editor.html', 'file:///C:/app/src/editor/editor.html', 'https://app/src/editor/editor.html',
    'falcon://app/src/editor/otra.html', 'falcon://app/proyecto/editor.html', '', 'no es url', undefined]) assert.equal(R.paginaDe(u), null, String(u));
});

test('urlExterna solo deja abrir páginas web', () => {
  for (const u of ['https://mixden.net/', 'https://github.com/MixdenYT/Falcon-engine/issues', 'http://localhost:8080/']) assert.ok(R.urlExterna(u), u);
  for (const u of ['file:///C:/Windows/System32/calc.exe', 'FILE:///C:/x.exe', 'javascript:alert(1)', 'ms-settings:', 'search-ms:query=x',
    'smb://servidor/c$', String.raw`\\servidor\c$\x.exe`, 'C:/Windows/notepad.exe', 'falcon://app/x', 'mailto:a@b.c', '', null]) assert.ok(!R.urlExterna(u), String(u));
});

test('datosSaneados: la página no añade recientes ni cambia la carpeta de proyectos a su antojo', () => {
  const actual = { recientes: [{ ruta: 'C:/p/a', nombre: 'A' }, { ruta: 'C:/p/b', nombre: 'B' }], ajustes: { carpetaProyectos: 'C:/p', cuadricula: 32 } };
  const nada = () => false;
  const d = R.datosSaneados({ recientes: [{ ruta: 'C:/p/b', nombre: '<img onerror>' }, { ruta: 'C:/Windows' }, { ruta: 'C:/p/b' }],
    ajustes: { carpetaProyectos: 'C:/Windows', cuadricula: 16 } }, actual, nada);
  assert.deepEqual(d.recientes, [actual.recientes[1]]);
  assert.equal(d.ajustes.carpetaProyectos, 'C:/p');
  assert.equal(d.ajustes.cuadricula, 16);
  assert.equal(R.datosSaneados({ ajustes: { carpetaProyectos: 'D:/elegida' } }, actual, (c) => c === 'D:/elegida').ajustes.carpetaProyectos, 'D:/elegida');
  assert.deepEqual(R.datosSaneados('basura', actual, nada).ajustes, actual.ajustes);
  assert.ok(!('carpetaProyectos' in R.datosSaneados({ ajustes: { carpetaProyectos: 'C:/x' } }, {}, nada).ajustes));
});

test('los juegos usan el preload reducido y lo llevan al exportar', () => {
  const leer = (f) => readFileSync(new URL(`../src/principal/${f}`, import.meta.url), 'utf8');
  const reducido = leer('preload-juego.js');
  for (const prohibido of ['escribir', 'borrar', 'renombrar', 'copiar', 'dialogo', 'sistema', 'abrirUrl', 'exportar', 'guardarDatos', 'abrirProyecto', 'actualizaciones'])
    assert.ok(!reducido.includes(prohibido), prohibido);
  assert.match(leer('jugador.js'), /preload-juego\.js/);
  assert.match(leer('exportar.js'), /'src\/principal\/preload-juego\.js', 'src\/principal\/rutas\.js'/);
  assert.match(leer('main.js'), /preferenciasWeb\('preload-juego\.js'\)/);
});
