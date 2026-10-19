// Pruebas del sesgo de las sombras (que no se despeguen de los objetos ni salga «acné»).
import * as THREE from 'three';
import { ajustarSesgo, SESGO_TEXELES } from '../src/motor/lumbre-parche.js';

let ok = 0, mal = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; } catch (e) { mal++; console.log('✗', nombre, '\n   ', e.message); }
}
function cerca(a, b, msg) { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg}: esperaba ${b}, obtuve ${a}`); }

prueba('sol: sin sesgo de profundidad y desplazamiento de medio texel largo', () => {
  const l = new THREE.DirectionalLight();
  const c = l.shadow.camera;
  c.left = -22; c.right = 22;
  l.shadow.mapSize.set(4096, 4096);
  ajustarSesgo(l);
  cerca(l.shadow.bias, 0, 'bias');
  cerca(l.shadow.normalBias, SESGO_TEXELES * 44 / 4096, 'normalBias (m)');
});

prueba('bombilla y foco: desplazamiento por metro de distancia según el tamaño del texel', () => {
  const p = new THREE.PointLight();
  p.shadow.mapSize.set(1024, 1024);
  ajustarSesgo(p);
  cerca(p.shadow.bias, 0, 'bias bombilla');
  cerca(p.shadow.normalBias, SESGO_TEXELES * 2 / 1024, 'normalBias bombilla (m/m)');
  const f = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 6);
  f.shadow.mapSize.set(512, 512);
  ajustarSesgo(f);
  cerca(f.shadow.bias, 0, 'bias foco');
  cerca(f.shadow.normalBias, SESGO_TEXELES * 2 * Math.tan(Math.PI / 6) / 512, 'normalBias foco (m/m)');
});

prueba('el shader multiplica el desplazamiento de bombillas y focos por la distancia a la luz', () => {
  const sc = THREE.ShaderChunk.shadowmap_vertex;
  if (!THREE.ShaderChunk.__lumbreSesgo) throw new Error('no se aplicó el parche');
  if (!sc.includes('length( ( pointShadowMatrix[ i ] * worldPosition ).xyz )')) throw new Error('falta la distancia en bombillas');
  if (!sc.includes('( spotLightMatrix[ i ] * worldPosition ).w')) throw new Error('falta la distancia en focos');
});

console.log(`Sombras: ${ok} pruebas correctas, ${mal} fallidas`);
if (mal) process.exitCode = 1;
