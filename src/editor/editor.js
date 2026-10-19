// Editor de Falcon Engine: barra superior, modos, disposiciones y atajos.
import { est, bus, abrirDocumento, activarDocumento, documento, refrescarArchivos, log, cerrarDocumento } from './estado.js';
import * as A from './acciones.js';
import { cerrar as cerrarDoc } from './paneles/documentos.js';
import { duplicarNodos, copiarNodos, pegarNodos, eliminarNodos } from './operaciones.js';
import { Proyecto, sinExtension } from '../motor/proyecto.js';
import { icono, logo } from '../ui/iconos.js';
import { el, esc, $, $$, menuBajo, controlesVentana, barraArrastrable, activarGlobos, confirmar, avisar, dialogo } from '../ui/componentes.js';

const falcon = window.falcon;
const MODOS = [
  { id: '2D', texto: '2D', icono: 'imagen' },
  { id: '3D', texto: '3D', icono: 'cubo' },
  { id: 'blueprints', texto: 'Blueprints', icono: 'blueprint' },
  { id: 'aguila', texto: 'Águila', icono: 'codigo' },
  { id: 'recursos', texto: 'Recursos', icono: 'carpeta' },
];

let disposicion = null;
let nombreDisposicion = '';
let cambiandoDisposicion = Promise.resolve();

async function iniciar() {
  activarGlobos();
  const q = new URLSearchParams(location.search);
  est.info = await falcon.app.info();
  const datosApp = await falcon.app.datos();
  est.ajustes = { autoguardado: true, intervaloAutoguardado: 2, tamFuenteCodigo: 14, cuadricula: 32, mostrarFps: true, ...(datosApp.ajustes || {}) };
  est.proyecto = new Proyecto(q.get('proyecto'));
  try { await est.proyecto.cargar(); }
  catch (e) {
    document.body.innerHTML = `<div style="padding:40px;font:15px Manrope;color:#F07A7A">No se pudo abrir el proyecto: ${esc(e.message)}<br><br><button class="btn secundario" onclick="window.falcon.app.gestor()">Volver al gestor</button></div>`;
    return;
  }
  est.modoEditor = est.proyecto.datos.modo_editor === 'sencillo' ? 'sencillo' : 'avanzado';
  falcon.ventana.titulo(`${est.proyecto.datos.nombre} · Falcon Engine`);
  await refrescarArchivos();
  A.escucharJuego();
  log(`Proyecto «${est.proyecto.datos.nombre}» cargado`);
  if (est.proyecto.esTalon) log('Proyecto de Talon Engine abierto sin conversión', 'ok');

  // Documentos de la última sesión.
  let sesion = null;
  try { sesion = JSON.parse(await est.proyecto.leer('.falcon/editor.json')); } catch {}
  const abiertas = (sesion && sesion.abiertas) || (est.proyecto.datos.editor && est.proyecto.datos.editor.abiertas) || [est.proyecto.datos.escena_principal].filter(Boolean);
  for (const rel of abiertas) if (est.archivos.some(a => a.rel === rel)) await abrirDocumento(rel, { activar: false });
  const activo = (sesion && sesion.activo && documento(sesion.activo)) || est.docs[0] || null;
  if (activo) { est.activo = activo; est.modo = modoDeDoc(activo); }
  if (sesion && sesion.modo === 'recursos') est.modo = 'recursos';

  pintarBarra();
  await relayout();
  document.querySelector('.cargando-editor')?.remove();

  bus.on('doc:activo', (d) => { if (d) est.modo = modoDeDoc(d); pintarModos(); relayout(); guardarSesion(); });
  bus.on('docs:lista', guardarSesion);
  bus.on('juego:estado', pintarProbar);
  bus.on('proyecto:ajustes', () => { falcon.ventana.titulo(`${est.proyecto.datos.nombre} · Falcon Engine`); pintarBarra(); });
  bus.on('recursos:mostrar', (rel) => { est.recursoSeleccionado = rel; irAModo('recursos'); });
  bus.on('ui:modo-editor', (m) => cambiarModoEditor(m));
  document.addEventListener('keydown', atajos, true);
  window.addEventListener('falcon:cerrar', alCerrar);
  iniciarAutoguardado();
}

