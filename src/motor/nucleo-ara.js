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
    espacio3d: espacio3d(E, B),
    fisica3d: fisica3d(E, B),
    movimiento3d: movimiento3d(E),
    camara3d: camara3d(E),
    /** El error pendiente de Ara (`{ mensaje }`) o null; lo borra. */
    error() { const e = ara.error(); if (e) ara.limpiarError(); return e; },
  };
}

// Rayos y A* de la parte 3D (src/motor/ara/espacio3d.ara). Las cajas y los dueños cruzan como decimales: sin BigInt.
function espacio3d(E, B) {
  const yo = E['Espacio3D.crear'](0);
  const f = (nombre) => E['Espacio3D.func.' + nombre].bind(null, yo);
  const rayo = f('rayo'), ruta = f('ruta'), celda = f('ruta_celda');
  return {
    vaciar: f('vaciar'),
    caja: f('caja'), // (x0, y0, z0, x1, y1, z1, dueño)
    rayo: (ox, oy, oz, dx, dy, dz, alcance, igA, igB) => Number(rayo(ox, oy, oz, dx, dy, dz, alcance, igA, igB)),
    t: f('r_t'), x: f('r_x'), y: f('r_y'), z: f('r_z'),
    ruta: (ancho, alto, x0, z0, tam, ix, iz, fx, fz, altura) => Number(ruta(B(ancho), B(alto), x0, z0, tam, B(ix), B(iz), B(fx), B(fz), altura)),
    celda: (i) => Number(celda(B(i))),
  };
}


// Solucionador de colisiones 3D en Ara. Las AABB llegan desde Three.js; el movimiento y las decisiones físicas no.
function fisica3d(E, B) {
  const yo = E['Fisica3D.crear'](0);
  const f = (nombre) => E['Fisica3D.func.' + nombre].bind(null, yo);
  const empezar = f('empezar'), preparar = f('preparar'), empezarPersonaje = f('empezar_personaje');
  const caja = f('caja'), mover = f('mover');
  const rx = f('r_x'), ry = f('r_y'), rz = f('r_z');
  const rvx = f('r_vx'), rvy = f('r_vy'), rvz = f('r_vz');
  const rempx = f('r_emp_x'), rempz = f('r_emp_z');
  const banderas = f('r_banderas'), contactos = f('r_contactos'), contacto = f('contacto');
  return {
    empezar: () => empezar(),
    preparar: () => preparar(),
    empezarPersonaje: () => empezarPersonaje(),
    caja: (x0, y0, z0, x1, y1, z1, dueno, cuerpo = false, movil = false) =>
      caja(x0, y0, z0, x1, y1, z1, B(dueno), cuerpo, movil),
    mover: (x, y, z, radio, altura, alturaTecho, vx, vz, empX, empZ, amort, vy, usaGravedad, gravedad, escalaGravedad, dt) =>
      mover(x, y, z, radio, altura, alturaTecho, vx, vz, empX, empZ, amort, vy, usaGravedad, gravedad, escalaGravedad, dt),
    x: () => rx(), y: () => ry(), z: () => rz(),
    vx: () => rvx(), vy: () => rvy(), vz: () => rvz(),
    empX: () => rempx(), empZ: () => rempz(),
    banderas: () => Number(banderas()),
    contactos: () => Number(contactos()),
    contacto: (i) => Number(contacto(B(i))),
  };
}


// Control de movimiento en Ara. La capa JS solo muestrea entrada y ejes de cámara.
function movimiento3d(E) {
  const yo = E['Movimiento3D.crear'](0);
  const f = (nombre) => E['Movimiento3D.func.' + nombre].bind(null, yo);
  const actualizar = f('actualizar');
  const rvx = f('r_vx'), rvz = f('r_vz'), rvy = f('r_vy');
  const rmx = f('r_mueve_x'), rmz = f('r_mueve_z');
  const rc = f('r_coyote'), rr = f('r_recordado'), ra = f('r_altura'), rb = f('r_banderas');
  return {
    actualizar: (...args) => actualizar(...args),
    vx: () => rvx(), vz: () => rvz(), vy: () => rvy(),
    mueveX: () => rmx(), mueveZ: () => rmz(),
    coyote: () => rc(), recordado: () => rr(), altura: () => ra(),
    banderas: () => Number(rb()),
  };
}


// Matemática de cámara en Ara. Three.js conserva únicamente raycasts y aplicación de transformadas.
function camara3d(E) {
  const yo = E['Camara3D.crear'](0);
  const f = (nombre) => E['Camara3D.func.' + nombre].bind(null, yo);
  const iniciar = f('iniciar'), cambiarModo = f('cambiar_modo');
  const preparar = f('preparar'), finalizar = f('finalizar');
  const nombres = {
    yaw: 'r_yaw', pitch: 'r_pitch', distancia: 'r_distancia',
    distanciaActual: 'r_distancia_actual', deseada: 'r_deseada', zoom: 'r_zoom',
    pivoteX: 'r_pivote_x', pivoteY: 'r_pivote_y', pivoteZ: 'r_pivote_z',
    dirX: 'r_dir_x', dirY: 'r_dir_y', dirZ: 'r_dir_z',
    camX: 'r_cam_x', camY: 'r_cam_y', camZ: 'r_cam_z', roll: 'r_roll',
    fov: 'r_fov', fovBase: 'r_fov_base', sinRaton: 'r_sin_raton',
    fase: 'r_fase', bob: 'r_bob', golpe: 'r_golpe', caidaMax: 'r_caida_max',
    enSueloAntes: 'r_en_suelo_antes', inclinacion: 'r_inclinacion',
    ads: 'r_ads', retroceso: 'r_retroceso', ocultar: 'r_ocultar',
  };
  const getters = {};
  for (const [clave, nombre] of Object.entries(nombres)) {
    const leer = f(nombre);
    getters[clave] = () => leer();
  }
  return {
    iniciar: (...args) => iniciar(...args),
    cambiarModo: (...args) => cambiarModo(...args),
    preparar: (...args) => preparar(...args),
    finalizar: (...args) => finalizar(...args),
    ...getters,
  };
}
