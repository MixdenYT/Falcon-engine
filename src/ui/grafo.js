// Editor de grafos de nodos (Blueprints y materiales).
import { el, esc, $, $$ } from './componentes.js';
import { icono } from './iconos.js';

/**
 * op:
 *  grafo(): { nodos, conexiones, comentarios }
 *  definicion(nodo): { titulo, sub, cabecera, icono, compacto, entradas: [{n, t, etq, campo, opciones, conectable}], salidas: [{n, t, etq}] , clase }
 *  colorTipo(t), compatibles(tSalida, tEntrada)
 *  cambiar(fn, op): aplica un cambio que se puede deshacer
 *  vista: objeto donde guardar { x, y, zoom }
 *  alSeleccionar(ids), alPaleta(x, y, { desde }) → Promise<nodo|null>, alDobleClic(nodo), alSoltarExterno(e, puntoMundo)
 *  errores(): Set de ids con error
 *  valorPersonalizado(nodo, pin, contenedor): para pintar campos especiales (texturas, colores)
 */
export function crearGrafo(contenedor, op) {
  const raiz = el(`<div class="grafo" tabindex="0"><div class="mundo-grafo"><svg class="cables" width="1" height="1"></svg><div class="capa-com"></div><div class="capa-nodos"></div></div>
    <div class="zoom-grafo"><button data-z="-">−</button><span class="pct">100 %</span><button data-z="+">+</button></div></div>`);
  contenedor.append(raiz);
  const mundo = $('.mundo-grafo', raiz), svg = $('svg', raiz), capaNodos = $('.capa-nodos', raiz), capaCom = $('.capa-com', raiz);
  const vista = op.vista;
  if (vista.x === undefined) Object.assign(vista, { x: 40, y: 30, zoom: 1 });
  let seleccion = new Set(op.seleccionInicial || []);
  let accion = null;
  let posPines = new Map();
  let editandoComentario = null;

  const g = () => op.grafo();
  const aMundo = (cx, cy) => { const r = raiz.getBoundingClientRect(); return [(cx - r.left - vista.x) / vista.zoom, (cy - r.top - vista.y) / vista.zoom]; };

  function aplicarVista() {
    mundo.style.transform = `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})`;
    raiz.style.backgroundSize = `${22 * vista.zoom}px ${22 * vista.zoom}px`;
    raiz.style.backgroundPosition = `${vista.x}px ${vista.y}px`;
    $('.pct', raiz).textContent = Math.round(vista.zoom * 100) + ' %';
  }

  // ---------- Pintado ----------
  function pintar() {
    const grafo = g();
    if (!grafo) return;
    aplicarVista();
    const errores = op.errores ? op.errores() : new Set();
    capaNodos.innerHTML = '';
    capaCom.innerHTML = '';
    const conectadas = new Set();
    for (const c of grafo.conexiones) { conectadas.add(c.a + ':' + c.entrada); conectadas.add(c.de + ':' + c.salida); }
    for (const c of grafo.comentarios || []) {
      const ce = el(`<div class="comentario-g ${seleccion.has(c.id) ? 'sel' : ''}" data-com="${esc(c.id)}" style="left:${c.x}px;top:${c.y}px;width:${c.ancho}px;height:${c.alto}px">${editandoComentario === c.id ? `<textarea>${esc(c.texto)}</textarea>` : esc(c.texto)}</div>`);
      capaCom.append(ce);
    }
    for (const n of grafo.nodos) {
      const d = op.definicion(n);
      if (!d) continue;
      const clases = ['nodo-g', d.compacto ? 'compacto' : '', seleccion.has(n.id) ? 'sel' : '', errores.has(n.id) ? 'error' : '', d.clase || ''].join(' ');
      const ne = el(`<div class="${clases}" data-id="${esc(n.id)}" style="left:${n.x}px;top:${n.y}px"></div>`);
      const pin = (p, lado) => {
        const tipo = p.t;
        const color = op.colorTipo(tipo);
        const lleno = conectadas.has(n.id + ':' + p.n);
        const conectable = p.conectable !== false;
        const punto = conectable ? `<span class="punto-pin ${tipo === 'exec' ? 'exec' : ''} ${lleno ? 'lleno' : ''}" data-pin="${esc(p.n)}" data-lado="${lado}" data-tipo="${esc(tipo)}" style="color:${color}"></span>` : '';
        let campo = '';
        if (lado === 'e' && !lleno && p.campo) {
          const v = n.valores && p.n in n.valores ? n.valores[p.n] : p.def;
          if (p.campo === 'bool') campo = `<input type="checkbox" class="valor-pin" data-valor="${esc(p.n)}" ${v ? 'checked' : ''}>`;
          else if (p.campo === 'opcion') campo = `<select class="valor-pin" data-valor="${esc(p.n)}">${(p.opciones || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
          else if (p.campo === 'personalizado') campo = `<span class="valor-personal" data-valor="${esc(p.n)}"></span>`;
          else campo = `<input class="valor-pin" data-valor="${esc(p.n)}" value="${esc(v ?? '')}" spellcheck="false" style="${p.campo === 'numero' ? 'width:64px' : ''}">`;
        }
        const etq = p.etq ? `<span class="etq-pin">${esc(p.etq)}</span>` : '';
        return lado === 'e' ? `<div class="pin">${punto}${etq}${campo}</div>` : `<div class="pin">${etq}${punto}</div>`;
      };
      if (d.compacto) {
        ne.innerHTML = `<div class="cuerpo-g"><div class="col-g izq">${d.entradas.map(p => pin(p, 'e')).join('')}</div><span class="titulo-compacto">${esc(d.titulo)}</span>${d.sub ? `<span class="tipo-compacto">${esc(d.sub)}</span>` : ''}<div class="col-g der">${d.salidas.map(p => pin(p, 's')).join('')}</div></div>`;
      } else {
        ne.innerHTML = `<div class="cab-g" style="background:${d.cabecera}">${d.icono ? icono(d.icono, '', 14) : ''}<span>${esc(d.titulo)}</span>${d.sub ? `<span class="sub-g">${esc(d.sub)}</span>` : ''}</div>
          <div class="cuerpo-g"><div class="col-g izq">${d.entradas.map(p => pin(p, 'e')).join('')}</div><div class="col-g der">${d.salidas.map(p => pin(p, 's')).join('')}</div></div>`;
        if (d.extra) ne.querySelector('.cuerpo-g').insertAdjacentHTML('afterend', d.extra);
      }
      capaNodos.append(ne);
      if (op.valorPersonalizado) $$('.valor-personal', ne).forEach(c => op.valorPersonalizado(n, c.dataset.valor, c));
    }
    medirPines();
    pintarCables();
  }

  function medirPines() {
    posPines = new Map();
    const rm = mundo.getBoundingClientRect();
    for (const p of $$('.punto-pin', capaNodos)) {
      const id = p.closest('.nodo-g').dataset.id;
      const r = p.getBoundingClientRect();
      const x = ((p.dataset.lado === 's' ? r.right : r.left) - rm.left) / vista.zoom;
      const y = ((r.top + r.bottom) / 2 - rm.top) / vista.zoom;
      posPines.set(`${id}:${p.dataset.lado}:${p.dataset.pin}`, { x, y, tipo: p.dataset.tipo });
    }
  }

  function curva(a, b) {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }

  function pintarCables() {
    let html = '';
    for (const c of g().conexiones) {
      const a = posPines.get(`${c.de}:s:${c.salida}`), b = posPines.get(`${c.a}:e:${c.entrada}`);
      if (!a || !b) continue;
      const t = a.tipo === 'cualquiera' ? b.tipo : a.tipo;
      html += `<path class="${t === 'exec' ? 'exec' : ''}" d="${curva(a, b)}" stroke="${op.colorTipo(t)}"/>`;
    }
    if (accion && accion.tipo === 'cable') {
      const a = accion.origen, b = { x: accion.mx, y: accion.my };
      html += `<path class="provisional ${a.tipo === 'exec' ? 'exec' : ''}" d="${accion.lado === 's' ? curva(a, b) : curva(b, a)}" stroke="${op.colorTipo(a.tipo)}"/>`;
    }
    svg.innerHTML = html;
  }

  // ---------- Interacción ----------
  raiz.addEventListener('mousedown', (e) => {
    raiz.focus({ preventScroll: true });
    if (e.target.closest('.zoom-grafo')) return;
    if (e.target.matches('input, select, textarea')) return;
    const [mx, my] = aMundo(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2) { accion = { tipo: 'pan', x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, movido: false, boton: e.button }; e.preventDefault(); return; }
    const punto = e.target.closest('.punto-pin');
    if (punto) {
      const id = punto.closest('.nodo-g').dataset.id;
      const k = `${id}:${punto.dataset.lado}:${punto.dataset.pin}`;
      if (e.altKey) { quitarConexiones(id, punto.dataset.lado, punto.dataset.pin); return; }
      accion = { tipo: 'cable', nodo: id, pin: punto.dataset.pin, lado: punto.dataset.lado, origen: posPines.get(k), mx, my };
      return;
    }
    const ne = e.target.closest('.nodo-g');
    if (ne) {
      const id = ne.dataset.id;
      if (e.ctrlKey || e.shiftKey) { seleccion.has(id) ? seleccion.delete(id) : seleccion.add(id); }
      else if (!seleccion.has(id)) seleccion = new Set([id]);
      avisarSeleccion();
      const inicio = new Map();
      for (const n of g().nodos) if (seleccion.has(n.id)) inicio.set(n.id, [n.x, n.y]);
      for (const c of g().comentarios || []) if (seleccion.has(c.id)) inicio.set(c.id, [c.x, c.y]);
      accion = { tipo: 'mover', x0: mx, y0: my, inicio, clave: 'mover-' + Date.now(), movido: false };
      pintarSeleccion();
      return;
    }
    const ce = e.target.closest('.comentario-g');
    if (ce) {
      const id = ce.dataset.com;
      if (editandoComentario === id) return;
      const c = (g().comentarios || []).find(x => x.id === id);
      const r = ce.getBoundingClientRect();
      if (e.clientX > r.right - 14 && e.clientY > r.bottom - 14) { accion = { tipo: 'redimensionar', c, x0: mx, y0: my, w: c.ancho, h: c.alto, clave: 'red-' + Date.now() }; return; }
      seleccion = new Set([id]);
      // Mover el comentario arrastra también los nodos que tiene dentro.
      const inicio = new Map([[id, [c.x, c.y]]]);
      for (const n of g().nodos) if (n.x >= c.x && n.y >= c.y && n.x < c.x + c.ancho && n.y < c.y + c.alto) inicio.set(n.id, [n.x, n.y]);
      accion = { tipo: 'mover', x0: mx, y0: my, inicio, clave: 'mover-' + Date.now(), movido: false };
      avisarSeleccion();
      pintar();
      return;
    }
    accion = { tipo: 'caja', x0: mx, y0: my, cx: e.clientX, cy: e.clientY };
  });

  const alMover = (e) => {
    if (!accion) return;
    const [mx, my] = aMundo(e.clientX, e.clientY);
    if (accion.tipo === 'pan') {
      if (Math.abs(e.clientX - accion.x) + Math.abs(e.clientY - accion.y) > 3) accion.movido = true;
      vista.x = accion.vx + e.clientX - accion.x; vista.y = accion.vy + e.clientY - accion.y;
      aplicarVista();
      return;
    }
    if (accion.tipo === 'cable') { accion.mx = mx; accion.my = my; pintarCables(); return; }
    if (accion.tipo === 'mover') {
      const dx = mx - accion.x0, dy = my - accion.y0;
      if (!accion.movido && Math.hypot(dx, dy) < 3) return;
      accion.movido = true;
      op.cambiar((gr) => {
        for (const [id, [x, y]] of accion.inicio) {
          const n = gr.nodos.find(z => z.id === id) || (gr.comentarios || []).find(z => z.id === id);
          if (n) { n.x = Math.round((x + dx) / 2) * 2; n.y = Math.round((y + dy) / 2) * 2; }
        }
      }, { fusionar: accion.clave, soloPosicion: true });
      for (const [id] of accion.inicio) {
        const ne = capaNodos.querySelector(`[data-id="${CSS.escape(id)}"]`) || capaCom.querySelector(`[data-com="${CSS.escape(id)}"]`);
        const n = g().nodos.find(z => z.id === id) || (g().comentarios || []).find(z => z.id === id);
        if (ne && n) { ne.style.left = n.x + 'px'; ne.style.top = n.y + 'px'; }
      }
      medirPines(); pintarCables();
      return;
    }
    if (accion.tipo === 'redimensionar') {
      op.cambiar(() => { accion.c.ancho = Math.max(120, accion.w + mx - accion.x0); accion.c.alto = Math.max(50, accion.h + my - accion.y0); }, { fusionar: accion.clave, soloPosicion: true });
      const ce = capaCom.querySelector(`[data-com="${CSS.escape(accion.c.id)}"]`);
      if (ce) { ce.style.width = accion.c.ancho + 'px'; ce.style.height = accion.c.alto + 'px'; }
      return;
    }
    if (accion.tipo === 'caja') {
      let caja = raiz.querySelector('.caja-seleccion');
      if (!caja) { caja = el('<div class="caja-seleccion"></div>'); raiz.append(caja); }
      const r = raiz.getBoundingClientRect();
      const x0 = Math.min(accion.cx, e.clientX) - r.left, y0 = Math.min(accion.cy, e.clientY) - r.top;
      Object.assign(caja.style, { left: x0 + 'px', top: y0 + 'px', width: Math.abs(e.clientX - accion.cx) + 'px', height: Math.abs(e.clientY - accion.cy) + 'px' });
      accion.mx = mx; accion.my = my;
    }
  };

  const alSoltar = async (e) => {
    if (!accion) return;
    const a = accion;
    accion = null;
    raiz.querySelector('.caja-seleccion')?.remove();
    if (a.tipo === 'pan' && !a.movido && a.boton === 2) { abrirPaleta(e.clientX, e.clientY); return; }
    if (a.tipo === 'caja') {
      if (a.mx === undefined) { if (seleccion.size) { seleccion = new Set(); avisarSeleccion(); pintarSeleccion(); } return; }
      const x0 = Math.min(a.x0, a.mx), x1 = Math.max(a.x0, a.mx), y0 = Math.min(a.y0, a.my), y1 = Math.max(a.y0, a.my);
      seleccion = new Set();
      for (const ne of $$('.nodo-g', capaNodos)) {
        const n = g().nodos.find(z => z.id === ne.dataset.id);
        if (n && n.x >= x0 && n.y >= y0 && n.x + ne.offsetWidth <= x1 && n.y + ne.offsetHeight <= y1) seleccion.add(n.id);
      }
      avisarSeleccion(); pintarSeleccion();
      return;
    }
    if (a.tipo === 'cable') {
      const destino = document.elementFromPoint(e.clientX, e.clientY)?.closest('.punto-pin');
      if (destino) {
        const id2 = destino.closest('.nodo-g').dataset.id;
        conectar(a.nodo, a.lado, a.pin, id2, destino.dataset.lado, destino.dataset.pin);
      } else if (op.alPaleta) {
        // Soltar en vacío: buscar un bloque que encaje.
        const [mx, my] = aMundo(e.clientX, e.clientY);
        const nuevo = await op.alPaleta(e.clientX, e.clientY, { desde: { tipo: a.origen.tipo, lado: a.lado }, x: mx, y: my });
        if (nuevo) {
          pintar();
          const d = op.definicion(nuevo);
          const lista = a.lado === 's' ? d.entradas : d.salidas;
          const pinNuevo = lista.find(p => p.conectable !== false && (a.lado === 's' ? op.compatibles(a.origen.tipo, p.t) : op.compatibles(p.t, a.origen.tipo)));
          if (pinNuevo) conectar(a.nodo, a.lado, a.pin, nuevo.id, a.lado === 's' ? 'e' : 's', pinNuevo.n);
        }
      }
      pintarCables();
    }
  };
  window.addEventListener('mousemove', alMover);
  window.addEventListener('mouseup', alSoltar);
  raiz.addEventListener('contextmenu', (e) => e.preventDefault());

  raiz.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = raiz.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const z0 = vista.zoom;
    const z1 = Math.max(0.25, Math.min(2, z0 * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    vista.x = px - (px - vista.x) * z1 / z0; vista.y = py - (py - vista.y) * z1 / z0;
    vista.zoom = z1;
    aplicarVista();
  }, { passive: false });
  $$('[data-z]', raiz).forEach(b => b.onclick = () => {
    const r = raiz.getBoundingClientRect();
    const z0 = vista.zoom, z1 = Math.max(0.25, Math.min(2, z0 * (b.dataset.z === '+' ? 1.2 : 1 / 1.2)));
    vista.x = r.width / 2 - (r.width / 2 - vista.x) * z1 / z0; vista.y = r.height / 2 - (r.height / 2 - vista.y) * z1 / z0;
    vista.zoom = z1; aplicarVista();
  });
  $('.pct', raiz).onclick = () => { vista.zoom = 1; aplicarVista(); };

  // Valores escritos en los pines.
  raiz.addEventListener('change', (e) => {
    const i = e.target.closest('[data-valor]');
    if (!i || !i.matches('input, select')) return;
    const id = i.closest('.nodo-g').dataset.id;
    const pinN = i.dataset.valor;
    let v = i.type === 'checkbox' ? i.checked : i.value;
    const n = g().nodos.find(z => z.id === id);
    const p = op.definicion(n).entradas.find(x => x.n === pinN);
    if (p && p.campo === 'numero') v = Number(String(v).replace(',', '.')) || 0;
    op.cambiar(() => { n.valores ||= {}; n.valores[pinN] = v; }, { valor: true });
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); e.stopPropagation(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { borrarSeleccion(); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); duplicarSeleccion(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') { e.preventDefault(); seleccion = new Set(g().nodos.map(n => n.id)); avisarSeleccion(); pintarSeleccion(); }
    else if (e.code === 'Space') { e.preventDefault(); const r = raiz.getBoundingClientRect(); abrirPaleta(r.left + r.width / 2 - 150, r.top + 80); }
    else if (e.code === 'KeyC' && !e.ctrlKey && op.comentarios !== false) { e.preventDefault(); anadirComentario(); }
    else if (e.code === 'KeyF') { encuadrar(); }
  });
  raiz.addEventListener('dblclick', (e) => {
    const ce = e.target.closest('.comentario-g');
    if (ce) {
      editandoComentario = ce.dataset.com;
      pintar();
      const ta = capaCom.querySelector('textarea');
      ta.focus(); ta.select();
      ta.onblur = () => { const c = (g().comentarios || []).find(x => x.id === editandoComentario); editandoComentario = null; if (c && ta.value !== c.texto) op.cambiar(() => { c.texto = ta.value; }); else pintar(); };
      ta.onkeydown = (ev) => { if (ev.key === 'Escape') ta.blur(); ev.stopPropagation(); };
      return;
    }
    const ne = e.target.closest('.nodo-g');
    if (ne && op.alDobleClic) op.alDobleClic(g().nodos.find(n => n.id === ne.dataset.id));
    else if (!ne && !e.target.closest('.zoom-grafo')) abrirPaleta(e.clientX, e.clientY);
  });

  // Soltar cosas desde fuera (variables, bloques de la lista).
  raiz.addEventListener('dragover', (e) => { if (op.alSoltarExterno) e.preventDefault(); });
  raiz.addEventListener('drop', (e) => { if (!op.alSoltarExterno) return; e.preventDefault(); op.alSoltarExterno(e, aMundo(e.clientX, e.clientY)); });

  async function abrirPaleta(cx, cy) {
    if (!op.alPaleta) return;
    const [mx, my] = aMundo(cx, cy);
    const nuevo = await op.alPaleta(cx, cy, { x: mx, y: my });
    if (nuevo) { seleccion = new Set([nuevo.id]); avisarSeleccion(); pintar(); }
  }

  function conectar(idA, ladoA, pinA, idB, ladoB, pinB) {
    if (idA === idB || ladoA === ladoB) return;
    let [de, salida, a, entrada] = ladoA === 's' ? [idA, pinA, idB, pinB] : [idB, pinB, idA, pinA];
    const nDe = g().nodos.find(n => n.id === de), nA = g().nodos.find(n => n.id === a);
    const pS = op.definicion(nDe).salidas.find(p => p.n === salida), pE = op.definicion(nA).entradas.find(p => p.n === entrada);
    if (!pS || !pE || !op.compatibles(pS.t, pE.t)) { avisoTipo(pS, pE); return; }
    op.cambiar((gr) => {
      // Una entrada de datos solo recibe un cable; una salida de ejecución solo da uno.
      gr.conexiones = gr.conexiones.filter(c => {
        if (pE.t !== 'exec' && c.a === a && c.entrada === entrada) return false;
        if (pS.t === 'exec' && c.de === de && c.salida === salida) return false;
        return true;
      });
      gr.conexiones.push({ de, salida, a, entrada });
    }, { conexion: true });
  }

  function avisoTipo(pS, pE) {
    if (!op.alAviso || !pS || !pE) return;
    op.alAviso(`No se puede unir «${pS.etq || pS.n}» con «${pE.etq || pE.n}»: los tipos no encajan.`);
  }

  function quitarConexiones(id, lado, pin) {
    op.cambiar((gr) => { gr.conexiones = gr.conexiones.filter(c => !(lado === 's' ? c.de === id && c.salida === pin : c.a === id && c.entrada === pin)); });
  }

  function borrarSeleccion() {
    if (!seleccion.size) return;
    const ids = new Set(seleccion);
    const protegidos = op.protegidos ? op.protegidos() : new Set();
    op.cambiar((gr) => {
      gr.nodos = gr.nodos.filter(n => !ids.has(n.id) || protegidos.has(n.id));
      gr.conexiones = gr.conexiones.filter(c => (!ids.has(c.de) || protegidos.has(c.de)) && (!ids.has(c.a) || protegidos.has(c.a)));
      if (gr.comentarios) gr.comentarios = gr.comentarios.filter(c => !ids.has(c.id));
    });
    seleccion = new Set();
    avisarSeleccion();
  }

  function duplicarSeleccion() {
    const nuevos = new Map();
    op.cambiar((gr) => {
      for (const n of gr.nodos.filter(x => seleccion.has(x.id))) {
        if (op.protegidos && op.protegidos().has(n.id)) continue;
        const c = structuredClone(n);
        c.id = n.id.replace(/_d\d+$/, '') + '_d' + Math.random().toString(36).slice(2, 7);
        c.x += 30; c.y += 30;
        nuevos.set(n.id, c.id);
        gr.nodos.push(c);
      }
      for (const c of gr.conexiones.slice()) if (nuevos.has(c.de) && nuevos.has(c.a)) gr.conexiones.push({ ...c, de: nuevos.get(c.de), a: nuevos.get(c.a) });
    });
    seleccion = new Set(nuevos.values());
    avisarSeleccion();
    pintar();
  }

  function anadirComentario() {
    const sel = g().nodos.filter(n => seleccion.has(n.id));
    let x, y, w = 300, h = 80;
    if (sel.length) {
      const els = sel.map(n => capaNodos.querySelector(`[data-id="${CSS.escape(n.id)}"]`));
      x = Math.min(...sel.map(n => n.x)) - 20; y = Math.min(...sel.map(n => n.y)) - 50;
      w = Math.max(...sel.map((n, i) => n.x + (els[i]?.offsetWidth || 160))) - x + 20;
      h = Math.max(...sel.map((n, i) => n.y + (els[i]?.offsetHeight || 80))) - y + 20;
    } else { const r = raiz.getBoundingClientRect(); [x, y] = aMundo(r.left + r.width / 2 - 150, r.top + r.height / 2 - 40); }
    op.cambiar((gr) => { (gr.comentarios ||= []).push({ id: 'c' + Date.now().toString(36), x, y, ancho: w, alto: h, texto: 'Comentario' }); });
  }

  function encuadrar() {
    const nodos = g().nodos;
    if (!nodos.length) return;
    const r = raiz.getBoundingClientRect();
    const x0 = Math.min(...nodos.map(n => n.x)), y0 = Math.min(...nodos.map(n => n.y));
    const x1 = Math.max(...nodos.map(n => n.x + 220)), y1 = Math.max(...nodos.map(n => n.y + 120));
    vista.zoom = Math.max(0.3, Math.min(1, Math.min(r.width / (x1 - x0 + 80), r.height / (y1 - y0 + 80))));
    vista.x = (r.width - (x1 - x0) * vista.zoom) / 2 - x0 * vista.zoom;
    vista.y = (r.height - (y1 - y0) * vista.zoom) / 2 - y0 * vista.zoom;
    aplicarVista();
    requestAnimationFrame(() => { medirPines(); pintarCables(); });
  }

  function centrarEn(id) {
    const n = g().nodos.find(x => x.id === id);
    if (!n) return;
    const r = raiz.getBoundingClientRect();
    vista.x = r.width / 2 - (n.x + 90) * vista.zoom; vista.y = r.height / 3 - n.y * vista.zoom;
    aplicarVista();
    seleccion = new Set([id]); avisarSeleccion(); pintarSeleccion();
  }

  function pintarSeleccion() {
    $$('.nodo-g', capaNodos).forEach(ne => ne.classList.toggle('sel', seleccion.has(ne.dataset.id)));
    $$('.comentario-g', capaCom).forEach(ce => ce.classList.toggle('sel', seleccion.has(ce.dataset.com)));
  }
  function avisarSeleccion() { op.alSeleccionar && op.alSeleccionar([...seleccion]); }

  aplicarVista();
  pintar();
  if (vista.encuadrar) { delete vista.encuadrar; requestAnimationFrame(encuadrar); }
  const ro = new ResizeObserver(() => { medirPines(); pintarCables(); });
  ro.observe(raiz);
  document.fonts?.ready.then(() => { medirPines(); pintarCables(); });

  return {
    el: raiz, pintar, centrarEn, encuadrar,
    seleccion: () => [...seleccion],
    seleccionar: (ids) => { seleccion = new Set(ids); pintarSeleccion(); },
    destruir: () => { ro.disconnect(); window.removeEventListener('mousemove', alMover); window.removeEventListener('mouseup', alSoltar); },
  };
}
