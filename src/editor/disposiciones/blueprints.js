// Modo Blueprints: grafo de bloques que se compila a Águila.
import { est, bus, abrirDocumento, archivosDeTipo, log, anotarEvento } from '../estado.js';
import { guardar, probar, nuevoBlueprint } from '../acciones.js';
import { crearPestanas } from '../paneles/documentos.js';
import { crearInferior } from '../paneles/inferior.js';
import { menuNuevo } from './escena.js';
import { NODOS, CATEGORIAS, TIPOS_DATO, pinesDe, tituloNodo, compatibles, compilarBlueprint, idNodoBp } from '../../motor/blueprints.js';
import { crearGrafo } from '../../ui/grafo.js';
import { crearEditorCodigo } from '../../ui/editor-codigo.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, dialogo, pedirTexto, menu, avisar, interruptor, confirmar } from '../../ui/componentes.js';

const COLOR_VAR = { decimal: '#B5E35A', entero: '#74B6F7', texto: '#F2B85C', bool: '#F07A7A', objeto: '#B39DFF', lista: '#4FD1C5', cualquiera: '#A9B5AE' };
const NOMBRE_TIPO = { decimal: 'decimal', entero: 'entero', texto: 'texto', bool: 'sí/no', objeto: 'objeto', lista: 'lista' };
const ICONO_CAT = { Eventos: 'rayo', Entrada: 'boton', Movimiento: 'mover', Lógica: 'cadena', Matemáticas: 'mas', Variables: 'lista', Escena: 'escena', Texto: 'texto', Audio: 'altavoz' };

