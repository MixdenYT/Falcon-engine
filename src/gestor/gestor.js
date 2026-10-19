// Gestor de proyectos de Falcon Engine.
import { icono, logo } from '../ui/iconos.js';
import { el, esc, $, $$, dialogo, confirmar, avisar, menu, controlesVentana, barraArrastrable, activarGlobos, hace, urlArchivo, interruptor } from '../ui/componentes.js';
import { PLANTILLAS, crearProyecto } from '../motor/plantillas.js';
import { GUIAS } from '../ui/guias.js';
import { LECCIONES } from '../editor/lecciones.js';
import { tarjetaApoyo, botonApoyo, iniciarComunidad } from './comunidad.js';

const falcon = window.falcon;
let info, datos;
let vista = 'proyectos';
let filtro = '';

const AJUSTES_DEF = {
  carpetaProyectos: '', modoPorDefecto: 'avanzado', abrirUltimo: false, autoguardado: true,
  intervaloAutoguardado: 2, tamFuenteCodigo: 14, mostrarFps: true, cuadricula: 32,
};

async function iniciar() {
  info = await falcon.app.info();
  datos = await falcon.app.datos();
  datos.ajustes = { ...AJUSTES_DEF, ...(datos.ajustes || {}) };
  if (!datos.ajustes.carpetaProyectos) datos.ajustes.carpetaProyectos = info.documentos.replace(/\\/g, '/') + '/Falcon Engine Proyectos';
  activarGlobos();
  pintarMarco();
  await comprobarRecientes();
  pintar();
  iniciarComunidad();
  if (datos.ajustes.abrirUltimo && datos.recientes[0] && !sessionStorage.getItem('falcon-ya-abierto')) {
    sessionStorage.setItem('falcon-ya-abierto', '1');
    if (await falcon.fs.existe(datos.recientes[0].ruta)) falcon.app.abrirProyecto(datos.recientes[0].ruta);
  }
  sessionStorage.setItem('falcon-ya-abierto', '1');
}

async function guardarDatos() { await falcon.app.guardarDatos(datos); }

async function comprobarRecientes() {
  for (const r of datos.recientes || []) {
    r._existe = await falcon.fs.existe(r.ruta);
    r._miniatura = r._existe && await falcon.fs.existe(r.ruta + '/.falcon/miniatura.png');
  }
}

function pintarMarco() {
  const app = $('#app');
  app.innerHTML = `
    <div class="barra-titulo">
      <div class="marca">${logo(24)}<span>Falcon Engine</span><span class="sub">Gestor de proyectos</span></div>
    </div>
    <div class="marco">
      <aside class="lateral">
        <div class="marca-grande">${logo(40)}<div><b>Falcon</b><span>ENGINE</span></div></div>
        <nav class="nav">
          <button data-vista="proyectos">${icono('carpeta')}Proyectos</button>
          <button data-vista="plantillas">${icono('plantillas')}Plantillas</button>
          <button data-vista="aprender">${icono('libro')}Aprender</button>
          <button data-vista="ajustes">${icono('ajustes')}Ajustes</button>
        </nav>
        ${tarjetaApoyo()}
        <div class="aviso-talon" role="button" style="cursor:pointer">
          <b>¿Venías de Talon Engine?</b>
          <p>Tus proyectos anteriores se abren sin conversión. Falcon los reconoce automáticamente.</p>
        </div>
        <div class="version">Falcon Engine ${esc(info.version)}<button class="buscar-actualizaciones" data-comunidad="actualizar">Buscar actualizaciones</button></div>
      </aside>
      <main class="contenido"><div class="contenido-interior"></div></main>
    </div>`;
  const barra = $('.barra-titulo', app);
  barra.append(controlesVentana());
  barraArrastrable(barra);
  $$('.nav button', app).forEach(b => b.onclick = () => { vista = b.dataset.vista; pintar(); });
  $('.aviso-talon', app).onclick = () => abrirProyectoDialogo('Abre la carpeta de tu proyecto de Talon Engine');
}

