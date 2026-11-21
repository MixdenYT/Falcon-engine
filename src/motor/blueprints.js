// Blueprints: catálogo de bloques (NODOS), pines y tipos. Se compilan a Ara con src/motor/blueprints-ara.js.

export const TIPOS_DATO = {
  exec: { nombre: 'Ejecución', color: '#E7EDE9' },
  bool: { nombre: 'Sí / no', color: '#F07A7A' },
  decimal: { nombre: 'Decimal', color: '#B5E35A' },
  entero: { nombre: 'Entero', color: '#74B6F7' },
  texto: { nombre: 'Texto', color: '#F2B85C' },
  objeto: { nombre: 'Objeto', color: '#B39DFF' },
  lista: { nombre: 'Lista', color: '#4FD1C5' },
  cualquiera: { nombre: 'Cualquiera', color: '#A9B5AE' },
};

export const CATEGORIAS = [
  { id: 'Eventos', icono: 'rayo', color: '#3DDC84', cabecera: '#1E4A31' },
  { id: 'Entrada', icono: 'boton', color: '#B39DFF', cabecera: '#33294F' },
  { id: 'Movimiento', icono: 'mas', color: '#74B6F7', cabecera: '#1F344B' },
  { id: 'Lógica', icono: 'cadena', color: '#A9B5AE', cabecera: '#2A322E' },
  { id: 'Matemáticas', icono: 'mas', color: '#B5E35A', cabecera: '#333D1D' },
  { id: 'Variables', icono: 'lista', color: '#4FD1C5', cabecera: '#1C3C3A' },
  { id: 'Escena', icono: 'escena', color: '#4FD1C5', cabecera: '#1C3C3A' },
  { id: 'Texto', icono: 'texto', color: '#F2B85C', cabecera: '#45361C' },
  { id: 'Audio', icono: 'altavoz', color: '#F7A26B', cabecera: '#46301F' },
];

// Ayudantes para definir nodos.
const ent = (n, t, def, etq) => ({ n, t, def, etq: etq ?? n });
const sal = (n, t, etq) => ({ n, t, etq: etq ?? n });
const EXEC_IN = ent('entrada', 'exec', null, '');
const EXEC_OUT = sal('salida', 'exec', '');
const OBJETO = ent('objeto', 'objeto', null, 'objeto (vacío = yo)');
const ARGUMENTOS = [ent('a', 'cualquiera', null, 'argumento 1'), ent('b', 'cualquiera', null, 'argumento 2'), ent('c', 'cualquiera', null, 'argumento 3')];


