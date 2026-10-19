// Acciones del editor compartidas por todas las disposiciones.
import { est, bus, log, abrirDocumento, documento, activarDocumento, cerrarDocumento, refrescarArchivos, anotarEvento, tipoDocumento } from './estado.js';
import { crearNodo, buscarNodo, recorrer } from '../motor/tipos.js';
import { escenaVacia, sinExtension, nombreBase, carpetaDe, nombreTecla, ACCIONES_POR_DEFECTO } from '../motor/proyecto.js';
import { blueprintVacio, compilarBlueprint } from '../motor/blueprints.js';
import { materialBasico } from '../motor/plantillas.js';
import { dialogo, pedirTexto, confirmar, avisar, el, esc, $, $$, interruptor } from '../ui/componentes.js';
import { icono } from '../ui/iconos.js';
import { CALIDADES } from '../motor/graficos.js';

const falcon = window.falcon;

// ---------- Guardado ----------
export async function guardar(doc = est.activo) {
  if (!doc) return;
  try {
    await doc.guardar();
    if (doc.tipo === 'escena') { log(`Escena guardada: ${doc.rel}`); bus.emit('escena:guardada', doc); }
    else if (doc.tipo === 'blueprint') {
      const r = doc.ultimaCompilacion;
      if (r.errores.length) log(`${doc.nombre}: ${r.errores[0].mensaje}`, 'error');
      else log(`${doc.nombre} compilado a Águila sin errores`, 'ok');
      for (const a of r.avisos.slice(0, 3)) log(`Aviso: ${a.mensaje}`, 'aviso');
    } else log(`Guardado: ${doc.rel}`);
    if (est.juego.activo && (doc.tipo === 'script' || doc.tipo === 'blueprint')) {
      falcon.juego.enviar({ tipo: 'script', archivo: doc.rel, texto: doc.tipo === 'script' ? doc.datos : JSON.stringify(doc.datos) });
    }
    await refrescarArchivos();
  } catch (e) {
    log(`No se pudo guardar ${doc.rel}: ${e.message}`, 'error');
    avisar('No se pudo guardar: ' + e.message, 'error');
  }
}

export async function guardarTodo() {
  for (const d of est.docs) if (d.sucio) await guardar(d);
  await est.proyecto.guardar();
}

export function haySinGuardar() { return est.docs.some(d => d.sucio); }

// ---------- Probar ----------
export async function probar(escena) {
  await guardarTodo();
  const p = est.proyecto;
  let rel = escena || p.datos.escena_principal;
  if (!rel) {
    const a = est.activo && est.activo.tipo === 'escena' ? est.activo.rel : est.archivos.find(x => x.rel.endsWith('.fscn'))?.rel;
    if (!a) { avisar('Crea una escena antes de probar el juego.', 'aviso'); return; }
    rel = a;
    p.datos.escena_principal = a;
    await p.guardar();
    log(`Escena principal: ${a}`);
  }
  await falcon.juego.probar({ proyecto: p.ruta, escena: rel, nombre: p.datos.nombre, resolucion: p.datos.resolucion });
  est.juego = { activo: true, pausado: false };
  anotarEvento('probado');
  log('▶ Juego iniciado en una ventana aparte', 'ok', { canal: 'depurador' });
  bus.emit('juego:estado', est.juego);
  const sel = est.activo && est.activo.nodoSel;
  if (sel) setTimeout(() => falcon.juego.enviar({ tipo: 'observar', nombre: sel.nombre }), 600);
}

export function detener() { falcon.juego.enviar({ tipo: 'detener' }); }
export function pausarJuego() { est.juego.pausado = !est.juego.pausado; falcon.juego.enviar({ tipo: 'pausa', valor: est.juego.pausado }); bus.emit('juego:estado', est.juego); }