function pintar() {
  $$('.nav button').forEach(b => b.classList.toggle('activo', b.dataset.vista === vista));
  const c = $('.contenido-interior');
  ({ proyectos: vistaProyectos, plantillas: vistaPlantillas, aprender: vistaAprender, ajustes: vistaAjustes })[vista](c);
  $('.contenido').scrollTop = 0;
}

// ---------- Ilustraciones de miniatura ----------
function ilustracion(tipo, variante = 0) {
  const v = variante % 4;
  if (tipo === '3D') {
    if (v % 2 === 0) return `<svg viewBox="0 0 260 128" preserveAspectRatio="xMidYMid slice"><rect width="260" height="128" fill="#121715"/><path d="M60 50 130 22 200 50 200 112 130 140 60 112Z" fill="#26302B"/><path d="M60 50 130 78 200 50M130 78V140" stroke="#5E6E66" stroke-width="2" fill="none"/><path d="M60 50 130 22 200 50" stroke="#5E6E66" stroke-width="2" fill="none"/><path d="M130 22v56" stroke="#5E6E66" stroke-width="1.5"/></svg>`;
    return `<svg viewBox="0 0 260 128" preserveAspectRatio="xMidYMid slice"><rect width="260" height="128" fill="#121715"/><path d="M0 128 260 92V128Z" fill="#1E2722"/><circle cx="90" cy="68" r="18" fill="none" stroke="#5E6E66" stroke-width="2"/><rect x="168" y="38" width="30" height="30" fill="none" stroke="#5E6E66" stroke-width="2"/></svg>`;
  }
  if (v === 1) return `<svg viewBox="0 0 260 128" preserveAspectRatio="xMidYMid slice"><rect width="260" height="128" fill="#16140E"/><rect x="30" y="30" width="50" height="48" fill="#3A3420"/><rect x="104" y="30" width="50" height="48" fill="#3A3420"/><rect x="178" y="30" width="50" height="48" fill="#3A3420"/><path d="M30 98H230" stroke="#B9A35B" stroke-width="2.5"/></svg>`;
  if (v === 2) return `<svg viewBox="0 0 260 128" preserveAspectRatio="xMidYMid slice"><rect width="260" height="128" fill="#101A16"/><circle cx="70" cy="60" r="14" fill="#2D6E4C"/><circle cx="190" cy="40" r="9" fill="#F2C46D"/><circle cx="210" cy="90" r="9" fill="#F2C46D"/><rect x="120" y="70" width="24" height="24" rx="5" fill="#B04A6A"/></svg>`;
  return `<svg viewBox="0 0 260 128" preserveAspectRatio="xMidYMid slice"><rect width="260" height="128" fill="#122019"/><path d="M0 128V96H60V78H120V96H180V58H260V128Z" fill="#245A3C"/><path d="M22 68a22 22 0 0 1 38 0" stroke="#3DDC84" stroke-width="3" fill="none"/><path d="M200 40l10-10 10 10" stroke="#3DDC84" stroke-width="3" fill="none"/></svg>`;
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

// ---------- Vista Proyectos ----------
function vistaProyectos(c) {
  c.innerHTML = `
    <header class="cabecera">
      <div><h1>Hola, ¿qué vamos a crear hoy?</h1><p>Empieza un proyecto nuevo o continúa donde lo dejaste.</p></div>
      <div class="acciones">
        ${botonApoyo()}
        <button class="btn secundario" data-a="importar">${icono('descargar', '', 17)}Importar</button>
        <button class="btn secundario" data-a="abrir">${icono('carpeta', '', 17)}Abrir proyecto</button>
        <button class="btn principal" data-a="nuevo">${icono('mas', '', 17)}Nuevo proyecto</button>
      </div>
    </header>
    <section class="tipos">
      <button class="tipo destacado" data-t="vacio2d"><div class="icono-tipo" style="color:var(--turquesa)">${icono('imagen', '', 22)}</div><div><b>Juego 2D</b><span>Sprites, mosaicos y física 2D</span></div></button>
      <button class="tipo" data-t="vacio3d"><div class="icono-tipo" style="color:var(--ambar)">${icono('cubo', '', 22)}</div><div><b>Juego 3D</b><span>Mallas, luces y cámara en primera o tercera persona</span></div></button>
      <button class="tipo" data-t="plantilla"><div class="icono-tipo" style="color:var(--verde)">${icono('blueprint', '', 22)}</div><div><b>Desde plantilla</b><span>Plataformas, top-down o puzzle, con Blueprints listos</span></div></button>
    </section>
    <div class="titulo-lista">
      <h2>Proyectos recientes</h2>
      <div class="buscador">${icono('buscar', '', 16)}<input class="campo" placeholder="Buscar proyectos" value="${esc(filtro)}"></div>
    </div>
    <section class="proyectos"></section>
    <section class="pasos">
      <div class="paso"><span class="num">1</span>Crea una escena y añade tu primer personaje</div>
      <div class="paso"><span class="num">2</span>Dale movimiento con un Blueprint, sin escribir código</div>
      <div class="paso"><span class="num">3</span>Pulsa Probar (F5) y juega al instante</div>
    </section>`;
  $('[data-a=nuevo]', c).onclick = () => nuevoProyecto();
  $('[data-a=abrir]', c).onclick = () => abrirProyectoDialogo();
  $('[data-a=importar]', c).onclick = () => importarProyecto();
  $$('.tipo', c).forEach(b => b.onclick = () => b.dataset.t === 'plantilla' ? (vista = 'plantillas', pintar()) : nuevoProyecto(b.dataset.t));
  const busc = $('.buscador input', c);
  busc.oninput = () => { filtro = busc.value; pintarRecientes($('.proyectos', c)); };
  pintarRecientes($('.proyectos', c));
}

function pintarRecientes(cont) {
  const lista = (datos.recientes || []).filter(r => !filtro || (r.nombre + ' ' + r.ruta).toLowerCase().includes(filtro.toLowerCase()));
  cont.innerHTML = '';
  if (!lista.length) {
    cont.replaceWith(el(`<section class="proyectos" style="display:block"><div class="vacio-proyectos"><b>${filtro ? 'Ningún proyecto coincide con la búsqueda' : 'Todavía no hay proyectos'}</b>${filtro ? 'Prueba con otro nombre.' : 'Crea uno nuevo o abre una carpeta con un proyecto de Falcon o Talon.'}</div></section>`));
    return;
  }
  lista.forEach((r, i) => {
    const t = r.tipo === '3D' ? '3D' : '2D';
    const mini = r._miniatura ? `<img src="${urlArchivo(r.ruta + '/.falcon/miniatura.png')}?v=${r.abierto}" alt="">` : ilustracion(t, hash(r.nombre));
    const motor = !r._existe ? 'No se encuentra' : r.talon ? 'Proyecto Talon · compatible' : 'Falcon';
    const tarjeta = el(`<article class="proyecto ${i === 0 && !filtro ? 'primero' : ''} ${r._existe ? '' : 'perdido'}">
      <div class="miniatura">${mini}<span class="dim ${t === '2D' ? 'd2' : ''}">${t}</span></div>
      <button class="btn-icono peq mas" aria-label="Más opciones">${icono('puntos', '', 16)}</button>
      <div class="info">
        <div class="nombre">${esc(r.nombre)}</div>
        <div class="ruta" title="${esc(r.ruta)}">${esc(rutaCorta(r.ruta))}</div>
        <div class="pie"><span>${esc(hace(r.abierto))}</span><span class="motor ${r.talon ? 'talon' : ''}">${esc(motor)}</span></div>
      </div>
    </article>`);
    tarjeta.onclick = (e) => { if (!e.target.closest('.mas')) abrir(r); };
    const opciones = (x, y) => menu(x, y, [
      { texto: 'Abrir', icono: 'carpetaAbierta', accion: () => abrir(r), desactivado: !r._existe },
      { texto: 'Mostrar en la carpeta', icono: 'carpeta', accion: () => falcon.sistema.mostrarEnCarpeta(r.ruta), desactivado: !r._existe },
      '-',
      { texto: 'Quitar de la lista', icono: 'cerrar', accion: () => quitarReciente(r) },
      { texto: 'Mover a la papelera…', icono: 'papelera', peligro: true, desactivado: !r._existe, accion: () => borrarProyecto(r) },
    ]);
    tarjeta.querySelector('.mas').onclick = (e) => { e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); opciones(b.left, b.bottom + 4); };
    tarjeta.oncontextmenu = (e) => { e.preventDefault(); opciones(e.clientX, e.clientY); };
    cont.append(tarjeta);
  });
}

