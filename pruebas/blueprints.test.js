// Pruebas del compilador de Blueprints (Blueprint → Ara).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compilarBlueprint, blueprintVacio, claseBlueprint, generadoDe, textoAra, NODOS } from '../src/motor/blueprints.js';
import { comprobarAra } from '../src/ara/puente.js';

/** El código compila con el compilador de Ara de verdad (junto a motor.ara). */
async function compila(r, rel = 'blueprints/x.bp') {
  assert.deepEqual(r.errores, []);
  assert.deepEqual(await comprobarAra({ [generadoDe(rel)]: r.codigo }), [], r.codigo);
}

function bpSalto() {
  const bp = blueprintVacio('jugador');
  bp.variables = [
    { nombre: 'velocidad', tipo: 'decimal', valor: 220, exportar: true },
    { nombre: 'salto', tipo: 'decimal', valor: 420, exportar: true },
    { nombre: 'monedas', tipo: 'entero', valor: 0 },
  ];
  bp.grafos.eventos = {
    nodos: [
      { id: 'a', def: 'ev_actualizar', x: 40, y: 40 },
      { id: 'p', def: 'in_pulsada', x: 40, y: 150, valores: { accion: 'saltar' } },
      { id: 's', def: 'mv_suelo', x: 40, y: 280 },
      { id: 'y', def: 'lg_y', x: 280, y: 210 },
      { id: 'si', def: 'lg_si', x: 420, y: 40 },
      { id: 'v', def: 'var_obtener', variable: 'salto', x: 420, y: 260 },
      { id: 'j', def: 'mv_saltar', x: 620, y: 40 },
    ],
    conexiones: [
      { de: 'a', salida: 'salida', a: 'si', entrada: 'entrada' },
      { de: 'p', salida: 'pulsada', a: 'y', entrada: 'a' },
      { de: 's', salida: 'valor', a: 'y', entrada: 'b' },
      { de: 'y', salida: 'resultado', a: 'si', entrada: 'condicion' },
      { de: 'si', salida: 'verdadero', a: 'j', entrada: 'entrada' },
      { de: 'v', salida: 'valor', a: 'j', entrada: 'fuerza' },
    ],
    comentarios: [],
  };
  return bp;
}

test('el ejemplo del salto: una clase de Ara con campos tipados y nombres sin «yo.»', async () => {
  const r = compilarBlueprint(bpSalto(), 'blueprints/jugador.bp');
  assert.equal(r.clase, 'JugadorBp');
  assert.deepEqual(r.codigo.split('\n').slice(0, 9), [
    '# Generado desde blueprints/jugador.bp · no editar a mano',
    'clase JugadorBp extiende Personaje2D:',
    '    exportar velocidad: decimal = 220.0',
    '    exportar salto: decimal = 420.0',
    '    monedas: entero = 0',
    '',
    '    cuando se_actualiza(delta):',
    '        si se_pulsa("saltar") y en_el_suelo():',
    '            saltar(salto)',
  ]);
  assert.equal(r.lineas.si, 8);
  await compila(r, 'blueprints/jugador.bp');
});

test('evento con filtro, repetir con índice, aritmética y conversiones de tipo', async () => {
  const bp = blueprintVacio('x');
  bp.variables = [{ nombre: 'monedas', tipo: 'entero', valor: 0 }];
  bp.grafos.eventos = {
    nodos: [
      { id: 'e', def: 'ev_pulsar', x: 0, y: 0, valores: { accion: 'accion' } },
      { id: 'r', def: 'lg_repetir', x: 0, y: 0, valores: { veces: 3 } },
      { id: 'm', def: 'es_mostrar', x: 0, y: 0 },
      { id: 'mul', def: 'mt_multiplicar', x: 0, y: 0 },
      { id: 'sum', def: 'mt_sumar', x: 0, y: 0, valores: { b: 2 } },
      { id: 'vs', def: 'var_sumar', variable: 'monedas', x: 0, y: 0, valores: { cantidad: 1.5 } },
    ],
    conexiones: [
      { de: 'e', salida: 'salida', a: 'r', entrada: 'entrada' },
      { de: 'r', salida: 'cuerpo', a: 'm', entrada: 'entrada' },
      { de: 'r', salida: 'indice', a: 'sum', entrada: 'a' },
      { de: 'sum', salida: 'resultado', a: 'mul', entrada: 'a' },
      { de: 'mul', salida: 'resultado', a: 'm', entrada: 'texto' },
      { de: 'r', salida: 'salida', a: 'vs', entrada: 'entrada' },
    ],
  };
  const r = compilarBlueprint(bp, 'x.bp');
  assert.deepEqual(r.codigo.split('\n').filter((l) => l.startsWith('        ') || l.includes('cuando')), [
    '    cuando se_pulsa("accion"):',
    '        para vuelta en rango(3):',
    '            imprimir((vuelta + 2.0) * 1.0)',
    '        monedas += 1', // un número fijo en una variable entera se escribe ya entero
  ]);
  await compila(r, 'x.bp');
});

