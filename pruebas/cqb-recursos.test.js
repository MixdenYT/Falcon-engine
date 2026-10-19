import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const base = fileURLToPath(new URL('../recursos/cqb', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
test('CQB: cada recurso incluido coincide con su hash de distribución', () => {
  for (const rel of manifest.archivos) assert.equal(sha(fs.readFileSync(path.join(base, rel))), manifest.hashes[rel], rel);
});
test('CQB: los bloques reconstruyen exactamente ambos GLB y conservan su cabecera', () => {
  assert.equal(Object.keys(manifest.fragmentos).length, 2);
  for (const [modelo, partes] of Object.entries(manifest.fragmentos)) {
    const bytes = Buffer.concat(partes.map(p => { const b = fs.readFileSync(path.join(base, p.ruta)); assert.equal(b.length, p.bytes); assert.equal(sha(b), p.sha256); return b; }));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF'); assert.equal(bytes.readUInt32LE(8), bytes.length); assert.equal(sha(bytes), manifest.hashes[modelo]);
  }
});
