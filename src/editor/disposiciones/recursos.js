// Modo Recursos: navegar, importar y configurar los archivos del proyecto.
import { est, bus, abrirDocumento, documento, refrescarArchivos, escenasQueUsan, log } from '../estado.js';
import { importarArchivos, dialogoImportar, abrirArchivo, renombrarArchivo, borrarArchivo, nuevaCarpeta } from '../acciones.js';
import { anadirNodo } from '../operaciones.js';
import { crearInferior } from '../paneles/inferior.js';
import { TIPOS_RECURSO, tipoRecurso, extension, nombreBase, carpetaDe, sinExtension, normalizarEscena } from '../../motor/proyecto.js';
import { contarNodos } from '../../motor/blueprints.js';
import { recorrer } from '../../motor/tipos.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu, avisar, interruptor, formatoTamano } from '../../ui/componentes.js';

const FILTROS = [
  { id: 'todo', nombre: 'Todo', color: 'var(--texto)' },
  { id: 'imagen', nombre: 'Imágenes', color: 'var(--turquesa)' },
  { id: 'modelo', nombre: 'Modelos 3D', color: 'var(--ambar)' },
  { id: 'sonido', nombre: 'Sonidos', color: 'var(--naranja)' },
  { id: 'fuente', nombre: 'Fuentes', color: 'var(--lila)' },
  { id: 'escena', nombre: 'Escenas', color: 'var(--verde)' },
  { id: 'blueprint', nombre: 'Blueprints', color: 'var(--verde)' },
  { id: 'script', nombre: 'Scripts', color: 'var(--aviso)' },
  { id: 'material', nombre: 'Materiales', color: 'var(--ambar)' },
];

