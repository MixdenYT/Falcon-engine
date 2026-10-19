// Modo Sencillo: lo esencial del nivel y el curso guiado «Mi primer juego».
import { est, bus, abrirDocumento, anotarEvento } from '../estado.js';
import { seleccionar } from '../acciones.js';
import { cambiarProp } from '../operaciones.js';
import { CATALOGO, anadirDelCatalogo, ed, estadoCurso, cargarCurso, leccionActual, pasoActual, revisar, irALeccion, solucionPaso, iniciarRevisiones } from '../curso.js';
import { LECCIONES } from '../lecciones.js';
import { crearVisor2D } from '../visores/visor2d.js';
import { tipo as tipoNodo, COLORES_FAMILIA, recorrer } from '../../motor/tipos.js';
import { resaltarLinea } from '../../ui/editor-codigo.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu, pintarDeslizador, dialogo, interruptor } from '../../ui/componentes.js';
import { normalizarColor } from '../paneles/inspector.js';

const DESCRIPCIONES = { Monedas: 'Para recoger', Suelo: 'Donde se camina', Mosaicos: 'Donde se camina', Cámara: 'Lo que ve el jugador', Jugador: 'Tu personaje', Plataformas: 'Para subirse', Enemigos: 'Cuidado con ellos' };
let guiaOculta = false;

