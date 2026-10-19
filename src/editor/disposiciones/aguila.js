// Modo Águila: editor de scripts con ayuda, diccionario y problemas.
import { est, bus, abrirDocumento, archivosDeTipo, documento, log } from '../estado.js';
import { guardar, probar, nuevoScript, abrirArchivo } from '../acciones.js';
import { crearPestanas } from '../paneles/documentos.js';
import { crearInferior } from '../paneles/inferior.js';
import { menuNuevo } from './escena.js';
import { crearEditorCodigo } from '../../ui/editor-codigo.js';
import { analizarCodigo, rutaEnLinea, formatear, PALABRAS, EVENTOS, FUNCIONES, METODOS_LISTA, METODOS_TEXTO, PALABRAS_CLAVE } from '../../aguila/index.js';
import { nombresMiembros, miembrosDe, TIPOS, recorrer, tipo as tipoNodo } from '../../motor/tipos.js';
import { sinExtension, nombreBase } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, debounce, avisar } from '../../ui/componentes.js';

const COLOR_TIPO = { decimal: 'var(--lima)', entero: 'var(--azul)', texto: 'var(--aviso)', 'sí/no': 'var(--error)', lista: 'var(--turquesa)', diccionario: 'var(--turquesa)', valor: 'var(--texto-2)', nulo: 'var(--texto-3)' };

// Nombres de nodos de las escenas abiertas (para no marcarlos como desconocidos).
function nombresEscena() {
  const s = new Set();
  for (const d of est.docs) if (d.tipo === 'escena') recorrer(d.datos.raiz, (n) => s.add(n.nombre));
  return [...s];
}

