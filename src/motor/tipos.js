// Registro de tipos de nodo de Falcon Engine.
// Define, para cada tipo: icono, familia (color), propiedades editables con su sección
// del Inspector, y los miembros que Águila puede usar.

// Familias de color: turquesa 2D, ámbar 3D, lila interfaz, verde lógica.
export const COLORES_FAMILIA = { '2d': 'var(--turquesa)', '3d': 'var(--ambar)', ui: 'var(--lila)', logica: 'var(--verde)', general: 'var(--texto-2)' };

const T2D = [
  { clave: 'posicion', etiqueta: 'Posición', tipo: 'vector2', defecto: [0, 0], seccion: 'Transformación' },
  { clave: 'rotacion', etiqueta: 'Rotación', tipo: 'angulo', defecto: 0, seccion: 'Transformación' },
  { clave: 'escala', etiqueta: 'Escala', tipo: 'vector2', defecto: [1, 1], seccion: 'Transformación', paso: 0.1 },
  { clave: 'z', etiqueta: 'Capa (Z)', tipo: 'entero', defecto: 0, seccion: 'Transformación', ayuda: 'Los nodos con la capa más alta se dibujan encima.' },
];

const T3D = [
  { clave: 'posicion', etiqueta: 'Posición', tipo: 'vector3', defecto: [0, 0, 0], seccion: 'Transformación', paso: 0.1 },
  { clave: 'rotacion', etiqueta: 'Rotación', tipo: 'angulo3', defecto: [0, 0, 0], seccion: 'Transformación' },
  { clave: 'escala', etiqueta: 'Escala', tipo: 'vector3', defecto: [1, 1, 1], seccion: 'Transformación', paso: 0.1 },
];

const OPCIONES_FORMA = [['rectangulo', 'Rectángulo'], ['redondeado', 'Redondeado'], ['circulo', 'Círculo'], ['triangulo', 'Triángulo'], ['personaje', 'Personaje'], ['enemigo', 'Enemigo'], ['estrella', 'Estrella'], ['bandera', 'Bandera']];
const PRIMITIVAS = [['cubo', 'Cubo'], ['esfera', 'Esfera'], ['cilindro', 'Cilindro'], ['plano', 'Plano'], ['capsula', 'Cápsula'], ['cono', 'Cono'], ['terreno', 'Terreno'], ['escalera', 'Escalera']];

// Miembros comunes de Águila
const M_NODO = [
  { nombre: 'nombre', tipo: 'texto', descripcion: 'El nombre del nodo.' },
  { nombre: 'visible', tipo: 'sí/no', descripcion: 'Si se ve o no.' },
  { nombre: 'padre', tipo: 'objeto', descripcion: 'El nodo que lo contiene.' },
  { nombre: 'hijos', tipo: 'lista', descripcion: 'Los nodos que contiene.' },
  { nombre: 'es', firma: 'es(nombre)', descripcion: 'Verdadero si el nodo se llama así, es de ese tipo o está en ese grupo.' },
  { nombre: 'eliminar', firma: 'eliminar()', descripcion: 'Quita el nodo del juego.' },
  { nombre: 'hijo', firma: 'hijo(nombre)', descripcion: 'Busca un nodo hijo por su nombre.' },
  { nombre: 'en_grupo', firma: 'en_grupo(grupo)', descripcion: 'Verdadero si está en ese grupo.' },
  { nombre: 'añadir_a_grupo', firma: 'añadir_a_grupo(grupo)', descripcion: 'Mete el nodo en un grupo.' },
  { nombre: 'llamar', firma: 'llamar(función, datos…)', descripcion: 'Llama a una función del script de este nodo.' },
];
const M_2D = [
  { nombre: 'x', tipo: 'decimal', descripcion: 'Posición horizontal.' },
  { nombre: 'y', tipo: 'decimal', descripcion: 'Posición vertical (hacia abajo crece).' },
  { nombre: 'posicion', tipo: 'lista', descripcion: 'La posición como [x, y].' },
  { nombre: 'rotacion', tipo: 'decimal', descripcion: 'Giro en grados.' },
  { nombre: 'escala_x', tipo: 'decimal', descripcion: 'Escala horizontal.' },
  { nombre: 'escala_y', tipo: 'decimal', descripcion: 'Escala vertical.' },
  { nombre: 'mover_a', firma: 'mover_a(x, y)', descripcion: 'Coloca el nodo en esa posición.' },
  { nombre: 'desplazar', firma: 'desplazar(dx, dy)', descripcion: 'Mueve el nodo esa distancia.' },
  { nombre: 'distancia_a', firma: 'distancia_a(otro)', descripcion: 'Distancia hasta otro nodo.' },
  { nombre: 'mirar_a', firma: 'mirar_a(otro)', descripcion: 'Gira el nodo para que apunte a otro.' },
];
const M_3D = [
  { nombre: 'x', tipo: 'decimal', descripcion: 'Posición en X.' },
  { nombre: 'y', tipo: 'decimal', descripcion: 'Posición en Y (altura).' },
  { nombre: 'z', tipo: 'decimal', descripcion: 'Posición en Z.' },
  { nombre: 'posicion', tipo: 'lista', descripcion: 'La posición como [x, y, z].' },
  { nombre: 'rotacion_x', tipo: 'decimal', descripcion: 'Giro sobre X en grados.' },
  { nombre: 'rotacion_y', tipo: 'decimal', descripcion: 'Giro sobre Y en grados.' },
  { nombre: 'rotacion_z', tipo: 'decimal', descripcion: 'Giro sobre Z en grados.' },
  { nombre: 'mover_a', firma: 'mover_a(x, y, z)', descripcion: 'Coloca el nodo en esa posición.' },
  { nombre: 'desplazar', firma: 'desplazar(dx, dy, dz)', descripcion: 'Mueve el nodo esa distancia.' },
  { nombre: 'girar', firma: 'girar(grados_y)', descripcion: 'Gira el nodo sobre el eje vertical.' },
  { nombre: 'distancia_a', firma: 'distancia_a(otro)', descripcion: 'Distancia hasta otro nodo.' },
];

