// Ventana de prueba del juego (y reproductor de los juegos exportados).
import { icono, logo } from '../ui/iconos.js';
import { el, esc, $, $$, controlesVentana, barraArrastrable, menuBajo, activarGlobos } from '../ui/componentes.js';
import { Proyecto, sinExtension } from '../motor/proyecto.js';
import { Mundo } from '../motor/mundo.js';
import { aTexto } from '../aguila/index.js';
import { CALIDADES, NOMBRES_OPCION } from '../motor/graficos.js';

// La calidad que elige el jugador se recuerda por juego.
const claveCalidad = () => 'falcon-calidad:' + (proyecto?.datos?.nombre || 'juego');
function calidadGuardada() { try { return localStorage.getItem(claveCalidad()); } catch { return null; } }
function guardarCalidad(v) { try { localStorage.setItem(claveCalidad(), v); } catch {} }
const claveLumbre = () => 'falcon-lumbre:' + (proyecto?.datos?.nombre || 'juego');
function lumbreGuardada() { try { return localStorage.getItem(claveLumbre()) !== 'no'; } catch { return true; } }
function guardarLumbre(si) { try { localStorage.setItem(claveLumbre(), si ? 'si' : 'no'); } catch {} }

const falcon = window.falcon;
const q = new URLSearchParams(location.search);
const MODO = q.get('modo') || 'prueba';
const RESOLUCIONES = [[1280, 720], [1920, 1080], [960, 540], [640, 360], [800, 600]];
const VELOCIDADES = [0.25, 0.5, 1, 2];

let proyecto, mundo;
let observado = null;
let vivosActivos = true;
let ultimo = 0, fps = 0, acumFps = 0, cuadros = 0;
let pasoUnico = false;
let ajustes = {};

async function iniciar() {
  document.body.classList.toggle('exportado', MODO === 'exportado');
  activarGlobos();
  proyecto = new Proyecto(q.get('proyecto'));
  await proyecto.cargar();
  try { ajustes = (await falcon.app.datos()).ajustes || {}; } catch { ajustes = {}; }
  const escena = q.get('escena') || proyecto.datos.escena_principal;
  pintar(escena);
  document.title = proyecto.datos.nombre + (MODO === 'prueba' ? ' · Prueba' : '');
  if (MODO === 'exportado') falcon.ventana.titulo(proyecto.datos.nombre);

  mundo = new Mundo({
    proyecto, modo: MODO,
    lienzo: $('#lienzo'), lienzo3d: $('#lienzo3d'),
    informar: (m) => { if (MODO === 'prueba') falcon.juego.informar(m); if (m.tipo === 'escena') { $('.escena') && ($('.escena').textContent = sinExtension(m.escena)); setTimeout(pintarCalidad); } },
    alEstado: (e) => mostrarFinal(e),
    alError: (e) => mostrarError(e),
    alMostrar: () => {},
    calidad: calidadGuardada() || proyecto.datos.calidad_grafica || 'automatica',
    lumbre: lumbreGuardada(),
    alCalidad: () => pintarCalidad(),
  });
  window.__falconJuego = mundo;   // para los guiones de verificación (--guion)
  await mundo.iniciar();
  if (!escena) { mostrarError({ mensaje: 'El proyecto no tiene escena principal.', explicacion: 'Elige una en Proyecto › Ajustes del proyecto.' }); return; }
  await mundo.cargarEscena(escena);
  $('.cargando-juego')?.remove();
  observado = q.get('observar') || (mundo.buscarPorNombre('Jugador') ? 'Jugador' : null);
  if (MODO === 'prueba') falcon.juego.informar({ tipo: 'iniciado', escena });
  if (MODO === 'prueba') falcon.juego.alRecibir(recibir);
  $('#lienzo').focus();
  requestAnimationFrame(bucle);
  setInterval(enviarVivos, 250);
  setInterval(pintarCalidad, 1000);
  pintarCalidad();
  setTimeout(() => $('.pista-atajos')?.classList.add('fuera'), 4500);
  if (MODO === 'exportado') {
    try { const ex = JSON.parse(await proyecto.leer('.exportado.json')); if (ex.pantalla_completa) falcon.ventana.pantallaCompleta(); } catch {}
  }
}

