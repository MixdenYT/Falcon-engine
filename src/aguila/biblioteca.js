// Biblioteca estándar de Águila y su documentación.
// La documentación alimenta el autocompletado, la ayuda contextual y el diccionario del editor.

import { aTexto, tipoDe, esVerdad, FuncionAguila } from './interprete.js';

function errorNativo(mensaje, explicacion) {
  const e = new Error(mensaje);
  e.esErrorAguilaNativo = true;
  e.explicacion = explicacion;
  return e;
}

function num(v, quien, cual = 'el dato') {
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw errorNativo(`«${quien}» necesita un número como ${cual}, pero ha recibido ${tipoDe(v)}.`,
      typeof v === 'string' ? 'Si es un texto con un número dentro, conviértelo antes con «numero(...)».' : '');
  }
  return v;
}

// ---- Diccionario de palabras del lenguaje ----
export const PALABRAS = [
  { nombre: 'variable', titulo: 'variable', descripcion: 'Guarda un dato con nombre, como las monedas.', ejemplo: 'variable monedas = 0' },
  { nombre: 'si', titulo: 'si … sino', descripcion: 'Haz algo solo si se cumple una condición.', ejemplo: 'si monedas >= 10:\n    ganar_partida()\nsino:\n    mostrar("Faltan monedas")' },
  { nombre: 'cuando', titulo: 'cuando', descripcion: 'Reacciona a algo que pasa en el juego.', ejemplo: 'cuando toca(otro):\n    si otro.es("Moneda"):\n        otro.eliminar()' },
  { nombre: 'mientras', titulo: 'mientras', descripcion: 'Repite mientras la condición sea verdadera.', ejemplo: 'mientras vida > 0:\n    vida = vida - 1' },
  { nombre: 'para', titulo: 'para cada … en', descripcion: 'Recorre todos los elementos de una lista.', ejemplo: 'para cada enemigo en grupo("enemigos"):\n    enemigo.eliminar()' },
  { nombre: 'función', titulo: 'función', descripcion: 'Agrupa órdenes con un nombre para reutilizarlas.', ejemplo: 'función curar(cantidad):\n    vida = vida + cantidad' },
  { nombre: 'devolver', titulo: 'devolver', descripcion: 'Termina una función y entrega un resultado.', ejemplo: 'función doble(n):\n    devolver n * 2' },
  { nombre: 'repetir', titulo: 'repetir … veces', descripcion: 'Repite unas órdenes un número fijo de veces.', ejemplo: 'repetir 3 veces:\n    crear("Moneda", aleatorio(0, 800), 100)' },
  { nombre: 'esperar', titulo: 'esperar(segundos)', descripcion: 'Pausa el evento actual unos segundos sin parar el juego.', ejemplo: 'cuando empieza():\n    esperar(2)\n    mostrar("¡Ya!")' },
  { nombre: 'clase', titulo: 'clase … extiende', descripcion: 'Da reglas a un tipo de nodo. Todo lo de dentro pertenece a ese nodo.', ejemplo: 'clase Jugador extiende Personaje2D:\n    variable vida = 3' },
  { nombre: 'exportar', titulo: 'exportar', descripcion: 'Hace que una variable aparezca en el Inspector para cambiarla sin tocar el código.', ejemplo: 'exportar variable velocidad = 220' },
  { nombre: 'constante', titulo: 'constante', descripcion: 'Un dato con nombre que nunca cambia.', ejemplo: 'constante VIDA_MAXIMA = 5' },
  { nombre: 'y', titulo: 'y · o · no', descripcion: 'Combinan condiciones: «y» necesita las dos, «o» le basta una, «no» le da la vuelta.', ejemplo: 'si se_pulsa("saltar") y en_el_suelo():\n    saltar()' },
  { nombre: 'lista', titulo: '[ lista ]', descripcion: 'Varios datos en orden, entre corchetes. Se cuentan desde 0.', ejemplo: 'variable frutas = ["pera", "uva"]\nmostrar(frutas[0])' },
  { nombre: 'diccionario', titulo: '{ diccionario }', descripcion: 'Datos con nombre dentro de un mismo valor.', ejemplo: 'variable precios = {"espada": 10, "escudo": 7}\nmostrar(precios["espada"])' },
  { nombre: 'romper', titulo: 'romper · continuar', descripcion: '«romper» sale de un bucle; «continuar» salta a la siguiente vuelta.', ejemplo: 'para cada n en rango(10):\n    si n == 5:\n        romper' },
  { nombre: 'yo', titulo: 'yo', descripcion: 'El propio nodo que tiene el script.', ejemplo: 'yo.eliminar()' },
];

