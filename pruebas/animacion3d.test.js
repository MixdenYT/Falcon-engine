import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Animador3D, clonarRig, normalizarRig, sinDesplazamiento, soloBrazos } from '../src/motor/animacion3d.js';
import { objetivoMano } from '../src/motor/agarre3d.js';

function rig() {
  const root = new THREE.Group(), hombro = new THREE.Bone(), codo = new THREE.Bone(), mano = new THREE.Bone();
  hombro.name = 'RightArm'; codo.name = 'RightForeArm'; mano.name = 'RightHand'; codo.position.x = 0.6; mano.position.x = 0.5;
  hombro.add(codo); codo.add(mano); root.add(hombro);
  const g = new THREE.BoxGeometry(0.2, 0.2, 0.2), vertices = g.attributes.position.count;
  const indices = new Uint16Array(vertices * 4), pesos = new Float32Array(vertices * 4); for (let i = 0; i < vertices; i++) { indices[i * 4] = 2; pesos[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pesos, 4));
  const m = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial()); root.add(m); m.bind(new THREE.Skeleton([hombro, codo, mano])); root.updateMatrixWorld(true);
  return { root, m, hombro, codo, mano };
}
test('rig: cada instancia conserva huesos independientes y los brazos mantienen skin y materiales', () => {
  const a = rig(), b = clonarRig(a.root), m = b.children.find(o => o.isSkinnedMesh);
  assert.notEqual(a.m.skeleton.bones[0], m.skeleton.bones[0]); m.skeleton.bones[0].rotation.y = 0.5; assert.equal(a.hombro.rotation.y, 0);
  a.root.traverse(o => o.layers.set(1));
  const brazos = soloBrazos(a.root), bm = brazos.children.find(o => o.isSkinnedMesh); assert.equal(bm.visible, true); assert.equal(bm.geometry.index.count, a.m.geometry.index.count); assert.equal(bm.material, a.m.material); assert.equal(bm.layers.mask, 1, 'brazos visibles para la cámara FP');
});

async function rigReal(nombre) {
  const b = fs.readFileSync(new URL('../recursos/cqb/modelos/personajes/' + nombre + '.glb', import.meta.url)), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n));
  // Node no decodifica imágenes: se conservan todos los datos geométricos y del
  // esqueleto del GLB real y se omiten solo sus referencias de material en esta prueba.
  assert.equal(j.images.length, 3, 'el GLB contiene las tres texturas PBR');
  for (const m of j.meshes) for (const p of m.primitives) delete p.material;
  delete j.materials; delete j.images; delete j.textures;
  const json = Buffer.from(JSON.stringify(j)), relleno = Buffer.alloc((4 - json.length % 4) % 4, 32), cab = Buffer.from(b.subarray(0, 20));
  cab.writeUInt32LE(20 + json.length + relleno.length + b.length - 20 - n, 8); cab.writeUInt32LE(json.length + relleno.length, 12);
  const glb = Buffer.concat([cab, json, relleno, b.subarray(20 + n)]);
  return (await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '')).scene;
}
test('rig Meshy real: medir tras actualizar la piel mantiene la escala y el agarre en metros', async () => {
  for (const nombre of ['operador', 'enemigo']) {
    const r = normalizarRig(clonarRig(await rigReal(nombre)), 1.78);
    r.traverse(o => { if (o.isSkinnedMesh) o.computeBoundingBox(); });
    const box = new THREE.Box3().setFromObject(r);
    assert.ok(Math.abs(box.max.y - box.min.y - 1.78) < 0.001, nombre + ': altura humana');
    const clip = THREE.AnimationClip.parse(JSON.parse(fs.readFileSync(new URL('../recursos/cqb/modelos/animaciones/' + nombre + '-aim.json', import.meta.url))));
    const perfiles_manos = JSON.parse(fs.readFileSync(new URL('../recursos/cqb/modelos/personajes/' + nombre + '-manos.json', import.meta.url)));
    r.rotation.y = Math.PI;
    const a = new Animador3D(r, { aim: clip }, { perfiles_manos }); a.actualizar({}, 0, 0.01);
    const arma = new THREE.Group(); arma.position.set(0.10, 1.33, -0.16); arma.updateMatrixWorld(true);
    for (const [lado, pos] of [['r', [0.025, -0.105, 0.083]], ['l', [0, -0.085, -0.21]]]) {
      const palma = arma.localToWorld(new THREE.Vector3(...pos)), meta = objetivoMano(a, lado, arma, palma);
      a.agarrar(lado, meta.posicion, new THREE.Vector3(lado === 'r' ? 0.43 : -0.43, 1.0, 0.05), meta.rotacion);
      const real = a.huesos[lado].mano.localToWorld(new THREE.Vector3(...perfiles_manos.perfiles[lado].palma));
      assert.ok(real.distanceTo(palma) < 0.005, nombre + '/' + lado + ': palma en el agarre ' + real.distanceTo(palma));
    }
    a.destruir();
  }
});
test('rig: IK coloca la mano en el agarre sin cambiar las longitudes de los huesos', () => {
  const r = rig(), a = new Animador3D(r.root, {}), destino = new THREE.Vector3(0.75, 0.3, -0.3);
  assert.equal(a.agarrar('r', destino, new THREE.Vector3(0.3, -0.8, 0.2)), true);
  const p = r.mano.getWorldPosition(new THREE.Vector3()), c = r.codo.getWorldPosition(new THREE.Vector3()), h = r.hombro.getWorldPosition(new THREE.Vector3());
  assert.ok(p.distanceTo(destino) < 0.00001); assert.ok(Math.abs(h.distanceTo(c) - 0.6) < 0.00001); assert.ok(Math.abs(c.distanceTo(p) - 0.5) < 0.00001);
});
test('rig: elimina desplazamiento horizontal de cadera sin borrar el movimiento vertical', () => {
  const original = new THREE.AnimationClip('walk', 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 1, 0, 3, 1.1, 4])]);
  const c = sinDesplazamiento(original); assert.equal(c.tracks[0].values[3], 0); assert.equal(c.tracks[0].values[5], 0); assert.ok(c.tracks[0].values[4] > 1); assert.equal(original.tracks[0].values[3], 3);
});
test('rig: dos disparos consecutivos reinician el clip de disparar', () => {
  const r = rig(), clip = new THREE.AnimationClip('fire', 0.2, [new THREE.NumberKeyframeTrack('RightArm.rotation[z]', [0, 0.2], [0, 0.2])]), a = new Animador3D(r.root, { fire: clip });
  const n = { _tactico: { animacion: 'fire', hasta: 1, evento: 1 } }; a.actualizar(n, 0, 0.05); a.actualizar(n, 0.05, 0.05); const t = a.actual.time;
  n._tactico.evento = 2; a.actualizar(n, 0.1, 0.01); assert.ok(a.actual.time < t); a.destruir();
});
