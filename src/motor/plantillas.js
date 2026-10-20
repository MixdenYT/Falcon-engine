// Plantillas de proyecto. Cada una genera todos los archivos de un proyecto nuevo.
import { crearNodo } from './tipos.js';
import { datosProyecto, escenaVacia } from './proyecto.js';
import { blueprintVacio, compilarBlueprint, idNodoBp } from './blueprints.js';
import * as gen from './generadores.js';
import { plantillaAcademia } from './academia.js';
import { plantillaShooter } from './shooters.js';
import { plantillaCQB } from './cqb.js';

export const PLANTILLAS = [
  { id: 'vacio2d', nombre: 'Juego 2D', tipo: '2D', descripcion: 'Sprites, mosaicos y física 2D', icono: 'imagen', basica: true },
  { id: 'vacio3d', nombre: 'Juego 3D', tipo: '3D', descripcion: 'Mallas, luces y cámara en primera o tercera persona', icono: 'cubo', basica: true },
  { id: 'academia_blueprints', nombre: 'Academia de Blueprints', tipo: '2D', descripcion: '67 laboratorios: todos los bloques, funciones, señales y ejercicios con guía completa.', icono: 'libro', etiqueta: 'Curso completo' },
  { id: 'shooter_tercera', nombre: 'Shooter · Base abierta', tipo: '3D', descripcion: 'Tercera persona, flancos, cobertura y seis enemigos. Incluye también el mapa CQB.', icono: 'cubo', etiqueta: 'Combate 3D' },
  { id: 'shooter_primera', nombre: 'Shooter · CQB', tipo: '3D', descripcion: 'Operación Umbral: puertas, miras, inclinación, dos armas y tres contactos. Blueprints + Águila.', icono: 'cubo', etiqueta: 'Táctico' },
  { id: 'plataformas', nombre: 'Plataformas', tipo: '2D', descripcion: 'Salta, recoge monedas, esquiva enemigos y llega a la bandera.', icono: 'persona', etiqueta: 'Blueprints + Águila' },
  { id: 'topdown', nombre: 'Aventura top-down', tipo: '2D', descripcion: 'Vista desde arriba: recoge gemas y huye de las babosas.', icono: 'estrella', etiqueta: 'Águila' },
  { id: 'puzzle', nombre: 'Puzle de cajas', tipo: '2D', descripcion: 'Empuja las cajas hasta las marcas, casilla a casilla.', icono: 'plantillas', etiqueta: 'Águila' },
  { id: 'mazmorra', nombre: 'Mazmorra 3D', tipo: '3D', descripcion: 'Explora en tercera persona con antorchas y un cofre.', icono: 'cubo', etiqueta: 'Blueprints' },
  { id: 'pruebas_luz', nombre: 'Pruebas de iluminación', tipo: '3D', descripcion: 'Mapa para probar Lumbre: rebotes de color, ventana, espejos, neón, sombras y día/noche.', icono: 'sol', etiqueta: 'Lumbre' },
  { id: 'curso', nombre: 'Mi primer juego', tipo: '2D', descripcion: 'El proyecto del curso guiado, en modo Sencillo.', icono: 'libro', etiqueta: 'Curso' },
];

const N = (tipo, nombre, props = {}, hijos = [], extra = {}) => Object.assign(crearNodo(tipo, nombre, props, hijos), extra);

const CARPETAS_2D = ['escenas', 'sprites/personajes', 'sprites/mosaicos', 'blueprints', 'scripts', 'generado', 'sonidos', 'música', 'fuentes'];
const CARPETAS_3D = ['escenas', 'modelos', 'materiales', 'texturas', 'blueprints', 'scripts', 'generado', 'sonidos', 'música'];

// ---------- Scripts de ejemplo ----------
const S = {
  moneda: `# moneda.agl · se recoge al tocarla
cuando toca(otro):
    si otro.es("Jugador"):
        ganar_puntos(1)
        sonar("moneda.wav", 0.7)
        yo.eliminar()
`,
  peligro: `# peligro.agl · los pinchos hacen volver a empezar
cuando toca(otro):
    si otro.es("Jugador"):
        sonar("golpe.wav")
        temblar_camara(10, 0.3)
        otro.empujar(0, -500)
        esperar(0.4)
        reiniciar_nivel()
`,
  enemigo: `# enemigo.agl · patrulla de un lado a otro
clase Enemigo extiende Personaje2D:
    exportar variable velocidad = 90
    variable direccion = -1

    cuando se_actualiza(delta):
        mover(direccion * velocidad)
        si en_pared():
            direccion = -direccion
        hijo("Sprite").voltear_h = direccion > 0

    cuando toca(otro):
        si otro.es("Jugador"):
            si otro.y < y - 20:
                # Le ha caído encima: el enemigo desaparece
                otro.empujar(0, -450)
                sonar("golpe.wav")
                ganar_puntos(5)
                eliminar()
            sino:
                temblar_camara(8, 0.25)
                reiniciar_nivel()
`,
  meta: `# meta.agl · llegar a la bandera gana el nivel
cuando toca(otro):
    si otro.es("Jugador"):
        sonar("ganar.wav")
        ganar_partida()
`,
  contador: `# contador.agl · muestra las monedas recogidas
cuando se_actualiza(delta):
    texto = texto(puntos)
`,
  nivel: `# nivel.agl · reglas generales del nivel
cuando empieza():
    musica("tema.wav")
    mostrar("¡Hola, aventurero!")

cuando se_actualiza(delta):
    # Si el jugador se cae por un agujero, se reinicia el nivel
    si nodo("Jugador").y > 900:
        reiniciar_nivel()
`,
  jugadorEscrito: `# jugador.agl · lógica del jugador escrita en Águila
# (el Jugador usa ahora jugador.bp; puedes cambiarlo en el Inspector)
clase Jugador extiende Personaje2D:

    exportar variable velocidad = 220
    exportar variable altura_salto = 420
    variable monedas = 0

    cuando empieza():
        mostrar("¡Hola, aventurero!")

    cuando se_actualiza(delta):
        variable direccion = eje("izquierda", "derecha")
        mover(direccion * velocidad)

        si se_pulsa("saltar") y en_el_suelo():
            saltar(altura_salto)

    cuando toca(otro):
        si otro.es("Moneda"):
            monedas = monedas + 1
            si monedas >= 10:
                ganar_partida()
`,
  gema: `# gema.agl · cuando no quedan gemas, se gana
cuando toca(otro):
    si otro.es("Jugador"):
        ganar_puntos(1)
        sonar("moneda.wav", 0.7)
        eliminar()
        si largo(grupo("gemas")) == 0:
            sonar("ganar.wav")
            ganar_partida()
`,
  babosa: `# babosa.agl · persigue al jugador si está cerca
clase Babosa extiende Personaje2D:
    exportar variable velocidad = 70
    exportar variable vista = 280

    cuando se_actualiza(delta):
        variable j = nodo("Jugador")
        si j != nulo y distancia_a(j) < vista:
            variable d = max(1, distancia_a(j))
            mover((j.x - x) / d * velocidad, (j.y - y) / d * velocidad)

    cuando toca(otro):
        si otro.es("Jugador"):
            sonar("golpe.wav")
            temblar_camara(8, 0.3)
            reiniciar_nivel()
`,
  cajas: `# jugador.agl · se mueve de casilla en casilla y empuja cajas
exportar variable casilla = 64

cuando empieza():
    mostrar("Lleva las cajas a las marcas. Pulsa E para reiniciar.")
    pintar_cajas()

función hay_muro(cx, cy):
    devolver nodo("Muros").hay_mosaico(cx, cy)

función caja_en(cx, cy):
    para cada c en grupo("cajas"):
        si redondear_abajo(c.x / casilla) == cx y redondear_abajo(c.y / casilla) == cy:
            devolver c
    devolver nulo

función intentar_mover(dx, dy):
    variable cx = redondear_abajo(x / casilla) + dx
    variable cy = redondear_abajo(y / casilla) + dy
    si hay_muro(cx, cy):
        devolver
    variable caja = caja_en(cx, cy)
    si caja != nulo:
        si hay_muro(cx + dx, cy + dy) o caja_en(cx + dx, cy + dy) != nulo:
            devolver
        caja.desplazar(dx * casilla, dy * casilla)
        sonar("golpe.wav", 0.4)
    desplazar(dx * casilla, dy * casilla)
    pintar_cajas()
    comprobar_victoria()

función en_objetivo(c):
    para cada o en grupo("objetivos"):
        si redondear_abajo(o.x / casilla) == redondear_abajo(c.x / casilla) y redondear_abajo(o.y / casilla) == redondear_abajo(c.y / casilla):
            devolver verdadero
    devolver falso

función pintar_cajas():
    para cada c en grupo("cajas"):
        si en_objetivo(c):
            c.color = "#3DDC84"
        sino:
            c.color = "#B07A43"

función comprobar_victoria():
    para cada c en grupo("cajas"):
        si no en_objetivo(c):
            devolver
    sonar("ganar.wav")
    ganar_partida()

cuando se_pulsa("izquierda"):
    intentar_mover(-1, 0)

cuando se_pulsa("derecha"):
    intentar_mover(1, 0)

cuando se_pulsa("arriba"):
    intentar_mover(0, -1)

cuando se_pulsa("abajo"):
    intentar_mover(0, 1)

cuando se_pulsa("accion"):
    reiniciar_nivel()
`,
  antorcha: `# antorcha.agl · la llama parpadea
variable base = 6

cuando se_actualiza(delta):
    intensidad = base + seno(tiempo() * 900) * 0.6 + aleatorio(-0.4, 0.4)
`,
  menu: `# menu.agl · pantalla de inicio
cuando empieza():
    musica("tema.wav")

cuando se_pulsa("saltar"):
    cambiar_escena("nivel1")
`,
};

