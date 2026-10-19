const fs = require('node:fs');
const path = require('node:path');
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
    'node_modules/three/examples/jsm/postprocessing/EffectComposer.js',
    'node_modules/three-bvh-csg/build/index.module.js', 'node_modules/three-mesh-bvh/build/index.module.js',
  ]) {
    if (!fs.existsSync(path.join(app, archivo))) throw Error('Falta un archivo de ejecución: ' + archivo);
  }
};