test('funciones con parámetros y retorno deducidos, condiciones y textos', async () => {
  const bp = blueprintVacio('x', 'Nodo2D');
  bp.variables = [{ nombre: 'vida', tipo: 'decimal', valor: 10 }, { nombre: 'nombre_visible', tipo: 'texto', valor: 'a{b}"c' }];
  bp.funciones = [{ nombre: 'doble', params: [{ nombre: 'n', tipo: 'cualquiera' }] }];
  bp.grafos.eventos = {
    nodos: [
      { id: 'e', def: 'ev_empieza', x: 0, y: 0 },
      { id: 'si', def: 'lg_si', x: 0, y: 0 },
      { id: 'v', def: 'var_obtener', variable: 'vida', x: 0, y: 0 },
      { id: 'u', def: 'tx_unir', x: 0, y: 0, valores: { a: 'Vida: ' } },
      { id: 'f', def: 'tx_fijar', x: 0, y: 0 },
      { id: 'c', def: 'ob_consultar', x: 0, y: 0, valores: { miembro: 'doble', cantidad: '1', a: 4 } },
    ],
    conexiones: [
      { de: 'e', salida: 'salida', a: 'si', entrada: 'entrada' },
      { de: 'v', salida: 'valor', a: 'si', entrada: 'condicion' },
      { de: 'si', salida: 'verdadero', a: 'f', entrada: 'entrada' },
      { de: 'c', salida: 'valor', a: 'u', entrada: 'b' },
      { de: 'u', salida: 'resultado', a: 'f', entrada: 'texto' },
    ],
  };
  bp.grafos['fn:doble'] = {
    nodos: [
      { id: 'fe', def: 'fn_entrada', funcion: 'doble', x: 0, y: 0 },
      { id: 'm', def: 'mt_multiplicar', x: 0, y: 0, valores: { b: 2 } },
      { id: 'd', def: 'fn_devolver', x: 0, y: 0 },
    ],
    conexiones: [
      { de: 'fe', salida: 'salida', a: 'd', entrada: 'entrada' },
      { de: 'fe', salida: 'n', a: 'm', entrada: 'a' },
      { de: 'm', salida: 'resultado', a: 'd', entrada: 'valor' },
    ],
  };
  const r = compilarBlueprint(bp, 'blueprints/x.bp');
  assert.ok(r.codigo.includes('    nombre_visible: texto = "a{{b}}\\"c"\n'), r.codigo);
  assert.ok(r.codigo.includes('        si vida != 0:\n            nodo("Marcador").texto = "Vida: " + texto(doble(4.0))\n'), r.codigo);
  assert.ok(r.codigo.includes('    func doble(n: decimal) -> decimal:\n        devolver n * 2.0\n'), r.codigo);
  await compila(r);
});

test('otros nodos: propiedades del motor, variables de su script y funciones por su nombre', async () => {
  const bp = blueprintVacio('x', 'Nodo3D');
  bp.grafos.eventos = {
    nodos: [
      { id: 'e', def: 'ev_tocar', x: 0, y: 0 },
      { id: 'si', def: 'lg_si', x: 0, y: 0 },
      { id: 'c', def: 'lg_comparar', x: 0, y: 0, valores: { op: '>', b: 3 } },
      { id: 'l', def: 'ob_leer', x: 0, y: 0, valores: { miembro: 'vida' } },
      { id: 'z', def: 'ob_leer', x: 0, y: 0, valores: { miembro: 'z' } },
      { id: 'f', def: 'ob_fijar', x: 0, y: 0, valores: { miembro: 'estado', valor: 'herido' } },
      { id: 'k', def: 'ob_llamar', x: 0, y: 0, valores: { miembro: 'recibir_dano', cantidad: '1', a: 10 } },
      { id: 'y', def: 'ob_fijar', x: 0, y: 0, valores: { miembro: 'y' } },
    ],
    conexiones: [
      { de: 'e', salida: 'salida', a: 'si', entrada: 'entrada' },
      { de: 'e', salida: 'otro', a: 'l', entrada: 'objeto' },
      { de: 'l', salida: 'valor', a: 'c', entrada: 'a' },
      { de: 'c', salida: 'resultado', a: 'si', entrada: 'condicion' },
      { de: 'si', salida: 'verdadero', a: 'f', entrada: 'entrada' },
      { de: 'e', salida: 'otro', a: 'f', entrada: 'objeto' },
      { de: 'f', salida: 'salida', a: 'k', entrada: 'entrada' },
      { de: 'e', salida: 'otro', a: 'k', entrada: 'objeto' },
      { de: 'k', salida: 'salida', a: 'y', entrada: 'entrada' },
      { de: 'z', salida: 'valor', a: 'y', entrada: 'valor' },
    ],
  };
  const r = compilarBlueprint(bp, 'x.bp');
  assert.deepEqual(r.codigo.trim().split('\n').slice(3), [
    '    cuando toca(otro):',
    '        si otro.leer_numero("vida") > 3.0:',
    '            otro.cambiar_texto("estado", "herido")',
    '            otro.llamar("recibir_dano", 10.0)',
    '            yo.y = yo.z',
  ]);
  await compila(r, 'x.bp');
});

