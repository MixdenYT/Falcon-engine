// Editor de código Águila: textarea transparente sobre un <pre> resaltado.
import { el, esc, $, $$ } from './componentes.js';
import { icono } from './iconos.js';

const CLAVES = new Set(['clase', 'extiende', 'exportar', 'variable', 'constante', 'cuando', 'si', 'sino', 'mientras', 'para', 'cada', 'en', 'función', 'funcion', 'devolver', 'romper', 'continuar', 'y', 'o', 'no', 'verdadero', 'falso', 'nulo', 'yo', 'repetir', 'veces', 'pasar']);
const TOKEN = /(#.*$)|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|«[^»]*»?)|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)|(\s+)|(.)/gu;

export function resaltarLinea(linea) {
  let r = '';
  let m;
  let anterior = '';
  TOKEN.lastIndex = 0;
  const partes = [];
  while ((m = TOKEN.exec(linea))) partes.push(m);
  for (let i = 0; i < partes.length; i++) {
    const m2 = partes[i];
    const [txt, com, str, num, id] = m2;
    if (com) r += `<span class="tk-com">${esc(com)}</span>`;
    else if (str) r += `<span class="tk-txt">${esc(str)}</span>`;
    else if (num) r += `<span class="tk-num">${esc(num)}</span>`;
    else if (id) {
      let sig = '';
      for (let j = i + 1; j < partes.length; j++) { if (partes[j][5]) continue; sig = partes[j][0]; break; }
      if ((id === 'y' || id === 'o') && !/[\p{L}\p{N}_)\]"']$/u.test(anterior.trim() ? anterior : '')) r += esc(id);
      else if (CLAVES.has(id)) r += `<span class="tk-clave">${esc(id)}</span>`;
      else if (/^[A-Z]/.test(id)) r += `<span class="tk-tipo">${esc(id)}</span>`;
      else if (sig === '(') r += `<span class="tk-fn">${esc(id)}</span>`;
      else r += esc(id);
    } else r += esc(txt);
    if (!m2[5]) anterior = txt;
  }
  return r;
}

/**
 * op: { texto, soloLectura, tamFuente, alCambiar(texto), alCursor(linea, col), sugerencias(prefijo, linea, col) → [{nombre, insertar, desc, tipo}] }
 */
export function crearEditorCodigo(contenedor, op = {}) {
  const raiz = el(`<div class="editor-codigo ${op.soloLectura ? 'solo-lectura' : ''}">
    <div class="scroll"><div class="lienzo-cod"><div class="numeros"></div><div class="contenido-cod"><div class="capa-lineas"></div><pre></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" ${op.soloLectura ? 'readonly' : ''}></textarea></div></div></div></div>`);
  contenedor.append(raiz);
  const scroll = $('.scroll', raiz), numeros = $('.numeros', raiz), pre = $('pre', raiz), ta = $('textarea', raiz), capa = $('.capa-lineas', raiz), contenido = $('.contenido-cod', raiz);
  let diagnosticos = [];
  let resaltada = 0;
  let cambiadas = new Set();
  let ac = null;       // autocompletado
  let busqueda = null;
  ta.value = (op.texto || '').replace(/\t/g, '    ');
  fijarTam(op.tamFuente || 14);

  function fijarTam(px) { raiz.style.setProperty('--tam', px + 'px'); raiz._tam = px; pintar(); }
  function altoLinea() { return raiz._tam * 1.75; }

  function pintar() {
    const lineas = ta.value.split('\n');
    pre.innerHTML = lineas.map(l => resaltarLinea(l) || ' ').join('\n') + '\n';
    const cur = lineaActual();
    const conError = new Set(diagnosticos.filter(d => d.tipo !== 'aviso').map(d => d.linea));
    numeros.innerHTML = lineas.map((_, i) => `<div class="${conError.has(i + 1) ? 'err' : ''} ${i + 1 === cur ? 'actual' : ''}">${i + 1}</div>`).join('');
    // Tamaño del textarea = contenido (el contenedor es el que hace scroll).
    ta.style.height = pre.scrollHeight + 'px';
    ta.style.width = Math.max(pre.scrollWidth, contenido.clientWidth) + 'px';
    pintarCapa();
  }

  function pintarCapa() {
    const h = altoLinea();
    const cur = lineaActual();
    let html = '';
    if (!op.soloLectura) html += `<div class="l actual" style="top:${(cur - 1) * h}px;height:${h}px"></div>`;
    if (resaltada) html += `<div class="l resaltada" style="top:${(resaltada - 1) * h}px;height:${h}px"></div>`;
    for (const n of cambiadas) html += `<div class="l cambio" style="top:${(n - 1) * h}px;height:${h}px"></div>`;
    for (const d of diagnosticos) {
      if (d.tipo !== 'aviso') html += `<div class="l err" style="top:${(d.linea - 1) * h}px;height:${h}px"></div>`;
      const lineaTxt = ta.value.split('\n')[d.linea - 1] ?? '';
      const ini = Math.max(0, Math.min(d.columna ?? 0, lineaTxt.length));
      const fin = Math.max(ini + 1, Math.min(d.finColumna ?? ini + 1, Math.max(lineaTxt.length, ini + 1)));
      html += `<div class="subrayado ${d.tipo === 'aviso' ? 'aviso' : ''}" style="top:${d.linea * h - 5}px;left:calc(14px + ${ini}ch);width:calc(${fin - ini}ch)"></div>`;
    }
    if (busqueda && busqueda.coincidencias) {
      busqueda.coincidencias.forEach((c, i) => { html += `<div class="coincidencia ${i === busqueda.i ? 'actual' : ''}" style="top:${(c.linea - 1) * h + 3}px;height:${h - 6}px;left:calc(14px + ${c.col}ch);width:calc(${c.largo}ch)"></div>`; });
    }
    capa.innerHTML = html;
  }

  function lineaActual() { return ta.value.slice(0, ta.selectionStart).split('\n').length; }
  function colActual() { const a = ta.value.slice(0, ta.selectionStart); return a.length - a.lastIndexOf('\n') - 1; }

  function insertar(texto) {
    ta.focus();
    if (!document.execCommand('insertText', false, texto)) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(texto, s, e, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }

  function reemplazarTodo(texto) {
    const pos = ta.selectionStart;
    ta.focus();
    ta.select();
    insertar(texto);
    ta.selectionStart = ta.selectionEnd = Math.min(pos, texto.length);
  }

  // ---------- Teclado ----------
  ta.addEventListener('keydown', (e) => {
    if (ac) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ac.i = (ac.i + (e.key === 'ArrowDown' ? 1 : -1) + ac.items.length) % ac.items.length; pintarAc(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); aceptarAc(); return; }
      if (e.key === 'Escape') { e.preventDefault(); cerrarAc(); return; }
    }
    if (op.soloLectura) {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') { e.preventDefault(); abrirBusqueda(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') { e.preventDefault(); abrirAc(true); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') { e.preventDefault(); abrirBusqueda(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Slash' || e.key === '/' || e.code === 'Digit7' && e.shiftKey)) { e.preventDefault(); comentar(); return; }
    if (e.key === 'Tab') { e.preventDefault(); e.shiftKey ? desangrar() : sangrar(); return; }
    if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      const antes = ta.value.slice(0, ta.selectionStart);
      const linea = antes.slice(antes.lastIndexOf('\n') + 1);
      let sangria = (linea.match(/^ */) || [''])[0];
      const sinCom = linea.replace(/#.*$/, '').trimEnd();
      if (sinCom.endsWith(':')) sangria += '    ';
      if (/^\s*(devolver|romper|continuar|pasar)\b/.test(linea)) sangria = sangria.slice(4);
      insertar('\n' + sangria);
      return;
    }
    if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
      const antes = ta.value.slice(0, ta.selectionStart);
      const linea = antes.slice(antes.lastIndexOf('\n') + 1);
      if (linea.length && /^ +$/.test(linea)) {
        e.preventDefault();
        const quitar = linea.length % 4 || 4;
        ta.selectionStart = ta.selectionStart - quitar;
        insertar('');
        return;
      }
    }
    // Cierre automático de paréntesis y comillas.
    const pares = { '(': ')', '[': ']', '{': '}', '"': '"' };
    if (pares[e.key] && ta.selectionStart === ta.selectionEnd) {
      const sig = ta.value[ta.selectionStart] || '';
      if (e.key === '"' && sig === '"') { e.preventDefault(); ta.selectionStart = ta.selectionEnd = ta.selectionStart + 1; return; }
      if (!sig || /[\s)\]},:]/.test(sig)) {
        e.preventDefault();
        insertar(e.key + pares[e.key]);
        ta.selectionStart = ta.selectionEnd = ta.selectionStart - 1;
        return;
      }
    }
    if ([')', ']', '}'].includes(e.key) && ta.value[ta.selectionStart] === e.key && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault(); ta.selectionStart = ta.selectionEnd = ta.selectionStart + 1; return;
    }
  });

  function lineasSeleccionadas() {
    const v = ta.value;
    const ini = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let fin = v.indexOf('\n', ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === '\n' ? 1 : 0));
    if (fin < 0) fin = v.length;
    return { ini, fin, texto: v.slice(ini, fin) };
  }
  function transformarLineas(fn) {
    const { ini, fin, texto } = lineasSeleccionadas();
    const nuevo = texto.split('\n').map(fn).join('\n');
    ta.selectionStart = ini; ta.selectionEnd = fin;
    insertar(nuevo);
    ta.selectionStart = ini; ta.selectionEnd = ini + nuevo.length;
  }
  function sangrar() {
    if (ta.selectionStart === ta.selectionEnd) { const c = colActual(); insertar(' '.repeat(4 - (c % 4))); return; }
    transformarLineas(l => '    ' + l);
  }
  function desangrar() { transformarLineas(l => l.replace(/^ {1,4}/, '')); }
  function comentar() {
    const { texto } = lineasSeleccionadas();
    const todas = texto.split('\n').filter(l => l.trim()).every(l => /^\s*#/.test(l));
    transformarLineas(l => !l.trim() ? l : todas ? l.replace(/^(\s*)# ?/, '$1') : l.replace(/^(\s*)/, '$1# '));
  }

  ta.addEventListener('input', (e) => {
    pintar();
    if (!op.soloLectura) {
      const n = lineaActual();
      cambiadas.add(n);
      op.alCambiar && op.alCambiar(ta.value);
      if (e.inputType === 'insertText' && /[\p{L}\p{N}_.]/u.test(e.data || '')) abrirAc(false);
      else if (e.inputType !== 'insertText') cerrarAc();
    }
  });
  const alCursor = () => { pintarCapa(); $$('.numeros div', raiz).forEach((d, i) => d.classList.toggle('actual', i + 1 === lineaActual())); op.alCursor && op.alCursor(lineaActual(), colActual()); };
  ta.addEventListener('click', () => { cerrarAc(); alCursor(); });
  ta.addEventListener('keyup', (e) => { if (!['ArrowDown', 'ArrowUp'].includes(e.key) || !ac) alCursor(); });
  ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ta) cerrarAc(); }, 150));
  const ro = new ResizeObserver(() => pintar());
  ro.observe(contenido);

  // ---------- Autocompletado ----------
  function prefijo() {
    const antes = ta.value.slice(0, ta.selectionStart);
    const m = /([\p{L}_][\p{L}\p{N}_]*)?$/u.exec(antes);
    const p = m[1] || '';
    const tras = antes.slice(0, antes.length - p.length);
    const objeto = tras.endsWith('.') ? (/([\p{L}_][\p{L}\p{N}_]*)\.$/u.exec(tras) || [])[1] || '?' : null;
    return { p, objeto };
  }
  function abrirAc(forzado) {
    if (!op.sugerencias) return;
    const { p, objeto } = prefijo();
    if (!forzado && p.length < 2 && !objeto) { cerrarAc(); return; }
    const linea = ta.value.slice(0, ta.selectionStart).split('\n').pop();
    if (/^\s*#/.test(linea) || ((linea.match(/"/g) || []).length % 2 === 1)) { cerrarAc(); return; }
    const items = op.sugerencias(p, { objeto, linea: lineaActual() }).slice(0, 40);
    if (!items.length || (items.length === 1 && items[0].nombre === p)) { cerrarAc(); return; }
    if (!ac) { ac = { el: el('<div class="autocompletar"></div>'), i: 0 }; contenido.append(ac.el); }
    ac.items = items; ac.p = p; ac.i = 0;
    pintarAc();
  }
  function pintarAc() {
    const h = altoLinea();
    ac.el.style.top = (lineaActual() * h + 14) + 'px';
    ac.el.style.left = `calc(14px + ${Math.max(0, colActual() - ac.p.length)}ch)`;
    ac.el.innerHTML = ac.items.map((s, i) => `<div class="op-ac ${i === ac.i ? 'foco' : ''}" data-i="${i}"><span class="f ${s.tipo === 'variable' ? 'v' : s.tipo === 'palabra' ? 'k' : s.tipo === 'evento' ? 'e' : ''}">${s.tipo === 'variable' ? 'v' : s.tipo === 'palabra' ? 'k' : s.tipo === 'evento' ? 'e' : 'ƒ'}</span><b>${esc(s.etiqueta || s.nombre)}</b><span>${esc(s.desc || '')}</span></div>`).join('');
    $$('.op-ac', ac.el).forEach(o => o.onmousedown = (e) => { e.preventDefault(); ac.i = Number(o.dataset.i); aceptarAc(); });
    const f = ac.el.querySelector('.foco'); if (f) f.scrollIntoView({ block: 'nearest' });
  }
  function aceptarAc() {
    const s = ac.items[ac.i];
    const p = ac.p;
    cerrarAc();
    ta.selectionStart = ta.selectionStart - p.length;
    insertar(s.insertar ?? s.nombre);
    if (s.cursorAtras) ta.selectionStart = ta.selectionEnd = ta.selectionStart - s.cursorAtras;
  }
  function cerrarAc() { if (ac) { ac.el.remove(); ac = null; } }

  // ---------- Búsqueda ----------
  function abrirBusqueda() {
    if (busqueda) { busqueda.input.focus(); busqueda.input.select(); return; }
    const b = el(`<div class="barra-buscar"><input class="campo" placeholder="Buscar"><span class="cuenta-buscar"></span><button class="btn-icono peq" data-a="ant">${icono('flechaArriba', '', 14)}</button><button class="btn-icono peq" data-a="sig">${icono('flechaAbajo', '', 14)}</button><button class="btn-icono peq" data-a="x">${icono('cerrar', '', 14)}</button></div>`);
    raiz.append(b);
    busqueda = { el: b, input: $('input', b), i: 0, coincidencias: [] };
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && !sel.includes('\n')) busqueda.input.value = sel;
    const actualizar = () => {
      const q = busqueda.input.value.toLowerCase();
      busqueda.coincidencias = [];
      if (q) ta.value.split('\n').forEach((l, i) => { let k = -1; while ((k = l.toLowerCase().indexOf(q, k + 1)) >= 0) busqueda.coincidencias.push({ linea: i + 1, col: k, largo: q.length }); });
      busqueda.i = Math.min(busqueda.i, Math.max(0, busqueda.coincidencias.length - 1));
      $('.cuenta-buscar', b).textContent = q ? (busqueda.coincidencias.length ? `${busqueda.i + 1} de ${busqueda.coincidencias.length}` : 'Sin resultados') : '';
      pintarCapa();
    };
    const ir = (d) => {
      const n = busqueda.coincidencias.length;
      if (!n) return;
      busqueda.i = (busqueda.i + d + n) % n;
      const c = busqueda.coincidencias[busqueda.i];
      irA(c.linea, c.col, false);
      actualizar();
    };
    busqueda.input.oninput = () => { busqueda.i = 0; actualizar(); ir(0); };
    busqueda.input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ir(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') cerrarBusqueda(); };
    $('[data-a=sig]', b).onclick = () => ir(1);
    $('[data-a=ant]', b).onclick = () => ir(-1);
    $('[data-a=x]', b).onclick = cerrarBusqueda;
    busqueda.input.focus();
    actualizar();
  }
  function cerrarBusqueda() { if (!busqueda) return; busqueda.el.remove(); busqueda = null; pintarCapa(); ta.focus(); }

  function irA(linea, col = 0, foco = true) {
    const lineas = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(linea - 1, lineas.length); i++) pos += lineas[i].length + 1;
    pos += Math.min(col, (lineas[linea - 1] || '').length);
    if (foco) ta.focus();
    ta.selectionStart = ta.selectionEnd = pos;
    const h = altoLinea();
    const y = (linea - 1) * h;
    if (y < scroll.scrollTop || y > scroll.scrollTop + scroll.clientHeight - h * 3) scroll.scrollTop = Math.max(0, y - scroll.clientHeight / 3);
    alCursor();
  }

  pintar();
  return {
    el: raiz, textarea: ta,
    valor: () => ta.value,
    fijar: (t) => { ta.value = (t || '').replace(/\t/g, '    '); cambiadas = new Set(); pintar(); },
    reemplazarTodo,
    insertar: (t) => { insertar(t); },
    irA,
    lineaActual, colActual,
    diagnosticos: (lista) => { diagnosticos = lista || []; pintar(); },
    resaltar: (n) => { resaltada = n || 0; pintarCapa(); if (n) { const h = altoLinea(); const y = (n - 1) * h; if (y < scroll.scrollTop || y > scroll.scrollTop + scroll.clientHeight - h) scroll.scrollTop = Math.max(0, y - h); } },
    tamFuente: (px) => fijarTam(px),
    buscar: abrirBusqueda,
    foco: () => ta.focus(),
    limpiarCambios: () => { cambiadas = new Set(); pintarCapa(); },
    destruir: () => { ro.disconnect(); cerrarAc(); },
  };
}