// ---- Eventos «cuando» ----
export const EVENTOS = [
  { nombre: 'empieza', firma: 'cuando empieza():', descripcion: 'Una sola vez, cuando el nodo aparece en el juego.', params: [] },
  { nombre: 'se_actualiza', firma: 'cuando se_actualiza(delta):', descripcion: 'En cada fotograma. «delta» son los segundos desde el fotograma anterior.', params: ['delta'] },
  { nombre: 'toca', firma: 'cuando toca(otro):', descripcion: 'Cuando este nodo empieza a tocar a otro. «otro» es el nodo tocado.', params: ['otro'] },
  { nombre: 'deja_de_tocar', firma: 'cuando deja_de_tocar(otro):', descripcion: 'Cuando deja de tocar a otro nodo.', params: ['otro'] },
  { nombre: 'se_pulsa', firma: 'cuando se_pulsa("saltar"):', descripcion: 'Cuando se pulsa una acción (tecla o botón del mando).', params: ['accion'] },
  { nombre: 'se_suelta', firma: 'cuando se_suelta("saltar"):', descripcion: 'Cuando se suelta una acción.', params: ['accion'] },
  { nombre: 'recibe', firma: 'cuando recibe("abrir_puerta"):', descripcion: 'Cuando alguien emite esa señal con «emitir("abrir_puerta")».', params: ['senal', 'datos'] },
  { nombre: 'hace_clic', firma: 'cuando hace_clic():', descripcion: 'Cuando se hace clic sobre el nodo o el botón.', params: [] },
  { nombre: 'termina', firma: 'cuando termina():', descripcion: 'Cuando un Temporizador llega a cero o una animación acaba.', params: [] },
  { nombre: 'se_elimina', firma: 'cuando se_elimina():', descripcion: 'Justo antes de que el nodo desaparezca.', params: [] },
];

