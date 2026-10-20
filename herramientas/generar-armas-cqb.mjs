import fs from 'node:fs/promises';
import path from 'node:path';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { crearArmaCQB } from '../src/motor/armas3d.js';
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};
const salida = path.resolve('recursos/cqb/modelos/armas'); await fs.mkdir(salida, { recursive: true });
for (const tipo of ['kestrel', 'lynx', 'hostil']) {
  const modelo = crearArmaCQB(tipo), binario = await new GLTFExporter().parseAsync(modelo, { binary: true });
  await fs.writeFile(path.join(salida, tipo + '.glb'), new Uint8Array(binario));
  console.log(tipo, binario.byteLength, 'bytes');
}