function modoDeDoc(d) {
  if (d.tipo === 'escena') return d.dim === '3D' ? '3D' : '2D';
  if (d.tipo === 'blueprint') return 'blueprints';
  if (d.tipo === 'script') return 'aguila';
  return '3D';
}

function guardarSesion() {
  clearTimeout(guardarSesion.t);
  guardarSesion.t = setTimeout(() => {
    est.proyecto.escribir('.falcon/editor.json', JSON.stringify({ abiertas: est.docs.map(d => d.rel), activo: est.activo?.rel || null, modo: est.modo }, null, 2)).catch(() => {});
  }, 400);
}

// ---------- Barra superior ----------
function pintarBarra() {
  const app = $('#app');
  let barra = $('.barra-titulo', app);
  if (!barra) { barra = el('<header class="barra-titulo"></header>'); app.prepend(barra); barraArrastrable(barra); }
  barra.innerHTML = '';
  if (est.modoEditor === 'sencillo') {
    barra.append(el(`<span class="logo">${logo(24)}</span>`));
    barra.append(el(`<span class="nombre-proyecto">${esc(est.proyecto.datos.nombre)}</span>`));
    const sel = el(`<div class="modo-sencillo-sel">Modo<button data-m="sencillo" class="activo">Sencillo</button><button data-m="avanzado">Avanzado</button></div>`);
    $$('button', sel).forEach(b => b.onclick = () => cambiarModoEditor(b.dataset.m));
    barra.append(sel);
  } else {
    barra.append(el(`<span class="logo">${logo(24)}</span>`));
    const menus = el(`<nav class="menus">${['Escena', 'Proyecto', 'Depurar', 'Editor', 'Ayuda'].map(m => `<button data-menu="${m}">${m}</button>`).join('')}</nav>`);
    $$('button', menus).forEach(b => b.onclick = () => abrirMenu(b));
    barra.append(menus);
  }
  const centro = el('<div class="centro"><div class="segmentado modos"></div></div>');
  barra.append(centro);
  barra.append(el('<div class="zona-probar" style="margin-left:auto;display:flex"></div>'));
  barra.append(controlesVentana());
  pintarModos();
  pintarProbar();
}

function pintarModos() {
  const cont = $('.modos');
  if (!cont) return;
  const sencillo = est.modoEditor === 'sencillo';
  cont.innerHTML = MODOS.map(m => `<button data-modo="${m.id}" class="${est.modo === m.id ? 'activo' : ''}">${sencillo ? '' : icono(m.icono, '', 16)}${m.texto}</button>`).join('');
  $$('button', cont).forEach(b => b.onclick = () => irAModo(b.dataset.modo));
}

