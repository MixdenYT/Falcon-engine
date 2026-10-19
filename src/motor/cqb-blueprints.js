// Autoría de grafos, no código de gameplay inyectado: todo lo producido aquí es
// editable en el editor y pasa por el compilador Blueprint → Águila habitual.
import { blueprintVacio, compilarBlueprint, NODOS } from './blueprints.js';

function autor(nombre, base, variables) {
  const bp = blueprintVacio(nombre, base);
  bp.variables = Object.entries(variables).map(([nombre, valor]) => ({ nombre, valor, tipo: typeof valor === 'boolean' ? 'bool' : typeof valor === 'number' ? 'decimal' : 'texto', exportar: false }));
  let g = bp.grafos.eventos;
  const n = (def, valores = {}, extra = {}) => {
    const i = g.nodos.length, nodo = { id: nombre + '_' + Object.keys(bp.grafos).indexOf(Object.entries(bp.grafos).find(([, v]) => v === g)?.[0]) + '_' + i, def, valores, x: 40 + i % 5 * 300, y: 80 + Math.floor(i / 5) * 220, ...extra };
    g.nodos.push(nodo); return nodo;
  };
  const conectar = (a, salida, b, entrada) => g.conexiones.push({ de: a.id, salida, a: b.id, entrada });
  const poner = (nodo, pin, v) => { if (v && typeof v === 'object' && v.nodo) conectar(v.nodo, v.pin, nodo, pin); else nodo.valores[pin] = v; return nodo; };
  const salida = (nodo, pin = 'valor') => ({ nodo, pin });
  const crear = (def, valores = {}, extra) => { const nodo = n(def, {}, extra); for (const [k, v] of Object.entries(valores)) poner(nodo, k, v); return nodo; };
  const secuencia = acciones => {
    acciones = acciones.filter(Boolean); if (!acciones.length) return null; if (acciones.length === 1) return acciones[0];
    const s = n('lg_secuencia'); conectar(s, 'primero', acciones[0], 'entrada'); conectar(s, 'despues', secuencia(acciones.slice(1)), 'entrada'); return s;
  };
  const expresion = (def, valores, pin = 'resultado') => salida(crear(def, valores), pin);
  const met = (def, miembro, args, objeto) => crear(def, { miembro, cantidad: String(args.length), ...Object.fromEntries(args.map((v, i) => [['a', 'b', 'c'][i], v])), ...(objeto ? { objeto } : {}) });
  const A = {
    bp,
    v: nombre => salida(n('var_obtener', {}, { variable: nombre })),
    objeto: nombre => salida(n('es_nodo', { nombre }), 'nodo'),
    prop: (miembro, objeto) => salida(crear('ob_leer', { miembro, ...(objeto ? { objeto } : {}) })),
    consulta: (miembro, args = [], objeto) => salida(met('ob_consultar', miembro, args, objeto)),
    llamar: (miembro, args = [], objeto) => met('ob_llamar', miembro, args, objeto),
    fijar: (variable, valor) => crear('var_fijar', { valor }, { variable }),
    sumar: (variable, cantidad) => crear('var_sumar', { cantidad }, { variable }),
    op: (a, op, b) => expresion('lg_comparar', { a, op, b }),
    y: (a, b) => expresion('lg_y', { a, b }),
    o: (a, b) => expresion('lg_o', { a, b }),
    no: valor => expresion('lg_no', { valor }),
    mas: (a, b) => expresion('mt_sumar', { a, b }),
    menos: (a, b) => expresion('mt_restar', { a, b }),
    limitar: (valor, min, max) => expresion('mt_limitar', { valor, min, max }),
    si: (condicion, verdadero, falso = []) => {
      const nodo = crear('lg_si', { condicion }), v = secuencia(verdadero), f = secuencia(falso);
      if (v) conectar(nodo, 'verdadero', v, 'entrada'); if (f) conectar(nodo, 'falso', f, 'entrada'); return nodo;
    },
    accion: (def, valores = {}) => crear(def, valores),
    evento: (def, valores, construir, comentario) => {
      const ev = n(def, valores), cuerpo = secuencia(construir(salida(ev, 'delta')));
      if (cuerpo) conectar(ev, 'salida', cuerpo, 'entrada');
      if (comentario) g.comentarios.push({ id: ev.id + '_guia', texto: comentario, x: ev.x, y: ev.y - 90, ancho: 750, alto: 80 });
    },
    funcion: (nombre, params, construir) => {
      bp.funciones.push({ nombre, params: params.map(nombre => ({ nombre, tipo: 'cualquiera' })) });
      const anterior = g; g = bp.grafos['fn:' + nombre] = { nodos: [], conexiones: [], comentarios: [] };
      const entrada = n('fn_entrada', {}, { funcion: nombre });
      const cuerpo = secuencia(construir(...params.map(p => salida(entrada, p)))); if (cuerpo) conectar(entrada, 'salida', cuerpo, 'entrada'); g = anterior;
    },
    fn: (funcion, valores = {}) => crear('fn_llamar', valores, { funcion }),
    terminar() {
      // Columnas por profundidad de ejecución; datos de cada grafo debajo de sus
      // ramas. Las funciones mantienen sus propias pestañas en el editor.
      for (const grafo of Object.values(bp.grafos)) {
        const porId = new Map(grafo.nodos.map(n => [n.id, n])), vistos = new Set(); let fila = 0;
        for (const raiz of grafo.nodos.filter(n => NODOS[n.def].esEvento)) {
          const cola = [[raiz, 0, fila]]; let ultima = fila;
          while (cola.length) {
            const [actual, col, f] = cola.shift(); if (vistos.has(actual.id)) continue; vistos.add(actual.id);
            actual.x = 40 + col * 300; actual.y = 80 + f * 200; ultima = Math.max(ultima, f);
            let rama = 0;
            for (const c of grafo.conexiones.filter(c => c.de === actual.id && NODOS[actual.def].salidas.some(p => p.n === c.salida && p.t === 'exec'))) cola.push([porId.get(c.a), col + 1, f + rama++]);
          }
          fila = ultima + 4;
        }
        let dato = 0;
        for (const nodo of grafo.nodos.filter(n => !vistos.has(n.id))) { nodo.x = 40 + dato % 5 * 300; nodo.y = 80 + fila * 200 + Math.floor(dato / 5) * 240; dato++; }
      }
      const r = compilarBlueprint(bp, nombre + '.bp');
      if (r.errores.length || r.avisos.length) throw Error(nombre + ': ' + JSON.stringify([...r.errores, ...r.avisos]));
      return bp;
    },
  };
  return A;
}