export async function crearDisposicionBlueprints(contenedor) {
  const cuerpo = el('<div class="cuerpo"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div>');
  contenedor.append(cuerpo);
  const [izq, centro, der] = cuerpo.children;
  const partes = [];
  const doc = est.activo && est.activo.tipo === 'blueprint' ? est.activo : null;
  partes.push(crearPestanas(centro, { alNuevo: menuNuevo }));

  if (!doc) {
    const lista = archivosDeTipo('blueprint');
    const v = el(`<section class="panel visor"><div class="vacio-visor"><div><b>Blueprints: lógica sin escribir código</b>Une bloques como «Al actualizar», «Si» y «Saltar» y Falcon los convierte en Águila.<br>
      <button class="btn principal" data-a="nuevo">${icono('mas', '', 16)}Nuevo Blueprint</button>
      ${lista.length ? `<div style="margin-top:18px;display:flex;flex-direction:column;gap:4px;align-items:center">${lista.map(a => `<button class="btn fantasma peq" data-r="${esc(a.rel)}">${icono('blueprint', '', 15)}${esc(a.rel)}</button>`).join('')}</div>` : ''}</div></div></section>`);
    v.querySelector('[data-a=nuevo]').onclick = async () => { const r = await nuevoBlueprint(est.activo?.nodoSel || null); if (r) abrirDocumento(r); };
    $$('[data-r]', v).forEach(b => b.onclick = () => abrirDocumento(b.dataset.r));
    centro.append(v);
    izq.append(el('<section class="panel" style="flex:1"><div class="vacio-insp">Abre un Blueprint para ver sus variables, eventos y funciones.</div></section>'));
    der.append(el('<section class="panel" style="flex:1"><div class="vacio-insp">Los detalles del bloque seleccionado aparecerán aquí.</div></section>'));
    return { destruir: () => partes.forEach(p => p.destruir && p.destruir()) };
  }

  const bp = () => doc.datos;
  doc.vista.grafo ||= 'eventos';
  doc.vista.vistas ||= {};
  let seleccion = [];
  let varSel = null;
  let resultado = compilarBlueprint(bp(), doc.nombre);
  anotarEvento('blueprint_abierto');

  // ---------- Columna izquierda ----------
  const panelBp = el(`<section class="panel lista-bp" style="flex:1"><div class="cab-panel"><span style="color:var(--verde)">${icono('blueprint', '', 16)}</span><h3>${esc(doc.nombre)}</h3></div><div class="desplazable cont-bp"></div></section>`);
  const panelNodos = el(`<section class="panel" style="flex:1"><div class="cab-panel"><h3>Nodos</h3></div>
    <div class="filtro"><div class="buscador">${icono('buscar', '', 15)}<input class="campo" placeholder="Buscar nodo… (Espacio)"></div></div>
    <div class="desplazable categorias-nodos" style="padding:0 6px 8px"></div></section>`);
  izq.append(panelBp, panelNodos);

  function pintarPanelBp() {
    const c = $('.cont-bp', panelBp);
    const eventos = (bp().grafos.eventos?.nodos || []).filter(n => NODOS[n.def]?.evento);
    c.innerHTML = `
      <div class="grupo-bp"><div class="titulo-seccion">Variables<button data-a="var" data-ayuda="Nueva variable">${icono('mas', '', 14)}</button></div>
        ${bp().variables.map(v => `<div class="item-bp ${varSel === v.nombre ? 'sel' : ''}" data-var="${esc(v.nombre)}" draggable="true"><span class="punto-tipo" style="background:${COLOR_VAR[v.tipo] || '#A9B5AE'}"></span>${esc(v.nombre)}${v.exportar ? `<span data-ayuda="Se puede cambiar en el Inspector" style="color:var(--texto-3)">${icono('ojo', '', 12)}</span>` : ''}<span class="tipo-bp">${esc(NOMBRE_TIPO[v.tipo] || v.tipo)}</span></div>`).join('') || '<div class="vacio-texto" style="text-align:left;padding:2px 8px">Sin variables</div>'}</div>
      <div class="grupo-bp"><div class="titulo-seccion">Eventos<button data-a="evento" data-ayuda="Nuevo evento">${icono('mas', '', 14)}</button></div>
        ${eventos.map(n => `<div class="item-bp" data-ev="${esc(n.id)}"><span class="cuadro-tipo" style="background:var(--verde)"></span>${esc(tituloNodo(n))}${n.valores && Object.values(n.valores)[0] ? ` <span style="color:var(--texto-3);font-size:12px">«${esc(Object.values(n.valores)[0])}»</span>` : ''}</div>`).join('') || '<div class="vacio-texto" style="text-align:left;padding:2px 8px">Sin eventos</div>'}</div>
      <div class="grupo-bp"><div class="titulo-seccion">Funciones<button data-a="funcion" data-ayuda="Nueva función">${icono('mas', '', 14)}</button></div>
        ${bp().funciones.map(f => `<div class="item-bp ${doc.vista.grafo === 'fn:' + f.nombre ? 'sel' : ''}" data-fn="${esc(f.nombre)}"><span class="cuadro-tipo" style="background:var(--azul)"></span>${esc(f.nombre)}<span class="tipo-bp">${f.params.length ? f.params.map(p => p.nombre).join(', ') : ''}</span></div>`).join('') || '<div class="vacio-texto" style="text-align:left;padding:2px 8px">Sin funciones</div>'}</div>`;
    $('[data-a=var]', c).onclick = () => editarVariable();
    $('[data-a=evento]', c).onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      menu(r.left, r.bottom + 4, Object.values(NODOS).filter(d => d.evento).map(d => ({ texto: d.titulo, icono: 'rayo', accion: () => { irAGrafo('eventos'); const n = anadirNodo(d.id, 60, 60 + eventos.length * 140); grafo.centrarEn(n.id); } })));
    };
    $('[data-a=funcion]', c).onclick = () => nuevaFuncion();
    $$('[data-var]', c).forEach(x => {
      x.onclick = () => { varSel = x.dataset.var; seleccion = []; pintarPanelBp(); pintarDetalles(); };
      x.ondblclick = () => editarVariable(bp().variables.find(v => v.nombre === x.dataset.var));
      x.oncontextmenu = (e) => { e.preventDefault(); const v = bp().variables.find(z => z.nombre === x.dataset.var); menu(e.clientX, e.clientY, [{ texto: 'Editar…', icono: 'lapiz', accion: () => editarVariable(v) }, { texto: 'Obtener en el grafo', accion: () => anadirNodo('var_obtener', null, null, { variable: v.nombre }) }, { texto: 'Fijar en el grafo', accion: () => anadirNodo('var_fijar', null, null, { variable: v.nombre }) }, '-', { texto: 'Eliminar', icono: 'papelera', peligro: true, accion: () => borrarVariable(v) }]); };
      x.ondragstart = (e) => { e.dataTransfer.setData('text/falcon-variable', x.dataset.var); };
    });
    $$('[data-ev]', c).forEach(x => x.onclick = () => { irAGrafo('eventos'); requestAnimationFrame(() => grafo.centrarEn(x.dataset.ev)); });
    $$('[data-fn]', c).forEach(x => {
      x.onclick = () => irAGrafo('fn:' + x.dataset.fn);
      x.oncontextmenu = (e) => { e.preventDefault(); menu(e.clientX, e.clientY, [{ texto: 'Abrir', accion: () => irAGrafo('fn:' + x.dataset.fn) }, { texto: 'Llamar en el grafo actual', accion: () => anadirNodo('fn_llamar', null, null, { funcion: x.dataset.fn }) }, '-', { texto: 'Eliminar', icono: 'papelera', peligro: true, accion: () => borrarFuncion(x.dataset.fn) }]); };
    });
  }

  function pintarCatalogo() {
    const c = $('.categorias-nodos', panelNodos);
    const q = $('.filtro input', panelNodos).value.toLowerCase();
    const abiertas = (est._catBp ||= new Set());
    c.innerHTML = '';
    for (const cat of CATEGORIAS) {
      const defs = Object.values(NODOS).filter(d => d.cat === cat.id && !d.oculto && !d.variable && !d.funcion && (!q || d.titulo.toLowerCase().includes(q)));
      if (!defs.length) continue;
      const abierta = q || abiertas.has(cat.id);
      const item = el(`<div><div class="item-cat"><span class="caja" style="background:${cat.cabecera};color:${cat.color}">${icono(ICONO_CAT[cat.id], '', 14)}</span>${esc(cat.id)}<span style="margin-left:auto;color:var(--texto-3)">${icono(abierta ? 'flechaAbajo' : 'flechaDerecha', '', 13)}</span></div>
        ${abierta ? `<div class="sub-nodos">${defs.map(d => `<div draggable="true" data-def="${d.id}" data-ayuda="${esc(d.ayuda || '')}">${esc(d.titulo)}</div>`).join('')}</div>` : ''}</div>`);
      item.querySelector('.item-cat').onclick = () => { abiertas.has(cat.id) ? abiertas.delete(cat.id) : abiertas.add(cat.id); pintarCatalogo(); };
      $$('[data-def]', item).forEach(x => {
        x.onclick = () => { const n = anadirNodo(x.dataset.def); grafo.seleccionar([n.id]); seleccion = [n.id]; pintarDetalles(); };
        x.ondragstart = (e) => e.dataTransfer.setData('text/falcon-bloque', x.dataset.def);
      });
      c.append(item);
    }
  }
  $('.filtro input', panelNodos).oninput = pintarCatalogo;

  // ---------- Centro ----------
  const panelGrafo = el(`<section class="panel visor"><div class="ruta-grafo"><div class="migas"></div><div class="derecha">
    <span class="estado-compilado"></span>
    <button class="btn secundario peq" data-a="codigo">${icono('codigo', '', 15)}Ver código</button>
    <button class="btn principal peq" data-a="compilar">Compilar</button></div></div><div class="lienzo-visor" style="border:0"></div></section>`);
  centro.append(panelGrafo);
  const zonaGrafo = $('.lienzo-visor', panelGrafo);
  let grafo = null;
  let editorGen = null;

  function grafoActual() {
    const k = doc.vista.grafo;
    if (!bp().grafos[k]) { doc.vista.grafo = 'eventos'; }
    return bp().grafos[doc.vista.grafo];
  }

  function defNodo(n) {
    const d = NODOS[n.def];
    if (!d) return { titulo: n.def + ' (desconocido)', cabecera: '#5A2020', entradas: [], salidas: [] };
    const cat = CATEGORIAS.find(c => c.id === d.cat);
    const { entradas, salidas } = pinesDe(n, bp());
    const campo = (t) => t === 'texto' || t === 'cualquiera' ? 'texto' : t === 'decimal' || t === 'entero' ? 'numero' : t === 'bool' ? 'bool' : t === 'opcion' ? 'opcion' : null;
    const ent = entradas.map(p => ({ n: p.n, t: p.t === 'opcion' ? 'opcion' : p.t, etq: p.etq, def: p.def, campo: p.t === 'exec' ? null : campo(p.t), opciones: d.opciones && d.opciones[p.n], conectable: !d.soloValor && p.t !== 'opcion' && !(n.def.startsWith('ob_') && p.n === 'miembro') }));
    if (n.def === 'var_obtener') {
      const v = bp().variables.find(x => x.nombre === n.variable);
      return { compacto: true, titulo: n.variable || '¿variable?', sub: v ? NOMBRE_TIPO[v.tipo] : 'no existe', entradas: [], salidas: salidas.map(p => ({ n: p.n, t: p.t, etq: '' })) };
    }
    if (d.compacto) return { compacto: true, titulo: d.titulo, entradas: ent.map(p => ({ ...p, etq: '' })), salidas: salidas.map(p => ({ n: p.n, t: p.t, etq: '' })) };
    return {
      titulo: tituloNodo(n), sub: d.subtitulo && d.evento ? '' : '', cabecera: cat ? cat.cabecera : '#2A322E',
      icono: d.evento ? 'rayo' : n.def === 'lg_si' ? 'cadena' : null,
      entradas: ent, salidas: salidas.map(p => ({ n: p.n, t: p.t, etq: p.etq })),
    };
  }

  function montarGrafo() {
    if (grafo) grafo.destruir();
    zonaGrafo.innerHTML = '';
    const clave = doc.vista.grafo;
    doc.vista.vistas[clave] ||= {};
    grafo = crearGrafo(zonaGrafo, {
      grafo: grafoActual,
      definicion: defNodo,
      colorTipo: (t) => (TIPOS_DATO[t] || TIPOS_DATO.cualquiera).color,
      compatibles,
      vista: doc.vista.vistas[clave],
      cambiar: (fn, o = {}) => doc.cambiar(() => fn(grafoActual()), { ...o, grafo: true }),
      errores: () => new Set(resultado.errores.map(e => e.nodo)),
      alSeleccionar: (ids) => { seleccion = ids; varSel = null; pintarDetalles(); resaltarCodigo(); },
      alPaleta: (x, y, ctx) => paleta(x, y, ctx),
      alAviso: (t) => avisar(t, 'aviso'),
      protegidos: () => new Set(grafoActual().nodos.filter(n => n.def === 'fn_entrada').map(n => n.id)),
      alSoltarExterno: (e, [x, y]) => {
        const v = e.dataTransfer.getData('text/falcon-variable');
        if (v) { anadirNodo(e.altKey || e.ctrlKey ? 'var_fijar' : 'var_obtener', x, y, { variable: v }); return; }
        const d = e.dataTransfer.getData('text/falcon-bloque');
        if (d) anadirNodo(d, x, y);
      },
    });
    pintarMigas();
  }

  function pintarMigas() {
    const m = $('.migas', panelGrafo);
    const k = doc.vista.grafo;
    m.innerHTML = `<span class="parte">${esc(doc.nombre)}</span>${icono('flechaDerecha', '', 13)}<b>${k === 'eventos' ? 'Grafo de eventos' : 'Función ' + esc(k.slice(3))}</b>`;
    if (k !== 'eventos') { m.querySelector('.parte').style.cursor = 'pointer'; m.querySelector('.parte').onclick = () => irAGrafo('eventos'); }
  }

  function irAGrafo(k) {
    if (doc.vista.grafo === k && grafo) return;
    doc.vista.grafo = k;
    seleccion = [];
    montarGrafo();
    pintarPanelBp();
    pintarDetalles();
  }

  function anadirNodo(def, x, y, extra = {}) {
    if (x === null || x === undefined) {
      const r = zonaGrafo.getBoundingClientRect();
      const v = doc.vista.vistas[doc.vista.grafo];
      x = (r.width / 2 - v.x) / v.zoom - 80 + Math.random() * 40;
      y = (r.height / 2 - v.y) / v.zoom - 40 + Math.random() * 40;
    }
    const n = { id: idNodoBp(), def, x: Math.round(x), y: Math.round(y), ...extra };
    doc.cambiar(() => { grafoActual().nodos.push(n); }, { grafo: true });
    return n;
  }

  // Paleta para buscar bloques (Espacio, clic derecho o soltar un cable en vacío).
  function paleta(cx, cy, ctx) {
    return new Promise((resolver) => {
      document.querySelector('.paleta-nodos')?.remove();
      const p = el(`<div class="paleta-nodos"><input class="campo" placeholder="Buscar bloque…"><div class="lista"></div></div>`);
      document.body.append(p);
      const r = p.getBoundingClientRect();
      p.style.left = Math.min(cx, innerWidth - 310) + 'px';
      p.style.top = Math.min(cy, innerHeight - 390) + 'px';
      const input = $('input', p), lista = $('.lista', p);
      let foco = 0, items = [];
      const opciones = () => {
        const base = Object.values(NODOS).filter(d => !d.oculto && !d.variable && !d.funcion).map(d => ({ def: d.id, titulo: d.titulo, cat: d.cat }));
        for (const v of bp().variables) {
          base.push({ def: 'var_obtener', titulo: `Obtener ${v.nombre}`, cat: 'Variables', extra: { variable: v.nombre } });
          base.push({ def: 'var_fijar', titulo: `Fijar ${v.nombre}`, cat: 'Variables', extra: { variable: v.nombre } });
          if (v.tipo === 'decimal' || v.tipo === 'entero') base.push({ def: 'var_sumar', titulo: `Sumar a ${v.nombre}`, cat: 'Variables', extra: { variable: v.nombre } });
        }
        for (const f of bp().funciones) base.push({ def: 'fn_llamar', titulo: `Llamar ${f.nombre}`, cat: 'Variables', extra: { funcion: f.nombre } });
        if (doc.vista.grafo !== 'eventos') base.push({ def: 'fn_devolver', titulo: 'Devolver', cat: 'Variables' });
        return base.filter(o => {
          if (!ctx || !ctx.desde) return true;
          const tmp = { def: o.def, ...(o.extra || {}) };
          const { entradas, salidas } = pinesDe(tmp, bp());
          const lista2 = ctx.desde.lado === 's' ? entradas : salidas;
          if (NODOS[o.def].soloValor && ctx.desde.lado === 's') return false;
          return lista2.some(pp => ctx.desde.lado === 's' ? compatibles(ctx.desde.tipo, pp.t) : compatibles(pp.t, ctx.desde.tipo));
        });
      };
      const pintarLista = () => {
        const q = input.value.toLowerCase();
        items = opciones().filter(o => !q || o.titulo.toLowerCase().includes(q) || o.cat.toLowerCase().includes(q));
        foco = Math.min(foco, Math.max(0, items.length - 1));
        let cat = '';
        lista.innerHTML = '';
        items.forEach((o, i) => {
          if (o.cat !== cat) { cat = o.cat; lista.append(el(`<div class="cat">${esc(cat)}</div>`)); }
          const c = CATEGORIAS.find(x => x.id === o.cat);
          const it = el(`<div class="item ${i === foco ? 'foco' : ''}"><span class="marca-cat" style="background:${c ? c.color : '#888'}"></span>${esc(o.titulo)}</div>`);
          it.onmousedown = (e) => { e.preventDefault(); elegir(o); };
          lista.append(it);
        });
        if (!items.length) lista.append(el('<div class="vacio-texto">Ningún bloque encaja</div>'));
        lista.querySelector('.foco')?.scrollIntoView({ block: 'nearest' });
      };
      const cerrar = (v) => { p.remove(); document.removeEventListener('mousedown', fuera, true); resolver(v); };
      const elegir = (o) => cerrar(anadirNodo(o.def, ctx.x, ctx.y, o.extra || {}));
      const fuera = (e) => { if (!p.contains(e.target)) cerrar(null); };
      setTimeout(() => document.addEventListener('mousedown', fuera, true));
      input.oninput = () => { foco = 0; pintarLista(); };
      input.onkeydown = (e) => {
        if (e.key === 'ArrowDown') { foco = Math.min(items.length - 1, foco + 1); pintarLista(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { foco = Math.max(0, foco - 1); pintarLista(); e.preventDefault(); }
        if (e.key === 'Enter' && items[foco]) elegir(items[foco]);
        if (e.key === 'Escape') cerrar(null);
        e.stopPropagation();
      };
      pintarLista();
      input.focus();
    });
  }

  // ---------- Panel inferior con el Águila generado ----------
  const inferior = crearInferior(centro, {
    pestanas: ['salida', 'depurador', 'generado'],
    inicial: est._pestanaBp || 'generado',
    extra: {
      generado: {
        titulo: 'Águila · generado',
        derecha: (c) => c.append(el(`<span class="info-derecha">generado/${esc(doc.nombre.replace(/\.bp$/, ''))}.agl · solo lectura</span>`)),
        pintar: (c) => {
          editorGen = crearEditorCodigo(c, { texto: resultado.codigo, soloLectura: true, tamFuente: 13 });
          resaltarCodigo();
          return () => { editorGen && editorGen.destruir(); editorGen = null; };
        },
      },
    },
  });
  partes.push(inferior);

  function resaltarCodigo() {
    if (!editorGen) return;
    const id = seleccion[seleccion.length - 1];
    editorGen.resaltar(id ? resultado.lineas[id] || 0 : 0);
  }

  // ---------- Derecha: Detalles y ayuda ----------
  let pestanaDer = 'detalles';
  const panelDer = el(`<section class="panel" style="flex:1"><div class="pestanas"><button data-p="detalles" class="activo">Detalles</button><button data-p="ayuda">Ayuda del nodo</button></div><div class="desplazable detalles-nodo"></div></section>`);
  der.append(panelDer);
  $$('.pestanas button', panelDer).forEach(b => b.onclick = () => { pestanaDer = b.dataset.p; $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x === b)); pintarDetalles(); });

  function leyendaTipos() {
    const tipos = ['exec', 'bool', 'decimal', 'entero', 'texto', 'objeto'];
    return `<div class="titulo-seccion" style="margin:18px 0 10px">Tipos de dato</div><div class="tipos-dato">${tipos.map(t => `<span>${t === 'exec' ? '<span style="display:inline-block;width:9px;height:11px;background:#E7EDE9;clip-path:polygon(0 0,60% 0,100% 50%,60% 100%,0 100%)"></span>' : `<i style="background:${TIPOS_DATO[t].color}"></i>`}${TIPOS_DATO[t].nombre}</span>`).join('')}</div>`;
  }

  function pintarDetalles() {
    const c = $('.detalles-nodo', panelDer);
    const g = grafoActual();
    const n = seleccion.length === 1 ? g.nodos.find(x => x.id === seleccion[0]) : null;
    if (varSel && !n) return pintarVariable(c);
    if (!n) {
      c.innerHTML = `<div class="cab-nodo-bp"><div class="caja-ico" style="color:var(--verde)">${icono('blueprint', '', 18)}</div><div><b>${esc(doc.nombre)}</b><span>Blueprint · ${bp().base ? esc(bp().base) : 'cualquier nodo'}</span></div></div>
        <p>${seleccion.length > 1 ? `${seleccion.length} bloques seleccionados. Pulsa Supr para borrarlos o C para rodearlos con un comentario.` : 'Selecciona un bloque para ver qué hace y cómo está conectado. Pulsa <b>Espacio</b> o haz clic derecho en el grafo para añadir bloques.'}</p>
        ${resultado.errores.length ? `<div class="problema"><span class="marca-problema">!</span><div><b>${esc(resultado.errores[0].mensaje)}</b></div></div>` : ''}
        ${resultado.avisos.slice(0, 4).map(a => `<div class="problema aviso"><span class="marca-problema">!</span><div class="crece" data-nodo="${esc(a.nodo)}"><span>${esc(a.mensaje)}</span></div></div>`).join('')}
        ${leyendaTipos()}<button class="btn principal ancho grande" data-a="probar" style="margin-top:20px">${icono('play', '', 14)}Compilar y probar</button>`;
      $$('[data-nodo]', c).forEach(x => x.onclick = () => grafo.centrarEn(x.dataset.nodo));
      $('[data-a=probar]', c).onclick = compilarYProbar;
      return;
    }
    const d = NODOS[n.def] || {};
    const def = defNodo(n);
    if (pestanaDer === 'ayuda') {
      c.innerHTML = `<div class="cab-nodo-bp"><div class="caja-ico">${icono(ICONO_CAT[d.cat] || 'blueprint', '', 18)}</div><div><b>${esc(tituloNodo(n))}</b><span>${esc(d.cat || '')}</span></div></div><p>${esc(d.ayuda || '')}</p>
        ${resultado.lineas[n.id] ? `<div class="titulo-seccion" style="margin-bottom:8px">En Águila</div><pre style="margin:0;padding:12px;border-radius:10px;background:var(--fondo);border:1px solid var(--borde);font:13px/1.7 var(--mono);white-space:pre-wrap">${esc(resultado.codigo.split('\n')[resultado.lineas[n.id] - 1].trim())}</pre>` : ''}`;
      return;
    }
    const conexiones = g.conexiones;
    const linea = (p, lado) => {
      const cs = conexiones.filter(x => lado === 'e' ? x.a === n.id && x.entrada === p.n : x.de === n.id && x.salida === p.n);
      const otros = cs.map(x => { const o = g.nodos.find(y => y.id === (lado === 'e' ? x.de : x.a)); return o ? tituloNodo(o) : '?'; });
      const marca = p.t === 'exec' ? `<span style="display:inline-block;width:9px;height:11px;background:${lado === 's' && !cs.length ? 'none' : '#E7EDE9'};border:${lado === 's' && !cs.length ? '1.5px solid #E7EDE9' : '0'};clip-path:polygon(0 0,60% 0,100% 50%,60% 100%,0 100%)"></span>` : `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${(TIPOS_DATO[p.t] || TIPOS_DATO.cualquiera).color}"></i>`;
      return `<div class="conex">${marca}${esc(p.etq || p.n || (lado === 'e' ? 'entrada' : 'salida'))}<span class="dest">${otros.length ? (lado === 'e' ? '← ' : '→ ') + esc(otros.join(', ')) : 'sin conectar'}</span></div>`;
    };
    const pines = [...def.entradas.filter(p => p.conectable !== false && (p.t !== 'exec' || p.etq)).map(p => linea(p, 'e')), ...def.salidas.map(p => linea(p, 's'))];
    c.innerHTML = `<div class="cab-nodo-bp"><div class="caja-ico">${icono(n.def === 'lg_si' ? 'cadena' : ICONO_CAT[d.cat] || 'blueprint', '', 18)}</div><div><b>${esc(tituloNodo(n))}</b><span>${esc(n.def === 'lg_si' ? 'Control de flujo' : d.cat || '')}</span></div></div>
      <p>${esc(d.ayuda || '')}</p>
      ${pines.length ? `<div class="titulo-seccion" style="margin-bottom:10px">Conexiones</div>${pines.join('')}` : ''}
      ${resultado.errores.filter(e => e.nodo === n.id).map(e => `<div class="problema"><span class="marca-problema">!</span><div><b>${esc(e.mensaje)}</b></div></div>`).join('')}
      ${leyendaTipos()}<button class="btn principal ancho grande" data-a="probar" style="margin-top:20px">${icono('play', '', 14)}Compilar y probar</button>`;
    $('[data-a=probar]', c).onclick = compilarYProbar;
  }

  function pintarVariable(c) {
    const v = bp().variables.find(x => x.nombre === varSel);
    if (!v) { varSel = null; return pintarDetalles(); }
    c.innerHTML = `<div class="cab-nodo-bp"><div class="caja-ico"><span class="punto-tipo" style="display:block;width:12px;height:12px;border-radius:50%;background:${COLOR_VAR[v.tipo]}"></span></div><div><b>${esc(v.nombre)}</b><span>Variable · ${esc(NOMBRE_TIPO[v.tipo])}</span></div></div>
      <div class="prop"><label>Valor inicial</label><div class="valor">${v.tipo === 'bool' ? interruptor(!!v.valor, v.valor ? 'Verdadero' : 'Falso') : `<input class="campo ${v.tipo === 'texto' ? '' : 'mono'}" value="${esc(v.valor ?? '')}">`}</div></div>
      <div class="prop"><label>Inspector</label><div class="valor">${interruptor(!!v.exportar, v.exportar ? 'Visible' : 'Oculta', 'exp')}</div></div>
      <p style="color:var(--texto-2);font-size:13px">Arrastra la variable al grafo para leerla (con Alt, para cambiarla). Si es visible en el Inspector, cada nodo puede tener su propio valor.</p>
      <div style="display:flex;gap:8px"><button class="btn secundario crece" data-a="editar">${icono('lapiz', '', 14)}Editar</button><button class="btn peligro" data-a="borrar">${icono('papelera', '', 14)}</button></div>`;
    const inp = c.querySelector('.valor input:not([type=checkbox])');
    if (inp) inp.onchange = () => doc.cambiar(() => { v.valor = v.tipo === 'texto' ? inp.value : Number(inp.value.replace(',', '.')) || 0; });
    const chk = c.querySelector('.valor input[type=checkbox]:not([data-campo])');
    if (chk) chk.onchange = () => doc.cambiar(() => { v.valor = chk.checked; });
    c.querySelector('[data-campo=exp]').onchange = (e) => doc.cambiar(() => { v.exportar = e.target.checked; });
    c.querySelector('[data-a=editar]').onclick = () => editarVariable(v);
    c.querySelector('[data-a=borrar]').onclick = () => borrarVariable(v);
  }

  async function editarVariable(v) {
    const nueva = !v;
    const datos = v ? { ...v } : { nombre: '', tipo: 'decimal', valor: 0, exportar: true };
    const c = el(`<div>
      <div class="fila"><label class="etiqueta-campo">Nombre</label><input class="campo mono" data-k="nombre" value="${esc(datos.nombre)}" placeholder="velocidad"></div>
      <div class="fila"><label class="etiqueta-campo">Tipo</label><select class="campo" data-k="tipo">${Object.entries(NOMBRE_TIPO).map(([k, t]) => `<option value="${k}" ${k === datos.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="fila"><label class="etiqueta-campo">Valor inicial</label><input class="campo mono" data-k="valor" value="${esc(datos.valor ?? '')}"></div>
      <div class="fila">${interruptor(datos.exportar, 'Mostrar en el Inspector (exportar)', 'exportar')}</div></div>`);
    const r = await dialogo({
      titulo: nueva ? 'Nueva variable' : 'Editar variable', contenido: c,
      botones: [{ texto: 'Cancelar', valor: null }, {
        texto: nueva ? 'Crear' : 'Guardar', tipo: 'principal', accion: () => {
          const nombre = $('[data-k=nombre]', c).value.trim();
          if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nombre)) { avisar('El nombre solo puede tener letras, números y _ (sin empezar por número).', 'error'); return false; }
          if (bp().variables.some(x => x.nombre === nombre && x !== v)) { avisar('Ya hay una variable con ese nombre.', 'error'); return false; }
          const tipo = $('[data-k=tipo]', c).value;
          let valor = $('[data-k=valor]', c).value;
          if (tipo === 'decimal' || tipo === 'entero') valor = Number(valor.replace(',', '.')) || 0;
          if (tipo === 'entero') valor = Math.round(valor);
          if (tipo === 'bool') valor = valor === 'verdadero' || valor === 'true' || valor === '1';
          if (tipo === 'objeto' || tipo === 'lista') valor = null;
          return { nombre, tipo, valor, exportar: $('[data-campo=exportar]', c).checked };
        },
      }],
    });
    if (!r) return;
    doc.cambiar((b) => {
      if (nueva) bp().variables.push(r);
      else {
        // Renombrar también en los bloques que la usan.
        if (r.nombre !== v.nombre) for (const g of Object.values(bp().grafos)) for (const n of g.nodos) if (n.variable === v.nombre) n.variable = r.nombre;
        Object.assign(v, r);
      }
    });
    varSel = r.nombre;
    pintarPanelBp(); pintarDetalles();
  }

  async function borrarVariable(v) {
    const usos = Object.values(bp().grafos).flatMap(g => g.nodos).filter(n => n.variable === v.nombre).length;
    if (usos && !(await confirmar({ titulo: `¿Borrar «${v.nombre}»?`, mensaje: `Se usa en ${usos} bloque(s), que también se borrarán.`, aceptar: 'Borrar', peligro: true }))) return;
    doc.cambiar(() => {
      bp().variables = bp().variables.filter(x => x !== v);
      for (const g of Object.values(bp().grafos)) {
        const quitar = new Set(g.nodos.filter(n => n.variable === v.nombre).map(n => n.id));
        g.nodos = g.nodos.filter(n => !quitar.has(n.id));
        g.conexiones = g.conexiones.filter(c => !quitar.has(c.de) && !quitar.has(c.a));
      }
    });
    varSel = null;
  }

  async function nuevaFuncion() {
    const nombre = await pedirTexto({ titulo: 'Nueva función', etiqueta: 'Nombre de la función', valor: '', placeholder: 'recoger_moneda', validar: (x) => !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(x) ? 'Usa letras, números y _' : bp().funciones.some(f => f.nombre === x) ? 'Ya existe' : null });
    if (!nombre) return;
    doc.cambiar(() => {
      bp().funciones.push({ nombre, params: [] });
      bp().grafos['fn:' + nombre] = { nodos: [{ id: idNodoBp(), def: 'fn_entrada', funcion: nombre, x: 60, y: 60 }], conexiones: [], comentarios: [] };
    });
    irAGrafo('fn:' + nombre);
  }

  async function borrarFuncion(nombre) {
    if (!(await confirmar({ titulo: `¿Borrar la función «${nombre}»?`, mensaje: 'Se borrará su grafo y las llamadas a ella.', aceptar: 'Borrar', peligro: true }))) return;
    if (doc.vista.grafo === 'fn:' + nombre) irAGrafo('eventos');
    doc.cambiar(() => {
      bp().funciones = bp().funciones.filter(f => f.nombre !== nombre);
      delete bp().grafos['fn:' + nombre];
      for (const g of Object.values(bp().grafos)) {
        const quitar = new Set(g.nodos.filter(n => n.funcion === nombre && n.def === 'fn_llamar').map(n => n.id));
        g.nodos = g.nodos.filter(n => !quitar.has(n.id));
        g.conexiones = g.conexiones.filter(c => !quitar.has(c.de) && !quitar.has(c.a));
      }
    });
  }

  // ---------- Compilación ----------
  function pintarEstado() {
    const e = $('.estado-compilado', panelGrafo);
    if (resultado.errores.length) { e.className = 'estado-compilado mal'; e.innerHTML = `${icono('alerta', '', 14)}${resultado.errores.length} error${resultado.errores.length > 1 ? 'es' : ''}`; }
    else if (doc.sucio) { e.className = 'estado-compilado pendiente'; e.innerHTML = `${icono('info', '', 14)}Sin compilar`; }
    else { e.className = 'estado-compilado'; e.innerHTML = `${icono('check', '', 14)}Compilado a Águila`; }
  }
  async function compilar() { await guardar(doc); pintarEstado(); }
  async function compilarYProbar() { await guardar(doc); await probar(); }
  $('[data-a=compilar]', panelGrafo).onclick = compilar;
  $('[data-a=codigo]', panelGrafo).onclick = () => { est._pestanaBp = 'generado'; inferior.mostrar('generado'); };

  const recompilar = () => {
    resultado = compilarBlueprint(bp(), doc.nombre);
    if (editorGen) { editorGen.fijar(resultado.codigo); resaltarCodigo(); }
    pintarEstado();
  };

  montarGrafo();
  pintarPanelBp();
  pintarCatalogo();
  pintarDetalles();
  pintarEstado();
  if (!doc.vista.vistas.eventos?._visto) { doc.vista.vistas.eventos._visto = true; }

  const quitar = [
    bus.on('doc:cambio', ({ doc: d, op }) => {
      if (d !== doc) return;
      recompilar();
      if (op && op.soloPosicion) return;
      if (!bp().grafos[doc.vista.grafo]) doc.vista.grafo = 'eventos';
      grafo.pintar();
      pintarPanelBp();
      pintarDetalles();
      anotarEvento('bp_editado');
    }),
    bus.on('doc:guardado', (d) => { if (d === doc) pintarEstado(); }),
    bus.on('doc:sucio', (d) => { if (d === doc) pintarEstado(); }),
  ];
  return {
    destruir: () => { quitar.forEach(f => f()); grafo && grafo.destruir(); partes.forEach(p => p.destruir && p.destruir()); },
    grafo: () => grafo,
  };
}