function pintarProbar() {
  const z = $('.zona-probar');
  if (!z) return;
  z.innerHTML = '';
  if (est.modoEditor === 'sencillo') {
    const l = el(`<button class="btn contorno peq" style="margin-right:8px" data-accion="lecciones">${icono('libro', '', 15)}Lecciones</button>`);
    l.onclick = () => bus.emit('curso:mostrar');
    const p = el(`<button class="btn principal peq" style="margin-right:14px;height:34px" data-accion="probar">${icono('play', '', 14)}${est.juego.activo ? 'Probando…' : 'Probar juego'}</button>`);
    p.onclick = () => est.juego.activo ? A.detener() : A.probar();
    if (est.juego.activo) p.innerHTML = `${icono('stop', '', 13)}Detener`;
    z.append(l, p);
    return;
  }
  if (est.juego.activo) {
    const c = el(`<div class="ejecutando">
      <button class="btn-icono" data-ayuda="${est.juego.pausado ? 'Seguir (F7)' : 'Pausar (F7)'}">${icono(est.juego.pausado ? 'play' : 'pausa', '', 15)}</button>
      <button class="detener">${icono('stop', '', 12)}Detener</button><span class="estado">Ejecutándose en otra ventana</span></div>`);
    c.querySelector('.btn-icono').onclick = () => A.pausarJuego();
    c.querySelector('.detener').onclick = () => A.detener();
    z.append(c);
    return;
  }
  const g = el(`<div class="probar">
    <button class="btn principal" data-accion="probar" data-ayuda="Probar el juego (F5)">${icono('play', '', 13)}Probar</button>
    <button class="btn-icono" data-a="pausa" data-ayuda="Pausar (F7)" disabled>${icono('pausa', '', 15)}</button>
    <button class="btn-icono" data-a="stop" data-ayuda="Detener (F8)" disabled>${icono('stop', '', 13)}</button>
    <button class="btn-icono" data-a="escena" data-ayuda="Probar la escena actual (F6)">${icono('pantalla', '', 16)}</button></div>`);
  g.querySelector('[data-accion=probar]').onclick = () => A.probar();
  g.querySelector('[data-a=escena]').onclick = () => probarEscenaActual();
  z.append(g);
}

function probarEscenaActual() {
  const d = est.activo && est.activo.tipo === 'escena' ? est.activo : est.docs.find(x => x.tipo === 'escena');
  A.probar(d ? d.rel : undefined);
}

// ---------- Modos ----------
export async function irAModo(modo) {
  est.modo = modo;
  if (modo === 'recursos') { pintarModos(); await relayout(); guardarSesion(); return; }
  const tipos = { '2D': (d) => d.tipo === 'escena' && d.dim === '2D', '3D': (d) => (d.tipo === 'escena' && d.dim === '3D') || d.tipo === 'material' || d.tipo === 'malla', blueprints: (d) => d.tipo === 'blueprint', aguila: (d) => d.tipo === 'script' };
  const filtro = tipos[modo];
  if (est.activo && filtro(est.activo)) { pintarModos(); await relayout(); return; }
  const ultimoRel = est.ultimoDocDe[modo === '2D' ? 'escena2D' : modo === '3D' ? 'escena3D' : modo === 'blueprints' ? 'blueprint' : 'script'];
  let d = (ultimoRel && documento(ultimoRel)) || est.docs.find(filtro);
  if (!d) {
    // Busca un archivo adecuado: el de la lógica del nodo seleccionado, la escena principal, o el primero.
    const sel = est.activo && est.activo.nodoSel;
    let rel = null;
    if (modo === 'blueprints') rel = sel && sel.blueprint || est.archivos.find(a => a.rel.endsWith('.bp'))?.rel;
    else if (modo === 'aguila') rel = sel && sel.script || est.archivos.find(a => a.rel.endsWith('.agl') && !a.rel.startsWith('generado/'))?.rel;
    else {
      const principal = est.proyecto.datos.escena_principal;
      const candidatas = est.archivos.filter(a => a.rel.endsWith('.fscn')).map(a => a.rel);
      if (principal) candidatas.unshift(principal);
      for (const c of candidatas) {
        try { const e = JSON.parse(await est.proyecto.leer(c)); if ((e.tipo || '2D') === modo) { rel = c; break; } } catch {}
      }
    }
    if (rel) d = await abrirDocumento(rel, { activar: false });
  }
  if (d) activarDocumento(d);
  else { est.activo = null; bus.emit('doc:activo-vacio'); pintarModos(); await relayout(); }
}