function pintar(escena) {
  const app = $('#app');
  app.innerHTML = `
    <div class="barra-titulo">
      ${logo(22)}<span class="nombre">${esc(proyecto.datos.nombre)}</span><span class="prueba">PRUEBA</span><span class="escena">${esc(sinExtension(escena || ''))}</span>
    </div>
    <div class="herramientas">
      <div class="grupo">
        <button data-a="pausa" class="activo">${icono('pausa', '', 15)}<span>Pausar</span></button>
        <button data-a="paso" data-ayuda="Avanzar un fotograma">${icono('paso', '', 15)}</button>
        <button data-a="reiniciar" data-ayuda="Reiniciar la escena">${icono('reiniciar', '', 15)}</button>
        <button data-a="silencio" data-ayuda="Silenciar">${icono('altavoz', '', 15)}</button>
      </div>
      <button class="btn secundario peq" data-a="libre">${icono('camara', '', 16)}Cámara libre</button>
      <button class="btn contorno peq" data-a="vivos">${icono('check', '', 15)}Valores en vivo</button>
      <button class="btn secundario peq" data-a="velocidad">Velocidad 1×</button>
      <button class="btn secundario peq" data-a="resolucion">${proyecto.datos.resolucion.join(' × ')} ${icono('flechaAbajo', '', 14)}</button>
      <button class="btn secundario peq oculto" data-a="calidad" data-ayuda="Calidad gráfica (F10)">${icono('sol', '', 15)}<span>Calidad</span> ${icono('flechaAbajo', '', 14)}</button>
      <span class="fps">-- fps</span>
      <button class="btn principal peq" data-a="editor">${icono('flechaIzquierda', '', 16)}Volver al editor</button>
    </div>
    <div class="area" tabindex="-1">
      <canvas id="lienzo3d" class="oculto"></canvas>
      <canvas id="lienzo" tabindex="0"></canvas>
      <div class="cargando-juego"><span class="cargando"></span></div>
      <div class="pista-atajos"><span class="kbd">F7</span>pausar<span class="kbd">F8</span>detener<span class="kbd">F12</span>captura</div>
      <div class="errores-juego"></div>
      <div class="vivos ${MODO === 'prueba' ? '' : 'oculto'}">
        <div class="cab"><span class="punto"></span><span class="titulo">Valores en vivo</span><button data-a="min-vivos">${icono('menos', '', 14)}</button></div>
        <div class="filas"></div>
        <div class="nota">Puedes cambiar los valores en el editor mientras juegas.</div>
      </div>
    </div>`;
  const barra = $('.barra-titulo');
  barra.append(controlesVentana());
  barraArrastrable(barra);
  if (!ajustes.mostrarFps && ajustes.mostrarFps !== undefined) $('.fps').classList.add('oculto');
  $('[data-a=pausa]').onclick = () => pausar();
  $('[data-a=paso]').onclick = () => { if (!mundo.pausado) pausar(true); pasoUnico = true; };
  $('[data-a=reiniciar]').onclick = () => reiniciar();
  $('[data-a=silencio]').onclick = () => silenciar();
  $('[data-a=libre]').onclick = () => camaraLibre();
  $('[data-a=vivos]').onclick = () => { vivosActivos = !vivosActivos; $('[data-a=vivos]').classList.toggle('contorno', vivosActivos); $('[data-a=vivos]').classList.toggle('secundario', !vivosActivos); $('[data-a=vivos]').innerHTML = (vivosActivos ? icono('check', '', 15) : '') + 'Valores en vivo'; $('.vivos').classList.toggle('oculto', !vivosActivos); };
  $('[data-a=min-vivos]').onclick = () => $('.vivos').classList.toggle('min');
  $('[data-a=velocidad]').onclick = () => {
    const i = (VELOCIDADES.indexOf(mundo.velocidad) + 1) % VELOCIDADES.length;
    mundo.velocidad = VELOCIDADES[i];
    $('[data-a=velocidad]').textContent = `Velocidad ${String(mundo.velocidad).replace('.', ',')}×`;
  };
  $('[data-a=calidad]').onclick = (e) => menuBajo(e.currentTarget, opcionesCalidad());
  $('[data-a=resolucion]').onclick = (e) => menuBajo(e.currentTarget, RESOLUCIONES.map(r => ({
    texto: r.join(' × '), marcado: r[0] === mundo.resolucion[0] && r[1] === mundo.resolucion[1],
    accion: () => { mundo.resolucion = r; $('[data-a=resolucion]').innerHTML = `${r.join(' × ')} ${icono('flechaAbajo', '', 14)}`; falcon.ventana.tamanoContenido(r[0], r[1] + 92); },
  })));
  $('[data-a=editor]').onclick = () => falcon.ventana.enfocarEditor();
  window.addEventListener('keydown', teclas, true);
}