export async function crearDisposicionAguila(contenedor) {
  const cuerpo = el('<div class="cuerpo"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div>');
  contenedor.append(cuerpo);
  const [izq, centro, der] = cuerpo.children;
  const partes = [];
  const doc = est.activo && est.activo.tipo === 'script' ? est.activo : null;

  // ---------- Scripts y diccionario ----------
  const panelScripts = el(`<section class="panel" style="flex:none;max-height:42%"><div class="cab-panel"><h3>Scripts</h3><button class="btn-mas" data-ayuda="Nuevo script">${icono('mas', '', 16)}</button></div><div class="desplazable lista-archivos"></div></section>`);
  const panelDic = el(`<section class="panel diccionario" style="flex:1"><div class="cab-panel">${icono('libro', '', 16)}<h3>Diccionario Águila</h3></div><div class="desplazable"></div></section>`);
  izq.append(panelScripts, panelDic);
  const pintarScripts = () => {
    const c = $('.lista-archivos', panelScripts);
    const lista = archivosDeTipo('script');
    c.innerHTML = lista.map(a => {
      const gen = a.rel.startsWith('generado/');
      return `<div class="fila-archivo ${doc && doc.rel === a.rel ? 'sel' : ''}" data-rel="${esc(a.rel)}" title="${esc(a.rel)}"><span style="color:${gen ? 'var(--verde)' : 'var(--texto-2)'}">${icono(gen ? 'blueprint' : 'codigo', '', 15)}</span><span>${esc(gen ? sinExtension(a.rel) + '_bp.agl' : a.nombre)}</span><span style="margin-left:auto;font-size:12px;color:var(--texto-3)">${gen ? 'desde Blueprint' : 'escrito'}</span></div>`;
    }).join('') || '<div class="vacio-texto">No hay scripts todavía.</div>';
    $$('[data-rel]', c).forEach(f => f.onclick = () => abrirDocumento(f.dataset.rel));
  };
  $('.btn-mas', panelScripts).onclick = async () => { const r = await nuevoScript(null); if (r) abrirArchivo(r); };
  pintarScripts();
  $('.desplazable', panelDic).innerHTML = PALABRAS.map(p => `<div class="entrada-dic" data-p="${esc(p.nombre)}"><b>${esc(p.titulo)}</b><span>${esc(p.descripcion)}</span></div>`).join('');

  partes.push(crearPestanas(centro, { alNuevo: menuNuevo }));

  if (!doc) {
    const v = el(`<section class="panel visor"><div class="vacio-visor"><div><b>Águila: programación en español</b>Abre un script de la lista o crea uno nuevo.<br><button class="btn principal">${icono('mas', '', 16)}Nuevo script</button></div></div></section>`);
    v.querySelector('button').onclick = async () => { const r = await nuevoScript(est.activo?.nodoSel || null); if (r) abrirArchivo(r); };
    centro.append(v);
    der.append(el('<section class="panel" style="flex:1"><div class="vacio-insp">La ayuda de la función bajo el cursor aparecerá aquí.</div></section>'));
    $$('.entrada-dic', panelDic).forEach(e => e.onclick = () => avisar('Abre un script para insertar ejemplos.', 'aviso'));
    return { destruir: () => partes.forEach(p => p.destruir && p.destruir()) };
  }

  // ---------- Editor ----------
  const panelEd = el(`<section class="panel visor"><div class="ruta-grafo"><div class="migas"></div><div class="derecha">
    <button class="btn secundario peq" data-a="buscar">${icono('buscar', '', 14)}Buscar</button>
    <button class="btn secundario peq" data-a="ordenar" ${doc.soloLectura ? 'disabled' : ''}>Ordenar código</button>
    <button class="btn secundario peq" data-a="menos" data-ayuda="Letra más pequeña">A−</button><button class="btn secundario peq" data-a="mas" data-ayuda="Letra más grande" style="margin-left:-6px">A+</button>
    ${doc.soloLectura ? `<button class="btn contorno peq" data-a="bp">${icono('blueprint', '', 14)}Abrir el Blueprint</button>` : `<button class="btn principal peq" data-a="guardar-probar" data-accion="guardar-probar">Guardar y probar</button>`}</div></div></section>`);
  centro.append(panelEd);
  let analisis = null;
  let base = null;
  let contProblemas = null;
  let inferior = null;
  const editor = crearEditorCodigo(panelEd, {
    texto: doc.datos, soloLectura: doc.soloLectura, tamFuente: est.ajustes.tamFuenteCodigo || 14,
    alCambiar: (t) => { doc.datos = t; doc.marcarSucio(); analizarLuego(); bus.emit('script:texto', doc); },
    alCursor: (l) => { pintarRuta(l); ayudaEnCursor(); },
    sugerencias,
  });
  partes.push(editor);
  if (doc.vista.linea) setTimeout(() => editor.irA(doc.vista.linea, 0, false));

  function analizar() {
    const miembrosBase = base && TIPOS[base] ? nombresMiembros(base) : nombresMiembros('?');
    analisis = analizarCodigo(editor.valor(), { miembros: miembrosBase, nombresEscena: nombresEscena(), archivo: doc.rel });
    base = analisis.simbolos.base;
    const diag = [...analisis.errores, ...analisis.avisos].map(e => e.aObjeto());
    editor.diagnosticos(diag);
    pintarRuta(editor.lineaActual());
    pintarProblemas();
    pintarVariables();
  }
  const analizarLuego = debounce(analizar, 280);

  function pintarRuta(linea) {
    const m = $('.migas', panelEd);
    if (!analisis) return;
    const ruta = rutaEnLinea(analisis, linea);
    const partesRuta = ruta.length ? ruta : [doc.nombre];
    m.innerHTML = partesRuta.map((p, i) => i === partesRuta.length - 1 ? `<b class="mono" style="font-size:13px">${esc(p)}</b>` : `<span>${esc(p)}</span>${icono('flechaDerecha', '', 13)}`).join('');
    doc.vista.linea = linea;
  }

  // ---------- Autocompletado ----------
  function sugerencias(prefijo, ctx) {
    const p = prefijo.toLowerCase();
    const r = [];
    const anadir = (x) => { if (!p || x.nombre.toLowerCase().startsWith(p) || (p.length > 2 && x.nombre.toLowerCase().includes(p))) r.push(x); };
    const conParentesis = (firma) => /\(/.test(firma || '') ;
    if (ctx.objeto) {
      const nodos = nombresEscena();
      let tipoObj = null;
      for (const d of est.docs) if (d.tipo === 'escena') recorrer(d.datos.raiz, (n) => { if (!tipoObj && n.nombre.toLowerCase() === ctx.objeto.toLowerCase()) tipoObj = n.tipo; });
      const miembros = tipoObj ? miembrosDe(tipoObj) : ['otro', 'yo'].includes(ctx.objeto) ? [...new Map(Object.values(TIPOS).flatMap(t => t.miembros || []).map(m => [m.nombre, m])).values()] : [];
      for (const m of miembros) anadir({ nombre: m.nombre, etiqueta: m.firma || m.nombre, insertar: m.firma ? m.nombre + '()' : m.nombre, cursorAtras: m.firma && !/\(\)$/.test(m.firma) ? 1 : 0, desc: m.descripcion, tipo: m.firma ? 'funcion' : 'variable' });
      if (!tipoObj && !['otro', 'yo'].includes(ctx.objeto)) for (const m of [...METODOS_LISTA, ...METODOS_TEXTO]) anadir({ nombre: m.nombre, etiqueta: m.firma, insertar: m.firma.includes('(') ? m.nombre + '()' : m.nombre, cursorAtras: m.firma.includes('()') ? 0 : m.firma.includes('(') ? 1 : 0, desc: m.descripcion, tipo: 'funcion' });
      return r;
    }
    const linea = editor.valor().split('\n')[ctx.linea - 1] || '';
    if (/^\s*cuando\s+\w*$/.test(linea.slice(0, editor.colActual()))) {
      for (const e of EVENTOS) anadir({ nombre: e.nombre, etiqueta: e.firma.replace(/^cuando /, '').replace(/:$/, ''), insertar: e.firma.replace(/^cuando /, ''), desc: e.descripcion, tipo: 'evento' });
      return r;
    }
    if (analisis) {
      for (const v of analisis.simbolos.variables) anadir({ nombre: v.nombre, desc: `Variable · ${v.tipo}`, tipo: 'variable' });
      for (const f of analisis.simbolos.funciones) anadir({ nombre: f.nombre, etiqueta: `${f.nombre}(${f.params.join(', ')})`, insertar: f.nombre + '()', cursorAtras: f.params.length ? 1 : 0, desc: 'Función de este script', tipo: 'funcion' });
    }
    for (const f of FUNCIONES) anadir({ nombre: f.nombre, etiqueta: f.tipo === 'variable' ? f.nombre : f.firma, insertar: f.tipo === 'variable' ? f.nombre : f.nombre + '()', cursorAtras: f.tipo !== 'variable' && !/\(\)$/.test(f.firma) ? 1 : 0, desc: f.tipo === 'variable' ? `Variable · ${f.tipoValor}` : f.descripcion.split('.')[0], tipo: f.tipo === 'variable' ? 'variable' : 'funcion' });
    if (base && TIPOS[base]) for (const m of miembrosDe(base)) anadir({ nombre: m.nombre, etiqueta: m.firma || m.nombre, insertar: m.firma ? m.nombre + '()' : m.nombre, cursorAtras: m.firma && !/\(\)$/.test(m.firma) ? 1 : 0, desc: m.descripcion, tipo: m.firma ? 'funcion' : 'variable' });
    for (const n of nombresEscena()) { const id = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (/^[a-z_][a-z0-9_]*$/.test(id)) anadir({ nombre: id, desc: `Nodo «${n}» de la escena`, tipo: 'variable' }); }
    for (const k of PALABRAS_CLAVE) if (k.length > 2) anadir({ nombre: k, desc: 'Palabra de Águila', tipo: 'palabra' });
    // Sin duplicados, lo más corto primero.
    const vistos = new Set();
    return r.filter(x => { if (vistos.has(x.nombre)) return false; vistos.add(x.nombre); return true; })
      .sort((a, b) => (a.nombre.toLowerCase().startsWith(p) ? 0 : 1) - (b.nombre.toLowerCase().startsWith(p) ? 0 : 1) || a.nombre.length - b.nombre.length);
  }

  // ---------- Barra ----------
  $('[data-a=buscar]', panelEd).onclick = () => editor.buscar();
  $('[data-a=ordenar]', panelEd).onclick = () => {
    const f = formatear(editor.valor());
    if (f === editor.valor()) { avisar(analisis && analisis.errores.length ? 'Arregla primero los errores para poder ordenar el código.' : 'El código ya está ordenado.', 'aviso'); return; }
    editor.reemplazarTodo(f);
  };
  const tam = async (d) => {
    est.ajustes.tamFuenteCodigo = Math.max(10, Math.min(26, (est.ajustes.tamFuenteCodigo || 14) + d));
    editor.tamFuente(est.ajustes.tamFuenteCodigo);
    const datos = await window.falcon.app.datos(); datos.ajustes = { ...(datos.ajustes || {}), tamFuenteCodigo: est.ajustes.tamFuenteCodigo }; window.falcon.app.guardarDatos(datos);
  };
  $('[data-a=menos]', panelEd).onclick = () => tam(-1);
  $('[data-a=mas]', panelEd).onclick = () => tam(1);
  const gp = $('[data-a=guardar-probar]', panelEd);
  if (gp) gp.onclick = async () => { await guardar(doc); editor.limpiarCambios(); if (analisis && analisis.errores.length) { avisar('Hay errores en el script: revísalos en Problemas.', 'error'); return; } await probar(); };
  const bBp = $('[data-a=bp]', panelEd);
  if (bBp) bBp.onclick = () => abrirDocumento('blueprints/' + nombreBase(doc.rel).replace(/\.agl$/, '.bp'));

  // ---------- Problemas ----------
  inferior = crearInferior(centro, {
    pestanas: ['problemas', 'salida', 'aguila'],
    inicial: 'problemas',
    extra: {
      problemas: {
        titulo: 'Problemas',
        insignia: () => analisis ? analisis.errores.length + analisis.avisos.length : 0,
        pintar: (c) => { contProblemas = el('<div class="desplazable"></div>'); c.append(contProblemas); pintarProblemas(); },
      },
      aguila: { titulo: 'Consola Águila' },
    },
  });
  partes.push(inferior);

  function pintarProblemas() {
    if (!inferior) return;
    inferior.el.querySelector('[data-p=problemas]') && (inferior.el.querySelector('[data-p=problemas]').innerHTML = `Problemas${analisis && (analisis.errores.length + analisis.avisos.length) ? `<span class="insignia">${analisis.errores.length + analisis.avisos.length}</span>` : ''}`);
    if (!contProblemas || !document.body.contains(contProblemas)) return;
    const lista = analisis ? [...analisis.errores, ...analisis.avisos] : [];
    if (!lista.length) { contProblemas.innerHTML = `<div class="problema"><span class="marca-problema" style="background:var(--verde-tenue);color:var(--verde)">✓</span><div><b>Sin problemas</b><span>El script está bien escrito.</span></div></div>`; return; }
    contProblemas.innerHTML = '';
    for (const e of lista) {
      const p = el(`<div class="problema ${e.tipo === 'aviso' ? 'aviso' : ''}"><span class="marca-problema">!</span><div class="crece"><b>${esc(e.mensajeCompleto.replace(/^Línea (\d+): (.)/, (m, n, c) => `Línea ${n}: ${c}`))}</b><span>${esc(e.explicacion)}</span></div>${e.arreglo ? `<button class="btn principal peq">Arreglar</button>` : ''}</div>`);
      p.querySelector('.crece').onclick = () => editor.irA(e.linea, e.columna);
      const b = p.querySelector('button');
      if (b) b.onclick = () => arreglar(e.arreglo);
      contProblemas.append(p);
    }
  }

  function arreglar(arreglo) {
    const lineas = editor.valor().split('\n');
    const cambios = [...arreglo.cambios].sort((a, b) => b.linea - a.linea || b.desde - a.desde);
    let ultimo = null;
    for (const c of cambios) {
      const l = lineas[c.linea - 1] ?? '';
      let desde = c.desde, hasta = c.hasta;
      if (desde < 0) { desde = hasta = l.length - l.trimStart().length; }
      lineas[c.linea - 1] = l.slice(0, desde) + c.texto + l.slice(hasta);
      ultimo = { linea: c.linea, col: desde + c.texto.length };
    }
    editor.reemplazarTodo(lineas.join('\n'));
    if (ultimo) editor.irA(ultimo.linea, ultimo.col);
    analizar();
  }

  // ---------- Ayuda y variables ----------
  let pestanaDer = 'ayuda';
  const panelDer = el(`<section class="panel" style="flex:1"><div class="pestanas"><button data-p="ayuda" class="activo">Ayuda</button><button data-p="variables">Variables</button></div><div class="desplazable cont-der"></div></section>`);
  der.append(panelDer);
  $$('.pestanas button', panelDer).forEach(b => b.onclick = () => { pestanaDer = b.dataset.p; $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x === b)); pintarDer(); });
  let ayudaActual = FUNCIONES.find(f => f.nombre === 'ganar_partida');

  function palabraEnCursor() {
    const t = editor.valor(), pos = editor.textarea.selectionStart;
    const antes = /[\p{L}_][\p{L}\p{N}_]*$/u.exec(t.slice(0, pos)), despues = /^[\p{L}\p{N}_]*/u.exec(t.slice(pos));
    return ((antes ? antes[0] : '') + (despues ? despues[0] : ''));
  }
  function ayudaEnCursor() {
    const w = palabraEnCursor();
    if (!w) return;
    const f = FUNCIONES.find(x => x.nombre === w) || EVENTOS.find(x => x.nombre === w) && { ...EVENTOS.find(x => x.nombre === w), firma: EVENTOS.find(x => x.nombre === w).firma, ejemplo: EVENTOS.find(x => x.nombre === w).firma + '\n    pasar' }
      || PALABRAS.find(x => x.nombre === w) && { ...PALABRAS.find(x => x.nombre === w), firma: PALABRAS.find(x => x.nombre === w).titulo };
    let m = null;
    if (!f) for (const t2 of Object.values(TIPOS)) { const x = (t2.miembros || []).find(y => y.nombre === w && y.firma); if (x) { m = { nombre: x.nombre, firma: x.firma, descripcion: x.descripcion + ` (${t2.nombreVisible})`, ejemplo: x.firma }; break; } }
    const nueva = f || m;
    if (nueva && nueva !== ayudaActual) { ayudaActual = nueva; if (pestanaDer === 'ayuda') pintarDer(); }
  }

  function pintarVariables() { if (pestanaDer === 'variables' || pestanaDer === 'ayuda') pintarDer(); }

  function listaVariables() {
    if (!analisis) return '';
    const vivos = est.juego.activo ? findVivos() : null;
    return analisis.simbolos.variables.map(v => {
      const vivo = vivos && vivos.find(x => x.nombre === v.nombre);
      return `<div class="fila-flex" style="justify-content:space-between;font-family:var(--mono);font-size:13px;padding:5px 0"><span class="fila-flex" style="gap:8px"><i style="width:8px;height:8px;border-radius:50%;background:${COLOR_TIPO[v.tipo] || 'var(--texto-2)'};display:inline-block"></i>${esc(v.nombre)}</span><span style="color:${vivo ? 'var(--verde)' : 'var(--texto-2)'}">${vivo ? esc(vivo.valor) : esc(v.tipo)}</span></div>`;
    }).join('') || '<div class="vacio-texto" style="text-align:left;padding:0">Este script no declara variables.</div>';
  }
  function findVivos() {
    for (const [nombre, valores] of est.vivos) {
      for (const d of est.docs) if (d.tipo === 'escena') { let ok = false; recorrer(d.datos.raiz, n => { if (n.nombre === nombre && n.script === doc.rel) ok = true; }); if (ok) return valores; }
    }
    return null;
  }

  function pintarDer() {
    const c = $('.cont-der', panelDer);
    const clase = analisis && analisis.simbolos.clase;
    if (pestanaDer === 'variables') {
      c.innerHTML = `<div class="ayuda-aguila"><div class="titulo-seccion" style="margin:4px 0 10px">Variables ${clase ? 'de ' + esc(clase) : 'del script'}</div>${listaVariables()}
        ${analisis && analisis.simbolos.funciones.length ? `<div class="titulo-seccion" style="margin:18px 0 10px">Funciones</div>${analisis.simbolos.funciones.map(f => `<div class="mono" style="font-size:13px;padding:4px 0;cursor:pointer;color:var(--azul)" data-l="${f.linea}">${esc(f.nombre)}(${esc(f.params.join(', '))})</div>`).join('')}` : ''}
        ${analisis && analisis.simbolos.eventos.length ? `<div class="titulo-seccion" style="margin:18px 0 10px">Eventos</div>${analisis.simbolos.eventos.map(e => `<div class="mono" style="font-size:13px;padding:4px 0;cursor:pointer;color:var(--verde)" data-l="${e.linea}">cuando ${esc(e.evento)}(${e.filtro !== null ? JSON.stringify(e.filtro) : esc(e.params.join(', '))})</div>`).join('')}` : ''}
        ${est.juego.activo ? '<p style="color:var(--texto-2);font-size:12px;margin-top:14px">En verde, el valor que tiene ahora mismo en el juego.</p>' : ''}</div>`;
      $$('[data-l]', c).forEach(x => x.onclick = () => editor.irA(Number(x.dataset.l), 0));
      return;
    }
    const a = ayudaActual;
    c.innerHTML = `<div class="ayuda-aguila">
      ${a ? `<h4>${esc(a.firma && a.firma.includes('(') ? a.nombre + '()' : a.titulo || a.firma || a.nombre)}</h4><p>${esc(a.descripcion)}</p>
      ${a.ejemplo ? `<div class="titulo-seccion" style="margin-bottom:8px">Ejemplo</div><pre>${esc(a.ejemplo)}</pre>` : ''}
      ${a.ejemplo && !doc.soloLectura ? `<button class="btn secundario ancho" data-a="insertar">Insertar ejemplo</button>` : ''}` : ''}
      <div class="separador"></div>
      <div class="titulo-seccion" style="margin-bottom:10px">Variables ${clase ? 'de ' + esc(clase) : 'del script'}</div>${listaVariables()}</div>
      <div class="tarjeta-bloques"><b>¿Prefieres bloques?</b><p>Puedes hacer lo mismo con un Blueprint. Ambos se ejecutan en Águila.</p><button class="btn principal ancho" data-a="bp">Abrir Blueprints</button></div>`;
    const ins = $('[data-a=insertar]', c);
    if (ins) ins.onclick = () => {
      const linea = editor.valor().split('\n')[editor.lineaActual() - 1] || '';
      const sangria = (linea.match(/^ */) || [''])[0];
      const texto = a.ejemplo.split('\n').map((l, i) => (i ? sangria : '') + l).join('\n');
      editor.insertar(texto);
    };
    $('[data-a=bp]', c).onclick = () => window.__falconEditor.irAModo('blueprints');
  }

  $$('.entrada-dic', panelDic).forEach(e => e.onclick = () => {
    const p = PALABRAS.find(x => x.nombre === e.dataset.p);
    ayudaActual = { ...p, firma: p.titulo };
    pestanaDer = 'ayuda';
    $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x.dataset.p === 'ayuda'));
    pintarDer();
  });

  analizar();
  pintarDer();
  setTimeout(() => editor.foco(), 50);

  const quitar = [
    bus.on('archivos', pintarScripts),
    bus.on('codigo:ir', ({ rel, linea }) => { if (rel === doc.rel) editor.irA(linea, 0); }),
    bus.on('juego:vivos', () => { if (pestanaDer === 'variables') pintarDer(); }),
    bus.on('doc:cambio', ({ doc: d, op }) => { if (d === doc && (op?.deshacer || op?.rehacer)) { editor.fijar(doc.datos); analizar(); } }),
    bus.on('doc:guardado', (d) => { if (d === doc) { editor.limpiarCambios(); pintarScripts(); } }),
  ];
  return { destruir: () => { quitar.forEach(f => f()); partes.forEach(p => p.destruir && p.destruir()); }, editor };
}