// ---- Funciones globales ----
// tipo: función | variable. «motor: true» indica que la implementa el motor del juego.
export const FUNCIONES = [
  // General
  { nombre: 'mostrar', firma: 'mostrar(valor, …)', categoria: 'General', descripcion: 'Escribe un mensaje en la consola de Salida. Muy útil para saber qué está pasando.', ejemplo: 'mostrar("¡Hola, aventurero!")' },
  { nombre: 'esperar', firma: 'esperar(segundos)', categoria: 'General', descripcion: 'Pausa el evento actual los segundos indicados. El resto del juego sigue.', ejemplo: 'esperar(1.5)\nmostrar("Ha pasado segundo y medio")' },
  { nombre: 'despues', firma: 'despues(segundos, función)', categoria: 'General', motor: true, descripcion: 'Llama a una función pasados unos segundos.', ejemplo: 'despues(3, reaparecer)' },
  { nombre: 'largo', firma: 'largo(valor)', categoria: 'General', descripcion: 'Cuántos elementos tiene una lista, o cuántas letras un texto.', ejemplo: 'si largo(enemigos) == 0:\n    ganar_partida()' },
  { nombre: 'texto', firma: 'texto(valor)', categoria: 'Texto', descripcion: 'Convierte cualquier valor en texto.', ejemplo: 'marcador.texto = "Monedas: " + texto(monedas)' },
  { nombre: 'numero', firma: 'numero(texto)', categoria: 'Matemáticas', descripcion: 'Convierte un texto con un número dentro en un número.', ejemplo: 'variable n = numero("42")' },
  { nombre: 'entero', firma: 'entero(valor)', categoria: 'Matemáticas', descripcion: 'Quita los decimales de un número.', ejemplo: 'entero(3.9)  # 3' },
  { nombre: 'tipo_de', firma: 'tipo_de(valor)', categoria: 'General', descripcion: 'Dice de qué tipo es un valor: entero, decimal, texto, lista…', ejemplo: 'mostrar(tipo_de(3.5))  # decimal' },
  // Matemáticas
  { nombre: 'aleatorio', firma: 'aleatorio(mín, máx)', categoria: 'Matemáticas', descripcion: 'Un número decimal al azar entre mín y máx. Sin datos, entre 0 y 1.', ejemplo: 'variable x = aleatorio(0, 800)' },
  { nombre: 'aleatorio_entero', firma: 'aleatorio_entero(mín, máx)', categoria: 'Matemáticas', descripcion: 'Un número entero al azar entre mín y máx (ambos incluidos).', ejemplo: 'variable dado = aleatorio_entero(1, 6)' },
  { nombre: 'elegir', firma: 'elegir(lista)', categoria: 'Matemáticas', descripcion: 'Un elemento al azar de una lista.', ejemplo: 'variable color = elegir(["rojo", "azul"])' },
  { nombre: 'redondear', firma: 'redondear(número, decimales)', categoria: 'Matemáticas', descripcion: 'Redondea un número. Puedes indicar cuántos decimales quieres.', ejemplo: 'redondear(3.14159, 2)  # 3.14' },
  { nombre: 'redondear_abajo', firma: 'redondear_abajo(número)', categoria: 'Matemáticas', descripcion: 'Redondea hacia abajo.', ejemplo: 'redondear_abajo(3.9)  # 3' },
  { nombre: 'redondear_arriba', firma: 'redondear_arriba(número)', categoria: 'Matemáticas', descripcion: 'Redondea hacia arriba.', ejemplo: 'redondear_arriba(3.1)  # 4' },
  { nombre: 'abs', firma: 'abs(número)', categoria: 'Matemáticas', descripcion: 'El valor absoluto: el número sin signo.', ejemplo: 'abs(-5)  # 5' },
  { nombre: 'min', firma: 'min(a, b, …)', categoria: 'Matemáticas', descripcion: 'El menor de los números (o de una lista).', ejemplo: 'min(vida, 5)' },
  { nombre: 'max', firma: 'max(a, b, …)', categoria: 'Matemáticas', descripcion: 'El mayor de los números (o de una lista).', ejemplo: 'max(0, vida - 1)' },
  { nombre: 'limitar', firma: 'limitar(valor, mín, máx)', categoria: 'Matemáticas', descripcion: 'Mantiene un valor entre un mínimo y un máximo.', ejemplo: 'vida = limitar(vida, 0, 5)' },
  { nombre: 'interpolar', firma: 'interpolar(a, b, t)', categoria: 'Matemáticas', descripcion: 'Un valor entre a y b. Con t = 0 da a, con t = 1 da b.', ejemplo: 'x = interpolar(x, objetivo_x, 0.1)' },
  { nombre: 'mezclar_color', firma: 'mezclar_color(color_a, color_b, t)', categoria: 'Matemáticas', descripcion: 'Un color entre dos colores «#RRGGBB». Con t = 0 da el primero, con t = 1 el segundo.', ejemplo: 'color = mezclar_color("#FFB060", "#6A8CFF", 0.5)' },
  { nombre: 'signo', firma: 'signo(número)', categoria: 'Matemáticas', descripcion: 'Devuelve -1, 0 o 1 según el signo.', ejemplo: 'signo(-3)  # -1' },
  { nombre: 'raiz', firma: 'raiz(número)', categoria: 'Matemáticas', descripcion: 'La raíz cuadrada.', ejemplo: 'raiz(16)  # 4' },
  { nombre: 'potencia', firma: 'potencia(base, exponente)', categoria: 'Matemáticas', descripcion: 'Eleva un número a otro. También puedes usar «**».', ejemplo: 'potencia(2, 3)  # 8' },
  { nombre: 'seno', firma: 'seno(grados)', categoria: 'Matemáticas', descripcion: 'El seno de un ángulo en grados. Útil para movimientos de vaivén.', ejemplo: 'y = 100 + seno(tiempo() * 90) * 20' },
  { nombre: 'coseno', firma: 'coseno(grados)', categoria: 'Matemáticas', descripcion: 'El coseno de un ángulo en grados.', ejemplo: 'x = coseno(angulo) * radio' },
  { nombre: 'angulo_hacia', firma: 'angulo_hacia(x1, y1, x2, y2)', categoria: 'Matemáticas', descripcion: 'El ángulo en grados desde un punto hacia otro.', ejemplo: 'rotacion = angulo_hacia(x, y, raton_x(), raton_y())' },
  { nombre: 'distancia', firma: 'distancia(a, b)', categoria: 'Matemáticas', motor: true, descripcion: 'La distancia entre dos nodos, o entre dos puntos (x1, y1, x2, y2).', ejemplo: 'si distancia(yo, jugador) < 100:\n    perseguir()' },
  { nombre: 'pi', firma: 'pi', tipo: 'variable', tipoValor: 'decimal', categoria: 'Matemáticas', descripcion: 'El número π (3.14159…).', ejemplo: 'variable vuelta = 2 * pi' },
  { nombre: 'rango', firma: 'rango(fin) · rango(inicio, fin, paso)', categoria: 'Listas', descripcion: 'Una lista de números seguidos, ideal para «para cada».', ejemplo: 'para cada i en rango(5):\n    mostrar(i)' },
  // Entrada
  { nombre: 'se_pulsa', firma: 'se_pulsa(acción)', categoria: 'Entrada', motor: true, descripcion: 'Verdadero solo en el fotograma en que se pulsa la acción.', ejemplo: 'si se_pulsa("saltar"):\n    saltar()' },
  { nombre: 'se_mantiene', firma: 'se_mantiene(acción)', categoria: 'Entrada', motor: true, descripcion: 'Verdadero mientras la acción siga pulsada.', ejemplo: 'si se_mantiene("correr"):\n    velocidad = 400' },
  { nombre: 'se_suelta', firma: 'se_suelta(acción)', categoria: 'Entrada', motor: true, descripcion: 'Verdadero en el fotograma en que se suelta la acción.', ejemplo: 'si se_suelta("saltar"):\n    cortar_salto()' },
  { nombre: 'eje', firma: 'eje(negativa, positiva)', categoria: 'Entrada', motor: true, descripcion: 'Da -1, 0 o 1 según qué acción esté pulsada. Perfecto para moverse.', ejemplo: 'variable direccion = eje("izquierda", "derecha")' },
  { nombre: 'raton_x', firma: 'raton_x()', categoria: 'Entrada', motor: true, descripcion: 'Posición horizontal del ratón en el mundo.', ejemplo: 'x = raton_x()' },
  { nombre: 'raton_y', firma: 'raton_y()', categoria: 'Entrada', motor: true, descripcion: 'Posición vertical del ratón en el mundo.', ejemplo: 'y = raton_y()' },
  { nombre: 'raton_pulsado', firma: 'raton_pulsado()', categoria: 'Entrada', motor: true, descripcion: 'Verdadero mientras el botón izquierdo del ratón esté pulsado.', ejemplo: 'si raton_pulsado():\n    disparar()' },
  { nombre: 'disparar_rayo', firma: 'disparar_rayo(alcance)', categoria: 'Escena', motor: true, descripcion: 'En 3D devuelve el primer nodo sólido bajo la retícula, o nulo. Muros y cobertura detienen el disparo; no aplica daño por sí solo.', ejemplo: 'variable impacto = disparar_rayo(100)\nsi impacto != nulo y impacto.es("enemigos"):\n    impacto.llamar("recibir_dano", 34)' },
  // Juego
  { nombre: 'ganar_partida', firma: 'ganar_partida()', categoria: 'Juego', motor: true, descripcion: 'Termina el nivel y muestra la pantalla de victoria. Úsala cuando el jugador cumpla el objetivo.', ejemplo: 'si monedas >= 10:\n    ganar_partida()' },
  { nombre: 'perder_partida', firma: 'perder_partida()', categoria: 'Juego', motor: true, descripcion: 'Termina la partida y muestra la pantalla de derrota.', ejemplo: 'si vida <= 0:\n    perder_partida()' },
  { nombre: 'ganar_puntos', firma: 'ganar_puntos(cantidad)', categoria: 'Juego', motor: true, descripcion: 'Suma puntos al marcador.', ejemplo: 'ganar_puntos(100)' },
  { nombre: 'puntos', firma: 'puntos', tipo: 'variable', tipoValor: 'entero', categoria: 'Juego', motor: true, descripcion: 'Los puntos del marcador.', ejemplo: 'marcador.texto = texto(puntos)' },
  { nombre: 'gravedad', firma: 'gravedad', tipo: 'variable', tipoValor: 'decimal', categoria: 'Juego', motor: true, descripcion: 'La fuerza con la que caen las cosas en todo el juego.', ejemplo: 'gravedad = 600  # gravedad lunar' },
  { nombre: 'reiniciar_nivel', firma: 'reiniciar_nivel()', categoria: 'Juego', motor: true, descripcion: 'Vuelve a empezar la escena actual.', ejemplo: 'cuando toca(otro):\n    si otro.es("Pinchos"):\n        reiniciar_nivel()' },
  { nombre: 'cambiar_escena', firma: 'cambiar_escena(nombre)', categoria: 'Juego', motor: true, descripcion: 'Pasa a otra escena del proyecto.', ejemplo: 'cambiar_escena("nivel2")' },
  { nombre: 'tiempo', firma: 'tiempo()', categoria: 'Juego', motor: true, descripcion: 'Segundos que han pasado desde que empezó la escena.', ejemplo: 'mostrar(tiempo())' },
  { nombre: 'guardar', firma: 'guardar(clave, valor)', categoria: 'Juego', motor: true, descripcion: 'Guarda un dato que se mantiene aunque se cierre el juego.', ejemplo: 'guardar("record", puntos)' },
  { nombre: 'cargar', firma: 'cargar(clave, por_defecto)', categoria: 'Juego', motor: true, descripcion: 'Recupera un dato guardado con «guardar».', ejemplo: 'variable record = cargar("record", 0)' },
  { nombre: 'temblar_camara', firma: 'temblar_camara(fuerza, segundos)', categoria: 'Juego', motor: true, descripcion: 'Hace temblar la cámara. Da mucha sensación de impacto.', ejemplo: 'temblar_camara(8, 0.3)' },
  { nombre: 'calidad_grafica', firma: 'calidad_grafica(nivel)', categoria: 'Juego', motor: true, descripcion: 'Cambia la calidad gráfica en 3D ("automatica", "baja", "media", "alta" o "ultra") y devuelve la que se está usando. Útil para un menú de opciones.', ejemplo: 'cuando hace_clic():\n    calidad_grafica("alta")' },
  { nombre: 'pausar_juego', firma: 'pausar_juego(sí/no)', categoria: 'Juego', motor: true, descripcion: 'Pausa o reanuda el juego.', ejemplo: 'si se_pulsa("pausa"):\n    pausar_juego(verdadero)' },
  // Escena
  { nombre: 'nodo', firma: 'nodo(nombre)', categoria: 'Escena', motor: true, descripcion: 'Busca un nodo de la escena por su nombre.', ejemplo: 'variable puerta = nodo("Puerta")' },
  { nombre: 'grupo', firma: 'grupo(nombre)', categoria: 'Escena', motor: true, descripcion: 'Lista de todos los nodos que están en un grupo.', ejemplo: 'para cada e en grupo("enemigos"):\n    e.eliminar()' },
  { nombre: 'crear', firma: 'crear(plantilla, x, y)', categoria: 'Escena', motor: true, descripcion: 'Crea una copia de un nodo (por su nombre) o de una escena (.fscn) en esa posición.', ejemplo: 'crear("Moneda", 300, 120)' },
  { nombre: 'emitir', firma: 'emitir(señal, datos)', categoria: 'Escena', motor: true, descripcion: 'Envía una señal a todos los scripts; la reciben con «cuando recibe(...)».', ejemplo: 'emitir("abrir_puerta")' },
  // Sonido
  { nombre: 'sonar', firma: 'sonar(sonido, volumen)', categoria: 'Sonido', motor: true, descripcion: 'Reproduce un efecto de sonido del proyecto.', ejemplo: 'sonar("salto.wav")' },
  { nombre: 'musica', firma: 'musica(nombre)', categoria: 'Sonido', motor: true, descripcion: 'Pone música de fondo en bucle.', ejemplo: 'musica("tema.ogg")' },
  { nombre: 'parar_musica', firma: 'parar_musica()', categoria: 'Sonido', motor: true, descripcion: 'Para la música de fondo.', ejemplo: 'parar_musica()' },
];

