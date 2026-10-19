const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = async function verificarPaquete(contexto) {
  const recursos = contexto.electronPlatformName === 'darwin'
    ? path.join(contexto.appOutDir, 'Falcon Engine.app', 'Contents', 'Resources')
    : path.join(contexto.appOutDir, 'resources');
  const app = path.join(recursos, 'app');
  // extraResources ya se ha copiado. Fallar aquí impide crear instaladores sin addons.
  if (contexto.electronPlatformName === 'linux') fs.chmodSync(path.join(contexto.appOutDir, 'falcon-engine'), 0o755);
  for (const archivo of [
    'src/gestor/gestor.html', 'src/editor/editor.html', 'src/juego/juego.html', 'src/principal/preload.js',
    'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js',
    'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
    'node_modules/three/examples/jsm/exporters/GLTFExporter.js',
    'node_modules/three/examples/jsm/controls/TransformControls.js',
    'node_modules/three/examples/jsm/environments/RoomEnvironment.js',
    'node_modules/three/examples/jsm/utils/SkeletonUtils.js',
    'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',
    'node_modules/three/examples/jsm/postprocessing/EffectComposer.js',
    'node_modules/three-bvh-csg/build/index.module.js', 'node_modules/three-mesh-bvh/build/index.module.js',
  ]) {
    if (!fs.existsSync(path.join(app, archivo))) throw Error('Falta un archivo de ejecución: ' + archivo);
  }
  const baseCQB = path.join(app, 'recursos', 'cqb');
  const manifest = JSON.parse(fs.readFileSync(path.join(baseCQB, 'manifest.json'), 'utf8'));
  if (manifest.formato !== 'falcon-cqb-assets' || manifest.archivos.length < 30) throw Error('Manifiesto CQB incompleto');
  for (const rel of manifest.archivos) {
    if (rel.includes('..') || path.isAbsolute(rel)) throw Error('Ruta CQB inválida: ' + rel);
    const bytes = fs.readFileSync(path.join(baseCQB, rel));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.hashes[rel]) throw Error('Recurso CQB modificado o incompleto: ' + rel);
    if (rel.endsWith('.glb') && (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(8) !== bytes.length)) throw Error('GLB CQB inválido o puntero LFS: ' + rel);
  }
};