export const NODOS = {
  // ---------- Eventos ----------
  ev_empieza: { titulo: 'Al empezar', subtitulo: 'una vez', cat: 'Eventos', evento: 'empieza', salidas: [sal('salida', 'exec', 'una vez')], ayuda: 'Se ejecuta una sola vez, cuando el nodo aparece en el juego.' },
  ev_actualizar: { titulo: 'Al actualizar', cat: 'Eventos', evento: 'se_actualiza', params: ['delta'], salidas: [sal('salida', 'exec', 'cada fotograma'), sal('delta', 'decimal', 'segundos')], ayuda: 'Se ejecuta en cada fotograma del juego, unas 60 veces por segundo.' },
  ev_tocar: { titulo: 'Al tocar', cat: 'Eventos', evento: 'toca', params: ['otro'], salidas: [sal('salida', 'exec', ''), sal('otro', 'objeto', 'otro')], ayuda: 'Cuando este nodo empieza a tocar a otro. «otro» es lo que ha tocado.' },
  ev_dejar: { titulo: 'Al dejar de tocar', cat: 'Eventos', evento: 'deja_de_tocar', params: ['otro'], salidas: [sal('salida', 'exec', ''), sal('otro', 'objeto', 'otro')], ayuda: 'Cuando deja de tocar a otro nodo.' },
  ev_pulsar: { titulo: 'Cuando se pulsa', cat: 'Eventos', evento: 'se_pulsa', filtro: 'accion', entradas: [ent('accion', 'texto', 'saltar', 'acción')], salidas: [EXEC_OUT], soloValor: true, ayuda: 'Cuando el jugador pulsa la tecla de esa acción (por ejemplo «saltar» es Espacio).' },
  ev_soltar: { titulo: 'Cuando se suelta', cat: 'Eventos', evento: 'se_suelta', filtro: 'accion', entradas: [ent('accion', 'texto', 'saltar', 'acción')], salidas: [EXEC_OUT], soloValor: true, ayuda: 'Cuando el jugador suelta la tecla de esa acción.' },
  ev_recibir: { titulo: 'Al recibir señal', cat: 'Eventos', evento: 'recibe', filtro: 'senal', params: ['datos'], entradas: [ent('senal', 'texto', 'abrir', 'señal')], salidas: [EXEC_OUT, sal('datos', 'cualquiera', 'datos')], soloValor: true, ayuda: 'Cuando algún script emite esta señal con «Emitir señal».' },
  ev_clic: { titulo: 'Al hacer clic', cat: 'Eventos', evento: 'hace_clic', salidas: [EXEC_OUT], ayuda: 'Cuando se hace clic sobre este nodo o botón.' },
  ev_termina: { titulo: 'Al terminar', cat: 'Eventos', evento: 'termina', salidas: [EXEC_OUT], ayuda: 'Cuando un Temporizador llega a cero.' },
  fn_entrada: { titulo: 'Entrada de función', cat: 'Eventos', oculto: true, salidas: [EXEC_OUT], ayuda: 'Aquí empieza la función.' },

  // ---------- Entrada ----------
  in_pulsada: { titulo: 'Acción pulsada', cat: 'Entrada', entradas: [ent('accion', 'texto', 'saltar', 'acción')], soloValor: true, salidas: [sal('pulsada', 'bool', 'pulsada')], ayuda: 'Verdadero solo en el momento en que se pulsa la acción.' },
  in_mantenida: { titulo: 'Acción mantenida', cat: 'Entrada', entradas: [ent('accion', 'texto', 'correr', 'acción')], soloValor: true, salidas: [sal('pulsada', 'bool', 'mantenida')], ayuda: 'Verdadero mientras la acción siga pulsada.' },
  in_eje: { titulo: 'Eje', cat: 'Entrada', entradas: [ent('negativa', 'texto', 'izquierda', '−'), ent('positiva', 'texto', 'derecha', '+')], soloValor: true, salidas: [sal('valor', 'decimal', '-1 · 0 · 1')], ayuda: 'Da -1 si se pulsa la acción negativa, 1 si se pulsa la positiva y 0 si ninguna.' },
  in_raton: { titulo: 'Posición del ratón', cat: 'Entrada', salidas: [sal('x', 'decimal', 'x'), sal('y', 'decimal', 'y')], ayuda: 'Dónde está el ratón en el mundo.' },
  in_clic: { titulo: 'Ratón pulsado', cat: 'Entrada', salidas: [sal('pulsado', 'bool', 'pulsado')], ayuda: 'Verdadero mientras el botón izquierdo esté pulsado.' },

  // ---------- Movimiento ----------
  mv_mover: { titulo: 'Mover', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'velocidad x'), ent('y', 'decimal', null, 'velocidad y')], salidas: [EXEC_OUT], ayuda: 'Mueve al personaje este fotograma, en píxeles por segundo.' },
  mv_saltar: { titulo: 'Saltar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('fuerza', 'decimal', 420, 'fuerza')], salidas: [EXEC_OUT], ayuda: 'Impulsa al personaje hacia arriba con esa fuerza.' },
  mv_suelo: { titulo: 'En el suelo', cat: 'Movimiento', salidas: [sal('valor', 'bool', 'sí / no')], ayuda: 'Verdadero si el personaje está apoyado en el suelo.' },
  mv_posicion: { titulo: 'Posición', cat: 'Movimiento', entradas: [ent('objeto', 'objeto', null, 'de')], salidas: [sal('x', 'decimal', 'x'), sal('y', 'decimal', 'y')], ayuda: 'La posición de este nodo (o del que conectes).' },
  mv_fijar: { titulo: 'Colocar en', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', 0, 'y')], salidas: [EXEC_OUT], ayuda: 'Coloca el nodo en esa posición.' },
  mv_desplazar: { titulo: 'Desplazar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'dx'), ent('y', 'decimal', 0, 'dy')], salidas: [EXEC_OUT], ayuda: 'Mueve el nodo esa distancia de golpe.' },
  mv_empujar: { titulo: 'Empujar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', -300, 'y')], salidas: [EXEC_OUT], ayuda: 'Da un empujón al personaje.' },

  // ---------- Lógica ----------
  lg_si: { titulo: 'Si', subtitulo: 'Control de flujo', icono: 'cadena', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('condicion', 'bool', true, 'condición')], salidas: [sal('verdadero', 'exec', 'verdadero'), sal('falso', 'exec', 'falso')], ayuda: 'Elige un camino según una condición. Si es verdadera, sigue por «verdadero»; si no, por «falso».' },
  lg_y: { titulo: 'Y', cat: 'Lógica', entradas: [ent('a', 'bool', true, 'a'), ent('b', 'bool', true, 'b')], salidas: [sal('resultado', 'bool', 'resultado')], ayuda: 'Verdadero solo si a y b son verdaderos a la vez.' },
  lg_o: { titulo: 'O', cat: 'Lógica', entradas: [ent('a', 'bool', false, 'a'), ent('b', 'bool', false, 'b')], salidas: [sal('resultado', 'bool', 'resultado')], ayuda: 'Verdadero si al menos uno de los dos es verdadero.' },
  lg_no: { titulo: 'No', cat: 'Lógica', entradas: [ent('valor', 'bool', false, 'valor')], salidas: [sal('resultado', 'bool', 'resultado')], ayuda: 'Le da la vuelta: verdadero pasa a falso y al revés.' },
  lg_comparar: { titulo: 'Comparar', cat: 'Lógica', entradas: [ent('a', 'decimal', 0, 'a'), ent('op', 'opcion', '>=', ''), ent('b', 'decimal', 0, 'b')], opciones: { op: ['==', '!=', '<', '>', '<=', '>='] }, salidas: [sal('resultado', 'bool', 'resultado')], ayuda: 'Compara dos números: igual, distinto, menor, mayor…' },
  lg_es: { titulo: 'Es…', cat: 'Lógica', entradas: [ent('objeto', 'objeto', null, 'objeto'), ent('nombre', 'texto', 'Moneda', 'nombre')], salidas: [sal('resultado', 'bool', 'sí / no')], ayuda: 'Verdadero si el objeto se llama así, es de ese tipo o está en ese grupo.' },
  lg_secuencia: { titulo: 'Secuencia', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN], salidas: [sal('primero', 'exec', 'primero'), sal('despues', 'exec', 'después')], ayuda: 'Hace primero una cosa y después otra.' },
  lg_repetir: { titulo: 'Repetir', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('veces', 'entero', 3, 'veces')], salidas: [sal('cuerpo', 'exec', 'cada vez'), sal('indice', 'entero', 'vuelta'), sal('salida', 'exec', 'al terminar')], ayuda: 'Repite lo conectado a «cada vez» un número de veces.' },
  lg_mientras: { titulo: 'Mientras', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('condicion', 'bool', false, 'condición')], salidas: [sal('cuerpo', 'exec', 'repetir'), sal('salida', 'exec', 'al terminar')], ayuda: 'Repite mientras la condición sea verdadera. ¡Cuidado con los bucles infinitos!' },
  lg_esperar: { titulo: 'Esperar', cat: 'Lógica', exec: true, entradas: [EXEC_IN, ent('segundos', 'decimal', 1, 'segundos')], salidas: [EXEC_OUT], ayuda: 'Espera unos segundos antes de seguir. El juego no se para.' },

  // ---------- Matemáticas ----------
  mt_numero: { titulo: 'Número', cat: 'Matemáticas', compacto: true, entradas: [ent('valor', 'decimal', 0, '')], soloValor: true, salidas: [sal('valor', 'decimal', '')], ayuda: 'Un número fijo.' },
  mt_sumar: { titulo: 'Sumar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 0, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a + b')], ayuda: 'Suma dos números.' },
  mt_restar: { titulo: 'Restar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 0, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a − b')], ayuda: 'Resta b a a.' },
  mt_multiplicar: { titulo: 'Multiplicar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 1, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a × b')], ayuda: 'Multiplica dos números.' },
  mt_dividir: { titulo: 'Dividir', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 1, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a ÷ b')], ayuda: 'Divide a entre b.' },
  mt_aleatorio: { titulo: 'Aleatorio', cat: 'Matemáticas', entradas: [ent('min', 'decimal', 0, 'mín'), ent('max', 'decimal', 100, 'máx')], salidas: [sal('valor', 'decimal', 'valor')], ayuda: 'Un número al azar entre mín y máx.' },
  mt_limitar: { titulo: 'Limitar', cat: 'Matemáticas', entradas: [ent('valor', 'decimal', 0, 'valor'), ent('min', 'decimal', 0, 'mín'), ent('max', 'decimal', 100, 'máx')], salidas: [sal('resultado', 'decimal', 'resultado')], ayuda: 'Mantiene el valor entre mín y máx.' },
  mt_distancia: { titulo: 'Distancia', cat: 'Matemáticas', entradas: [ent('a', 'objeto', null, 'a'), ent('b', 'objeto', null, 'b')], salidas: [sal('valor', 'decimal', 'distancia')], ayuda: 'Distancia entre dos nodos.' },

  // ---------- Variables ----------
  var_obtener: { titulo: 'Variable', cat: 'Variables', variable: true, compacto: true, salidas: [sal('valor', 'cualquiera', '')], ayuda: 'El valor de una variable del Blueprint.' },
  var_fijar: { titulo: 'Fijar variable', cat: 'Variables', variable: true, exec: true, entradas: [EXEC_IN, ent('valor', 'cualquiera', 0, 'valor')], salidas: [EXEC_OUT], ayuda: 'Cambia el valor de una variable.' },
  var_sumar: { titulo: 'Sumar a variable', cat: 'Variables', variable: true, exec: true, entradas: [EXEC_IN, ent('cantidad', 'decimal', 1, 'cantidad')], salidas: [EXEC_OUT], ayuda: 'Suma una cantidad a una variable numérica.' },
  fn_llamar: { titulo: 'Llamar función', cat: 'Variables', funcion: true, exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], ayuda: 'Ejecuta una función del Blueprint.' },
  fn_devolver: { titulo: 'Devolver', cat: 'Variables', exec: true, entradas: [EXEC_IN, ent('valor', 'cualquiera', null, 'valor')], salidas: [], ayuda: 'Termina la función.' },
  ob_leer: { titulo: 'Leer propiedad', cat: 'Variables', entradas: [OBJETO, ent('miembro', 'texto', 'vida', 'propiedad')], salidas: [sal('valor', 'cualquiera', 'valor')], ayuda: 'Lee una propiedad del objeto o una variable de su Blueprint o script. Sirve también para Z, munición y estados 3D. El nombre de propiedad es constante.' },
  ob_fijar: { titulo: 'Cambiar propiedad', cat: 'Variables', exec: true, entradas: [EXEC_IN, OBJETO, ent('miembro', 'texto', 'visible', 'propiedad'), ent('valor', 'cualquiera', true, 'valor')], salidas: [EXEC_OUT], ayuda: 'Asigna una propiedad real del objeto, o una variable de su Blueprint. Sin objeto usa yo. No crea propiedades inexistentes.' },
  ob_consultar: { titulo: 'Consultar método', cat: 'Variables', entradas: [OBJETO, ent('miembro', 'texto', 'en_el_suelo', 'método'), ent('cantidad', 'opcion', '0', 'argumentos'), ...ARGUMENTOS], opciones: { cantidad: ['0', '1', '2', '3'] }, salidas: [sal('valor', 'cualquiera', 'resultado')], ayuda: 'Consulta un método del motor, por ejemplo ve_a(objetivo, alcance), o una función del script del objeto (devuelve un número). Elige cuántos argumentos necesita. Se evalúa al utilizar el dato; para acciones usa Ejecutar método.' },
  ob_llamar: { titulo: 'Ejecutar método', cat: 'Variables', exec: true, entradas: [EXEC_IN, OBJETO, ent('miembro', 'texto', 'saltar', 'método'), ent('cantidad', 'opcion', '1', 'argumentos'), ...ARGUMENTOS], opciones: { cantidad: ['0', '1', '2', '3'] }, salidas: [EXEC_OUT], ayuda: 'Ejecuta un método real del objeto o una función de su Blueprint, con hasta tres argumentos. Elige su cantidad exacta. Se compila a una llamada de Ara, sin código JavaScript embebido. En otro objeto, los argumentos de sus funciones tienen que ser números.' },

  // ---------- Escena ----------
  es_yo: { titulo: 'Yo', cat: 'Escena', compacto: true, salidas: [sal('yo', 'objeto', 'este nodo')], ayuda: 'El propio nodo que tiene este Blueprint.' },
  es_nodo: { titulo: 'Nodo por nombre', cat: 'Escena', entradas: [ent('nombre', 'texto', 'Jugador', 'nombre')], soloValor: true, salidas: [sal('nodo', 'objeto', 'nodo')], ayuda: 'Busca un nodo de la escena por su nombre.' },
  es_mostrar: { titulo: 'Mostrar', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('texto', 'cualquiera', '¡Hola!', 'texto')], salidas: [EXEC_OUT], ayuda: 'Escribe un mensaje en la Salida del editor.' },
  es_eliminar: { titulo: 'Eliminar', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('objeto', 'objeto', null, 'objeto')], salidas: [EXEC_OUT], ayuda: 'Quita un nodo del juego (si no conectas nada, este mismo).' },
  es_crear: { titulo: 'Crear copia', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('plantilla', 'texto', 'Moneda', 'de'), ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', 0, 'y')], salidas: [EXEC_OUT], ayuda: 'Crea una copia de un nodo o de una escena.' },
  es_ganar: { titulo: 'Ganar partida', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], ayuda: 'Termina el nivel con victoria.' },
  es_perder: { titulo: 'Perder partida', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], ayuda: 'Termina la partida con derrota.' },
  es_reiniciar: { titulo: 'Reiniciar nivel', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], ayuda: 'Vuelve a empezar la escena.' },
  es_puntos: { titulo: 'Ganar puntos', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('cantidad', 'entero', 10, 'cantidad')], salidas: [EXEC_OUT], ayuda: 'Suma puntos al marcador.' },
  es_emitir: { titulo: 'Emitir señal', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('senal', 'texto', 'abrir', 'señal')], salidas: [EXEC_OUT], ayuda: 'Avisa a todos los scripts que escuchen esta señal.' },
  es_escena: { titulo: 'Cambiar escena', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('escena', 'texto', 'nivel2', 'escena')], salidas: [EXEC_OUT], ayuda: 'Pasa a otra escena.' },
  es_temblar: { titulo: 'Temblar cámara', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('fuerza', 'decimal', 8, 'fuerza'), ent('segundos', 'decimal', 0.3, 'segundos')], salidas: [EXEC_OUT], ayuda: 'Hace temblar la cámara.' },

  // ---------- Texto ----------
  tx_texto: { titulo: 'Texto', cat: 'Texto', compacto: true, entradas: [ent('valor', 'texto', 'Hola', '')], soloValor: true, salidas: [sal('valor', 'texto', '')], ayuda: 'Un texto fijo.' },
  tx_unir: { titulo: 'Unir textos', cat: 'Texto', entradas: [ent('a', 'cualquiera', 'Monedas: ', 'a'), ent('b', 'cualquiera', '', 'b')], salidas: [sal('resultado', 'texto', 'a + b')], ayuda: 'Junta dos textos (los números se convierten solos).' },
  tx_fijar: { titulo: 'Cambiar texto', cat: 'Texto', exec: true, entradas: [EXEC_IN, ent('nodo', 'texto', 'Marcador', 'etiqueta'), ent('texto', 'cualquiera', '', 'texto')], salidas: [EXEC_OUT], ayuda: 'Cambia lo que pone una Etiqueta de la interfaz.' },

  // ---------- Audio ----------
  au_sonar: { titulo: 'Reproducir sonido', cat: 'Audio', exec: true, entradas: [EXEC_IN, ent('sonido', 'texto', 'salto.wav', 'sonido'), ent('volumen', 'decimal', 1, 'volumen')], salidas: [EXEC_OUT], ayuda: 'Hace sonar un efecto del proyecto.' },
  au_musica: { titulo: 'Poner música', cat: 'Audio', exec: true, entradas: [EXEC_IN, ent('musica', 'texto', 'tema.ogg', 'música')], salidas: [EXEC_OUT], ayuda: 'Pone música de fondo en bucle.' },
  au_parar: { titulo: 'Parar música', cat: 'Audio', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], ayuda: 'Detiene la música.' },
};