export const METODOS_LISTA = [
  { nombre: 'añadir', firma: 'añadir(valor)', descripcion: 'Añade un elemento al final.' },
  { nombre: 'quitar', firma: 'quitar(valor)', descripcion: 'Quita la primera aparición de un valor.' },
  { nombre: 'quitar_en', firma: 'quitar_en(posición)', descripcion: 'Quita el elemento de esa posición y lo devuelve.' },
  { nombre: 'insertar', firma: 'insertar(posición, valor)', descripcion: 'Mete un elemento en una posición.' },
  { nombre: 'contiene', firma: 'contiene(valor)', descripcion: 'Verdadero si el valor está en la lista.' },
  { nombre: 'posicion_de', firma: 'posicion_de(valor)', descripcion: 'En qué posición está el valor (-1 si no está).' },
  { nombre: 'largo', firma: 'largo', descripcion: 'Cuántos elementos tiene.' },
  { nombre: 'primero', firma: 'primero', descripcion: 'El primer elemento.' },
  { nombre: 'ultimo', firma: 'ultimo', descripcion: 'El último elemento.' },
  { nombre: 'vaciar', firma: 'vaciar()', descripcion: 'Quita todos los elementos.' },
  { nombre: 'ordenar', firma: 'ordenar()', descripcion: 'Ordena la lista de menor a mayor.' },
  { nombre: 'invertir', firma: 'invertir()', descripcion: 'Le da la vuelta a la lista.' },
  { nombre: 'mezclar', firma: 'mezclar()', descripcion: 'Desordena la lista al azar.' },
  { nombre: 'copiar', firma: 'copiar()', descripcion: 'Una copia de la lista.' },
  { nombre: 'unir', firma: 'unir(separador)', descripcion: 'Une los elementos en un texto.' },
];