test('errores claros en el bloque: tipos que no encajan, miembros que no existen, nombres reservados', () => {
  const bp = blueprintVacio('x', 'Nodo2D');
  bp.variables = [{ nombre: 'si', tipo: 'decimal', valor: 0 }, { nombre: 'jefe', tipo: 'objeto', valor: 'Jefe' }, { nombre: 'n', tipo: 'decimal', valor: 1 }];
  bp.grafos.eventos = {
    nodos: [
      { id: 'e', def: 'ev_empieza', x: 0, y: 0 },
      { id: 'f', def: 'var_fijar', variable: 'n', x: 0, y: 0 },
      { id: 'j', def: 'var_obtener', variable: 'jefe', x: 0, y: 0 },
      { id: 'k', def: 'ob_llamar', x: 0, y: 0, valores: { miembro: 'volar', cantidad: '0' } },
      { id: 'm', def: 'ob_llamar', x: 0, y: 0, valores: { miembro: 'mover', cantidad: '3', a: 1, b: 2, c: 3 } },
    ],
    conexiones: [
      { de: 'e', salida: 'salida', a: 'f', entrada: 'entrada' },
      { de: 'j', salida: 'valor', a: 'f', entrada: 'valor' },
      { de: 'f', salida: 'salida', a: 'k', entrada: 'entrada' },
      { de: 'k', salida: 'salida', a: 'm', entrada: 'entrada' },
    ],
  };
  const r = compilarBlueprint(bp, 'x.bp');
  assert.deepEqual(r.errores.map((e) => [e.nodo, e.mensaje]), [
    [null, 'La variable «si» no puede llamarse así: es una palabra de Ara. Cámbiale el nombre.'],
    ['f', '«valor» necesita un número, pero llega un objeto.'],
    ['k', 'Este nodo no tiene ningún método ni función «volar».'],
    ['m', '«mover» recibe 1 o 2 dato(s), no 3.'],
  ]);
});

test('evento vacío genera pasar y aviso; un Blueprint vacío es una clase vacía', async () => {
  const bp = blueprintVacio('x');
  bp.grafos.eventos.nodos = [{ id: 'e', def: 'ev_empieza', x: 0, y: 0 }];
  const r = compilarBlueprint(bp, 'x.bp');
  assert.ok(r.codigo.includes('    cuando empieza():\n        pasar'), r.codigo);
  assert.equal(r.avisos.length, 1);
  const vacio = compilarBlueprint(blueprintVacio('v', 'Sprite'), 'blueprints/v.bp');
  assert.equal(vacio.codigo, '# Generado desde blueprints/v.bp · no editar a mano\nclase VBp extiende Sprite:\n    pasar\n');
  await compila(vacio, 'blueprints/v.bp');
});

test('nombres: clases, archivos generados y textos de Ara', () => {
  assert.equal(claseBlueprint('blueprints/enemigo_volador.bp'), 'EnemigoVoladorBp');
  assert.equal(claseBlueprint('blueprints/jefes/final.bp'), 'JefesFinalBp');
  assert.equal(claseBlueprint('2d.bp'), 'B2dBp');
  assert.equal(generadoDe('blueprints/jefes/final.bp'), 'generado/blueprints/jefes/final.ara');
  assert.equal(textoAra('a{b}\n"\\'), '"a{{b}}\\n\\"\\\\"');
});

test('todos los bloques del catálogo se compilan a Ara (los de acción en un evento, los de datos mostrados)', async () => {
  const bp = blueprintVacio('todo', 'Personaje2D');
  const nodos = [{ id: 'ev', def: 'ev_empieza', x: 0, y: 0 }], conexiones = [];
  let anterior = 'ev';
  for (const [id, d] of Object.entries(NODOS)) {
    if (d.esEvento || d.flujo || ['var_obtener', 'var_fijar', 'var_sumar', 'fn_llamar', 'fn_devolver', 'ob_fijar', 'ob_leer', 'ob_llamar', 'ob_consultar'].includes(id)) continue;
    if (d.exec) {
      nodos.push({ id, def: id, x: 0, y: 0 });
      conexiones.push({ de: anterior, salida: 'salida', a: id, entrada: 'entrada' });
      anterior = id;
    } else {
      const m = 'm_' + id;
      nodos.push({ id, def: id, x: 0, y: 0 }, { id: m, def: 'es_mostrar', x: 0, y: 0 });
      conexiones.push({ de: anterior, salida: 'salida', a: m, entrada: 'entrada' }, { de: id, salida: d.salidas[0].n, a: m, entrada: 'texto' });
      anterior = m;
    }
  }
  bp.grafos.eventos = { nodos, conexiones };
  const r = compilarBlueprint(bp, 'blueprints/todo.bp');
  await compila(r, 'blueprints/todo.bp');
});