export function blueprintsCQB() {
  const archivos = {};
  const guardar = a => { const bp = a.terminar(); archivos['blueprints/' + bp.nombre + '.bp'] = bp; archivos['generado/' + bp.nombre + '.agl'] = compilarBlueprint(bp, bp.nombre + '.bp').codigo; };
  const p = autor('operador', 'Personaje3D', { vida: 100, municion: 24, reserva: 96, cargador_0: 24, cargador_1: 12, reserva_0: 96, reserva_1: 48, arma: 0, capacidad: 24, recargando: false, recarga: 0, enfriamiento: 0, transferencia: 0, bajas: 0, ayuda: false, ingles: false });
  const datoArma = campo => p.consulta('arma_dato', [campo, p.v('arma')]);
  p.evento('ev_empieza', {}, () => [p.llamar('equipar_arma', [0])], 'El inventario y la vida pertenecen al Blueprint, no al HUD. Disparo semiautomático: una pulsación por bala.');
  p.evento('ev_pulsar', { accion: 'disparar' }, () => [p.si(p.y(p.op(p.v('vida'), '>', 0), p.y(p.no(p.v('recargando')), p.y(p.op(p.v('enfriamiento'), '<=', 0), p.consulta('arma_libre')))), [
    p.si(p.op(p.v('municion'), '>', 0), [p.sumar('municion', -1), p.fijar('enfriamiento', datoArma('intervalo')), p.llamar('disparar_arma', [datoArma('dano'), datoArma('alcance')])]),
  ])]);
  p.evento('ev_pulsar', { accion: 'recargar' }, () => [p.si(p.y(p.no(p.v('recargando')), p.y(p.op(p.v('municion'), '<', p.v('capacidad')), p.op(p.v('reserva'), '>', 0))), [p.fijar('recargando', true), p.fijar('recarga', datoArma('recarga')), p.llamar('animar_3d', ['reload', datoArma('recarga')])])]);
  p.evento('ev_actualizar', {}, delta => [
    p.fijar('enfriamiento', p.limitar(p.menos(p.v('enfriamiento'), delta), 0, 10)),
    p.si(p.v('recargando'), [p.fijar('recarga', p.menos(p.v('recarga'), delta)), p.si(p.op(p.v('recarga'), '<=', 0), [p.fijar('transferencia', p.limitar(p.menos(p.v('capacidad'), p.v('municion')), 0, p.v('reserva'))), p.sumar('municion', p.v('transferencia')), p.sumar('reserva', p.menos(0, p.v('transferencia'))), p.fijar('recargando', false)])]),
  ], 'Recarga por tiempo de simulación, cancelable al cambiar de arma. Las dos reservas se conservan por separado.');
  p.funcion('seleccionar', ['nueva'], nueva => [p.si(p.op(p.v('arma'), '!=', nueva), [
    p.si(p.op(p.v('arma'), '==', 0), [p.fijar('cargador_0', p.v('municion')), p.fijar('reserva_0', p.v('reserva'))], [p.fijar('cargador_1', p.v('municion')), p.fijar('reserva_1', p.v('reserva'))]),
    p.fijar('arma', nueva), p.fijar('recargando', false), p.fijar('recarga', 0), p.fijar('enfriamiento', 0.4),
    p.si(p.op(p.v('arma'), '==', 0), [p.fijar('municion', p.v('cargador_0')), p.fijar('reserva', p.v('reserva_0'))], [p.fijar('municion', p.v('cargador_1')), p.fijar('reserva', p.v('reserva_1'))]),
    p.fijar('capacidad', datoArma('capacidad')), p.llamar('equipar_arma', [p.v('arma')]),
  ])]);
  p.evento('ev_pulsar', { accion: 'arma_1' }, () => [p.fn('seleccionar', { nueva: 0 })]);
  p.evento('ev_pulsar', { accion: 'arma_2' }, () => [p.fn('seleccionar', { nueva: 1 })]);
  p.evento('ev_pulsar', { accion: 'cambiar_arma' }, () => [p.fn('seleccionar', { nueva: p.menos(1, p.v('arma')) })]);
  p.evento('ev_pulsar', { accion: 'interactuar' }, () => [p.llamar('interactuar')]);
  for (const [accion, variable] of [['ayuda', 'ayuda'], ['idioma', 'ingles']]) p.evento('ev_pulsar', { accion }, () => [p.fijar(variable, p.no(p.v(variable)))]);
  p.funcion('recibir_dano', ['cantidad'], cantidad => [p.si(p.op(p.v('vida'), '>', 0), [p.fijar('vida', p.limitar(p.menos(p.v('vida'), cantidad), 0, 100)), p.llamar('animar_3d', ['hit', 0.25]), p.si(p.op(p.v('vida'), '<=', 0), [p.llamar('animar_3d', ['death', 5]), p.accion('es_perder')])])]);
  p.funcion('reabastecer', [], () => [p.fijar('reserva_0', 96), p.fijar('reserva_1', 48), p.fijar('reserva', datoArma('reserva'))]);
  p.evento('ev_recibir', { senal: 'enemigo_cqb_eliminado' }, () => [p.sumar('bajas', 1), p.accion('es_puntos', { cantidad: 100 })]);
  guardar(p);

  const e = autor('enemigo_cqb', 'Personaje3D', { vida: 100, muerto: false, alerta: false, ataque: 1.15, memoria: 0, retirada: 0, municion: 6, recargando: false, recarga: 0, estado: 'PATRULLA' });
  const jugador = () => e.objeto('Jugador');
  e.evento('ev_empieza', {}, () => [e.llamar('apuntar_a', [jugador()])]);
  e.funcion('recibir_dano', ['cantidad'], cantidad => [e.si(e.no(e.v('muerto')), [e.fijar('vida', e.menos(e.v('vida'), cantidad)), e.fijar('alerta', true), e.fijar('memoria', 6), e.fijar('retirada', 3.2), e.llamar('recordar_objetivo', [jugador()]), e.llamar('animar_3d', ['hit', 0.27]), e.si(e.op(e.v('vida'), '<=', 0), [e.fijar('muerto', true), e.fijar('estado', 'NEUTRALIZADO'), e.llamar('animar_3d', ['death', 5]), e.accion('es_emitir', { senal: 'enemigo_cqb_eliminado' })])])]);
  e.evento('ev_actualizar', {}, delta => [
    e.si(e.o(e.v('muerto'), e.op(e.prop('vida', jugador()), '<=', 0)), [e.accion('fn_devolver')]),
    e.si(e.v('recargando'), [e.fijar('estado', 'RECARGANDO'), e.fijar('recarga', e.menos(e.v('recarga'), delta)), e.si(e.op(e.v('recarga'), '<=', 0), [e.fijar('municion', 6), e.fijar('recargando', false), e.fijar('ataque', 0.45)]), e.accion('fn_devolver')]),
    e.fijar('ataque', e.limitar(e.menos(e.v('ataque'), delta), 0, 10)), e.fijar('memoria', e.limitar(e.menos(e.v('memoria'), delta), 0, 6)), e.fijar('retirada', e.limitar(e.menos(e.v('retirada'), delta), 0, 4)),
    e.si(e.consulta('oir_disparo', [jugador(), 13]), [e.fijar('memoria', 6), e.llamar('recordar_objetivo', [jugador()])]),
    e.si(e.o(e.consulta('detectar', [jugador(), 18, 105]), e.y(e.v('alerta'), e.consulta('ve_a', [jugador(), 18]))), [
      e.si(e.no(e.v('alerta')), [e.fijar('ataque', 1.15)]), e.fijar('alerta', true), e.fijar('memoria', 6), e.fijar('estado', 'CONTACTO'), e.llamar('recordar_objetivo', [jugador()]), e.llamar('apuntar_a', [jugador()]),
      e.si(e.op(e.v('retirada'), '>', 0), [e.fijar('estado', 'COBERTURA'), e.llamar('buscar_cobertura', [jugador(), 1.6])], [e.si(e.y(e.op(e.v('ataque'), '<=', 0), e.consulta('arma_libre')), [e.llamar('disparar_arma', [8, 20]), e.sumar('municion', -1), e.fijar('ataque', 1.15), e.si(e.op(e.v('municion'), '<=', 0), [e.fijar('recargando', true), e.fijar('recarga', 2.6), e.llamar('animar_3d', ['reload', 2.6])])])]),
    ], [e.si(e.op(e.v('memoria'), '>', 0), [e.fijar('estado', 'BUSCANDO'), e.si(e.op(e.v('retirada'), '>', 0), [e.llamar('buscar_cobertura', [jugador(), 1.5])], [e.llamar('investigar', [1.25])])], [e.fijar('alerta', false), e.fijar('estado', 'PATRULLA'), e.llamar('patrullar', [0.85])])]),
  ], 'Cono inicial de 105° y rayos bloqueados por puertas y paredes. Reacción de 1,15 s. Tras un impacto busca una cobertura comprobada físicamente. A* calcula recorridos reales. Sin visión no dispara.');
  guardar(e);

  const d = autor('puerta_cqb', 'Nodo3D', { abierta: false });
  d.funcion('usar', [], () => [d.fijar('abierta', d.no(d.v('abierta')))]);
  d.evento('ev_actualizar', {}, delta => [d.llamar('mover_puerta', [d.v('abierta'), delta])], 'La hoja gira sobre la bisagra; un cuerpo en el barrido detiene la puerta. El collider y los rayos siguen a la hoja.'); guardar(d);

  const t = autor('terminal_cqb', 'Malla3D', {});
  t.funcion('usar', [], () => [t.si(t.op(t.prop('bajas', t.objeto('Jugador')), '>=', 3), [t.accion('es_ganar')])]); guardar(t);
  const s = autor('suministros_cqb', 'Malla3D', {});
  s.funcion('usar', [], () => [s.llamar('reabastecer', [], s.objeto('Jugador'))]); guardar(s);
  return archivos;
}