function rutaCorta(ruta) {
  const r = ruta.replace(/\\/g, '/');
  const usuario = info.inicio.replace(/\\/g, '/');
  return r.startsWith(usuario) ? r.replace(usuario, usuario.replace(/[^/]+$/, info.usuario)) : r;
}

async function abrir(r) {
  if (!(await falcon.fs.existe(r.ruta))) {
    if (await confirmar({ titulo: 'No se encuentra el proyecto', mensaje: `La carpeta ${r.ruta} ya no existe o se ha movido. ¿Quieres quitarlo de la lista?`, aceptar: 'Quitar' })) quitarReciente(r);
    return;
  }
  falcon.app.abrirProyecto(r.ruta);
}

async function quitarReciente(r) {
  datos.recientes = datos.recientes.filter(x => x !== r);
  await guardarDatos();
  pintar();
}

async function borrarProyecto(r) {
  const ok = await confirmar({ titulo: `¿Mover «${r.nombre}» a la papelera?`, mensaje: `Se enviará la carpeta ${r.ruta} a la papelera del sistema. Podrás recuperarla desde allí.`, aceptar: 'Mover a la papelera', peligro: true });
  if (!ok) return;
  await falcon.fs.borrar(r.ruta);
  await quitarReciente(r);
  avisar('Proyecto enviado a la papelera');
}

