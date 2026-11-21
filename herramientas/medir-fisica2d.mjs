// Mide la física 2D por paso (Mundo.fisica2d y Mundo.contactos2d), en JS y con el núcleo de Ara.
// Uso: node herramientas/medir-fisica2d.mjs [pasos]   (por defecto 2000, tras 300 de calentamiento)
// Escenas: 200 Personaje2D con 21 plataformas, y 200 con un mosaico de 450 celdas.
import { performance } from 'node:perf_hooks';
import '../pruebas/dom.js';
import { Mundo, NodoVivo } from '../src/motor/mundo.js';
import { nucleoAra } from '../src/motor/nucleo-ara.js';

const PASOS = Number(process.argv[2]) || 2000;
const nodo = (tipo, nombre, props = {}, hijos = []) => ({ id: nombre, tipo, nombre, props: { posicion: [0, 0], ...props }, hijos });
const personajes = () => Array.from({ length: 200 }, (_, i) => nodo('Personaje2D', 'P' + i,
  { posicion: [40 + (i % 50) * 30, 100 + Math.floor(i / 50) * 60], usa_gravedad: true, gravedad: 1200, velocidad: 220 },
  [nodo('Colision', 'C' + i, { ancho: 24, alto: 40 })]));

const escenas = {
  '21 plataformas': () => nodo('Nodo2D', 'Escena', {}, [...personajes(),
    nodo('Plataforma', 'Suelo', { posicion: [800, 600], ancho: 1800, alto: 40, solido: true }),
    ...Array.from({ length: 20 }, (_, k) => nodo('Plataforma', 'B' + k, { posicion: [80 + k * 80, 380 + (k % 3) * 60], ancho: 70, alto: 16, solido: true, solo_arriba: k % 2 === 0 }))]),
  '450 celdas': () => {
    const celdas = {};
    for (let c = 0; c < 60; c++) for (let f = 15; f < 20; f++) celdas[`${c},${f}`] = 1; // 300
    for (let c = 0; c < 50; c++) for (let f = 8; f < 11; f++) if (c % 10 < 5) celdas[`${c * 1},${f}`] = 1; // 75 + 75
    for (let f = 0; f < 15; f++) for (const c of [0, 59]) celdas[`${c},${f}`] = 1;
    return nodo('Nodo2D', 'Escena', {}, [...personajes(), nodo('Mosaicos', 'Mapa', { tam_celda: 32, solido: true, celdas: Object.fromEntries(Object.entries(celdas).slice(0, 450)) })]);
  },
};

function medir(escena, nucleo, conContactos) {
  const m = new Mundo({ proyecto: { datos: { nombre: 'Medida' } }, lienzo: {} });
  m.raiz = new NodoVivo(m, escena(), null);
  m.indiceSucio = true;
  m.nucleo = nucleo;
  const nodos = m.todos();
  const pjs = nodos.filter((n) => n.tipo === 'Personaje2D');
  let i = 0;
  const paso = () => {
    for (const [k, n] of pjs.entries()) {
      n.mueveX = ((i + k * 7) % 240 < 120 ? 1 : -1) * 220;
      if ((i + k) % 90 === 0 && n.enSuelo) n.vy = -600;
    }
    m.fisica2d(1 / 60, nodos);
    if (conContactos) m.contactos2d(nodos);
    i++;
  };
  for (let k = 0; k < 300; k++) paso();
  const t = performance.now();
  for (let k = 0; k < PASOS; k++) paso();
  return (performance.now() - t) / PASOS;
}

const nucleo = await nucleoAra();
for (const [nombre, escena] of Object.entries(escenas)) for (const contactos of [false, true]) {
  const js = medir(escena, null, contactos), ara = medir(escena, nucleo, contactos);
  console.log(`${nombre}${contactos ? ' + contactos2d' : ''}: JS ${js.toFixed(3)} ms, Ara ${ara.toFixed(3)} ms (Ara ${(js / ara).toFixed(2)}×)`);
}
