// Diseños propios de Falcon: metros, cañón hacia -Z. Los puntos de agarre son
// parte del GLB y sirven de destino de IK para los dos rigs y la vista de brazos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function crearArmaCQB(tipo = 'kestrel') {
  const g = new THREE.Group(); g.name = tipo;
  const mat = (color, metalness = 0.2, roughness = 0.65) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const metal = mat('#444D52', 0.85, 0.38), negro = mat('#20282B'), goma = mat('#161D20', 0.1, 0.9), acento = mat(tipo === 'hostil' ? '#986341' : '#64776B');
  const caja = (nombre, pos, escala, material, rot = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...escala), material); m.name = nombre; m.position.fromArray(pos); m.rotation.x = rot; g.add(m); return m;
  };
  const tubo = (nombre, x, y, z, r, largo, material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 12), material); m.name = nombre; m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m;
  };
  const punto = (nombre, x, y, z) => { const o = new THREE.Object3D(); o.name = nombre; o.position.set(x, y, z); g.add(o); };
  if (tipo === 'lynx') {
    caja('Armazon', [0, -0.026, 0], [0.035, 0.038, 0.18], negro);
    caja('Corredera', [0, 0.01, -0.015], [0.039, 0.043, 0.2], mat('#967D58', 0.8, 0.4));
    caja('Empuñadura', [0, -0.09, 0.052], [0.035, 0.11, 0.052], goma, -0.22);
    caja('Cargador', [0, -0.14, 0.045], [0.039, 0.014, 0.05], metal);
    tubo('Cañon', 0, 0.005, -0.125, 0.009, 0.045, metal);
    caja('PuntoMira', [0, 0.04, -0.092], [0.004, 0.017, 0.005], negro);
    for (const x of [-0.01, 0.01]) caja('Alza', [x, 0.038, 0.067], [0.006, 0.014, 0.008], negro);
    punto('Boca', 0, 0.005, -0.15); punto('GripR', 0.018, -0.082, 0.055); punto('GripL', -0.04, -0.09, 0.06);
    punto('Mira', 0, 0.0485, 0.07);
  } else {
    const hostil = tipo === 'hostil';
    caja('CajonMecanismos', [0, -0.025, 0], [0.075, 0.095, 0.26], metal);
    caja('Empuñadura', [0.008, -0.105, 0.082], [0.042, 0.12, 0.054], goma, -0.23);
    caja('Culata', [0, -0.026, 0.26], [0.065, 0.10, 0.22], hostil ? acento : negro);
    caja('Cantonera', [0, -0.026, 0.373], [0.073, 0.13, 0.025], goma);
    caja('Guardamanos', [0, -0.025, -0.22], [0.076, 0.085, 0.20], acento);
    tubo('Cañon', 0, -0.025, -0.38, 0.018, hostil ? 0.23 : 0.16, metal);
    tubo('Bocacha', 0, -0.025, hostil ? -0.51 : -0.475, 0.024, 0.07, negro);
    caja('Cargador', [0, -0.12, -0.04], [0.046, hostil ? 0.21 : 0.145, 0.064], negro, hostil ? -0.22 : 0);
    caja('Guardamonte', [0, -0.09, 0.038], [0.016, 0.014, 0.075], metal);
    caja('Gatillo', [0, -0.084, 0.061], [0.006, 0.034, 0.007], metal);
    caja('Carril', [0, 0.029, -0.04], [0.044, 0.012, 0.37], negro);
    for (let i = 0; i < 11; i++) caja('Ranura' + i, [0, 0.039, 0.11 - i * 0.029], [0.054, 0.007, 0.007], metal);
    for (const x of [-0.014, 0.014]) caja('Alza', [x, 0.064, 0.12], [0.007, 0.033, 0.015], negro);
    caja('PuntoMira', [0, 0.063, -0.30], [0.005, 0.035, 0.009], negro);
    for (let i = 0; i < 6; i++) for (const lado of [-1, 1]) caja('Ventilacion', [lado * 0.039, -0.023, -0.15 - i * 0.024], [0.003, 0.013, 0.012], negro);
    punto('Boca', 0, -0.025, hostil ? -0.55 : -0.515); punto('GripR', 0.025, -0.105, 0.083); punto('GripL', 0, -0.085, -0.21); punto('Mira', 0, 0.0805, 0.12);
  }
  // Una llamada de dibujo por material, conservando el cargador animable y los
  // puntos del equipo. Evita cientos de llamadas para cinco armas en pantalla.
  const grupos = new Map();
  for (const m of g.children.slice()) {
    if (!m.isMesh || m.name === 'Cargador') continue;
    m.updateMatrix(); const geometria = m.geometry.clone().applyMatrix4(m.matrix);
    if (!grupos.has(m.material)) grupos.set(m.material, []);
    grupos.get(m.material).push(geometria); m.removeFromParent(); m.geometry.dispose();
  }
  let indice = 0;
  for (const [material, geometrias] of grupos) {
    const m = new THREE.Mesh(mergeGeometries(geometrias, false), material); m.name = 'Cuerpo' + indice++; g.add(m);
    for (const geometria of geometrias) geometria.dispose();
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