function teclas(e) {
  if (e.key === 'F7' || e.code === 'KeyP' && proyecto?.datos.cqb && !e.repeat && !e.target?.closest?.('input,textarea,select,[contenteditable=true]')) { e.preventDefault(); pausar(); }
  else if (e.key === 'F8' && MODO === 'prueba') { e.preventDefault(); falcon.ventana.cerrar(); }
  else if (e.key === 'F12') { e.preventDefault(); captura(); }
  else if (e.key === 'F11') { e.preventDefault(); falcon.ventana.pantallaCompleta(); }
  else if (e.key === 'F10') { e.preventDefault(); menuGraficos(); }
  else if (e.key === 'F5' && MODO === 'prueba') { e.preventDefault(); reiniciar(); }
}

function pausar(forzar) {
  mundo.pausado = forzar ?? !mundo.pausado;
  const b = $('[data-a=pausa]');
  b.innerHTML = mundo.pausado ? `${icono('play', '', 15)}<span>Seguir</span>` : `${icono('pausa', '', 15)}<span>Pausar</span>`;
  $('.pausa-velo')?.remove();
  if (mundo.pausado && document.pointerLockElement) document.exitPointerLock();
  if (mundo.pausado) $('.area').append(el(`<div class="pausa-velo"><div>${icono('pausa', '', 16)}En pausa · F7 para seguir</div></div>`));
  falcon.juego.informar({ tipo: 'estado', pausado: mundo.pausado });
}

async function reiniciar() {
  $('.final')?.remove();
  $('.errores-juego').innerHTML = '';
  mundo.errores = [];
  await mundo.reiniciar();
}

function silenciar() {
  const si = !mundo.audio.silencio;
  mundo.audio.silenciar(si);
  $('[data-a=silencio]').innerHTML = icono(si ? 'silencio' : 'altavoz', '', 15);
  $('[data-a=silencio]').classList.toggle('activo', si);
}

let arrastre = null;
async function camaraLibre() {
  const boton = $('[data-a=libre]');
  const area = $('.area');
  if (mundo.camaraLibre) {
    if (mundo.camaraLibre.controles) mundo.camaraLibre.controles.dispose();
    mundo.camaraLibre = null; boton.classList.remove('contorno'); boton.classList.add('secundario'); area.classList.remove('libre');
    return;
  }
  boton.classList.add('contorno'); boton.classList.remove('secundario'); area.classList.add('libre');
  if (mundo.d3) {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const base = mundo.d3.camaraUsada || mundo.d3.camaraPorDefecto;
    const cam = base.clone();
    const ctrl = new OrbitControls(cam, $('#lienzo'));
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    ctrl.target.copy(cam.position.clone().add(dir.multiplyScalar(8)));
    ctrl.update();
    mundo.camaraLibre = { camara3d: cam, controles: ctrl };
    return;
  }
  mundo.camaraLibre = { x: mundo.camara.x, y: mundo.camara.y, zoom: mundo.camara.zoom };
}

