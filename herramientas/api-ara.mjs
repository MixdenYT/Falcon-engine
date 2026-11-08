// Escribe src/ara/api-motor.js a partir de src/ara/motor.ara (hay que ejecutarlo al cambiar motor.ara).
import { readFile, writeFile } from 'node:fs/promises';
import { analizarMotor } from '../src/ara/api.js';

const motor = await readFile(new URL('../src/ara/motor.ara', import.meta.url), 'utf8');
const api = analizarMotor(motor);
await writeFile(new URL('../src/ara/api-motor.js', import.meta.url),
  `// Generado desde motor.ara con \`node herramientas/api-ara.mjs\` · no editar a mano.\nexport const API_MOTOR = ${JSON.stringify(api)};\n`);
console.log(`api-motor.js: ${Object.keys(api.propiedades).length} propiedades, ${Object.keys(api.metodos).length} métodos, ${Object.keys(api.funciones).length} funciones`);
