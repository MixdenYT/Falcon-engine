// Panel inferior: Salida, Depurador, consola de Águila, Animación y Audio.
import { est, bus, documento, archivosDeTipo, registros } from '../estado.js';
import { abrirArchivo } from '../acciones.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, hora, pintarDeslizador } from '../../ui/componentes.js';
import { crearInterprete, aTexto } from '../../aguila/index.js';

let erroresJuego = 0;

const TITULOS = { salida: 'Salida', depurador: 'Depurador', aguila: 'Águila', animacion: 'Animación', audio: 'Audio' };
let interpConsola = null;
const historialConsola = [];

export function crearInferior(contenedor, op = {}) {
  const pestanas = op.pestanas || ['salida', 'depurador', 'aguila', 'animacion', 'audio'];
  const extra = op.extra || {};
  let actual = op.inicial || pestanas[0];
  let plegado = !!op.plegado;
  const raiz = el(`<section class="panel inferior ${plegado ? 'plegado' : ''}">
    <div class="cab-panel"><div class="pestanas"></div><div class="derecha"></div></div>
    <div class="panel-cont"></div></section>`);
  contenedor.append(raiz);
  const cabP = raiz.querySelector('.pestanas'), der = raiz.querySelector('.derecha'), cont = raiz.querySelector('.panel-cont');
  let limpiezas = [];

  const pintarCabecera = () => {
    cabP.innerHTML = pestanas.map(p => {
      const t = extra[p]?.titulo ?? TITULOS[p];
      const n = extra[p]?.insignia ? extra[p].insignia() : 0;
      return `<button data-p="${p}" class="${p === actual && !plegado ? 'activo' : ''}">${esc(t)}${n ? `<span class="insignia">${n}</span>` : ''}</button>`;
    }).join('');
    $$('button', cabP).forEach(b => b.onclick = () => { actual = b.dataset.p; if (plegado) plegar(false); pintar(); });
  };

  const pintarDerecha = () => {
    der.innerHTML = '';
    if (extra[actual]?.derecha) extra[actual].derecha(der);
    if (plegado) {
      const n = registros.depurador.filter(r => r.tipo === 'error').length + registros.salida.filter(r => r.tipo === 'error').length;
      der.append(el(n ? `<span class="sin-errores" style="color:var(--error)">${n} error${n > 1 ? 'es' : ''}</span>` : '<span class="sin-errores">Sin errores</span>'));
    } else if (actual === 'salida' || actual === 'depurador') {
      const b = el('<button class="btn fantasma peq">Limpiar</button>');
      b.onclick = () => { registros[actual].length = 0; if (actual === 'depurador') erroresJuego = 0; pintar(); };
      der.append(b);
    }
    const pl = el(`<button class="btn-icono peq" data-ayuda="${plegado ? 'Mostrar' : 'Ocultar'}">${icono(plegado ? 'flechaArriba' : 'flechaAbajo', '', 16)}</button>`);
    pl.onclick = () => plegar(!plegado);
    der.append(pl);
  };

  function plegar(si) { plegado = si; raiz.classList.toggle('plegado', si); op.alPlegar && op.alPlegar(si); pintar(); }

  function pintar() {
    limpiezas.forEach(f => f()); limpiezas = [];
    pintarCabecera();
    pintarDerecha();
    cont.innerHTML = '';
    if (plegado) return;
    if (extra[actual]?.pintar) { const r = extra[actual].pintar(cont); if (typeof r === 'function') limpiezas.push(r); return; }
    if (actual === 'salida' || actual === 'depurador') pintarRegistro(cont, actual);
    else if (actual === 'aguila') pintarConsola(cont);
    else if (actual === 'animacion') limpiezas.push(pintarAnimacion(cont));
    else if (actual === 'audio') pintarAudio(cont);
  }

  function pintarRegistro(c, canal) {
    const lista = el('<div class="registro desplazable"></div>');
    c.append(lista);
    const linea = (r) => {
      const d = el(`<div class="linea ${r.tipo} ${r.archivo ? 'enlace' : ''}"><span class="hora">${r.hora}</span><span class="txt">${esc(r.texto)}</span></div>`);
      if (r.archivo) d.onclick = () => irAError(r.archivo, r.linea);
      return d;
    };
    if (!registros[canal].length) lista.append(el(`<div class="linea"><span class="txt" style="color:var(--texto-3)">${canal === 'depurador' ? 'Pulsa Probar (F5) para ver aquí los mensajes del juego.' : 'Todo tranquilo por aquí.'}</span></div>`));
    for (const r of registros[canal]) lista.append(linea(r));
    lista.scrollTop = lista.scrollHeight;
    limpiezas.push(bus.on('registro', ({ canal: c2, r }) => {
      if (c2 !== canal) { pintarCabecera(); return; }
      if (lista.querySelector('.linea:only-child .txt[style]')) lista.innerHTML = '';
      const abajo = lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 30;
      lista.append(linea(r));
      if (abajo) lista.scrollTop = lista.scrollHeight;
    }));
  }

  function pintarConsola(c) {
    const lista = el('<div class="registro desplazable"></div>');
    const entrada = el(`<div class="consola-entrada"><span class="prompt">›</span><input placeholder="Escribe Águila y pulsa Intro · por ejemplo  2 + 2  o  mostrar(&quot;hola&quot;)" spellcheck="false"></div>`);
    c.append(lista, entrada);
    const input = entrada.querySelector('input');
    const escribir = (t, tipo = '') => { lista.append(el(`<div class="linea ${tipo}"><span class="txt">${esc(t)}</span></div>`)); lista.scrollTop = lista.scrollHeight; };
    escribir(est.juego.activo ? 'Conectado al juego: lo que escribas se ejecuta en el nodo observado.' : 'Consola de Águila. Con el juego en marcha, se ejecuta dentro del juego.', 'ok');
    let idx = historialConsola.length;
    let espera = new Map();
    limpiezas.push(bus.on('juego:resultado', (m) => {
      if (!espera.has(m.id)) return;
      espera.delete(m.id);
      if (m.error) escribir(m.error, 'error'); else if (m.texto) escribir(m.texto, 'ok');
    }));
    input.onkeydown = (e) => {
      if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); input.value = historialConsola[idx] || ''; e.preventDefault(); }
      if (e.key === 'ArrowDown') { idx = Math.min(historialConsola.length, idx + 1); input.value = historialConsola[idx] || ''; e.preventDefault(); }
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const codigo = input.value;
      historialConsola.push(codigo); idx = historialConsola.length;
      input.value = '';
      escribir('› ' + codigo);
      if (est.juego.activo) {
        const id = Math.random().toString(36).slice(2);
        espera.set(id, true);
        window.falcon.juego.enviar({ tipo: 'evaluar', codigo, id });
        return;
      }
      interpConsola ||= crearInterprete({ salida: (t) => escribir(t, 'juego') });
      try {
        const r = interpConsola.ejecutar(codigo, 'consola');
        if (r !== undefined) escribir(aTexto(r, true), 'ok');
      } catch (err) { escribir(err.mensajeCompleto || err.message, 'error'); if (err.explicacion) escribir(err.explicacion); }
    };
    setTimeout(() => input.focus());
  }

  pintar();
  const quitar = [bus.on('seleccion', () => { if (actual === 'animacion') pintar(); }), bus.on('juego:estado', () => { if (actual === 'aguila') pintar(); })];
  return {
    el: raiz, pintar, mostrar: (p) => { actual = p; plegar(false); },
    destruir: () => { limpiezas.forEach(f => f()); quitar.forEach(f => f()); },
  };
}

