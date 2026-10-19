// Pruebas de los huecos: recorte de mallas (CSG) y colisión partida en cajas.
import * as THREE from 'three';
import { Escena3D } from '../src/motor/escena3d.js';
import { restarCajas } from '../src/motor/huecos.js';

let ok = 0, mal = 0;
async function prueba(nombre, fn) {
  try { await fn(); ok++; } catch (e) { mal++; console.log('✗', nombre, '\n   ', e.message); }
}
function igual(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperaba ${JSON.stringify(b)}\n    obtuve   ${JSON.stringify(a)}`); }
function cierto(v, msg) { if (!v) throw new Error(msg); }

const caja = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
const lista = (cajas) => cajas.map(c => [...c.min.toArray(), ...c.max.toArray()].map(v => +v.toFixed(3))).sort((x, y) => { for (let i = 0; i < 6; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
const nodo = (id, props, extra = {}) => ({ id, tipo: 'Malla3D', nombre: id, hijos: [], props: { malla: 'cubo', posicion: [0, 0, 0], rotacion: [0, 0, 0], escala: [1, 1, 1], ...props }, ...extra });

// Un rayo que atraviesa el muro por el punto (x, y): ¿choca con la malla?
function choca(malla, x, y) {
  const r = new THREE.Raycaster(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
  return r.intersectObject(malla, false).length > 0;
}

await prueba('muro con puerta: la caja de colisión se parte en tres trozos', () => {
  // Muro de 10 × 4 × 0,4 y puerta de 1,2 × 2,2 en el centro que lo atraviesa.
  const trozos = restarCajas(caja([-5, 0, -0.2], [5, 4, 0.2]), [caja([-0.6, 0, -0.5], [0.6, 2.2, 0.5])]);
  igual(lista(trozos), [[-5, 0, -0.2, -0.6, 4, 0.2], [-0.6, 2.2, -0.2, 0.6, 4, 0.2], [0.6, 0, -0.2, 5, 4, 0.2]]);
});

await prueba('un hueco que no toca la caja la deja igual', () => {
  igual(lista(restarCajas(caja([0, 0, 0], [1, 1, 1]), [caja([2, 2, 2], [3, 3, 3])])), [[0, 0, 0, 1, 1, 1]]);
});

await prueba('el hueco recorta la malla del muro y se rehace al moverlo', async () => {
  const es = new Escena3D({}, {});
  es.aplicarEntorno = () => {};   // sin document en Node
  const raiz = { id: 'raiz', tipo: 'Nodo3D', nombre: 'raiz', hijos: [], props: {} };
  const muro = nodo('muro', { posicion: [0, 2, 0], escala: [10, 4, 0.4] });
  const puerta = nodo('puerta', { modo: 'hueco', posicion: [0, 1.1, 0], escala: [1.2, 2.2, 1] });
  raiz.hijos.push(muro, puerta);
  await es.construir(raiz);
  const m = es.objetos.get('muro').userData.malla;
  cierto(!choca(m, 0, 1), 'el rayo debería pasar por la puerta');
  cierto(choca(m, 3, 1), 'el rayo debería chocar con el muro junto a la puerta');
  cierto(choca(m, 0, 3), 'el rayo debería chocar con el dintel');
  cierto(!es.objetos.get('puerta').userData.malla.visible, 'el hueco no se dibuja en el juego');
  // Se mueve la puerta a la derecha: el recorte la sigue.
  puerta.props.posicion = [3, 1.1, 0];
  es.actualizarNodo(puerta, 'posicion');
  cierto(es.revisarHuecos(), 'debería rehacer el recorte');
  cierto(choca(m, 0, 1) && !choca(m, 3, 1), 'el hueco debería estar ahora en x = 3');
  cierto(!es.revisarHuecos(), 'sin cambios no se rehace nada');
  // Oculto deja de recortar.
  puerta.visible = false;
  es.revisarHuecos();
  cierto(choca(m, 3, 1), 'un hueco oculto no recorta');
});

console.log(`Huecos: ${ok} pruebas correctas, ${mal} fallidas`);
if (mal) process.exitCode = 1;
