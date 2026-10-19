// Verifica los bytes que electron-builder generó antes de hacer pública la release.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const VERSION = require('../package.json').version;
const METADATOS = { 'latest.yml': ['win-x64', 'exe'], 'latest-linux.yml': ['linux-x64', 'AppImage'], 'latest-linux-arm64.yml': ['linux-arm64', 'AppImage'] };

function verificarDirectorio(directorio, version = VERSION) {
  const nombres = fs.readdirSync(directorio).sort();
  for (const [metadatos, [sistema, ext]] of Object.entries(METADATOS)) {
    const info = yaml.load(fs.readFileSync(path.join(directorio, metadatos), 'utf8'));
    if (info.version !== version) throw Error(`${metadatos}: versión incorrecta`);
    const nombre = `Falcon-Engine-${version}-${sistema}.${ext}`;
    const entrada = info.files?.find(f => f.url === nombre);
    if (!entrada || info.path !== nombre) throw Error(`${metadatos}: falta el instalador esperado ${nombre}`);
    const binario = fs.readFileSync(path.join(directorio, nombre));
    if (binario.length < 1024 * 1024 || binario.subarray(0, ext === 'exe' ? 2 : 4).toString('hex') !== (ext === 'exe' ? '4d5a' : '7f454c46')) throw Error(`${nombre}: no es un instalador válido`);
    if (entrada.size !== binario.length) throw Error(`${nombre}: tamaño incorrecto`);
    const hash = crypto.createHash('sha512').update(binario).digest('base64');
    if (hash !== entrada.sha512 || hash !== info.sha512) throw Error(`${nombre}: SHA-512 incorrecto`);
    if (ext === 'exe' && !nombres.includes(nombre + '.blockmap')) throw Error(`${nombre}: falta blockmap`);
    for (const f of info.files) if (path.basename(f.url) !== f.url || !nombres.includes(f.url)) throw Error(`${metadatos}: archivo no disponible`);
  }
  const archivos = nombres.filter(n => /\.(exe|AppImage|blockmap|yml)$/.test(n));
  const sumas = archivos.map(n => crypto.createHash('sha256').update(fs.readFileSync(path.join(directorio, n))).digest('hex') + '  ' + n).join('\n') + '\n';
  fs.writeFileSync(path.join(directorio, 'SHA256SUMS.txt'), sumas);
  return [...archivos, 'SHA256SUMS.txt'];
}
if (require.main === module) console.log('Verificados:', verificarDirectorio(process.argv[2] || 'instaladores').join(', '));
module.exports = { verificarDirectorio };