export async function irAError(archivo, linea) {
  if (!archivo) return;
  let rel = archivo;
  if (archivo.startsWith('generado/')) {
    const bp = 'blueprints/' + archivo.slice('generado/'.length).replace(/\.agl$/, '.bp');
    if (est.archivos.some(a => a.rel === bp)) rel = bp;
  }
  await abrirArchivo(rel);
  if (linea) setTimeout(() => bus.emit('codigo:ir', { rel, linea }), 80);
}

// ---------- Animación ----------
function pintarAnimacion(c) {
  const doc = est.activo;
  const n = doc && doc.nodoSel;
  const sprite = n && (n.tipo === 'Sprite' ? n : n.hijos.find(h => h.tipo === 'Sprite'));
  if (!sprite || !sprite.props.imagen) {
    c.append(el('<div class="vacio-texto">Selecciona un Sprite con una imagen (o un nodo que tenga uno) para crear sus animaciones a partir de la hoja de sprites.</div>'));
    return () => {};
  }
  const p = est.proyecto;
  const rel = sprite.props.imagen;
  const aj = p.ajustesImportacion(rel);
  const total = aj.columnas * aj.filas;
  const anims = (p.importacion[rel] ||= {}).animaciones ||= {};
  let elegida = Object.keys(anims)[0] || null;
  let cuadro = 0;
  const img = new Image();
  img.src = p.url(rel);
  const caja = el('<div class="desplazable"></div>');
  c.append(caja);
  const pintarTodo = () => {
    const rango = elegida ? anims[elegida] : [0, total - 1];
    caja.innerHTML = `
      <div class="fila-anim"><b>${esc(sprite.nombre)}</b><span style="color:var(--texto-2)">${esc(rel)} · ${total} cuadros</span>
        <select class="campo" style="width:150px;height:28px;margin-left:12px" data-a="anim">${Object.keys(anims).map(k => `<option ${k === elegida ? 'selected' : ''}>${esc(k)}</option>`).join('')}<option value="__nueva">+ Nueva animación…</option></select>
        ${elegida ? `<span style="color:var(--texto-2)">de</span><input class="campo mono" type="number" min="0" max="${total - 1}" value="${rango[0]}" data-a="ini" style="width:64px;height:28px"><span style="color:var(--texto-2)">a</span><input class="campo mono" type="number" min="0" max="${total - 1}" value="${rango[1]}" data-a="fin" style="width:64px;height:28px"><button class="btn fantasma peq" data-a="borrar">${icono('papelera', '', 14)}</button>` : ''}
        <span style="margin-left:auto;color:var(--texto-2);font-family:var(--mono)">animar("${esc(elegida || 'nombre')}")</span></div>
      <div class="tira-cuadros">${Array.from({ length: total }, (_, i) => `<div class="cuadro-anim ${i >= rango[0] && i <= rango[1] ? 'en-rango' : ''}" data-i="${i}"><canvas width="56" height="56"></canvas><span>${i}</span></div>`).join('')}</div>`;
    const dibujar = () => {
      $$('.cuadro-anim', caja).forEach(cv => {
        const i = Number(cv.dataset.i);
        const ctx = cv.querySelector('canvas').getContext('2d');
        ctx.clearRect(0, 0, 56, 56);
        if (!img.complete || !img.width) return;
        const fw = img.width / aj.columnas, fh = img.height / aj.filas;
        const e = Math.min(48 / fw, 48 / fh);
        ctx.imageSmoothingEnabled = aj.filtro !== 'pixel';
        ctx.drawImage(img, (i % aj.columnas) * fw, Math.floor(i / aj.columnas) * fh, fw, fh, 28 - fw * e / 2, 28 - fh * e / 2, fw * e, fh * e);
        cv.classList.toggle('actual', i === Math.floor(cuadro));
      });
    };
    img.onload = dibujar;
    dibujar();
    caja.querySelector('[data-a=anim]').onchange = async (e) => {
      if (e.target.value === '__nueva') {
        const { pedirTexto } = await import('../../ui/componentes.js');
        const nombre = await pedirTexto({ titulo: 'Nueva animación', etiqueta: 'Nombre (por ejemplo «andar»)', valor: 'andar' });
        if (nombre) { anims[nombre] = [0, total - 1]; elegida = nombre; await p.guardarImportacion(); }
      } else elegida = e.target.value;
      pintarTodo();
    };
    const cambiarRango = async () => {
      anims[elegida] = [Number(caja.querySelector('[data-a=ini]').value), Number(caja.querySelector('[data-a=fin]').value)].map(v => Math.max(0, Math.min(total - 1, v)));
      await p.guardarImportacion();
      pintarTodo();
    };
    caja.querySelector('[data-a=ini]')?.addEventListener('change', cambiarRango);
    caja.querySelector('[data-a=fin]')?.addEventListener('change', cambiarRango);
    caja.querySelector('[data-a=borrar]')?.addEventListener('click', async () => { delete anims[elegida]; elegida = Object.keys(anims)[0] || null; await p.guardarImportacion(); pintarTodo(); });
    pintarTodo.dibujar = dibujar;
  };
  pintarTodo();
  let ult = performance.now();
  const t = setInterval(() => {
    const ahora = performance.now();
    const rango = elegida ? anims[elegida] : [0, total - 1];
    cuadro += (ahora - ult) / 1000 * (sprite.props.fps || 8);
    ult = ahora;
    if (cuadro > rango[1] + 0.999 || cuadro < rango[0]) cuadro = rango[0];
    $$('.cuadro-anim', caja).forEach(cv => cv.classList.toggle('actual', Number(cv.dataset.i) === Math.floor(cuadro)));
  }, 60);
  return () => clearInterval(t);
}

