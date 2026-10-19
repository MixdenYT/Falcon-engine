// Empaqueta Falcon Engine como aplicación para Windows o Linux.
// Uso: node herramientas/construir.js <win32|linux> <x64|arm64>
//  · Windows → dist/Falcon Engine-win32-x64/ (carpeta con «Falcon Engine.exe»)
//  · Linux   → dist/Falcon Engine-linux-x64.tar.gz (con permisos de ejecución)

const path = require('node:path');
const fs = require('node:fs');
const raiz = path.resolve(__dirname, '..');
const [plataforma = process.platform, arquitectura = process.arch] = process.argv.slice(2);

(async () => {
  const { packager } = await import('@electron/packager');
  const version = require(path.join(raiz, 'package.json')).version;
  console.log(`Empaquetando Falcon Engine ${version} para ${plataforma}-${arquitectura}…`);
  const [carpeta] = await packager({
    dir: raiz,
    name: 'Falcon Engine',
    executableName: plataforma === 'win32' ? 'Falcon Engine' : 'falcon-engine',
    platform: plataforma,
    arch: arquitectura,
    out: path.join(raiz, 'dist'),
    overwrite: true,
    asar: false, // el exportador copia archivos de la app tal cual
    prune: true,
    icon: path.join(raiz, 'recursos', plataforma === 'win32' ? 'icono.ico' : 'icono.png'),
    appVersion: version,
    appCopyright: 'Falcon Engine',
    win32metadata: { CompanyName: 'Falcon Engine', FileDescription: 'Falcon Engine', ProductName: 'Falcon Engine' },
    ignore: [/^\/dist(\/|$)/, /^\/pruebas(\/|$)/, /^\/herramientas(\/|$)/, /^\/\.git(\/|$)/, /^\/\.claude(\/|$)/],
  });
  console.log('Listo:', carpeta);

  if (plataforma === 'linux') {
    // Desde Windows se pierden los permisos: se crea un .tar.gz que los incluye.
    const { crearTarGz } = require(path.join(raiz, 'src', 'principal', 'exportar.js'));
    const ejecutables = new Set(['falcon-engine', 'chrome-sandbox', 'chrome_crashpad_handler', 'falcon.sh']);
    fs.writeFileSync(path.join(carpeta, 'falcon.sh'), '#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\n"$DIR/falcon-engine" "$@" 2>/dev/null || "$DIR/falcon-engine" --no-sandbox "$@"\n');
    const destino = carpeta + '.tar.gz';
    await crearTarGz(carpeta, destino, path.basename(carpeta), (rel) => ejecutables.has(rel) || /\.so(\.\d+)*$/.test(rel) ? 0o755 : 0o644, () => {});
    console.log('Archivo para Linux:', destino);
  }
})().catch((e) => { console.error(e); process.exit(1); });