// Mensajes que llegan de la ventana del juego.
export function escucharJuego() {
  falcon.juego.alInformar((m) => {
    switch (m.tipo) {
      case 'mostrar': log('Águila: ' + m.texto, 'juego', { canal: 'depurador' }); anotarEvento('juego:mostrar'); break;
      case 'error': {
        const e = m.error;
        log(`${e.archivo ? e.archivo + (e.linea ? ` · línea ${e.linea}` : '') + ': ' : ''}${e.mensaje}`, 'error', { canal: 'depurador', archivo: e.archivo, linea: e.linea });
        bus.emit('juego:error', e);
        break;
      }
      case 'vivos': est.vivos.set(m.nodo, m.valores); bus.emit('juego:vivos', m); break;
      case 'evento': anotarEvento('juego:' + m.nombre); if (m.nombre === 'ganar') log('¡Partida ganada!', 'ok', { canal: 'depurador' }); break;
      case 'fin': log(m.estado === 'ganado' ? `Nivel completado · ${m.puntos} puntos` : 'Fin de la partida', m.estado === 'ganado' ? 'ok' : 'aviso', { canal: 'depurador' }); break;
      case 'estado': est.juego.pausado = m.pausado; bus.emit('juego:estado', est.juego); break;
      case 'escena': log(`Escena en juego: ${m.escena}`, 'info', { canal: 'depurador' }); break;
      case 'resultado': bus.emit('juego:resultado', m); break;
      case 'cerrado':
        est.juego = { activo: false, pausado: false };
        log('■ Juego detenido', 'info', { canal: 'depurador' });
        bus.emit('juego:estado', est.juego);
        break;
    }
  });
}

// Envía un cambio de propiedad al juego en marcha.
export function enviarAlJuego(msg) { if (est.juego.activo) falcon.juego.enviar(msg); }

// ---------- Crear archivos ----------
function nombreLibre(carpeta, base, ext) {
  const existe = (r) => est.archivos.some(a => a.rel.toLowerCase() === r.toLowerCase());
  let r = `${carpeta}/${base}.${ext}`;
  let i = 2;
  while (existe(r)) r = `${carpeta}/${base}${i++}.${ext}`;
  return r;
}

const validarNombre = (v) => !v ? 'Escribe un nombre.' : /[<>:"/\\|?*]/.test(v) ? 'El nombre no puede llevar < > : " / \\ | ? *' : null;

export async function nuevaEscena(dim = '2D') {
  const nombre = await pedirTexto({ titulo: `Nueva escena ${dim}`, etiqueta: 'Nombre de la escena', valor: dim === '2D' ? 'nivel' : 'mundo', aceptar: 'Crear escena', validar: validarNombre });
  if (!nombre) return;
  const rel = nombreLibre('escenas', nombre.replace(/\.fscn$/i, ''), 'fscn');
  const raiz = dim === '2D'
    ? crearNodo('Nodo2D', nombre.charAt(0).toUpperCase() + nombre.slice(1), {}, [crearNodo('Fondo', 'Fondo', { montanas: false, color: '#0F1A15', color2: '#0B120F' }), crearNodo('Camara2D', 'Cámara2D', { posicion: [640, 360], suavizado: 0 })])
    : crearNodo('Nodo3D', nombre.charAt(0).toUpperCase() + nombre.slice(1), {}, [crearNodo('Entorno', 'Entorno'), crearNodo('Luz3D', 'Sol', { posicion: [5, 8, 4], rotacion: [-50, 30, 0] }), crearNodo('Malla3D', 'Suelo', { escala: [20, 1, 20], malla: 'plano', color: '#3A4A40' }), crearNodo('Camara3D', 'Cámara3D', { posicion: [0, 4, 8], rotacion: [-25, 0, 0] })]);
  await est.proyecto.escribirJSON(rel, escenaVacia(dim, raiz));
  if (!est.proyecto.datos.escena_principal) { est.proyecto.datos.escena_principal = rel; await est.proyecto.guardar(); }
  await refrescarArchivos();
  log(`Escena creada: ${rel}`);
  await abrirDocumento(rel);
}

export async function nuevoScript(nodo, op = {}) {
  const base = (nodo ? nodo.nombre : 'script').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]+/g, '_') || 'script';
  let nombre = op.nombre || base;
  if (!op.sinPreguntar) {
    nombre = await pedirTexto({ titulo: 'Nuevo script de Águila', etiqueta: 'Nombre del archivo', valor: base, aceptar: 'Crear script', validar: validarNombre });
    if (!nombre) return null;
  }
  const rel = nombreLibre('scripts', nombre.replace(/\.agl$/i, ''), 'agl');
  const tipoNodo = nodo ? nodo.tipo : 'Nodo2D';
  const clase = (nodo ? nodo.nombre : 'MiNodo').replace(/[^\p{L}\p{N}_]/gu, '') || 'MiNodo';
  const texto = op.texto ?? `# ${nombreBase(rel)} · lógica de ${nodo ? nodo.nombre : 'un nodo'}
clase ${clase} extiende ${tipoNodo}:

    cuando empieza():
        pasar

    cuando se_actualiza(delta):
        pasar
`;
  await est.proyecto.escribir(rel, texto);
  await refrescarArchivos();
  log(`Script creado: ${rel}`);
  return rel;
}