// ---------- Audio ----------
let audioPrueba = null;
function pintarAudio(c) {
  const p = est.proyecto;
  const vol = p.datos.volumen ||= { general: 1, musica: 0.7, efectos: 1 };
  const sonidos = archivosDeTipo('sonido');
  const caja = el(`<div class="desplazable">
    <div class="mezclador">${[['general', 'Volumen general'], ['musica', 'Música'], ['efectos', 'Efectos']].map(([k, t]) => `<div class="canal"><span>${t} <b class="mono" data-n="${k}">${Math.round(vol[k] * 100)} %</b></span><input type="range" class="deslizador" min="0" max="1" step="0.01" value="${vol[k]}" data-k="${k}"></div>`).join('')}</div>
    <div class="lista-sonidos">${sonidos.length ? sonidos.map(s => `<div class="chip-sonido" data-r="${esc(s.rel)}" title="${esc(s.rel)}">${icono('play', '', 13)}${esc(s.nombre)}</div>`).join('') : '<span class="vacio-texto">No hay sonidos en el proyecto. Impórtalos desde Recursos.</span>'}</div></div>`);
  c.append(caja);
  $$('.deslizador', caja).forEach(i => { pintarDeslizador(i); i.oninput = () => { vol[i.dataset.k] = Number(i.value); caja.querySelector(`[data-n=${i.dataset.k}]`).textContent = Math.round(i.value * 100) + ' %'; }; i.onchange = () => p.guardar(); });
  $$('.chip-sonido', caja).forEach(ch => ch.onclick = () => {
    if (audioPrueba) audioPrueba.pause();
    audioPrueba = new Audio(p.url(ch.dataset.r));
    audioPrueba.volume = vol.general * vol.efectos;
    audioPrueba.play();
  });
}
