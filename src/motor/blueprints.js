// Blueprints: lógica con bloques que se compila a Águila.

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

const lit = (v, t) => {
  if (t === 'texto') return JSON.stringify(String(v ?? ''));
  if (t === 'bool') return v ? 'verdadero' : 'falso';
  if (t === 'decimal' || t === 'entero') { const n = Number(v); return Number.isFinite(n) ? String(n) : '0'; }
  if (t === 'objeto') return v ? String(v) : 'yo';
  if (v === undefined || v === null || v === '') return 'nulo';
  return typeof v === 'number' ? String(v) : JSON.stringify(v);
};

// Ayudantes para definir nodos.
const ent = (n, t, def, etq) => ({ n, t, def, etq: etq ?? n });
const sal = (n, t, etq) => ({ n, t, etq: etq ?? n });
const EXEC_IN = ent('entrada', 'exec', null, '');
const EXEC_OUT = sal('salida', 'exec', '');

function binaria(op, prec) {
  return (c) => ({ codigo: `${c.e('a', prec)} ${op} ${c.e('b', prec + (op === '-' || op === '/' ? 1 : 0))}`, prec });
}

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
  in_pulsada: { titulo: 'Acción pulsada', cat: 'Entrada', entradas: [ent('accion', 'texto', 'saltar', 'acción')], soloValor: true, salidas: [sal('pulsada', 'bool', 'pulsada')], gen: (c) => ({ codigo: `se_pulsa(${c.e('accion')})`, prec: P.atomo }), ayuda: 'Verdadero solo en el momento en que se pulsa la acción.' },
  in_mantenida: { titulo: 'Acción mantenida', cat: 'Entrada', entradas: [ent('accion', 'texto', 'correr', 'acción')], soloValor: true, salidas: [sal('pulsada', 'bool', 'mantenida')], gen: (c) => ({ codigo: `se_mantiene(${c.e('accion')})`, prec: P.atomo }), ayuda: 'Verdadero mientras la acción siga pulsada.' },
  in_eje: { titulo: 'Eje', cat: 'Entrada', entradas: [ent('negativa', 'texto', 'izquierda', '−'), ent('positiva', 'texto', 'derecha', '+')], soloValor: true, salidas: [sal('valor', 'decimal', '-1 · 0 · 1')], gen: (c) => ({ codigo: `eje(${c.e('negativa')}, ${c.e('positiva')})`, prec: P.atomo }), ayuda: 'Da -1 si se pulsa la acción negativa, 1 si se pulsa la positiva y 0 si ninguna.' },
  in_raton: { titulo: 'Posición del ratón', cat: 'Entrada', salidas: [sal('x', 'decimal', 'x'), sal('y', 'decimal', 'y')], gen: (c, pin) => ({ codigo: pin === 'y' ? 'raton_y()' : 'raton_x()', prec: P.atomo }), ayuda: 'Dónde está el ratón en el mundo.' },
  in_clic: { titulo: 'Ratón pulsado', cat: 'Entrada', salidas: [sal('pulsado', 'bool', 'pulsado')], gen: () => ({ codigo: 'raton_pulsado()', prec: P.atomo }), ayuda: 'Verdadero mientras el botón izquierdo esté pulsado.' },

  // ---------- Movimiento ----------
  mv_mover: { titulo: 'Mover', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'velocidad x'), ent('y', 'decimal', null, 'velocidad y')], salidas: [EXEC_OUT], gen: (c) => c.conectado('y') || (c.valor('y') !== null && c.valor('y') !== undefined && c.valor('y') !== '') ? `mover(${c.e('x')}, ${c.e('y')})` : `mover(${c.e('x')})`, ayuda: 'Mueve al personaje este fotograma, en píxeles por segundo.' },
  mv_saltar: { titulo: 'Saltar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('fuerza', 'decimal', 420, 'fuerza')], salidas: [EXEC_OUT], gen: (c) => `saltar(${c.e('fuerza')})`, ayuda: 'Impulsa al personaje hacia arriba con esa fuerza.' },
  mv_suelo: { titulo: 'En el suelo', cat: 'Movimiento', salidas: [sal('valor', 'bool', 'sí / no')], gen: () => ({ codigo: 'en_el_suelo()', prec: P.atomo }), ayuda: 'Verdadero si el personaje está apoyado en el suelo.' },
  mv_posicion: { titulo: 'Posición', cat: 'Movimiento', entradas: [ent('objeto', 'objeto', null, 'de')], salidas: [sal('x', 'decimal', 'x'), sal('y', 'decimal', 'y')], gen: (c, pin) => ({ codigo: (c.conectado('objeto') ? c.e('objeto', P.atomo) + '.' : '') + pin, prec: P.atomo }), ayuda: 'La posición de este nodo (o del que conectes).' },
  mv_fijar: { titulo: 'Colocar en', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', 0, 'y')], salidas: [EXEC_OUT], gen: (c) => `mover_a(${c.e('x')}, ${c.e('y')})`, ayuda: 'Coloca el nodo en esa posición.' },
  mv_desplazar: { titulo: 'Desplazar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'dx'), ent('y', 'decimal', 0, 'dy')], salidas: [EXEC_OUT], gen: (c) => `desplazar(${c.e('x')}, ${c.e('y')})`, ayuda: 'Mueve el nodo esa distancia de golpe.' },
  mv_empujar: { titulo: 'Empujar', cat: 'Movimiento', exec: true, entradas: [EXEC_IN, ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', -300, 'y')], salidas: [EXEC_OUT], gen: (c) => `empujar(${c.e('x')}, ${c.e('y')})`, ayuda: 'Da un empujón al personaje.' },

  // ---------- Lógica ----------
  lg_si: { titulo: 'Si', subtitulo: 'Control de flujo', icono: 'cadena', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('condicion', 'bool', true, 'condición')], salidas: [sal('verdadero', 'exec', 'verdadero'), sal('falso', 'exec', 'falso')], ayuda: 'Elige un camino según una condición. Si es verdadera, sigue por «verdadero»; si no, por «falso».' },
  lg_y: { titulo: 'Y', cat: 'Lógica', entradas: [ent('a', 'bool', true, 'a'), ent('b', 'bool', true, 'b')], salidas: [sal('resultado', 'bool', 'resultado')], gen: (c) => ({ codigo: `${c.e('a', P.y)} y ${c.e('b', P.y + 1)}`, prec: P.y }), ayuda: 'Verdadero solo si a y b son verdaderos a la vez.' },
  lg_o: { titulo: 'O', cat: 'Lógica', entradas: [ent('a', 'bool', false, 'a'), ent('b', 'bool', false, 'b')], salidas: [sal('resultado', 'bool', 'resultado')], gen: (c) => ({ codigo: `${c.e('a', P.o)} o ${c.e('b', P.o + 1)}`, prec: P.o }), ayuda: 'Verdadero si al menos uno de los dos es verdadero.' },
  lg_no: { titulo: 'No', cat: 'Lógica', entradas: [ent('valor', 'bool', false, 'valor')], salidas: [sal('resultado', 'bool', 'resultado')], gen: (c) => ({ codigo: `no ${c.e('valor', P.no)}`, prec: P.no }), ayuda: 'Le da la vuelta: verdadero pasa a falso y al revés.' },
  lg_comparar: { titulo: 'Comparar', cat: 'Lógica', entradas: [ent('a', 'decimal', 0, 'a'), ent('op', 'opcion', '>=', ''), ent('b', 'decimal', 0, 'b')], opciones: { op: ['==', '!=', '<', '>', '<=', '>='] }, salidas: [sal('resultado', 'bool', 'resultado')], gen: (c) => ({ codigo: `${c.e('a', P.comp + 1)} ${c.valor('op') || '=='} ${c.e('b', P.comp + 1)}`, prec: P.comp }), ayuda: 'Compara dos números: igual, distinto, menor, mayor…' },
  lg_es: { titulo: 'Es…', cat: 'Lógica', entradas: [ent('objeto', 'objeto', null, 'objeto'), ent('nombre', 'texto', 'Moneda', 'nombre')], salidas: [sal('resultado', 'bool', 'sí / no')], gen: (c) => ({ codigo: `${c.e('objeto', P.atomo)}.es(${c.e('nombre')})`, prec: P.atomo }), ayuda: 'Verdadero si el objeto se llama así, es de ese tipo o está en ese grupo.' },
  lg_secuencia: { titulo: 'Secuencia', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN], salidas: [sal('primero', 'exec', 'primero'), sal('despues', 'exec', 'después')], ayuda: 'Hace primero una cosa y después otra.' },
  lg_repetir: { titulo: 'Repetir', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('veces', 'entero', 3, 'veces')], salidas: [sal('cuerpo', 'exec', 'cada vez'), sal('indice', 'entero', 'vuelta'), sal('salida', 'exec', 'al terminar')], ayuda: 'Repite lo conectado a «cada vez» un número de veces.' },
  lg_mientras: { titulo: 'Mientras', cat: 'Lógica', exec: true, flujo: true, entradas: [EXEC_IN, ent('condicion', 'bool', false, 'condición')], salidas: [sal('cuerpo', 'exec', 'repetir'), sal('salida', 'exec', 'al terminar')], ayuda: 'Repite mientras la condición sea verdadera. ¡Cuidado con los bucles infinitos!' },
  lg_esperar: { titulo: 'Esperar', cat: 'Lógica', exec: true, entradas: [EXEC_IN, ent('segundos', 'decimal', 1, 'segundos')], salidas: [EXEC_OUT], gen: (c) => `esperar(${c.e('segundos')})`, ayuda: 'Espera unos segundos antes de seguir. El juego no se para.' },

  // ---------- Matemáticas ----------
  mt_numero: { titulo: 'Número', cat: 'Matemáticas', compacto: true, entradas: [ent('valor', 'decimal', 0, '')], soloValor: true, salidas: [sal('valor', 'decimal', '')], gen: (c) => ({ codigo: lit(c.valor('valor'), 'decimal'), prec: Number(c.valor('valor')) < 0 ? P.no : P.atomo }), ayuda: 'Un número fijo.' },
  mt_sumar: { titulo: 'Sumar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 0, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a + b')], gen: binaria('+', P.suma), ayuda: 'Suma dos números.' },
  mt_restar: { titulo: 'Restar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 0, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a − b')], gen: binaria('-', P.suma), ayuda: 'Resta b a a.' },
  mt_multiplicar: { titulo: 'Multiplicar', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 1, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a × b')], gen: binaria('*', P.mul), ayuda: 'Multiplica dos números.' },
  mt_dividir: { titulo: 'Dividir', cat: 'Matemáticas', entradas: [ent('a', 'decimal', 1, 'a'), ent('b', 'decimal', 1, 'b')], salidas: [sal('resultado', 'decimal', 'a ÷ b')], gen: binaria('/', P.mul), ayuda: 'Divide a entre b.' },
  mt_aleatorio: { titulo: 'Aleatorio', cat: 'Matemáticas', entradas: [ent('min', 'decimal', 0, 'mín'), ent('max', 'decimal', 100, 'máx')], salidas: [sal('valor', 'decimal', 'valor')], gen: (c) => ({ codigo: `aleatorio(${c.e('min')}, ${c.e('max')})`, prec: P.atomo }), ayuda: 'Un número al azar entre mín y máx.' },
  mt_limitar: { titulo: 'Limitar', cat: 'Matemáticas', entradas: [ent('valor', 'decimal', 0, 'valor'), ent('min', 'decimal', 0, 'mín'), ent('max', 'decimal', 100, 'máx')], salidas: [sal('resultado', 'decimal', 'resultado')], gen: (c) => ({ codigo: `limitar(${c.e('valor')}, ${c.e('min')}, ${c.e('max')})`, prec: P.atomo }), ayuda: 'Mantiene el valor entre mín y máx.' },
  mt_distancia: { titulo: 'Distancia', cat: 'Matemáticas', entradas: [ent('a', 'objeto', null, 'a'), ent('b', 'objeto', null, 'b')], salidas: [sal('valor', 'decimal', 'distancia')], gen: (c) => ({ codigo: `distancia(${c.e('a')}, ${c.e('b')})`, prec: P.atomo }), ayuda: 'Distancia entre dos nodos.' },

  // ---------- Variables ----------
  var_obtener: { titulo: 'Variable', cat: 'Variables', variable: true, compacto: true, salidas: [sal('valor', 'cualquiera', '')], gen: (c) => ({ codigo: c.nodo.variable || 'nulo', prec: P.atomo }), ayuda: 'El valor de una variable del Blueprint.' },
  var_fijar: { titulo: 'Fijar variable', cat: 'Variables', variable: true, exec: true, entradas: [EXEC_IN, ent('valor', 'cualquiera', 0, 'valor')], salidas: [EXEC_OUT], gen: (c) => `${c.nodo.variable || 'x'} = ${c.e('valor')}`, ayuda: 'Cambia el valor de una variable.' },
  var_sumar: { titulo: 'Sumar a variable', cat: 'Variables', variable: true, exec: true, entradas: [EXEC_IN, ent('cantidad', 'decimal', 1, 'cantidad')], salidas: [EXEC_OUT], gen: (c) => `${c.nodo.variable || 'x'} = ${c.nodo.variable || 'x'} + ${c.e('cantidad', P.suma + 1)}`, ayuda: 'Suma una cantidad a una variable numérica.' },
  fn_llamar: { titulo: 'Llamar función', cat: 'Variables', funcion: true, exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], gen: (c) => `${c.nodo.funcion || 'funcion'}(${(c.params || []).map(p => c.e(p)).join(', ')})`, ayuda: 'Ejecuta una función del Blueprint.' },
  fn_devolver: { titulo: 'Devolver', cat: 'Variables', exec: true, entradas: [EXEC_IN, ent('valor', 'cualquiera', null, 'valor')], salidas: [], gen: (c) => c.conectado('valor') ? `devolver ${c.e('valor')}` : 'devolver', ayuda: 'Termina la función.' },

  // ---------- Escena ----------
  es_yo: { titulo: 'Yo', cat: 'Escena', compacto: true, salidas: [sal('yo', 'objeto', 'este nodo')], gen: () => ({ codigo: 'yo', prec: P.atomo }), ayuda: 'El propio nodo que tiene este Blueprint.' },
  es_nodo: { titulo: 'Nodo por nombre', cat: 'Escena', entradas: [ent('nombre', 'texto', 'Jugador', 'nombre')], soloValor: true, salidas: [sal('nodo', 'objeto', 'nodo')], gen: (c) => ({ codigo: `nodo(${c.e('nombre')})`, prec: P.atomo }), ayuda: 'Busca un nodo de la escena por su nombre.' },
  es_mostrar: { titulo: 'Mostrar', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('texto', 'cualquiera', '¡Hola!', 'texto')], salidas: [EXEC_OUT], gen: (c) => `mostrar(${c.e('texto')})`, ayuda: 'Escribe un mensaje en la Salida del editor.' },
  es_eliminar: { titulo: 'Eliminar', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('objeto', 'objeto', null, 'objeto')], salidas: [EXEC_OUT], gen: (c) => `${c.conectado('objeto') ? c.e('objeto', P.atomo) : 'yo'}.eliminar()`, ayuda: 'Quita un nodo del juego (si no conectas nada, este mismo).' },
  es_crear: { titulo: 'Crear copia', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('plantilla', 'texto', 'Moneda', 'de'), ent('x', 'decimal', 0, 'x'), ent('y', 'decimal', 0, 'y')], salidas: [EXEC_OUT], gen: (c) => `crear(${c.e('plantilla')}, ${c.e('x')}, ${c.e('y')})`, ayuda: 'Crea una copia de un nodo o de una escena.' },
  es_ganar: { titulo: 'Ganar partida', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], gen: () => 'ganar_partida()', ayuda: 'Termina el nivel con victoria.' },
  es_perder: { titulo: 'Perder partida', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], gen: () => 'perder_partida()', ayuda: 'Termina la partida con derrota.' },
  es_reiniciar: { titulo: 'Reiniciar nivel', cat: 'Escena', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], gen: () => 'reiniciar_nivel()', ayuda: 'Vuelve a empezar la escena.' },
  es_puntos: { titulo: 'Ganar puntos', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('cantidad', 'entero', 10, 'cantidad')], salidas: [EXEC_OUT], gen: (c) => `ganar_puntos(${c.e('cantidad')})`, ayuda: 'Suma puntos al marcador.' },
  es_emitir: { titulo: 'Emitir señal', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('senal', 'texto', 'abrir', 'señal')], salidas: [EXEC_OUT], gen: (c) => `emitir(${c.e('senal')})`, ayuda: 'Avisa a todos los scripts que escuchen esta señal.' },
  es_escena: { titulo: 'Cambiar escena', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('escena', 'texto', 'nivel2', 'escena')], salidas: [EXEC_OUT], gen: (c) => `cambiar_escena(${c.e('escena')})`, ayuda: 'Pasa a otra escena.' },
  es_temblar: { titulo: 'Temblar cámara', cat: 'Escena', exec: true, entradas: [EXEC_IN, ent('fuerza', 'decimal', 8, 'fuerza'), ent('segundos', 'decimal', 0.3, 'segundos')], salidas: [EXEC_OUT], gen: (c) => `temblar_camara(${c.e('fuerza')}, ${c.e('segundos')})`, ayuda: 'Hace temblar la cámara.' },

  // ---------- Texto ----------
  tx_texto: { titulo: 'Texto', cat: 'Texto', compacto: true, entradas: [ent('valor', 'texto', 'Hola', '')], soloValor: true, salidas: [sal('valor', 'texto', '')], gen: (c) => ({ codigo: lit(c.valor('valor'), 'texto'), prec: P.atomo }), ayuda: 'Un texto fijo.' },
  tx_unir: { titulo: 'Unir textos', cat: 'Texto', entradas: [ent('a', 'cualquiera', 'Monedas: ', 'a'), ent('b', 'cualquiera', '', 'b')], salidas: [sal('resultado', 'texto', 'a + b')], gen: (c) => ({ codigo: `${c.e('a', P.suma)} + texto(${c.e('b')})`, prec: P.suma }), ayuda: 'Junta dos textos (los números se convierten solos).' },
  tx_fijar: { titulo: 'Cambiar texto', cat: 'Texto', exec: true, entradas: [EXEC_IN, ent('nodo', 'texto', 'Marcador', 'etiqueta'), ent('texto', 'cualquiera', '', 'texto')], salidas: [EXEC_OUT], gen: (c) => `nodo(${c.e('nodo')}).texto = texto(${c.e('texto')})`, ayuda: 'Cambia lo que pone una Etiqueta de la interfaz.' },

  // ---------- Audio ----------
  au_sonar: { titulo: 'Reproducir sonido', cat: 'Audio', exec: true, entradas: [EXEC_IN, ent('sonido', 'texto', 'salto.wav', 'sonido'), ent('volumen', 'decimal', 1, 'volumen')], salidas: [EXEC_OUT], gen: (c) => `sonar(${c.e('sonido')}, ${c.e('volumen')})`, ayuda: 'Hace sonar un efecto del proyecto.' },
  au_musica: { titulo: 'Poner música', cat: 'Audio', exec: true, entradas: [EXEC_IN, ent('musica', 'texto', 'tema.ogg', 'música')], salidas: [EXEC_OUT], gen: (c) => `musica(${c.e('musica')})`, ayuda: 'Pone música de fondo en bucle.' },
  au_parar: { titulo: 'Parar música', cat: 'Audio', exec: true, entradas: [EXEC_IN], salidas: [EXEC_OUT], gen: () => 'parar_musica()', ayuda: 'Detiene la música.' },
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