export const METODOS_TEXTO = [
  { nombre: 'largo', firma: 'largo', descripcion: 'Cuántas letras tiene.' },
  { nombre: 'mayusculas', firma: 'mayusculas()', descripcion: 'EL TEXTO EN MAYÚSCULAS.' },
  { nombre: 'minusculas', firma: 'minusculas()', descripcion: 'el texto en minúsculas.' },
  { nombre: 'contiene', firma: 'contiene(texto)', descripcion: 'Verdadero si contiene ese texto.' },
  { nombre: 'empieza_por', firma: 'empieza_por(texto)', descripcion: 'Verdadero si empieza por ese texto.' },
  { nombre: 'termina_en', firma: 'termina_en(texto)', descripcion: 'Verdadero si termina en ese texto.' },
  { nombre: 'reemplazar', firma: 'reemplazar(buscar, poner)', descripcion: 'Cambia un trozo de texto por otro.' },
  { nombre: 'dividir', firma: 'dividir(separador)', descripcion: 'Parte el texto en una lista.' },
  { nombre: 'recortar', firma: 'recortar()', descripcion: 'Quita los espacios del principio y del final.' },
  { nombre: 'repetir', firma: 'repetir(veces)', descripcion: 'Repite el texto varias veces.' },
];

export const METODOS_DICCIONARIO = [
  { nombre: 'claves', firma: 'claves()', descripcion: 'Lista con todas las claves.' },
  { nombre: 'valores', firma: 'valores()', descripcion: 'Lista con todos los valores.' },
  { nombre: 'contiene', firma: 'contiene(clave)', descripcion: 'Verdadero si existe esa clave.' },
  { nombre: 'quitar', firma: 'quitar(clave)', descripcion: 'Quita una clave.' },
  { nombre: 'largo', firma: 'largo', descripcion: 'Cuántas claves tiene.' },
];

