// Curso guiado «Mi primer juego» del modo Sencillo.
// Cada paso tiene una comprobación automática sobre el estado del editor (objeto «ed»).
//
// ed ofrece: seleccionado(), nodo(nombre), contar(predicado), blueprintDe(nombreNodo),
// scriptDe(nombreNodo), ocurrio(evento), valorVivo(nodo, variable)

const conexion = (bp, deDef, aDef) => {
  if (!bp) return false;
  const g = bp.grafos && bp.grafos.eventos;
  if (!g) return false;
  const porId = new Map(g.nodos.map(n => [n.id, n]));
  return g.conexiones.some(c => porId.get(c.de)?.def === deDef && porId.get(c.a)?.def === aDef);
};
const tieneNodo = (bp, def) => !!bp && (bp.grafos?.eventos?.nodos || []).some(n => n.def === def);

export const LECCIONES = [
  {
    id: 'conoce', titulo: 'Conoce tu nivel',
    descripcion: 'Antes de nada, aprende a moverte por el nivel y a probarlo.',
    pasos: [
      { texto: 'Arrastra el nivel con el ratón para moverte por él', pista: 'Mantén pulsado el botón izquierdo sobre una zona vacía y arrastra.', foco: '.visor-2d', comprobar: (ed) => ed.ocurrio('vista_movida') },
      { texto: 'Usa la rueda del ratón para acercar y alejar', pista: 'Gira la rueda con el puntero encima del nivel.', foco: '.visor-2d', comprobar: (ed) => ed.ocurrio('zoom') },
      { texto: 'Selecciona al Jugador en «Lo que hay en tu nivel»', pista: 'Está arriba a la izquierda, con un icono de persona.', foco: '[data-sencillo-nodo="Jugador"]', comprobar: (ed) => ed.seleccionado()?.nombre === 'Jugador', solucion: (ed) => ed.seleccionarPorNombre('Jugador') },
      { texto: 'Pulsa «Probar juego» y cierra la ventana cuando quieras', pista: 'Es el botón verde de arriba a la derecha. También puedes pulsar F5.', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('probado') },
    ],
    aguila: '# Todavía no hay código: ¡solo estamos mirando!',
  },
  {
    id: 'mover', titulo: 'Mueve a tu personaje',
    descripcion: 'Tu personaje ya sabe andar con las flechas. Ajusta lo rápido que va.',
    pasos: [
      { texto: 'Selecciona al Jugador', pista: 'Haz clic en «Jugador» en la lista de la izquierda o sobre el personaje.', foco: '[data-sencillo-nodo="Jugador"]', comprobar: (ed) => ed.seleccionado()?.nombre === 'Jugador', solucion: (ed) => ed.seleccionarPorNombre('Jugador') },
      { texto: 'Mueve el control «Velocidad al andar»', pista: 'Está en el panel del Jugador, debajo de la lista. Más a la derecha = más rápido.', foco: '[data-sencillo-prop="velocidad"]', comprobar: (ed) => ed.ocurrio('prop:velocidad') },
      { texto: 'Pulsa «Probar juego» y anda con ← y →', pista: 'Usa las flechas del teclado o A y D.', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:andar') },
    ],
    aguila: 'clase Jugador extiende Personaje2D:\n    exportar variable velocidad = 220',
  },
  {
    id: 'saltar', titulo: 'Haz que tu personaje salte',
    descripcion: 'Vas a crear tu primera regla: «cuando pulse Espacio, salta».',
    pasos: [
      { texto: 'Selecciona al Jugador en «Lo que hay en tu nivel»', pista: 'Es el primero de la lista.', foco: '[data-sencillo-nodo="Jugador"]', comprobar: (ed) => ed.seleccionado()?.nombre === 'Jugador', solucion: (ed) => ed.seleccionarPorNombre('Jugador') },
      { texto: 'Pulsa «Añadir Blueprint»', coach: 'Pulsa «Añadir Blueprint». Así le darás al jugador sus propias reglas, como saltar.', pista: 'Está en el panel del Jugador, en «Comportamiento».', foco: '[data-accion="anadir-blueprint"]', comprobar: (ed) => !!ed.blueprintDe('Jugador'), solucion: (ed) => ed.anadirBlueprintSencillo() },
      { texto: 'Une el bloque «Cuando se pulsa saltar» con el bloque «Saltar»', pista: 'Arrastra desde el triángulo blanco de la derecha de «Cuando se pulsa» hasta el triángulo de la izquierda de «Saltar».', comprobar: (ed) => { const bp = ed.blueprintDe('Jugador'); return conexion(bp, 'ev_pulsar', 'mv_saltar') || conexion(bp, 'ev_pulsar', 'lg_si'); }, solucion: (ed) => ed.conectarBloques('Jugador', 'ev_pulsar', 'salida', 'mv_saltar', 'entrada') },
      { texto: 'Pulsa «Probar juego» y salta con Espacio', pista: 'Si no salta, revisa que el cable esté bien unido.', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:salto') },
    ],
    aguila: 'cuando se_pulsa("saltar"):\n    saltar(altura_salto)',
  },
  {
    id: 'suelo', titulo: 'Salta solo desde el suelo',
    descripcion: 'Ahora puede saltar en el aire sin parar. Haz que solo salte si toca el suelo.',
    pasos: [
      { texto: 'Abre el Blueprint del Jugador', pista: 'Selecciona al Jugador y pulsa «Abrir Blueprint», o ve al modo Blueprints.', comprobar: (ed) => ed.ocurrio('blueprint_abierto'), solucion: (ed) => ed.abrirBlueprintDe('Jugador') },
      { texto: 'Añade los bloques «Si» (en Lógica) y «En el suelo» (en Movimiento)', pista: 'Pulsa Espacio dentro del grafo y escribe su nombre.', comprobar: (ed) => { const bp = ed.blueprintDe('Jugador'); return tieneNodo(bp, 'lg_si') && tieneNodo(bp, 'mv_suelo'); }, solucion: (ed) => ed.anadirBloques('Jugador', ['lg_si', 'mv_suelo']) },
      { texto: 'Conecta: «Cuando se pulsa» → «Si» → «Saltar», y «En el suelo» a la condición', pista: 'La salida «verdadero» del Si va a «Saltar». El punto rojo de «En el suelo» va a «condición».', comprobar: (ed) => { const bp = ed.blueprintDe('Jugador'); return conexion(bp, 'ev_pulsar', 'lg_si') && conexion(bp, 'lg_si', 'mv_saltar') && conexion(bp, 'mv_suelo', 'lg_si'); }, solucion: (ed) => ed.solucionSueloBlueprint('Jugador') },
      { texto: 'Prueba el juego: ya no podrás saltar en el aire', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:salto', 1) },
    ],
    aguila: 'cuando se_pulsa("saltar"):\n    si en_el_suelo():\n        saltar(altura_salto)',
  },
  {
    id: 'monedas', titulo: 'Recoge monedas',
    descripcion: 'Pon monedas en el nivel. Ya saben desaparecer cuando el jugador las toca.',
    pasos: [
      { texto: 'Pulsa «+ Añadir algo al nivel» y elige «Moneda»', pista: 'El botón está debajo de la lista del nivel.', foco: '[data-accion="anadir-sencillo"]', comprobar: (ed) => ed.ocurrio('anadido:Moneda'), solucion: (ed) => ed.anadirPrefab('moneda') },
      { texto: 'Arrastra la moneda a un sitio al que se pueda llegar saltando', pista: 'Haz clic en la moneda y arrástrala.', foco: '.visor-2d', comprobar: (ed) => ed.ocurrio('nodo_movido') },
      { texto: 'Prueba el juego y recoge una moneda', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:puntos') },
    ],
    aguila: 'cuando toca(otro):\n    si otro.es("Jugador"):\n        ganar_puntos(1)\n        yo.eliminar()',
  },
  {
    id: 'hola', titulo: 'Tu primera línea de Águila',
    descripcion: 'Los bloques y Águila hacen lo mismo. Prueba a escribir una orden.',
    pasos: [
      { texto: 'Selecciona al Jugador y pulsa «Escribir en Águila»', pista: 'El botón está bajo «Añadir Blueprint».', foco: '[data-accion="escribir-aguila"]', comprobar: (ed) => !!ed.scriptDe('Jugador'), solucion: (ed) => ed.crearScriptSencillo('Jugador') },
      { texto: 'Dentro de «cuando empieza():» escribe mostrar("¡Hola!")', pista: 'Escríbelo en la línea de debajo, con 4 espacios delante.', comprobar: (ed) => /cuando\s+empieza\(\)\s*:[\s\S]*mostrar\(/.test(ed.scriptDe('Jugador') || '') },
      { texto: 'Pulsa «Guardar y probar» y mira la Salida del editor', foco: '[data-accion="guardar-probar"]', comprobar: (ed) => ed.ocurrio('juego:mostrar') },
    ],
    aguila: 'cuando empieza():\n    mostrar("¡Hola!")',
  },
  {
    id: 'contar', titulo: 'Cuenta tus monedas',
    descripcion: 'Guarda cuántas monedas lleva el jugador en una variable.',
    pasos: [
      { texto: 'En el script del Jugador, añade arriba: variable monedas = 0', pista: 'Escríbelo en la primera línea, sin sangría.', comprobar: (ed) => /variable\s+monedas\s*=\s*0/.test(ed.scriptDe('Jugador') || '') },
      { texto: 'Añade un evento «cuando toca(otro):» que sume 1 a monedas', pista: 'Debajo escribe, con sangría: si otro.es("Moneda"): y después monedas = monedas + 1', comprobar: (ed) => /cuando\s+toca\(\s*\w+\s*\)\s*:[\s\S]*monedas\s*=\s*monedas\s*\+\s*1/.test(ed.scriptDe('Jugador') || '') },
      { texto: 'Prueba y fíjate en «Valores en vivo»: monedas sube', foco: '[data-accion="probar"]', comprobar: (ed) => (ed.valorVivo('Jugador', 'monedas') || 0) > 0 },
    ],
    aguila: 'variable monedas = 0\n\ncuando toca(otro):\n    si otro.es("Moneda"):\n        monedas = monedas + 1',
  },
  {
    id: 'pinchos', titulo: 'Cuidado con los pinchos',
    descripcion: 'Un juego necesita algún peligro. Los pinchos hacen volver a empezar.',
    pasos: [
      { texto: 'Añade «Pinchos» al nivel', pista: 'Usa «+ Añadir algo al nivel».', foco: '[data-accion="anadir-sencillo"]', comprobar: (ed) => ed.ocurrio('anadido:Pinchos'), solucion: (ed) => ed.anadirPrefab('pinchos') },
      { texto: 'Ponlos sobre el suelo, en el camino del jugador', foco: '.visor-2d', comprobar: (ed) => ed.ocurrio('nodo_movido') },
      { texto: 'Prueba el juego y tócalos a propósito', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:reinicio') },
    ],
    aguila: 'cuando toca(otro):\n    si otro.es("Jugador"):\n        reiniciar_nivel()',
  },
  {
    id: 'meta', titulo: 'Llega a la meta',
    descripcion: 'Pon una bandera al final: al tocarla, ¡ganas!',
    pasos: [
      { texto: 'Añade la «Meta» al nivel', foco: '[data-accion="anadir-sencillo"]', comprobar: (ed) => ed.ocurrio('anadido:Meta'), solucion: (ed) => ed.anadirPrefab('meta') },
      { texto: 'Llévala lejos del jugador, al final del camino', foco: '.visor-2d', comprobar: (ed) => { const m = ed.nodo('Meta'), j = ed.nodo('Jugador'); return !!m && !!j && Math.abs(m.props.posicion[0] - j.props.posicion[0]) > 300; } },
      { texto: 'Prueba el juego y llega hasta la bandera', foco: '[data-accion="probar"]', comprobar: (ed) => ed.ocurrio('juego:ganar') },
    ],
    aguila: 'cuando toca(otro):\n    si otro.es("Jugador"):\n        ganar_partida()',
  },
  {
    id: 'exportar', titulo: 'Comparte tu juego',
    descripcion: 'Convierte tu proyecto en un programa que cualquiera puede abrir.',
    pasos: [
      { texto: 'Pasa al modo Avanzado y abre Proyecto › Exportar juego…', pista: 'El interruptor Sencillo / Avanzado está arriba a la izquierda.', comprobar: (ed) => ed.ocurrio('exportar_abierto'), solucion: (ed) => ed.abrirExportar() },
      { texto: 'Elige tu sistema y pulsa «Exportar»', comprobar: (ed) => ed.ocurrio('exportado') },
    ],
    aguila: '# ¡Enhorabuena! Has terminado el curso.',
  },
];
