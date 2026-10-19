// Standard updater artifacts; portable build:* scripts remain available.
const { repositorio } = require('./src/principal/actualizaciones');
const destino = repositorio(process.env.FALCON_RELEASE_REPOSITORY || require('./package.json').falconUpdates.repository);
module.exports = {
  appId: 'com.falcon.engine', productName: 'Falcon Engine', asar: false,
  directories: { output: 'dist-actualizaciones' },
  files: ['src/**/*', 'recursos/**/*', 'package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md'],
  extraFiles: [{ from: 'LICENSE', to: 'FALCON-LICENSE.txt' }, { from: 'THIRD_PARTY_NOTICES.md', to: 'FALCON-THIRD-PARTY-NOTICES.md' }],
  artifactName: 'Falcon-Engine-${version}-${os}-${arch}.${ext}',
  publish: [{ provider: 'github', ...destino, releaseType: 'release' }],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'recursos/icono.ico', verifyUpdateCodeSignature: true },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, perMachine: false, deleteAppDataOnUninstall: false },
  linux: { target: ['AppImage'], icon: 'recursos/icono.png', category: 'Development', executableName: 'falcon-engine' },
};