export const SCRIPTS = S;

// ---------- Blueprints ----------

function bpJugador() {
  const bp = blueprintVacio('jugador', 'Personaje2D');
  bp.variables = [
    { nombre: 'velocidad', tipo: 'decimal', valor: 220, exportar: true },
    { nombre: 'salto', tipo: 'decimal', valor: 620, exportar: true },
    { nombre: 'monedas', tipo: 'entero', valor: 0, exportar: false },
  ];
  bp.funciones = [{ nombre: 'recoger_moneda', params: [] }];
  const id = {};
  const n = (k, def, x, y, extra = {}) => { id[k] = idNodoBp() + k; return { id: id[k], def, x, y, ...extra }; };
  const nodos = [
    n('act', 'ev_actualizar', 40, 40),
    n('eje', 'in_eje', 40, 170, { valores: { negativa: 'izquierda', positiva: 'derecha' } }),
    n('vel', 'var_obtener', 60, 330, { variable: 'velocidad' }),
    n('mul', 'mt_multiplicar', 300, 220),
    n('mov', 'mv_mover', 300, 40),
    n('si', 'lg_si', 560, 40),
    n('pul', 'in_pulsada', 300, 380, { valores: { accion: 'saltar' } }),
    n('suelo', 'mv_suelo', 300, 520),
    n('y', 'lg_y', 560, 420),
    n('sal', 'var_obtener', 800, 280, { variable: 'salto' }),
    n('saltar', 'mv_saltar', 800, 40),
    n('son', 'au_sonar', 1040, 40, { valores: { sonido: 'salto.wav', volumen: 0.6 } }),
  ];
  const c = (a, sa, b, eb) => ({ de: id[a], salida: sa, a: id[b], entrada: eb });
  bp.grafos.eventos = {
    nodos,
    conexiones: [
      c('act', 'salida', 'mov', 'entrada'), c('eje', 'valor', 'mul', 'a'), c('vel', 'valor', 'mul', 'b'), c('mul', 'resultado', 'mov', 'x'),
      c('mov', 'salida', 'si', 'entrada'), c('pul', 'pulsada', 'y', 'a'), c('suelo', 'valor', 'y', 'b'), c('y', 'resultado', 'si', 'condicion'),
      c('si', 'verdadero', 'saltar', 'entrada'), c('sal', 'valor', 'saltar', 'fuerza'), c('saltar', 'salida', 'son', 'entrada'),
    ],
    comentarios: [{ id: 'com1', x: 560, y: 600, ancho: 330, alto: 64, texto: 'Salta solo si se pulsa «saltar» y el jugador toca el suelo.' }],
  };
  const f = idNodoBp();
  const m = idNodoBp();
  bp.grafos['fn:recoger_moneda'] = {
    nodos: [{ id: f, def: 'fn_entrada', funcion: 'recoger_moneda', x: 60, y: 60 }, { id: m, def: 'var_sumar', variable: 'monedas', x: 320, y: 60, valores: { cantidad: 1 } }],
    conexiones: [{ de: f, salida: 'salida', a: m, entrada: 'entrada' }],
    comentarios: [],
  };
  return bp;
}

function bpMonedas() {
  const bp = blueprintVacio('monedas', 'Area2D');
  const t = idNodoBp(), si = idNodoBp(), es = idNodoBp(), p = idNodoBp(), el = idNodoBp();
  bp.grafos.eventos = {
    nodos: [
      { id: t, def: 'ev_tocar', x: 40, y: 40 },
      { id: es, def: 'lg_es', x: 40, y: 180, valores: { nombre: 'Jugador' } },
      { id: si, def: 'lg_si', x: 300, y: 40 },
      { id: p, def: 'es_puntos', x: 540, y: 40, valores: { cantidad: 1 } },
      { id: el, def: 'es_eliminar', x: 780, y: 40 },
    ],
    conexiones: [
      { de: t, salida: 'salida', a: si, entrada: 'entrada' },
      { de: t, salida: 'otro', a: es, entrada: 'objeto' },
      { de: es, salida: 'resultado', a: si, entrada: 'condicion' },
      { de: si, salida: 'verdadero', a: p, entrada: 'entrada' },
      { de: p, salida: 'salida', a: el, entrada: 'entrada' },
    ],
    comentarios: [],
  };
  return bp;
}

function bpCofre() {
  const bp = blueprintVacio('cofre', 'Malla3D');
  bp.variables = [{ nombre: 'abierto', tipo: 'bool', valor: false, exportar: false }];
  const t = idNodoBp(), es = idNodoBp(), si = idNodoBp(), m = idNodoBp(), p = idNodoBp(), g = idNodoBp(), s = idNodoBp();
  bp.grafos.eventos = {
    nodos: [
      { id: t, def: 'ev_tocar', x: 40, y: 40 },
      { id: es, def: 'lg_es', x: 40, y: 180, valores: { nombre: 'Jugador' } },
      { id: si, def: 'lg_si', x: 300, y: 40 },
      { id: m, def: 'es_mostrar', x: 540, y: 40, valores: { texto: '¡Has abierto el cofre!' } },
      { id: s, def: 'au_sonar', x: 780, y: 40, valores: { sonido: 'ganar.wav', volumen: 1 } },
      { id: p, def: 'es_puntos', x: 1020, y: 40, valores: { cantidad: 100 } },
      { id: g, def: 'es_ganar', x: 1260, y: 40 },
    ],
    conexiones: [
      { de: t, salida: 'salida', a: si, entrada: 'entrada' },
      { de: t, salida: 'otro', a: es, entrada: 'objeto' },
      { de: es, salida: 'resultado', a: si, entrada: 'condicion' },
      { de: si, salida: 'verdadero', a: m, entrada: 'entrada' },
      { de: m, salida: 'salida', a: s, entrada: 'entrada' },
      { de: s, salida: 'salida', a: p, entrada: 'entrada' },
      { de: p, salida: 'salida', a: g, entrada: 'entrada' },
    ],
    comentarios: [{ id: 'c1', x: 300, y: 220, ancho: 300, alto: 60, texto: 'Al tocar el cofre, el jugador gana la partida.' }],
  };
  return bp;
}

// ---------- Construcción de nodos frecuentes ----------

