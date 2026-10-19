// Componentes de interfaz compartidos: menús, diálogos, avisos, globos de ayuda.
import { icono } from './iconos.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// ---- Menú flotante ----
let menuAbierto = null;

export function cerrarMenu() {
  if (menuAbierto) {
    const m = menuAbierto;
    menuAbierto = null;
    m.limpiar();
    m.el.remove();
    m.alCerrar && m.alCerrar();
  }
}

/**
 * Muestra un menú en (x, y).
 * items: [{ texto, icono, atajo, accion, desactivado, marcado, peligro }] | '-' | { cabecera }
 */
export function menu(x, y, items, op = {}) {
  cerrarMenu();
  const m = el('<div class="menu-flotante" role="menu"></div>');
  const opciones = [];
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.append(el('<div class="linea"></div>')); continue; }
    if (it.cabecera) { m.append(el(`<div class="cabecera">${esc(it.cabecera)}</div>`)); continue; }
    const o = el(`<div class="opcion ${it.desactivado ? 'desactivada' : ''} ${it.peligro ? 'peligro' : ''}" role="menuitem">
      ${it.marcado !== undefined ? `<span class="marca">${it.marcado ? icono('check', '', 16) : ''}</span>` : it.icono ? icono(it.icono, '', 16) : ''}
      <span>${esc(it.texto)}</span>${it.atajo ? `<span class="atajo">${esc(it.atajo)}</span>` : ''}</div>`);
    o.addEventListener('click', (e) => { e.stopPropagation(); cerrarMenu(); it.accion && it.accion(); });
    o.addEventListener('mouseenter', () => { opciones.forEach(p => p.classList.remove('foco')); o.classList.add('foco'); });
    m.append(o);
    if (!it.desactivado) opciones.push(o);
  }
  document.body.append(m);
  const r = m.getBoundingClientRect();
  const ancho = window.innerWidth, alto = window.innerHeight;
  m.style.left = Math.max(6, Math.min(x, ancho - r.width - 6)) + 'px';
  m.style.top = Math.max(6, (y + r.height > alto - 6 ? Math.max(6, y - r.height - (op.altoOrigen || 0)) : y)) + 'px';

  let foco = -1;
  const tecla = (e) => {
    if (e.key === 'Escape') { cerrarMenu(); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      foco = (foco + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length;
      opciones.forEach((p, i) => p.classList.toggle('foco', i === foco));
    } else if (e.key === 'Enter' && foco >= 0) { e.preventDefault(); opciones[foco].click(); }
  };
  const fuera = (e) => { if (!m.contains(e.target)) cerrarMenu(); };
  setTimeout(() => {
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
  });
  window.addEventListener('blur', cerrarMenu, { once: true });
  menuAbierto = {
    el: m, alCerrar: op.alCerrar,
    limpiar() { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); },
  };
  return m;
}

export function menuBajo(boton, items, op = {}) {
  const r = boton.getBoundingClientRect();
  boton.classList.add('abierto');
  return menu(r.left, r.bottom + 4, items, { altoOrigen: r.height + 8, ...op, alCerrar: () => { boton.classList.remove('abierto'); op.alCerrar && op.alCerrar(); } });
}

// ---- Diálogos ----
export function dialogo({ titulo, sub, contenido, botones = [{ texto: 'Aceptar', tipo: 'principal', valor: true }], ancho, alAbrir, cerrable = true }) {
  return new Promise((resolver) => {
    const fondo = el('<div class="fondo-dialogo"></div>');
    const d = el(`<div class="dialogo" role="dialog">${titulo ? `<h2>${esc(titulo)}</h2>` : ''}${sub ? `<p class="sub">${esc(sub)}</p>` : ''}<div class="cuerpo"></div><div class="acciones"></div></div>`);
    if (ancho) d.style.width = `min(${ancho}px, calc(100vw - 48px))`;
    const cuerpo = d.querySelector('.cuerpo');
    if (typeof contenido === 'string') cuerpo.innerHTML = contenido;
    else if (contenido) cuerpo.append(contenido);
    const acciones = d.querySelector('.acciones');
    let terminado = false;
    const cerrar = (v) => {
      if (terminado) return;
      terminado = true;
      document.removeEventListener('keydown', tecla, true);
      fondo.remove();
      resolver(v);
    };
    for (const b of botones) {
      const btn = el(`<button class="btn ${b.tipo || 'secundario'}">${b.icono ? icono(b.icono, '', 16) : ''}${esc(b.texto)}</button>`);
      btn.addEventListener('click', async () => {
        if (b.accion) {
          const r = await b.accion(d);
          if (r === false) return;
          cerrar(r === undefined ? b.valor : r);
        } else cerrar(b.valor);
      });
      acciones.append(btn);
    }
    const tecla = (e) => {
      if (e.key === 'Escape' && cerrable) { e.preventDefault(); e.stopPropagation(); cerrar(null); }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.target.closest('.no-enter')) {
        const p = acciones.querySelector('.btn.principal');
        if (p) { e.preventDefault(); p.click(); }
      }
    };
    document.addEventListener('keydown', tecla, true);
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo && cerrable) cerrar(null); });
    fondo.append(d);
    document.body.append(fondo);
    const primero = d.querySelector('input, select, textarea');
    if (primero) setTimeout(() => { primero.focus(); primero.select && primero.select(); });
    alAbrir && alAbrir(d, cerrar);
  });
}