function nombreDeDisposicion() {
  if (est.modoEditor === 'sencillo') {
    const d = est.activo;
    if (est.modo === 'recursos') return 'recursos';
    if ((!d && (est.modo === '2D' || est.modo === '3D')) || (d && d.tipo === 'escena')) return 'sencillo';
  }
  if (est.modo === 'recursos') return 'recursos';
  const d = est.activo;
  if (!d) return est.modo === 'blueprints' ? 'blueprints' : est.modo === 'aguila' ? 'aguila' : 'escena' + est.modo;
  if (d.tipo === 'escena') return 'escena' + d.dim;
  return { blueprint: 'blueprints', script: 'aguila', material: 'material', malla: 'malla' }[d.tipo];
}

async function relayout() {
  cambiandoDisposicion = cambiandoDisposicion.then(async () => {
    const nombre = nombreDeDisposicion();
    if (nombre === nombreDisposicion && disposicion) { disposicion.alCambiarDoc && disposicion.alCambiarDoc(); return; }
    if (disposicion) disposicion.destruir();
    $$('#app > :not(.barra-titulo)').forEach(x => x.remove());
    const cont = $('#app');
    nombreDisposicion = nombre;
    try {
      if (nombre === 'escena2D' || nombre === 'escena3D') { const m = await import('./disposiciones/escena.js'); disposicion = await m.crearDisposicionEscena(cont, nombre.slice(-2)); }
      else if (nombre === 'blueprints') { const m = await import('./disposiciones/blueprints.js'); disposicion = await m.crearDisposicionBlueprints(cont); }
      else if (nombre === 'aguila') { const m = await import('./disposiciones/aguila.js'); disposicion = await m.crearDisposicionAguila(cont); }
      else if (nombre === 'recursos') { const m = await import('./disposiciones/recursos.js'); disposicion = await m.crearDisposicionRecursos(cont); }
      else if (nombre === 'material') { const m = await import('./disposiciones/material.js'); disposicion = await m.crearDisposicionMaterial(cont); }
      else if (nombre === 'malla') { const m = await import('./disposiciones/malla.js'); disposicion = await m.crearDisposicionMalla(cont); }
      else if (nombre === 'sencillo') { const m = await import('./disposiciones/sencillo.js'); disposicion = await m.crearDisposicionSencilla(cont); }
    } catch (e) {
      console.error(e);
      cont.append(el(`<div style="padding:30px;color:var(--error)">Error al mostrar esta vista: ${esc(e.message)}</div>`));
      disposicion = { destruir() {} };
    }
    pintarModos();
    pintarCursoFlotante();
  }).catch(e => console.error(e));
  return cambiandoDisposicion;
}

// Tarjeta del curso cuando, en modo Sencillo, se está en Blueprints, Águila o Recursos.
async function pintarCursoFlotante() {
  document.querySelector('.curso-flotante')?.remove();
  if (est.modoEditor !== 'sencillo' || nombreDisposicion === 'sencillo') return;
  const c = await import('./curso.js');
  c.cargarCurso();
  c.iniciarRevisiones();
  const pintar = () => {
    document.querySelector('.curso-flotante')?.remove();
    if (est.modoEditor !== 'sencillo' || nombreDisposicion === 'sencillo') return;
    const l = c.leccionActual(), i = c.pasoActual();
    const paso = i >= 0 ? l.pasos[i] : null;
    const t = el(`<div class="curso-flotante"><div class="curso-cab"><span>${esc(l.titulo)}</span><span>${paso ? `Paso ${i + 1} de ${l.pasos.length}` : '¡Hecho!'}</span></div>
      <p>${esc(paso ? paso.texto : 'Lección completada. Vuelve al nivel para seguir.')}</p>
      <div class="fila-flex"><button class="btn principal peq" data-a="volver">${icono('flechaIzquierda', '', 14)}Volver al nivel</button>${paso && paso.pista ? '<button class="btn fantasma peq" data-a="pista">Pista</button>' : ''}</div>
      <div class="pista-flotante oculto">${esc(paso && paso.pista || '')}</div></div>`);
    document.body.append(t);
    t.querySelector('[data-a=volver]').onclick = () => irAModo(est.proyecto.datos.tipo === '3D' ? '3D' : '2D');
    const p = t.querySelector('[data-a=pista]');
    if (p) p.onclick = () => t.querySelector('.pista-flotante').classList.toggle('oculto');
  };
  pintar();
  if (!pintarCursoFlotante.escuchando) { pintarCursoFlotante.escuchando = true; bus.on('curso:cambio', pintar); }
}