function jugador2D(x, y, opciones = {}) {
  return N('Personaje2D', 'Jugador', { posicion: [x, y], ...(opciones.props || {}) }, [
    N('Sprite', 'Sprite', { imagen: 'sprites/personajes/jugador.png', ancho: 52, alto: 65, forma: 'personaje', fps: 10 }),
    N('Colision', 'Colisión', { ancho: 40, alto: 62 }),
    ...(opciones.camara === false ? [] : [N('Camara2D', 'Cámara2D', { suavizado: 0.12, limitar: !!opciones.limites, limites: opciones.limites || [0, 0, 2000, 720] })]),
  ], opciones.extra || {});
}

function moneda(x, y, logica = { script: 'scripts/moneda.agl' }) {
  return N('Area2D', 'Moneda', { posicion: [x, y] }, [
    N('Sprite', 'Sprite', { imagen: 'sprites/personajes/moneda.png', ancho: 30, alto: 30, forma: 'circulo', color: '#F2C46D', animando: true, fps: 12 }),
    N('Colision', 'Colisión', { ancho: 26, alto: 26 }),
  ], { ...logica, grupos: ['monedas'] });
}

function plataforma(nombre, x, y, ancho, alto = 26) {
  return N('Plataforma', nombre, { posicion: [x, y], ancho, alto, color: '#7A4E2D', color_borde: '#5CC35A' });
}

function suelo(columnas, filaSuperior = 15, filas = 3, tam = 40, huecos = []) {
  const celdas = {};
  for (let c = 0; c < columnas; c++) {
    if (huecos.some(([a, b]) => c >= a && c <= b)) continue;
    for (let f = 0; f < filas; f++) celdas[`${c},${filaSuperior + f}`] = f === 0 ? 0 : 1;
  }
  return celdas;
}

function interfazContador() {
  return N('Interfaz', 'Interfaz', {}, [
    N('Etiqueta', 'Contador', { posicion: [24, 22], texto: '0', tam: 26, icono: 'moneda', fondo: true }, [], { script: 'scripts/contador.agl' }),
    N('Etiqueta', 'Ayuda', { posicion: [640, 684], texto: '← → para moverte · Espacio para saltar', tam: 15, color: '#A9B5AE', alineacion: 'centro' }),
  ]);
}

// ---------- Plantillas ----------

async function recursos2D(archivos, importacion) {
  archivos['sprites/personajes/jugador.png'] = await gen.spriteJugador();
  archivos['sprites/personajes/enemigo.png'] = await gen.spriteEnemigo();
  archivos['sprites/personajes/moneda.png'] = await gen.spriteMoneda();
  archivos['sprites/mosaicos/cesped.png'] = await gen.spriteCesped();
  archivos['sprites/fondo.png'] = await gen.spriteFondo();
  archivos['sonidos/salto.wav'] = gen.sintetizar('salto');
  archivos['sonidos/moneda.wav'] = gen.sintetizar('moneda');
  archivos['sonidos/golpe.wav'] = gen.sintetizar('golpe');
  archivos['sonidos/ganar.wav'] = gen.sintetizar('ganar');
  archivos['música/tema.wav'] = gen.sintetizar('tema');
  Object.assign(importacion, {
    'sprites/personajes/jugador.png': { columnas: 4, filas: 1, filtro: 'suave', animaciones: { andar: [0, 3] } },
    'sprites/personajes/enemigo.png': { columnas: 6, filas: 1, filtro: 'suave' },
    'sprites/personajes/moneda.png': { columnas: 8, filas: 1, filtro: 'suave' },
    'sprites/mosaicos/cesped.png': { columnas: 4, filas: 1, filtro: 'suave', uso: 'mosaico' },
    'sprites/fondo.png': { columnas: 1, filas: 1, filtro: 'suave', uso: 'fondo' },
    'música/tema.wav': { bucle: true },
  });
}

async function plantillaPlataformas(nombre) {
  const archivos = {};
  const importacion = {};
  await recursos2D(archivos, importacion);
  const ANCHO = 70 * 40;
  const nivel = N('Nodo2D', 'Nivel1', {}, [
    N('Fondo', 'Fondo', { imagen: 'sprites/fondo.png', paralaje: 0.25 }),
    jugador2D(220, 568, { limites: [0, 0, ANCHO, 720], extra: { blueprint: 'blueprints/jugador.bp' } }),
    N('Mosaicos', 'Mosaicos', { tam_celda: 40, imagen: 'sprites/mosaicos/cesped.png', color: '#6B4528', color_borde: '#52B85A', celdas: suelo(70, 15, 3, 40, [[22, 24], [44, 45]]) }),
    N('Nodo2D', 'Plataformas', {}, [
      plataforma('Plataforma', 680, 470, 200), plataforma('Plataforma2', 980, 380, 160),
      plataforma('Plataforma3', 1300, 300, 180), plataforma('Plataforma4', 1650, 440, 220), plataforma('Plataforma5', 2050, 360, 180),
      N('Plataforma', 'Roca', { posicion: [1350, 585], ancho: 30, alto: 30, color: '#59615C', color_borde: '#6B746E' }),
      N('Plataforma', 'Roca2', { posicion: [1990, 585], ancho: 30, alto: 30, color: '#59615C', color_borde: '#6B746E' }),
    ]),
    N('Nodo2D', 'Monedas', {}, [
      moneda(640, 425), moneda(720, 425), moneda(940, 520), moneda(980, 335), moneda(1260, 255), moneda(1340, 255),
      moneda(1600, 395), moneda(1700, 395), moneda(2050, 315), moneda(2300, 560), moneda(2360, 560), moneda(2420, 560),
    ]),
    N('Area2D', 'Pinchos', { posicion: [1150, 586] }, [
      N('Sprite', 'Sprite', { forma: 'triangulo', color: '#C2414F', ancho: 52, alto: 28 }),
      N('Colision', 'Colisión', { ancho: 40, alto: 20, posicion: [0, 4] }),
    ], { script: 'scripts/peligro.agl', grupos: ['peligros'] }),
    N('Personaje2D', 'Enemigo', { posicion: [1700, 578], velocidad: 90 }, [
      N('Sprite', 'Sprite', { imagen: 'sprites/personajes/enemigo.png', ancho: 54, alto: 54, forma: 'enemigo', color: '#B04A6A', animando: true, fps: 8 }),
      N('Colision', 'Colisión', { ancho: 44, alto: 40, posicion: [0, 6] }),
    ], { script: 'scripts/enemigo.agl', grupos: ['enemigos'] }),
    N('Area2D', 'Meta', { posicion: [2680, 560] }, [
      N('Sprite', 'Sprite', { forma: 'bandera', color: '#3DDC84', ancho: 52, alto: 80 }),
      N('Colision', 'Colisión', { ancho: 36, alto: 80 }),
    ], { script: 'scripts/meta.agl' }),
    interfazContador(),
  ], { script: 'scripts/nivel.agl' });

  const menu = N('Nodo2D', 'Menu', {}, [
    N('Fondo', 'Fondo', { imagen: 'sprites/fondo.png', paralaje: 0 }),
    N('Interfaz', 'Interfaz', {}, [
      N('Etiqueta', 'Titulo', { posicion: [640, 230], texto: nombre, tam: 72, alineacion: 'centro' }),
      N('Etiqueta', 'Subtitulo', { posicion: [640, 300], texto: 'Recoge las monedas y llega a la bandera', tam: 20, color: '#A9B5AE', alineacion: 'centro' }),
      N('Boton', 'Jugar', { posicion: [540, 360], texto: 'Jugar', ancho: 200, alto: 56, escena: 'escenas/nivel1.fscn' }),
      N('Etiqueta', 'Pista', { posicion: [640, 460], texto: 'o pulsa Espacio', tam: 15, color: '#6E7A73', alineacion: 'centro' }),
    ]),
  ], { script: 'scripts/menu.agl' });

  const bp = bpJugador();
  const bpm = bpMonedas();
  Object.assign(archivos, {
    'escenas/nivel1.fscn': escenaVacia('2D', nivel),
    'escenas/menu.fscn': escenaVacia('2D', menu),
    'blueprints/jugador.bp': bp,
    'blueprints/monedas.bp': bpm,
    'generado/jugador.agl': compilarBlueprint(bp, 'jugador.bp').codigo,
    'generado/monedas.agl': compilarBlueprint(bpm, 'monedas.bp').codigo,
    'scripts/moneda.agl': S.moneda, 'scripts/peligro.agl': S.peligro, 'scripts/enemigo.agl': S.enemigo,
    'scripts/meta.agl': S.meta, 'scripts/contador.agl': S.contador, 'scripts/nivel.agl': S.nivel,
    'scripts/jugador.agl': S.jugadorEscrito, 'scripts/menu.agl': S.menu,
  });
  const datos = datosProyecto(nombre, '2D');
  datos.escena_principal = 'escenas/nivel1.fscn';
  datos.fondo = '#10293A';
  return { datos, archivos, importacion, carpetas: CARPETAS_2D, abrir: ['escenas/nivel1.fscn'] };
}

