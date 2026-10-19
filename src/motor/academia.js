// Un laboratorio ejecutable por cada bloque del catálogo, incluida la entrada de función.
import { NODOS, CATEGORIAS, blueprintVacio, compilarBlueprint, pinesDe } from './blueprints.js';
import { crearNodo } from './tipos.js';
import { datosProyecto, escenaVacia } from './proyecto.js';
import { sintetizar } from './generadores.js';

const N = (tipo, nombre, props = {}, hijos = [], extra = {}) => Object.assign(crearNodo(tipo, nombre, props, hijos), extra);
const label = (nombre, texto, x, y, tam = 18, color = '#E7EDE9') => N('Etiqueta', nombre, { texto, posicion: [x, y], tam, color });
const button = (texto, escena, x, y, ancho = 220) => N('Boton', texto, { texto, escena, posicion: [x, y], ancho, alto: 38 });
const textoLineas = (texto, x, y, ancho = 82) => {
  const lineas = texto.match(new RegExp(`.{1,${ancho}}(?:\\s|$)|.{1,${ancho}}`, 'g')) || [];
  return lineas.map((t, i) => label('Lectura' + i, t.trim(), x, y + i * 24, 16));
};

// Valor de prueba, resultado verificable y ejercicio; la ayuda y los pines se toman del catálogo real.
const CASOS = {
  ev_empieza: ['Se escribe al cargar, una sola vez.', 'Reinicia y compara con Al actualizar.'],
  ev_actualizar: ['El resultado muestra delta en segundos, cambiando cada fotograma.', 'Multiplica delta por 60 y observa la diferencia.'],
  ev_tocar: ['Camina hasta la baliza amarilla: muestra el objeto que entra.', 'Filtra otro con Es… Jugador.'],
  ev_dejar: ['Entra y sal de la baliza: muestra el objeto que sale.', 'Combina entrar y salir para abrir y cerrar una puerta.'],
  ev_pulsar: ['Pulsa E: una ejecución por pulsación.', 'Cambia la acción a saltar.'],
  ev_soltar: ['Mantén E y suéltala: la ejecución ocurre al soltar.', 'Compara con Acción mantenida.'],
  ev_recibir: ['Pulsa E: otro Blueprint emite abrir y este lo recibe.', 'Cambia abrir en ambos grafos para crear otra señal.'],
  ev_clic: ['Haz clic en el botón del laboratorio.', 'Conecta Cambiar texto después del clic.'],
  ev_termina: ['Cada dos segundos el Temporizador avisa al terminar.', 'Desactiva Repetir en el Temporizador.'],
  fn_entrada: ['E llama saludar; la entrada recibe cantidad = 7.', 'Añade un segundo parámetro y conéctalo.'],
  in_pulsada: ['Pulsa E: la acción accion es verdadera ese fotograma.', 'Lee saltar mientras mantienes Espacio.'],
  in_mantenida: ['Mantén Mayús y pulsa E: muestra verdadero.', 'Suelta Mayús y repite.'],
  in_eje: ['Mantén A o D y pulsa E: -1 o 1; sin teclas: 0.', 'Multiplica el eje por 180 y úsalo en Mover.'],
  in_raton: ['Mueve el ratón y pulsa E: muestra X e Y del mundo.', 'Usa esos datos en Colocar en.'],
  in_clic: ['Mantén clic y pulsa E para obtener verdadero.', 'Suelta clic y repite.'],
  mv_mover: ['Mantén E: el personaje avanza a 180 píxeles/segundo.', 'Conecta Eje multiplicado por una variable velocidad.'],
  mv_saltar: ['E impulsa al personaje hacia arriba con fuerza 420.', 'Añade Si y En el suelo para evitar saltos en el aire.'],
  mv_suelo: ['E muestra si el personaje está apoyado.', 'Salta con Espacio y comprueba durante el salto.'],
  mv_posicion: ['E muestra X e Y del personaje.', 'Conecta Nodo por nombre para leer la baliza.'],
  mv_fijar: ['E coloca al personaje en (700, 480).', 'Conecta Posición del ratón.'],
  mv_desplazar: ['Cada E desplaza 60 píxeles a la derecha.', 'Prueba -60 para volver; no es velocidad por segundo.'],
  mv_empujar: ['E aplica un impulso horizontal y vertical.', 'Compara con Mover y con Colocar en.'],
  lg_si: ['E evalúa 10 >= 5 y elige la rama verdadera.', 'Cambia b a 15 para ejecutar la rama falsa.'],
  lg_y: ['verdadero Y falso produce falso.', 'Sustituye las entradas por En suelo y Acción pulsada.'],
  lg_o: ['verdadero O falso produce verdadero.', 'Usa dos acciones para abrir la misma puerta.'],
  lg_no: ['NO falso produce verdadero.', 'Invierte En el suelo para detectar el aire.'],
  lg_comparar: ['10 >= 5 produce verdadero.', 'Prueba los seis operadores con valores iguales.'],
  lg_es: ['La baliza pertenece al grupo objetivos: produce verdadero.', 'Prueba su nombre Baliza y su tipo Area2D.'],
  lg_secuencia: ['E escribe Primero y después Después, en ese orden.', 'Añade un sonido en la primera rama.'],
  lg_repetir: ['E escribe las vueltas 0, 1, 2 y después Fin.', 'Cambia veces a 5 y conecta el índice al marcador.'],
  lg_mientras: ['E cuenta 3, 2, 1; resta uno en cada vuelta y termina en cero.', 'Conserva siempre una condición de salida.'],
  lg_esperar: ['E espera un segundo y muestra Listo sin detener el juego.', 'Mueve al jugador mientras esperas.'],
  mt_numero: ['El número constante es 12.', 'Cambia su valor en el bloque.'],
  mt_sumar: ['12 + 3 = 15.', 'Conecta el resultado a Ganar puntos.'],
  mt_restar: ['12 - 3 = 9.', 'Úsalo para calcular daño.'],
  mt_multiplicar: ['12 × 3 = 36.', 'Multiplica velocidad por un eje de entrada.'],
  mt_dividir: ['12 / 3 = 4.', 'Evita un divisor cero.'],
  mt_aleatorio: ['E genera un valor entre 1 y 6.', 'Repite para observar el rango; no es necesariamente entero.'],
  mt_limitar: ['150 limitado entre 0 y 100 produce 100.', 'Limita una variable vida después de curarla.'],
  mt_distancia: ['E mide la distancia del jugador a la baliza.', 'Compara el resultado con 100 para interactuar cerca.'],
  var_obtener: ['E lee contador = 3.', 'Cambia el valor inicial de la variable.'],
  var_fijar: ['E reemplaza contador por 20 y lo muestra.', 'Observa la diferencia con Sumar a variable.'],
  var_sumar: ['Cada E añade 1: 4, 5, 6…', 'Usa -1 para gastar munición.'],
  ob_leer: ['E lee la coordenada x real del personaje.', 'Conecta Nodo por nombre y lee la propiedad visible de Baliza.'],
  ob_fijar: ['E oculta la baliza cambiando visible a falso.', 'Cambia el valor a verdadero para mostrarla.'],
  ob_consultar: ['E consulta en_el_suelo() del personaje.', 'Consulta distancia_a con Baliza como primer argumento.'],
  ob_llamar: ['E ejecuta saltar(420) sobre el personaje.', 'Conecta otro personaje a objeto y compara los resultados.'],
  fn_llamar: ['E llama saludar con cantidad = 7.', 'Abre la pestaña de función y cambia el parámetro.'],
  fn_devolver: ['La función muestra 7 y Devolver termina su ejecución.', 'Conecta un valor al retorno y revisa el código generado.'],
  es_yo: ['E muestra el propio nodo de laboratorio.', 'Conéctalo a Distancia junto a la baliza.'],
  es_nodo: ['E busca Baliza y muestra ese objeto.', 'Los nombres deben existir en la escena.'],
  es_mostrar: ['E escribe un mensaje en la Salida del editor.', 'Usa Cambiar texto cuando quieras un mensaje dentro del juego.'],
  es_eliminar: ['E elimina la baliza; reinicia el laboratorio para recuperarla.', 'Conecta Yo si quieres eliminar el propio nodo.'],
  es_crear: ['E copia la baliza oculta Plantilla en (800, 490).', 'Cambia las coordenadas y crea varias copias.'],
  es_ganar: ['E termina esta prueba con victoria.', 'Vuelve a ejecutar para continuar aprendiendo.'],
  es_perder: ['E termina esta prueba con derrota.', 'Conecta una condición de vida <= 0 antes de perder.'],
  es_reiniciar: ['E recarga el laboratorio y restaura la baliza.', 'Mueve al personaje antes de reiniciar.'],
  es_puntos: ['Cada E suma 10 al marcador de esta prueba.', 'Conecta una variable cantidad.'],
  es_emitir: ['E emite abrir; un segundo Blueprint confirma la recepción.', 'Abre blueprints/receptor.bp y compara los nombres.'],
  es_escena: ['E cambia al mapa de llegada; allí puedes volver al índice.', 'Usa la ruta de otra escena de tu proyecto.'],
  es_temblar: ['E sacude la cámara durante 0,3 segundos.', 'Prueba fuerza 2 y después 10.'],
  tx_texto: ['E muestra el literal Hola, Falcon.', 'Cambia el texto manteniendo los demás bloques.'],
  tx_unir: ['Une Vida: y el número 75 → Vida: 75.', 'Conecta una variable en lugar del número fijo.'],
  tx_fijar: ['E cambia el contenido de la etiqueta Resultado.', 'Usa el nombre exacto de otra etiqueta.'],
  au_sonar: ['E reproduce el sonido sintetizado golpe.wav.', 'Cambia el volumen de 0,5 a 0,2.'],
  au_musica: ['E inicia tema.wav en bucle; Q la detiene.', 'Vuelve a pulsar E para reanudar.'],
  au_parar: ['La música empieza al cargar; E la detiene.', 'Compara música en bucle y efecto de sonido.'],
};

