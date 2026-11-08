// Blueprints: lógica con bloques que se compila a Ara (ver compilarBlueprint, al final).
import { API_MOTOR } from '../ara/api-motor.js';
import { miembroDe } from '../ara/api.js';

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

// Precedencias para poner paréntesis solo donde hace falta.
const P = { atomo: 10, pot: 8, mul: 6, suma: 5, comp: 4, no: 3, y: 2, o: 1 };


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

// ---------- Compilador Blueprint → Ara ----------
//
// Cada Blueprint es una clase de Ara (`clase JugadorBp extiende Personaje2D:`) en `generado/<ruta>.ara`. Ara tiene
// tipos estáticos, así que el compilador sabe de qué tipo es cada cable: lo que sale de cada bloque, las variables,
// los parámetros y la API del motor (motor.ara, en API_MOTOR). Donde un dato no encaja con lo que pide la entrada,
// añade la conversión que haría Águila (`texto(x)`, `x != 0`…) o da un error en ese bloque.

const PALABRAS_ARA = new Set(['importar', 'const', 'global', 'func', 'estructura', 'enumeracion', 'externa', 'clase', 'extiende', 'cuando', 'exportar', 'segun', 'caso', 'devolver', 'si', 'sino', 'mientras', 'para', 'en', 'romper', 'continuar', 'pasar', 'verdadero', 'falso', 'y', 'o', 'no', 'yo', 'este']);
const TIPO_ARA = { bool: 'booleano', decimal: 'decimal', entero: 'entero', texto: 'texto', objeto: 'Nodo', lista: 'lista[Nodo]' };
const NUMEROS = new Set(['decimal', 'entero']);
const NOMBRE_TIPO = { decimal: 'un número', entero: 'un número entero', texto: 'un texto', booleano: 'un sí / no', Nodo: 'un objeto', 'lista[Nodo]': 'una lista', nada: 'nada' };

