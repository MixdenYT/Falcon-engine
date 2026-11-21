import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { verificarDirectorio, METADATOS } = require('../herramientas/verificar-release.cjs');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'falcon-release-'));
  for (const [meta, [plataforma, ext]] of Object.entries(METADATOS)) {
    const nombre = `Falcon-Engine-1.1.0-${plataforma}.${ext}`, datos = Buffer.alloc(1024 * 1024, 7);
    Buffer.from(ext === 'exe' ? '4d5a' : '7f454c46', 'hex').copy(datos);
    writeFileSync(join(dir, nombre), datos);
    const hash = createHash('sha512').update(datos).digest('base64');
    writeFileSync(join(dir, meta), `version: 1.1.0\nfiles:\n  - url: ${nombre}\n    sha512: ${hash}\n    size: ${datos.length}\npath: ${nombre}\nsha512: ${hash}\n`);
    if (ext === 'exe') writeFileSync(join(dir, nombre + '.blockmap'), 'blockmap de prueba');
  }
  return dir;
}
test('cuatro plataformas con la arquitectura explícita y metadatos de Windows separados por arquitectura', () => {
  assert.deepEqual(Object.entries(METADATOS), [
    ['latest.yml', ['windows-x86_64', 'exe']], ['latest-arm64.yml', ['windows-arm64', 'exe']],
    ['latest-linux.yml', ['linux-x86_64', 'AppImage']], ['latest-linux-arm64.yml', ['linux-arm64', 'AppImage']]]);
});
test('release exige las cuatro plataformas completas y genera las sumas de todos sus archivos', () => {
  const dir = fixture();
  try {
    const archivos = verificarDirectorio(dir, '1.1.0');
    assert.equal(archivos.length, 11);
    const sumas = readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8');
    assert.equal(sumas.trim().split('\n').length, 10);
    for (const f of archivos.filter(f => f !== 'SHA256SUMS.txt')) assert.ok(sumas.includes(createHash('sha256').update(readFileSync(join(dir, f))).digest('hex') + '  ' + f));
  } finally { rmSync(dir, { recursive: true }); }
});
test('no acepta binarios manipulados, plataformas incompletas ni versiones distintas', () => {
  const dir = fixture();
  try {
    assert.throws(() => verificarDirectorio(dir, '1.2.0'), /versión incorrecta/);
    const ruta = join(dir, 'Falcon-Engine-1.1.0-windows-x86_64.exe'), datos = readFileSync(ruta);
    datos[500] ^= 1; writeFileSync(ruta, datos);
    assert.throws(() => verificarDirectorio(dir, '1.1.0'), /SHA-512 incorrecto/);
    datos[500] ^= 1; writeFileSync(ruta, datos);
    // latest-arm64.yml no puede apuntar al instalador x86_64 (lo instalaría un equipo arm64).
    const arm = readFileSync(join(dir, 'latest-arm64.yml'), 'utf8');
    writeFileSync(join(dir, 'latest-arm64.yml'), readFileSync(join(dir, 'latest.yml')));
    assert.throws(() => verificarDirectorio(dir, '1.1.0'), /latest-arm64\.yml: falta el instalador esperado Falcon-Engine-1\.1\.0-windows-arm64\.exe/);
    writeFileSync(join(dir, 'latest-arm64.yml'), arm);
    rmSync(join(dir, 'latest-linux-arm64.yml'));
    assert.throws(() => verificarDirectorio(dir, '1.1.0'), /ENOENT/);
  } finally { rmSync(dir, { recursive: true }); }
});