async function plantillaTopdown(nombre) {
  const archivos = {};
  const importacion = {};
  await recursos2D(archivos, importacion);
  const muros = [];
  const W = 1600, H = 1000;
  muros.push(N('Plataforma', 'MuroArriba', { posicion: [W / 2, 20], ancho: W, alto: 40, color: '#3B4A3F', color_borde: '#4E6152' }));
  muros.push(N('Plataforma', 'MuroAbajo', { posicion: [W / 2, H - 20], ancho: W, alto: 40, color: '#3B4A3F', color_borde: '#4E6152' }));
  muros.push(N('Plataforma', 'MuroIzq', { posicion: [20, H / 2], ancho: 40, alto: H, color: '#3B4A3F', color_borde: '#4E6152' }));
  muros.push(N('Plataforma', 'MuroDer', { posicion: [W - 20, H / 2], ancho: 40, alto: H, color: '#3B4A3F', color_borde: '#4E6152' }));
  muros.push(N('Plataforma', 'Columna', { posicion: [600, 400], ancho: 80, alto: 260, color: '#3B4A3F', color_borde: '#4E6152' }));
  muros.push(N('Plataforma', 'Columna2', { posicion: [1050, 640], ancho: 300, alto: 80, color: '#3B4A3F', color_borde: '#4E6152' }));
  const gema = (x, y) => N('Area2D', 'Gema', { posicion: [x, y] }, [
    N('Sprite', 'Sprite', { forma: 'estrella', color: '#4FD1C5', ancho: 34, alto: 34 }),
    N('Colision', 'Colisión', { ancho: 30, alto: 30 }),
  ], { script: 'scripts/gema.agl', grupos: ['gemas'] });
  const babosa = (x, y) => N('Personaje2D', 'Babosa', { posicion: [x, y], usa_gravedad: false }, [
    N('Sprite', 'Sprite', { imagen: 'sprites/personajes/enemigo.png', ancho: 54, alto: 54, animando: true, fps: 8 }),
    N('Colision', 'Colisión', { ancho: 40, alto: 34, posicion: [0, 8] }),
  ], { script: 'scripts/babosa.agl', grupos: ['enemigos'] });
  const raiz = N('Nodo2D', 'Mundo', {}, [
    N('Fondo', 'Fondo', { color: '#1E3A27', color2: '#183020', montanas: false, paralaje: 1 }),
    N('Nodo2D', 'Muros', {}, muros),
    jugador2D(200, 200, { props: { usa_gravedad: false, controles: 'vista_superior', velocidad: 240 }, limites: [0, 0, W, H] }),
    N('Nodo2D', 'Gemas', {}, [gema(400, 160), gema(820, 260), gema(1400, 180), gema(300, 820), gema(900, 860), gema(1420, 800), gema(1200, 460)]),
    N('Nodo2D', 'Enemigos', {}, [babosa(1100, 300), babosa(700, 800)]),
    N('Interfaz', 'Interfaz', {}, [
      N('Etiqueta', 'Contador', { posicion: [24, 22], texto: '0', tam: 26, icono: 'estrella', fondo: true }, [], { script: 'scripts/contador.agl' }),
      N('Etiqueta', 'Ayuda', { posicion: [640, 684], texto: 'Flechas o WASD para moverte · recoge todas las gemas', tam: 15, color: '#A9B5AE', alineacion: 'centro' }),
    ]),
  ]);
  Object.assign(archivos, {
    'escenas/mundo.fscn': escenaVacia('2D', raiz),
    'scripts/gema.agl': S.gema, 'scripts/babosa.agl': S.babosa, 'scripts/contador.agl': S.contador,
  });
  const datos = datosProyecto(nombre, '2D');
  datos.escena_principal = 'escenas/mundo.fscn';
  datos.gravedad = 0;
  return { datos, archivos, importacion, carpetas: CARPETAS_2D, abrir: ['escenas/mundo.fscn'] };
}

async function plantillaPuzzle(nombre) {
  const archivos = {};
  const importacion = {};
  await recursos2D(archivos, importacion);
  const mapa = [
    '##########',
    '#        #',
    '#  $  .  #',
    '#  @ $   #',
    '#    .   #',
    '#        #',
    '##########',
  ];
  const T = 64;
  const celdas = {};
  const cajas = [], objetivos = [];
  let jugador = [0, 0];
  mapa.forEach((fila, f) => [...fila].forEach((ch, c) => {
    const cx = c * T + T / 2, cy = f * T + T / 2;
    if (ch === '#') celdas[`${c},${f}`] = 3;
    if (ch === '$') cajas.push(N('Sprite', 'Caja', { posicion: [cx, cy], forma: 'redondeado', color: '#B07A43', ancho: 54, alto: 54, z: 2 }, [], { grupos: ['cajas'] }));
    if (ch === '.') objetivos.push(N('Sprite', 'Marca', { posicion: [cx, cy], forma: 'circulo', color: '#3DDC84', ancho: 22, alto: 22, opacidad: 0.6, z: 1 }, [], { grupos: ['objetivos'] }));
    if (ch === '@') jugador = [cx, cy];
  }));
  const raiz = N('Nodo2D', 'Puzle', {}, [
    N('Fondo', 'Fondo', { color: '#14201A', color2: '#0E1612', montanas: false, paralaje: 0 }),
    N('Mosaicos', 'Muros', { tam_celda: T, imagen: 'sprites/mosaicos/cesped.png', celdas, color: '#8C3F32', color_borde: '#8C3F32' }),
    N('Nodo2D', 'Objetivos', {}, objetivos),
    N('Nodo2D', 'Cajas', {}, cajas),
    N('Personaje2D', 'Jugador', { posicion: jugador, usa_gravedad: false, z: 3 }, [
      N('Sprite', 'Sprite', { imagen: 'sprites/personajes/jugador.png', ancho: 46, alto: 58 }),
    ], { script: 'scripts/jugador.agl' }),
    N('Camara2D', 'Cámara2D', { posicion: [320, 224], suavizado: 0 }),
    N('Interfaz', 'Interfaz', {}, [
      N('Etiqueta', 'Titulo', { posicion: [640, 40], texto: 'Lleva las cajas a las marcas verdes', tam: 22, alineacion: 'centro' }),
      N('Etiqueta', 'Ayuda', { posicion: [640, 684], texto: 'Flechas para moverte · E para reiniciar', tam: 15, color: '#A9B5AE', alineacion: 'centro' }),
    ]),
  ]);
  Object.assign(archivos, { 'escenas/puzle.fscn': escenaVacia('2D', raiz), 'scripts/jugador.agl': S.cajas });
  const datos = datosProyecto(nombre, '2D');
  datos.escena_principal = 'escenas/puzle.fscn';
  datos.gravedad = 0;
  return { datos, archivos, importacion, carpetas: CARPETAS_2D, abrir: ['escenas/puzle.fscn'] };
}

