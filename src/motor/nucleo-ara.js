// El núcleo del motor escrito en Ara (src/motor/ara/*.ara), precompilado a src/motor/ara/nucleo.wasm con
// herramientas/compilar-nucleo-ara.mjs. Se carga una vez (también en juegos exportados, que no llevan el compilador)
// y se usa con llamadas síncronas. Una sola instancia vale para todos los mundos: la física guarda los nodos entre
// fotogramas, y `Mundo.sincronizarAra` los vuelve a mandar todos cuando el núcleo cambia de mundo (`fisica2d.dueno`).

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
  const B = BigInt;
  const empezar = f('empezar'), nodo = f('nodo'), preparar = f('preparar'), solidoCx = f('solido_cx'), solidoCy = f('solido_cy');
  const celda = f('celda'), mover = f('mover'), banderas = f('r_banderas'), nodoSuelo = f('r_nodo_suelo');
  const contactos = f('r_contactos'), contacto = f('contacto'), pares = f('pares'), parA = f('par_a'), parB = f('par_b');
  return {
    fisica2d: {
      empezar: (n) => empezar(B(n)),
      nodo: (i, padre, sinMatriz, x, y, grados, esc, sx, sy, cajaTipo, ox, oy, w, h, solido, papel) =>
        nodo(B(i), B(padre), sinMatriz, x, y, grados, esc, sx, sy, B(cajaTipo), ox, oy, w, h, B(solido), B(papel)),
      preparar: () => Number(preparar()),
      solidoCx: (k) => solidoCx(B(k)),
      solidoCy: (k) => solidoCy(B(k)),
      vaciarCeldas: f('vaciar_celdas'),
      celda: (m, c, f) => celda(B(m), B(c), B(f)),
      mover: (i, mueveX, mueveY, empX, empY, vy, gravedad, g, dt, amort, arrX, arrY) =>
        mover(B(i), mueveX, mueveY, empX, empY, vy, gravedad, g, dt, amort, arrX, arrY),
      ddx: f('r_ddx'), ddy: f('r_ddy'), empX: f('r_emp_x'), empY: f('r_emp_y'), vy: f('r_vy'),
      banderas: () => Number(banderas()), // suelo 1, pared 2, techo 4
      nodoSuelo: () => Number(nodoSuelo()),
      contactos: () => Number(contactos()),
      contacto: (k) => Number(contacto(B(k))),
      pares: () => Number(pares()),
      parA: (k) => Number(parA(B(k))),
      parB: (k) => Number(parB(B(k))),
    },
    /** El error pendiente de Ara (`{ mensaje }`) o null; lo borra. */
    error() { const e = ara.error(); if (e) ara.limpiarError(); return e; },
  };
}