export const TIPOS = {
  // ---------- 2D ----------
  Nodo2D: {
    familia: '2d', icono: 'nodo', dim: '2D', descripcion: 'Un punto vacío para agrupar otros nodos.', sencillo: 'Grupo',
    props: [...T2D], miembros: [...M_NODO, ...M_2D],
  },
  Personaje2D: {
    familia: '2d', icono: 'persona', dim: '2D', descripcion: 'Un personaje que anda, salta y choca con el suelo.', sencillo: 'Tu personaje',
    props: [...T2D,
      { clave: 'velocidad', etiqueta: 'Velocidad', tipo: 'numero', defecto: 220, seccion: 'Movimiento', min: 0, max: 800, sencillo: { etiqueta: 'Velocidad al andar', izq: 'Lento', der: 'Rápido' } },
      { clave: 'salto', etiqueta: 'Salto', tipo: 'numero', defecto: 420, seccion: 'Movimiento', min: 0, max: 900, sencillo: { etiqueta: 'Altura del salto' } },
      { clave: 'usa_gravedad', etiqueta: 'Gravedad', tipo: 'bool', defecto: true, seccion: 'Movimiento', texto: ['Activada', 'Desactivada'] },
      { clave: 'gravedad', etiqueta: 'Fuerza de gravedad', tipo: 'numero', defecto: 1200, seccion: 'Movimiento', min: 0, max: 4000 },
      { clave: 'controles', etiqueta: 'Controles', tipo: 'opciones', defecto: 'ninguno', seccion: 'Movimiento', opciones: [['ninguno', 'Solo con lógica'], ['plataformas', 'Plataformas (←→ y salto)'], ['vista_superior', 'Vista superior (←↑→↓)']], ayuda: 'Movimiento listo para usar sin escribir código.' },
    ],
    miembros: [...M_NODO, ...M_2D,
      { nombre: 'mover', firma: 'mover(velocidad_x, velocidad_y)', descripcion: 'Mueve al personaje este fotograma. Con un solo dato, solo en horizontal.' },
      { nombre: 'saltar', firma: 'saltar(fuerza)', descripcion: 'Impulsa al personaje hacia arriba. Sin dato, usa su «salto».' },
      { nombre: 'en_el_suelo', firma: 'en_el_suelo()', descripcion: 'Verdadero si está apoyado en el suelo.' },
      { nombre: 'en_pared', firma: 'en_pared()', descripcion: 'Verdadero si está chocando con una pared.' },
      { nombre: 'en_techo', firma: 'en_techo()', descripcion: 'Verdadero si se ha dado con el techo.' },
      { nombre: 'empujar', firma: 'empujar(x, y)', descripcion: 'Le da un empujón (por ejemplo al recibir un golpe).' },
      { nombre: 'velocidad', tipo: 'decimal', descripcion: 'Velocidad al andar.' },
      { nombre: 'salto', tipo: 'decimal', descripcion: 'Fuerza del salto.' },
      { nombre: 'velocidad_x', tipo: 'decimal', descripcion: 'Velocidad horizontal actual.' },
      { nombre: 'velocidad_y', tipo: 'decimal', descripcion: 'Velocidad vertical actual.' },
      { nombre: 'usa_gravedad', tipo: 'sí/no', descripcion: 'Si le afecta la gravedad.' },
      { nombre: 'gravedad', tipo: 'decimal', descripcion: 'Fuerza con la que cae.' },
    ],
  },
  Sprite: {
    familia: '2d', icono: 'imagen', dim: '2D', descripcion: 'Una imagen o un dibujo sencillo.', sencillo: 'Imagen',
    props: [...T2D,
      { clave: 'imagen', etiqueta: 'Imagen', tipo: 'recurso', filtro: 'imagen', defecto: '', seccion: 'Imagen' },
      { clave: 'forma', etiqueta: 'Forma (sin imagen)', tipo: 'opciones', defecto: 'rectangulo', seccion: 'Imagen', opciones: OPCIONES_FORMA },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#3DDC84', seccion: 'Imagen' },
      { clave: 'ancho', etiqueta: 'Ancho', tipo: 'numero', defecto: 48, seccion: 'Imagen', min: 1 },
      { clave: 'alto', etiqueta: 'Alto', tipo: 'numero', defecto: 64, seccion: 'Imagen', min: 1 },
      { clave: 'opacidad', etiqueta: 'Opacidad', tipo: 'deslizador', defecto: 1, seccion: 'Imagen', min: 0, max: 1, paso: 0.01 },
      { clave: 'voltear_h', etiqueta: 'Voltear horizontal', tipo: 'bool', defecto: false, seccion: 'Imagen' },
      { clave: 'cuadro', etiqueta: 'Cuadro', tipo: 'entero', defecto: 0, seccion: 'Animación', min: 0 },
      { clave: 'fps', etiqueta: 'Cuadros por segundo', tipo: 'numero', defecto: 8, seccion: 'Animación', min: 0, max: 60 },
      { clave: 'animando', etiqueta: 'Animar', tipo: 'bool', defecto: false, seccion: 'Animación' },
      { clave: 'animaciones', etiqueta: 'Animaciones', tipo: 'oculto', defecto: {}, seccion: 'Animación' },
    ],
    miembros: [...M_NODO, ...M_2D,
      { nombre: 'animar', firma: 'animar(nombre)', descripcion: 'Reproduce una animación de la hoja de sprites.' },
      { nombre: 'parar_animacion', firma: 'parar_animacion()', descripcion: 'Detiene la animación.' },
      { nombre: 'cuadro', tipo: 'entero', descripcion: 'El cuadro que se muestra.' },
      { nombre: 'voltear_h', tipo: 'sí/no', descripcion: 'Dibuja la imagen al revés en horizontal.' },
      { nombre: 'color', tipo: 'texto', descripcion: 'Color en formato "#RRGGBB".' },
      { nombre: 'opacidad', tipo: 'decimal', descripcion: 'De 0 (invisible) a 1 (opaco).' },
      { nombre: 'imagen', tipo: 'texto', descripcion: 'La imagen que se muestra.' },
    ],
  },
  Colision: {
    nombreVisible: 'Colisión', familia: '2d', icono: 'colision', dim: '2D', descripcion: 'La forma invisible con la que el nodo padre choca.', sencillo: 'Forma de choque',
    props: [
      { clave: 'posicion', etiqueta: 'Desplazamiento', tipo: 'vector2', defecto: [0, 0], seccion: 'Forma' },
      { clave: 'ancho', etiqueta: 'Ancho', tipo: 'numero', defecto: 48, seccion: 'Forma', min: 1 },
      { clave: 'alto', etiqueta: 'Alto', tipo: 'numero', defecto: 64, seccion: 'Forma', min: 1 },
      { clave: 'forma', etiqueta: 'Tipo', tipo: 'opciones', defecto: 'caja', seccion: 'Forma', opciones: [['caja', 'Caja'], ['circulo', 'Círculo']] },
    ],
    miembros: [...M_NODO],
  },
  Camara2D: {
    nombreVisible: 'Cámara2D', familia: '2d', icono: 'camara', dim: '2D', descripcion: 'Lo que ve el jugador. Sigue al nodo que la contiene.', sencillo: 'Lo que ve el jugador',
    props: [
      { clave: 'posicion', etiqueta: 'Desplazamiento', tipo: 'vector2', defecto: [0, 0], seccion: 'Cámara' },
      { clave: 'zoom', etiqueta: 'Zoom', tipo: 'numero', defecto: 1, seccion: 'Cámara', min: 0.1, max: 8, paso: 0.1 },
      { clave: 'suavizado', etiqueta: 'Suavizado', tipo: 'deslizador', defecto: 0.15, seccion: 'Cámara', min: 0, max: 1, paso: 0.01, ayuda: '0 = sigue al instante; más alto = se mueve con más suavidad.' },
      { clave: 'actual', etiqueta: 'Cámara activa', tipo: 'bool', defecto: true, seccion: 'Cámara' },
      { clave: 'seguir', etiqueta: 'Seguir a', tipo: 'nodo', defecto: '', seccion: 'Cámara', ayuda: 'Nombre del nodo al que sigue. Vacío: sigue al nodo que la contiene.' },
      { clave: 'limitar', etiqueta: 'Limitar al nivel', tipo: 'bool', defecto: false, seccion: 'Límites' },
      { clave: 'limites', etiqueta: 'Límites (izq, arr, der, abj)', tipo: 'vector4', defecto: [0, 0, 2000, 720], seccion: 'Límites' },
    ],
    miembros: [...M_NODO, ...M_2D,
      { nombre: 'zoom', tipo: 'decimal', descripcion: 'Acercamiento de la cámara.' },
      { nombre: 'temblar', firma: 'temblar(fuerza, segundos)', descripcion: 'Hace temblar la cámara.' },
    ],
  },
  Mosaicos: {
    familia: '2d', icono: 'mosaicos', dim: '2D', descripcion: 'Una rejilla de baldosas para dibujar el nivel con el lápiz.', sencillo: 'Donde se camina',
    props: [...T2D,
      { clave: 'tam_celda', etiqueta: 'Tamaño de celda', tipo: 'entero', defecto: 32, seccion: 'Mosaicos', min: 4, max: 256 },
      { clave: 'imagen', etiqueta: 'Paleta de mosaicos', tipo: 'recurso', filtro: 'imagen', defecto: '', seccion: 'Mosaicos' },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#1F3B2A', seccion: 'Mosaicos' },
      { clave: 'color_borde', etiqueta: 'Color de la superficie', tipo: 'color', defecto: '#2F5E40', seccion: 'Mosaicos' },
      { clave: 'solido', etiqueta: 'Se puede pisar', tipo: 'bool', defecto: true, seccion: 'Mosaicos' },
      { clave: 'pincel', etiqueta: 'Mosaico del lápiz', tipo: 'entero', defecto: 0, seccion: 'Mosaicos', min: 0 },
      { clave: 'celdas', etiqueta: 'Celdas', tipo: 'oculto', defecto: {}, seccion: 'Mosaicos' },
    ],
    miembros: [...M_NODO, ...M_2D,
      { nombre: 'poner', firma: 'poner(columna, fila, mosaico)', descripcion: 'Pone un mosaico en esa celda.' },
      { nombre: 'quitar', firma: 'quitar(columna, fila)', descripcion: 'Borra el mosaico de esa celda.' },
      { nombre: 'hay_mosaico', firma: 'hay_mosaico(columna, fila)', descripcion: 'Verdadero si hay un mosaico ahí.' },
    ],
  },
  Plataforma: {
    familia: '2d', icono: 'plataforma', dim: '2D', descripcion: 'Un bloque sólido para pisar.', sencillo: 'Suelo o plataforma',
    props: [...T2D,
      { clave: 'ancho', etiqueta: 'Ancho', tipo: 'numero', defecto: 160, seccion: 'Bloque', min: 1 },
      { clave: 'alto', etiqueta: 'Alto', tipo: 'numero', defecto: 28, seccion: 'Bloque', min: 1 },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#22412E', seccion: 'Bloque' },
      { clave: 'color_borde', etiqueta: 'Color de la superficie', tipo: 'color', defecto: '#2F5E40', seccion: 'Bloque' },
      { clave: 'solido', etiqueta: 'Sólido', tipo: 'bool', defecto: true, seccion: 'Bloque' },
      { clave: 'solo_arriba', etiqueta: 'Se atraviesa por debajo', tipo: 'bool', defecto: false, seccion: 'Bloque' },
    ],
    miembros: [...M_NODO, ...M_2D, { nombre: 'color', tipo: 'texto', descripcion: 'Color del bloque.' }],
  },
  Area2D: {
    nombreVisible: 'Área2D', familia: '2d', icono: 'area', dim: '2D', descripcion: 'Una zona que detecta cuándo algo la toca: monedas, pinchos, metas…', sencillo: 'Zona que detecta',
    props: [...T2D,
      { clave: 'vigilar', etiqueta: 'Detecta', tipo: 'opciones', defecto: 'todo', seccion: 'Detección', opciones: [['todo', 'Todo'], ['personajes', 'Solo personajes']] },
    ],
    miembros: [...M_NODO, ...M_2D, { nombre: 'tocando', firma: 'tocando()', descripcion: 'Lista de nodos que la están tocando ahora.' }],
  },
  Fondo: {
    familia: '2d', icono: 'fondo', dim: '2D', descripcion: 'Un fondo de color, degradado o imagen con efecto paralaje.', sencillo: 'Fondo',
    props: [
      { clave: 'imagen', etiqueta: 'Imagen', tipo: 'recurso', filtro: 'imagen', defecto: '', seccion: 'Fondo' },
      { clave: 'color', etiqueta: 'Color de arriba', tipo: 'color', defecto: '#10293A', seccion: 'Fondo' },
      { clave: 'color2', etiqueta: 'Color de abajo', tipo: 'color', defecto: '#1D4A4F', seccion: 'Fondo' },
      { clave: 'montanas', etiqueta: 'Montañas', tipo: 'bool', defecto: true, seccion: 'Fondo' },
      { clave: 'paralaje', etiqueta: 'Paralaje', tipo: 'deslizador', defecto: 0.3, seccion: 'Fondo', min: 0, max: 1, paso: 0.05, ayuda: 'Cuánto se mueve con la cámara: 0 = fijo, 1 = como el nivel.' },
      { clave: 'z', etiqueta: 'Capa (Z)', tipo: 'entero', defecto: -100, seccion: 'Fondo' },
    ],
    miembros: [...M_NODO],
  },
  Particulas2D: {
    nombreVisible: 'Partículas2D', familia: '2d', icono: 'rayos', dim: '2D', descripcion: 'Chispas, polvo, humo o confeti.', sencillo: 'Efecto de partículas',
    props: [...T2D,
      { clave: 'cantidad', etiqueta: 'Cantidad por segundo', tipo: 'numero', defecto: 30, seccion: 'Partículas', min: 0, max: 500 },
      { clave: 'vida', etiqueta: 'Duración (s)', tipo: 'numero', defecto: 0.8, seccion: 'Partículas', min: 0.05, max: 10, paso: 0.05 },
      { clave: 'velocidad', etiqueta: 'Velocidad', tipo: 'numero', defecto: 120, seccion: 'Partículas', min: 0 },
      { clave: 'dispersion', etiqueta: 'Dispersión (°)', tipo: 'numero', defecto: 360, seccion: 'Partículas', min: 0, max: 360 },
      { clave: 'direccion', etiqueta: 'Dirección (°)', tipo: 'angulo', defecto: -90, seccion: 'Partículas' },
      { clave: 'gravedad_p', etiqueta: 'Gravedad', tipo: 'numero', defecto: 200, seccion: 'Partículas' },
      { clave: 'tam', etiqueta: 'Tamaño', tipo: 'numero', defecto: 5, seccion: 'Partículas', min: 1 },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#F2C46D', seccion: 'Partículas' },
      { clave: 'emitiendo', etiqueta: 'Emitiendo', tipo: 'bool', defecto: true, seccion: 'Partículas' },
    ],
    miembros: [...M_NODO, ...M_2D,
      { nombre: 'estallar', firma: 'estallar(cantidad)', descripcion: 'Lanza de golpe muchas partículas.' },
      { nombre: 'emitiendo', tipo: 'sí/no', descripcion: 'Si está soltando partículas.' },
    ],
  },
  // ---------- Interfaz ----------
  Interfaz: {
    familia: 'ui', icono: 'pantalla', dim: '2D', descripcion: 'Capa de interfaz: lo que se dibuja encima del juego (marcadores, botones).', sencillo: 'Marcadores y botones',
    props: [{ clave: 'visible_capa', etiqueta: 'Visible', tipo: 'bool', defecto: true, seccion: 'Interfaz' }],
    miembros: [...M_NODO],
  },
  Etiqueta: {
    familia: 'ui', icono: 'texto', dim: '2D', descripcion: 'Un texto en pantalla.', sencillo: 'Texto',
    props: [
      { clave: 'posicion', etiqueta: 'Posición', tipo: 'vector2', defecto: [24, 24], seccion: 'Transformación' },
      { clave: 'texto', etiqueta: 'Texto', tipo: 'texto', defecto: 'Texto', seccion: 'Texto' },
      { clave: 'tam', etiqueta: 'Tamaño', tipo: 'numero', defecto: 24, seccion: 'Texto', min: 6, max: 200 },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#E7EDE9', seccion: 'Texto' },
      { clave: 'fuente', etiqueta: 'Fuente', tipo: 'recurso', filtro: 'fuente', defecto: '', seccion: 'Texto' },
      { clave: 'alineacion', etiqueta: 'Alineación', tipo: 'opciones', defecto: 'izquierda', seccion: 'Texto', opciones: [['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']] },
      { clave: 'icono', etiqueta: 'Icono', tipo: 'opciones', defecto: 'ninguno', seccion: 'Texto', opciones: [['ninguno', 'Ninguno'], ['moneda', 'Moneda'], ['vida', 'Corazón'], ['estrella', 'Estrella']] },
      { clave: 'fondo', etiqueta: 'Fondo de píldora', tipo: 'bool', defecto: false, seccion: 'Texto' },
    ],
    miembros: [...M_NODO, ...M_2D, { nombre: 'texto', tipo: 'texto', descripcion: 'Lo que pone.' }, { nombre: 'color', tipo: 'texto', descripcion: 'Color del texto.' }, { nombre: 'tam', tipo: 'decimal', descripcion: 'Tamaño de la letra.' }],
  },
  Boton: {
    nombreVisible: 'Botón', familia: 'ui', icono: 'boton', dim: '2D', descripcion: 'Un botón que se puede pulsar. Reacciona con «cuando hace_clic()».', sencillo: 'Botón',
    props: [
      { clave: 'posicion', etiqueta: 'Posición', tipo: 'vector2', defecto: [24, 80], seccion: 'Transformación' },
      { clave: 'texto', etiqueta: 'Texto', tipo: 'texto', defecto: 'Jugar', seccion: 'Botón' },
      { clave: 'ancho', etiqueta: 'Ancho', tipo: 'numero', defecto: 200, seccion: 'Botón', min: 10 },
      { clave: 'alto', etiqueta: 'Alto', tipo: 'numero', defecto: 52, seccion: 'Botón', min: 10 },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#3DDC84', seccion: 'Botón' },
      { clave: 'color_texto', etiqueta: 'Color del texto', tipo: 'color', defecto: '#04140B', seccion: 'Botón' },
      { clave: 'escena', etiqueta: 'Ir a la escena', tipo: 'recurso', filtro: 'escena', defecto: '', seccion: 'Botón', ayuda: 'Si eliges una escena, el botón la abre al pulsarlo.' },
    ],
    miembros: [...M_NODO, ...M_2D, { nombre: 'texto', tipo: 'texto', descripcion: 'Lo que pone el botón.' }],
  },
  PanelUI: {
    nombreVisible: 'Panel', familia: 'ui', icono: 'panel', dim: '2D', descripcion: 'Un rectángulo de fondo para la interfaz.', sencillo: 'Panel',
    props: [
      { clave: 'posicion', etiqueta: 'Posición', tipo: 'vector2', defecto: [16, 16], seccion: 'Transformación' },
      { clave: 'ancho', etiqueta: 'Ancho', tipo: 'numero', defecto: 240, seccion: 'Panel', min: 1 },
      { clave: 'alto', etiqueta: 'Alto', tipo: 'numero', defecto: 120, seccion: 'Panel', min: 1 },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#0E1210', seccion: 'Panel' },
      { clave: 'opacidad', etiqueta: 'Opacidad', tipo: 'deslizador', defecto: 0.85, seccion: 'Panel', min: 0, max: 1, paso: 0.01 },
      { clave: 'radio', etiqueta: 'Radio de esquinas', tipo: 'numero', defecto: 12, seccion: 'Panel', min: 0 },
    ],
    miembros: [...M_NODO, ...M_2D],
  },
  // ---------- 3D ----------
  Nodo3D: {
    familia: '3d', icono: 'nodo', dim: '3D', descripcion: 'Un punto vacío en 3D para agrupar.', sencillo: 'Grupo',
    props: [...T3D], miembros: [...M_NODO, ...M_3D],
  },
  Malla3D: {
    familia: '3d', icono: 'cubo', dim: '3D', descripcion: 'Un objeto 3D: una forma básica o un modelo importado.', sencillo: 'Objeto 3D',
    props: [...T3D,
      { clave: 'malla', etiqueta: 'Malla', tipo: 'malla', defecto: 'cubo', seccion: 'Malla', opciones: PRIMITIVAS },
      { clave: 'modo', etiqueta: 'Tipo', tipo: 'opciones', defecto: 'solido', seccion: 'Malla', opciones: [['solido', 'Sólido'], ['hueco', 'Hueco (recorta)']], ayuda: '«Hueco» no se ve en el juego: recorta su forma en los cubos, esferas, cilindros, cápsulas y conos sólidos que toca, y deja pasar por ahí. Úsalo para puertas, ventanas y pasos. En el editor se ve como una caja roja translúcida. Si lo ocultas, deja de recortar. Ponlo al lado del muro en el árbol, no dentro: dentro heredaría la escala del muro.' },
      { clave: 'material', etiqueta: 'Material', tipo: 'recurso', filtro: 'material', defecto: '', seccion: 'Material' },
      { clave: 'escala_textura', etiqueta: 'Tamaño de textura (m)', tipo: 'numero', defecto: 2, seccion: 'Material', min: 0.05, paso: 0.1, ayuda: 'Cuántos metros mide cada repetición de la textura. Se mantiene al escalar el objeto, así la textura nunca se estira: más pequeño = ladrillos o tablas más pequeños.' },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#8A8F8C', seccion: 'Material' },
      { clave: 'rugosidad', etiqueta: 'Rugosidad', tipo: 'deslizador', defecto: 0.7, seccion: 'Material', min: 0, max: 1, paso: 0.01 },
      { clave: 'metalico', etiqueta: 'Metálico', tipo: 'deslizador', defecto: 0, seccion: 'Material', min: 0, max: 1, paso: 0.01 },
      { clave: 'sombras', etiqueta: 'Sombras', tipo: 'bool', defecto: true, seccion: 'Material', texto: ['Proyecta', 'No proyecta'] },
      { clave: 'reflejo', etiqueta: 'Reflejo', tipo: 'opciones', defecto: 'sonda', seccion: 'Material', opciones: [['sonda', 'De la escena'], ['plano', 'Espejo plano'], ['curvo', 'Espejo curvo']], ayuda: 'Para formas básicas sin archivo de material. «Espejo plano» refleja por la cara de arriba (eje Y) como un espejo de verdad; «Espejo curvo» captura la escena desde el centro del objeto. Se ve con Lumbre (modo Final y en el juego).' },
      { clave: 'colision', etiqueta: 'Colisión', tipo: 'opciones', defecto: 'caja', seccion: 'Física', opciones: [['ninguna', 'Ninguna'], ['caja', 'Caja'], ['esfera', 'Esfera'], ['area', 'Solo detectar (área)']] },
      { clave: 'empujable', etiqueta: 'Se puede empujar', tipo: 'bool', defecto: false, seccion: 'Física' },
      { clave: 'peso', etiqueta: 'Peso (kg)', tipo: 'numero', defecto: 10, seccion: 'Física', min: 0.1 },
    ],
    miembros: [...M_NODO, ...M_3D, { nombre: 'color', tipo: 'texto', descripcion: 'Color del material.' }],
  },
  Luz3D: {
    familia: '3d', icono: 'bombilla', dim: '3D', descripcion: 'Ilumina la escena: sol, bombilla o foco.', sencillo: 'Luz',
    props: [...T3D,
      { clave: 'tipo_luz', etiqueta: 'Tipo', tipo: 'opciones', defecto: 'sol', seccion: 'Luz', opciones: [['sol', 'Sol (direccional)'], ['puntual', 'Bombilla (puntual)'], ['foco', 'Foco']] },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#FFF4DD', seccion: 'Luz' },
      { clave: 'intensidad', etiqueta: 'Intensidad', tipo: 'numero', defecto: 2, seccion: 'Luz', min: 0, max: 50, paso: 0.1 },
      { clave: 'alcance', etiqueta: 'Alcance', tipo: 'numero', defecto: 12, seccion: 'Luz', min: 0 },
      { clave: 'sombras', etiqueta: 'Sombras', tipo: 'bool', defecto: true, seccion: 'Luz', texto: ['Proyecta', 'No proyecta'] },
    ],
    miembros: [...M_NODO, ...M_3D, { nombre: 'intensidad', tipo: 'decimal', descripcion: 'Brillo de la luz.' }, { nombre: 'color', tipo: 'texto', descripcion: 'Color de la luz.' }],
  },
  Entorno: {
    familia: '3d', icono: 'globo', dim: '3D', descripcion: 'El cielo, la niebla y la luz ambiental de la escena.', sencillo: 'Cielo y ambiente',
    props: [
      { clave: 'cielo', etiqueta: 'Cielo', tipo: 'color', defecto: '#0B1410', seccion: 'Entorno' },
      { clave: 'horizonte', etiqueta: 'Horizonte', tipo: 'color', defecto: '#1A2620', seccion: 'Entorno' },
      { clave: 'ambiente', etiqueta: 'Luz ambiental', tipo: 'deslizador', defecto: 0.35, seccion: 'Entorno', min: 0, max: 2, paso: 0.01 },
      { clave: 'niebla', etiqueta: 'Niebla', tipo: 'bool', defecto: false, seccion: 'Entorno' },
      { clave: 'densidad', etiqueta: 'Densidad de niebla', tipo: 'deslizador', defecto: 0.04, seccion: 'Entorno', min: 0, max: 0.3, paso: 0.005 },
      { clave: 'iluminacion_global', etiqueta: 'Iluminación global', tipo: 'bool', defecto: false, seccion: 'Iluminación global · Lumbre', texto: ['Activada', 'Desactivada'], ayuda: 'La luz rebota entre las superficies y los materiales que brillan iluminan su alrededor, como Lumen en Unreal. Necesita calidad Media o superior.' },
      { clave: 'intensidad_gi', etiqueta: 'Intensidad de los rebotes', tipo: 'deslizador', defecto: 1, seccion: 'Iluminación global · Lumbre', min: 0, max: 3, paso: 0.05 },
      { clave: 'luz_cielo', etiqueta: 'Luz del cielo', tipo: 'deslizador', defecto: 1, seccion: 'Iluminación global · Lumbre', min: 0, max: 4, paso: 0.05, ayuda: 'Cuánta luz entra desde el cielo. Se tapa con techos y muros, como el SkyLight de Unreal.' },
      { clave: 'gi_dinamica', etiqueta: 'Tiempo real', tipo: 'bool', defecto: true, seccion: 'Iluminación global · Lumbre', texto: ['Siempre al día', 'Solo al empezar'], ayuda: 'En tiempo real, las luces que se mueven o parpadean cambian los rebotes. Desactívalo en escenas estáticas para ganar rendimiento.' },
      { clave: 'reflejos_escena', etiqueta: 'Reflejos de la escena', tipo: 'bool', defecto: true, seccion: 'Iluminación global · Lumbre', texto: ['Activados', 'Desactivados'], ayuda: 'Los metales y superficies brillantes reflejan la escena real que les rodea.' },
      { clave: 'oclusion', etiqueta: 'Oclusión ambiental', tipo: 'bool', defecto: true, seccion: 'Posproceso', texto: ['Activada', 'Desactivada'], ayuda: 'Sombras suaves en esquinas y zonas de contacto (GTAO).' },
      { clave: 'intensidad_oclusion', etiqueta: 'Intensidad de la oclusión', tipo: 'deslizador', defecto: 1, seccion: 'Posproceso', min: 0, max: 2, paso: 0.05 },
      { clave: 'resplandor', etiqueta: 'Resplandor', tipo: 'bool', defecto: true, seccion: 'Posproceso', texto: ['Activado', 'Desactivado'], ayuda: 'Las luces fuertes y los materiales que brillan desprenden un halo (bloom).' },
      { clave: 'intensidad_resplandor', etiqueta: 'Intensidad del resplandor', tipo: 'deslizador', defecto: 0.5, seccion: 'Posproceso', min: 0, max: 3, paso: 0.05 },
      { clave: 'exposicion', etiqueta: 'Exposición', tipo: 'deslizador', defecto: 1, seccion: 'Posproceso', min: 0.2, max: 3, paso: 0.05 },
      { clave: 'exposicion_automatica', etiqueta: 'Exposición automática', tipo: 'bool', defecto: true, seccion: 'Posproceso', texto: ['Activada', 'Desactivada'], ayuda: 'La imagen se aclara poco a poco al entrar en sitios oscuros y se oscurece al salir al sol, como el ojo. «Exposición» la sube o baja por encima. Necesita calidad Media o superior.' },
    ],
    miembros: [...M_NODO],
  },
  VolumenLumbre: {
    nombreVisible: 'Volumen Lumbre', familia: '3d', icono: 'cuadricula', dim: '3D', descripcion: 'Una zona con iluminación global más detallada (más sondas). Úsalo en salas cerradas para que la luz no se cuele por las paredes.', sencillo: 'Zona de luz detallada',
    props: [...T3D.map(p => p.clave === 'escala' ? { ...p, etiqueta: 'Tamaño', defecto: [6, 4, 6] } : p),
      { clave: 'densidad', etiqueta: 'Sondas por metro', tipo: 'deslizador', defecto: 1.5, seccion: 'Lumbre', min: 0.25, max: 4, paso: 0.05, ayuda: 'Más sondas = luz más precisa, pero tarda más en actualizarse. El total está limitado por la calidad gráfica.' },
    ],
    miembros: [...M_NODO, ...M_3D],
  },
  Camara3D: {
    nombreVisible: 'Cámara3D', familia: '3d', icono: 'camara', dim: '3D', descripcion: 'Lo que ve el jugador en 3D. Si está dentro del jugador, le sigue.', sencillo: 'Lo que ve el jugador',
    props: [...T3D,
      { clave: 'fov', etiqueta: 'Campo de visión (°)', tipo: 'numero', defecto: 70, seccion: 'Cámara', min: 10, max: 150 },
      { clave: 'actual', etiqueta: 'Cámara activa', tipo: 'bool', defecto: true, seccion: 'Cámara' },
      { clave: 'raton', etiqueta: 'Girar con el ratón', tipo: 'bool', defecto: false, seccion: 'Cámara' },
    ],
    miembros: [...M_NODO, ...M_3D, { nombre: 'fov', tipo: 'decimal', descripcion: 'Campo de visión.' }],
  },
  Personaje3D: {
    familia: '3d', icono: 'persona', dim: '3D', descripcion: 'Un personaje que anda y salta en 3D.', sencillo: 'Tu personaje',
    props: [...T3D,
      { clave: 'velocidad', etiqueta: 'Velocidad', tipo: 'numero', defecto: 5, seccion: 'Movimiento', min: 0, max: 40, paso: 0.1, sencillo: { etiqueta: 'Velocidad al andar', izq: 'Lento', der: 'Rápido' } },
      { clave: 'salto', etiqueta: 'Salto', tipo: 'numero', defecto: 6, seccion: 'Movimiento', min: 0, max: 30, paso: 0.1, sencillo: { etiqueta: 'Altura del salto' } },
      { clave: 'usa_gravedad', etiqueta: 'Gravedad', tipo: 'bool', defecto: true, seccion: 'Movimiento', texto: ['Activada', 'Desactivada'] },
      { clave: 'gravedad', etiqueta: 'Fuerza de gravedad', tipo: 'numero', defecto: 18, seccion: 'Movimiento', min: 0 },
      { clave: 'controles', etiqueta: 'Controles', tipo: 'opciones', defecto: 'ninguno', seccion: 'Movimiento', opciones: [['ninguno', 'Solo con lógica'], ['tercera_persona', 'Tercera persona (WASD + ratón)'], ['primera_persona', 'Primera persona (WASD + ratón)']], ayuda: 'Movimiento y cámara listos para usar. La Cámara3D hija del personaje marca la distancia inicial en tercera persona. Clic en el juego para mirar con el ratón; también funciona con mando (stick derecho) y la rueda acerca o aleja.' },
      { clave: 'sensibilidad', etiqueta: 'Sensibilidad del ratón', tipo: 'deslizador', defecto: 1, seccion: 'Cámara', min: 0.2, max: 3, paso: 0.05 },
      { clave: 'invertir_y', etiqueta: 'Invertir eje vertical', tipo: 'bool', defecto: false, seccion: 'Cámara', texto: ['Invertido', 'Normal'] },
      { clave: 'cambiar_vista', etiqueta: 'Cambiar de vista', tipo: 'bool', defecto: true, seccion: 'Cámara', texto: ['Con la tecla V', 'No'], ayuda: 'La acción «cambiar_vista» (V, o Y en el mando) pasa de tercera a primera persona y al revés.' },
      { clave: 'color', etiqueta: 'Color', tipo: 'color', defecto: '#3DDC84', seccion: 'Aspecto' },
      { clave: 'altura', etiqueta: 'Altura', tipo: 'numero', defecto: 1.8, seccion: 'Aspecto', min: 0.2, paso: 0.1 },
      { clave: 'modelo', etiqueta: 'Modelo', tipo: 'recurso', filtro: 'modelo', defecto: '', seccion: 'Aspecto', ayuda: 'Un modelo .glb o .gltf. Vacío: una cápsula del color elegido.' },
      { clave: 'animaciones_3d', etiqueta: 'Clips y equipo 3D', tipo: 'recurso', defecto: '', seccion: 'Aspecto', ayuda: 'Manifiesto JSON de clips GLB, huesos y equipo. Conserva el rig de cada instancia.' },
      { clave: 'tactico', etiqueta: 'Movimiento CQB', tipo: 'bool', defecto: false, seccion: 'Movimiento', ayuda: 'Cámara y colisión para agacharse, inclinarse, apuntar y andar despacio. Las reglas de combate pertenecen al Blueprint.' },
      { clave: 'ruta_patru', etiqueta: 'Balizas de patrulla', tipo: 'texto', defecto: '', seccion: 'Movimiento', ayuda: 'Nombres de los nodos de ruta separados por punto y coma. Patrullar calcula un recorrido con colisión hasta cada baliza.' },
      { clave: 'arma_modelo', etiqueta: 'Arma del personaje', tipo: 'recurso', filtro: 'modelo', defecto: '', seccion: 'Aspecto', ayuda: 'GLB con Boca, GripR y GripL. El operador usa su inventario; los enemigos reutilizan este modelo.' },
      { clave: 'sombras', etiqueta: 'Sombras', tipo: 'bool', defecto: true, seccion: 'Aspecto', texto: ['Proyecta', 'No proyecta'], ayuda: 'Proyecta sombra con el sol, las bombillas y los focos (según la calidad gráfica).' },
    ],
    miembros: [...M_NODO, ...M_3D,
      ...['animar_3d', 'equipar_arma', 'arma_dato', 'arma_libre', 'disparar_arma', 'interactuar', 'objetivo_interaccion', 'detectar', 'oir_disparo', 'recordar_objetivo', 'patrullar', 'investigar', 'buscar_cobertura', 'apuntar_a'].map(nombre => ({ nombre, firma: nombre + '(a, b, c)', descripcion: 'Primitiva táctica 3D. Consulta GUIA_CQB.md en la plantilla para los parámetros y ejemplos Blueprint.' })),
      { nombre: 'mover', firma: 'mover(x, z)', descripcion: 'Mueve al personaje este fotograma (relativo a la cámara).' },
      { nombre: 've_a', firma: 've_a(objetivo, alcance)', descripcion: 'Comprueba visión 3D; paredes y coberturas la bloquean.' },
      { nombre: 'perseguir', firma: 'perseguir(objetivo, velocidad)', descripcion: 'Avanza hacia el objetivo con colisión física. No calcula rutas alrededor de paredes.' },
      { nombre: 'saltar', firma: 'saltar(fuerza)', descripcion: 'Salta. Sin dato usa su «salto».' },
      { nombre: 'en_el_suelo', firma: 'en_el_suelo()', descripcion: 'Verdadero si está en el suelo.' },
      { nombre: 'velocidad', tipo: 'decimal', descripcion: 'Velocidad al andar.' },
      { nombre: 'salto', tipo: 'decimal', descripcion: 'Fuerza del salto.' },
      { nombre: 'velocidad_y', tipo: 'decimal', descripcion: 'Velocidad vertical actual.' },
    ],
  },
  // ---------- Generales ----------
  Sonido: {
    familia: 'general', icono: 'altavoz', dim: 'ambos', descripcion: 'Reproduce un sonido o una música.', sencillo: 'Sonido',
    props: [
      { clave: 'sonido', etiqueta: 'Archivo', tipo: 'recurso', filtro: 'sonido', defecto: '', seccion: 'Sonido' },
      { clave: 'volumen', etiqueta: 'Volumen', tipo: 'deslizador', defecto: 0.8, seccion: 'Sonido', min: 0, max: 1, paso: 0.01 },
      { clave: 'bucle', etiqueta: 'En bucle', tipo: 'bool', defecto: false, seccion: 'Sonido' },
      { clave: 'al_empezar', etiqueta: 'Sonar al empezar', tipo: 'bool', defecto: false, seccion: 'Sonido' },
    ],
    miembros: [...M_NODO, { nombre: 'reproducir', firma: 'reproducir()', descripcion: 'Hace sonar el sonido.' }, { nombre: 'parar', firma: 'parar()', descripcion: 'Lo detiene.' }, { nombre: 'volumen', tipo: 'decimal', descripcion: 'De 0 a 1.' }],
  },
  Temporizador: {
    familia: 'logica', icono: 'temporizador', dim: 'ambos', descripcion: 'Cuenta atrás. Al llegar a cero lanza «cuando termina()».', sencillo: 'Cuenta atrás',
    props: [
      { clave: 'tiempo', etiqueta: 'Segundos', tipo: 'numero', defecto: 1, seccion: 'Temporizador', min: 0.01, paso: 0.1 },
      { clave: 'repetir', etiqueta: 'Repetir', tipo: 'bool', defecto: false, seccion: 'Temporizador' },
      { clave: 'al_empezar', etiqueta: 'Empezar solo', tipo: 'bool', defecto: true, seccion: 'Temporizador' },
    ],
    miembros: [...M_NODO, { nombre: 'iniciar', firma: 'iniciar()', descripcion: 'Empieza la cuenta atrás.' }, { nombre: 'parar', firma: 'parar()', descripcion: 'Detiene la cuenta.' }, { nombre: 'restante', tipo: 'decimal', descripcion: 'Segundos que quedan.' }],
  },
};