// ---------- Compilador Blueprint → Águila ----------

/**
 * Compila un Blueprint a código Águila.
 * Devuelve { codigo, errores: [{mensaje, nodo}], avisos, lineas: {idNodo: línea} }
 */
export function compilarBlueprint(bp, archivo = 'blueprint.bp') {
  const salida = [];
  const errores = [];
  const avisos = [];
  const lineas = {};
  const L = (texto, nivel, idNodo) => {
    salida.push('    '.repeat(nivel) + texto);
    if (idNodo && !(idNodo in lineas)) lineas[idNodo] = salida.length;
  };

  L(`# Generado desde ${archivo} · no editar a mano`, 0);
  for (const v of bp.variables || []) {
    L(`${v.exportar ? 'exportar ' : ''}variable ${v.nombre} = ${lit(v.valor, v.tipo === 'entero' || v.tipo === 'decimal' ? 'decimal' : v.tipo)}`, 0);
  }

  const compilarGrafo = (grafo, comoFuncion) => {
    const nodos = new Map((grafo.nodos || []).map(n => [n.id, n]));
    const porEntrada = new Map(); // "idNodo:pin" -> conexión que llega
    const porSalida = new Map();  // "idNodo:pin" -> [conexiones que salen]
    for (const c of grafo.conexiones || []) {
      if (!nodos.has(c.de) || !nodos.has(c.a)) continue;
      porEntrada.set(c.a + ':' + c.entrada, c);
      const k = c.de + ':' + c.salida;
      if (!porSalida.has(k)) porSalida.set(k, []);
      porSalida.get(k).push(c);
    }
    const usados = new Set();
    let contadorBucle = 0;

    const ctx = (nodo, pila) => {
      const d = NODOS[nodo.def];
      const { entradas } = pinesDe(nodo, bp);
      const c = {
        nodo,
        params: nodo.def === 'fn_llamar' ? entradas.filter(p => p.t !== 'exec').map(p => p.n) : null,
        conectado: (pin) => porEntrada.has(nodo.id + ':' + pin),
        valor: (pin) => {
          if (nodo.valores && pin in nodo.valores) return nodo.valores[pin];
          const p = entradas.find(x => x.n === pin);
          return p ? p.def : null;
        },
        e: (pin, precMin = 0) => {
          const con = porEntrada.get(nodo.id + ':' + pin);
          const p = entradas.find(x => x.n === pin);
          if (!con) {
            const v = c.valor(pin);
            if (p && p.t === 'objeto') return 'yo';
            if (p && p.t === 'cualquiera') {
              if (typeof v === 'number') return String(v);
              if (typeof v === 'boolean') return lit(v, 'bool');
              if (v === null || v === undefined) return 'nulo';
              return /^-?\d+(\.\d+)?$/.test(String(v).trim()) ? String(v).trim() : lit(v, 'texto');
            }
            if (p && p.t === 'opcion') return String(v);
            return lit(v, p ? p.t : 'cualquiera');
          }
          const r = expr(con.de, con.salida, pila);
          return r.prec < precMin ? `(${r.codigo})` : r.codigo;
        },
      };
      return c;
    };

    function expr(idNodo, pin, pila = new Set()) {
      const nodo = nodos.get(idNodo);
      usados.add(idNodo);
      const d = NODOS[nodo.def];
      if (pila.has(idNodo)) {
        errores.push({ mensaje: `El bloque «${tituloNodo(nodo)}» está conectado en círculo consigo mismo.`, nodo: idNodo });
        return { codigo: 'nulo', prec: P.atomo };
      }
      // Salidas de datos de eventos y bucles: parámetros.
      if (d.esEvento && pin !== 'salida') return { codigo: pin, prec: P.atomo };
      if (nodo.def === 'lg_repetir' && pin === 'indice') return { codigo: nodo._varBucle || 'vuelta', prec: P.atomo };
      if (!d.gen) {
        errores.push({ mensaje: `El bloque «${tituloNodo(nodo)}» no da un valor.`, nodo: idNodo });
        return { codigo: 'nulo', prec: P.atomo };
      }
      const p2 = new Set(pila); p2.add(idNodo);
      const r = d.gen(ctx(nodo, p2), pin);
      return typeof r === 'string' ? { codigo: r, prec: P.atomo } : r;
    }

    function siguiente(idNodo, pin) {
      const cs = porSalida.get(idNodo + ':' + pin) || [];
      return cs.length ? cs[0].a : null;
    }

    function cadena(idNodo, nivel, visitados) {
      let n = 0;
      while (idNodo) {
        if (visitados.has(idNodo)) {
          errores.push({ mensaje: 'Hay un círculo en las flechas de ejecución.', nodo: idNodo });
          return n;
        }
        visitados.add(idNodo);
        usados.add(idNodo);
        const nodo = nodos.get(idNodo);
        const d = NODOS[nodo.def];
        const c = ctx(nodo, new Set([idNodo]));
        n++;
        if (nodo.def === 'lg_si') {
          L(`si ${c.e('condicion')}:`, nivel, idNodo);
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
          if (!hecho) { L('pasar', nivel, idNodo); }
          return n;
        }
        if (nodo.def === 'lg_repetir') {
          const usaIndice = (porSalida.get(idNodo + ':indice') || []).length > 0;
          if (usaIndice) {
            nodo._varBucle = `vuelta${contadorBucle ? contadorBucle + 1 : ''}`;
            contadorBucle++;
            L(`para cada ${nodo._varBucle} en rango(${c.e('veces')}):`, nivel, idNodo);
          } else L(`repetir ${c.e('veces')} veces:`, nivel, idNodo);
          const cu = siguiente(idNodo, 'cuerpo');
          if (!cu || !cadena(cu, nivel + 1, new Set(visitados))) L('pasar', nivel + 1);
          idNodo = siguiente(idNodo, 'salida');
          continue;
        }
        if (nodo.def === 'lg_mientras') {
          L(`mientras ${c.e('condicion')}:`, nivel, idNodo);
          const cu = siguiente(idNodo, 'cuerpo');
          if (!cu || !cadena(cu, nivel + 1, new Set(visitados))) L('pasar', nivel + 1);
          idNodo = siguiente(idNodo, 'salida');
          continue;
        }
        if (!d.exec || !d.gen) {
          errores.push({ mensaje: `El bloque «${tituloNodo(nodo)}» no es una acción y no se puede encadenar con flechas.`, nodo: idNodo });
          return n;
        }
        L(d.gen(c), nivel, idNodo);
        idNodo = siguiente(idNodo, 'salida');
      }
      return n;
    }

    const eventos = [...nodos.values()].filter(n => NODOS[n.def] && NODOS[n.def].esEvento)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    for (const ev of eventos) {
      const d = NODOS[ev.def];
      usados.add(ev.id);
      let cabecera;
      if (comoFuncion) {
        if (ev.def !== 'fn_entrada') continue;
        const f = (bp.funciones || []).find(x => x.nombre === ev.funcion) || { nombre: ev.funcion, params: [] };
        cabecera = `función ${f.nombre}(${(f.params || []).map(p => p.nombre).join(', ')}):`;
      } else {
        if (ev.def === 'fn_entrada') continue;
        let args = (d.params || []).join(', ');
        if (d.filtro) {
          const v = (ev.valores && ev.valores[d.filtro]) ?? d.entradas.find(p => p.n === d.filtro).def;
          args = [JSON.stringify(String(v)), ...(d.params || [])].join(', ');
        }
        cabecera = `cuando ${d.evento}(${args}):`;
      }
      salida.push('');
      L(cabecera, 0, ev.id);
      const primero = siguiente(ev.id, 'salida');
      const n = primero ? cadena(primero, 1, new Set()) : 0;
      if (!n) {
        L('pasar', 1);
        avisos.push({ mensaje: `«${tituloNodo(ev)}» no tiene nada conectado todavía.`, nodo: ev.id });
      }
    }

    for (const n of nodos.values()) {
      if (!usados.has(n.id) && NODOS[n.def]) {
        avisos.push({ mensaje: `El bloque «${tituloNodo(n)}» está suelto y no hace nada.`, nodo: n.id });
      }
    }
  };

  const grafos = bp.grafos || {};
  compilarGrafo(grafos.eventos || { nodos: [] }, false);
  for (const f of bp.funciones || []) {
    const g = grafos['fn:' + f.nombre];
    if (g) compilarGrafo(g, true);
    else { salida.push('', `función ${f.nombre}(${(f.params || []).map(p => p.nombre).join(', ')}):`, '    pasar'); }
  }

  return { codigo: salida.join('\n') + '\n', errores, avisos, lineas };
}

// Cuenta los nodos de todos los grafos (para «6 nodos»).
export function contarNodos(bp) {
  return Object.values(bp.grafos || {}).reduce((s, g) => s + (g.nodos || []).length, 0);
}
