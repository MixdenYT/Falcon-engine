// Pruebas de las texturas a escala real de las formas básicas (UV por cara).
import { Escena3D, geometriaPrimitiva } from '../src/motor/escena3d.js';

let ok = 0, mal = 0;
async function prueba(nombre, fn) {
  try { await fn(); ok++; } catch (e) { mal++; console.log('✗', nombre, '\n   ', e.message); }
}
function igual(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperaba ${JSON.stringify(b)}\n    obtuve   ${JSON.stringify(a)}`); }

// Repeticiones (ancho × alto) de las caras +X, +Y y +Z de un cubo.
function repeticiones(malla) {
  const uv = malla.geometry.attributes.uv;
  return [0, 2, 4].map((f) => {
    const us = [], vs = [];
    for (let i = f * 4; i < f * 4 + 4; i++) { us.push(uv.getX(i)); vs.push(uv.getY(i)); }
    return [+(Math.max(...us) - Math.min(...us)).toFixed(2), +(Math.max(...vs) - Math.min(...vs)).toFixed(2)];
  });
}
const muro = (id, escala, escala_textura) => ({ id, tipo: 'Malla3D', nombre: id, hijos: [], props: { malla: 'cubo', escala, escala_textura } });

await prueba('cada muro tiene sus propias UV aunque compartan forma', async () => {
  const es = new Escena3D({}, {});
  const a = muro('a', [24, 11, 1], 2), b = muro('b', [1, 11, 24], 2), c = muro('c', [1.4, 3, 1.4], 2);
  const [ga, gb, gc] = [await es.crear(a), await es.crear(b), await es.crear(c)];
  igual(repeticiones(ga.userData.malla), [[0.5, 5.5], [12, 0.5], [12, 5.5]]);
  igual(repeticiones(gb.userData.malla), [[12, 5.5], [0.5, 12], [0.5, 5.5]]);
  igual(repeticiones(gc.userData.malla), [[0.7, 1.5], [0.7, 0.7], [0.7, 1.5]]);
  igual(geometriaPrimitiva('cubo').attributes.uv.getX(1), 1);
  igual(Object.keys(geometriaPrimitiva('cubo').userData), []);
});

await prueba('al escalar o cambiar el tamaño de textura se recalcula sin reconstruir', async () => {
  const es = new Escena3D({}, {});
  const n = muro('m', [1, 1, 1]);
  const g = await es.crear(n);
  n.props.escala = [0.3, 4, 20];
  await es.actualizarNodo(n, 'escala');
  igual(repeticiones(g.userData.malla), [[10, 2], [0.15, 10], [0.15, 2]]);
  n.props.escala_textura = 1;
  await es.actualizarNodo(n, 'escala_textura');
  igual(repeticiones(g.userData.malla), [[20, 4], [0.3, 20], [0.3, 4]]);
  igual(es.objetos.get('m'), g);
});

console.log(`Texturas: ${ok} pruebas correctas, ${mal} fallidas`);
if (mal) process.exitCode = 1;