for (const [k, t] of Object.entries(TIPOS)) { t.id = k; t.nombreVisible ||= k; }

export function tipo(id) { return TIPOS[id] || TIPOS.Nodo2D; }

export function propiedadesDe(id) { return tipo(id).props; }

export function valoresPorDefecto(id) {
  const r = {};
  for (const p of tipo(id).props) r[p.clave] = structuredClone(p.defecto);
  return r;
}

export function miembrosDe(id) {
  return tipo(id).miembros || M_NODO;
}

export function nombresMiembros(id) {
  const t = TIPOS[id];
  if (!t) {
    // Tipo desconocido: todos los miembros posibles.
    const s = new Set();
    for (const x of Object.values(TIPOS)) for (const m of x.miembros || []) s.add(m.nombre);
    return [...s];
  }
  return (t.miembros || []).map(m => m.nombre);
}

export function tiposPara(dim) {
  return Object.values(TIPOS).filter(t => t.dim === dim || t.dim === 'ambos' || (dim === '2D' && t.familia === 'ui'));
}

let contador = 0;
export function nuevoId() {
  contador = (contador + 1) % 1e6;
  return 'n' + Date.now().toString(36) + contador.toString(36) + Math.random().toString(36).slice(2, 5);
}

/** Crea un nodo nuevo con sus valores por defecto. */
export function crearNodo(tipoId, nombre, props = {}, hijos = []) {
  return {
    id: nuevoId(),
    nombre: nombre || tipo(tipoId).nombreVisible,
    tipo: tipoId,
    props: { ...valoresPorDefecto(tipoId), ...structuredClone(props) },
    hijos,
    script: null,
    blueprint: null,
    exportados: {},
    grupos: [],
    senales: [],
    visible: true,
  };
}