const rad = (g) => g * Math.PI / 180;

function aplanar(args) { return args.length === 1 && Array.isArray(args[0]) ? args[0] : args; }

// Funciones nativas que no dependen del motor.
export function crearNativasBasicas(interp, salida) {
  return {
    mostrar: (...a) => { salida(a.map(x => aTexto(x)).join(' ')); return null; },
    largo: (v) => {
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (v instanceof Map) return v.size;
      throw errorNativo(`«largo» no sabe medir un valor de tipo ${tipoDe(v)}.`, 'Funciona con listas, textos y diccionarios.');
    },
    texto: (v) => aTexto(v),
    numero: (v) => {
      if (typeof v === 'number') return v;
      const n = Number(String(v).replace(',', '.').trim());
      if (Number.isNaN(n)) throw errorNativo(`«${aTexto(v)}» no es un número.`, 'El texto tiene que contener solo cifras, como "42" o "3.5".');
      return n;
    },
    entero: (v) => Math.trunc(typeof v === 'number' ? v : Number(v) || 0),
    tipo_de: (v) => tipoDe(v),
    aleatorio: (a, b) => {
      if (a === undefined) return Math.random();
      if (b === undefined) { b = a; a = 0; }
      num(a, 'aleatorio', 'mínimo'); num(b, 'aleatorio', 'máximo');
      return a + Math.random() * (b - a);
    },
    aleatorio_entero: (a, b) => {
      num(a, 'aleatorio_entero', 'mínimo');
      if (b === undefined) { b = a; a = 0; }
      num(b, 'aleatorio_entero', 'máximo');
      return Math.floor(a + Math.random() * (Math.floor(b) - Math.ceil(a) + 1));
    },
    elegir: (l) => {
      if (!Array.isArray(l) || !l.length) throw errorNativo('«elegir» necesita una lista con algún elemento.');
      return l[Math.floor(Math.random() * l.length)];
    },
    redondear: (n, d = 0) => { num(n, 'redondear'); const f = 10 ** d; return Math.round(n * f) / f; },
    redondear_abajo: (n) => Math.floor(num(n, 'redondear_abajo')),
    redondear_arriba: (n) => Math.ceil(num(n, 'redondear_arriba')),
    abs: (n) => Math.abs(num(n, 'abs')),
    min: (...a) => Math.min(...aplanar(a).map(x => num(x, 'min'))),
    max: (...a) => Math.max(...aplanar(a).map(x => num(x, 'max'))),
    limitar: (v, a, b) => Math.min(Math.max(num(v, 'limitar'), num(a, 'limitar')), num(b, 'limitar')),
    interpolar: (a, b, t) => num(a, 'interpolar') + (num(b, 'interpolar') - a) * num(t, 'interpolar'),
    mezclar_color: (a, b, t) => {
      const leer = (c) => {
        const h = String(c).trim().replace('#', '');
        if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) throw errorNativo(`«mezclar_color» necesita colores como "#FFAA00" y ha recibido ${JSON.stringify(c)}.`);
        const x = h.length === 3 ? h.split('').map(d => d + d).join('') : h;
        return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
      };
      const ca = leer(a), cb = leer(b), k = Math.min(1, Math.max(0, num(t, 'mezclar_color')));
      return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, '0')).join('').toUpperCase();
    },
    signo: (n) => Math.sign(num(n, 'signo')),
    raiz: (n) => { num(n, 'raiz'); if (n < 0) throw errorNativo('no existe la raíz de un número negativo.'); return Math.sqrt(n); },
    potencia: (a, b) => num(a, 'potencia') ** num(b, 'potencia'),
    seno: (g) => Math.sin(rad(num(g, 'seno'))),
    coseno: (g) => Math.cos(rad(num(g, 'coseno'))),
    tangente: (g) => Math.tan(rad(num(g, 'tangente'))),
    angulo_hacia: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI,
    pi: Math.PI,
    rango: (a, b, paso = 1) => {
      if (b === undefined) { b = num(a, 'rango'); a = 0; }
      num(a, 'rango'); num(b, 'rango'); num(paso, 'rango');
      if (paso === 0) throw errorNativo('el paso de «rango» no puede ser 0.');
      const r = [];
      if (paso > 0) for (let i = a; i < b; i += paso) r.push(i);
      else for (let i = a; i > b; i += paso) r.push(i);
      if (r.length > 1_000_000) throw errorNativo('ese rango es demasiado grande.');
      return r;
    },
    verdad: (v) => esVerdad(v),
  };
}