// Materiales de ejemplo (formato .mat)
export function materialBasico(nombre, { color = '#C9BFAA', rugosidad = 0.8, metalico = 0, textura = '', relieve = '', emision = '', superficie = 'opaca', iluminacion = 'realista', opacidad = 1 } = {}) {
  const nodos = [], conexiones = [];
  const salida = { id: 'salida', tipo: 'salida', x: 520, y: 40 };
  nodos.push(salida);
  const con = (de, sal, a, ent) => conexiones.push({ de, salida: sal, a, entrada: ent });
  nodos.push({ id: 'tinte', tipo: 'color', x: 40, y: 190, valor: color, parametro: 'tinte' });
  if (textura) {
    nodos.push({ id: 'tex', tipo: 'textura', x: 40, y: 40, archivo: textura });
    nodos.push({ id: 'mul', tipo: 'multiplicar', x: 280, y: 110 });
    con('tex', 'color', 'mul', 'a'); con('tinte', 'color', 'mul', 'b'); con('mul', 'resultado', 'salida', 'color_base');
  } else con('tinte', 'color', 'salida', 'color_base');
  nodos.push({ id: 'met', tipo: 'numero', x: 280, y: 260, valor: metalico, etiqueta: 'metálico' });
  nodos.push({ id: 'rug', tipo: 'numero', x: 280, y: 330, valor: rugosidad, etiqueta: 'rugosidad', parametro: 'rugosidad' });
  con('met', 'valor', 'salida', 'metalico'); con('rug', 'valor', 'salida', 'rugosidad');
  if (relieve) { nodos.push({ id: 'rel', tipo: 'relieve', x: 40, y: 400, archivo: relieve }); con('rel', 'normal', 'salida', 'normal'); }
  if (emision) { nodos.push({ id: 'emi', tipo: 'color', x: 280, y: 420, valor: emision }); con('emi', 'color', 'salida', 'emision'); }
  if (opacidad < 1) { nodos.push({ id: 'opa', tipo: 'numero', x: 280, y: 480, valor: opacidad, etiqueta: 'opacidad' }); con('opa', 'valor', 'salida', 'opacidad'); }
  return {
    formato: 'falcon-material', version: 1, nombre,
    superficie, iluminacion, dos_caras: false, sombras: true,
    grafo: { nodos, conexiones },
  };
}

async function generarCofreGlb() {
  const THREE = await import('three');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const grupo = new THREE.Group();
  grupo.name = 'Cofre';
  const madera = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.75, name: 'cuerpo' });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.4, metalness: 0.8, name: 'herrajes' });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), madera);
  cuerpo.position.y = 0.3;
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 20, 1, false, 0, Math.PI), madera);
  tapa.rotation.z = Math.PI / 2; tapa.rotation.y = Math.PI / 2; tapa.position.y = 0.6;
  tapa.rotation.set(0, 0, Math.PI / 2);
  const cerradura = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), new THREE.MeshStandardMaterial({ color: 0xd8a23e, metalness: 0.9, roughness: 0.3, name: 'herrajes' }));
  cerradura.position.set(0, 0.52, 0.42);
  grupo.add(cuerpo, tapa, cerradura);
  for (const x of [-0.45, 0.45]) {
    const banda = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.84), metal);
    banda.position.set(x, 0.31, 0);
    const arco = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20, 1, false, 0, Math.PI), metal);
    arco.rotation.set(0, 0, Math.PI / 2); arco.position.set(x, 0.6, 0);
    grupo.add(banda, arco);
  }
  grupo.traverse(o => { if (o.isMesh) { o.rotation.order = 'XYZ'; } });
  const exp = new GLTFExporter();
  const buf = await exp.parseAsync(grupo, { binary: true });
  return new Uint8Array(buf);
}

async function recursos3D(archivos) {
  archivos['texturas/piedra_color.png'] = await gen.texturaPiedra();
  archivos['texturas/piedra_relieve.png'] = await gen.texturaRelieve();
  archivos['texturas/madera.png'] = await gen.texturaMadera();
  archivos['materiales/piedra.mat'] = materialBasico('piedra', { color: '#C9BFAA', rugosidad: 0.8, textura: 'texturas/piedra_color.png', relieve: 'texturas/piedra_relieve.png' });
  archivos['materiales/madera.mat'] = materialBasico('madera', { color: '#FFFFFF', rugosidad: 0.75, textura: 'texturas/madera.png' });
  archivos['materiales/metal_oxidado.mat'] = materialBasico('metal_oxidado', { color: '#8E8A84', rugosidad: 0.45, metalico: 0.85 });
  archivos['materiales/llama.mat'] = materialBasico('llama', { color: '#FFB25C', emision: '#FF8A2A', iluminacion: 'sin_luz' });
  archivos['sonidos/ganar.wav'] = gen.sintetizar('ganar');
  archivos['sonidos/golpe.wav'] = gen.sintetizar('golpe');
  archivos['sonidos/salto.wav'] = gen.sintetizar('salto');
  archivos['música/tema.wav'] = gen.sintetizar('tema');
  archivos['modelos/cofre.glb'] = await generarCofreGlb();
  archivos['modelos/cofre.malla'] = {
    formato: 'falcon-malla', version: 1, fuente: 'modelos/cofre.glb', primitiva: null,
    ranuras: [{ nombre: 'cuerpo', material: 'materiales/madera.mat' }, { nombre: 'herrajes', material: 'materiales/metal_oxidado.mat' }],
    colision: 'caja', empujable: true, peso: 12, sombras: true, escala: 1, eje_arriba: 'Y',
    lod: [{ nivel: 0, distancia: 0 }, { nivel: 1, distancia: 15 }, { nivel: 2, distancia: 40 }],
  };
}

function antorcha(nombre, x, z) {
  return N('Luz3D', nombre, { posicion: [x, 1.8, z], tipo_luz: 'puntual', color: '#FFB060', intensidad: 6, alcance: 9, sombras: true }, [
    N('Malla3D', 'Llama', { posicion: [0, 0, 0], escala: [0.18, 0.28, 0.18], malla: 'esfera', material: 'materiales/llama.mat', color: '#FFB25C', colision: 'ninguna', sombras: false }),
    N('Malla3D', 'Soporte', { posicion: [0, -0.35, 0], escala: [0.1, 0.5, 0.1], malla: 'cilindro', color: '#3A2E22', colision: 'ninguna' }),
  ], { script: 'scripts/antorcha.agl' });
}

async function plantillaMazmorra(nombre) {
  const archivos = {};
  await recursos3D(archivos);
  const muro = (n, x, z, sx, sz) => N('Malla3D', n, { posicion: [x, 1.5, z], escala: [sx, 3, sz], malla: 'cubo', material: 'materiales/piedra.mat', color: '#8F887A' });
  const raiz = N('Nodo3D', 'Mazmorra', {}, [
    N('Entorno', 'Entorno', { cielo: '#070B09', horizonte: '#16201B', ambiente: 0.35, niebla: true, densidad: 0.045, iluminacion_global: true, intensidad_resplandor: 0.6 }),
    N('Luz3D', 'Sol', { posicion: [6, 10, 4], rotacion: [-55, 35, 0], tipo_luz: 'sol', intensidad: 1.2, color: '#BFD6FF' }),
    N('Malla3D', 'Suelo', { posicion: [0, 0, 0], escala: [24, 1, 24], malla: 'plano', material: 'materiales/piedra.mat', color: '#8F887A', colision: 'caja' }),
    N('Nodo3D', 'Muros', {}, [muro('MuroNorte', 0, -12, 24, 1), muro('MuroSur', 0, 12, 24, 1), muro('MuroEste', 12, 0, 1, 24), muro('MuroOeste', -12, 0, 1, 24), muro('Pilar', -4, -3, 1.4, 1.4), muro('Pilar2', 4, 3, 1.4, 1.4)]),
    N('Malla3D', 'Cofre', { posicion: [0, 0, -6], rotacion: [0, 35, 0], malla: 'modelos/cofre.malla', color: '#6B5432', rugosidad: 0.7, colision: 'caja' }, [], { blueprint: 'blueprints/cofre.bp' }),
    N('Personaje3D', 'Jugador', { posicion: [0, 0, 2.5], controles: 'tercera_persona' }, [
      N('Camara3D', 'Cámara3D', { posicion: [0, 3.2, 6], rotacion: [-18, 0, 0], fov: 65 }),
    ]),
    N('Nodo3D', 'Antorchas', {}, [antorcha('Antorcha', -11.3, -6), antorcha('Antorcha2', 11.3, -6), antorcha('Antorcha3', -11.3, 6), antorcha('Antorcha4', 11.3, 6)]),
    N('Interfaz', 'Interfaz', {}, [
      N('Etiqueta', 'Ayuda', { posicion: [640, 684], texto: 'WASD moverte · clic y ratón para mirar · Espacio saltar · V cambiar vista · encuentra el cofre', tam: 15, color: '#A9B5AE', alineacion: 'centro' }),
    ]),
  ]);
  const jugadorEsc = N('Personaje3D', 'Jugador', { controles: 'tercera_persona' }, [N('Camara3D', 'Cámara3D', { posicion: [0, 3, 6], rotacion: [-15, 0, 0] })]);
  const bp = bpCofre();
  Object.assign(archivos, {
    'escenas/mazmorra.fscn': escenaVacia('3D', raiz),
    'escenas/jugador.fscn': escenaVacia('3D', jugadorEsc),
    'blueprints/cofre.bp': bp,
    'generado/cofre.agl': compilarBlueprint(bp, 'cofre.bp').codigo,
    'scripts/antorcha.agl': S.antorcha,
  });
  const datos = datosProyecto(nombre, '3D');
  datos.escena_principal = 'escenas/mazmorra.fscn';
  datos.gravedad = 18;
  return { datos, archivos, importacion: {}, carpetas: CARPETAS_3D, abrir: ['escenas/mazmorra.fscn'] };
}