async function cambiarModoEditor(m) {
  if (m === est.modoEditor) return;
  est.modoEditor = m;
  est.proyecto.datos.modo_editor = m;
  await est.proyecto.guardar();
  if (m === 'sencillo' && (!est.activo || est.activo.tipo !== 'escena')) {
    const d = est.docs.find(x => x.tipo === 'escena') || (est.proyecto.datos.escena_principal && await abrirDocumento(est.proyecto.datos.escena_principal, { activar: false }));
    if (d) { est.activo = d; est.modo = modoDeDoc(d); }
  }
  pintarBarra();
  nombreDisposicion = '';
  await relayout();
}

// ---------- Menús ----------
function abrirMenu(b) {
  const d = est.activo;
  const esEscena = d && d.tipo === 'escena';
  const items = {
    Escena: [
      { texto: 'Nueva escena 2D', icono: 'imagen', accion: () => A.nuevaEscena('2D') },
      { texto: 'Nueva escena 3D', icono: 'cubo', accion: () => A.nuevaEscena('3D') },
      { texto: 'Abrir escena…', icono: 'carpetaAbierta', accion: abrirEscenaDialogo },
      '-',
      { texto: 'Guardar', icono: 'guardar', atajo: 'Ctrl S', accion: () => A.guardar(), desactivado: !d },
      { texto: 'Guardar todo', atajo: 'Ctrl Mayús S', accion: () => A.guardarTodo() },
      { texto: 'Usar como escena principal', icono: 'check', desactivado: !esEscena, accion: async () => { est.proyecto.datos.escena_principal = d.rel; await est.proyecto.guardar(); log(`Escena principal: ${d.rel}`, 'ok'); } },
      '-',
      { texto: 'Cerrar pestaña', atajo: 'Ctrl W', accion: () => d && cerrarDoc(d), desactivado: !d },
    ],
    Proyecto: [
      { texto: 'Ajustes del proyecto…', icono: 'ajustes', accion: () => A.dialogoAjustesProyecto() },
      { texto: 'Exportar juego…', icono: 'exportar', accion: () => A.dialogoExportar() },
      '-',
      { texto: 'Importar recursos…', icono: 'importar', accion: () => A.dialogoImportar() },
      { texto: 'Abrir la carpeta del proyecto', icono: 'carpeta', accion: () => falcon.sistema.mostrarEnCarpeta(est.proyecto.ruta) },
      { texto: 'Volver al gestor de proyectos', icono: 'flechaIzquierda', accion: volverAlGestor },
    ],
    Depurar: [
      { texto: 'Probar', icono: 'play', atajo: 'F5', accion: () => A.probar() },
      { texto: 'Probar la escena actual', icono: 'pantalla', atajo: 'F6', accion: probarEscenaActual },
      { texto: est.juego.pausado ? 'Seguir' : 'Pausar', icono: 'pausa', atajo: 'F7', desactivado: !est.juego.activo, accion: () => A.pausarJuego() },
      { texto: 'Detener', icono: 'stop', atajo: 'F8', desactivado: !est.juego.activo, accion: () => A.detener() },
      '-',
      { texto: 'Ver colisiones en el juego', marcado: !!est._colisiones, accion: () => { est._colisiones = !est._colisiones; A.enviarAlJuego({ tipo: 'colisiones', valor: est._colisiones }); } },
      { texto: 'Comprobar todos los scripts', icono: 'check', accion: comprobarScripts },
      { texto: 'Compilar todos los Blueprints', icono: 'blueprint', accion: compilarTodos },
    ],
    Editor: [
      { texto: 'Deshacer', icono: 'deshacer', atajo: 'Ctrl Z', desactivado: !d || !d.historial.length, accion: () => d.deshacer() },
      { texto: 'Rehacer', icono: 'rehacer', atajo: 'Ctrl Y', desactivado: !d || !d.futuro.length, accion: () => d.rehacer() },
      '-',
      { texto: 'Duplicar', atajo: 'Ctrl D', desactivado: !esEscena || !d.seleccion.length, accion: () => duplicarNodos(d) },
      { texto: 'Copiar', atajo: 'Ctrl C', desactivado: !esEscena || !d.seleccion.length, accion: () => copiarNodos(d) },
      { texto: 'Pegar', atajo: 'Ctrl V', desactivado: !esEscena || !est.portapapeles, accion: () => pegarNodos(d) },
      { texto: 'Eliminar', atajo: 'Supr', desactivado: !esEscena || !d.seleccion.length, accion: () => eliminarNodos(d) },
      '-',
      { texto: 'Modo Sencillo', marcado: est.modoEditor === 'sencillo', accion: () => cambiarModoEditor('sencillo') },
      { texto: 'Ajustes de Falcon Engine…', icono: 'ajustes', accion: () => { avisar('Los ajustes generales están en el gestor de proyectos › Ajustes.', 'aviso'); } },
    ],
    Ayuda: [
      { texto: 'Primeros pasos', icono: 'libro', accion: () => A.abrirGuia('primeros-pasos') },
      { texto: 'El lenguaje Águila', icono: 'codigo', accion: () => A.abrirGuia('aguila') },
      { texto: 'Blueprints paso a paso', icono: 'blueprint', accion: () => A.abrirGuia('blueprints') },
      { texto: 'Atajos de teclado', icono: 'boton', accion: () => A.abrirGuia('atajos') },
      { texto: 'Exportar tu juego', icono: 'exportar', accion: () => A.abrirGuia('exportar') },
      { texto: 'Iluminación global · Lumbre', icono: 'sol', accion: () => A.abrirGuia('lumbre') },
      { texto: 'Controles 3D · primera y tercera persona', icono: 'persona', accion: () => A.abrirGuia('controles3d') },
      { texto: 'Curso «Mi primer juego» (modo Sencillo)', icono: 'estrella', accion: () => cambiarModoEditor('sencillo') },
      '-',
      { texto: 'Acerca de Falcon Engine', icono: 'info', accion: () => A.acercaDe() },
    ],
  }[b.dataset.menu];
  menuBajo(b, items);
}