export async function pedirTexto({ titulo, sub, etiqueta, valor = '', placeholder = '', aceptar = 'Aceptar', validar }) {
  const c = el(`<div><label class="etiqueta-campo">${esc(etiqueta || '')}</label><input class="campo" value="${esc(valor)}" placeholder="${esc(placeholder)}"><div class="error-campo" style="color:var(--error);font-size:13px;margin-top:6px;min-height:18px"></div></div>`);
  const input = c.querySelector('input');
  const r = await dialogo({
    titulo, sub, contenido: c,
    botones: [
      { texto: 'Cancelar', tipo: 'secundario', valor: null },
      {
        texto: aceptar, tipo: 'principal', accion: () => {
          const v = input.value.trim();
          const err = validar ? validar(v) : (!v ? 'Escribe un nombre.' : null);
          if (err) { c.querySelector('.error-campo').textContent = err; input.focus(); return false; }
          return v;
        },
      },
    ],
  });
  return r;
}

export async function confirmar({ titulo, mensaje, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false, tercero }) {
  const botones = [{ texto: cancelar, tipo: 'secundario', valor: false }];
  if (tercero) botones.push({ texto: tercero, tipo: 'secundario', valor: 'tercero' });
  botones.push({ texto: aceptar, tipo: peligro ? 'peligro' : 'principal', valor: true });
  return (await dialogo({ titulo, sub: mensaje, botones })) ?? false;
}

// ---- Avisos ----
let contAvisos = null;
export function avisar(texto, tipo = 'ok', ms = 3200) {
  if (!contAvisos) { contAvisos = el('<div class="avisos"></div>'); document.body.append(contAvisos); }
  const ic = tipo === 'error' ? 'alerta' : tipo === 'aviso' ? 'info' : 'check';
  const a = el(`<div class="aviso-flotante ${tipo}">${icono(ic, '', 18)}<div>${esc(texto)}</div></div>`);
  contAvisos.append(a);
  setTimeout(() => { a.style.transition = 'opacity .2s'; a.style.opacity = '0'; setTimeout(() => a.remove(), 220); }, ms);
}

// ---- Globos de ayuda: cualquier elemento con data-ayuda="texto" ----
let globo = null, tGlobo = 0;
export function activarGlobos() {
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-ayuda]');
    clearTimeout(tGlobo);
    if (globo) { globo.remove(); globo = null; }
    if (!t) return;
    tGlobo = setTimeout(() => {
      if (!document.body.contains(t)) return;
      globo = el(`<div class="globo-ayuda">${esc(t.dataset.ayuda)}</div>`);
      document.body.append(globo);
      const r = t.getBoundingClientRect(), g = globo.getBoundingClientRect();
      let x = r.left + r.width / 2 - g.width / 2, y = r.bottom + 6;
      if (y + g.height > innerHeight - 4) y = r.top - g.height - 6;
      globo.style.left = Math.max(4, Math.min(x, innerWidth - g.width - 4)) + 'px';
      globo.style.top = y + 'px';
    }, 450);
  });
  document.addEventListener('mousedown', () => { clearTimeout(tGlobo); if (globo) { globo.remove(); globo = null; } });
}

// ---- Barra de título con controles de ventana ----
export function controlesVentana() {
  const c = el(`<div class="controles-ventana">
    <button data-v="min" aria-label="Minimizar">${icono('minimizar', '', 16)}</button>
    <button data-v="max" aria-label="Maximizar">${icono('maximizar', '', 14)}</button>
    <button data-v="cerrar" class="cerrar" aria-label="Cerrar">${icono('cerrar', '', 16)}</button>
  </div>`);
  c.querySelector('[data-v=min]').onclick = () => window.falcon.ventana.minimizar();
  c.querySelector('[data-v=max]').onclick = () => window.falcon.ventana.maximizar();
  c.querySelector('[data-v=cerrar]').onclick = () => {
    const ev = new CustomEvent('falcon:cerrar', { cancelable: true });
    if (window.dispatchEvent(ev)) window.falcon.ventana.cerrar();
  };
  const actualizar = (max) => { c.querySelector('[data-v=max]').innerHTML = icono(max ? 'restaurar' : 'maximizar', '', 14); };
  window.falcon.ventana.maximizada().then(actualizar);
  window.falcon.ventana.alCambiar(({ maximizada }) => actualizar(maximizada));
  return c;
}

// Doble clic en la barra para maximizar.
export function barraArrastrable(barra) {
  barra.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input, .no-arrastre, [data-menu]')) return;
    window.falcon.ventana.maximizar();
  });
}

// Actualiza el relleno de un deslizador.
export function pintarDeslizador(input) {
  const min = Number(input.min || 0), max = Number(input.max || 100);
  input.style.setProperty('--p', ((Number(input.value) - min) / (max - min) * 100) + '%');
}
document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('deslizador')) pintarDeslizador(e.target); });

export function interruptor(marcado, texto = '', nombre = '') {
  return `<label class="interruptor"><input type="checkbox" ${marcado ? 'checked' : ''} ${nombre ? `data-campo="${esc(nombre)}"` : ''}><span class="pista"></span>${texto ? `<span class="txt">${esc(texto)}</span>` : ''}</label>`;
}

// Formatos
export function formatoTamano(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1).replace('.', ',') + ' KB';
  if (b < 1024 ** 3) return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  return (b / 1024 ** 3).toFixed(2).replace('.', ',') + ' GB';
}

export function hace(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  const dia = 86400000;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (ts >= hoy.getTime()) return 'Abierto hoy';
  if (ts >= hoy.getTime() - dia) return 'Ayer';
  const dias = Math.floor(d / dia);
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 14) return 'La semana pasada';
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 60) return 'Hace 1 mes';
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`;
  return 'Hace más de un año';
}

export function hora(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

export function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const urlArchivo = (ruta) => 'falcon://fs/' + encodeURI(ruta.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F');
