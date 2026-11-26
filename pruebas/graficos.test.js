import test from 'node:test';
import assert from 'node:assert/strict';
import { AjusteAutomatico, leerEstadisticasRenderer } from '../src/motor/graficos.js';

function medirVentana(ajuste, nivel, fps, segundos = 4) {
  const dt = 1 / fps;
  const cuadros = Math.round(fps * segundos);
  for (let i = 0; i < cuadros; i++) ajuste.medir(dt, nivel);
}

test('la calidad automática reduce un nivel cuando el rendimiento cae por debajo de 42 FPS', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.medir(3.1, 'alta'); // calentamiento inicial
  medirVentana(ajuste, 'alta', 40);
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0][0], 'media');
  assert.ok(cambios[0][1] < 42);
});

test('la calidad automática recupera un nivel después de mantener más de 58 FPS', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.medir(3.1, 'alta');
  medirVentana(ajuste, 'alta', 40);
  assert.equal(cambios[0][0], 'media');

  ajuste.medir(6.1, 'media'); // periodo de estabilización tras el cambio
  medirVentana(ajuste, 'media', 60);
  assert.equal(cambios.length, 2);
  assert.equal(cambios[1][0], 'alta');
  assert.ok(cambios[1][1] > 58);
});

test('la recuperación nunca supera la calidad máxima inicial', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.medir(3.1, 'media');
  medirVentana(ajuste, 'media', 40);
  assert.equal(cambios[0][0], 'baja');

  ajuste.medir(6.1, 'baja');
  medirVentana(ajuste, 'baja', 60);
  assert.equal(cambios[1][0], 'media');
  assert.equal(cambios.length, 2);
});

test('reiniciar vuelve a detectar el límite de calidad de la nueva configuración', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.medir(3.1, 'ultra');
  ajuste.reiniciar();
  ajuste.medir(3.1, 'media');
  medirVentana(ajuste, 'media', 40);
  assert.equal(cambios[0][0], 'baja');
  ajuste.medir(6.1, 'baja');
  medirVentana(ajuste, 'baja', 60);
  assert.equal(cambios[1][0], 'media');
  assert.equal(cambios.length, 2);
});

test('ignora deltas inválidos y niveles desconocidos sin corromper la ventana', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.medir(3.1, 'alta');
  ajuste.medir(NaN, 'alta');
  ajuste.medir(Infinity, 'alta');
  ajuste.medir(-0.1, 'alta');
  ajuste.medir(1, 'desconocida');
  medirVentana(ajuste, 'alta', 60);
  assert.deepEqual(cambios, []);
});

test('no realiza ajustes cuando está desactivado', () => {
  const cambios = [];
  const ajuste = new AjusteAutomatico((...args) => cambios.push(args));
  ajuste.activo = false;
  ajuste.medir(3.1, 'alta');
  medirVentana(ajuste, 'alta', 30);
  assert.deepEqual(cambios, []);
});


test('lee las estadísticas de dibujo y memoria de Three.js', () => {
  const renderer = { info: {
    render: { calls: 12, triangles: 4800, lines: 24, points: 6 },
    memory: { geometries: 18, textures: 9 },
    programs: [{}, {}, {}],
  } };
  assert.deepEqual(leerEstadisticasRenderer(renderer), {
    llamadasDibujo: 12,
    triangulos: 4800,
    lineas: 24,
    puntos: 6,
    geometrias: 18,
    texturas: 9,
    programas: 3,
  });
});

test('el lector de estadísticas no falla si el renderer no expone info', () => {
  assert.equal(leerEstadisticasRenderer(null), null);
  assert.equal(leerEstadisticasRenderer({}), null);
});

test('normaliza contadores inválidos sin devolver NaN ni valores negativos', () => {
  const renderer = { info: {
    render: { calls: NaN, triangles: -1, lines: Infinity },
    memory: { geometries: undefined, textures: 4 },
    programs: null,
  } };
  assert.deepEqual(leerEstadisticasRenderer(renderer), {
    llamadasDibujo: 0,
    triangulos: 0,
    lineas: 0,
    puntos: 0,
    geometrias: 0,
    texturas: 4,
    programas: 0,
  });
});