// ---------- Pruebas de iluminación ----------
const S_LUZ = {
  ciclo: `# ciclo_dia.agl · pulsa E para pasar del día a la noche (y al revés)
variable dia = 1
variable objetivo = 1

cuando se_pulsa("accion"):
    objetivo = 1 - objetivo

cuando se_actualiza(delta):
    dia = interpolar(dia, objetivo, limitar(delta * 2.2, 0, 1))
    si abs(dia - objetivo) < 0.002:
        dia = objetivo
    yo.rotacion_x = interpolar(-7, -42, dia)
    yo.intensidad = interpolar(0.3, 3.2, dia)
    yo.color = mezclar_color("#7F9CFF", "#FFF1DC", dia)
    variable ent = nodo("Entorno")
    ent.cielo = mezclar_color("#02040A", "#3F74C2", dia)
    ent.horizonte = mezclar_color("#0A1222", "#C9DAEA", dia)
    ent.ambiente = interpolar(0.05, 0.45, dia)
    variable estado = nodo("Estado")
    si objetivo > 0.5:
        estado.texto = "Día · pulsa E para la noche"
    sino:
        estado.texto = "Noche · pulsa E para el día"
`,
  orbita: `# orbita.agl · la luz da vueltas para ver sombras y rebotes en movimiento
exportar variable radio = 2.4
exportar variable velocidad = 40
variable centro_x = 0
variable centro_z = 0

cuando empieza():
    centro_x = yo.x
    centro_z = yo.z

cuando se_actualiza(delta):
    variable a = tiempo() * velocidad
    yo.x = centro_x + coseno(a) * radio
    yo.z = centro_z + seno(a) * radio
`,
  zona: `# zona.agl · dice en qué zona de pruebas está el jugador
cuando se_actualiza(delta):
    variable j = nodo("Jugador")
    yo.texto = zona_de(j.x, j.z)

función zona_de(x, z):
    si z < -11:
        devolver "Espejos · suelo pulido, espejo de pared, cromo y oro"
    si x < -9 y z < 4:
        devolver "Caja de Cornell · la luz rebota y tiñe de rojo y verde"
    si x < -9:
        devolver "Rugosidad y metal · de pulido (izquierda) a mate (derecha)"
    si x > 9 y z < 0:
        devolver "Sala oscura · solo entra el sol por la ventana"
    si x > 9:
        devolver "Neón · los materiales que brillan iluminan la sala"
    devolver "Plaza · luz que gira, antorchas y sombras de personajes"
`,
};