export async function nuevoBlueprint(nodo, op = {}) {
  const base = (nodo ? nodo.nombre : 'logica').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]+/g, '_') || 'logica';
  let nombre = op.nombre || base;
  if (!op.sinPreguntar) {
    nombre = await pedirTexto({ titulo: 'Nuevo Blueprint', etiqueta: 'Nombre del Blueprint', valor: base, aceptar: 'Crear Blueprint', validar: validarNombre });
    if (!nombre) return null;
  }
  const rel = nombreLibre('blueprints', nombre.replace(/\.bp$/i, ''), 'bp');
  const bp = op.bp || blueprintVacio(sinExtension(rel), nodo ? nodo.tipo : 'Nodo2D');
  if (!op.bp) bp.grafos.eventos.nodos.push({ id: 'b' + Date.now().toString(36), def: 'ev_actualizar', x: 60, y: 60 });
  await est.proyecto.escribirJSON(rel, bp);
  await est.proyecto.escribir('generado/' + sinExtension(rel) + '.agl', compilarBlueprint(bp, nombreBase(rel)).codigo);
  await refrescarArchivos();
  log(`Blueprint creado: ${rel}`);
  return rel;
}

export async function nuevoMaterial() {
  const nombre = await pedirTexto({ titulo: 'Nuevo material', etiqueta: 'Nombre del material', valor: 'material', aceptar: 'Crear material', validar: validarNombre });
  if (!nombre) return;
  const rel = nombreLibre('materiales', nombre.replace(/\.mat$/i, ''), 'mat');
  await est.proyecto.escribirJSON(rel, materialBasico(sinExtension(rel), { color: '#C9BFAA' }));
  await refrescarArchivos();
  await abrirDocumento(rel);
}

export async function nuevaMalla(primitiva = 'cubo') {
  const nombre = await pedirTexto({ titulo: 'Nueva malla', etiqueta: 'Nombre de la malla', valor: primitiva, aceptar: 'Crear malla', validar: validarNombre });
  if (!nombre) return;
  const rel = nombreLibre('modelos', nombre.replace(/\.malla$/i, ''), 'malla');
  await est.proyecto.escribirJSON(rel, { formato: 'falcon-malla', version: 1, fuente: null, primitiva, ranuras: [{ nombre: 'cuerpo', material: '' }], colision: 'caja', empujable: false, peso: 10, sombras: true, escala: 1, eje_arriba: 'Y', lod: [{ nivel: 0, distancia: 0 }] });
  await refrescarArchivos();
  await abrirDocumento(rel);
}

// Abre cualquier archivo del proyecto en su editor.
export async function abrirArchivo(rel) {
  const t = tipoDocumento(rel);
  if (t) { await abrirDocumento(rel); return; }
  bus.emit('recursos:mostrar', rel);
}

export async function renombrarArchivo(rel) {
  const viejo = nombreBase(rel);
  const ext = viejo.includes('.') ? viejo.slice(viejo.lastIndexOf('.')) : '';
  const nuevo = await pedirTexto({ titulo: 'Renombrar', etiqueta: 'Nuevo nombre', valor: viejo.replace(ext, ''), aceptar: 'Renombrar', validar: validarNombre });
  if (!nuevo) return;
  const destino = (carpetaDe(rel) ? carpetaDe(rel) + '/' : '') + nuevo + (nuevo.endsWith(ext) ? '' : ext);
  if (est.archivos.some(a => a.rel === destino)) { avisar('Ya existe un archivo con ese nombre.', 'error'); return; }
  await falcon.fs.renombrar(est.proyecto.abs(rel), est.proyecto.abs(destino));
  const d = documento(rel);
  if (d) { d.rel = destino; bus.emit('docs:lista'); }
  await actualizarReferencias(rel, destino);
  await refrescarArchivos();
  log(`Renombrado: ${rel} → ${destino}`);
}