function grafo(bp, clave = 'eventos') {
  const g = bp.grafos[clave] ||= { nodos: [], conexiones: [], comentarios: [] };
  return {
    n(def, valores = {}, extra = {}) {
      const i = g.nodos.length;
      const n = { id: clave + '_' + i, def, x: 50 + (i % 4) * 280, y: 60 + Math.floor(i / 4) * 230, valores, ...extra };
      g.nodos.push(n); return n;
    },
    c(a, salida, b, entrada = 'entrada') { g.conexiones.push({ de: a.id, salida, a: b.id, entrada }); },
    comentario(texto) { g.comentarios.push({ id: 'guia', x: 40, y: -160, ancho: 1050, alto: 170, texto }); },
  };
}

function ordenarEjemplo(bp) {
  for (const g of Object.values(bp.grafos)) {
    const porId = new Map(g.nodos.map(n => [n.id, n]));
    const cola = g.nodos.filter(n => NODOS[n.def].esEvento).map((n, i) => ({ n, nivel: 0, fila: i }));
    const vistos = new Set(); let filaDatos = 0;
    while (cola.length) {
      const { n, nivel, fila } = cola.shift(); if (vistos.has(n.id)) continue;
      vistos.add(n.id); n.x = 40 + nivel * 300; n.y = 80 + fila * 220;
      const salidas = pinesDe(n, bp).salidas.filter(p => p.t === 'exec');
      salidas.forEach((p, i) => {
        const c = g.conexiones.find(c => c.de === n.id && c.salida === p.n);
        if (c) cola.push({ n: porId.get(c.a), nivel: nivel + 1, fila: fila + i });
      });
    }
    const suelo = Math.max(320, ...g.nodos.filter(n => vistos.has(n.id)).map(n => n.y + 230));
    for (const n of g.nodos) if (!vistos.has(n.id)) {
      n.x = 40 + (filaDatos % 4) * 300; n.y = suelo + Math.floor(filaDatos / 4) * 240; filaDatos++;
    }
  }
  return bp;
}