export async function crearDisposicionSencilla(contenedor) {
  cargarCurso();
  iniciarRevisiones();
  const cuerpo = el('<div class="cuerpo sencillo"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div>');
  contenedor.append(cuerpo);
  const [izq, centro, der] = cuerpo.children;
  const partes = [];
  const doc = () => est.activo && est.activo.tipo === 'escena' ? est.activo : null;

  // ---------- Lo que hay en tu nivel ----------
  const panelNivel = el(`<section class="panel" style="flex:1.1"><div class="cab-panel"><h3>Lo que hay en tu nivel</h3><button class="btn-icono peq" data-a="ayuda" style="margin-left:auto;border:1px solid var(--borde);border-radius:50%">?</button></div><div class="desplazable lista-sencilla"></div>
    <button class="anadir-sencillo" data-accion="anadir-sencillo">+ Añadir algo al nivel</button></section>`);
  const panelProps = el(`<section class="panel" style="flex:1"><div class="cab-panel"><h3 class="titulo-props">Nada elegido</h3></div><div class="desplazable props-sencillas"></div></section>`);
  izq.append(panelNivel, panelProps);
  $('[data-a=ayuda]', panelNivel).onclick = () => dialogo({ titulo: 'Lo que hay en tu nivel', sub: 'Aquí están las cosas que forman tu nivel. Haz clic en una para cambiar cómo es, o arrástrala en el visor para moverla. Con «Añadir algo al nivel» puedes poner monedas, plataformas, pinchos o una meta.', botones: [{ texto: 'Entendido', tipo: 'principal', valor: true }] });
  $('[data-accion=anadir-sencillo]', panelNivel).onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    menu(r.left, r.bottom + 4, CATALOGO.map(c => ({ texto: `${c.nombre} · ${c.desc}`, icono: c.icono, accion: () => anadirDelCatalogo(c.id, doc()) })));
  };

  function pintarNivel() {
    const c = $('.lista-sencilla', panelNivel);
    const d = doc();
    if (!d) { c.innerHTML = '<div class="vacio-texto">Abre una escena.</div>'; return; }
    const sel = d.nodoSel;
    const visibles = d.datos.raiz.hijos.filter(n => !['Fondo', 'Interfaz'].includes(n.tipo));
    c.innerHTML = visibles.map(n => {
      const t = tipoNodo(n.tipo);
      const marcado = sel && (sel.id === n.id || esDescendiente(n, sel.id));
      return `<div class="item-sencillo ${marcado ? 'sel' : ''}" data-id="${esc(n.id)}" data-sencillo-nodo="${esc(n.nombre)}"><span class="caja" style="color:${COLORES_FAMILIA[t.familia]}">${icono(n.nombre === 'Monedas' ? 'moneda' : n.tipo === 'Mosaicos' ? 'mosaicos' : t.icono, '', 17)}</span><div><b>${esc(n.nombre)}</b><span>${esc(DESCRIPCIONES[n.nombre] || DESCRIPCIONES[n.nombre.replace(/\d+$/, '')] || t.sencillo || t.nombreVisible)}</span></div></div>`;
    }).join('');
    $$('[data-id]', c).forEach(x => x.onclick = () => seleccionar([x.dataset.id], d));
  }

  function esDescendiente(n, id) { let s = false; recorrer(n, x => { if (x.id === id) s = true; }); return s; }

  // ---------- Propiedades sencillas ----------
  function pintarProps() {
    const c = $('.props-sencillas', panelProps);
    const d = doc();
    const n = d && d.nodoSel;
    $('.titulo-props', panelProps).textContent = n ? n.nombre : 'Nada elegido';
    if (!n) { c.innerHTML = '<div class="vacio-texto" style="text-align:left;padding:4px 0">Elige algo de la lista o del visor para cambiar cómo es.</div>'; return; }
    const t = tipoNodo(n.tipo);
    let html = '';
    for (const p of t.props.filter(x => x.sencillo)) {
      const v = n.props[p.clave];
      html += `<div class="p-s" data-sencillo-prop="${p.clave}"><label>${esc(p.sencillo.etiqueta)}</label><input type="range" class="deslizador" min="${p.min ?? 0}" max="${p.max ?? 100}" step="${p.paso ?? 1}" value="${v}" data-k="${p.clave}">${p.sencillo.izq ? `<div class="extremos"><span>${esc(p.sencillo.izq)}</span><span>${esc(p.sencillo.der)}</span></div>` : ''}</div>`;
    }
    const sprite = n.tipo === 'Sprite' ? n : n.hijos.find(h => h.tipo === 'Sprite');
    if (sprite && !sprite.props.imagen) html += `<div class="p-s"><label>Color</label><input type="color" value="${esc(normalizarColor(sprite.props.color))}" data-color="${esc(sprite.id)}" style="width:100%;height:32px;border:0;background:none"></div>`;
    if (n.tipo === 'Plataforma') html += `<div class="p-s"><label>Largo</label><input type="range" class="deslizador" min="40" max="800" step="10" value="${n.props.ancho}" data-k="ancho"><div class="extremos"><span>Corta</span><span>Larga</span></div></div><div class="p-s"><label>Color</label><input type="color" value="${esc(normalizarColor(n.props.color))}" data-k-color="color" style="width:100%;height:32px;border:0;background:none"></div>`;
    if (n.tipo === 'Etiqueta') html += `<div class="p-s"><label>Texto</label><input class="campo" value="${esc(n.props.texto)}" data-texto></div>`;
    if (n.tipo === 'Personaje2D') html += `<div class="p-s">${interruptor(n.props.usa_gravedad, 'Le afecta la gravedad', 'grav')}</div>`;
    if (!html) html = '<div class="vacio-texto" style="text-align:left;padding:4px 0 10px">Esto no tiene ajustes sencillos. Pasa al modo Avanzado para verlo todo.</div>';
    html += `<div class="titulo-seccion" style="margin:6px 0 10px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--texto-2);font-weight:600">Comportamiento</div>
      <button class="btn principal ancho" data-accion="anadir-blueprint">${icono('blueprint', '', 17)}${n.blueprint ? 'Abrir Blueprint' : 'Añadir Blueprint'}</button>
      <button class="btn secundario ancho" data-accion="escribir-aguila">${icono('codigo', '', 16)}${n.script ? 'Abrir en Águila' : 'Escribir en Águila'}</button>`;
    c.innerHTML = html;
    $$('[data-k]', c).forEach(i => { pintarDeslizador(i); i.oninput = () => cambiarProp(d, n.id, i.dataset.k, Number(i.value)); });
    $$('[data-color]', c).forEach(i => i.oninput = () => cambiarProp(d, i.dataset.color, 'color', i.value.toUpperCase()));
    $$('[data-k-color]', c).forEach(i => i.oninput = () => cambiarProp(d, n.id, 'color', i.value.toUpperCase()));
    const tx = $('[data-texto]', c); if (tx) tx.oninput = () => cambiarProp(d, n.id, 'texto', tx.value);
    const g = $('[data-campo=grav]', c); if (g) g.onchange = () => cambiarProp(d, n.id, 'usa_gravedad', g.checked);
    $('[data-accion=anadir-blueprint]', c).onclick = () => n.blueprint ? abrirDocumento(n.blueprint) : ed.anadirBlueprintSencillo(n.nombre);
    $('[data-accion=escribir-aguila]', c).onclick = () => n.script ? abrirDocumento(n.script) : ed.crearScriptSencillo(n.nombre);
  }

  // ---------- Visor ----------
  const visor = doc() && doc().dim === '2D' ? crearVisor2D(centro, { sinBarra: true, textoGuia: 'Arrastra para mover · Rueda para acercar' }) : null;
  if (visor) partes.push(visor);
  else if (doc()) { const { crearVisor3D } = await import('../visores/visor3d.js'); partes.push(await crearVisor3D(centro)); }
  else centro.append(el('<section class="panel visor"><div class="vacio-visor"><div><b>No hay ninguna escena abierta</b></div></div></section>'));
  const capaGuia = el('<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible"></svg>');
  if (visor) $('.lienzo-visor', visor.el).append(capaGuia);

  // Texto y flecha de guía sobre el visor («Aquí saltará tu personaje»).
  function pintarGuiaVisor() {
    if (!visor) return;
    const l = leccionActual();
    const j = ed.nodo('Jugador');
    if (l.id !== 'saltar' || !j || pasoActual() < 0) { capaGuia.innerHTML = ''; return; }
    const [x, y] = visor.aPantalla(j.props.posicion[0], j.props.posicion[1] - 50);
    const x2 = x + 190, y2 = y - 10;
    capaGuia.innerHTML = `<path d="M${x},${y} Q${(x + x2) / 2},${y - 120} ${x2},${y2}" fill="none" stroke="#3DDC84" stroke-width="2.5" stroke-dasharray="7 6"/><path d="M${x2 - 12},${y2 - 12} L${x2},${y2} L${x2 - 15},${y2 + 2}" fill="none" stroke="#3DDC84" stroke-width="2.5"/>
      <text x="${(x + x2) / 2}" y="${y - 140}" text-anchor="middle" fill="rgba(231,237,233,.8)" font-family="Manrope" font-weight="600" font-size="19">Aquí saltará tu personaje</text>`;
  }
  let rafGuia = 0;
  const bucleGuia = () => { pintarGuiaVisor(); rafGuia = requestAnimationFrame(bucleGuia); };
  if (visor) rafGuia = requestAnimationFrame(bucleGuia);

  // ---------- Lección ----------
  const panelLeccion = el('<section class="panel leccion"></section>');
  der.append(panelLeccion);
  let burbuja = null;

  function pintarLeccion() {
    const l = leccionActual();
    const total = LECCIONES.length;
    const actual = pasoActual();
    const todos = actual < 0;
    panelLeccion.innerHTML = `
      <div class="curso-cab"><span>CURSO · MI PRIMER JUEGO</span><span style="letter-spacing:0;font-weight:600;cursor:pointer" data-a="lista">${estadoCurso.leccion + 1} de ${total} ${icono('flechaAbajo', '', 12)}</span></div>
      <div class="progreso"><div style="width:${(estadoCurso.leccion + (todos ? 1 : estadoCurso.hechos.size / l.pasos.length)) / total * 100}%"></div></div>
      <h2>${esc(l.titulo)}</h2><p>${esc(l.descripcion)}</p>
      <div class="pasos-leccion">${l.pasos.map((p, i) => `<div class="paso-l ${estadoCurso.hechos.has(i) ? 'hecho' : i === actual ? 'actual' : ''}"><span class="marca-paso">${estadoCurso.hechos.has(i) ? icono('check', '', 14) : i + 1}</span><span>${esc(p.texto)}</span></div>`).join('')}</div>
      <div class="codigo-leccion"><div class="t">${icono('codigo', '', 15)}Lo mismo escrito en Águila</div><pre>${l.aguila.split('\n').map(resaltarLinea).join('\n')}</pre></div>
      ${todos ? `<div class="problema" style="margin:14px 0 0;background:var(--verde-tenue)"><span class="marca-problema" style="background:var(--verde);color:#04140B">✓</span><div><b>¡Lección completada!</b><span>${estadoCurso.leccion + 1 < total ? 'Pulsa «Siguiente» para seguir aprendiendo.' : 'Has terminado el curso. ¡Ya sabes hacer juegos!'}</span></div></div>` : ''}
      <div class="pie-leccion"><button class="btn secundario" data-a="pista" ${todos ? 'disabled' : ''}>Dame una pista</button><button class="btn fantasma" data-a="solucion" ${todos ? 'disabled' : ''}>Ver solución</button><button class="btn ${todos ? 'principal' : 'secundario'}" data-a="siguiente" ${todos && estadoCurso.leccion + 1 < total ? '' : 'disabled'}>Siguiente</button></div>`;
    $('[data-a=pista]', panelLeccion).onclick = () => mostrarBurbuja(true);
    $('[data-a=solucion]', panelLeccion).onclick = async () => { if (!(await solucionPaso())) mostrarBurbuja(true); };
    $('[data-a=siguiente]', panelLeccion).onclick = () => irALeccion(estadoCurso.leccion + 1);
    $('[data-a=lista]', panelLeccion).onclick = (e) => menu(e.clientX - 200, e.clientY + 10, LECCIONES.map((x, i) => ({ texto: `${i + 1}. ${x.titulo}`, marcado: i === estadoCurso.leccion, accion: () => irALeccion(i) })));
    mostrarBurbuja(false);
  }

  // Burbuja guía junto al elemento que hay que usar.
  function mostrarBurbuja(forzar) {
    if (burbuja) { burbuja.remove(); burbuja = null; }
    $$('.foco-guia').forEach(x => x.classList.remove('foco-guia'));
    const l = leccionActual();
    const i = pasoActual();
    if (i < 0) return;
    const p = l.pasos[i];
    const texto = forzar ? (p.pista || p.texto) : p.coach;
    if (!texto || (guiaOculta && !forzar)) return;
    const objetivo = p.foco ? document.querySelector(p.foco) : null;
    if (objetivo) objetivo.classList.add('foco-guia');
    burbuja = el(`<div class="burbuja-guia izq"><div class="paso-n">PASO ${i + 1}</div><p>${esc(texto)}</p><div class="fila-flex"><button class="btn oscuro">Entendido</button><button class="btn claro">Saltar guía</button></div></div>`);
    document.body.append(burbuja);
    const colocar = () => {
      if (!burbuja) return;
      const r = objetivo ? objetivo.getBoundingClientRect() : panelLeccion.getBoundingClientRect();
      const b = burbuja.getBoundingClientRect();
      if (objetivo && r.right + b.width + 20 < innerWidth) { burbuja.className = 'burbuja-guia izq'; burbuja.style.left = r.right + 14 + 'px'; burbuja.style.top = Math.max(10, r.top + r.height / 2 - 34) + 'px'; }
      else { burbuja.className = 'burbuja-guia arriba'; burbuja.style.left = Math.max(10, Math.min(innerWidth - b.width - 10, r.left)) + 'px'; burbuja.style.top = r.bottom + 12 + 'px'; }
    };
    colocar();
    burbuja.querySelector('.oscuro').onclick = () => { burbuja.remove(); burbuja = null; };
    burbuja.querySelector('.claro').onclick = () => { guiaOculta = true; burbuja.remove(); burbuja = null; $$('.foco-guia').forEach(x => x.classList.remove('foco-guia')); };
  }

  pintarNivel(); pintarProps(); pintarLeccion();
  revisar();
  const quitar = [
    bus.on('seleccion', () => { pintarNivel(); pintarProps(); }),
    bus.on('doc:cambio', ({ op }) => { pintarNivel(); if (!(op && op.prop)) pintarProps(); }),
    bus.on('doc:activo', () => { pintarNivel(); pintarProps(); }),
    bus.on('curso:cambio', pintarLeccion),
    bus.on('curso:mostrar', () => { mostrarBurbuja(true); }),
  ];
  return {
    destruir: () => { quitar.forEach(f => f()); partes.forEach(p => p.destruir && p.destruir()); cancelAnimationFrame(rafGuia); if (burbuja) burbuja.remove(); $$('.foco-guia').forEach(x => x.classList.remove('foco-guia')); },
  };
}
