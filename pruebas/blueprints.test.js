// Pruebas del compilador de Blueprints.
import { compilarBlueprint, blueprintVacio } from '../src/motor/blueprints.js';
import { analizar } from '../src/aguila/index.js';

let ok = 0, mal = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; } catch (e) { mal++; console.log('✗', nombre, '\n   ', e.message); }
}
function igual(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperaba ${JSON.stringify(b)}\n    obtuve   ${JSON.stringify(a)}`); }

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

prueba('compila el ejemplo del salto', () => {
  const r = compilarBlueprint(bpSalto(), 'jugador.bp');
  igual(r.errores, []);
  igual(r.codigo.split('\n').slice(0, 9), [
    '# Generado desde jugador.bp · no editar a mano',
    'exportar variable velocidad = 220',
    'exportar variable salto = 420',
    'variable monedas = 0',
    '',
    'cuando se_actualiza(delta):',
    '    si se_pulsa("saltar") y en_el_suelo():',
    '        saltar(salto)',
    '',
  ]);
  igual(r.lineas.si, 7);
  igual(analizar(r.codigo).errores.length, 0);
});

prueba('evento con filtro, repetir con índice y aritmética con paréntesis', () => {
  const bp = blueprintVacio('x');
  bp.variables = [{ nombre: 'monedas', tipo: 'entero', valor: 0 }];
  bp.grafos.eventos = {
    nodos: [
      { id: 'e', def: 'ev_pulsar', x: 0, y: 0, valores: { accion: 'accion' } },
      { id: 'r', def: 'lg_repetir', x: 0, y: 0, valores: { veces: 3 } },
      { id: 'm', def: 'es_mostrar', x: 0, y: 0 },
      { id: 'mul', def: 'mt_multiplicar', x: 0, y: 0 },
      { id: 'sum', def: 'mt_sumar', x: 0, y: 0, valores: { b: 2 } },
      { id: 'vs', def: 'var_sumar', variable: 'monedas', x: 0, y: 0, valores: { cantidad: 1 } },
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
  igual(r.errores, []);
  const cuerpo = r.codigo.split('\n').filter(l => l.startsWith('    ') || l.startsWith('cuando'));
  igual(cuerpo, [
    'cuando se_pulsa("accion"):',
    '    para cada vuelta en rango(3):',
    '        mostrar((vuelta + 2) * 1)',
    '    monedas = monedas + 1',
  ]);
  igual(analizar(r.codigo).errores.length, 0);
});

prueba('evento vacío genera pasar y aviso', () => {
  const bp = blueprintVacio('x');
  bp.grafos.eventos.nodos = [{ id: 'e', def: 'ev_empieza', x: 0, y: 0 }];
  const r = compilarBlueprint(bp);
  if (!r.codigo.includes('cuando empieza():\n    pasar')) throw new Error(r.codigo);
  igual(r.avisos.length, 1);
});

console.log(`Blueprints: ${ok} pruebas correctas, ${mal} fallidas`);
if (mal) process.exitCode = 1;
