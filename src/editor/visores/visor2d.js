// Visor de escenas 2D del editor.
import { est, bus, anotarEvento } from '../estado.js';
import { seleccionar } from '../acciones.js';
import { anadirNodo, eliminarNodos, duplicarNodos, cambiarProp, cambiarNodo } from '../operaciones.js';
import { Render2D, CacheImagenes, recorrerConMatriz, tamanoNodo, matrizLocal } from '../../motor/render2d.js';
import { buscarNodo, buscarPadre, crearNodo, clonarNodo, tipo as tipoNodo } from '../../motor/tipos.js';
import { tipoRecurso, sinExtension, normalizarEscena } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menuBajo, menu, avisar } from '../../ui/componentes.js';
import { menuTipos } from '../paneles/arbol.js';

const HOJAS = new Set(['Sprite', 'Colision']);

export function crearVisor2D(contenedor, op = {}) {
  const raiz = el(`<section class="panel visor visor-2d">
    ${op.sinBarra ? '' : `<div class="barra-visor">
      <div class="herramientas-visor">
        <button data-h="seleccionar" data-ayuda="Seleccionar (Q)">${icono('cursor', '', 16)}</button>
        <button data-h="mover" data-ayuda="Mover (W)">${icono('mover', '', 16)}</button>
        <button data-h="rotar" data-ayuda="Rotar (E)">${icono('rotar', '', 16)}</button>
        <button data-h="escalar" data-ayuda="Escalar (R)">${icono('escalar', '', 16)}</button>
        <button data-h="lapiz" data-ayuda="Lápiz de mosaicos (B) · Mayús para borrar">${icono('lapiz', '', 16)}</button>
      </div>
      <div class="separador-v"></div>
      <button class="btn secundario peq" data-a="ajustar">${icono('cuadricula', '', 15)}Ajustar a cuadrícula</button>
      <button class="btn secundario peq" data-a="ver">Ver ${icono('flechaAbajo', '', 13)}</button>
      <div class="coords"><span class="cx">x 0</span><span class="cy">y 0</span></div>
      <button class="zoom" data-a="zoom">100 %</button>
    </div>`}
    <div class="lienzo-visor"><canvas tabindex="0"></canvas>
      <div class="pildoras-visor"><span class="pildora"><span class="punto"></span>2D</span><span class="pildora sel-info oculto"></span></div>
      ${op.textoGuia ? `<div class="pildora" style="position:absolute;left:12px;top:12px">${icono('cursor', '', 13)}${esc(op.textoGuia)}</div>` : ''}
    </div></section>`);
  contenedor.append(raiz);
  const lienzo = $('canvas', raiz);
  const ctx = lienzo.getContext('2d');
  const imagenes = new CacheImagenes(est.proyecto, () => { sucio = true; });
  const render = new Render2D(imagenes);
  let sucio = true;
  let herramienta = est._herramienta2d || 'seleccionar';
  let ajustar = est._ajustar2d ?? false;
  const ver = est._ver2d ||= { cuadricula: true, colisiones: true, camara: true, nombres: true };
  let raton = { x: 0, y: 0, mx: 0, my: 0 };
  let accion = null;
  let espacio = false;
  let vivo = true;

  const doc = () => (est.activo && est.activo.tipo === 'escena' && est.activo.dim === '2D') ? est.activo : null;
  const cam = () => {
    const d = doc();
    if (!d) return { x: 0, y: 0, zoom: 1 };
    if (!d.vista.camara) {
      const res = est.proyecto.datos.resolucion;
      const c = camaraEscena(d);
      d.vista.camara = c ? { x: c.cx, y: c.cy, zoom: 0.6 } : { x: res[0] / 2, y: res[1] / 2, zoom: 0.6 };
    }
    return d.vista.camara;
  };

  // ---------- Coordenadas ----------
  const dpr = () => window.devicePixelRatio || 1;
  const vista = () => ({ ancho: lienzo.width / dpr(), alto: lienzo.height / dpr(), escala: dpr() });
  const aMundo = (px, py) => { const c = cam(), v = vista(); return [c.x + (px - v.ancho / 2) / c.zoom, c.y + (py - v.alto / 2) / c.zoom]; };
  const aPantalla = (x, y) => { const c = cam(), v = vista(); return [(x - c.x) * c.zoom + v.ancho / 2, (y - c.y) * c.zoom + v.alto / 2]; };
  const rejilla = () => est.ajustes.cuadricula || 32;
  const encajar = (v) => ajustar ? Math.round(v / rejilla()) * rejilla() : Math.round(v);

  // Cámara de la escena (para dibujar el área visible y colocar la interfaz).
  function camaraEscena(d) {
    let r = null;
    recorrerConMatriz(d.datos.raiz, (n, m, z, ui, padre) => {
      if (r || n.tipo !== 'Camara2D' || !n.props.actual) return;
      let cx = m.e, cy = m.f;
      if (n.props.seguir) {
        let seg = null;
        recorrerConMatriz(d.datos.raiz, (x, mx) => { if (!seg && x.nombre === n.props.seguir) seg = mx; });
        if (seg) { cx = seg.e + n.props.posicion[0]; cy = seg.f + n.props.posicion[1]; }
      }
      const [W, H] = est.proyecto.datos.resolucion;
      const zc = n.props.zoom || 1;
      if (n.props.limitar) {
        const [l, t, rr, b] = n.props.limites;
        const mw = W / 2 / zc, mh = H / 2 / zc;
        cx = rr - l < mw * 2 ? (l + rr) / 2 : Math.max(l + mw, Math.min(rr - mw, cx));
        cy = b - t < mh * 2 ? (t + b) / 2 : Math.max(t + mh, Math.min(b - mh, cy));
      }
      r = { n, cx, cy, w: W / zc, h: H / zc, zoom: zc };
    });
    return r;
  }

  // ---------- Límites y selección ----------
  function limitesPropios(n, m) {
    const t = n.tipo === 'Mosaicos' ? null : tamanoNodo(n);
    if (!t) return null;
    const [w, h] = t;
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
    return [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))];
  }

  function limitesMosaicos(n, m) {
    const T = n.props.tam_celda; const ks = Object.keys(n.props.celdas || {});
    if (!ks.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of ks) { const [c, f] = k.split(',').map(Number); x0 = Math.min(x0, c); y0 = Math.min(y0, f); x1 = Math.max(x1, c + 1); y1 = Math.max(y1, f + 1); }
    return [m.e + x0 * T, m.f + y0 * T, m.e + x1 * T, m.f + y1 * T];
  }

  // Mapa id → { m, caja (mundo), ui, cajaPantalla }
  function geometria(d) {
    const mapa = new Map();
    const c = camaraEscena(d);
    recorrerConMatriz(d.datos.raiz, (n, m, z, ui) => {
      let caja = null;
      if (ui) {
        if (n.tipo === 'Interfaz') { mapa.set(n.id, { m, caja: null, ui }); return; }
        const t = tamanoNodo(n);
        if (t && c) {
          const pos = posUI(d, n);
          let [x, y] = pos;
          let [w, h] = t;
          if (n.tipo === 'Etiqueta') { if (n.props.alineacion === 'centro') x -= w / 2; else if (n.props.alineacion === 'derecha') x -= w; h = (n.props.tam || 24) * 1.4; y -= h * 0.1; }
          const k = 1 / c.zoom;
          const ox = c.cx - c.w / 2, oy = c.cy - c.h / 2;
          caja = [ox + x * k, oy + y * k, ox + (x + w) * k, oy + (y + h) * k];
        }
      } else caja = n.tipo === 'Mosaicos' ? limitesMosaicos(n, m) : limitesPropios(n, m);
      mapa.set(n.id, { m, caja, ui, z });
    });
    return mapa;
  }

  function posUI(d, n) {
    let x = 0, y = 0;
    for (let p = n; p && p.tipo !== 'Interfaz'; p = buscarPadre(d.datos.raiz, p.id)) { const pos = p.props.posicion || [0, 0]; x += pos[0]; y += pos[1]; }
    return [x, y];
  }

  function cajaCompleta(d, id, geo) {
    const n = buscarNodo(d.datos.raiz, id);
    if (!n) return null;
    let r = null;
    const unir = (c) => { if (!c) return; r = r ? [Math.min(r[0], c[0]), Math.min(r[1], c[1]), Math.max(r[2], c[2]), Math.max(r[3], c[3])] : c.slice(); };
    const visitar = (x) => { const g = geo.get(x.id); if (g && x.tipo !== 'Camara2D' && x.tipo !== 'Fondo') unir(g.caja); x.hijos.forEach(h => { if (h.tipo !== 'Camara2D') visitar(h); }); };
    visitar(n);
    if (!r) { const g = geo.get(id); if (g) r = [g.m.e - 12, g.m.f - 12, g.m.e + 12, g.m.f + 12]; }
    return r;
  }

  function elegir(d, wx, wy, todos = false) {
    const geo = geometria(d);
    const candidatos = [];
    let orden = 0;
    recorrerConMatriz(d.datos.raiz, (n, m, z, ui) => {
      orden++;
      if (n.visible === false) return false;
      const g = geo.get(n.id);
      if (!g || !g.caja || n === d.datos.raiz || n.tipo === 'Fondo' || n.tipo === 'Camara2D') return;
      const [x0, y0, x1, y1] = g.caja;
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) return;
      if (n.tipo === 'Mosaicos') {
        const T = n.props.tam_celda;
        const k = `${Math.floor((wx - g.m.e) / T)},${Math.floor((wy - g.m.f) / T)}`;
        if (!(k in n.props.celdas)) return;
      }
      if (n.tipo === 'Colision' && !ver.colisiones) return;
      candidatos.push({ n, z: (ui ? 100000 : 0) + (g.z || 0), orden, area: (x1 - x0) * (y1 - y0) });
    });
    candidatos.sort((a, b) => (b.z - a.z) || (b.orden - a.orden));
    if (todos) return candidatos.map(c => c.n);
    let n = candidatos[0] && candidatos[0].n;
    if (!n) return null;
    // Clic en el dibujo de un personaje: se elige el personaje (salvo que ya esté elegido).
    if (HOJAS.has(n.tipo) && !d.seleccion.includes(n.id)) {
      const p = buscarPadre(d.datos.raiz, n.id);
      if (p && p !== d.datos.raiz && !tamanoNodo(p) && !d.seleccion.includes(p.id)) n = p;
    }
    return n;
  }

  // ---------- Dibujo ----------
  function base(c, v) {
    return new DOMMatrix().scaleSelf(v.escala, v.escala).translateSelf(v.ancho / 2, v.alto / 2).scaleSelf(c.zoom, c.zoom).translateSelf(-c.x, -c.y);
  }

  function dibujar() {
    const d = doc();
    const r = lienzo.getBoundingClientRect();
    const W = Math.round(r.width * dpr()), H = Math.round(r.height * dpr());
    if (lienzo.width !== W || lienzo.height !== H) { lienzo.width = W; lienzo.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0B0E0C';
    ctx.fillRect(0, 0, W, H);
    if (!d) return;
    const c = cam(), v = vista();
    render.tiempo = performance.now() / 1000;
    if (ver.cuadricula) dibujarRejilla(c, v);
    const ce = camaraEscena(d);
    // Fondo solo dentro del área de la cámara para que se entienda qué ve el jugador.
    ctx.save();
    if (ce) {
      const b = base(c, v);
      ctx.setTransform(b);
      ctx.beginPath(); ctx.rect(ce.cx - ce.w / 2, ce.cy - ce.h / 2, ce.w, ce.h); ctx.clip();
    }
    const fondos = d.datos.raiz.hijos.filter(h => h.tipo === 'Fondo' && h.visible !== false);
    if (ce && fondos.length) {
      const vistaCam = { ancho: ce.w * ce.zoom, alto: ce.h * ce.zoom, escala: 1 };
      const mCam = base(c, v).translate(ce.cx - ce.w / 2, ce.cy - ce.h / 2).scale(1 / ce.zoom, 1 / ce.zoom);
      for (const f of fondos) render.dibujarFondo(conBase(ctx, mCam), f, { x: ce.cx, y: ce.cy, zoom: ce.zoom }, vistaCam);
    }
    ctx.restore();
    // Mundo sin fondos (ya dibujados).
    const sinFondo = { ...d.datos.raiz, hijos: d.datos.raiz.hijos.filter(h => h.tipo !== 'Fondo') };
    render.dibujarMundo(ctx, sinFondo, c, v, { editor: ver.colisiones, mostrarOcultos: true, limitesVista: [W, H] });
    // Interfaz dentro del área de la cámara.
    if (ce) {
      const mUI = base(c, v).translate(ce.cx - ce.w / 2, ce.cy - ce.h / 2).scale(1 / ce.zoom, 1 / ce.zoom);
      render.dibujarInterfaz(conBase(ctx, mUI), d.datos.raiz, { ancho: ce.w * ce.zoom, alto: ce.h * ce.zoom, escala: 1 }, { editor: true, mostrarOcultos: true });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ce && ver.camara) dibujarAreaCamara(ce, c);
    dibujarSeleccion(d, c);
    if (accion && accion.tipo === 'caja') {
      const [x0, y0] = aPantalla(accion.x0, accion.y0), [x1, y1] = aPantalla(raton.wx, raton.wy);
      ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
      ctx.strokeStyle = '#3DDC84'; ctx.fillStyle = 'rgba(61,220,132,.08)'; ctx.lineWidth = 1;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    }
    if (herramienta === 'lapiz' && d.nodoSel && d.nodoSel.tipo === 'Mosaicos') dibujarCursorMosaico(d, c);
  }

  function dibujarRejilla(c, v) {
    const paso = rejilla();
    let p = paso;
    while (p * c.zoom < 14) p *= 2;
    const [x0, y0] = aMundo(0, 0), [x1, y1] = aMundo(v.ancho, v.alto);
    ctx.setTransform(base(c, v));
    ctx.lineWidth = 1 / c.zoom;
    for (let x = Math.floor(x0 / p) * p; x <= x1; x += p) {
      ctx.strokeStyle = Math.round(x / p) % 4 === 0 ? '#1A201C' : '#141916';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    }
    for (let y = Math.floor(y0 / p) * p; y <= y1; y += p) {
      ctx.strokeStyle = Math.round(y / p) % 4 === 0 ? '#1A201C' : '#141916';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    ctx.strokeStyle = '#26302B'; ctx.lineWidth = 1.5 / c.zoom;
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  }

  function dibujarAreaCamara(ce) {
    const [x0, y0] = aPantalla(ce.cx - ce.w / 2, ce.cy - ce.h / 2), [x1, y1] = aPantalla(ce.cx + ce.w / 2, ce.cy + ce.h / 2);
    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    ctx.strokeStyle = 'rgba(169,181,174,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 8); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '500 13px Manrope'; ctx.fillStyle = 'rgba(169,181,174,.85)';
    ctx.fillText(`${ce.n.nombre} · área visible`, x0 + 2, y0 - 8);
  }

  function dibujarSeleccion(d, c) {
    if (!d.seleccion.length) return;
    const geo = geometria(d);
    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    for (const id of d.seleccion) {
      const n = buscarNodo(d.datos.raiz, id);
      if (!n || n === d.datos.raiz) continue;
      const caja = cajaCompleta(d, id, geo);
      if (!caja) continue;
      const [x0, y0] = aPantalla(caja[0], caja[1]), [x1, y1] = aPantalla(caja[2], caja[3]);
      ctx.strokeStyle = '#3DDC84'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6);
      ctx.fillStyle = '#3DDC84';
      for (const [hx, hy] of [[x0 - 3, y0 - 3], [x1 + 3, y0 - 3], [x1 + 3, y1 + 3], [x0 - 3, y1 + 3]]) ctx.fillRect(hx - 4, hy - 4, 8, 8);
      if (ver.nombres) {
        ctx.font = '800 13px Manrope';
        const w = ctx.measureText(n.nombre).width + 22;
        const cx = (x0 + x1) / 2;
        ctx.beginPath(); ctx.roundRect(cx - w / 2, y0 - 34, w, 24, 6); ctx.fill();
        ctx.fillStyle = '#04140B'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.nombre, cx, y0 - 22); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      // Gizmo en el origen del nodo.
      const g = geo.get(id);
      if (!g || g.ui) continue;
      const [ox, oy] = aPantalla(g.m.e, g.m.f);
      if (herramienta === 'mover' || herramienta === 'seleccionar') {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#F26B6B'; ctx.fillStyle = '#F26B6B';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 62, oy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox + 74, oy); ctx.lineTo(ox + 62, oy - 6); ctx.lineTo(ox + 62, oy + 6); ctx.fill();
        ctx.strokeStyle = '#74B6F7'; ctx.fillStyle = '#74B6F7';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 62); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox, oy - 74); ctx.lineTo(ox - 6, oy - 62); ctx.lineTo(ox + 6, oy - 62); ctx.fill();
      } else if (herramienta === 'rotar') {
        ctx.strokeStyle = '#F2C46D'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox, oy, 52, 0, Math.PI * 2); ctx.stroke();
        const a = (n.props.rotacion || 0) * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 52, oy + Math.sin(a) * 52); ctx.stroke();
      } else if (herramienta === 'escalar') {
        ctx.strokeStyle = '#F26B6B'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 58, oy); ctx.stroke();
        ctx.fillStyle = '#F26B6B'; ctx.fillRect(ox + 56, oy - 6, 12, 12);
        ctx.strokeStyle = '#74B6F7'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 58); ctx.stroke();
        ctx.fillStyle = '#74B6F7'; ctx.fillRect(ox - 6, oy - 68, 12, 12);
      }
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0B0E0C'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#0B0E0C'; ctx.fill();
    }
  }

  function dibujarCursorMosaico(d, c) {
    const n = d.nodoSel;
    const geo = geometria(d).get(n.id);
    const T = n.props.tam_celda;
    const cx = Math.floor((raton.wx - geo.m.e) / T), cy = Math.floor((raton.wy - geo.m.f) / T);
    const [x0, y0] = aPantalla(geo.m.e + cx * T, geo.m.f + cy * T);
    ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    ctx.strokeStyle = espacio ? '#F07A7A' : '#3DDC84'; ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, T * c.zoom, T * c.zoom);
  }

  // ---------- Interacción ----------
  function actualizarCoords(e) {
    const r = lienzo.getBoundingClientRect();
    raton.px = e.clientX - r.left; raton.py = e.clientY - r.top;
    [raton.wx, raton.wy] = aMundo(raton.px, raton.py);
    const cx = raiz.querySelector('.cx'), cy = raiz.querySelector('.cy');
    if (cx) { cx.textContent = `x ${Math.round(raton.wx)}`; cy.textContent = `y ${Math.round(raton.wy)}`; }
  }

  function sobreGizmo(d) {
    if (!d.nodoSel || (herramienta !== 'mover' && herramienta !== 'seleccionar' && herramienta !== 'escalar')) return null;
    const g = geometria(d).get(d.nodoSel.id);
    if (!g || g.ui) return null;
    const [ox, oy] = aPantalla(g.m.e, g.m.f);
    const dx = raton.px - ox, dy = raton.py - oy;
    if (dx > 14 && dx < 78 && Math.abs(dy) < 8) return 'x';
    if (-dy > 14 && -dy < 78 && Math.abs(dx) < 8) return 'y';
    return null;
  }

  lienzo.addEventListener('mousedown', (e) => {
    const d = doc();
    if (!d) return;
    lienzo.focus();
    actualizarCoords(e);
    const c = cam();
    if (e.button === 1 || (e.button === 0 && espacio && herramienta !== 'lapiz') || e.button === 2 && herramienta !== 'lapiz') {
      accion = { tipo: 'pan', px: e.clientX, py: e.clientY, cx: c.x, cy: c.y, movido: false, derecho: e.button === 2 };
      return;
    }
    if (e.button !== 0 && !(e.button === 2 && herramienta === 'lapiz')) return;
    if (herramienta === 'lapiz') {
      const n = d.nodoSel;
      if (!n || n.tipo !== 'Mosaicos') { avisar('Selecciona un nodo Mosaicos para dibujar con el lápiz.', 'aviso'); return; }
      accion = { tipo: 'pintar', borrar: e.shiftKey || e.button === 2, clave: 'pintar-' + Date.now() };
      pintarCelda(d);
      return;
    }
    const eje = sobreGizmo(d);
    const n = eje ? d.nodoSel : elegir(d, raton.wx, raton.wy);
    if (!n) {
      if (e.shiftKey) accion = { tipo: 'caja', x0: raton.wx, y0: raton.wy };
      else { accion = { tipo: 'pan', px: e.clientX, py: e.clientY, cx: c.x, cy: c.y, movido: false, deseleccionar: true }; }
      return;
    }
    if (e.ctrlKey || e.metaKey) { seleccionar(d.seleccion.includes(n.id) ? d.seleccion.filter(x => x !== n.id) : [...d.seleccion, n.id], d); return; }
    if (!d.seleccion.includes(n.id)) seleccionar([n.id], d);
    const ids = d.seleccion.filter(id => id !== d.datos.raiz.id);
    const inicio = new Map(ids.map(id => { const x = buscarNodo(d.datos.raiz, id); return [id, { pos: (x.props.posicion || [0, 0]).slice(), rot: x.props.rotacion || 0, esc: Array.isArray(x.props.escala) ? x.props.escala.slice() : [1, 1] }]; }));
    const tipoAccion = herramienta === 'rotar' ? 'rotar' : herramienta === 'escalar' ? 'escalar' : 'mover';
    accion = { tipo: tipoAccion, eje, x0: raton.wx, y0: raton.wy, inicio, clave: 'arrastre-' + Date.now(), movido: false };
  });

  window.addEventListener('mousemove', alMover);
  function alMover(e) {
    if (!vivo) return;
    const d = doc();
    if (!d) return;
    actualizarCoords(e);
    if (!accion) { if (herramienta === 'lapiz') sucio = true; lienzo.style.cursor = espacio ? 'grab' : sobreGizmo(d) ? 'pointer' : 'default'; return; }
    const c = cam();
    if (accion.tipo === 'pan') {
      const dx = e.clientX - accion.px, dy = e.clientY - accion.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) accion.movido = true;
      c.x = accion.cx - dx / c.zoom; c.y = accion.cy - dy / c.zoom;
      lienzo.style.cursor = 'grabbing';
      if (accion.movido) anotarEvento('vista_movida');
      sucio = true;
      return;
    }
    if (accion.tipo === 'pintar') { pintarCelda(d); return; }
    if (accion.tipo === 'caja') { sucio = true; return; }
    let dx = raton.wx - accion.x0, dy = raton.wy - accion.y0;
    if (!accion.movido && Math.hypot(dx * c.zoom, dy * c.zoom) < 3) return;
    accion.movido = true;
    if (accion.eje === 'x') dy = 0;
    if (accion.eje === 'y') dx = 0;
    d.cambiar((esc) => {
      for (const [id, ini] of accion.inicio) {
        const n = buscarNodo(esc.raiz, id);
        if (!n) continue;
        if (accion.tipo === 'mover' && n.props.posicion) {
          const padre = buscarPadre(esc.raiz, id);
          const k = padre ? escalaMundo(d, padre) : [1, 1];
          n.props.posicion = [encajar(ini.pos[0] + dx / k[0]), encajar(ini.pos[1] + dy / k[1])];
        } else if (accion.tipo === 'rotar') {
          const g = geometria(d).get(id);
          const a0 = Math.atan2(accion.y0 - g.m.f, accion.x0 - g.m.e), a1 = Math.atan2(raton.wy - g.m.f, raton.wx - g.m.e);
          let r = ini.rot + (a1 - a0) * 180 / Math.PI;
          if (ajustar || e.shiftKey) r = Math.round(r / 15) * 15;
          n.props.rotacion = Math.round(r * 10) / 10;
        } else if (accion.tipo === 'escalar' && Array.isArray(n.props.escala)) {
          const fx = accion.eje === 'y' ? 1 : 1 + dx / 100, fy = accion.eje === 'x' ? 1 : (accion.eje === 'y' ? 1 - dy / 100 : 1 + dx / 100);
          n.props.escala = [Math.max(0.05, Math.round(ini.esc[0] * fx * 100) / 100), Math.max(0.05, Math.round(ini.esc[1] * fy * 100) / 100)];
        }
      }
    }, { fusionar: accion.clave, prop: accion.tipo === 'mover' ? 'posicion' : accion.tipo === 'rotar' ? 'rotacion' : 'escala' });
    sucio = true;
  }

  window.addEventListener('mouseup', alSoltar);
  function alSoltar() {
    if (!vivo || !accion) return;
    const d = doc();
    const a = accion;
    accion = null;
    if (!d) return;
    lienzo.style.cursor = 'default';
    if (a.tipo === 'pan' && !a.movido) {
      if (a.deseleccionar) seleccionar([], d);
      if (a.derecho) menuContextual(d);
    }
    if (a.tipo === 'caja') {
      const x0 = Math.min(a.x0, raton.wx), x1 = Math.max(a.x0, raton.wx), y0 = Math.min(a.y0, raton.wy), y1 = Math.max(a.y0, raton.wy);
      const geo = geometria(d);
      const ids = [];
      for (const h of d.datos.raiz.hijos) {
        const cj = cajaCompleta(d, h.id, geo);
        if (cj && cj[0] >= x0 && cj[2] <= x1 && cj[1] >= y0 && cj[3] <= y1 && h.tipo !== 'Fondo') ids.push(h.id);
      }
      seleccionar(ids, d);
    }
    if ((a.tipo === 'mover' || a.tipo === 'rotar' || a.tipo === 'escalar') && a.movido) {
      anotarEvento('nodo_movido');
      for (const id of a.inicio.keys()) {
        const n = buscarNodo(d.datos.raiz, id);
        const clave = a.tipo === 'mover' ? 'posicion' : a.tipo === 'rotar' ? 'rotacion' : 'escala';
        if (n && est.juego.activo) window.falcon.juego.enviar({ tipo: 'propiedad', id, clave, valor: n.props[clave] });
      }
    }
    sucio = true;
  }

  function escalaMundo(d, nodo) {
    const g = geometria(d).get(nodo.id);
    return g ? [Math.hypot(g.m.a, g.m.b) || 1, Math.hypot(g.m.c, g.m.d) || 1] : [1, 1];
  }

  function pintarCelda(d) {
    const n = d.nodoSel;
    const g = geometria(d).get(n.id);
    const T = n.props.tam_celda;
    const k = `${Math.floor((raton.wx - g.m.e) / T)},${Math.floor((raton.wy - g.m.f) / T)}`;
    const borrar = accion.borrar || espacio;
    if (borrar ? !(k in n.props.celdas) : n.props.celdas[k] === n.props.pincel) return;
    d.cambiar((esc) => {
      const x = buscarNodo(esc.raiz, n.id);
      if (borrar) delete x.props.celdas[k]; else x.props.celdas[k] = x.props.pincel ?? 0;
    }, { fusionar: accion.clave, prop: 'celdas' });
    if (est.juego.activo) window.falcon.juego.enviar({ tipo: 'propiedad', id: n.id, clave: 'celdas', valor: buscarNodo(d.datos.raiz, n.id).props.celdas });
    sucio = true;
  }

  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    const c = cam();
    actualizarCoords(e);
    const antes = [raton.wx, raton.wy];
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    c.zoom = Math.max(0.05, Math.min(16, c.zoom * f));
    const despues = aMundo(raton.px, raton.py);
    c.x += antes[0] - despues[0]; c.y += antes[1] - despues[1];
    anotarEvento('zoom');
    pintarZoom();
    sucio = true;
  }, { passive: false });
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

  function menuContextual(d) {
    const n = elegir(d, raton.wx, raton.wy);
    if (n && !d.seleccion.includes(n.id)) seleccionar([n.id], d);
    const r = lienzo.getBoundingClientRect();
    const x = r.left + raton.px, y = r.top + raton.py;
    menu(x, y, [
      { texto: 'Añadir nodo aquí…', icono: 'mas', accion: () => {
        const m = menuTipos(x, y, d);
        // Coloca el nodo nuevo en la posición del ratón.
        const pos = [encajar(raton.wx), encajar(raton.wy)];
        const quitar = bus.on('seleccion', (doc2) => { quitar(); const s = doc2.nodoSel; if (s && Array.isArray(s.props.posicion) && s.props.posicion.length === 2 && !esUI(doc2, s)) cambiarProp(doc2, s.id, 'posicion', pos, { fusionar: null }); });
        setTimeout(() => { if (!document.body.contains(m)) quitar(); }, 30000);
      } },
      ...(n ? [{ texto: 'Duplicar', icono: 'copiar', atajo: 'Ctrl D', accion: () => duplicarNodos(d) }, { texto: 'Eliminar', icono: 'papelera', atajo: 'Supr', peligro: true, accion: () => eliminarNodos(d) }] : []),
      '-',
      { texto: 'Centrar en la selección', atajo: 'F', accion: () => centrar(d) },
      { texto: 'Ver toda la escena', accion: () => verTodo(d) },
    ]);
  }

  function esUI(d, n) { for (let p = buscarPadre(d.datos.raiz, n.id); p; p = buscarPadre(d.datos.raiz, p.id)) if (p.tipo === 'Interfaz') return true; return n.tipo === 'Interfaz'; }

  // Soltar archivos desde el panel Archivos o Recursos.
  lienzo.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  lienzo.addEventListener('drop', async (e) => {
    const rel = e.dataTransfer.getData('text/falcon-archivo');
    const d = doc();
    if (!rel || !d) return;
    e.preventDefault();
    actualizarCoords(e);
    const pos = [encajar(raton.wx), encajar(raton.wy)];
    const t = tipoRecurso(rel);
    const nombre = sinExtension(rel).replace(/^./, c => c.toUpperCase());
    if (t === 'imagen') {
      const aj = est.proyecto.ajustesImportacion(rel);
      const img = new Image();
      img.src = est.proyecto.url(rel);
      await img.decode().catch(() => {});
      if (aj.uso === 'mosaico') { anadirNodo(d, 'Mosaicos', { nombre, props: { imagen: rel }, posicion: [0, 0], padre: d.datos.raiz.id }); return; }
      if (aj.uso === 'fondo') { anadirNodo(d, 'Fondo', { nombre: 'Fondo', props: { imagen: rel }, padre: d.datos.raiz.id }); return; }
      anadirNodo(d, 'Sprite', { nombre, props: { imagen: rel, ancho: Math.round((img.width || 32) / (aj.columnas || 1)), alto: Math.round((img.height || 32) / (aj.filas || 1)), animando: (aj.columnas || 1) * (aj.filas || 1) > 1 }, posicion: pos, padre: d.datos.raiz.id });
    } else if (t === 'escena') {
      const e2 = normalizarEscena(await est.proyecto.leer(rel));
      if (e2.tipo !== '2D') { avisar('Solo se pueden meter escenas 2D aquí.', 'aviso'); return; }
      const c = clonarNodo(e2.raiz);
      c.props.posicion = pos;
      anadirNodo(d, c.tipo, { nodo: c, nombre: c.nombre, padre: d.datos.raiz.id });
    } else if (t === 'sonido') anadirNodo(d, 'Sonido', { nombre, props: { sonido: rel }, padre: d.datos.raiz.id });
    else if (t === 'script' || t === 'blueprint') {
      const n = elegir(d, raton.wx, raton.wy);
      if (!n) { avisar('Suelta el script encima de un nodo para asignárselo.', 'aviso'); return; }
      cambiarNodo(d, n.id, (x) => { if (t === 'script') x.script = rel; else x.blueprint = rel; });
      avisar(`${rel} asignado a ${n.nombre}`);
    } else avisar('Ese tipo de archivo no se puede soltar en una escena 2D.', 'aviso');
  });

  // ---------- Teclado ----------
  const teclaAbajo = (e) => {
    if (!vivo) return;
    if (e.code === 'Space' && document.activeElement === lienzo) { espacio = true; e.preventDefault(); }
    const d = doc();
    if (!d || document.activeElement !== lienzo) return;
    const mapa = { KeyQ: 'seleccionar', KeyW: 'mover', KeyE: 'rotar', KeyR: 'escalar', KeyB: 'lapiz' };
    if (mapa[e.code] && !e.ctrlKey) { fijarHerramienta(mapa[e.code]); return; }
    if (e.code === 'KeyF') { centrar(d); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { eliminarNodos(d); e.preventDefault(); return; }
    if (e.key.startsWith('Arrow') && d.seleccion.length) {
      e.preventDefault();
      const paso = e.shiftKey ? 10 : (ajustar ? rejilla() : 1);
      const dx = e.key === 'ArrowLeft' ? -paso : e.key === 'ArrowRight' ? paso : 0, dy = e.key === 'ArrowUp' ? -paso : e.key === 'ArrowDown' ? paso : 0;
      d.cambiar((esc) => { for (const id of d.seleccion) { const n = buscarNodo(esc.raiz, id); if (n && n.props.posicion && n !== esc.raiz) n.props.posicion = [n.props.posicion[0] + dx, n.props.posicion[1] + dy]; } }, { fusionar: 'flechas', prop: 'posicion' });
      sucio = true;
    }
  };
  const teclaArriba = (e) => { if (e.code === 'Space') espacio = false; };
  window.addEventListener('keydown', teclaAbajo);
  window.addEventListener('keyup', teclaArriba);

  function centrar(d) {
    const n = d.nodoSel;
    if (!n) return verTodo(d);
    const caja = cajaCompleta(d, n.id, geometria(d));
    if (!caja) return;
    const c = cam();
    c.x = (caja[0] + caja[2]) / 2; c.y = (caja[1] + caja[3]) / 2;
    sucio = true;
  }

  function verTodo(d) {
    const geo = geometria(d);
    const caja = cajaCompleta(d, d.datos.raiz.id, geo) || [0, 0, 1280, 720];
    const v = vista(), c = cam();
    c.x = (caja[0] + caja[2]) / 2; c.y = (caja[1] + caja[3]) / 2;
    c.zoom = Math.max(0.05, Math.min(4, Math.min(v.ancho / (caja[2] - caja[0] + 80), v.alto / (caja[3] - caja[1] + 80))));
    pintarZoom();
    sucio = true;
  }

  // ---------- Barra ----------
  function fijarHerramienta(h) {
    herramienta = h; est._herramienta2d = h;
    $$('[data-h]', raiz).forEach(b => b.classList.toggle('activo', b.dataset.h === h));
    sucio = true;
  }
  function pintarZoom() { const z = raiz.querySelector('.zoom'); if (z) z.textContent = Math.round(cam().zoom * 100) + ' %'; }
  if (!op.sinBarra) {
    $$('[data-h]', raiz).forEach(b => b.onclick = () => fijarHerramienta(b.dataset.h));
    const bAj = $('[data-a=ajustar]', raiz);
    const pintarAj = () => bAj.classList.toggle('activo', ajustar);
    bAj.onclick = () => { ajustar = !ajustar; est._ajustar2d = ajustar; pintarAj(); };
    pintarAj();
    $('[data-a=ver]', raiz).onclick = (e) => menuBajo(e.currentTarget, [
      { texto: 'Cuadrícula', marcado: ver.cuadricula, accion: () => { ver.cuadricula = !ver.cuadricula; sucio = true; } },
      { texto: 'Formas de colisión', marcado: ver.colisiones, accion: () => { ver.colisiones = !ver.colisiones; sucio = true; } },
      { texto: 'Área de la cámara', marcado: ver.camara, accion: () => { ver.camara = !ver.camara; sucio = true; } },
      { texto: 'Nombre del seleccionado', marcado: ver.nombres, accion: () => { ver.nombres = !ver.nombres; sucio = true; } },
      '-',
      { texto: 'Centrar en la selección', atajo: 'F', accion: () => centrar(doc()) },
      { texto: 'Ver toda la escena', accion: () => verTodo(doc()) },
    ]);
    $('[data-a=zoom]', raiz).onclick = (e) => menuBajo(e.currentTarget, [25, 50, 100, 200, 400].map(z => ({ texto: z + ' %', accion: () => { cam().zoom = z / 100; pintarZoom(); sucio = true; } })).concat(['-', { texto: 'Ver toda la escena', accion: () => verTodo(doc()) }]));
    fijarHerramienta(herramienta);
    pintarZoom();
  }

  function pintarPildoras() {
    const d = doc();
    const s = raiz.querySelector('.sel-info');
    const n = d ? d.seleccion.length : 0;
    s.classList.toggle('oculto', !n);
    s.textContent = n === 1 ? '1 seleccionado' : `${n} seleccionados`;
  }

  // ---------- Bucle ----------
  let animando = false;
  const bucle = () => {
    if (!vivo) return;
    const d = doc();
    // Sprites animados y banderas se mueven también en el editor.
    animando = d && hayAnimacion(d.datos.raiz);
    if (sucio || animando) { sucio = false; try { dibujar(); } catch (e) { console.error(e); } }
    requestAnimationFrame(bucle);
  };
  function hayAnimacion(r) { let s = false; recorrerConMatriz(r, (n) => { if (n.tipo === 'Sprite' && n.props.forma === 'bandera' && !n.props.imagen) s = true; }); return s; }
  requestAnimationFrame(bucle);
  const ro = new ResizeObserver(() => { sucio = true; });
  ro.observe(lienzo);

  const quitar = [
    bus.on('doc:cambio', () => { sucio = true; }),
    bus.on('seleccion', () => { sucio = true; pintarPildoras(); }),
    bus.on('doc:activo', () => { sucio = true; pintarZoom(); pintarPildoras(); }),
    bus.on('recurso:reimportado', (rel) => { imagenes.recargar(rel); sucio = true; }),
    bus.on('escena:guardada', (d) => { if (d === doc()) guardarMiniatura(d); }),
  ];
  pintarPildoras();

  async function guardarMiniatura(d) {
    try {
      const p = est.proyecto;
      if (p.datos.escena_principal && p.datos.escena_principal !== d.rel) return;
      const c = document.createElement('canvas');
      c.width = 520; c.height = 256;
      const x = c.getContext('2d');
      const ce = camaraEscena(d);
      const prev = { ...cam() };
      // Encuadra la cámara del juego para la miniatura.
      Object.assign(cam(), ce ? { x: ce.cx, y: ce.cy, zoom: Math.min(lienzo.width / dpr() / ce.w, lienzo.height / dpr() / ce.h) } : prev);
      // Sin ayudas del editor: solo lo que vería el jugador.
      const verPrev = { ...ver }, selPrev = d.seleccion;
      Object.assign(ver, { colisiones: false, camara: false, cuadricula: false });
      d.seleccion = [];
      dibujar();
      Object.assign(ver, verPrev);
      d.seleccion = selPrev;
      const v = vista();
      const w = ce ? ce.w * cam().zoom : v.ancho, h = ce ? ce.h * cam().zoom : v.alto;
      const sx = (v.ancho - w) / 2 * dpr(), sy = (v.alto - h) / 2 * dpr();
      const escala = Math.max(520 / (w * dpr()), 256 / (h * dpr()));
      x.drawImage(lienzo, sx + (w * dpr() - 520 / escala) / 2, sy + (h * dpr() - 256 / escala) / 2, 520 / escala, 256 / escala, 0, 0, 520, 256);
      Object.assign(cam(), prev);
      sucio = true;
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await p.escribir('.falcon/miniatura.png', new Uint8Array(await blob.arrayBuffer()));
    } catch (e) { console.warn('miniatura', e); }
  }

  return {
    el: raiz, lienzo,
    redibujar: () => { sucio = true; },
    centrar: () => centrar(doc()),
    aPantalla, aMundo, camaraEscena: () => doc() && camaraEscena(doc()),
    destruir() {
      vivo = false;
      ro.disconnect();
      quitar.forEach(f => f());
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
      window.removeEventListener('keydown', teclaAbajo);
      window.removeEventListener('keyup', teclaArriba);
    },
  };
}

// Contexto que antepone una matriz base a cada setTransform (para dibujar la interfaz dentro del área de cámara).
export function conBase(c, base) {
  return new Proxy(c, {
    get(t, k) {
      if (k === 'setTransform') return (a, b, cc, d, e, f) => {
        const m = (a instanceof DOMMatrix || (typeof a === 'object' && a)) ? DOMMatrix.fromMatrix(a) : new DOMMatrix([a, b, cc, d, e, f]);
        // La interfaz trabaja en píxeles lógicos con escala 1: la base ya incluye la escala real.
        return t.setTransform(base.multiply(m));
      };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
