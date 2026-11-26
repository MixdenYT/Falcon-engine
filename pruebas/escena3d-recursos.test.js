import test from 'node:test';
import assert from 'node:assert/strict';
import { Escena3D, THREE, geometriaPrimitiva } from '../src/motor/escena3d.js';

function contarLiberacion(recurso) {
  let veces = 0;
  recurso.addEventListener('dispose', () => veces++);
  return () => veces;
}

test('destruir libera geometrías, materiales y texturas de la escena y de los modelos cacheados', async () => {
  const escena = new Escena3D({});
  const textura = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: textura });
  const geometria = new THREE.BoxGeometry();
  const malla = new THREE.Mesh(geometria, material);
  const geometriaModelo = new THREE.SphereGeometry();
  const materialModelo = new THREE.MeshStandardMaterial();
  const modelo = new THREE.Group();
  modelo.add(new THREE.Mesh(geometriaModelo, materialModelo));
  escena.scene.add(malla);

  const liberaciones = [
    contarLiberacion(textura),
    contarLiberacion(material),
    contarLiberacion(geometria),
    contarLiberacion(materialModelo),
    contarLiberacion(geometriaModelo),
  ];
  escena.texturas.set('textura', textura);
  escena.materiales.set('material', Promise.resolve(material));
  escena.modelos.set('modelo', Promise.resolve(modelo));

  await escena.destruir();

  assert.deepEqual(liberaciones.map(leer => leer()), [1, 1, 1, 1, 1]);
  assert.equal(escena.texturas.size, 0);
  assert.equal(escena.materiales.size, 0);
  assert.equal(escena.modelos.size, 0);
  assert.equal(escena.scene.children.length, 0);
});

test('destruir conserva las geometrías primitivas compartidas por el motor', async () => {
  const escena = new Escena3D({});
  const primitiva = geometriaPrimitiva('cubo');
  const leerLiberacion = contarLiberacion(primitiva);
  escena.scene.add(new THREE.Mesh(primitiva, new THREE.MeshBasicMaterial()));

  await escena.destruir();

  assert.equal(leerLiberacion(), 0);
});

test('limpiar retira los objetos sin liberar recursos reutilizables durante una reconstrucción', () => {
  const escena = new Escena3D({});
  const geometria = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const leerGeometria = contarLiberacion(geometria);
  const leerMaterial = contarLiberacion(material);
  const objeto = new THREE.Mesh(geometria, material);
  escena.objetos.set('nodo', objeto);
  escena.scene.add(objeto);

  escena.limpiar();

  assert.equal(objeto.parent, null);
  assert.equal(escena.objetos.size, 0);
  assert.equal(leerGeometria(), 0);
  assert.equal(leerMaterial(), 0);
});