async function plantillaPruebasLuz(nombre) {
  const archivos = {};
  await recursos3D(archivos);
  const mat = (n, op, extra = {}) => { archivos[`materiales/${n}.mat`] = { ...materialBasico(n, op), ...extra }; return `materiales/${n}.mat`; };
  const M = {
    espejo: mat('espejo', { color: '#EEF2F4', rugosidad: 0, metalico: 1 }, { reflejo: 'plano' }),
    marmol: mat('marmol_pulido', { color: '#2E343A', rugosidad: 0.06, metalico: 0.35 }, { reflejo: 'plano' }),
    cromo: mat('cromo', { color: '#E0E4E7', rugosidad: 0.04, metalico: 1 }, { reflejo: 'curvo' }),
    oro: mat('oro', { color: '#F2C46D', rugosidad: 0.14, metalico: 1 }, { reflejo: 'curvo' }),
    cepillado: mat('metal_cepillado', { color: '#B8BEC2', rugosidad: 0.45, metalico: 1 }),
    lampara: mat('panel_luz', { color: '#FFFFFF', emision: '#FFF2DC' }, { intensidad_emision: 0.7 }),
    rosa: mat('neon_rosa', { color: '#FF2E9A', emision: '#FF2E9A' }, { intensidad_emision: 5 }),
    cian: mat('neon_cian', { color: '#2EE6FF', emision: '#2EE6FF' }, { intensidad_emision: 5 }),
    verde: mat('neon_verde', { color: '#3DDC84', emision: '#3DDC84' }, { intensidad_emision: 5 }),
    bombilla: mat('bombilla', { color: '#CFE4FF', emision: '#CFE4FF' }, { intensidad_emision: 4 }),
  };
  const caja = (n, pos, esc, props = {}) => N('Malla3D', n, { posicion: pos, escala: esc, malla: 'cubo', color: '#E6E2DA', rugosidad: 0.9, ...props });
  const piedra = (n, pos, esc) => caja(n, pos, esc, { material: 'materiales/piedra.mat', color: '#8F887A' });
  const oscuro = (n, pos, esc) => caja(n, pos, esc, { color: '#2A2C2E', rugosidad: 0.9 });
  const vol = (n, pos, esc, densidad = 1.5) => N('VolumenLumbre', n, { posicion: pos, escala: esc, densidad });

  // Caja de Cornell: paredes roja y verde, techo con lámpara, dos bloques blancos.
  const cornell = N('Nodo3D', 'Caja de Cornell', {}, [
    caja('Pared roja', [-16.6, 2.25, -6], [0.2, 4.5, 5.2], { color: '#C8261E' }),
    caja('Pared verde', [-11.4, 2.25, -6], [0.2, 4.5, 5.2], { color: '#2FA84A' }),
    caja('Fondo', [-14, 2.25, -8.6], [5.4, 4.5, 0.2]),
    caja('Techo', [-14, 4.6, -6], [5.4, 0.2, 5.4]),
    caja('Suelo blanco', [-14, 0.02, -6], [5, 0.04, 5], { colision: 'ninguna' }),
    caja('Panel de luz', [-14, 4.48, -6], [1.4, 0.04, 1.4], { material: M.lampara, sombras: false, colision: 'ninguna' }),
    N('Luz3D', 'Lámpara', { posicion: [-14, 4.1, -6.2], tipo_luz: 'puntual', color: '#FFE9CC', intensidad: 2.2, alcance: 9, sombras: true }),
    caja('Bloque alto', [-15, 1.4, -7], [1.3, 2.8, 1.3], { rotacion: [0, 18, 0] }),
    caja('Bloque bajo', [-12.8, 0.7, -5], [1.3, 1.4, 1.3], { rotacion: [0, -17, 0] }),
    vol('Volumen Cornell', [-14, 2.3, -6], [5.6, 4.8, 5.6], 1.6),
  ]);

  // Sala oscura: solo entra el sol por una ventana al este.
  const sala = N('Nodo3D', 'Sala oscura', {}, [
    piedra('Muro oeste', [10.35, 1.8, -6], [0.3, 3.6, 7.6]),
    piedra('Muro norte', [14, 1.8, -9.65], [7.6, 3.6, 0.3]),
    piedra('Ventana abajo', [17.65, 0.5, -6], [0.3, 1, 7.6]),
    piedra('Ventana arriba', [17.65, 3.1, -6], [0.3, 1, 7.6]),
    piedra('Ventana izquierda', [17.65, 1.8, -8.4], [0.3, 1.6, 2.8]),
    piedra('Ventana derecha', [17.65, 1.8, -3.6], [0.3, 1.6, 2.8]),
    piedra('Muro sur izquierda', [11.6, 1.8, -2.35], [2.8, 3.6, 0.3]),
    piedra('Muro sur derecha', [16.4, 1.8, -2.35], [2.8, 3.6, 0.3]),
    piedra('Dintel', [14, 3, -2.35], [2, 1.2, 0.3]),
    piedra('Techo', [14, 3.75, -6], [7.6, 0.3, 7.6]),
    caja('Mesa', [12.4, 0.4, -8], [2, 0.8, 1], { material: 'materiales/madera.mat', color: '#9A6A3C' }),
    N('Malla3D', 'Esfera blanca', { posicion: [15.4, 0.6, -4.6], escala: [1.2, 1.2, 1.2], malla: 'esfera', color: '#F2F0EA', rugosidad: 0.6, colision: 'esfera' }),
    vol('Volumen sala', [14, 1.9, -6], [7.4, 4, 7.4], 1.5),
  ]);

  // Zona de espejos: suelo pulido, espejo de pared y esferas de cromo, oro y metal cepillado.
  const espejos = N('Nodo3D', 'Espejos', {}, [
    caja('Suelo pulido', [0, 0.02, -17], [10, 0.04, 8], { material: M.marmol, colision: 'ninguna' }),
    piedra('Pared del espejo', [0, 2, -21.6], [12, 4, 0.4]),
    caja('Espejo de pared', [0, 1.9, -21.32], [4.4, 0.06, 3], { rotacion: [90, 0, 0], material: M.espejo, sombras: false, colision: 'ninguna' }),
    caja('Marco arriba', [0, 3.5, -21.25], [4.8, 0.2, 0.2], { material: 'materiales/madera.mat', colision: 'ninguna' }),
    caja('Marco abajo', [0, 0.3, -21.25], [4.8, 0.2, 0.2], { material: 'materiales/madera.mat', colision: 'ninguna' }),
    caja('Marco izquierda', [-2.3, 1.9, -21.25], [0.2, 3.4, 0.2], { material: 'materiales/madera.mat', colision: 'ninguna' }),
    caja('Marco derecha', [2.3, 1.9, -21.25], [0.2, 3.4, 0.2], { material: 'materiales/madera.mat', colision: 'ninguna' }),
    N('Malla3D', 'Esfera de cromo', { posicion: [-3, 0.79, -17], escala: [1.5, 1.5, 1.5], malla: 'esfera', material: M.cromo, colision: 'esfera' }),
    N('Malla3D', 'Esfera de oro', { posicion: [0, 0.79, -16], escala: [1.5, 1.5, 1.5], malla: 'esfera', material: M.oro, colision: 'esfera' }),
    N('Malla3D', 'Esfera cepillada', { posicion: [3, 0.79, -17], escala: [1.5, 1.5, 1.5], malla: 'esfera', material: M.cepillado, colision: 'esfera' }),
  ]);

  // Rincón de neón: sala oscura abierta hacia la plaza, iluminada solo por tubos que brillan.
  const tubo = (n, pos, esc, rot, material) => N('Malla3D', n, { posicion: pos, escala: esc, rotacion: rot, malla: 'cilindro', material, sombras: false, colision: 'ninguna' });
  const neon = N('Nodo3D', 'Neón', {}, [
    oscuro('Muro este', [17.15, 1.75, 8], [0.3, 3.5, 6.3]),
    oscuro('Muro norte', [14, 1.75, 4.85], [6.3, 3.5, 0.3]),
    oscuro('Muro sur', [14, 1.75, 11.15], [6.3, 3.5, 0.3]),
    oscuro('Techo', [14, 3.65, 8], [6.3, 0.3, 6.3]),
    caja('Suelo brillante', [14, 0.02, 8], [6, 0.04, 6], { color: '#1A1C1E', rugosidad: 0.22, colision: 'ninguna' }),
    tubo('Tubo rosa', [16.9, 2.6, 8], [0.09, 5, 0.09], [90, 0, 0], M.rosa),
    tubo('Tubo cian', [11.6, 1.7, 5.15], [0.09, 3, 0.09], [0, 0, 0], M.cian),
    tubo('Tubo cian 2', [16.6, 1.7, 5.15], [0.09, 3, 0.09], [0, 0, 0], M.cian),
    tubo('Tubo verde', [14, 0.25, 10.85], [0.09, 5, 0.09], [0, 0, 90], M.verde),
    N('Malla3D', 'Pedestal', { posicion: [14, 0.4, 8], escala: [0.9, 0.8, 0.9], malla: 'cilindro', color: '#E6E2DA', rugosidad: 0.8 }),
    N('Malla3D', 'Esfera testigo', { posicion: [14, 1.35, 8], escala: [1.1, 1.1, 1.1], malla: 'esfera', color: '#F2F0EA', rugosidad: 0.5, colision: 'esfera' }),
    vol('Volumen neón', [14, 1.8, 8], [6.2, 3.8, 6.2], 1.5),
  ]);

  // Rugosidad (columnas) × metálico (filas).
  const muestras = [];
  [0.05, 0.25, 0.5, 0.75, 1].forEach((r, i) => {
    muestras.push(N('Malla3D', `Dieléctrico ${r}`, { posicion: [-17.2 + i * 1.6, 0.85, 8.2], escala: [1.1, 1.1, 1.1], malla: 'esfera', color: '#D9D9D9', rugosidad: r, metalico: 0, colision: 'esfera' }));
    muestras.push(N('Malla3D', `Metal ${r}`, { posicion: [-17.2 + i * 1.6, 0.85, 9.8], escala: [1.1, 1.1, 1.1], malla: 'esfera', color: '#D8DCDF', rugosidad: r, metalico: 1, colision: 'esfera' }));
  });
  const rejilla = N('Nodo3D', 'Rugosidad y metal', {}, [caja('Tarima', [-14, 0.15, 9], [8.4, 0.3, 4], { color: '#3A3E42', rugosidad: 0.7 }), ...muestras]);

  // Plaza: columnas, luz que gira, antorchas y un maniquí para ver sombras de personajes.
  const columna = (n, x, z) => N('Malla3D', n, { posicion: [x, 2, z], escala: [0.8, 4, 0.8], malla: 'cilindro', material: 'materiales/piedra.mat', color: '#8F887A' });
  const antorchaLuz = (n, x, z) => { const a = antorcha(n, x, z); a.props.intensidad = 4; return a; };
  const plaza = N('Nodo3D', 'Plaza', {}, [
    columna('Columna 1', -3, -1), columna('Columna 2', 3, -1), columna('Columna 3', -3, -7), columna('Columna 4', 3, -7),
    N('Malla3D', 'Cono', { posicion: [0, 0.6, -4], escala: [1, 1.2, 1], malla: 'cono', color: '#E6E2DA', rugosidad: 0.6 }),
    N('Luz3D', 'Luz que gira', { posicion: [0, 1.6, -4], tipo_luz: 'puntual', color: '#9BC8FF', intensidad: 4, alcance: 10, sombras: true }, [
      N('Malla3D', 'Bombilla', { escala: [0.18, 0.18, 0.18], malla: 'esfera', material: M.bombilla, sombras: false, colision: 'ninguna' }),
    ], { script: 'scripts/orbita.agl' }),
    N('Personaje3D', 'Maniquí', { posicion: [1.3, 0, -5.2], color: '#E7EDE9' }),
    antorchaLuz('Antorcha', -3, -0.45), antorchaLuz('Antorcha 2', 3, -0.45),
  ]);

  const raiz = N('Nodo3D', 'Pruebas de iluminación', {}, [
    N('Entorno', 'Entorno', { cielo: '#3F74C2', horizonte: '#C9DAEA', ambiente: 0.45, niebla: false, iluminacion_global: true, intensidad_gi: 1.1, luz_cielo: 1, intensidad_resplandor: 0.55 }),
    N('Luz3D', 'Sol', { posicion: [20, 14, -6], rotacion: [-42, 90, 0], tipo_luz: 'sol', intensidad: 3.2, color: '#FFF1DC', sombras: true }, [], { script: 'scripts/ciclo_dia.agl' }),
    N('Malla3D', 'Suelo', { posicion: [0, 0, -5], escala: [48, 1, 38], malla: 'plano', material: 'materiales/piedra.mat', color: '#8F887A', colision: 'caja' }),
    cornell, sala, espejos, neon, rejilla, plaza,
    N('Personaje3D', 'Jugador', { posicion: [0, 0, 6], controles: 'tercera_persona' }, [
      N('Camara3D', 'Cámara3D', { posicion: [0, 2.6, 5.5], rotacion: [-14, 0, 0], fov: 65, raton: true }),
    ]),
    N('Interfaz', 'Interfaz', {}, [
      N('Etiqueta', 'Título', { posicion: [24, 22], texto: 'Pruebas de iluminación · Lumbre', tam: 20, color: '#E7EDE9', fondo: true }),
      N('Etiqueta', 'Zona', { posicion: [24, 62], texto: '', tam: 15, color: '#F2C46D', fondo: true }, [], { script: 'scripts/zona.agl' }),
      N('Etiqueta', 'Estado', { posicion: [24, 90], texto: 'Día · pulsa E para la noche', tam: 14, color: '#E7EDE9', fondo: true }),
      N('Etiqueta', 'Ayuda', { posicion: [640, 684], texto: 'WASD moverte · clic y ratón para mirar · rueda acercar · Espacio saltar · Mayús correr · V vista · E día/noche · F10 calidad', tam: 14, color: '#E7EDE9', alineacion: 'centro', fondo: true }),
    ]),
  ]);
  Object.assign(archivos, {
    'escenas/pruebas_luz.fscn': escenaVacia('3D', raiz),
    'scripts/ciclo_dia.agl': S_LUZ.ciclo,
    'scripts/orbita.agl': S_LUZ.orbita,
    'scripts/zona.agl': S_LUZ.zona,
    'scripts/antorcha.agl': S.antorcha,
  });
  const datos = datosProyecto(nombre, '3D');
  datos.escena_principal = 'escenas/pruebas_luz.fscn';
  datos.gravedad = 18;
  return { datos, archivos, importacion: {}, carpetas: CARPETAS_3D, abrir: ['escenas/pruebas_luz.fscn'] };
}

