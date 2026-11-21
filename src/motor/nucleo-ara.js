// El núcleo del motor escrito en Ara (src/motor/ara/*.ara), precompilado a src/motor/ara/nucleo.wasm con
// herramientas/compilar-nucleo-ara.mjs. Se carga una vez (también en juegos exportados, que no llevan el compilador)
// y se usa con llamadas síncronas. Una sola instancia vale para todos los mundos: cada llamada a la física
// rellena su estado desde cero.

import { cargar } from '../ara/ara.mjs';
import { leerPropio, runtimeAra, compilado } from '../ara/puente.js';

let promesa = null;

/** El núcleo de Ara listo para usar (se carga la primera vez). */
export function nucleoAra() {
  return (promesa ||= crear().catch((e) => { promesa = null; throw e; }));
}

async function crear() {
  const [bytes, runtime] = await Promise.all([leerPropio('../motor/ara/nucleo.wasm', false), runtimeAra()]);
  const ara = await cargar(bytes, { runtime: compilado(runtime) });
  const E = ara.exports;
  const yo = E['Fisica2D.crear'](0);
  const f = (nombre) => E['Fisica2D.func.' + nombre].bind(null, yo);
  // Los `entero` de Ara cruzan como BigInt (i64); los booleanos, como 0/1.
  const solido = f('solido'), mosaico = f('mosaico'), celda = f('celda'), nodoSuelo = f('r_nodo_suelo'), contactos = f('r_contactos'), contacto = f('contacto');
  return {
    fisica2d: {
      vaciar: f('vaciar'),
      solido: (x0, y0, x1, y1, unaCara, nodo) => solido(x0, y0, x1, y1, unaCara, BigInt(nodo)),
      mosaico: (ox, oy, tam, nodo) => mosaico(ox, oy, tam, BigInt(nodo)),
      celda: (c, f) => celda(BigInt(c), BigInt(f)),
      mover: f('mover'),
      cx: f('r_cx'), cy: f('r_cy'), empX: f('r_emp_x'), empY: f('r_emp_y'), vy: f('r_vy'),
      suelo: f('r_suelo'), pared: f('r_pared'), techo: f('r_techo'),
      nodoSuelo: () => Number(nodoSuelo()),
      contactos: () => Number(contactos()),
      contacto: (i) => Number(contacto(BigInt(i))),
    },
    /** El error pendiente de Ara (`{ mensaje }`) o null; lo borra. */
    error() { const e = ara.error(); if (e) ara.limpiarError(); return e; },
  };
}