for (const [k, d] of Object.entries(NODOS)) {
  d.id = k;
  d.entradas ||= [];
  d.salidas ||= [];
  d.esEvento = !!d.evento || k === 'fn_entrada';
}

export function definicion(id) { return NODOS[id]; }

/** Pines de un nodo concreto (los de variable/función dependen del Blueprint). */
export function pinesDe(nodo, bp) {
  const d = NODOS[nodo.def];
  if (!d) return { entradas: [], salidas: [] };
  let entradas = d.entradas, salidas = d.salidas;
  if (nodo.def === 'ob_llamar' || nodo.def === 'ob_consultar') {
    const cantidad = Number(nodo.valores?.cantidad ?? d.entradas.find(p => p.n === 'cantidad').def);
    entradas = entradas.filter(p => !['a', 'b', 'c'].includes(p.n) || ['a', 'b', 'c'].indexOf(p.n) < cantidad);
  }
  if (nodo.def === 'var_obtener' || nodo.def === 'var_fijar' || nodo.def === 'var_sumar') {
    const v = (bp.variables || []).find(x => x.nombre === nodo.variable);
    const t = v ? v.tipo : 'cualquiera';
    if (nodo.def === 'var_obtener') salidas = [sal('valor', t, '')];
    if (nodo.def === 'var_fijar') entradas = [EXEC_IN, ent('valor', t, v ? v.valor : 0, 'valor')];
  }
  if (nodo.def === 'fn_llamar') {
    const f = (bp.funciones || []).find(x => x.nombre === nodo.funcion);
    entradas = [EXEC_IN, ...((f && f.params) || []).map(p => ent(p.nombre, p.tipo || 'cualquiera', 0, p.nombre))];
  }
  if (nodo.def === 'fn_entrada') {
    const f = (bp.funciones || []).find(x => x.nombre === nodo.funcion);
    salidas = [EXEC_OUT, ...((f && f.params) || []).map(p => sal(p.nombre, p.tipo || 'cualquiera', p.nombre))];
  }
  return { entradas, salidas };
}