async function abrirProyectoDialogo(titulo = 'Abrir proyecto') {
  const ruta = await falcon.dialogo.carpeta({ titulo, ruta: datos.ajustes.carpetaProyectos });
  if (!ruta) return;
  const f = await falcon.app.archivoProyecto(ruta);
  if (!(await falcon.fs.existe(f))) {
    avisar('Esa carpeta no contiene un proyecto de Falcon ni de Talon (falta proyecto.falcon).', 'error', 4500);
    return;
  }
  falcon.app.abrirProyecto(ruta);
}

async function importarProyecto() {
  const origen = await falcon.dialogo.carpeta({ titulo: 'Elige la carpeta del proyecto que quieres importar' });
  if (!origen) return;
  const f = await falcon.app.archivoProyecto(origen);
  if (!(await falcon.fs.existe(f))) { avisar('Esa carpeta no contiene un proyecto de Falcon ni de Talon.', 'error', 4500); return; }
  const nombre = origen.replace(/\\/g, '/').split('/').pop();
  let destino = datos.ajustes.carpetaProyectos + '/' + nombre;
  let n = 2;
  while (await falcon.fs.existe(destino)) destino = datos.ajustes.carpetaProyectos + '/' + nombre + ' ' + n++;
  const r = await dialogo({
    titulo: 'Importar proyecto',
    sub: 'Se hará una copia del proyecto dentro de tu carpeta de proyectos. El original no se toca.',
    contenido: `<div class="fila"><label class="etiqueta-campo">Origen</label><div class="ruta-final">${esc(origen)}</div></div><div class="fila"><label class="etiqueta-campo">Se copiará en</label><div class="ruta-final">${esc(destino)}</div></div>`,
    botones: [{ texto: 'Cancelar', valor: false }, { texto: 'Abrir sin copiar', valor: 'abrir' }, { texto: 'Importar copia', tipo: 'principal', valor: true }],
  });
  if (!r) return;
  if (r === 'abrir') { falcon.app.abrirProyecto(origen); return; }
  await falcon.fs.crearCarpeta(datos.ajustes.carpetaProyectos);
  await falcon.fs.copiar(origen, destino);
  avisar('Proyecto importado');
  falcon.app.abrirProyecto(destino);
}

