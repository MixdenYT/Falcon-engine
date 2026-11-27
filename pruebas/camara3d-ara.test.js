import test from 'node:test';
import assert from 'node:assert/strict';
import { nucleoAra } from '../src/motor/nucleo-ara.js';

const { camara3d: C } = await nucleoAra();
const cerca = (real, esperado, etiqueta) => assert.ok(Math.abs(real - esperado) < 1e-10, etiqueta + ': ' + real + ' != ' + esperado);

test('Ara calcula la órbita con ratón, stick, sensibilidad e inversión vertical', () => {
  C.iniciar(0, 0, 0, 0, 0, 5);
  C.entrada(100, 50, 0.5, -0.25, 1, -1, 0.1, false);
  cerca(C.yaw(), -0.374, 'yaw combinado');
  cerca(C.pitch(), 0.12 - 0.07, 'pitch combinado e invertido');
});

test('Ara limita el pitch según primera o tercera persona', () => {
  C.iniciar(0, 0, 0, 0, 0, 5);
  C.entrada(0, -10000, 0, 0, 1, 1, 0.016, false);
  cerca(C.pitch(), 1.25, 'límite superior tercera persona');
  C.entrada(0, 10000, 0, 0, 1, 1, 0.016, true);
  cerca(C.pitch(), -1.45, 'límite inferior primera persona');
});

test('Ara suaviza el pivote horizontal y vertical con tasas independientes', () => {
  C.iniciar(0, 0, 0, 0, 0, 5);
  C.seguirPivote(1, 2, 3, 0.1);
  cerca(C.pivote()[0], 1 - Math.exp(-1.6), 'pivote X');
  cerca(C.pivote()[1], 2 * (1 - Math.exp(-0.8)), 'pivote Y');
  cerca(C.pivote()[2], 3 * (1 - Math.exp(-1.6)), 'pivote Z');
});

test('Ara devuelve la cámara detrás del movimiento y suaviza el zoom', () => {
  C.iniciar(1, 0, 0, 0, 0, 5);
  C.seguirYaw(0, -5, 5, 5, 0.1);
  cerca(C.yaw(), 0.45, 'yaw sigue el movimiento con el factor temporal esperado');
  C.seguirDistancia(10, 0.1);
  cerca(C.distancia(), 5 + 5 * (1 - Math.exp(-0.35)), 'zoom hacia fuera');
  C.seguirDistancia(2, 0.1);
  cerca(C.distancia(), 2 + (5 + 5 * (1 - Math.exp(-0.35)) - 2) * Math.exp(-3), 'acercamiento rápido');
});