// Métodos y propiedades de listas, textos y diccionarios: «lista.añadir(3)».
export function miembrosNativos(obj, nombre, interp) {
  const llamar = (f, args) => interp.llamarValor(f, args, null);
  if (Array.isArray(obj)) {
    switch (nombre) {
      case 'largo': case 'longitud': return obj.length;
      case 'primero': return obj.length ? obj[0] : null;
      case 'ultimo': case 'último': return obj.length ? obj[obj.length - 1] : null;
      case 'añadir': case 'agregar': return (v) => { obj.push(v); return null; };
      case 'quitar': return (v) => { const i = obj.findIndex(x => x === v || interp.operar('==', x, v)); if (i >= 0) obj.splice(i, 1); return i >= 0; };
      case 'quitar_en': return (i) => { const k = i < 0 ? obj.length + i : i; if (k < 0 || k >= obj.length) throw errorNativo(`la posición ${i} está fuera de la lista.`); return obj.splice(k, 1)[0]; };
      case 'insertar': return (i, v) => { obj.splice(i, 0, v); return null; };
      case 'contiene': return (v) => obj.some(x => interp.operar('==', x, v));
      case 'posicion_de': case 'posición_de': return (v) => obj.findIndex(x => interp.operar('==', x, v));
      case 'vaciar': return () => { obj.length = 0; return null; };
      case 'ordenar': return (clave) => {
        if (clave instanceof FuncionAguila || typeof clave === 'function') obj.sort((a, b) => { const x = llamar(clave, [a]), y = llamar(clave, [b]); return x < y ? -1 : x > y ? 1 : 0; });
        else obj.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        return obj;
      };
      case 'invertir': return () => obj.reverse();
      case 'mezclar': return () => { for (let i = obj.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [obj[i], obj[j]] = [obj[j], obj[i]]; } return obj; };
      case 'copiar': return () => obj.slice();
      case 'unir': return (sep = '') => obj.map(x => aTexto(x)).join(sep);
      case 'filtrar': return (f) => obj.filter(x => esVerdad(llamar(f, [x])));
      case 'transformar': return (f) => obj.map(x => llamar(f, [x]));
    }
    return undefined;
  }
  if (typeof obj === 'string') {
    switch (nombre) {
      case 'largo': case 'longitud': return obj.length;
      case 'mayusculas': case 'mayúsculas': return () => obj.toUpperCase();
      case 'minusculas': case 'minúsculas': return () => obj.toLowerCase();
      case 'contiene': return (t) => obj.includes(aTexto(t));
      case 'empieza_por': return (t) => obj.startsWith(aTexto(t));
      case 'termina_en': return (t) => obj.endsWith(aTexto(t));
      case 'reemplazar': return (a, b) => obj.split(aTexto(a)).join(aTexto(b));
      case 'dividir': return (sep = ' ') => obj.split(aTexto(sep));
      case 'recortar': return () => obj.trim();
      case 'repetir': return (n) => obj.repeat(Math.max(0, n));
    }
    return undefined;
  }
  if (obj instanceof Map) {
    switch (nombre) {
      case 'claves': return () => [...obj.keys()];
      case 'valores': return () => [...obj.values()];
      case 'contiene': return (k) => obj.has(k);
      case 'quitar': return (k) => obj.delete(k);
      case 'largo': return obj.size;
    }
    return undefined;
  }
  return undefined;
}