// ---------- Nuevo proyecto ----------
async function nuevoProyecto(idPlantilla = 'vacio2d') {
  let elegida = idPlantilla;
  let modo = idPlantilla === 'curso' ? 'sencillo' : datos.ajustes.modoPorDefecto;
  const p0 = PLANTILLAS.find(p => p.id === idPlantilla);
  const nombreInicial = p0 && !p0.basica ? (p0.id === 'plataformas' ? 'Mi plataformas' : p0.nombre) : 'Mi juego';
  const contenido = el(`<div>
    <div class="fila"><label class="etiqueta-campo">Nombre del proyecto</label><input class="campo" data-c="nombre" value="${esc(nombreInicial)}"></div>
    <div class="fila"><label class="etiqueta-campo">Plantilla</label><div class="elegir-plantilla">${PLANTILLAS.map(p => `
      <button class="opcion-plantilla ${p.id === elegida ? 'activo' : ''}" data-p="${p.id}">
        <span class="ic" style="color:${p.tipo === '3D' ? 'var(--ambar)' : 'var(--turquesa)'}">${icono(p.icono, '', 18)}</span>
        <span><b>${esc(p.nombre)} <small style="color:var(--texto-3);font-weight:700">${p.tipo}</small></b><span>${esc(p.descripcion)}</span></span>
      </button>`).join('')}</div></div>
    <div class="fila"><label class="etiqueta-campo">Modo del editor</label>
      <div class="segmentado" data-c="modo"><button data-m="sencillo">Sencillo</button><button data-m="avanzado">Avanzado</button></div>
      <div style="color:var(--texto-3);font-size:12px;margin-top:6px">El modo Sencillo muestra lo esencial y un curso guiado. Puedes cambiarlo cuando quieras.</div>
    </div>
    <div class="fila"><label class="etiqueta-campo">Ubicación</label>
      <div class="fila-flex"><input class="campo mono" data-c="carpeta" value="${esc(datos.ajustes.carpetaProyectos)}"><button class="btn secundario" data-c="examinar">${icono('carpeta', '', 16)}Examinar</button></div>
      <div class="ruta-final"></div>
    </div>
    <div class="progreso-crear oculto"><span class="cargando"></span><span class="txt">Creando…</span></div>
  </div>`);
  const nombre = $('[data-c=nombre]', contenido), carpeta = $('[data-c=carpeta]', contenido), rutaFinal = $('.ruta-final', contenido);
  const limpio = (s) => s.trim().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ');
  const actualizar = () => {
    rutaFinal.textContent = carpeta.value.replace(/\\/g, '/').replace(/\/$/, '') + '/' + (limpio(nombre.value) || '…');
    $$('[data-m]', contenido).forEach(b => b.classList.toggle('activo', b.dataset.m === modo));
    $$('.opcion-plantilla', contenido).forEach(b => b.classList.toggle('activo', b.dataset.p === elegida));
  };
  nombre.oninput = carpeta.oninput = actualizar;
  $$('[data-m]', contenido).forEach(b => b.onclick = () => { modo = b.dataset.m; actualizar(); });
  $$('.opcion-plantilla', contenido).forEach(b => b.onclick = () => {
    elegida = b.dataset.p;
    if (elegida === 'curso') modo = 'sencillo';
    actualizar();
  });
  $('[data-c=examinar]', contenido).onclick = async () => {
    const r = await falcon.dialogo.carpeta({ titulo: 'Dónde guardar el proyecto', ruta: carpeta.value });
    if (r) { carpeta.value = r.replace(/\\/g, '/'); actualizar(); }
  };
  actualizar();
  await dialogo({
    titulo: 'Nuevo proyecto', ancho: 640, contenido,
    botones: [
      { texto: 'Cancelar', valor: null },
      {
        texto: 'Crear proyecto', tipo: 'principal', accion: async (d) => {
          const n = limpio(nombre.value);
          if (!n) { avisar('Ponle un nombre al proyecto.', 'error'); nombre.focus(); return false; }
          const destino = carpeta.value.replace(/\\/g, '/').replace(/\/$/, '') + '/' + n;
          if (await falcon.fs.existe(destino + '/proyecto.falcon')) { avisar('Ya existe un proyecto con ese nombre en esa carpeta.', 'error'); return false; }
          const prog = $('.progreso-crear', contenido);
          prog.classList.remove('oculto');
          $$('.acciones button', d).forEach(b => b.disabled = true);
          try {
            const ruta = await crearProyecto(destino, n, elegida, (t) => { $('.txt', prog).textContent = t; });
            // Ajusta el modo del editor elegido.
            const f = ruta + '/proyecto.falcon';
            const pd = JSON.parse(await falcon.fs.leer(f));
            pd.modo_editor = modo;
            await falcon.fs.escribir(f, JSON.stringify(pd, null, 2));
            if (carpeta.value !== datos.ajustes.carpetaProyectos) { datos.ajustes.carpetaProyectos = carpeta.value.replace(/\\/g, '/'); await guardarDatos(); }
            falcon.app.abrirProyecto(ruta);
          } catch (e) {
            console.error(e);
            avisar('No se pudo crear el proyecto: ' + e.message, 'error', 6000);
            prog.classList.add('oculto');
            $$('.acciones button', d).forEach(b => b.disabled = false);
            return false;
          }
          return true;
        },
      },
    ],
  });
}