export function ejemploBloque(id) {
  const d = NODOS[id];
  if (!CASOS[id]) throw new Error('Falta la lección del bloque ' + id);
  const bp = blueprintVacio(id, 'Personaje2D');
  bp.variables = [{ nombre: 'contador', tipo: 'entero', valor: 3, exportar: true }];
  const g = grafo(bp);
  g.comentario(`${d.titulo}: ${d.ayuda}\nPRUEBA: ${CASOS[id][0]}\nRETO: ${CASOS[id][1]}\nBlanco = ejecución; colores = datos. Abre generado/${id}.agl para ver Águila.`);
  const informar = (mensaje) => g.n('tx_fijar', { nodo: 'Resultado', texto: mensaje });
  const valores = {
    in_pulsada: { accion: 'accion' }, in_mantenida: { accion: 'correr' }, mv_mover: { x: 180 },
    mv_fijar: { x: 700, y: 480 }, mv_desplazar: { x: 60 }, mv_empujar: { x: 180, y: -300 },
    lg_comparar: { a: 10, b: 5, op: '>=' }, lg_y: { a: true, b: false }, lg_o: { a: true, b: false },
    mt_numero: { valor: 12 }, mt_sumar: { a: 12, b: 3 }, mt_restar: { a: 12, b: 3 },
    mt_multiplicar: { a: 12, b: 3 }, mt_dividir: { a: 12, b: 3 }, mt_aleatorio: { min: 1, max: 6 },
    mt_limitar: { valor: 150, min: 0, max: 100 }, es_nodo: { nombre: 'Baliza' }, lg_es: { nombre: 'objetivos' },
    var_fijar: { valor: 20 }, tx_texto: { valor: 'Hola, Falcon.' }, tx_unir: { a: 'Vida: ', b: 75 },
    tx_fijar: { nodo: 'Resultado', texto: '¡Texto actualizado!' }, au_sonar: { sonido: 'golpe.wav', volumen: 0.5 },
    au_musica: { musica: 'tema.wav' }, es_crear: { plantilla: 'Plantilla', x: 800, y: 490 },
    es_escena: { escena: 'escenas/llegada.fscn' }, es_emitir: { senal: 'abrir' },
    ev_recibir: { senal: 'abrir' }, ev_pulsar: { accion: 'accion' }, ev_soltar: { accion: 'accion' },
    ob_leer: { miembro: 'x' }, ob_fijar: { miembro: 'visible', valor: false },
    ob_consultar: { miembro: 'en_el_suelo' }, ob_llamar: { miembro: 'saltar', a: 420 },
  };
  if (id.startsWith('fn_')) {
    bp.funciones = [{ nombre: 'saludar', params: [{ nombre: 'cantidad', tipo: 'entero' }] }];
    const e = g.n('ev_pulsar', { accion: 'accion' });
    const f = g.n('fn_llamar', { cantidad: 7 }, { funcion: 'saludar' }); g.c(e, 'salida', f);
    const h = grafo(bp, 'fn:saludar');
    const en = h.n('fn_entrada', {}, { funcion: 'saludar' });
    const msg = h.n('tx_fijar', { nodo: 'Resultado' });
    const ret = h.n('fn_devolver');
    h.c(en, 'salida', msg); h.c(en, 'cantidad', msg, 'texto'); h.c(msg, 'salida', ret);
    h.comentario('Parámetro cantidad → Resultado. Devolver finaliza la función. La flecha no devuelve un dato al bloque de llamada.');
    return ordenarEjemplo(bp);
  }
  const n = g.n(id, valores[id] || {}, id.startsWith('var_') ? { variable: 'contador' } : {});
  const fin = informar('Ejecutado: ' + d.titulo);
  if (d.esEvento) {
    g.c(n, 'salida', fin);
    const dato = d.salidas.find(p => p.t !== 'exec');
    if (dato) g.c(n, dato.n, fin, 'texto');
  } else {
    const e = g.n(id === 'mv_mover' ? 'ev_actualizar' : 'ev_pulsar', { accion: 'accion' });
    if (!d.exec) {
      const pin = pinesDe(n, bp).salidas[0]; g.c(e, 'salida', fin); g.c(n, pin.n, fin, 'texto');
      if (['in_raton', 'mv_posicion'].includes(id)) {
        const unir = g.n('tx_unir', { a: 'X: ' }); g.c(n, 'x', unir, 'b');
        const unirY = g.n('tx_unir', { b: ' · Y: ' }); g.c(unir, 'resultado', unirY, 'a');
        const ambos = g.n('tx_unir'); g.c(unirY, 'resultado', ambos, 'a'); g.c(n, 'y', ambos, 'b');
        bp.grafos.eventos.conexiones = bp.grafos.eventos.conexiones.filter(c => c.a !== fin.id || c.entrada !== 'texto');
        g.c(ambos, 'resultado', fin, 'texto');
      }
    } else {
      g.c(e, 'salida', n);
      if (id === 'mv_mover') {
        const si = g.n('lg_si'), tecla = g.n('in_mantenida', { accion: 'accion' });
        bp.grafos.eventos.conexiones = bp.grafos.eventos.conexiones.filter(c => !(c.de === e.id && c.a === n.id));
        g.c(e, 'salida', si); g.c(tecla, 'pulsada', si, 'condicion'); g.c(si, 'verdadero', n);
      }
      if (id === 'lg_si') {
        const cmp = g.n('lg_comparar', { a: 10, b: 5, op: '>=' });
        g.c(cmp, 'resultado', n, 'condicion'); g.c(n, 'verdadero', fin);
        const falso = informar('Rama falsa'); g.c(n, 'falso', falso);
      } else if (id === 'lg_secuencia') {
        const a = g.n('es_mostrar', { texto: 'Primero' }), b = g.n('es_mostrar', { texto: 'Después' });
        g.c(n, 'primero', a); g.c(n, 'despues', b); g.c(b, 'salida', fin);
      } else if (id === 'lg_repetir' || id === 'lg_mientras') {
        const ver = g.n('es_mostrar'); g.c(n, 'cuerpo', ver); g.c(n, 'salida', fin);
        if (id === 'lg_repetir') g.c(n, 'indice', ver, 'texto');
        else {
          const v = g.n('var_obtener', {}, { variable: 'contador' });
          const c = g.n('lg_comparar', { op: '>', b: 0 });
          const menos = g.n('var_sumar', { cantidad: -1 }, { variable: 'contador' });
          g.c(v, 'valor', c, 'a'); g.c(c, 'resultado', n, 'condicion');
          g.c(v, 'valor', ver, 'texto'); g.c(ver, 'salida', menos);
        }
      } else if (!['es_ganar', 'es_perder', 'es_reiniciar', 'es_escena', 'tx_fijar'].includes(id)) g.c(n, 'salida', fin);
      else bp.grafos.eventos.nodos.splice(bp.grafos.eventos.nodos.indexOf(fin), 1);
    }
  }
  if (['lg_es', 'mt_distancia', 'es_eliminar'].includes(id)) {
    const obj = g.n('es_nodo', { nombre: 'Baliza' }); g.c(obj, 'nodo', n, id === 'mt_distancia' ? 'b' : 'objeto');
  }
  if (id === 'ob_fijar') { const obj = g.n('es_nodo', { nombre: 'Baliza' }); g.c(obj, 'nodo', n, 'objeto'); }
  if (id === 'mt_distancia') { const yo = g.n('es_yo'); g.c(yo, 'yo', n, 'a'); }
  if (['var_fijar', 'var_sumar'].includes(id)) { const v = g.n('var_obtener', {}, { variable: 'contador' }); g.c(v, 'valor', fin, 'texto'); }
  return ordenarEjemplo(bp);
}