async function plantillaVacio2D(nombre) {
  const raiz = N('Nodo2D', 'Principal', {}, [
    N('Fondo', 'Fondo', { montanas: false, color: '#0F1A15', color2: '#0B120F' }),
    N('Camara2D', 'Cámara2D', { posicion: [640, 360], suavizado: 0 }),
  ]);
  const datos = datosProyecto(nombre, '2D');
  datos.escena_principal = 'escenas/principal.fscn';
  return { datos, archivos: { 'escenas/principal.fscn': escenaVacia('2D', raiz) }, importacion: {}, carpetas: CARPETAS_2D, abrir: ['escenas/principal.fscn'] };
}

async function plantillaVacio3D(nombre) {
  const raiz = N('Nodo3D', 'Principal', {}, [
    N('Entorno', 'Entorno', {}),
    N('Luz3D', 'Sol', { posicion: [5, 8, 4], rotacion: [-50, 30, 0] }),
    N('Malla3D', 'Suelo', { escala: [20, 1, 20], malla: 'plano', color: '#3A4A40' }),
    N('Malla3D', 'Cubo', { posicion: [0, 0.5, 0], malla: 'cubo', color: '#3DDC84' }),
    N('Camara3D', 'Cámara3D', { posicion: [0, 4, 8], rotacion: [-25, 0, 0] }),
  ]);
  const datos = datosProyecto(nombre, '3D');
  datos.escena_principal = 'escenas/principal.fscn';
  datos.gravedad = 18;
  return { datos, archivos: { 'escenas/principal.fscn': escenaVacia('3D', raiz) }, importacion: {}, carpetas: CARPETAS_3D, abrir: ['escenas/principal.fscn'] };
}

async function plantillaCurso(nombre) {
  const archivos = {};
  const importacion = {};
  await recursos2D(archivos, importacion);
  const raiz = N('Nodo2D', 'Nivel', {}, [
    N('Fondo', 'Fondo', { color: '#0F1A15', color2: '#0B120F', montanas: false, paralaje: 0 }),
    N('Personaje2D', 'Jugador', { posicion: [360, 548], controles: 'plataformas' }, [
      N('Sprite', 'Sprite', { imagen: 'sprites/personajes/jugador.png', ancho: 52, alto: 65 }),
      N('Colision', 'Colisión', { ancho: 40, alto: 62 }),
    ]),
    N('Mosaicos', 'Suelo', { tam_celda: 40, imagen: 'sprites/mosaicos/cesped.png', celdas: suelo(40, 15, 3) }),
    N('Nodo2D', 'Monedas', {}, [moneda(760, 380), moneda(820, 380)]),
    N('Plataforma', 'Plataforma', { posicion: [790, 440], ancho: 200, alto: 30, color: '#22412E', color_borde: '#2F5E40' }),
    N('Camara2D', 'Cámara', { posicion: [640, 360], suavizado: 0.1, seguir: '' }),
  ]);
  archivos['escenas/nivel.fscn'] = escenaVacia('2D', raiz);
  archivos['scripts/moneda.agl'] = S.moneda;
  const datos = datosProyecto(nombre, '2D');
  datos.escena_principal = 'escenas/nivel.fscn';
  datos.modo_editor = 'sencillo';
  datos.lecciones = { curso: 'mi_primer_juego', leccion: 0, pasos: {} };
  return { datos, archivos, importacion, carpetas: CARPETAS_2D, abrir: ['escenas/nivel.fscn'] };
}

const CONSTRUCTORES = {
  academia_blueprints: plantillaAcademia,
  shooter_tercera: (nombre) => plantillaShooter(nombre, 'tercera_persona'),
  shooter_primera: plantillaCQB,
  vacio2d: plantillaVacio2D, vacio3d: plantillaVacio3D, plataformas: plantillaPlataformas,
  topdown: plantillaTopdown, puzzle: plantillaPuzzle, mazmorra: plantillaMazmorra, pruebas_luz: plantillaPruebasLuz, curso: plantillaCurso,
};

/**
 * Crea un proyecto en disco a partir de una plantilla.
 * @returns ruta del proyecto
 */
export async function crearProyecto(rutaCarpeta, nombre, idPlantilla, alProgreso = () => {}) {
  const fs = window.falcon.fs;
  const raiz = rutaCarpeta.replace(/\\/g, '/').replace(/\/$/, '');
  if (await fs.existe(raiz + '/proyecto.falcon')) throw new Error('Ya hay un proyecto en esa carpeta.');
  alProgreso('Preparando la plantilla…');
  const p = await CONSTRUCTORES[idPlantilla](nombre);
  await fs.crearCarpeta(raiz);
  for (const c of p.carpetas) await fs.crearCarpeta(raiz + '/' + c);
  alProgreso('Creando archivos…');
  for (const [rel, contenido] of Object.entries(p.archivos)) {
    const datos = contenido instanceof Uint8Array || typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2);
    await fs.escribir(raiz + '/' + rel, datos);
  }
  p.datos.editor = { abiertas: p.abrir };
  await fs.escribir(raiz + '/proyecto.falcon', JSON.stringify(p.datos, null, 2));
  await fs.escribir(raiz + '/.falcon/importacion.json', JSON.stringify(p.importacion || {}, null, 2));
  return raiz;
}