export function tituloNodo(nodo) {
  const d = NODOS[nodo.def];
  if (!d) return nodo.def;
  if (nodo.def === 'var_obtener') return nodo.variable || 'variable';
  if (nodo.def === 'var_fijar') return `Fijar ${nodo.variable || 'variable'}`;
  if (nodo.def === 'var_sumar') return `Sumar a ${nodo.variable || 'variable'}`;
  if (nodo.def === 'fn_llamar') return nodo.funcion || 'Llamar función';
  if (nodo.def === 'fn_entrada') return nodo.funcion || 'Función';
  return d.titulo;
}

// Comprueba si se pueden conectar dos tipos de pin.
export function compatibles(tSalida, tEntrada) {
  if (tSalida === 'exec' || tEntrada === 'exec') return tSalida === tEntrada;
  if (tSalida === tEntrada) return true;
  if (tEntrada === 'cualquiera' || tSalida === 'cualquiera') return true;
  const num = (t) => t === 'decimal' || t === 'entero';
  if (num(tSalida) && num(tEntrada)) return true;
  if (tEntrada === 'texto') return true; // todo se puede escribir como texto
  if (tEntrada === 'bool') return true;  // cualquier valor sirve como condición
  return false;
}

export function blueprintVacio(nombre, base = 'Personaje2D') {
  return {
    formato: 'falcon-blueprint', version: 1, nombre, base,
    variables: [], funciones: [],
    grafos: { eventos: { nodos: [], conexiones: [], comentarios: [] } },
  };
}

let sec = 0;
export function idNodoBp() { sec = (sec + 1) % 1e6; return 'b' + Date.now().toString(36) + sec.toString(36); }

// ---------- Nombres del código generado ----------
// El compilador Blueprint → Ara está escrito en Ara: src/motor/blueprints-ara.js (`compilarBlueprint`).

/** La clase de Ara de un Blueprint: «blueprints/jugador.bp» → «JugadorBp». */
export function claseBlueprint(rel) {
  const base = String(rel || 'blueprint').replace(/\\/g, '/').replace(/^blueprints\//, '').replace(/\.bp$/i, '');
  const c = base.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return (/^\p{L}/u.test(c) ? c : 'B' + c) + 'Bp';
}

/** Dónde se guarda el Ara de un Blueprint: «blueprints/jugador.bp» → «generado/blueprints/jugador.ara». */
export function generadoDe(rel) {
  return 'generado/' + String(rel).replace(/\\/g, '/').replace(/\.bp$/i, '') + '.ara';
}

// Cuenta los nodos de todos los grafos (para «6 nodos»).
export function contarNodos(bp) {
  return Object.values(bp.grafos || {}).reduce((s, g) => s + (g.nodos || []).length, 0);
}

