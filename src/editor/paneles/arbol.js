// Panel «Escena»: árbol de nodos con filtro, visibilidad, arrastrar para reorganizar y menú contextual.
import { est, bus, archivosDeTipo, abrirDocumento } from '../estado.js';
import { seleccionar, nuevoBlueprint, nuevoScript } from '../acciones.js';
import { anadirNodo, eliminarNodos, duplicarNodos, copiarNodos, pegarNodos, moverNodo, renombrarNodo, cambiarProp, cambiarNodo, tiposMenu } from '../operaciones.js';
import { tipo as tipoNodo, COLORES_FAMILIA, buscarNodo, recorrer, crearNodo, clonarNodo } from '../../motor/tipos.js';
import { sinExtension, normalizarEscena, nombreBase } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu, menuBajo } from '../../ui/componentes.js';

export function menuTipos(x, y, doc, padre) {
  const items = [];
  for (const [grupo, tipos] of tiposMenu(doc.dim)) {
    items.push({ cabecera: grupo });
    for (const t of tipos) {
      const d = tipoNodo(t);
      items.push({ texto: d.nombreVisible, icono: d.icono, accion: () => anadirNodo(doc, t, { padre }) });
    }
  }
  return menu(x, y, items);
}

export function crearArbol(contenedor) {
  let pestana = 'escena';
  let filtro = '';
  let renombrando = null;
  const raiz = el(`<section class="panel" style="flex:1.2">
    <div class="cab-panel"><div class="pestanas"><button data-p="escena" class="activo">Escena</button><button data-p="importar">Importar</button></div><button class="btn-mas" data-ayuda="Añadir nodo">${icono('mas', '', 16)}</button></div>
    <div class="filtro"><div class="buscador">${icono('buscar', '', 15)}<input class="campo" placeholder="Filtrar nodos"></div></div>
    <div class="desplazable"><div class="arbol" tabindex="0"></div></div></section>`);
  contenedor.append(raiz);
  const arbol = $('.arbol', raiz);
  const inputFiltro = $('.filtro input', raiz);

  $$('.pestanas button', raiz).forEach(b => b.onclick = () => {
    pestana = b.dataset.p;
    $$('.pestanas button', raiz).forEach(x => x.classList.toggle('activo', x === b));
    $('.filtro', raiz).classList.toggle('oculto', pestana !== 'escena');
    pintar();
  });
  $('.btn-mas', raiz).onclick = (e) => {
    const doc = est.activo;
    if (!doc || doc.tipo !== 'escena') return;
    const r = e.currentTarget.getBoundingClientRect();
    menuTipos(r.left, r.bottom + 4, doc);
  };
  inputFiltro.oninput = () => { filtro = inputFiltro.value.toLowerCase(); pintar(); };

  function pintar() {
    const doc = est.activo;
    arbol.innerHTML = '';
    if (!doc || doc.tipo !== 'escena') { arbol.append(el('<div class="vacio-texto">Abre una escena para ver sus nodos.</div>')); return; }
    if (pestana === 'importar') return pintarImportar(doc);
    const plegados = doc.vista.plegados ||= new Set();
    const coincide = (n) => !filtro || n.nombre.toLowerCase().includes(filtro) || tipoNodo(n.tipo).nombreVisible.toLowerCase().includes(filtro);
    const visitar = (n, nivel) => {
      const hijosVisibles = n.hijos.filter(h => !filtro || algunoCoincide(h));
      const visible = coincide(n);
      if (visible || hijosVisibles.length) {
        const d = tipoNodo(n.tipo);
        const plegado = plegados.has(n.id) && !filtro;
        const fila = el(`<div class="fila-nodo ${doc.seleccion.includes(n.id) ? 'sel' : ''} ${n.visible === false ? 'oculto-nodo' : ''}" data-id="${n.id}" draggable="${nivel > 0}" style="padding-left:${6 + nivel * 16}px">
          <span class="flecha ${n.hijos.length ? '' : 'vacia'} ${plegado ? 'cerrada' : ''}">${icono('flechaAbajo', '', 12)}</span>
          <span style="color:${COLORES_FAMILIA[d.familia]}">${icono(d.icono, '', 16)}</span>
          <span class="nombre-nodo">${renombrando === n.id ? `<input value="${esc(n.nombre)}">` : esc(n.nombre)}</span>
          ${n.blueprint || n.script ? `<span class="logica" data-ayuda="${esc([n.blueprint, n.script].filter(Boolean).join(' · '))}">${icono(n.blueprint ? 'blueprint' : 'codigo', '', 15)}</span>` : ''}
          <span class="ojo ${n.visible === false ? 'apagado' : ''}" data-ayuda="${n.visible === false ? 'Mostrar' : 'Ocultar'}">${icono(n.visible === false ? 'ojoCerrado' : 'ojo', '', 15)}</span>
        </div>`);
        arbol.append(fila);
        if (!plegado) for (const h of hijosVisibles) visitar(h, nivel + 1);
      }
    };
    const algunoCoincide = (n) => coincide(n) || n.hijos.some(algunoCoincide);
    visitar(doc.datos.raiz, 0);
    const input = arbol.querySelector('.nombre-nodo input');
    if (input) {
      input.focus(); input.select();
      const fin = (ok) => { const id = renombrando; renombrando = null; if (ok && input.value.trim()) renombrarNodo(doc, id, input.value); else pintar(); };
      input.onkeydown = (e) => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); e.stopPropagation(); };
      input.onblur = () => fin(true);
    }
  }

  function pintarImportar(doc) {
    const cont = el('<div style="padding:0 2px"></div>');
    const grupo = (titulo, lista, fn, ico) => {
      if (!lista.length) return;
      cont.append(el(`<div class="titulo-seccion" style="padding:8px 8px 6px">${titulo}</div>`));
      for (const a of lista) {
        const f = el(`<div class="fila-archivo" data-ayuda="Añadir a la escena">${icono(ico, '', 15)}<span>${esc(a.nombre)}</span></div>`);
        f.onclick = () => fn(a.rel);
        cont.append(f);
      }
    };
    const escenas = est.archivos.filter(a => a.rel.endsWith('.fscn') && a.rel !== doc.rel);
    grupo('Escenas (como copia)', escenas, async (rel) => {
      const e = normalizarEscena(await est.proyecto.leer(rel));
      if (e.tipo !== doc.dim) { const { avisar } = await import('../../ui/componentes.js'); avisar(`No se puede meter una escena ${e.tipo} en una escena ${doc.dim}.`, 'aviso'); return; }
      anadirNodo(doc, e.raiz.tipo, { nodo: clonarNodo(e.raiz), nombre: e.raiz.nombre });
    }, 'escena');
    if (doc.dim === '2D') grupo('Imágenes → Sprite', archivosDeTipo('imagen'), (rel) => {
      const a = est.proyecto.ajustesImportacion(rel);
      anadirNodo(doc, 'Sprite', { nombre: sinExtension(rel).replace(/^./, c => c.toUpperCase()), props: { imagen: rel }, posicion: centroVista(doc) });
      ajustarTamanoImagen(doc, rel, a);
    }, 'imagen');
    if (doc.dim === '3D') grupo('Modelos → Malla3D', [...archivosDeTipo('modelo'), ...archivosDeTipo('malla')], (rel) => anadirNodo(doc, 'Malla3D', { nombre: sinExtension(rel).replace(/^./, c => c.toUpperCase()), props: { malla: rel } }), 'cubo');
    grupo('Sonidos → Sonido', archivosDeTipo('sonido'), (rel) => anadirNodo(doc, 'Sonido', { nombre: sinExtension(rel).replace(/^./, c => c.toUpperCase()), props: { sonido: rel } }), 'altavoz');
    if (!cont.children.length) cont.append(el('<div class="vacio-texto">No hay recursos que añadir. Impórtalos desde el modo Recursos.</div>'));
    arbol.append(cont);
  }

  // ---------- Interacción ----------
  arbol.addEventListener('click', (e) => {
    const doc = est.activo;
    const fila = e.target.closest('.fila-nodo');
    if (!fila || !doc) return;
    const id = fila.dataset.id;
    if (e.target.closest('.flecha')) {
      const pl = doc.vista.plegados ||= new Set();
      pl.has(id) ? pl.delete(id) : pl.add(id);
      pintar();
      return;
    }
    if (e.target.closest('.ojo')) {
      const n = buscarNodo(doc.datos.raiz, id);
      cambiarProp(doc, id, 'visible', n.visible === false, { fusionar: null });
      return;
    }
    if (e.target.closest('.logica')) {
      const n = buscarNodo(doc.datos.raiz, id);
      abrirDocumento(n.blueprint || n.script);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const s = doc.seleccion.includes(id) ? doc.seleccion.filter(x => x !== id) : [...doc.seleccion, id];
      seleccionar(s, doc);
    } else seleccionar([id], doc);
  });
  arbol.addEventListener('dblclick', (e) => {
    const fila = e.target.closest('.fila-nodo');
    if (!fila || e.target.closest('.ojo, .flecha')) return;
    renombrando = fila.dataset.id;
    pintar();
  });
  arbol.addEventListener('keydown', (e) => {
    const doc = est.activo;
    if (!doc || doc.tipo !== 'escena' || e.target.tagName === 'INPUT') return;
    if (e.key === 'F2' && doc.nodoSel) { renombrando = doc.nodoSel.id; pintar(); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const filas = $$('.fila-nodo', arbol);
      const i = filas.findIndex(f => f.classList.contains('sel'));
      const j = Math.max(0, Math.min(filas.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      if (filas[j]) seleccionar([filas[j].dataset.id], doc);
      e.preventDefault();
    }
  });
  arbol.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const doc = est.activo;
    const fila = e.target.closest('.fila-nodo');
    if (!doc || doc.tipo !== 'escena') return;
    if (fila && !doc.seleccion.includes(fila.dataset.id)) seleccionar([fila.dataset.id], doc);
    const n = doc.nodoSel || doc.datos.raiz;
    const esRaiz = n === doc.datos.raiz;
    menu(e.clientX, e.clientY, [
      { texto: 'Añadir nodo hijo…', icono: 'mas', accion: () => menuTipos(e.clientX, e.clientY, doc, n.id) },
      { texto: 'Renombrar', icono: 'lapiz', atajo: 'F2', accion: () => { renombrando = n.id; pintar(); } },
      { texto: 'Duplicar', icono: 'copiar', atajo: 'Ctrl D', accion: () => duplicarNodos(doc), desactivado: esRaiz },
      { texto: 'Copiar', atajo: 'Ctrl C', accion: () => copiarNodos(doc), desactivado: esRaiz },
      { texto: 'Pegar', atajo: 'Ctrl V', accion: () => pegarNodos(doc), desactivado: !est.portapapeles },
      '-',
      n.blueprint ? { texto: 'Abrir Blueprint', icono: 'blueprint', accion: () => abrirDocumento(n.blueprint) } : { texto: 'Añadir Blueprint', icono: 'blueprint', accion: async () => { const r = await nuevoBlueprint(n); if (r) { cambiarNodo(doc, n.id, x => { x.blueprint = r; }); abrirDocumento(r); } } },
      n.script ? { texto: 'Abrir script', icono: 'codigo', accion: () => abrirDocumento(n.script) } : { texto: 'Escribir en Águila', icono: 'codigo', accion: async () => { const r = await nuevoScript(n); if (r) { cambiarNodo(doc, n.id, x => { x.script = r; }); abrirDocumento(r); } } },
      { texto: 'Guardar rama como escena…', icono: 'escena', desactivado: esRaiz, accion: () => guardarRama(doc, n) },
      '-',
      { texto: 'Eliminar', icono: 'papelera', atajo: 'Supr', peligro: true, desactivado: esRaiz, accion: () => eliminarNodos(doc) },
    ]);
  });

  // Arrastrar y soltar para reorganizar.
  let arrastrando = null;
  arbol.addEventListener('dragstart', (e) => {
    const f = e.target.closest('.fila-nodo');
    if (!f) return;
    arrastrando = f.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/falcon-nodo', arrastrando);
  });
  const limpiarMarcas = () => $$('.arrastre-dentro, .arrastre-antes, .arrastre-despues', arbol).forEach(x => x.classList.remove('arrastre-dentro', 'arrastre-antes', 'arrastre-despues'));
  const zona = (f, e) => {
    const r = f.getBoundingClientRect();
    const y = e.clientY - r.top;
    return y < r.height * 0.28 ? 'antes' : y > r.height * 0.72 ? 'despues' : 'dentro';
  };
  arbol.addEventListener('dragover', (e) => {
    const f = e.target.closest('.fila-nodo');
    if (!f || !arrastrando) return;
    e.preventDefault();
    limpiarMarcas();
    f.classList.add('arrastre-' + zona(f, e));
  });
  arbol.addEventListener('dragleave', limpiarMarcas);
  arbol.addEventListener('drop', (e) => {
    const f = e.target.closest('.fila-nodo');
    limpiarMarcas();
    if (!f || !arrastrando) return;
    e.preventDefault();
    const doc = est.activo;
    const destino = f.dataset.id;
    const z = zona(f, e);
    if (destino === arrastrando) return;
    if (z === 'dentro') moverNodo(doc, arrastrando, destino);
    else {
      let padre = null;
      recorrer(doc.datos.raiz, (n) => { if (n.hijos.some(h => h.id === destino)) padre = n; });
      if (!padre) return;
      const i = padre.hijos.findIndex(h => h.id === destino);
      moverNodo(doc, arrastrando, padre.id, z === 'antes' ? i : i + 1);
    }
    arrastrando = null;
  });
  arbol.addEventListener('dragend', () => { arrastrando = null; limpiarMarcas(); });

  pintar();
  const quitar = [bus.on('doc:activo', pintar), bus.on('doc:cambio', ({ doc }) => doc === est.activo && pintar()), bus.on('seleccion', pintar), bus.on('archivos', () => pestana === 'importar' && pintar())];
  return { el: raiz, pintar, destruir: () => quitar.forEach(f => f()) };
}