// Cambia las referencias a un archivo en escenas y ajustes de importación.
async function actualizarReferencias(de, a) {
  const p = est.proyecto;
  for (const f of est.archivos.filter(x => /\.(fscn|mat|malla)$/.test(x.rel))) {
    const d = documento(f.rel);
    if (d) {
      const t = JSON.stringify(d.datos);
      if (t.includes(JSON.stringify(de))) { d.datos = JSON.parse(t.split(JSON.stringify(de)).join(JSON.stringify(a))); d.marcarSucio(); bus.emit('doc:cambio', { doc: d, op: {} }); }
      continue;
    }
    const texto = await p.leer(f.rel).catch(() => null);
    if (texto && texto.includes(JSON.stringify(de))) await p.escribir(f.rel, texto.split(JSON.stringify(de)).join(JSON.stringify(a)));
  }
  if (p.importacion[de]) { p.importacion[a] = p.importacion[de]; delete p.importacion[de]; await p.guardarImportacion(); }
  if (p.datos.escena_principal === de) { p.datos.escena_principal = a; await p.guardar(); }
}

export async function borrarArchivo(rel) {
  const ok = await confirmar({ titulo: `¿Mover «${nombreBase(rel)}» a la papelera?`, mensaje: 'Podrás recuperarlo desde la papelera del sistema.', aceptar: 'Mover a la papelera', peligro: true });
  if (!ok) return;
  await falcon.fs.borrar(est.proyecto.abs(rel));
  const d = documento(rel);
  if (d) cerrarDocumento(d);
  await refrescarArchivos();
  log(`Enviado a la papelera: ${rel}`, 'aviso');
}

export async function nuevaCarpeta(dentro = '') {
  const nombre = await pedirTexto({ titulo: 'Nueva carpeta', etiqueta: 'Nombre', valor: 'carpeta', aceptar: 'Crear', validar: validarNombre });
  if (!nombre) return;
  await falcon.fs.crearCarpeta(est.proyecto.abs((dentro ? dentro + '/' : '') + nombre));
  await refrescarArchivos();
}

// Importa archivos externos a una carpeta del proyecto.
export async function importarArchivos(rutas, carpeta) {
  const p = est.proyecto;
  const hechos = [];
  for (const r of rutas) {
    const nombre = r.replace(/\\/g, '/').split('/').pop();
    const destinoCarpeta = carpeta || carpetaPorDefecto(nombre);
    let destino = destinoCarpeta + '/' + nombre;
    let i = 2;
    while (est.archivos.some(a => a.rel.toLowerCase() === destino.toLowerCase())) destino = destinoCarpeta + '/' + nombre.replace(/(\.[^.]+)$/, ` ${i++}$1`);
    bus.emit('importacion', { archivo: nombre, estado: 'importando', progreso: 30 });
    try {
      await falcon.fs.copiar(r, p.abs(destino));
      hechos.push(destino);
      bus.emit('importacion', { archivo: nombre, estado: 'importado', progreso: 100, rel: destino });
      log(`Importado: ${destino}`, 'ok');
    } catch (e) {
      bus.emit('importacion', { archivo: nombre, estado: 'error', progreso: 100, error: e.message });
      log(`No se pudo importar ${nombre}: ${e.message}`, 'error');
    }
  }
  await refrescarArchivos();
  return hechos;
}

export function carpetaPorDefecto(nombre) {
  const e = nombre.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(e)) return 'sprites';
  if (['glb', 'gltf'].includes(e)) return 'modelos';
  if (['wav', 'ogg', 'mp3'].includes(e)) return 'sonidos';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(e)) return 'fuentes';
  if (e === 'agl') return 'scripts';
  if (e === 'bp') return 'blueprints';
  if (e === 'fscn') return 'escenas';
  return 'otros';
}