/** Rellena propiedades que falten (por ejemplo al abrir escenas antiguas o de Talon). */
export function normalizarNodo(n) {
  n.id ||= nuevoId();
  n.tipo ||= 'Nodo2D';
  n.nombre ||= tipo(n.tipo).nombreVisible;
  n.props = { ...valoresPorDefecto(n.tipo), ...(n.props || {}) };
  n.hijos = (n.hijos || []).map(normalizarNodo);
  n.exportados ||= {};
  n.grupos ||= [];
  n.senales ||= [];
  if (n.visible === undefined) n.visible = true;
  n.script ||= null;
  n.blueprint ||= null;
  return n;
}

export function recorrer(n, fn, padre = null) {
  if (fn(n, padre) === false) return;
  for (const h of n.hijos) recorrer(h, fn, n);
}

export function buscarNodo(raiz, id) {
  let r = null;
  recorrer(raiz, (n) => { if (n.id === id) { r = n; return false; } });
  return r;
}

export function buscarPadre(raiz, id) {
  let r = null;
  recorrer(raiz, (n, p) => { if (n.id === id) { r = p; return false; } });
  return r;
}

export function clonarNodo(n) {
  const c = structuredClone(n);
  recorrer(c, (x) => { x.id = nuevoId(); });
  return c;
}

// Dimensión de un tipo para elegir el editor (2D o 3D).
export function esTipo3D(id) { return tipo(id).dim === '3D'; }