const ETIQUETA = (rel) => {
  const t = tipoRecurso(rel);
  if (t === 'sonido' && /^m[uú]sica\//i.test(rel)) return 'MÚSICA';
  return (TIPOS_RECURSO[t] || {}).etiqueta || extension(rel).toUpperCase();
};

export async function crearDisposicionRecursos(contenedor) {
  const cuerpo = el('<div class="cuerpo"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div>');
  contenedor.append(cuerpo);
  const [izq, centro, der] = cuerpo.children;
  const partes = [];
  const st = est._recursos ||= { carpeta: '', filtro: 'todo', vista: 'cuadricula', abiertas: new Set(['sprites']), busqueda: '' };
  let seleccionado = est.recursoSeleccionado || null;
  est.recursoSeleccionado = null;
  if (seleccionado) st.carpeta = carpetaDe(seleccionado);
  const info = new Map(); // rel → { sub, dims }

  // ---------- Carpetas ----------
  const panelCarp = el(`<section class="panel" style="flex:1.3"><div class="cab-panel"><h3>Carpetas</h3><button class="btn-mas" data-ayuda="Nueva carpeta">${icono('mas', '', 16)}</button></div><div class="desplazable" style="padding:0 6px 8px"></div></section>`);
  const panelFiltro = el(`<section class="panel" style="flex:1"><div class="cab-panel"><h3>Filtrar por tipo</h3></div><div class="filtros-tipo"></div><div class="espacio-proyecto"><b>Espacio del proyecto</b><div class="barra-progreso"><div style="width:0"></div></div><span class="txt-espacio">Calculando…</span></div></section>`);
  izq.append(panelCarp, panelFiltro);
  $('.btn-mas', panelCarp).onclick = () => nuevaCarpeta(st.carpeta);

  function pintarCarpetas() {
    const c = $('.desplazable', panelCarp);
    const carpetas = est.archivos.filter(a => a.carpeta);
    const cuenta = (dir) => est.archivos.filter(a => !a.carpeta && carpetaDe(a.rel) === dir).length;
    const hijas = (dir) => carpetas.filter(a => carpetaDe(a.rel) === dir).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    c.innerHTML = '';
    const fila = (rel, nombre, nivel) => {
      const tiene = hijas(rel).length > 0;
      const abierta = st.abiertas.has(rel) || rel === '';
      const f = el(`<div class="carpeta-arbol ${st.carpeta === rel ? 'sel' : ''}" data-rel="${esc(rel)}" style="padding-left:${6 + nivel * 18}px">
        <span class="flecha" style="width:12px;color:var(--texto-3)">${tiene ? icono(abierta ? 'flechaAbajo' : 'flechaDerecha', '', 11) : ''}</span>${icono(st.carpeta === rel ? 'carpetaAbierta' : 'carpeta', '', 16)}<span>${esc(nombre)}</span>${rel ? `<span class="num">${cuenta(rel) || ''}</span>` : ''}</div>`);
      f.onclick = (e) => {
        if (e.target.closest('.flecha') && tiene) { st.abiertas.has(rel) ? st.abiertas.delete(rel) : st.abiertas.add(rel); pintarCarpetas(); return; }
        st.carpeta = rel; st.abiertas.add(rel); pintarTodo();
      };
      f.ondragover = (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) { e.preventDefault(); f.classList.add('encima'); } };
      f.ondragleave = () => f.classList.remove('encima');
      f.ondrop = async (e) => { f.classList.remove('encima'); const r = e.dataTransfer.getData('text/falcon-archivo'); if (r) await moverA(r, rel); };
      f.oncontextmenu = (e) => { e.preventDefault(); menu(e.clientX, e.clientY, [{ texto: 'Nueva carpeta dentro', icono: 'carpeta', accion: () => nuevaCarpeta(rel) }, { texto: 'Importar aquí…', icono: 'importar', accion: () => dialogoImportar(rel || undefined) }, ...(rel ? ['-', { texto: 'Renombrar…', icono: 'lapiz', accion: () => renombrarArchivo(rel) }, { texto: 'Mover a la papelera', icono: 'papelera', peligro: true, accion: () => borrarArchivo(rel) }] : [])]); };
      c.append(f);
      if (abierta) for (const h of hijas(rel)) fila(h.rel, h.nombre, nivel + 1);
    };
    fila('', 'proyecto://', 0);
  }

  async function moverA(rel, carpeta) {
    const destino = (carpeta ? carpeta + '/' : '') + nombreBase(rel);
    if (destino === rel) return;
    if (est.archivos.some(a => a.rel === destino)) { avisar('Ya hay un archivo con ese nombre en esa carpeta.', 'error'); return; }
    await window.falcon.fs.renombrar(est.proyecto.abs(rel), est.proyecto.abs(destino));
    // Actualiza referencias en escenas.
    for (const f of est.archivos.filter(x => /\.(fscn|mat|malla)$/.test(x.rel))) {
      const d = documento(f.rel);
      if (d) { const t = JSON.stringify(d.datos); if (t.includes(JSON.stringify(rel))) { d.datos = JSON.parse(t.split(JSON.stringify(rel)).join(JSON.stringify(destino))); d.marcarSucio(); } continue; }
      const t = await est.proyecto.leer(f.rel).catch(() => null);
      if (t && t.includes(JSON.stringify(rel))) await est.proyecto.escribir(f.rel, t.split(JSON.stringify(rel)).join(JSON.stringify(destino)));
    }
    if (est.proyecto.importacion[rel]) { est.proyecto.importacion[destino] = est.proyecto.importacion[rel]; delete est.proyecto.importacion[rel]; await est.proyecto.guardarImportacion(); }
    log(`Movido: ${rel} → ${destino}`);
    seleccionado = destino;
    await refrescarArchivos();
  }

  function pintarFiltros() {
    const c = $('.filtros-tipo', panelFiltro);
    c.innerHTML = FILTROS.map(f => `<button class="chip ${st.filtro === f.id ? 'activo' : ''}" data-f="${f.id}"><span class="punto" style="background:${f.color}"></span>${f.nombre}</button>`).join('');
    $$('[data-f]', c).forEach(b => b.onclick = () => { st.filtro = b.dataset.f; pintarTodo(); });
  }

  async function pintarEspacio() {
    const total = await window.falcon.fs.tamano(est.proyecto.ruta);
    const recursos = est.archivos.filter(a => !a.carpeta && ['imagen', 'modelo', 'sonido', 'fuente'].includes(tipoRecurso(a.rel))).reduce((s, a) => s + a.tamano, 0);
    $('.txt-espacio', panelFiltro).textContent = `${formatoTamano(recursos)} en recursos · ${formatoTamano(total)} en total`;
    $('.barra-progreso div', panelFiltro).style.width = Math.min(100, Math.max(4, recursos / Math.max(1, total) * 100)) + '%';
  }

  // ---------- Centro ----------
  const panelCentro = el(`<section class="panel visor"><div class="migas-recursos">
    <button class="btn-icono" data-a="atras" data-ayuda="Carpeta superior">${icono('flechaIzquierda', '', 16)}</button><div class="ruta"></div>
    <div class="buscador">${icono('buscar', '', 15)}<input class="campo" placeholder="Buscar recursos" value="${esc(st.busqueda)}"></div>
    <div class="herramientas-visor"><button data-v="cuadricula" data-ayuda="Cuadrícula">${icono('plantillas', '', 15)}</button><button data-v="lista" data-ayuda="Lista">${icono('lista', '', 15)}</button></div>
    <button class="btn principal peq" data-a="importar" style="height:34px">${icono('subir', '', 15)}Importar</button></div>
    <div class="desplazable zona-recursos" style="display:flex;flex-direction:column"><div class="rejilla"></div>
    <div class="zona-soltar"><span class="caja">${icono('subir', '', 20)}</span><div><b>Arrastra archivos aquí para importarlos</b><span>Imágenes, modelos 3D, sonidos, música y fuentes. Falcon los prepara automáticamente.</span></div></div></div></section>`);
  centro.append(panelCentro);
  $('[data-a=atras]', panelCentro).onclick = () => { if (st.carpeta) { st.carpeta = carpetaDe(st.carpeta); pintarTodo(); } };
  $('[data-a=importar]', panelCentro).onclick = () => dialogoImportar(st.carpeta || undefined);
  $('.buscador input', panelCentro).oninput = (e) => { st.busqueda = e.target.value; pintarRejilla(); };
  $$('[data-v]', panelCentro).forEach(b => b.onclick = () => { st.vista = b.dataset.v; pintarRejilla(); });

  // Soltar archivos del sistema.
  const zona = $('.zona-recursos', panelCentro), zs = $('.zona-soltar', panelCentro);
  zona.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); zs.classList.add('encima'); } });
  zona.addEventListener('dragleave', (e) => { if (!zona.contains(e.relatedTarget)) zs.classList.remove('encima'); });
  zona.addEventListener('drop', async (e) => {
    zs.classList.remove('encima');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const rutas = [...e.dataTransfer.files].map(f => window.falcon.fs.rutaDeArchivo(f)).filter(Boolean);
    inferior.mostrar('importacion');
    const hechos = await importarArchivos(rutas, st.carpeta || undefined);
    if (hechos[0]) { seleccionado = hechos[0]; pintarTodo(); }
  });

  function pintarRuta() {
    const r = $('.ruta', panelCentro);
    const trozos = st.carpeta ? st.carpeta.split('/') : [];
    r.innerHTML = `<span class="parte" data-c="">proyecto://</span>` + trozos.map((t, i) => `${icono('flechaDerecha', '', 12)}<span class="parte" data-c="${esc(trozos.slice(0, i + 1).join('/'))}">${i === trozos.length - 1 ? `<b>${esc(t)}</b>` : esc(t)}</span>`).join('');
    $$('.parte', r).forEach(p => p.onclick = () => { st.carpeta = p.dataset.c; pintarTodo(); });
    $$('[data-v]', panelCentro).forEach(b => b.classList.toggle('activo', b.dataset.v === st.vista));
  }

  function archivosVisibles() {
    const q = st.busqueda.toLowerCase();
    return est.archivos.filter(a => {
      if (a.carpeta) return false;
      if (a.rel === 'proyecto.falcon' || a.rel === 'proyecto.talon') return false;
      if (q) return a.rel.toLowerCase().includes(q) && (st.filtro === 'todo' || tipoRecurso(a.rel) === st.filtro || (st.filtro === 'modelo' && tipoRecurso(a.rel) === 'malla'));
      if (st.filtro !== 'todo') return (tipoRecurso(a.rel) === st.filtro || (st.filtro === 'modelo' && tipoRecurso(a.rel) === 'malla')) && (a.rel.startsWith(st.carpeta ? st.carpeta + '/' : '') );
      return carpetaDe(a.rel) === st.carpeta;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  function subtitulo(a) {
    if (info.has(a.rel)) return info.get(a.rel).sub;
    const t = tipoRecurso(a.rel);
    const aj = est.proyecto.ajustesImportacion(a.rel);
    let s = '';
    if (t === 'imagen') {
      const n = aj.columnas * aj.filas;
      s = aj.uso === 'mosaico' ? 'Mosaico' : aj.uso === 'fondo' ? 'Fondo · paralaje' : n > 1 ? `Sprite · ${n} cuadros` : 'Imagen';
    } else if (t === 'sonido') s = /^m[uú]sica\//i.test(a.rel) || aj.bucle ? 'Música · en bucle' : a.tamano < 150000 ? 'Sonido · corto' : 'Sonido';
    else if (t === 'modelo') s = 'Modelo · ' + extension(a.rel);
    else if (t === 'malla') s = 'Malla de Falcon';
    else if (t === 'fuente') s = 'Fuente';
    else if (t === 'escena') { s = 'Escena'; cargarInfoEscena(a.rel); }
    else if (t === 'blueprint') { s = 'Blueprint'; cargarInfoBp(a.rel); }
    else if (t === 'script') s = a.rel.startsWith('generado/') ? 'Águila · generado' : 'Script de Águila';
    else if (t === 'material') s = 'Material';
    else s = formatoTamano(a.tamano);
    return s;
  }
  async function cargarInfoEscena(rel) {
    try { const e = JSON.parse(await est.proyecto.leer(rel)); info.set(rel, { sub: `Escena ${e.tipo || '2D'}` }); actualizarSub(rel); } catch {}
  }
  async function cargarInfoBp(rel) {
    try { const b = JSON.parse(await est.proyecto.leer(rel)); info.set(rel, { sub: `Blueprint · ${contarNodos(b)} nodos` }); actualizarSub(rel); } catch {}
  }
  function actualizarSub(rel) { const s = panelCentro.querySelector(`[data-rel="${CSS.escape(rel)}"] .sub`); if (s) s.textContent = info.get(rel).sub; }

  function vistaPrevia(a, grande = false) {
    const t = tipoRecurso(a.rel);
    const d = TIPOS_RECURSO[t];
    const color = t === 'sonido' && /^m[uú]sica\//i.test(a.rel) ? 'var(--naranja)' : d ? d.color : 'var(--texto-2)';
    if (t === 'imagen') {
      const aj = est.proyecto.ajustesImportacion(a.rel);
      if (aj.columnas * aj.filas > 1 && !grande) return `<canvas class="mini-sprite" data-src="${esc(a.rel)}" width="64" height="64" style="width:64px;height:64px"></canvas>`;
      return `<img src="${est.proyecto.url(a.rel)}?v=${a.modificado}" class="${aj.filtro === 'pixel' ? 'pixel' : ''}" alt="">`;
    }
    const ic = t === 'sonido' ? (/^m[uú]sica\//i.test(a.rel) ? 'musica' : 'onda') : t === 'escena' ? 'escena' : d ? d.icono : 'archivo';
    return `<span style="color:${color}">${icono(ic, '', grande ? 64 : 46)}</span>`;
  }

  function pintarRejilla() {
    const c = $('.rejilla', panelCentro);
    const lista = archivosVisibles();
    const carpetas = st.filtro === 'todo' && !st.busqueda ? est.archivos.filter(a => a.carpeta && carpetaDe(a.rel) === st.carpeta) : [];
    pintarRuta();
    if (st.vista === 'lista') {
      c.className = 'rejilla lista-recursos';
      c.style.padding = '4px 8px';
      c.innerHTML = [...carpetas.map(a => `<div class="fila-rec" data-carpeta="${esc(a.rel)}">${icono('carpeta', '', 16)}<span>${esc(a.nombre)}</span><span style="color:var(--texto-2)">Carpeta</span><span></span></div>`),
        ...lista.map(a => `<div class="fila-rec ${seleccionado === a.rel ? 'sel' : ''}" data-rel="${esc(a.rel)}" draggable="true"><span style="font-size:10px;font-weight:800;color:var(--texto-2)">${esc(ETIQUETA(a.rel))}</span><span>${esc(a.nombre)}</span><span class="sub" style="color:var(--texto-2)">${esc(subtitulo(a))}</span><span style="color:var(--texto-3);text-align:right">${formatoTamano(a.tamano)}</span></div>`)].join('');
    } else {
      c.className = 'rejilla rejilla-recursos';
      c.style.padding = '';
      c.innerHTML = [...carpetas.map(a => `<div class="tarjeta-recurso" data-carpeta="${esc(a.rel)}"><div class="vista-rec">${icono('carpeta', '', 44)}</div><div class="info-rec"><b>${esc(a.nombre)}</b><span>${est.archivos.filter(x => x.rel.startsWith(a.rel + '/') && !x.carpeta).length} archivos</span></div></div>`),
        ...lista.map(a => `<div class="tarjeta-recurso ${seleccionado === a.rel ? 'sel' : ''}" data-rel="${esc(a.rel)}" draggable="true" title="${esc(a.rel)}"><div class="vista-rec"><span class="etq-tipo" style="color:${tipoRecurso(a.rel) === 'sonido' ? 'var(--naranja)' : (TIPOS_RECURSO[tipoRecurso(a.rel)] || {}).color || 'var(--texto-2)'}">${esc(ETIQUETA(a.rel))}</span>${vistaPrevia(a)}</div><div class="info-rec"><b>${esc(a.nombre)}</b><span class="sub">${esc(subtitulo(a))}</span></div></div>`)].join('');
      pintarMiniSprites(c);
    }
    if (!lista.length && !carpetas.length) c.innerHTML = `<div class="vacio-texto" style="grid-column:1/-1;padding:30px">${st.busqueda ? 'Nada coincide con la búsqueda.' : 'Esta carpeta está vacía.'}</div>`;
    $$('[data-carpeta]', c).forEach(x => x.ondblclick = x.onclick = () => { st.carpeta = x.dataset.carpeta; st.abiertas.add(x.dataset.carpeta); pintarTodo(); });
    $$('[data-rel]', c).forEach(x => {
      x.onclick = () => { seleccionado = x.dataset.rel; $$('[data-rel]', c).forEach(y => y.classList.toggle('sel', y === x)); pintarDetalle(); };
      x.ondblclick = () => usarOAbrir(x.dataset.rel);
      x.ondragstart = (e) => { e.dataTransfer.setData('text/falcon-archivo', x.dataset.rel); e.dataTransfer.effectAllowed = 'copyMove'; };
      x.oncontextmenu = (e) => { e.preventDefault(); seleccionado = x.dataset.rel; pintarDetalle(); menuRecurso(e.clientX, e.clientY, x.dataset.rel); };
    });
  }

  // Miniatura del primer cuadro de una hoja de sprites.
  function pintarMiniSprites(c) {
    for (const cv of $$('canvas.mini-sprite', c)) {
      const rel = cv.dataset.src;
      const aj = est.proyecto.ajustesImportacion(rel);
      const img = new Image();
      img.onload = () => {
        const fw = img.width / aj.columnas, fh = img.height / aj.filas;
        const e = Math.min(64 / fw, 64 / fh);
        const x = cv.getContext('2d');
        x.imageSmoothingEnabled = aj.filtro !== 'pixel';
        x.drawImage(img, 0, 0, fw, fh, 32 - fw * e / 2, 32 - fh * e / 2, fw * e, fh * e);
      };
      img.src = est.proyecto.url(rel);
    }
  }

  function menuRecurso(x, y, rel) {
    menu(x, y, [
      { texto: 'Abrir', icono: 'carpetaAbierta', accion: () => abrirArchivo(rel), desactivado: !['escena', 'blueprint', 'script', 'material', 'malla'].includes(tipoRecurso(rel)) },
      { texto: 'Usar en escena', icono: 'mas', accion: () => usarEnEscena(rel), desactivado: !['imagen', 'modelo', 'malla', 'sonido'].includes(tipoRecurso(rel)) },
      { texto: 'Renombrar…', icono: 'lapiz', accion: () => renombrarArchivo(rel) },
      { texto: 'Mostrar en la carpeta', icono: 'carpeta', accion: () => window.falcon.sistema.mostrarEnCarpeta(est.proyecto.abs(rel)) },
      '-',
      { texto: 'Mover a la papelera', icono: 'papelera', peligro: true, accion: () => borrarArchivo(rel) },
    ]);
  }

  function usarOAbrir(rel) {
    if (['escena', 'blueprint', 'script', 'material', 'malla'].includes(tipoRecurso(rel))) abrirArchivo(rel);
    else usarEnEscena(rel);
  }

  async function usarEnEscena(rel) {
    const t = tipoRecurso(rel);
    let d = est.docs.filter(x => x.tipo === 'escena').find(x => x.rel === est.ultimoDocDe.escena2D || x.rel === est.ultimoDocDe.escena3D) || est.docs.find(x => x.tipo === 'escena');
    if (!d && est.proyecto.datos.escena_principal) d = await abrirDocumento(est.proyecto.datos.escena_principal, { activar: false });
    if (!d) { avisar('Abre o crea una escena primero.', 'aviso'); return; }
    const nombre = sinExtension(rel).replace(/^./, c => c.toUpperCase());
    if (t === 'imagen' && d.dim === '2D') {
      const aj = est.proyecto.ajustesImportacion(rel);
      const img = new Image(); img.src = est.proyecto.url(rel); await img.decode().catch(() => {});
      const cam = d.vista.camara;
      if (aj.uso === 'mosaico') anadirNodo(d, 'Mosaicos', { nombre, props: { imagen: rel }, padre: d.datos.raiz.id });
      else if (aj.uso === 'fondo') anadirNodo(d, 'Fondo', { nombre: 'Fondo', props: { imagen: rel }, padre: d.datos.raiz.id });
      else anadirNodo(d, 'Sprite', { nombre, props: { imagen: rel, ancho: Math.round(img.width / aj.columnas) || 32, alto: Math.round(img.height / aj.filas) || 32, animando: aj.columnas * aj.filas > 1 }, posicion: cam ? [Math.round(cam.x), Math.round(cam.y)] : [640, 360], padre: d.datos.raiz.id });
    } else if ((t === 'modelo' || t === 'malla') && d.dim === '3D') anadirNodo(d, 'Malla3D', { nombre, props: { malla: rel }, padre: d.datos.raiz.id });
    else if (t === 'sonido') anadirNodo(d, 'Sonido', { nombre, props: { sonido: rel }, padre: d.datos.raiz.id });
    else { avisar(`Este recurso no se puede usar en una escena ${d.dim}.`, 'aviso'); return; }
    log(`${nombreBase(rel)} añadido a ${d.titulo}`, 'ok');
    const { activarDocumento } = await import('../estado.js');
    activarDocumento(d);
  }

  // ---------- Inferior ----------
  const importaciones = est._importaciones ||= [];
  const inferior = crearInferior(centro, {
    pestanas: ['salida', 'importacion', 'rotas'],
    inicial: importaciones.length ? 'importacion' : 'salida',
    extra: {
      importacion: {
        titulo: 'Importación',
        pintar: (c) => {
          const caja = el('<div class="desplazable" style="padding-top:4px"></div>');
          c.append(caja);
          const pintarImp = () => {
            caja.innerHTML = importaciones.length ? importaciones.slice(-30).reverse().map(i => `<div class="fila-importacion"><span class="n">${esc(i.archivo)}</span><div class="barra-progreso"><div style="width:${i.progreso}%;background:${i.estado === 'error' ? 'var(--error)' : i.estado === 'importado' ? 'var(--verde)' : 'var(--aviso)'}"></div></div><span class="e" style="color:${i.estado === 'error' ? 'var(--error)' : i.estado === 'importado' ? 'var(--verde)' : 'var(--aviso)'}">${i.estado === 'importado' ? 'Importado' : i.estado === 'error' ? 'Error' : `Importando… ${i.progreso} %`}</span></div>`).join('') : '<div class="vacio-texto">Arrastra archivos al centro o pulsa Importar.</div>';
          };
          pintarImp();
          return bus.on('importacion', pintarImp);
        },
      },
      rotas: {
        titulo: 'Referencias rotas',
        pintar: (c) => {
          const caja = el('<div class="desplazable registro"><div class="linea"><span class="txt" style="color:var(--texto-3)">Buscando…</span></div></div>');
          c.append(caja);
          referenciasRotas().then(lista => {
            caja.innerHTML = lista.length ? lista.map(r => `<div class="linea error enlace" data-e="${esc(r.escena)}"><span class="hora">${esc(r.escena)}</span><span class="txt">${esc(r.nodo)} usa «${esc(r.ruta)}», que no existe</span></div>`).join('') : '<div class="linea ok"><span class="txt">No hay referencias rotas: todos los archivos que usan las escenas existen.</span></div>';
            $$('[data-e]', caja).forEach(x => x.onclick = () => abrirDocumento(x.dataset.e));
          });
        },
      },
    },
  });
  partes.push(inferior);
  const quitarImp = bus.on('importacion', (i) => {
    const e = importaciones.find(x => x.archivo === i.archivo && x.estado === 'importando');
    if (e) Object.assign(e, i); else importaciones.push({ ...i });
  });

  async function referenciasRotas() {
    const existentes = new Set(est.archivos.map(a => a.rel));
    const r = [];
    for (const a of est.archivos.filter(x => x.rel.endsWith('.fscn'))) {
      const d = documento(a.rel);
      let e;
      try { e = d ? d.datos : normalizarEscena(await est.proyecto.leer(a.rel)); } catch { continue; }
      recorrer(e.raiz, (n) => {
        for (const ruta of [n.script, n.blueprint, n.props.imagen, n.props.sonido, n.props.material, n.props.fuente, n.props.escena, /\.(glb|gltf|malla)$/i.test(n.props.malla || '') ? n.props.malla : null]) {
          if (ruta && !existentes.has(ruta)) r.push({ escena: a.rel, nodo: n.nombre, ruta });
        }
      });
    }
    return r;
  }

  // ---------- Derecha ----------
  let pestanaDer = 'recurso';
  const panelDer = el(`<section class="panel" style="flex:1"><div class="pestanas"><button data-p="recurso" class="activo">Recurso</button><button data-p="archivo">Importación</button></div><div class="desplazable cont-rec"></div></section>`);
  der.append(panelDer);
  $$('.pestanas button', panelDer).forEach(b => b.onclick = () => { pestanaDer = b.dataset.p; $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x === b)); pintarDetalle(); });
  let audioPrev = null;

  async function pintarDetalle() {
    const c = $('.cont-rec', panelDer);
    const a = est.archivos.find(x => x.rel === seleccionado);
    if (!a) { c.innerHTML = `<div class="vacio-insp">${icono('carpeta', '', 26)}Selecciona un recurso para ver sus datos y ajustes de importación.</div>`; return; }
    const t = tipoRecurso(a.rel);
    const aj = est.proyecto.ajustesImportacion(a.rel);
    if (pestanaDer === 'archivo') {
      c.innerHTML = `<div class="datos-rec" style="padding-top:8px"><h4>${esc(a.nombre)}</h4><div class="ruta-rec">proyecto://${esc(carpetaDe(a.rel))}/</div>
        <div class="dato"><span>Tamaño</span><span>${formatoTamano(a.tamano)}</span></div>
        <div class="dato"><span>Modificado</span><span>${new Date(a.modificado).toLocaleString('es')}</span></div>
        <div class="dato"><span>Formato</span><span>.${esc(extension(a.rel))}</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
          <button class="btn secundario" data-a="renombrar">${icono('lapiz', '', 15)}Renombrar…</button>
          <button class="btn secundario" data-a="carpeta">${icono('carpeta', '', 15)}Mostrar en la carpeta</button>
          <button class="btn peligro" data-a="borrar">${icono('papelera', '', 15)}Mover a la papelera</button></div></div>`;
      $('[data-a=renombrar]', c).onclick = () => renombrarArchivo(a.rel);
      $('[data-a=carpeta]', c).onclick = () => window.falcon.sistema.mostrarEnCarpeta(est.proyecto.abs(a.rel));
      $('[data-a=borrar]', c).onclick = () => borrarArchivo(a.rel);
      return;
    }
    let previa = vistaPrevia(a, true);
    if (t === 'imagen') previa = `<img src="${est.proyecto.url(a.rel)}?v=${a.modificado}" style="${aj.filtro === 'pixel' ? 'image-rendering:pixelated' : ''}">`;
    if (t === 'fuente') previa = `<div style="font-family:'prev_${a.modificado}';font-size:34px;text-align:center;line-height:1.2">Aa Bb Ññ<br><span style="font-size:18px">¡Hola, aventurero!</span></div>`;
    c.innerHTML = `<div class="vista-previa-rec">${previa}${t === 'sonido' ? `<button class="btn principal" data-a="oir" style="position:absolute;bottom:12px">${icono('play', '', 14)}Escuchar</button>` : ''}</div>
      <div class="datos-rec"><h4>${esc(a.nombre)}</h4><div class="ruta-rec">proyecto://${esc(carpetaDe(a.rel))}${carpetaDe(a.rel) ? '/' : ''}</div>
        <div class="dato"><span>Tipo</span><span>${esc(nombreTipo(a.rel))}</span></div>
        <div class="dato dims"><span>${t === 'sonido' ? 'Duración' : 'Dimensiones'}</span><span>…</span></div>
        <div class="dato"><span>Usado en</span><span class="usado">…</span></div></div>
      <div class="seccion-insp ajustes-imp"></div>`;
    if (t === 'fuente') { const ff = new FontFace('prev_' + a.modificado, `url("${est.proyecto.url(a.rel)}")`); ff.load().then(f => document.fonts.add(f)).catch(() => {}); }
    const oir = $('[data-a=oir]', c);
    if (oir) oir.onclick = () => { if (audioPrev) audioPrev.pause(); audioPrev = new Audio(est.proyecto.url(a.rel)); audioPrev.play(); };
    // Datos que se cargan aparte.
    const dims = $('.dims span:last-child', c);
    if (t === 'imagen') { const img = new Image(); img.onload = () => { dims.textContent = `${img.width} × ${img.height} px${aj.columnas * aj.filas > 1 ? ` · cuadro ${Math.round(img.width / aj.columnas)} × ${Math.round(img.height / aj.filas)}` : ''}`; }; img.src = est.proyecto.url(a.rel); }
    else if (t === 'sonido') { const au = new Audio(); au.onloadedmetadata = () => { dims.textContent = au.duration.toFixed(2).replace('.', ',') + ' s'; }; au.src = est.proyecto.url(a.rel); }
    else dims.textContent = formatoTamano(a.tamano);
    escenasQueUsan(a.rel).then(lista => {
      const u = $('.usado', c);
      if (!u) return;
      u.innerHTML = lista.length ? lista.map(x => `<span class="verde" style="cursor:pointer" data-e="${esc(x)}">${esc(nombreBase(x))}</span>`).join(', ') : '<span style="color:var(--texto-3)">Ninguna escena</span>';
      $$('[data-e]', u).forEach(s => s.onclick = () => abrirDocumento(est.archivos.find(f => sinExtension(f.rel) === s.dataset.e && f.rel.endsWith('.fscn'))?.rel));
    });
    pintarAjustes($('.ajustes-imp', c), a, t, aj);
  }

  function nombreTipo(rel) {
    const t = tipoRecurso(rel);
    return { imagen: 'Imagen · Textura 2D', modelo: 'Modelo 3D (glTF)', sonido: /^m[uú]sica\//i.test(rel) ? 'Música' : 'Sonido', fuente: 'Fuente', escena: 'Escena', blueprint: 'Blueprint', script: 'Script de Águila', material: 'Material', malla: 'Malla' }[t] || 'Archivo';
  }

  function pintarAjustes(c, a, t, aj) {
    const p = est.proyecto;
    const guardarAj = async (cambio) => {
      p.importacion[a.rel] = { ...(p.importacion[a.rel] || {}), ...cambio };
      await p.guardarImportacion();
      bus.emit('recurso:reimportado', a.rel);
      info.delete(a.rel);
      pintarRejilla();
    };
    if (t === 'imagen') {
      c.innerHTML = `<div class="titulo-seccion">Ajustes de importación</div>
        <div class="prop"><label>Filtro</label><div class="valor"><div class="segmentado peq lleno" style="flex:1"><button data-f="pixel" class="${aj.filtro === 'pixel' ? 'activo' : ''}">Píxel</button><button data-f="suave" class="${aj.filtro !== 'pixel' ? 'activo' : ''}">Suave</button></div></div></div>
        <div class="prop"><label>Repetir</label><div class="valor">${interruptor(!!aj.repetir, aj.repetir ? 'Sí' : 'No', 'repetir')}</div></div>
        <div class="prop"><label>Comprimir</label><div class="valor">${interruptor(aj.comprimir !== false, aj.comprimir !== false ? 'Sí' : 'No', 'comprimir')}</div></div>
        <div class="prop"><label>Hoja de sprites</label><div class="valor"><input class="campo mono" data-k="columnas" type="number" min="1" value="${aj.columnas}" style="width:58px" data-ayuda="Columnas"><span style="color:var(--texto-2)">×</span><input class="campo mono" data-k="filas" type="number" min="1" value="${aj.filas}" style="width:58px" data-ayuda="Filas"></div><div class="ayuda-prop">${aj.columnas} columna${aj.columnas > 1 ? 's' : ''} × ${aj.filas} fila${aj.filas > 1 ? 's' : ''}</div></div>
        <div class="prop"><label>Uso</label><div class="valor"><select class="campo" data-k="uso"><option value="sprite" ${!aj.uso || aj.uso === 'sprite' ? 'selected' : ''}>Sprite</option><option value="mosaico" ${aj.uso === 'mosaico' ? 'selected' : ''}>Mosaico (paleta)</option><option value="fondo" ${aj.uso === 'fondo' ? 'selected' : ''}>Fondo (paralaje)</option></select></div></div>`;
      $$('[data-f]', c).forEach(b => b.onclick = () => guardarAj({ filtro: b.dataset.f }).then(pintarDetalle));
    } else if (t === 'sonido') {
      c.innerHTML = `<div class="titulo-seccion">Ajustes de importación</div><div class="prop"><label>En bucle</label><div class="valor">${interruptor(!!aj.bucle || /^m[uú]sica\//i.test(a.rel), 'Para música de fondo', 'bucle')}</div></div><div class="prop"><label>Uso en Águila</label><div class="valor mono" style="font-size:12px;color:var(--aviso)">${/^m[uú]sica\//i.test(a.rel) || aj.bucle ? `musica("${esc(a.nombre)}")` : `sonar("${esc(a.nombre)}")`}</div></div>`;
    } else if (t === 'modelo') {
      c.innerHTML = `<div class="titulo-seccion">Modelo 3D</div><p style="font-size:13px;color:var(--texto-2);margin:0 0 10px">Crea una malla de Falcon para darle materiales, colisión y física.</p><button class="btn secundario ancho" data-a="malla">${icono('malla', '', 15)}Crear malla (.malla)</button>`;
      $('[data-a=malla]', c).onclick = async () => {
        const rel = (carpetaDe(a.rel) ? carpetaDe(a.rel) + '/' : '') + sinExtension(a.rel) + '.malla';
        await p.escribirJSON(rel, { formato: 'falcon-malla', version: 1, fuente: a.rel, primitiva: null, ranuras: [{ nombre: 'cuerpo', material: '' }], colision: 'caja', empujable: false, peso: 10, sombras: true, escala: 1, eje_arriba: 'Y', lod: [{ nivel: 0, distancia: 0 }] });
        await refrescarArchivos();
        abrirDocumento(rel);
      };
    } else c.innerHTML = '';
    $$('[data-campo]', c).forEach(i => i.onchange = () => guardarAj({ [i.dataset.campo]: i.checked }).then(pintarDetalle));
    $$('[data-k]', c).forEach(i => i.onchange = () => guardarAj({ [i.dataset.k]: i.type === 'number' ? Math.max(1, Number(i.value) || 1) : i.value }).then(pintarDetalle));
    const botones = el(`<div style="display:flex;gap:8px;padding:12px 12px 14px"><button class="btn secundario crece" data-a="reimportar">Reimportar</button>${['imagen', 'modelo', 'sonido', 'malla'].includes(t) ? '<button class="btn principal crece" data-a="usar">Usar en escena</button>' : ['escena', 'blueprint', 'script', 'material'].includes(t) ? '<button class="btn principal crece" data-a="abrir">Abrir</button>' : ''}</div>`);
    c.after(botones);
    $('[data-a=reimportar]', botones).onclick = async () => { bus.emit('recurso:reimportado', a.rel); await refrescarArchivos(); bus.emit('importacion', { archivo: a.nombre, estado: 'importado', progreso: 100 }); log(`Reimportado: ${a.rel}`, 'ok'); };
    const usar = $('[data-a=usar]', botones); if (usar) usar.onclick = () => usarEnEscena(a.rel);
    const ab = $('[data-a=abrir]', botones); if (ab) ab.onclick = () => abrirArchivo(a.rel);
  }

  function pintarTodo() { pintarCarpetas(); pintarFiltros(); pintarRejilla(); pintarDetalle(); }
  pintarTodo();
  pintarEspacio();
  const quitar = [bus.on('archivos', () => { pintarTodo(); pintarEspacio(); }), quitarImp];
  return { destruir: () => { quitar.forEach(f => f()); partes.forEach(p => p.destruir && p.destruir()); if (audioPrev) audioPrev.pause(); } };
}
