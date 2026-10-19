// Punto de entrada del lenguaje Águila.
export { analizarLexico, PALABRAS_CLAVE } from './lexico.js';
export { analizar } from './sintaxis.js';
export { Interprete, InstanciaScript, FuncionAguila, ClaseAguila, ObjetoAguila, Entorno, aTexto, tipoDe, esVerdad } from './interprete.js';
export { ErrorAguila, sugerir, distancia } from './errores.js';
export { PALABRAS, EVENTOS, FUNCIONES, METODOS_LISTA, METODOS_TEXTO, METODOS_DICCIONARIO, crearNativasBasicas, miembrosNativos } from './biblioteca.js';
export { analizarCodigo, rutaEnLinea, formatear } from './analizador.js';

import { Interprete } from './interprete.js';
import { crearNativasBasicas, miembrosNativos } from './biblioteca.js';

// Crea un intérprete con la biblioteca básica ya cargada.
export function crearInterprete(opciones = {}) {
  const salida = opciones.salida || ((t) => console.log(t));
  const interp = new Interprete({ ...opciones, salida, miembrosNativos });
  for (const [k, v] of Object.entries(crearNativasBasicas(interp, salida))) interp.definirGlobal(k, v);
  return interp;
}