// ---------- Vista Plantillas ----------
const ILUSTRACION_PLANTILLA = {
  academia_blueprints: () => `<svg viewBox="0 0 360 150"><rect width="360" height="150" fill="#10231C"/><path d="M92 65H157V102H230M92 65H230V38" stroke="#4FD1C5" stroke-width="3" fill="none"/><g fill="#284E3B" stroke="#5DDC9B"><rect x="30" y="45" width="90" height="40" rx="7"/><rect x="230" y="18" width="100" height="40" rx="7"/><rect x="230" y="82" width="100" height="40" rx="7"/></g><g fill="#E7EDE9" font-family="sans-serif" font-size="13"><text x="45" y="70">Evento</text><text x="245" y="43">Condición</text><text x="245" y="107">Acción</text><text x="30" y="140">63 bloques · aprende probando</text></g></svg>`,
  shooter_tercera: () => `<svg viewBox="0 0 360 150"><rect width="360" height="150" fill="#87ABBA"/><path d="M0 82H360V150H0Z" fill="#355B49"/><path d="M150 150 173 82H190L230 150" fill="#929782"/><path d="M30 100V48H103V100ZM257 100V30H330V100Z" fill="#52788B"/><path d="M210 107H267V126H210Z" fill="#B7A17B"/><circle cx="153" cy="100" r="9" fill="#61C8C0"/><path d="M145 112H162V146H145Z" fill="#61C8C0"/><path d="M175 75h10m-5-5v10" stroke="white"/><circle cx="195" cy="92" r="5" fill="#F36B64"/></svg>`,
  shooter_primera: () => `<svg viewBox="0 0 360 150"><rect width="360" height="150" fill="#172830"/><path d="M0 0 138 50V100L0 150ZM360 0 222 50V100L360 150Z" fill="#506879"/><path d="M0 150 138 100H222L360 150" fill="#414953"/><path d="M35 115V45L87 54V108ZM273 108V54L325 45V115Z" fill="#0C1C24"/><path d="M175 75h10m-5-5v10" stroke="#E7EDE9" stroke-width="2"/><rect x="167" y="88" width="18" height="28" fill="#F36B64"/><path d="M155 30H205" stroke="#A3DFFF" stroke-width="5"/></svg>`,
  vacio2d: () => ilustracion('2D', 0), vacio3d: () => ilustracion('3D', 0), plataformas: () => ilustracion('2D', 0),
  topdown: () => ilustracion('2D', 2), puzzle: () => ilustracion('2D', 1), mazmorra: () => ilustracion('3D', 0), curso: () => ilustracion('2D', 0),
};