async function abrirEscenaDialogo() {
  const escenas = est.archivos.filter(a => a.rel.endsWith('.fscn'));
  const r = await dialogo({
    titulo: 'Abrir escena', contenido: `<div style="display:flex;flex-direction:column;gap:4px">${escenas.map(e => `<button class="btn fantasma" style="justify-content:flex-start" data-r="${esc(e.rel)}">${icono('escena', '', 16)}${esc(e.rel)}</button>`).join('') || '<div class="vacio-texto">No hay escenas.</div>'}</div>`,
    botones: [{ texto: 'Cancelar', valor: null }],
    alAbrir: (dl, cerrar) => $$('[data-r]', dl).forEach(x => x.onclick = () => cerrar(x.dataset.r)),
  });
  if (r) abrirDocumento(r);
}

async function comprobarScripts() {
  const { analizarCodigo } = await import('../aguila/index.js');
  let total = 0;
  for (const a of est.archivos.filter(x => x.rel.endsWith('.agl'))) {
    const d = documento(a.rel);
    const texto = d ? d.datos : await est.proyecto.leer(a.rel);
    const r = analizarCodigo(texto, { archivo: a.rel });
    for (const e of [...r.errores, ...r.avisos.filter(x => x.tipo === 'error')]) { total++; log(`${a.rel} · línea ${e.linea}: ${e.mensajeCorto}`, 'error', { archivo: a.rel, linea: e.linea }); }
  }
  log(total ? `${total} problema(s) en los scripts` : 'Todos los scripts están bien escritos', total ? 'aviso' : 'ok');
}