export async function dialogoImportar(carpeta) {
  const rutas = await falcon.dialogo.archivos({
    titulo: 'Importar recursos', varios: true,
    filtros: [{ name: 'Recursos', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'glb', 'gltf', 'wav', 'ogg', 'mp3', 'ttf', 'otf', 'woff2', 'agl', 'fscn', 'bp'] }],
  });
  if (rutas.length) return importarArchivos(rutas, carpeta);
  return [];
}

// ---------- Ajustes del proyecto ----------
export async function dialogoAjustesProyecto() {
  const p = est.proyecto;
  const d = structuredClone(p.datos);
  const escenas = est.archivos.filter(a => a.rel.endsWith('.fscn')).map(a => a.rel);
  const c = el(`<div>
    <div class="segmentado peq" style="margin-bottom:16px"><button data-t="general" class="activo">General</button><button data-t="controles">Controles</button><button data-t="sonido">Sonido</button><button data-t="graficos">Gráficos</button></div>
    <div data-p="general">
      <div class="fila"><label class="etiqueta-campo">Nombre del juego</label><input class="campo" data-k="nombre" value="${esc(d.nombre)}"></div>
      <div class="fila"><label class="etiqueta-campo">Escena principal</label><select class="campo" data-k="escena_principal">${escenas.map(e => `<option ${e === d.escena_principal ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>
      <div class="fila fila-flex"><div class="crece"><label class="etiqueta-campo">Resolución (ancho)</label><input class="campo mono" type="number" data-k="ancho" value="${d.resolucion[0]}"></div><div class="crece"><label class="etiqueta-campo">Alto</label><input class="campo mono" type="number" data-k="alto" value="${d.resolucion[1]}"></div></div>
      <div class="fila fila-flex"><div class="crece"><label class="etiqueta-campo">Gravedad</label><input class="campo mono" type="number" data-k="gravedad" value="${d.gravedad}"></div><div class="crece"><label class="etiqueta-campo">Color de fondo</label><input class="campo mono" data-k="fondo" value="${esc(d.fondo)}"></div></div>
      <div class="fila">${interruptor(d.filtro_pixel, 'Pixel art: imágenes nítidas por defecto', 'filtro_pixel')}</div>
    </div>
    <div data-p="controles" class="oculto">
      <p style="color:var(--texto-2);margin:0 0 10px;font-size:13px">Cada acción puede tener varias teclas. Pulsa «+» y después la tecla. Haz clic en una tecla para quitarla.</p>
      <div class="tabla-acciones"></div>
      <button class="btn texto peq" data-a="nueva-accion" style="margin-top:8px">${icono('mas', '', 14)}Nueva acción</button>
    </div>
    <div data-p="graficos" class="oculto">
      <div class="fila">${interruptor(d.lumbre !== false, 'Usar Lumbre: iluminación global, reflejos, espejos y exposición automática', 'lumbre')}</div>
      <p style="color:var(--texto-2);margin:-4px 0 14px;font-size:13px;line-height:1.5">Si la desactivas, todas las escenas usan la iluminación clásica (más ligera). Las sombras, la oclusión ambiental y el resplandor siguen funcionando. Con Lumbre activada, el jugador también puede apagarla en el menú de gráficos (<span class="kbd">F10</span>).</p>
      <div class="fila"><label class="etiqueta-campo">Calidad gráfica por defecto (escenas 3D)</label>
        <select class="campo" data-k="calidad_grafica">${[['automatica', 'Automática · según la tarjeta gráfica del jugador'], ...['baja', 'media', 'alta', 'ultra'].map(k => [k, `${CALIDADES[k].nombre} · ${CALIDADES[k].descripcion}`])].map(([k, t]) => `<option value="${k}" ${(d.calidad_grafica || 'automatica') === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="lector" style="font-size:13px;color:var(--texto-2);line-height:1.6">
        <p style="margin:0 0 8px">La iluminación global <b style="color:var(--verde)">Lumbre</b> se activa en el nodo <b>Entorno</b> de cada escena 3D y necesita calidad Media o superior. En Baja se usa la iluminación clásica, que funciona en cualquier equipo.</p>
        <table><tr><td>Baja</td><td>Sin iluminación global ni posproceso</td></tr><tr><td>Media</td><td>Lumbre con pocas sondas, oclusión a media resolución, resplandor y reflejos</td></tr><tr><td>Alta</td><td>Lumbre con más sondas y 2 rebotes, oclusión completa, sombras de 2048</td></tr><tr><td>Ultra</td><td>Sondas densas, actualización rápida, sombras de 4096 y resolución nativa</td></tr></table>
        <p style="margin:10px 0 0">Esta gráfica: <b class="mono gpu-detectada">…</b></p>
        <p style="margin:4px 0 0">El jugador puede cambiar la calidad con <span class="kbd">F10</span> y en «Automática» baja sola si el juego va lento.</p>
      </div>
    </div>
    <div data-p="sonido" class="oculto">
      ${['general', 'musica', 'efectos'].map(k => `<div class="fila"><label class="etiqueta-campo">Volumen ${k === 'general' ? 'general' : k === 'musica' ? 'de la música' : 'de los efectos'}</label><input type="range" class="deslizador" min="0" max="1" step="0.01" data-vol="${k}" value="${d.volumen?.[k] ?? 1}" style="--p:${(d.volumen?.[k] ?? 1) * 100}%"></div>`).join('')}
    </div>
  </div>`);
  const pintarAcciones = () => {
    const t = c.querySelector('.tabla-acciones');
    t.innerHTML = Object.entries(d.acciones).map(([a, teclas]) => `<div class="fila-accion" data-accion="${esc(a)}"><b class="mono" style="font-size:13px">${esc(a)}</b><div class="teclas">${teclas.map(k => `<span class="kbd" data-tecla="${esc(k)}" data-ayuda="Quitar">${esc(nombreTecla(k))}</span>`).join('')}</div><button class="btn-icono peq" data-mas>${icono('mas', '', 14)}</button></div>`).join('');
    $$('[data-tecla]', t).forEach(k => k.onclick = () => { const a = k.closest('[data-accion]').dataset.accion; d.acciones[a] = d.acciones[a].filter(x => x !== k.dataset.tecla); pintarAcciones(); });
    $$('[data-mas]', t).forEach(b => b.onclick = () => {
      const a = b.closest('[data-accion]').dataset.accion;
      b.innerHTML = '…';
      const h = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', h, true); if (e.code !== 'Escape' && !d.acciones[a].includes(e.code)) d.acciones[a].push(e.code); pintarAcciones(); };
      window.addEventListener('keydown', h, true);
    });
  };
  pintarAcciones();
  detectarGPU().then(t => { const g = c.querySelector('.gpu-detectada'); if (g) g.textContent = t; });
  c.querySelector('[data-a=nueva-accion]').onclick = async () => {
    const n = await pedirTexto({ titulo: 'Nueva acción', etiqueta: 'Nombre (por ejemplo «disparar»)', valor: '', validar: (v) => !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(v) ? 'Usa solo letras, números y _' : d.acciones[v] ? 'Ya existe' : null });
    if (n) { d.acciones[n] = []; pintarAcciones(); }
  };
  $$('[data-t]', c).forEach(b => b.onclick = () => { $$('[data-t]', c).forEach(x => x.classList.toggle('activo', x === b)); $$('[data-p]', c).forEach(p2 => p2.classList.toggle('oculto', p2.dataset.p !== b.dataset.t)); });
  const r = await dialogo({ titulo: 'Ajustes del proyecto', ancho: 620, contenido: c, botones: [{ texto: 'Cancelar', valor: false }, { texto: 'Guardar ajustes', tipo: 'principal', valor: true }] });
  if (!r) return;
  const v = (k) => c.querySelector(`[data-k=${k}]`).value;
  d.nombre = v('nombre').trim() || d.nombre;
  d.escena_principal = v('escena_principal');
  d.resolucion = [Math.max(160, Number(v('ancho')) || 1280), Math.max(120, Number(v('alto')) || 720)];
  d.gravedad = Number(v('gravedad')) || 0;
  d.fondo = v('fondo');
  d.filtro_pixel = c.querySelector('[data-campo=filtro_pixel]').checked;
  d.calidad_grafica = v('calidad_grafica');
  d.lumbre = c.querySelector('[data-campo=lumbre]').checked;
  d.volumen = Object.fromEntries($$('[data-vol]', c).map(i => [i.dataset.vol, Number(i.value)]));
  p.datos = d;
  await p.guardar();
  bus.emit('proyecto:ajustes');
  log('Ajustes del proyecto guardados', 'ok');
}

// Nombre de la gráfica de este equipo y el nivel que elegiría «Automática».
async function detectarGPU() {
  try {
    const THREE = await import('three');
    const { detectarCalidad } = await import('../motor/graficos.js');
    const r = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    const { nivel, gpu } = detectarCalidad(r);
    r.dispose();
    r.forceContextLoss();
    const nombre = gpu.replace(/^ANGLE \(([^,]+), /, '').replace(/ \(0x[0-9a-f]+\).*$/i, '').replace(/ Direct3D.*$/, '');
    return `${nombre} → ${CALIDADES[nivel].nombre}`;
  } catch { return 'no se pudo detectar'; }
}

// ---------- Exportar ----------
export async function dialogoExportar() {
  anotarEvento('exportar_abierto');
  const p = est.proyecto;
  const info = est.info;
  const nativa = `${info.plataforma}-${info.arquitectura}`;
  const plats = [
    { id: 'win32-x64', nombre: 'Windows x64', desc: 'Carpeta con un .exe listo para compartir' },
    { id: 'linux-x64', nombre: 'Linux x64', desc: 'Archivo .tar.gz con el ejecutable' },
    { id: 'linux-arm64', nombre: 'Linux ARM64', desc: 'Portátiles ARM, consolas portátiles, Raspberry Pi' },
  ];
  const elegidas = new Set([plats.some(x => x.id === nativa) ? nativa : 'win32-x64']);
  const destinoDef = p.ruta + '/exportado';
  const c = el(`<div>
    <div class="fila"><label class="etiqueta-campo">Plataformas</label><div class="plataformas-exp">${plats.map(x => `
      <label class="plat-exp ${elegidas.has(x.id) ? 'activo' : ''}" data-p="${x.id}"><input type="checkbox" ${elegidas.has(x.id) ? 'checked' : ''}><div><b>${x.nombre}${x.id === nativa ? ' <small style="color:var(--verde)">· este equipo</small>' : ''}</b><span>${x.desc}${x.id !== nativa ? ' · la primera vez se descarga el motor (~100 MB)' : ''}</span></div></label>`).join('')}</div></div>
    <div class="fila fila-flex"><div class="crece"><label class="etiqueta-campo">Nombre del ejecutable</label><input class="campo" data-k="nombre" value="${esc(p.datos.exportacion?.nombre_ejecutable || p.datos.nombre)}"></div><div style="width:120px"><label class="etiqueta-campo">Versión</label><input class="campo mono" data-k="version" value="${esc(p.datos.exportacion?.version || '1.0.0')}"></div></div>
    <div class="fila"><label class="etiqueta-campo">Carpeta de destino</label><div class="fila-flex"><input class="campo mono" data-k="destino" value="${esc(destinoDef)}"><button class="btn secundario" data-a="examinar">Examinar</button></div></div>
    <div class="fila">${interruptor(!!p.datos.exportacion?.pantalla_completa, 'Abrir a pantalla completa', 'completa')}</div>
    <div class="progreso-export oculto"><div class="fila-flex"><span class="cargando"></span><span class="txt-export" style="font-size:13px">Preparando…</span></div><div class="barra-progreso" style="margin-top:10px"><div style="width:0%"></div></div><div class="registro-export"></div></div>
  </div>`);
  $$('.plat-exp', c).forEach(l => l.querySelector('input').onchange = (e) => { if (e.target.checked) elegidas.add(l.dataset.p); else elegidas.delete(l.dataset.p); l.classList.toggle('activo', e.target.checked); });
  c.querySelector('[data-a=examinar]').onclick = async () => { const r = await falcon.dialogo.carpeta({ titulo: 'Carpeta de destino', ruta: c.querySelector('[data-k=destino]').value }); if (r) c.querySelector('[data-k=destino]').value = r.replace(/\\/g, '/'); };
  await dialogo({
    titulo: 'Exportar juego', sub: 'Crea una versión de tu juego que se abre sin Falcon Engine.', ancho: 600, contenido: c,
    botones: [{ texto: 'Cerrar', valor: null }, {
      texto: 'Exportar', tipo: 'principal', icono: 'exportar', accion: async (dlg) => {
        if (!elegidas.size) { avisar('Elige al menos una plataforma.', 'aviso'); return false; }
        await guardarTodo();
        const prog = c.querySelector('.progreso-export');
        prog.classList.remove('oculto');
        $$('.acciones button', dlg).forEach(b => b.disabled = true);
        const reg = c.querySelector('.registro-export');
        const quitar = falcon.alProgresoExportar((pr) => {
          c.querySelector('.txt-export').textContent = pr.texto;
          c.querySelector('.barra-progreso div').style.width = Math.round(pr.porcentaje) + '%';
          if (pr.fase !== 'descarga' || pr.porcentaje === 0) reg.insertAdjacentHTML('beforeend', `<div>${esc(pr.plataforma)} · ${esc(pr.texto)}</div>`);
          reg.scrollTop = reg.scrollHeight;
        });
        p.datos.exportacion = { nombre_ejecutable: c.querySelector('[data-k=nombre]').value, version: c.querySelector('[data-k=version]').value, pantalla_completa: c.querySelector('[data-campo=completa]').checked };
        await p.guardar();
        const r = await falcon.exportar({
          proyecto: p.ruta, plataformas: [...elegidas], destino: c.querySelector('[data-k=destino]').value,
          nombre: p.datos.exportacion.nombre_ejecutable, version: p.datos.exportacion.version, pantallaCompleta: p.datos.exportacion.pantalla_completa,
          icono: est.info.raizApp + '/recursos/icono.ico',
        });
        quitar();
        $$('.acciones button', dlg).forEach(b => b.disabled = false);
        c.querySelector('.cargando')?.remove();
        if (r.ok) {
          c.querySelector('.txt-export').textContent = '¡Exportación terminada!';
          for (const s of r.salidas) { reg.insertAdjacentHTML('beforeend', `<div style="color:var(--verde)">✓ ${esc(s.ruta)}</div>`); log(`Juego exportado: ${s.ruta}`, 'ok'); }
          anotarEvento('exportado');
          falcon.sistema.mostrarEnCarpeta(r.salidas[0].ruta);
        } else {
          c.querySelector('.txt-export').textContent = 'Error: ' + r.error;
          log('Error al exportar: ' + r.error, 'error');
        }
        return false;
      },
    }],
  });
}

// ---------- Ayuda ----------
export async function abrirGuia(id) {
  const { GUIAS } = await import('../ui/guias.js');
  const g = GUIAS.find(x => x.id === id);
  if (!g) return;
  await dialogo({ titulo: g.titulo, ancho: 720, contenido: `<div class="lector" style="font-size:14px;line-height:1.65;user-select:text">${g.html}</div>`, botones: [{ texto: 'Cerrar', tipo: 'principal', valor: true }] });
}

export async function acercaDe() {
  const i = est.info;
  await dialogo({
    titulo: 'Falcon Engine',
    contenido: `<p style="color:var(--texto-2);margin:0 0 12px">Motor de videojuegos 2D y 3D con el lenguaje Águila.</p>
      <div class="lector"><table><tr><td>Versión</td><td>${esc(i.version)}</td></tr><tr><td>Sistema</td><td>${esc(i.plataforma)} ${esc(i.arquitectura)}</td></tr><tr><td>Electron</td><td>${esc(i.electron)}</td></tr><tr><td>Proyecto</td><td class="mono">${esc(est.proyecto.ruta)}</td></tr></table></div>`,
    botones: [{ texto: 'Cerrar', tipo: 'principal', valor: true }],
  });
}

// ---------- Nodos ----------
// Nombre único entre hermanos («Moneda», «Moneda2»…).
export function nombreUnico(padre, base) {
  const usados = new Set(padre.hijos.map(h => h.nombre));
  if (!usados.has(base)) return base;
  const raiz = base.replace(/\d+$/, '');
  let i = 2;
  while (usados.has(raiz + i)) i++;
  return raiz + i;
}

export function seleccionar(ids, doc = est.activo) {
  if (!doc || doc.tipo !== 'escena') return;
  doc.seleccion = ids.filter(Boolean);
  bus.emit('seleccion', doc);
  const n = doc.nodoSel;
  if (n && est.juego.activo) falcon.juego.enviar({ tipo: 'observar', nombre: n.nombre });
}
