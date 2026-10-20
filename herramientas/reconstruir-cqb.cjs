// Transporte del GLB original por bloques, sin conversión ni cambios de malla.
// Reconstruye antes de probar/compilar; el instalador lleva los GLB completos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = path.resolve(__dirname, '../recursos/cqb');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
for (const [modelo, partes] of Object.entries(manifest.fragmentos || {})) {
  const destino = path.join(base, modelo);
  if (fs.existsSync(destino) && sha(fs.readFileSync(destino)) === manifest.hashes[modelo]) continue;
  const contenido = partes.map(p => {
    const bytes = fs.readFileSync(path.join(base, p.ruta));
    if (bytes.length !== p.bytes || sha(bytes) !== p.sha256) throw Error('Bloque CQB incompleto: ' + p.ruta);
    return bytes;
  });
  const glb = Buffer.concat(contenido);
  if (sha(glb) !== manifest.hashes[modelo] || glb.toString('ascii', 0, 4) !== 'glTF' || glb.readUInt32LE(8) !== glb.length) throw Error('El GLB reconstruido no coincide con el original: ' + modelo);
  fs.mkdirSync(path.dirname(destino), { recursive: true }); fs.writeFileSync(destino + '.tmp', glb); fs.renameSync(destino + '.tmp', destino);
  console.log('GLB CQB original reconstruido y verificado:', modelo);
}
