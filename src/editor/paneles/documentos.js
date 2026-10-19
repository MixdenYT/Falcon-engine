// Pestañas de documentos abiertos (nivel1 · menu · jugador.bp …).
import { est, bus, activarDocumento, cerrarDocumento } from '../estado.js';
import { guardar } from '../acciones.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, confirmar, menu } from '../../ui/componentes.js';

const ICONO_DOC = { escena: (d) => d.dim === '3D' ? 'cubo' : 'imagen', blueprint: () => 'blueprint', script: () => 'codigo', material: () => 'material', malla: () => 'cubo' };
const ETQ_DOC = { material: 'Material', malla: 'Malla' };

export function crearPestanas(contenedor, op = {}) {
  const raiz = el('<div class="docs"></div>');
  contenedor.append(raiz);
  const pintar = () => {
    raiz.innerHTML = '';
    for (const d of est.docs) {
      const p = el(`<div class="doc ${d === est.activo ? 'activo' : ''}" title="${esc(d.rel)}">
        ${icono(ICONO_DOC[d.tipo](d), '', 15)}<span>${esc(d.titulo)}</span>${ETQ_DOC[d.tipo] ? `<span class="tipo-doc">${ETQ_DOC[d.tipo]}</span>` : ''}
        ${d.sucio ? '<span class="sucio" title="Sin guardar"></span>' : ''}
        <span class="cerrar-doc" aria-label="Cerrar">${icono('cerrar', '', 13)}</span></div>`);
      p.onclick = (e) => { if (e.target.closest('.cerrar-doc')) cerrar(d); else activarDocumento(d); };
      p.onauxclick = (e) => { if (e.button === 1) cerrar(d); };
      p.oncontextmenu = (e) => {
        e.preventDefault();
        menu(e.clientX, e.clientY, [
          { texto: 'Guardar', icono: 'guardar', atajo: 'Ctrl S', accion: () => guardar(d), desactivado: !d.sucio },
          { texto: 'Cerrar', icono: 'cerrar', accion: () => cerrar(d) },
          { texto: 'Cerrar las demás', accion: async () => { for (const x of [...est.docs]) if (x !== d) await cerrar(x); } },
          '-',
          { texto: 'Mostrar en la carpeta', icono: 'carpeta', accion: () => window.falcon.sistema.mostrarEnCarpeta(est.proyecto.abs(d.rel)) },
        ]);
      };
      raiz.append(p);
    }
    if (op.nuevo !== false) {
      const b = el(`<button class="nuevo-doc" data-ayuda="Nuevo">${icono('mas', '', 16)}</button>`);
      b.onclick = () => op.alNuevo ? op.alNuevo(b) : null;
      raiz.append(b);
    }
    if (op.derecha) { const d = el('<div class="derecha"></div>'); raiz.append(d); op.derecha(d); }
    const act = raiz.querySelector('.doc.activo');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  pintar();
  const quitar = [bus.on('docs:lista', pintar), bus.on('doc:activo', pintar), bus.on('doc:sucio', pintar), bus.on('doc:guardado', pintar)];
  return { el: raiz, pintar, destruir: () => quitar.forEach(f => f()) };
}

export async function cerrar(d) {
  if (d.sucio) {
    const r = await confirmar({ titulo: `¿Guardar los cambios de «${d.titulo}»?`, mensaje: 'Si no los guardas, se perderán.', aceptar: 'Guardar', cancelar: 'Cancelar', tercero: 'No guardar' });
    if (r === false) return false;
    if (r === true) await guardar(d);
  }
  cerrarDocumento(d);
  return true;
}
