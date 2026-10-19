// Panel «Archivos» (proyecto://): lista en árbol o cuadrícula de iconos.
import { est, bus } from '../estado.js';
import { abrirArchivo, renombrarArchivo, borrarArchivo, nuevaCarpeta, nuevaEscena, nuevoScript, nuevoBlueprint, nuevoMaterial, dialogoImportar } from '../acciones.js';
import { tipoRecurso, TIPOS_RECURSO, extension } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu } from '../../ui/componentes.js';

export function iconoArchivo(rel, carpeta) {
  if (carpeta) return { ic: 'carpeta', color: 'var(--texto-2)' };
  const t = tipoRecurso(rel);
  if (t === 'otro') return { ic: 'archivo', color: 'var(--texto-2)' };
  const d = TIPOS_RECURSO[t];
  const color = { escena: 'var(--turquesa)', blueprint: 'var(--verde)', script: 'var(--aviso)' }[t] || d.color;
  return { ic: t === 'escena' ? 'escena' : d.icono, color };
}

export function crearArchivos(contenedor, op = {}) {
  const modo = op.modo || 'lista';
  const raiz = el(`<section class="panel" style="flex:1">
    <div class="cab-panel"><h3>Archivos</h3><span class="mono">proyecto://${modo === 'cuadricula' ? '<span class="sub-ruta"></span>' : ''}</span></div>
    <div class="desplazable"><div class="${modo === 'cuadricula' ? 'cuadricula-archivos' : 'lista-archivos'}"></div></div></section>`);
  contenedor.append(raiz);
  const cont = raiz.querySelector(modo === 'cuadricula' ? '.cuadricula-archivos' : '.lista-archivos');
  const abiertas = op.abiertas || (est._carpetasAbiertas ||= new Set(['escenas', 'blueprints', 'generado', 'scripts']));
  let carpetaActual = '';
  let seleccionado = null;

  function hijos(dir) {
    return est.archivos.filter(a => {
      const i = a.rel.lastIndexOf('/');
      return (i < 0 ? '' : a.rel.slice(0, i)) === dir;
    }).sort((a, b) => (b.carpeta - a.carpeta) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  function pintar() {
    cont.innerHTML = '';
    if (modo === 'cuadricula') {
      raiz.querySelector('.sub-ruta').textContent = carpetaActual ? carpetaActual + '/' : '';
      if (carpetaActual) {
        const arriba = el(`<div class="icono-archivo"><div class="caja">${icono('flechaArriba', '', 22)}</div><span>..</span></div>`);
        arriba.ondblclick = arriba.onclick = () => { carpetaActual = carpetaActual.includes('/') ? carpetaActual.slice(0, carpetaActual.lastIndexOf('/')) : ''; pintar(); };
        cont.append(arriba);
      }
      for (const a of hijos(carpetaActual)) {
        const { ic, color } = iconoArchivo(a.rel, a.carpeta);
        const it = el(`<div class="icono-archivo ${seleccionado === a.rel ? 'sel' : ''}" data-rel="${esc(a.rel)}" draggable="${!a.carpeta}" title="${esc(a.rel)}"><div class="caja" style="color:${color}">${icono(ic, '', 22)}</div><span>${esc(a.carpeta ? a.nombre : a.nombre.replace(/\.(fscn)$/, ''))}</span></div>`);
        it.dataset.carpeta = a.carpeta ? '1' : '';
        cont.append(it);
      }
      return;
    }
    const visitar = (dir, nivel) => {
      for (const a of hijos(dir)) {
        if (a.carpeta) {
          const abierta = abiertas.has(a.rel);
          const f = el(`<div class="fila-archivo" data-rel="${esc(a.rel)}" data-carpeta="1" style="padding-left:${8 + nivel * 16}px">${icono(abierta ? 'carpetaAbierta' : 'carpeta', '', 16)}<span>${esc(a.nombre)}</span></div>`);
          cont.append(f);
          if (abierta) visitar(a.rel, nivel + 1);
        } else {
          const { ic, color } = iconoArchivo(a.rel);
          const f = el(`<div class="fila-archivo ${seleccionado === a.rel ? 'sel' : ''}" data-rel="${esc(a.rel)}" draggable="true" style="padding-left:${8 + nivel * 16}px" title="${esc(a.rel)}"><span style="color:${color}">${icono(ic, '', 15)}</span><span>${esc(a.nombre)}</span></div>`);
          cont.append(f);
        }
      }
    };
    visitar('', 0);
  }

  cont.addEventListener('click', (e) => {
    const f = e.target.closest('[data-rel]');
    if (!f) return;
    const rel = f.dataset.rel;
    if (f.dataset.carpeta) {
      if (modo === 'cuadricula') return;
      abiertas.has(rel) ? abiertas.delete(rel) : abiertas.add(rel);
      pintar();
      return;
    }
    seleccionado = rel;
    $$('.sel', cont).forEach(x => x.classList.remove('sel'));
    f.classList.add('sel');
    bus.emit('archivo:seleccionado', rel);
  });
  cont.addEventListener('dblclick', (e) => {
    const f = e.target.closest('[data-rel]');
    if (!f) return;
    if (f.dataset.carpeta) { if (modo === 'cuadricula') { carpetaActual = f.dataset.rel; pintar(); } return; }
    abrirArchivo(f.dataset.rel);
  });
  cont.addEventListener('dragstart', (e) => {
    const f = e.target.closest('[data-rel]');
    if (!f || f.dataset.carpeta) return;
    e.dataTransfer.setData('text/falcon-archivo', f.dataset.rel);
    e.dataTransfer.effectAllowed = 'copy';
  });
  raiz.querySelector('.desplazable').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const f = e.target.closest('[data-rel]');
    const rel = f ? f.dataset.rel : null;
    const carpeta = f && f.dataset.carpeta ? rel : (rel && rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : carpetaActual);
    menu(e.clientX, e.clientY, [
      ...(rel && !f.dataset.carpeta ? [
        { texto: 'Abrir', icono: 'carpetaAbierta', accion: () => abrirArchivo(rel) },
        { texto: 'Renombrar…', icono: 'lapiz', accion: () => renombrarArchivo(rel) },
        { texto: 'Mostrar en la carpeta', icono: 'carpeta', accion: () => window.falcon.sistema.mostrarEnCarpeta(est.proyecto.abs(rel)) },
        { texto: 'Mover a la papelera', icono: 'papelera', peligro: true, accion: () => borrarArchivo(rel) },
        '-',
      ] : rel ? [
        { texto: 'Renombrar…', icono: 'lapiz', accion: () => renombrarArchivo(rel) },
        { texto: 'Mover a la papelera', icono: 'papelera', peligro: true, accion: () => borrarArchivo(rel) },
        '-',
      ] : []),
      { texto: 'Nueva escena 2D', icono: 'imagen', accion: () => nuevaEscena('2D') },
      { texto: 'Nueva escena 3D', icono: 'cubo', accion: () => nuevaEscena('3D') },
      { texto: 'Nuevo script de Águila', icono: 'codigo', accion: async () => { const r = await nuevoScript(null); if (r) abrirArchivo(r); } },
      { texto: 'Nuevo Blueprint', icono: 'blueprint', accion: async () => { const r = await nuevoBlueprint(null); if (r) abrirArchivo(r); } },
      { texto: 'Nuevo material', icono: 'material', accion: () => nuevoMaterial() },
      { texto: 'Nueva carpeta', icono: 'carpeta', accion: () => nuevaCarpeta(carpeta || '') },
      { texto: 'Importar recursos…', icono: 'importar', accion: () => dialogoImportar(carpeta || undefined) },
    ]);
  });

  pintar();
  const quitar = [bus.on('archivos', pintar)];
  return { el: raiz, pintar, destruir: () => quitar.forEach(f => f()) };
}