function prepararArrastre() {
  const lienzo = $('#lienzo');
  lienzo.addEventListener('mousedown', (e) => { if (mundo.camaraLibre && !mundo.d3) arrastre = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mousemove', (e) => {
    if (!arrastre || !mundo.camaraLibre || mundo.d3) return;
    const k = (mundo.dpr || 1) / mundo.vista.escala / mundo.camaraLibre.zoom;
    mundo.camaraLibre.x -= (e.clientX - arrastre.x) * k; mundo.camaraLibre.y -= (e.clientY - arrastre.y) * k;
    arrastre = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => { arrastre = null; });
  lienzo.addEventListener('wheel', (e) => {
    if (!mundo.camaraLibre || mundo.d3) return;
    e.preventDefault();
    mundo.camaraLibre.zoom = Math.max(0.1, Math.min(8, mundo.camaraLibre.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  }, { passive: false });
}

async function captura() {
  try {
    const f = await falcon.juego.captura(MODO === 'exportado' ? null : proyecto.ruta);
    mostrarMensaje('Captura guardada: ' + f.split(/[\\/]/).pop());
    falcon.juego.informar({ tipo: 'mostrar', texto: 'Captura guardada en ' + f });
  } catch (e) { mostrarMensaje('No se pudo guardar la captura'); }
}

function bucle(t) {
  const dt = ultimo ? (t - ultimo) / 1000 : 1 / 60;
  ultimo = t;
  if (mundo.pausado && pasoUnico) {
    pasoUnico = false;
    mundo.pausado = false;
    mundo.paso(1 / 60);
    mundo.pausado = true;
  } else mundo.paso(dt);
  if (mundo.camaraLibre && mundo.camaraLibre.controles) mundo.camaraLibre.controles.update();
  acumFps += dt; cuadros++;
  if (acumFps >= 0.5) { fps = Math.round(cuadros / acumFps); acumFps = 0; cuadros = 0; const f = $('.fps'); if (f) f.textContent = `${fps} fps`; }
  requestAnimationFrame(bucle);
}

function enviarVivos() {
  if (!mundo || !mundo.raiz) return;
  const nombres = new Set([observado, 'Jugador'].filter(Boolean));
  for (const n of nombres) {
    const v = mundo.valoresVivos(n);
    if (!v) continue;
    if (MODO === 'prueba') falcon.juego.informar({ tipo: 'vivos', ...v });
    if (n === observado && vivosActivos) pintarVivos(v);
  }
  if (!observado || !mundo.buscarPorNombre(observado)) $('.vivos .filas').innerHTML = '<div class="fila"><span class="n">Selecciona un nodo en el editor</span></div>';
}

function pintarVivos(v) {
  $('.vivos .titulo').textContent = `Valores en vivo · ${v.nodo}`;
  $('.vivos .filas').innerHTML = v.valores.map(x => {
    const clase = x.tipo === 'entero' ? 'entero' : x.tipo === 'sí/no' ? 'si' : x.tipo === 'texto' ? 'texto' : '';
    return `<div class="fila"><span class="n">${esc(x.nombre)}</span><span class="v ${clase}">${esc(x.valor)}</span></div>`;
  }).join('');
}

function mostrarError(e) {
  const caja = $('.errores-juego');
  if (!caja) return;
  const d = el(`<div class="error-juego"><b>${esc(e.archivo ? e.archivo.split('/').pop() + (e.linea ? ' · línea ' + e.linea : '') : 'Error')}</b>${esc(e.mensaje)}${e.explicacion ? `<br><span>${esc(e.explicacion)}</span>` : ''}</div>`);
  caja.append(d);
  while (caja.children.length > 3) caja.firstChild.remove();
  setTimeout(() => d.remove(), 9000);
}

function mostrarMensaje(t) {
  const caja = $('.errores-juego');
  const d = el(`<div class="mensaje-juego">${esc(t)}</div>`);
  caja.append(d);
  setTimeout(() => d.remove(), 3000);
}

function mostrarFinal(estado) {
  $('.final')?.remove();
  if (estado === 'jugando') return;
  const gana = estado === 'ganado';
  const puntos = mundo.interp.globales.vars.get('puntos') || 0;
  const d = el(`<div class="final"><div class="tarjeta ${gana ? 'gana' : 'pierde'}">
    <h2>${gana ? '¡Has ganado!' : 'Fin de la partida'}</h2>
    <p>${gana ? 'Nivel completado' : 'Inténtalo otra vez'}${puntos ? ` · ${puntos} puntos` : ''}</p>
    <div class="botones"><button class="btn principal grande" data-a="otra">${icono('reiniciar', '', 16)}Jugar otra vez</button>
    ${MODO === 'prueba' ? `<button class="btn secundario grande" data-a="volver">${icono('flechaIzquierda', '', 16)}Volver al editor</button>` : ''}</div>
  </div></div>`);
  $('.area').append(d);
  d.querySelector('[data-a=otra]').onclick = () => { mundo.interp.globales.vars.set('puntos', 0); mundo.puntosIniciales = 0; reiniciar(); };
  const v = d.querySelector('[data-a=volver]');
  if (v) v.onclick = () => falcon.ventana.cerrar();
}

// ---------- Calidad gráfica ----------
function opcionesCalidad() {
  return ['automatica', 'baja', 'media', 'alta', 'ultra'].map(k => ({
    texto: k === 'automatica' ? `Automática${mundo.calidadOpcion === 'automatica' && mundo.calidadNivel ? ' · ' + CALIDADES[mundo.calidadNivel].nombre : ''}` : `${NOMBRES_OPCION[k]} · ${CALIDADES[k].descripcion}`,
    marcado: mundo.calidadOpcion === k,
    accion: () => elegirCalidad(k),
  }));
}

function elegirCalidad(k) {
  mundo.fijarCalidad(k);
  guardarCalidad(k);
  pintarCalidad();
  mostrarMensaje(`Calidad gráfica: ${NOMBRES_OPCION[k]}${k === 'automatica' && mundo.calidadNivel ? ' (' + CALIDADES[mundo.calidadNivel].nombre + ')' : ''}`);
}

function pintarCalidad() {
  const b = $('[data-a=calidad]');
  if (!b || !mundo) return;
  b.classList.toggle('oculto', !mundo.d3);
  if (!mundo.d3) return;
  const nivel = mundo.calidadNivel ? CALIDADES[mundo.calidadNivel].nombre : '';
  b.querySelector('span').textContent = mundo.calidadOpcion === 'automatica' ? `Calidad: ${nivel} (auto)` : `Calidad: ${nivel}`;
  b.dataset.ayuda = (mundo.d3.lumbre ? mundo.d3.lumbre.descripcion() : '') + ' · F10';
}

// Menú de gráficos para el jugador (F10), también en los juegos exportados.
function menuGraficos() {
  if (!mundo || !mundo.d3) { mostrarMensaje('La calidad gráfica solo afecta a las escenas 3D'); return; }
  const previo = $('.menu-graficos');
  if (previo) { previo.remove(); return; }
  const d = el(`<div class="final menu-graficos"><div class="tarjeta" style="min-width:420px;text-align:left">
    <h2 style="font-size:22px;margin-bottom:4px">Gráficos</h2><p style="margin:0 0 16px">${esc(mundo.d3.lumbre ? mundo.d3.lumbre.descripcion() : '')}</p>
    <div class="opciones-graficos" style="display:flex;flex-direction:column;gap:6px"></div>
    <div class="botones" style="margin-top:18px;justify-content:flex-end"><button class="btn principal">Cerrar</button></div></div></div>`);
  const lista = d.querySelector('.opciones-graficos');
  const pintar = () => {
    lista.innerHTML = '';
    if (mundo.lumbrePermitida) {
      const on = mundo.lumbreActivada;
      const b = el(`<button class="btn ${on ? 'contorno' : 'secundario'}" style="justify-content:flex-start;height:42px;margin-bottom:8px">${on ? icono('check', '', 15) : '<span style="width:15px"></span>'}Lumbre (iluminación global, reflejos y espejos): ${on ? 'activada' : 'desactivada'}</button>`);
      b.onclick = () => { mundo.fijarLumbre(!on); guardarLumbre(!on); pintar(); pintarCalidad(); d.querySelector('p').textContent = mundo.d3.lumbre.descripcion(); mostrarMensaje(`Lumbre ${!on ? 'activada' : 'desactivada'}`); };
      lista.append(b);
    }
    for (const o of opcionesCalidad()) {
      const b = el(`<button class="btn ${o.marcado ? 'contorno' : 'secundario'}" style="justify-content:flex-start;height:42px">${o.marcado ? icono('check', '', 15) : '<span style="width:15px"></span>'}${esc(o.texto)}</button>`);
      b.onclick = () => { o.accion(); pintar(); d.querySelector('p').textContent = mundo.d3.lumbre.descripcion(); };
      lista.append(b);
    }
  };
  pintar();
  d.querySelector('.botones .btn').onclick = () => d.remove();
  $('.area').append(d);
}

// Mensajes del editor
function recibir(m) {
  switch (m.tipo) {
    case 'pausa': pausar(m.valor); break;
    case 'reiniciar': reiniciar(); break;
    case 'observar': observado = m.nombre; enviarVivos(); break;
    case 'propiedad': mundo.aplicarPropiedad(m.id, m.clave, m.valor); break;
    case 'exportado': mundo.aplicarExportado(m.id, m.nombre, m.valor); break;
    case 'script': if (mundo.recargarScript(m.archivo, m.texto)) falcon.juego.informar({ tipo: 'mostrar', texto: `Recargado ${m.archivo} en el juego` }); break;
    case 'colisiones': mundo.mostrarColisiones = !!m.valor; break;
    case 'calidad': elegirCalidad(m.valor); break;
    case 'evaluar':
      try {
        const r = mundo.evaluar(m.codigo, observado);
        falcon.juego.informar({ tipo: 'resultado', id: m.id, texto: r === undefined ? '' : aTexto(r, true) });
      } catch (e) { falcon.juego.informar({ tipo: 'resultado', id: m.id, error: e.mensajeCompleto || e.message }); }
      break;
  }
}

iniciar().then(prepararArrastre).catch((e) => {
  console.error(e);
  document.body.innerHTML = `<div style="padding:30px;color:#F07A7A;font:14px Manrope">No se pudo iniciar el juego: ${esc(e.mensajeCompleto || e.message)}</div>`;
  if (MODO === 'prueba') falcon.juego.informar({ tipo: 'error', error: { mensaje: 'No se pudo iniciar el juego: ' + (e.mensajeCompleto || e.message), linea: e.linea, archivo: e.archivo } });
});

