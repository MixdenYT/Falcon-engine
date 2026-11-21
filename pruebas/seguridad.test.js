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
