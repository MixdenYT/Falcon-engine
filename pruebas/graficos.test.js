import test from 'node:test';
import assert from 'node:assert/strict';
import { AjusteAutomatico } from '../src/motor/graficos.js';

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