export function centroVista(doc) {
  const v = doc.vista;
  if (doc.dim === '3D') return [0, 0, 0];
  return v.camara ? [Math.round(v.camara.x), Math.round(v.camara.y)] : [640, 360];
}

// Ajusta el tamaño de un Sprite al de un cuadro de su imagen.
export function ajustarTamanoImagen(doc, rel, aj) {
  const img = new Image();
  img.onload = () => {
    const n = doc.nodoSel;
    if (!n || n.props.imagen !== rel) return;
    const w = Math.round(img.width / (aj.columnas || 1)), h = Math.round(img.height / (aj.filas || 1));
    doc.cambiar(() => { n.props.ancho = w; n.props.alto = h; }, { fusionar: 'tam-img' });
  };
  img.src = est.proyecto.url(rel);
}

async function guardarRama(doc, n) {
  const { pedirTexto } = await import('../../ui/componentes.js');
  const { escenaVacia } = await import('../../motor/proyecto.js');
  const { refrescarArchivos, log } = await import('../estado.js');
  const nombre = await pedirTexto({ titulo: 'Guardar rama como escena', etiqueta: 'Nombre de la escena', valor: n.nombre.toLowerCase() });
  if (!nombre) return;
  const rel = 'escenas/' + nombre.replace(/\.fscn$/i, '') + '.fscn';
  await est.proyecto.escribirJSON(rel, escenaVacia(doc.dim, clonarNodo(n)));
  await refrescarArchivos();
  log(`Escena guardada: ${rel}`, 'ok');
}