function vistaPlantillas(c) {
  c.innerHTML = `
    <header class="cabecera"><div><h1>Plantillas</h1><p>Proyectos completos para empezar: con escenas, Blueprints, scripts en Águila, sprites y sonidos.</p></div></header>
    <section class="plantillas">${PLANTILLAS.map(p => `
      <article class="plantilla">
        <div class="miniatura">${ILUSTRACION_PLANTILLA[p.id]?.() || ilustracion(p.tipo)}</div>
        <div class="info"><b>${esc(p.nombre)}</b><p>${esc(p.descripcion)}</p>
          <div class="fila-flex"><span class="etiqueta-plantilla">${p.tipo}${p.etiqueta ? ' · ' + esc(p.etiqueta) : ''}</span><button class="btn principal peq" data-p="${p.id}">Usar plantilla</button></div>
        </div>
      </article>`).join('')}
    </section>`;
  $$('[data-p]', c).forEach(b => b.onclick = () => nuevoProyecto(b.dataset.p));
}

// ---------- Vista Aprender ----------
function vistaAprender(c) {
  c.innerHTML = `
    <header class="cabecera"><div><h1>Aprender</h1><p>Un curso guiado dentro del editor y guías para consultar cuando quieras.</p></div></header>
    <section class="curso">
      <div style="flex:1">
        <h3>Curso · Mi primer juego</h3>
        <p>${LECCIONES.length} lecciones cortas en el modo Sencillo: mueves al personaje, le haces saltar con un Blueprint, recoges monedas, escribes tu primera línea de Águila y exportas el juego.</p>
        <div class="lecciones-mini">${LECCIONES.map((l, i) => `<span>${i + 1}. ${esc(l.titulo)}</span>`).join('')}</div>
      </div>
      <button class="btn principal grande" data-a="curso">${icono('play', '', 16)}Empezar el curso</button>
    </section>
    <div class="titulo-lista"><h2>Guías</h2></div>
    <section class="guias">${GUIAS.map(g => `<article class="guia" data-g="${g.id}"><b>${icono(g.icono, '', 18)}${esc(g.titulo)}</b><p>${esc(g.resumen)}</p></article>`).join('')}</section>`;
  $('[data-a=curso]', c).onclick = () => nuevoProyecto('curso');
  $$('.guia', c).forEach(g => g.onclick = () => abrirGuia(g.dataset.g));
}

export function abrirGuia(id) {
  const g = GUIAS.find(x => x.id === id);
  dialogo({ titulo: g.titulo, ancho: 720, contenido: `<div class="lector">${g.html}</div>`, botones: [{ texto: 'Cerrar', tipo: 'principal', valor: true }] });
}