/** Un texto de Ara entre comillas: escapa lo necesario y duplica las llaves (los textos de Ara interpolan). */
export function textoAra(s) {
  const esc = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\t': '\\t', '\r': '\\r', '{': '{{', '}': '}}' };
  return '"' + String(s ?? '').replace(/[\\"\n\t\r{}]/g, (c) => esc[c]).replace(/[\x00-\x1f]/g, '') + '"';
}

/** Un número de Ara: `220.0` si es decimal, `3` si es entero. */
function numeroAra(v, tipo) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = 0;
  if (tipo === 'entero') return String(Math.trunc(n));
  let s = String(n);
  if (/e/i.test(s)) s = n.toFixed(12).replace(/0+$/, '');
  if (!s.includes('.')) s += '.0';
  return s.endsWith('.') ? s + '0' : s;
}

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

const nombreValido = (n) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(String(n || '')) && !PALABRAS_ARA.has(n);

/**
 * Compila un Blueprint a Ara.
 * @param {object} bp  El Blueprint.
 * @param {string} archivo  Su ruta en el proyecto (da el nombre de la clase, ver `claseBlueprint`).
 * @returns {{ codigo: string, clase: string, errores: Array<{mensaje, nodo}>, avisos: Array<{mensaje, nodo}>, lineas: Object<string, number> }}
 *   `lineas` da la línea del código de cada bloque.
 */
export function compilarBlueprint(bp, archivo = 'blueprint.bp') {
  const api = API_MOTOR;
  const clase = claseBlueprint(archivo);
  const grafos = bp.grafos || {};
  const variables = new Map();   // nombre → tipo de Ara
  const funciones = new Map();   // nombre → { params: [{nombre, tipo}], retorno }
  const errores = [], avisos = [];
  const base = bp.base && bp.base in api.tipos ? bp.base : 'Nodo';
  const esIdentificador = (n) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(String(n || ''));
  for (const g of Object.values(grafos)) for (const n of g.nodos || []) {
    if (!n.def || !n.def.startsWith('ob_')) continue;
    const miembro = n.valores?.miembro ?? NODOS[n.def]?.entradas.find((p) => p.n === 'miembro')?.def;
    if (!esIdentificador(miembro)) errores.push({ mensaje: 'Escribe un nombre de propiedad o método válido, sin puntos ni paréntesis.', nodo: n.id });
    if ((g.conexiones || []).some((c) => c.a === n.id && c.entrada === 'miembro')) errores.push({ mensaje: 'El nombre de miembro debe ser constante. Escribe el nombre en el bloque.', nodo: n.id });
  }
  if (bp.base && !(bp.base in api.tipos)) errores.push({ mensaje: `«${bp.base}» no es un tipo de nodo.`, nodo: null });

  const tipoDeValor = (v) => typeof v === 'boolean' ? 'booleano' : typeof v === 'number' ? 'decimal' : 'texto';
  for (const v of bp.variables || []) {
    if (!nombreValido(v.nombre)) {
      errores.push({ mensaje: PALABRAS_ARA.has(v.nombre) ? `La variable «${v.nombre}» no puede llamarse así: es una palabra de Ara. Cámbiale el nombre.` : `«${v.nombre}» no es un nombre válido para una variable.`, nodo: null });
      continue;
    }
    variables.set(v.nombre, TIPO_ARA[v.tipo] || tipoDeValor(v.valor));
  }

  // Los tipos de los parámetros «cualquiera» salen de las llamadas (el primer valor que les llega); si no, decimal.
  const tipoLiteral = (v) => typeof v === 'boolean' ? 'booleano' : typeof v === 'string' && !/^-?\d+(\.\d+)?$/.test(v.trim()) ? 'texto' : 'decimal';
  const tipoSalidaSimple = (grafo, id, pin) => {
    const n = (grafo.nodos || []).find((x) => x.id === id);
    if (!n) return null;
    if (n.def === 'var_obtener') return variables.get(n.variable) || null;
    const p = pinesDe(n, bp).salidas.find((x) => x.n === pin);
    return p && TIPO_ARA[p.t] || null;
  };
  for (const f of bp.funciones || []) {
    if (!nombreValido(f.nombre)) { errores.push({ mensaje: `«${f.nombre}» no es un nombre válido para una función.`, nodo: null }); continue; }
    const params = (f.params || []).map((p, i) => {
      let tipo = TIPO_ARA[p.tipo] || null;
      for (const g of Object.values(grafos)) {
        for (const n of g.nodos || []) {
          if (tipo) break;
          const llamada = n.def === 'fn_llamar' && n.funcion === f.nombre ? p.nombre : (n.def === 'ob_llamar' || n.def === 'ob_consultar') && n.valores?.miembro === f.nombre ? ['a', 'b', 'c'][i] : null;
          if (!llamada) continue;
          const con = (g.conexiones || []).find((c) => c.a === n.id && c.entrada === llamada);
          if (con) tipo = tipoSalidaSimple(g, con.de, con.salida);
          else if (n.valores && llamada in n.valores) tipo = tipoLiteral(n.valores[llamada]);
        }
      }
      if (!nombreValido(p.nombre)) errores.push({ mensaje: `«${p.nombre}» no es un nombre válido para un parámetro de «${f.nombre}».`, nodo: null });
      return { nombre: p.nombre, tipo: tipo || 'decimal' };
    });
    funciones.set(f.nombre, { params, retorno: 'nada' });
  }

  let salida, lineas, erroresGen;
  const L = (texto, nivel, idNodo) => {
    salida.push('    '.repeat(nivel) + texto);
    if (idNodo && !(idNodo in lineas)) lineas[idNodo] = salida.length;
  };
  const error = (mensaje, nodo) => { if (!erroresGen.some((e) => e.mensaje === mensaje && e.nodo === nodo)) erroresGen.push({ mensaje, nodo }); };

  // Valor de un tipo para que el código siga siendo válido tras un error.
  const porDefecto = (t) => ({ decimal: '0.0', entero: '0', texto: '""', booleano: 'falso', Nodo: 'nodo("")' }[t] || '0.0');
  const R = (codigo, tipo, prec = P.atomo) => ({ codigo, tipo, prec });
  const par = (r, prec) => r.prec < prec ? `(${r.codigo})` : r.codigo;

  /** Convierte un dato al tipo que pide una entrada (null: cualquiera). */
  function conv(r, destino, idNodo, que) {
    if (!destino || !r.tipo || r.tipo === destino) return r;
    if (destino === 'decimal' && r.tipo === 'entero') return { ...r, tipo: 'decimal' };
    if (destino === 'entero' && r.tipo === 'decimal') return R(`entero(${r.codigo})`, 'entero');
    if (destino === 'texto') return r.tipo === 'Nodo' ? R(`${par(r, P.atomo)}.nombre`, 'texto') : R(`texto(${r.codigo})`, 'texto');
    if (destino === 'booleano') {
      if (NUMEROS.has(r.tipo)) return R(`${par(r, P.comp + 1)} != 0`, 'booleano', P.comp);
      if (r.tipo === 'texto') return R(`${par(r, P.comp + 1)} != ""`, 'booleano', P.comp);
      if (r.tipo === 'Nodo') return R(`${par(r, P.atomo)}.existe()`, 'booleano');
      if (r.tipo.startsWith('lista')) return R(`largo(${r.codigo}) > 0`, 'booleano', P.comp);
    }
    error(`${que ? `«${que}» necesita` : 'Aquí hace falta'} ${NOMBRE_TIPO[destino] || destino}, pero llega ${NOMBRE_TIPO[r.tipo] || r.tipo}.`, idNodo);
    return R(porDefecto(destino), destino);
  }

  const compilarGrafo = (grafo, funcion) => {
    const nodos = new Map((grafo.nodos || []).map((n) => [n.id, n]));
    const porEntrada = new Map(); // "idNodo:pin" → conexión que llega
    const porSalida = new Map();  // "idNodo:pin" → conexiones que salen
    for (const c of grafo.conexiones || []) {
      if (!nodos.has(c.de) || !nodos.has(c.a)) continue;
      porEntrada.set(c.a + ':' + c.entrada, c);
      const k = c.de + ':' + c.salida;
      if (!porSalida.has(k)) porSalida.set(k, []);
      porSalida.get(k).push(c);
    }
    const usados = new Set();
    const locales = new Map(); // nombre → tipo: datos del evento, parámetros y variables de los bucles
    let contadorBucle = 0;
    const fn = funcion ? funciones.get(funcion) : null;

    // Lo del nodo sin `yo.` delante, salvo que una variable, función o dato del Blueprint se llame igual.
    const ocupado = (n) => variables.has(n) || funciones.has(n) || locales.has(n) || PALABRAS_ARA.has(n);
    const enYo = (nombre, objeto) => objeto.codigo === 'yo' && !ocupado(nombre) ? nombre : `${par(objeto, P.atomo)}.${nombre}`;

    const ctx = (nodo, pila) => {
      const { entradas } = pinesDe(nodo, bp);
      const c = {
        nodo,
        conectado: (pin) => porEntrada.has(nodo.id + ':' + pin),
        valor: (pin) => {
          if (nodo.valores && pin in nodo.valores) return nodo.valores[pin];
          const p = entradas.find((x) => x.n === pin);
          return p ? p.def : null;
        },
        /** El dato de una entrada, convertido a `destino` (por defecto, el tipo de la entrada). */
        e: (pin, destino) => {
          const p = entradas.find((x) => x.n === pin);
          const tipo = destino !== undefined ? destino : p ? TIPO_ARA[p.t] || null : null;
          const con = porEntrada.get(nodo.id + ':' + pin);
          let r;
          if (con) r = expr(con.de, con.salida, pila, tipo);
          else {
            const v = c.valor(pin);
            if (p && p.t === 'objeto') r = R('yo', 'Nodo');
            else if (tipo === 'texto') r = R(textoAra(v), 'texto');
            else if (tipo === 'booleano') r = R(v ? 'verdadero' : 'falso', 'booleano');
            else if (NUMEROS.has(tipo)) r = R(numeroAra(v, tipo), tipo, Number(v) < 0 ? P.no : P.atomo);
            else if (typeof v === 'boolean') r = R(v ? 'verdadero' : 'falso', 'booleano');
            else if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()))) r = R(numeroAra(v, 'decimal'), 'decimal', Number(v) < 0 ? P.no : P.atomo);
            else if (v === null || v === undefined) r = tipo ? R(porDefecto(tipo), tipo) : R('""', 'texto');
            else r = R(textoAra(v), 'texto');
          }
          return conv(r, tipo, nodo.id, p && p.etq);
        },
        objeto: () => c.conectado('objeto') ? c.e('objeto', 'Nodo') : R('yo', 'Nodo'),
        args: () => ['a', 'b', 'c'].slice(0, Math.max(0, Math.min(3, Number(c.valor('cantidad')) || 0))),
      };
      return c;
    };

    /** Llamar a un método: del motor, una función de este Blueprint o (en otro nodo) una función de su script. */
    function metodo(c, objeto, nombre, pins, conValor) {
      const id = c.nodo.id;
      if (!esIdentificador(nombre)) return R(conValor ? '0.0' : 'pasar', conValor ? 'decimal' : 'nada'); // ya avisado
      if (objeto.codigo === 'yo' && funciones.has(nombre)) {
        const f = funciones.get(nombre);
        if (pins.length !== f.params.length) error(`La función «${nombre}» recibe ${f.params.length} dato(s), no ${pins.length}.`, id);
        const args = f.params.map((p, i) => i < pins.length ? c.e(pins[i], p.tipo).codigo : porDefecto(p.tipo));
        return R(`${nombre}(${args.join(', ')})`, f.retorno);
      }
      const m = miembroDe(api, objeto.codigo === 'yo' ? base : 'Nodo', nombre);
      if (m && m.firmas) {
        const firma = m.firmas.find((f) => f.params.length === pins.length);
        if (!firma) {
          error(`«${nombre}» recibe ${[...new Set(m.firmas.map((f) => f.params.length))].join(' o ')} dato(s), no ${pins.length}.`, id);
          return R(porDefecto(m.firmas[0].retorno), m.firmas[0].retorno);
        }
        const args = firma.params.map((p, i) => c.e(pins[i], p.tipo).codigo);
        return R(`${enYo(nombre, objeto)}(${args.join(', ')})`, firma.retorno);
      }
      if (m && m.propiedad) {
        error(`«${nombre}» es una propiedad, no un método: usa «Leer propiedad» o «Cambiar propiedad».`, id);
        return R(porDefecto(m.propiedad), m.propiedad);
      }
      if (objeto.codigo === 'yo') {
        error(`Este nodo no tiene ningún método ni función «${nombre}».`, id);
        return R('0.0', 'decimal');
      }
      // Una función del script de otro nodo: solo con números (Ara necesita saber los tipos al compilar).
      const args = pins.map((p) => {
        const r = c.e(p, null);
        return NUMEROS.has(r.tipo) || r.tipo === 'booleano' ? conv(r, 'decimal', id).codigo : (error(`Para llamar a «${nombre}» de otro nodo, los datos tienen que ser números.`, id), '0.0');
      });
      return R(`${par(objeto, P.atomo)}.${conValor ? 'consultar' : 'llamar'}(${[textoAra(nombre), ...args].join(', ')})`, conValor ? 'decimal' : 'nada');
    }

    /** Leer una propiedad del nodo o una variable de su Blueprint o script. */
    function leer(c, objeto, nombre, esperado) {
      if (!esIdentificador(nombre)) return R(porDefecto(esperado), esperado || 'decimal'); // ya avisado
      if (objeto.codigo === 'yo' && variables.has(nombre)) return R(nombre, variables.get(nombre));
      const m = miembroDe(api, base, nombre);
      if (m && m.propiedad) return R(objeto.codigo === 'yo' ? `yo.${nombre}` : `${par(objeto, P.atomo)}.${nombre}`, m.propiedad);
      if (objeto.codigo === 'yo') {
        error(`Este nodo no tiene la propiedad ni la variable «${nombre}».`, c.nodo.id);
        return R(porDefecto(esperado), esperado || 'decimal');
      }
      const que = esperado === 'texto' ? 'texto' : esperado === 'booleano' ? 'booleano' : esperado === 'Nodo' ? 'nodo' : 'numero';
      const tipo = { texto: 'texto', booleano: 'booleano', nodo: 'Nodo', numero: 'decimal' }[que];
      return R(`${par(objeto, P.atomo)}.leer_${que}(${textoAra(nombre)})`, tipo);
    }

    /** Cambiar una propiedad del nodo o una variable de su Blueprint o script. */
    function fijar(c, objeto, nombre) {
      if (!esIdentificador(nombre)) return 'pasar'; // ya avisado
      if (objeto.codigo === 'yo' && variables.has(nombre)) return `${nombre} = ${c.e('valor', variables.get(nombre)).codigo}`;
      const m = miembroDe(api, base, nombre);
      if (m && m.propiedad) return `${objeto.codigo === 'yo' ? 'yo' : par(objeto, P.atomo)}.${nombre} = ${c.e('valor', m.propiedad).codigo}`;
      if (objeto.codigo === 'yo') {
        error(`Este nodo no tiene la propiedad ni la variable «${nombre}».`, c.nodo.id);
        return 'pasar';
      }
      const r = c.e('valor', null);
      const que = NUMEROS.has(r.tipo) ? 'numero' : r.tipo === 'booleano' ? 'booleano' : r.tipo === 'Nodo' ? 'nodo' : 'texto';
      return `${par(objeto, P.atomo)}.cambiar_${que}(${textoAra(nombre)}, ${conv(r, { numero: 'decimal', booleano: 'booleano', nodo: 'Nodo', texto: 'texto' }[que], c.nodo.id).codigo})`;
    }

    // Lo que da cada bloque de datos (pin: la salida que se usa; esperado: el tipo que se quiere, si se sabe).
    const DATOS = {
      in_pulsada: (c) => R(`se_pulsa(${c.e('accion').codigo})`, 'booleano'),
      in_mantenida: (c) => R(`se_mantiene(${c.e('accion').codigo})`, 'booleano'),
      in_eje: (c) => R(`eje(${c.e('negativa').codigo}, ${c.e('positiva').codigo})`, 'decimal'),
      in_raton: (c, pin) => R(pin === 'y' ? 'raton_y()' : 'raton_x()', 'decimal'),
      in_clic: () => R('raton_pulsado()', 'booleano'),
      mv_suelo: (c) => metodo(c, R('yo', 'Nodo'), 'en_el_suelo', [], true),
      mv_posicion: (c, pin) => leer(c, c.objeto(), pin === 'y' ? 'y' : 'x'),
      lg_y: (c) => R(`${par(c.e('a'), P.y)} y ${par(c.e('b'), P.y + 1)}`, 'booleano', P.y),
      lg_o: (c) => R(`${par(c.e('a'), P.o)} o ${par(c.e('b'), P.o + 1)}`, 'booleano', P.o),
      lg_no: (c) => R(`no ${par(c.e('valor'), P.no)}`, 'booleano', P.no),
      lg_comparar: (c) => {
        const op = ['==', '!=', '<', '>', '<=', '>='].includes(c.valor('op')) ? c.valor('op') : '==';
        let a = c.e('a', null), b = c.e('b', null);
        const igualdad = op === '==' || op === '!=';
        if (igualdad && (a.tipo === 'texto' || b.tipo === 'texto')) { a = conv(a, 'texto', c.nodo.id); b = conv(b, 'texto', c.nodo.id); }
        else if (!(igualdad && a.tipo === b.tipo && ['booleano', 'Nodo'].includes(a.tipo))) { a = conv(a, 'decimal', c.nodo.id, 'a'); b = conv(b, 'decimal', c.nodo.id, 'b'); }
        return R(`${par(a, P.comp + 1)} ${op} ${par(b, P.comp + 1)}`, 'booleano', P.comp);
      },
      lg_es: (c) => R(`${par(c.e('objeto', 'Nodo'), P.atomo)}.es(${c.e('nombre').codigo})`, 'booleano'),
      mt_numero: (c) => c.e('valor'),
      mt_sumar: (c) => aritmetica(c, '+', P.suma),
      mt_restar: (c) => aritmetica(c, '-', P.suma),
      mt_multiplicar: (c) => aritmetica(c, '*', P.mul),
      mt_dividir: (c) => aritmetica(c, '/', P.mul),
      mt_aleatorio: (c) => {
        const min = c.e('min'), max = c.e('max');
        return R(`${par(min, P.suma)} + aleatorio() * (${max.codigo} - ${par(min, P.suma + 1)})`, 'decimal', P.suma);
      },
      mt_limitar: (c) => R(`limitar(${c.e('valor').codigo}, ${c.e('min').codigo}, ${c.e('max').codigo})`, 'decimal'),
      mt_distancia: (c) => R(`distancia(${c.e('a', 'Nodo').codigo}, ${c.e('b', 'Nodo').codigo})`, 'decimal'),
      var_obtener: (c) => {
        const v = c.nodo.variable;
        if (!variables.has(v)) { error(v ? `La variable «${v}» no existe.` : 'Elige una variable.', c.nodo.id); return R('0.0', 'decimal'); }
        return R(v, variables.get(v));
      },
      ob_leer: (c, pin, esperado) => leer(c, c.objeto(), c.valor('miembro'), esperado),
      ob_consultar: (c) => metodo(c, c.objeto(), c.valor('miembro'), c.args(), true),
      es_yo: () => R('yo', 'Nodo'),
      es_nodo: (c) => R(`nodo(${c.e('nombre').codigo})`, 'Nodo'),
      tx_texto: (c) => c.e('valor'),
      tx_unir: (c) => R(`${par(c.e('a', 'texto'), P.suma)} + ${par(c.e('b', 'texto'), P.suma + 1)}`, 'texto', P.suma),
    };

    function aritmetica(c, op, prec) {
      let a = c.e('a', null), b = c.e('b', null);
      // Entero con entero sigue siendo entero (salvo al dividir); con un decimal, decimal.
      const tipo = a.tipo === 'entero' && b.tipo === 'entero' && op !== '/' ? 'entero' : 'decimal';
      a = conv(a, tipo, c.nodo.id, 'a'); b = conv(b, tipo, c.nodo.id, 'b');
      return R(`${par(a, prec)} ${op} ${par(b, prec + (op === '-' || op === '/' ? 1 : 0))}`, tipo, prec);
    }

    // Lo que hace cada bloque de acción: una línea de Ara.
    const ACCIONES = {
      mv_mover: (c) => (c.conectado('y') || (c.valor('y') !== null && c.valor('y') !== undefined && c.valor('y') !== '') ? metodo(c, R('yo', 'Nodo'), 'mover', ['x', 'y']) : metodo(c, R('yo', 'Nodo'), 'mover', ['x'])).codigo,
      mv_saltar: (c) => metodo(c, R('yo', 'Nodo'), 'saltar', ['fuerza']).codigo,
      mv_fijar: (c) => metodo(c, R('yo', 'Nodo'), 'mover_a', ['x', 'y']).codigo,
      mv_desplazar: (c) => metodo(c, R('yo', 'Nodo'), 'desplazar', ['x', 'y']).codigo,
      mv_empujar: (c) => metodo(c, R('yo', 'Nodo'), 'empujar', ['x', 'y']).codigo,
      lg_esperar: (c) => `esperar(${c.e('segundos').codigo})`,
      var_fijar: (c) => {
        const v = c.nodo.variable;
        if (!variables.has(v)) { error(v ? `La variable «${v}» no existe.` : 'Elige una variable.', c.nodo.id); return 'pasar'; }
        return `${v} = ${c.e('valor', variables.get(v)).codigo}`;
      },
      var_sumar: (c) => {
        const v = c.nodo.variable;
        if (!variables.has(v)) { error(v ? `La variable «${v}» no existe.` : 'Elige una variable.', c.nodo.id); return 'pasar'; }
        const t = variables.get(v);
        if (!NUMEROS.has(t)) { error(`«${v}» no es un número: no se le puede sumar.`, c.nodo.id); return 'pasar'; }
        return `${v} += ${c.e('cantidad', t).codigo}`;
      },
      fn_llamar: (c) => {
        const f = funciones.get(c.nodo.funcion);
        if (!f) { error(c.nodo.funcion ? `La función «${c.nodo.funcion}» no existe.` : 'Elige una función.', c.nodo.id); return 'pasar'; }
        return `${c.nodo.funcion}(${f.params.map((p) => c.e(p.nombre, p.tipo).codigo).join(', ')})`;
      },
      fn_devolver: (c) => {
        if (!fn) {
          if (c.conectado('valor')) error('En un evento, «Devolver» no lleva valor: solo termina el evento.', c.nodo.id);
          return 'devolver';
        }
        if (!c.conectado('valor')) return 'devolver';
        const r = c.e('valor', fn.retorno === 'nada' ? null : fn.retorno);
        if (fn.retorno === 'nada') fn.retornoVisto ||= r.tipo;
        return `devolver ${r.codigo}`;
      },
      ob_fijar: (c) => fijar(c, c.objeto(), c.valor('miembro')),
      ob_llamar: (c) => metodo(c, c.objeto(), c.valor('miembro'), c.args(), false).codigo,
      es_mostrar: (c) => {
        const r = c.e('texto', null);
        return `imprimir(${(r.tipo === 'Nodo' || r.tipo?.startsWith('lista') ? conv(r, 'texto', c.nodo.id) : r).codigo})`;
      },
      es_eliminar: (c) => c.conectado('objeto') ? `${par(c.e('objeto', 'Nodo'), P.atomo)}.eliminar()` : `${enYo('eliminar', R('yo', 'Nodo'))}()`,
      es_crear: (c) => `crear(${c.e('plantilla').codigo}, ${c.e('x').codigo}, ${c.e('y').codigo})`,
      es_ganar: () => 'ganar_partida()',
      es_perder: () => 'perder_partida()',
      es_reiniciar: () => 'reiniciar_nivel()',
      es_puntos: (c) => `ganar_puntos(${c.e('cantidad').codigo})`,
      es_emitir: (c) => `emitir(${c.e('senal').codigo})`,
      es_escena: (c) => `cambiar_escena(${c.e('escena').codigo})`,
      es_temblar: (c) => `temblar_camara(${c.e('fuerza').codigo}, ${c.e('segundos').codigo})`,
      tx_fijar: (c) => `nodo(${c.e('nodo').codigo}).texto = ${c.e('texto', 'texto').codigo}`,
      au_sonar: (c) => `sonar(${c.e('sonido').codigo}, ${c.e('volumen').codigo})`,
      au_musica: (c) => `musica(${c.e('musica').codigo})`,
      au_parar: () => 'parar_musica()',
    };

    function expr(idNodo, pin, pila, esperado) {
      const nodo = nodos.get(idNodo);
      usados.add(idNodo);
      const d = NODOS[nodo.def];
      if (pila.has(idNodo)) {
        error(`El bloque «${tituloNodo(nodo)}» está conectado en círculo consigo mismo.`, idNodo);
        return R(porDefecto(esperado), esperado || 'decimal');
      }
      // Datos de los eventos, de la entrada de la función y del índice de los bucles: variables locales.
      if (d && (d.esEvento || nodo.def === 'lg_repetir') && pin !== 'salida') {
        const local = nodo.def === 'lg_repetir' ? nodo._varBucle : pin;
        if (local && locales.has(local)) return R(local, locales.get(local));
        error(`El dato «${pin}» de «${tituloNodo(nodo)}» solo se puede usar dentro de su ${nodo.def === 'lg_repetir' ? 'bucle' : d.esEvento ? 'evento' : 'bloque'}.`, idNodo);
        return R(porDefecto(esperado), esperado || 'decimal');
      }
      const gen = d && DATOS[nodo.def];
      if (!gen) {
        error(`El bloque «${tituloNodo(nodo)}» no da un valor.`, idNodo);
        return R(porDefecto(esperado), esperado || 'decimal');
      }
      const p2 = new Set(pila); p2.add(idNodo);
      return gen(ctx(nodo, p2), pin, esperado);
    }

    const siguiente = (idNodo, pin) => { const cs = porSalida.get(idNodo + ':' + pin) || []; return cs.length ? cs[0].a : null; };

    function cadena(idNodo, nivel, visitados) {
      let n = 0;
      while (idNodo) {
        if (visitados.has(idNodo)) { error('Hay un círculo en las flechas de ejecución.', idNodo); return n; }
        visitados.add(idNodo);
        usados.add(idNodo);
        const nodo = nodos.get(idNodo);
        const c = ctx(nodo, new Set([idNodo]));
        n++;
        if (nodo.def === 'lg_si') {
          L(`si ${c.e('condicion').codigo}:`, nivel, idNodo);
          const v = siguiente(idNodo, 'verdadero');
          if (!v || !cadena(v, nivel + 1, new Set(visitados))) L('pasar', nivel + 1);
          const f = siguiente(idNodo, 'falso');
          if (f) { L('sino:', nivel); cadena(f, nivel + 1, new Set(visitados)); }
          return n;
        }
        if (nodo.def === 'lg_secuencia') {
          const a = siguiente(idNodo, 'primero'), b = siguiente(idNodo, 'despues');
          let hecho = 0;
          if (a) hecho += cadena(a, nivel, new Set(visitados));
          if (b) hecho += cadena(b, nivel, new Set(visitados));
          if (!hecho) L('pasar', nivel, idNodo);
          return n;
        }
        if (nodo.def === 'lg_repetir') {
          nodo._varBucle = `vuelta${contadorBucle ? contadorBucle + 1 : ''}`;
          contadorBucle++;
          L(`para ${nodo._varBucle} en rango(${c.e('veces').codigo}):`, nivel, idNodo);
          const anterior = locales.get(nodo._varBucle);
          locales.set(nodo._varBucle, 'entero');
          const cu = siguiente(idNodo, 'cuerpo');
          if (!cu || !cadena(cu, nivel + 1, new Set(visitados))) L('pasar', nivel + 1);
          if (anterior) locales.set(nodo._varBucle, anterior); else locales.delete(nodo._varBucle);
          idNodo = siguiente(idNodo, 'salida');
          continue;
        }
        if (nodo.def === 'lg_mientras') {
          L(`mientras ${c.e('condicion').codigo}:`, nivel, idNodo);
          const cu = siguiente(idNodo, 'cuerpo');
          if (!cu || !cadena(cu, nivel + 1, new Set(visitados))) L('pasar', nivel + 1);
          idNodo = siguiente(idNodo, 'salida');
          continue;
        }
        const accion = ACCIONES[nodo.def];
        if (!accion) {
          error(`El bloque «${tituloNodo(nodo)}» no es una acción y no se puede encadenar con flechas.`, idNodo);
          return n;
        }
        L(accion(c), nivel, idNodo);
        if (nodo.def === 'fn_devolver') return n;
        idNodo = siguiente(idNodo, 'salida');
      }
      return n;
    }

    const eventos = [...nodos.values()].filter((n) => NODOS[n.def] && NODOS[n.def].esEvento).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    for (const ev of eventos) {
      const d = NODOS[ev.def];
      usados.add(ev.id);
      locales.clear();
      let cabecera;
      if (funcion) {
        if (ev.def !== 'fn_entrada' || ev.funcion !== funcion) continue;
        for (const p of fn.params) locales.set(p.nombre, p.tipo);
        const firma = `${funcion}(${fn.params.map((p) => `${p.nombre}: ${p.tipo}`).join(', ')})`;
        cabecera = `func ${firma}${fn.retorno !== 'nada' ? ' -> ' + fn.retorno : ''}:`;
      } else {
        if (ev.def === 'fn_entrada') continue;
        const datos = api.eventos[d.evento] || [];
        const nombres = d.filtro ? ['', ...(d.params || [])] : (d.params || []);
        nombres.forEach((n, i) => { if (n && datos[i]) locales.set(n, datos[i].tipo); });
        let args = (d.params || []).join(', ');
        if (d.filtro) {
          const v = (ev.valores && ev.valores[d.filtro]) ?? d.entradas.find((p) => p.n === d.filtro).def;
          args = [textoAra(String(v)), ...(d.params || [])].join(', ');
        }
        cabecera = `cuando ${d.evento}(${args}):`;
      }
      salida.push('');
      L(cabecera, 1, ev.id);
      const primero = siguiente(ev.id, 'salida');
      const n = primero ? cadena(primero, 2, new Set()) : 0;
      if (!n) {
        L('pasar', 2);
        avisos.push({ mensaje: `«${tituloNodo(ev)}» no tiene nada conectado todavía.`, nodo: ev.id });
      }
    }
    if (funcion && !eventos.some((e) => e.def === 'fn_entrada' && e.funcion === funcion)) {
      salida.push('', `    func ${funcion}(${fn.params.map((p) => `${p.nombre}: ${p.tipo}`).join(', ')}):`, '        pasar');
    }
    for (const n of nodos.values()) {
      if (!usados.has(n.id) && NODOS[n.def]) avisos.push({ mensaje: `El bloque «${tituloNodo(n)}» está suelto y no hace nada.`, nodo: n.id });
    }
  };

  // Dos pasadas: la primera averigua qué devuelve cada función (el tipo de lo que llega a «Devolver»).
  for (const pasada of [1, 2]) {
    salida = []; lineas = {}; erroresGen = []; avisos.length = 0;
    L(`# Generado desde ${archivo} · no editar a mano`, 0);
    L(`clase ${clase} extiende ${base}:`, 0);
    for (const v of bp.variables || []) {
      if (!variables.has(v.nombre)) continue;
      const t = variables.get(v.nombre);
      if (pasada === 2 && v.exportar && !['decimal', 'entero', 'texto', 'booleano'].includes(t)) errores.push({ mensaje: `«${v.nombre}» no se puede exportar: el Inspector solo cambia números, textos y sí / no.`, nodo: null });
      const inicial = t === 'Nodo' ? `nodo(${textoAra(v.valor || '')})` : t === 'lista[Nodo]' ? '[]' : t === 'booleano' ? (v.valor ? 'verdadero' : 'falso') : t === 'texto' ? textoAra(v.valor ?? '') : numeroAra(v.valor, t);
      L(`${v.exportar ? 'exportar ' : ''}${v.nombre}: ${t} = ${inicial}`, 1);
    }
    compilarGrafo(grafos.eventos || { nodos: [] }, null);
    for (const f of funciones.keys()) compilarGrafo(grafos['fn:' + f] || { nodos: [] }, f);
    if (salida.length === 2) L('pasar', 1);
    if (pasada === 1) {
      for (const f of funciones.values()) if (f.retornoVisto) { f.retorno = f.retornoVisto === 'lista[Nodo]' ? 'nada' : f.retornoVisto; delete f.retornoVisto; }
    }
  }
  return { codigo: salida.join('\n') + '\n', clase, errores: [...errores, ...erroresGen], avisos, lineas };
}

// Cuenta los nodos de todos los grafos (para «6 nodos»).
export function contarNodos(bp) {
  return Object.values(bp.grafos || {}).reduce((s, g) => s + (g.nodos || []).length, 0);
}