export function plantillaAcademia(nombre) {
  const archivos = {}, ids = Object.keys(NODOS);
  const datos = datosProyecto(nombre, '2D'); datos.gravedad = 1200;
  datos.acciones.indice = ['KeyH']; datos.acciones.repetir = ['KeyR']; datos.acciones.silencio = ['KeyQ'];
  datos.escena_principal = 'escenas/academia.fscn';
  const nav = '# Navegación independiente del Blueprint de demostración.\ncuando se_pulsa("indice"):\n    cambiar_escena("escenas/academia.fscn")\ncuando se_pulsa("repetir"):\n    reiniciar_nivel()\ncuando se_pulsa("silencio"):\n    parar_musica()\n';
  archivos['scripts/navegacion.agl'] = nav;
  const receptor = blueprintVacio('receptor', 'Nodo2D'), rg = grafo(receptor);
  const re = rg.n('ev_recibir', { senal: 'abrir' }), rm = rg.n('tx_fijar', { nodo: 'Resultado', texto: 'Señal abrir recibida' }); rg.c(re, 'salida', rm);
  archivos['blueprints/receptor.bp'] = receptor;
  archivos['scripts/emisor.agl'] = 'cuando se_pulsa("accion"):\n    emitir("abrir")\n';
  archivos['scripts/musica.agl'] = 'cuando empieza():\n    musica("tema.wav", 0.3)\n';
  archivos['scripts/puntos.agl'] = 'cuando se_actualiza(delta):\n    texto = "Puntos: " + texto(puntos)\n';
  const indice = [label('Titulo', 'ACADEMIA / BLUEPRINTS', 44, 24, 30), label('Intro', `${ids.length} laboratorios · todos los bloques de esta versión · selecciona una estación`, 44, 68, 17)];
  CATEGORIAS.forEach((cat, col) => {
    const x = 35 + (col % 3) * 416, y = 112 + Math.floor(col / 3) * 190;
    indice.push(label(cat.id, cat.id.toUpperCase(), x, y, 18, cat.color));
    ids.filter(id => NODOS[id].cat === cat.id).forEach((id, j) => {
      indice.push(N('Boton', id, { posicion: [x + (j % 2) * 198, y + 30 + Math.floor(j / 2) * 24], ancho: 190, alto: 22, texto: NODOS[id].titulo, escena: `escenas/${id}.fscn`, color: '#213C30', color_texto: '#E7EDE9' }));
    });
  });
  archivos['escenas/academia.fscn'] = escenaVacia('2D', N('Nodo2D', 'Academia', {}, [N('Interfaz', 'Índice', {}, indice)]));
  const manual = ['# Academia completa de Blueprints — Falcon Engine 1.2.0', '', 'Crea esta plantilla en el gestor, abre la escena principal y pulsa Jugar (F5). El índice da acceso directo a todos los laboratorios. H: índice; R: repetir; E: ejecutar; Q: parar música. Para victoria/derrota usa la opción de volver a jugar del reproductor.', '', 'Cada escena contiene el Blueprint editable en el nodo Laboratorio (o Baliza, Temporizador o botón para sus eventos). En el explorador abre blueprints/<id>.bp. Los comentarios explican el experimento. generado/<id>.agl permite comparar con Águila; edita el .bp, no el archivo generado.', '', '## Conceptos', '', 'Las flechas blancas marcan orden; los cables de color llevan datos y se evalúan cuando una acción los necesita. Los valores sin cable son constantes. Decimal y entero son compatibles. Variables pertenecen a cada instancia; exportadas se pueden ajustar en el Inspector. Una función tiene su propio grafo y parámetros; Devolver termina su ejecución. Los eventos de contacto necesitan colisión y un cuerpo que entre/salga. Mostrar escribe en Salida; Cambiar texto escribe en la interfaz.', '', 'Movimiento usa píxeles/segundo en 2D. Los bloques Mover, Posición y Colocar en de este catálogo tienen dos ejes: no constituyen una API completa de shooter 3D. La plantilla CQB usa los bloques generales Leer propiedad, Cambiar propiedad, Consultar método y Ejecutar método para controlar Z, disparos y visión desde Blueprints que compilan a Águila. Los recursos de audio se generan localmente sin descargas.', '', '## Recetas combinadas', '', 'Movimiento: Al actualizar → Mover; Eje × velocidad → velocidad x. Salto: Acción pulsada Y En suelo → Si → Saltar. Recogible: Al tocar → Es Jugador → Si → Ganar puntos → Eliminar. Puerta: Emitir abrir → Al recibir abrir → Desplazar. Vida: Restar daño → Limitar 0..100 → Fijar vida → Comparar <= 0 → Si → Perder. Después de cada receta, modifica una sola constante y comprueba el efecto.', ''];
  ids.forEach((id, i) => {
    const d = NODOS[id], bp = ejemploBloque(id), ruta = `blueprints/${id}.bp`;
    archivos[ruta] = bp; archivos[`generado/${id}.agl`] = compilarBlueprint(bp, ruta).codigo;
    const esContacto = ['ev_tocar', 'ev_dejar'].includes(id);
    const laboratorio = N('Personaje2D', 'Laboratorio', { posicion: [360, 490], controles: 'plataformas', velocidad: 180 }, [N('Sprite', 'Cuerpo', { ancho: 36, alto: 52, color: '#3DDC84', forma: 'rectangulo' }), N('Colision', 'Colisión', { ancho: 36, alto: 52 })], !esContacto && !['ev_clic', 'ev_termina'].includes(id) ? { blueprint: ruta } : {});
    const baliza = N('Area2D', 'Baliza', { posicion: [600, 490] }, [N('Sprite', 'BalizaVisual', { ancho: 55, alto: 75, color: '#F2B85C', forma: 'rectangulo' }), N('Colision', 'ColisiónBaliza', { ancho: 55, alto: 75 })], { grupos: ['objetivos'], ...(esContacto ? { blueprint: ruta } : {}) });
    const ui = [N('PanelUI', 'PanelLectura', { posicion: [20, 15], ancho: 1240, alto: 315, color: '#10271E' }), label('Título', `${String(i + 1).padStart(2, '0')} / ${ids.length} — ${d.titulo}`, 44, 34, 29), ...textoLineas(d.ayuda, 44, 82, 125), ...textoLineas('PRUEBA: ' + CASOS[id][0], 44, 144, 125), ...textoLineas('RETO: ' + CASOS[id][1], 44, 202, 125), label('Archivo', `${ruta}  |  ${d.cat}`, 44, 274, 15, '#4FD1C5'), label('Resultado', 'Resultado: esperando…', 44, 350, 22), label('Marcador', 'Puntos: 0', 1000, 350, 20)];
    ui[ui.length - 1].script = 'scripts/puntos.agl';
    ui.push(button('Índice / H', 'escenas/academia.fscn', 44, 632), button('Anterior', `escenas/${ids[(i + ids.length - 1) % ids.length]}.fscn`, 292, 632), button('Siguiente', `escenas/${ids[(i + 1) % ids.length]}.fscn`, 540, 632), label('Controles', 'A/D mover · Espacio saltar · E probar · R repetir · Q silencio', 44, 686, 16));
    if (id === 'ev_clic') ui.push(N('Boton', 'BotónLaboratorio', { texto: 'Pulsa para probar', posicion: [900, 490], ancho: 250 }, [], { blueprint: ruta }));
    const hijos = [N('Camara2D', 'Cámara', { posicion: [640, 360], seguir: '', suavizado: 0 }), laboratorio, baliza, N('Plataforma', 'Suelo', { posicion: [640, 550], ancho: 1280, alto: 30 }), N('Sprite', 'Plantilla', { posicion: [800, 490], ancho: 40, alto: 60, color: '#B39DFF' }, [], { visible: false }), N('Interfaz', 'Interfaz', {}, ui), N('Nodo2D', 'Navegación', {}, [], { script: 'scripts/navegacion.agl' })];
    if (id === 'ev_termina') hijos.push(N('Temporizador', 'Temporizador', { tiempo: 2, repetir: true, al_empezar: true }, [], { blueprint: ruta }));
    if (id === 'ev_recibir') hijos.push(N('Nodo2D', 'Emisor', {}, [], { script: 'scripts/emisor.agl' }));
    if (id === 'es_emitir') hijos.push(N('Nodo2D', 'Receptor', {}, [], { blueprint: 'blueprints/receptor.bp' }));
    if (id === 'au_parar') hijos.push(N('Nodo2D', 'MúsicaInicial', {}, [], { script: 'scripts/musica.agl' }));
    archivos[`escenas/${id}.fscn`] = escenaVacia('2D', N('Nodo2D', d.titulo, {}, hijos));
    const pines = pinesDe(Object.values(bp.grafos).flatMap(g => g.nodos).find(n => n.def === id), bp);
    manual.push(`## ${i + 1}. ${d.titulo} (${id})`, '', d.ayuda, '', `- Categoría: ${d.cat}. Archivo: ${ruta}.`, `- Entradas: ${pines.entradas.map(p => `${p.etq || p.n} (${p.t})`).join(', ') || 'ninguna'}.`, `- Salidas: ${pines.salidas.map(p => `${p.etq || p.n} (${p.t})`).join(', ') || 'ninguna'}.`, `- Prueba y resultado: ${CASOS[id][0]}`, `- Ejercicio: ${CASOS[id][1]}`, '');
  });
  archivos['escenas/llegada.fscn'] = escenaVacia('2D', N('Nodo2D', 'Llegada', {}, [N('Interfaz', 'Interfaz', {}, [label('Llegada', 'Cambio de escena completado', 100, 200, 32), button('Volver al índice', 'escenas/academia.fscn', 100, 300)])]));
  archivos['GUIA_BLUEPRINTS.md'] = manual.join('\n');
  archivos['cobertura-blueprints.json'] = { versionMotor: '1.2.0', bloques: ids.map(id => ({ id, escena: `escenas/${id}.fscn`, blueprint: `blueprints/${id}.bp` })) };
  archivos['sonidos/golpe.wav'] = sintetizar('golpe'); archivos['musica/tema.wav'] = sintetizar('tema');
  return { datos, archivos, carpetas: ['escenas', 'blueprints', 'scripts', 'generado', 'sonidos', 'musica'], abrir: ['escenas/academia.fscn'], importacion: {} };
}