// ---------- Vista Ajustes ----------
function vistaAjustes(c) {
  const a = datos.ajustes;
  c.innerHTML = `
    <header class="cabecera"><div><h1>Ajustes</h1><p>Preferencias generales de Falcon Engine en este equipo.</p></div></header>
    <section class="ajustes">
      <div class="ajuste"><div class="texto-ajuste"><b>Carpeta de proyectos</b><span>Donde se crean los proyectos nuevos e importados.</span></div>
        <div class="control"><input class="campo mono" data-k="carpetaProyectos" value="${esc(a.carpetaProyectos)}"><button class="btn secundario peq" data-a="carpeta">Cambiar</button></div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Modo del editor por defecto</b><span>Para proyectos nuevos. Sencillo muestra lo esencial.</span></div>
        <div class="control"><div class="segmentado peq" data-k="modoPorDefecto"><button data-v="sencillo">Sencillo</button><button data-v="avanzado">Avanzado</button></div></div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Guardado automático</b><span>Guarda las escenas y scripts abiertos cada pocos minutos.</span></div>
        <div class="control">${interruptor(a.autoguardado, '', 'autoguardado')}<select class="campo" data-k="intervaloAutoguardado" style="width:120px">${[1, 2, 5, 10].map(m => `<option value="${m}" ${a.intervaloAutoguardado == m ? 'selected' : ''}>cada ${m} min</option>`).join('')}</select></div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Abrir el último proyecto al iniciar</b><span>Salta el gestor y continúa donde lo dejaste.</span></div>
        <div class="control">${interruptor(a.abrirUltimo, '', 'abrirUltimo')}</div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Tamaño de letra del código</b><span>En el editor de Águila. También con A− / A+.</span></div>
        <div class="control"><select class="campo" data-k="tamFuenteCodigo" style="width:120px">${[12, 13, 14, 15, 16, 18, 20].map(m => `<option value="${m}" ${a.tamFuenteCodigo == m ? 'selected' : ''}>${m} px</option>`).join('')}</select></div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Mostrar FPS al probar</b><span>Fotogramas por segundo en la barra de la ventana de prueba.</span></div>
        <div class="control">${interruptor(a.mostrarFps, '', 'mostrarFps')}</div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Tamaño de la cuadrícula 2D</b><span>Para «Ajustar a cuadrícula».</span></div>
        <div class="control"><select class="campo" data-k="cuadricula" style="width:120px">${[8, 16, 20, 32, 40, 64].map(m => `<option value="${m}" ${a.cuadricula == m ? 'selected' : ''}>${m} px</option>`).join('')}</select></div></div>
      <div class="ajuste"><div class="texto-ajuste"><b>Sistema</b><span>Falcon Engine ${esc(info.version)} · ${esc(info.plataforma)} ${esc(info.arquitectura)} · Electron ${esc(info.electron)}</span></div>
        <div class="control"><button class="btn secundario peq" data-a="borrar-recientes">Vaciar recientes</button></div></div>
    </section>`;
  const guardar = async () => { await guardarDatos(); avisar('Ajustes guardados'); };
  $$('[data-k]', c).forEach(e => {
    if (e.classList.contains('segmentado')) {
      const pintarSeg = () => $$('button', e).forEach(b => b.classList.toggle('activo', b.dataset.v === a[e.dataset.k]));
      $$('button', e).forEach(b => b.onclick = () => { a[e.dataset.k] = b.dataset.v; pintarSeg(); guardar(); });
      pintarSeg();
    } else e.onchange = () => { a[e.dataset.k] = e.type === 'number' || e.tagName === 'SELECT' && !isNaN(e.value) ? Number(e.value) : e.value; guardar(); };
  });
  $$('[data-campo]', c).forEach(e => e.onchange = () => { a[e.dataset.campo] = e.checked; guardar(); });
  $('[data-a=carpeta]', c).onclick = async () => {
    const r = await falcon.dialogo.carpeta({ titulo: 'Carpeta de proyectos', ruta: a.carpetaProyectos });
    if (r) { a.carpetaProyectos = r.replace(/\\/g, '/'); guardar(); pintar(); }
  };
  $('[data-a=borrar-recientes]', c).onclick = async () => {
    if (await confirmar({ titulo: '¿Vaciar la lista de recientes?', mensaje: 'Los proyectos no se borran, solo desaparecen de la lista.', aceptar: 'Vaciar' })) {
      datos.recientes = []; await guardarDatos(); avisar('Lista vaciada');
    }
  };
}

iniciar();