async function compilarTodos() {
  const { compilarBlueprint } = await import('../motor/blueprints.js');
  for (const a of est.archivos.filter(x => x.rel.endsWith('.bp'))) {
    const d = documento(a.rel);
    const bp = d ? d.datos : await est.proyecto.leerJSON(a.rel);
    const r = compilarBlueprint(bp, a.nombre);
    await est.proyecto.escribir('generado/' + sinExtension(a.rel) + '.agl', r.codigo);
    log(r.errores.length ? `${a.nombre}: ${r.errores[0].mensaje}` : `${a.nombre} compilado a Águila sin errores`, r.errores.length ? 'error' : 'ok');
  }
  await refrescarArchivos();
}

async function volverAlGestor() {
  if (!(await preguntarSinGuardar())) return;
  if (est.juego.activo) A.detener();
  falcon.app.gestor();
}

async function preguntarSinGuardar() {
  if (!A.haySinGuardar()) return true;
  const r = await confirmar({ titulo: 'Hay cambios sin guardar', mensaje: 'Algunos archivos tienen cambios. ¿Quieres guardarlos antes de salir?', aceptar: 'Guardar y salir', cancelar: 'Cancelar', tercero: 'Salir sin guardar' });
  if (r === false) return false;
  if (r === true) await A.guardarTodo();
  return true;
}

async function alCerrar(e) {
  if (!A.haySinGuardar()) { if (est.juego.activo) A.detener(); return; }
  e.preventDefault();
  if (await preguntarSinGuardar()) { if (est.juego.activo) A.detener(); falcon.ventana.cerrar(); }
}

// ---------- Atajos ----------
function atajos(e) {
  const enTexto = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'F5') { e.preventDefault(); A.probar(); return; }
  if (e.key === 'F6') { e.preventDefault(); probarEscenaActual(); return; }
  if (e.key === 'F7') { e.preventDefault(); if (est.juego.activo) A.pausarJuego(); return; }
  if (e.key === 'F8') { e.preventDefault(); if (est.juego.activo) A.detener(); return; }
  if (ctrl && e.code === 'KeyS') { e.preventDefault(); e.shiftKey ? A.guardarTodo() : A.guardar(); return; }
  if (ctrl && e.code === 'KeyW') { e.preventDefault(); if (est.activo) cerrarDoc(est.activo); return; }
  if (ctrl && /^Digit[1-5]$/.test(e.code) && est.modoEditor === 'avanzado') { e.preventDefault(); irAModo(MODOS[Number(e.code.slice(5)) - 1].id); return; }
  if (enTexto) return;
  const d = est.activo;
  if (!d) return;
  if (ctrl && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); d.deshacer(); return; }
  if (ctrl && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); d.rehacer(); return; }
  if (d.tipo !== 'escena') return;
  if (ctrl && e.code === 'KeyD') { e.preventDefault(); duplicarNodos(d); return; }
  if (ctrl && e.code === 'KeyC') { copiarNodos(d); return; }
  if (ctrl && e.code === 'KeyV') { e.preventDefault(); pegarNodos(d); return; }
  if ((e.key === 'Delete') && d.seleccion.length && !e.target.closest('canvas')) { eliminarNodos(d); }
}

function iniciarAutoguardado() {
  setInterval(async () => {
    if (!est.ajustes.autoguardado || !A.haySinGuardar()) return;
    await A.guardarTodo();
    log('Guardado automático');
  }, Math.max(1, est.ajustes.intervaloAutoguardado || 2) * 60000);
}

window.__falconEditor = { est, bus, irAModo, A, abrirDocumento, cambiarModoEditor };
iniciar();
