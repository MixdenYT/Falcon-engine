// Editor de materiales (.mat): vista previa, plantillas y grafo.
import * as THREE from 'three';
import { est, bus, abrirDocumento, archivosDeTipo, refrescarArchivos, log } from '../estado.js';
import { guardar } from '../acciones.js';
import { crearPestanas } from '../paneles/documentos.js';
import { NODOS_MATERIAL, COLOR_TIPO_MAT, PLANTILLAS_MATERIAL, construirMaterial, resolverInstancia, evaluarMaterial } from '../../motor/materiales.js';
import { materialBasico } from '../../motor/plantillas.js';
import { geometriaPrimitiva, aplicarReflejos } from '../../motor/escena3d.js';
import { recorrer } from '../../motor/tipos.js';
import { nombreBase, sinExtension, normalizarEscena } from '../../motor/proyecto.js';
import { crearGrafo } from '../../ui/grafo.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu, menuBajo, pedirTexto, avisar, interruptor, pintarDeslizador } from '../../ui/componentes.js';

const CABECERA = { textura: '#3D2C1A', relieve: '#3D2C1A', color: '#3D2C1A', multiplicar: '#2A322E', sumar: '#2A322E', mezclar: '#2A322E', salida: '#1E4A31' };

export async function crearDisposicionMaterial(contenedor) {
  const doc = est.activo;
  const mat = () => doc.datos;
  const esInstancia = !!mat().base;
  const raiz = el(`<div style="flex:1;min-height:0;display:flex;flex-direction:column"><div class="cab-material"></div><div class="disp-material"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div></div>`);
  contenedor.append(raiz);
  const cab = $('.cab-material', raiz);
  const [izq, centro, der] = $('.disp-material', raiz).children;
  const partes = [];
  const pest = crearPestanas(cab, {
    nuevo: false,
    derecha: (d) => {
      const des = el('<button class="btn secundario peq">Deshacer</button>');
      des.onclick = () => doc.deshacer();
      const g = el('<button class="btn principal peq">Guardar y aplicar</button>');
      g.onclick = async () => { await guardar(doc); bus.emit('material:guardado', doc.rel); avisar('Material guardado y aplicado'); };
      d.append(des, g);
    },
  });
  partes.push(pest);
  pest.el.style.flex = '1';

  // ---------- Vista previa ----------
  const panelPrev = el(`<section class="panel" style="flex:none"><div class="cab-panel"><h3>Vista previa</h3><span class="mono" style="font-family:var(--fuente);font-weight:600">Arrastra para girar</span></div>
    <div class="vista-material"><canvas></canvas></div>
    <div class="formas-vista"><button class="btn-icono activo" data-f="esfera">${icono('esfera', '', 16)}</button><button class="btn-icono" data-f="cubo">${icono('cubo', '', 16)}</button><button class="btn-icono" data-f="plano">${icono('plano', '', 16)}</button><button class="btn-icono" data-f="cilindro">${icono('cilindro', '', 16)}</button></div></section>`);
  izq.append(panelPrev);
  const lienzo = $('canvas', panelPrev);
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  aplicarReflejos(renderer, escena, 0.9);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  cam.position.set(0, 0.2, 3.2);
  escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x302820, 1.4));
  const luz = new THREE.DirectionalLight(0xffffff, 2.2); luz.position.set(2, 3, 2.5); escena.add(luz);
  const luz2 = new THREE.DirectionalLight(0x9fc4ff, 0.6); luz2.position.set(-3, 1, -2); escena.add(luz2);
  const malla = new THREE.Mesh(geometriaPrimitiva('esfera'), new THREE.MeshStandardMaterial());
  malla.scale.setScalar(1.55);
  escena.add(malla);
  const texturas = new Map();
  const textura = (rel, { srgb } = {}) => {
    const k = rel + (srgb ? 's' : '');
    if (!texturas.has(k)) {
      const t = new THREE.TextureLoader().load(est.proyecto.url(rel), () => pintarPrevia());
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      texturas.set(k, t);
    }
    return texturas.get(k);
  };
  let base = null;
  if (esInstancia) { try { base = await est.proyecto.leerJSON(mat().base); } catch { base = null; } }
  const datosEfectivos = () => esInstancia ? resolverInstancia(mat(), base) : mat();
  function pintarPrevia() {
    try {
      malla.material = construirMaterial(THREE, datosEfectivos(), textura);
    } catch (e) { console.warn(e); }
    const r = lienzo.getBoundingClientRect();
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix();
    renderer.render(escena, cam);
  }
  let giro = null;
  lienzo.addEventListener('mousedown', (e) => { giro = { x: e.clientX, y: e.clientY }; });
  const moverGiro = (e) => { if (!giro) return; malla.rotation.y += (e.clientX - giro.x) * 0.01; malla.rotation.x += (e.clientY - giro.y) * 0.01; giro = { x: e.clientX, y: e.clientY }; renderer.render(escena, cam); };
  const soltarGiro = () => { giro = null; };
  window.addEventListener('mousemove', moverGiro); window.addEventListener('mouseup', soltarGiro);
  $$('[data-f]', panelPrev).forEach(b => b.onclick = () => {
    $$('[data-f]', panelPrev).forEach(x => x.classList.toggle('activo', x === b));
    malla.geometry = geometriaPrimitiva(b.dataset.f);
    malla.scale.setScalar(b.dataset.f === 'esfera' ? 1.55 : b.dataset.f === 'plano' ? 2 : 1.2);
    malla.rotation.set(b.dataset.f === 'plano' ? 0.9 : 0.3, 0.6, 0);
    pintarPrevia();
  });
  const ro = new ResizeObserver(() => pintarPrevia());
  ro.observe(lienzo);

  // ---------- Plantillas ----------
  const panelPlant = el(`<section class="panel" style="flex:1"><div class="cab-panel"><h3>Empezar desde plantilla</h3></div><div class="plantillas-mat">${Object.entries(PLANTILLAS_MATERIAL).map(([n, p]) => `<button class="plantilla-mat" data-p="${n}"><span class="esfera" style="background:${p.muestra}"></span>${n}</button>`).join('')}</div></section>`);
  if (!esInstancia) izq.append(panelPlant);
  $$('[data-p]', panelPlant).forEach(b => b.onclick = () => {
    const p = PLANTILLAS_MATERIAL[b.dataset.p];
    const tex = mat().grafo.nodos.find(n => n.tipo === 'textura');
    const rel = mat().grafo.nodos.find(n => n.tipo === 'relieve');
    doc.cambiar(() => {
      const nuevo = materialBasico(mat().nombre, { color: p.color, rugosidad: p.rugosidad, metalico: p.metalico, emision: p.emision, opacidad: p.opacidad ?? 1, superficie: p.superficie || 'opaca', iluminacion: p.iluminacion || 'realista', textura: ['Vidrio', 'Brillo', 'Metal', 'Espejo', 'Cromo'].includes(b.dataset.p) ? '' : tex?.archivo, relieve: rel?.archivo });
      Object.assign(mat(), { superficie: nuevo.superficie, iluminacion: nuevo.iluminacion, grafo: nuevo.grafo });
      if (p.reflejo) mat().reflejo = p.reflejo; else delete mat().reflejo;
    });
    $$('[data-p]', panelPlant).forEach(x => x.classList.toggle('sel', x === b));
    grafo && grafo.encuadrar();
  });

  // ---------- Grafo ----------
  let grafo = null;
  const panelGrafo = el(`<section class="panel visor"><div class="ruta-grafo"><div class="migas"><b>${esInstancia ? 'Instancia de ' + esc(nombreBase(mat().base)) : 'Grafo del material'}</b><span class="estado-compilado" style="margin-left:10px">Compilado</span></div>
    <div class="derecha">${esInstancia ? `<button class="btn secundario peq" data-a="base">Abrir material base</button>` : `<button class="btn secundario peq" data-n="textura">+ Textura</button><button class="btn secundario peq" data-n="color">+ Color</button><button class="btn secundario peq" data-n="numero">+ Número</button><button class="btn secundario peq" data-n="operacion">+ Operación</button>`}</div></div>
    <div class="lienzo-visor" style="border:0"></div></section>`);
  centro.append(panelGrafo);
  const zona = $('.lienzo-visor', panelGrafo);

  function defNodo(n) {
    const d = NODOS_MATERIAL[n.tipo];
    if (!d) return null;
    if (n.tipo === 'salida') return { titulo: `Material · ${mat().nombre}`, cabecera: CABECERA.salida, icono: 'esfera', entradas: d.entradas.map(p => ({ n: p.n, t: p.t, etq: p.etq })), salidas: [], clase: 'nodo-salida-mat' };
    if (n.tipo === 'numero') return { compacto: true, titulo: Number(n.valor).toFixed(1), sub: n.etiqueta || (n.parametro || 'número'), entradas: [], salidas: [{ n: 'valor', t: 'numero', etq: '' }] };
    if (n.tipo === 'color') return { titulo: n.parametro ? `Color · ${n.parametro}` : 'Color', cabecera: CABECERA.color, entradas: [{ n: 'valor', t: 'color', campo: 'personalizado', conectable: false, etq: '' }], salidas: [{ n: 'color', t: 'color', etq: '' }] };
    if (n.tipo === 'textura' || n.tipo === 'relieve') return {
      titulo: n.tipo === 'relieve' ? 'Textura · relieve' : 'Textura', cabecera: CABECERA.textura,
      entradas: [{ n: 'img', t: 'color', campo: 'personalizado', conectable: false, etq: '' }],
      salidas: d.salidas.map(p => ({ n: p.n, t: p.t, etq: p.etq })),
    };
    return { titulo: d.titulo, cabecera: CABECERA[n.tipo], entradas: d.entradas.map(p => ({ n: p.n, t: p.t, etq: p.etq, campo: p.n === 't' ? 'numero' : null, def: 0.5 })), salidas: d.salidas.map(p => ({ n: p.n, t: p.t, etq: p.etq })) };
  }

  function valorPersonalizado(n, pin, c) {
    if (n.tipo === 'color') {
      c.innerHTML = `<label style="display:flex;align-items:center;gap:8px;padding:2px 2px 2px 0"><input type="color" value="${esc(String(n.valor).slice(0, 7).toLowerCase())}" style="width:44px;height:22px;border:0;padding:0;background:none;border-radius:4px"><span class="mono" style="font-size:12px;color:var(--texto-2)">${esc(String(n.valor).toUpperCase())}</span></label>`;
      const inp = $('input', c);
      inp.oninput = () => { c.querySelector('span').textContent = inp.value.toUpperCase(); doc.cambiar(() => { n.valor = inp.value.toUpperCase(); }, { fusionar: 'color-' + n.id, valor: true }); };
    } else {
      c.innerHTML = `<div style="padding:2px 0"><div style="width:72px;height:56px;border-radius:6px;background:#111 center/cover no-repeat ${n.archivo ? `url('${est.proyecto.url(n.archivo)}')` : ''};border:1px solid var(--borde);cursor:pointer" data-ayuda="Elegir textura"></div><div class="mono" style="font-size:11px;color:var(--texto-2);margin-top:4px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${esc(n.archivo ? nombreBase(n.archivo) : 'sin textura')}</div></div>`;
      c.firstChild.firstChild.onclick = (e) => elegirTextura(n, e.currentTarget);
    }
  }

  function elegirTextura(n, boton) {
    const imgs = archivosDeTipo('imagen');
    menuBajo(boton, imgs.length ? imgs.map(a => ({ texto: a.rel, icono: 'imagen', marcado: a.rel === n.archivo, accion: () => doc.cambiar(() => { n.archivo = a.rel; }) })) : [{ texto: 'No hay imágenes: impórtalas en Recursos', desactivado: true }]);
  }

  function compatiblesMat(a, b) {
    if (a === 'cualquiera' || b === 'cualquiera') return true;
    return a === b;
  }

  function montarGrafo() {
    if (esInstancia) { pintarInstancia(); return; }
    doc.vista.grafo ||= { encuadrar: true };
    grafo = crearGrafo(zona, {
      grafo: () => mat().grafo,
      definicion: defNodo,
      colorTipo: (t) => COLOR_TIPO_MAT[t] || '#A9B5AE',
      compatibles: compatiblesMat,
      vista: doc.vista.grafo,
      comentarios: false,
      cambiar: (fn, o = {}) => doc.cambiar(() => fn(mat().grafo), o),
      protegidos: () => new Set(mat().grafo.nodos.filter(n => n.tipo === 'salida').map(n => n.id)),
      alAviso: (t) => avisar(t, 'aviso'),
      valorPersonalizado,
      alSeleccionar: () => {},
      alDobleClic: (n) => { if (n.tipo === 'textura' || n.tipo === 'relieve') elegirTextura(n, zona.querySelector(`[data-id="${CSS.escape(n.id)}"]`)); if (n.tipo === 'numero') editarNumero(n); },
      alPaleta: (x, y, ctx) => new Promise((ok) => {
        menu(x, y, [{ cabecera: 'Añadir al grafo' }, ...['textura', 'relieve', 'color', 'numero', 'multiplicar', 'sumar', 'mezclar'].map(t => ({ texto: t === 'relieve' ? 'Textura · relieve' : NODOS_MATERIAL[t].titulo, accion: () => ok(anadir(t, ctx.x, ctx.y)) }))], { alCerrar: () => setTimeout(() => ok(null), 50) });
      }),
    });
    zona.append(el(`<div class="leyenda"><span><i style="background:${COLOR_TIPO_MAT.color}"></i>Color</span><span><i style="background:${COLOR_TIPO_MAT.numero}"></i>Número</span><span><i style="background:${COLOR_TIPO_MAT.direccion}"></i>Dirección / relieve</span></div>`));
  }

  async function editarNumero(n) {
    const v = await pedirTexto({ titulo: 'Número', etiqueta: `Valor de ${n.etiqueta || 'número'} (0 a 1)`, valor: String(n.valor), validar: (x) => isNaN(Number(x.replace(',', '.'))) ? 'Escribe un número' : null });
    if (v !== null && v !== undefined) doc.cambiar(() => { n.valor = Number(v.replace(',', '.')); });
  }

  function anadir(tipo, x, y) {
    if (x === undefined) { const v = doc.vista.grafo; const r = zona.getBoundingClientRect(); x = (r.width / 3 - v.x) / v.zoom; y = (r.height / 2 - v.y) / v.zoom; }
    const n = { id: tipo + Date.now().toString(36), tipo, x: Math.round(x), y: Math.round(y) };
    if (tipo === 'color') n.valor = '#FFFFFF';
    if (tipo === 'numero') { n.valor = 0.5; n.etiqueta = 'número'; }
    if (tipo === 'textura' || tipo === 'relieve') n.archivo = '';
    doc.cambiar(() => { mat().grafo.nodos.push(n); });
    return n;
  }
  $$('[data-n]', panelGrafo).forEach(b => b.onclick = () => {
    if (b.dataset.n === 'operacion') {
      const r = b.getBoundingClientRect();
      menu(r.left, r.bottom + 4, [['multiplicar', 'Multiplicar'], ['sumar', 'Sumar'], ['mezclar', 'Mezclar']].map(([t, n]) => ({ texto: n, accion: () => anadir(t) })));
    } else anadir(b.dataset.n);
  });
  const bBase = $('[data-a=base]', panelGrafo);
  if (bBase) bBase.onclick = () => abrirDocumento(mat().base);

  function pintarInstancia() {
    zona.innerHTML = '';
    const params = base ? base.grafo.nodos.filter(n => n.parametro) : [];
    const c = el(`<div style="padding:24px;max-width:520px"><p style="color:var(--texto-2);margin:0 0 18px">Una instancia usa el grafo de <b class="mono">${esc(nombreBase(mat().base))}</b> pero con sus propios valores. Cambiarla no afecta al material original.</p></div>`);
    if (!params.length) c.append(el('<div class="vacio-texto">El material base no tiene parámetros editables.</div>'));
    for (const p of params) {
      const actual = mat().parametros?.[p.parametro] ?? p.valor;
      const f = el(`<div class="prop"><label>${esc(p.parametro)}</label><div class="valor">${p.tipo === 'color' ? `<div class="color"><input type="color" value="${esc(String(actual).slice(0, 7).toLowerCase())}"><input type="text" value="${esc(String(actual).toUpperCase())}"></div>` : `<div class="desliz"><input type="range" class="deslizador" min="0" max="1" step="0.01" value="${actual}"><span class="num">${actual}</span></div>`}</div></div>`);
      const fijar = (v) => doc.cambiar(() => { (mat().parametros ||= {})[p.parametro] = v; }, { fusionar: 'param-' + p.parametro });
      if (p.tipo === 'color') { const [cc, t] = $$('input', f); cc.oninput = () => { t.value = cc.value.toUpperCase(); fijar(cc.value.toUpperCase()); }; }
      else { const r = $('input', f); pintarDeslizador(r); r.oninput = () => { $('.num', f).textContent = r.value; fijar(Number(r.value)); }; }
      c.append(f);
    }
    zona.append(c);
  }

  // ---------- Detalles ----------
  let pestDer = 'detalles';
  const panelDer = el(`<section class="panel" style="flex:1"><div class="pestanas"><button data-p="detalles" class="activo">Detalles</button><button data-p="instancias">Instancias</button></div><div class="desplazable cont-mat"></div></section>`);
  der.append(panelDer);
  $$('.pestanas button', panelDer).forEach(b => b.onclick = () => { pestDer = b.dataset.p; $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x === b)); pintarDetalles(); });

  async function pintarDetalles() {
    const c = $('.cont-mat', panelDer);
    const m = mat();
    if (pestDer === 'instancias') {
      const lista = [];
      for (const a of archivosDeTipo('material')) { try { const d = await est.proyecto.leerJSON(a.rel); if (d.base === doc.rel) lista.push(a.rel); } catch {} }
      c.innerHTML = `<div class="seccion-insp"><div class="titulo-seccion">Instancias de ${esc(nombreBase(doc.rel))}</div>${lista.map(r => `<div class="fila-archivo" data-r="${esc(r)}"><span style="color:var(--ambar)">${icono('material', '', 15)}</span><span>${esc(nombreBase(r))}</span></div>`).join('') || '<div class="vacio-texto" style="text-align:left;padding:0">Aún no hay instancias.</div>'}</div>
        <div style="padding:12px"><button class="btn principal ancho" data-a="instancia" ${esInstancia ? 'disabled' : ''}>Crear instancia de material</button></div>`;
      $$('[data-r]', c).forEach(x => x.onclick = () => abrirDocumento(x.dataset.r));
      const bi = $('[data-a=instancia]', c); if (bi) bi.onclick = crearInstancia;
      return;
    }
    const params = (esInstancia ? (base?.grafo.nodos || []) : m.grafo.nodos).filter(n => n.parametro);
    c.innerHTML = `<div class="seccion-insp"><div class="titulo-seccion">Superficie</div>
        <div class="segmentado lleno" style="margin-bottom:14px">${[['opaca', 'Opaca'], ['transparente', 'Transp.'], ['recortada', 'Recorte']].map(([k, t]) => `<button data-s="${k}" class="${(m.superficie || 'opaca') === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <div class="prop"><label>Iluminación</label><div class="valor"><select class="campo" data-k="iluminacion">${[['realista', 'Realista'], ['sin_luz', 'Sin luz'], ['dibujo', 'Dibujo']].map(([k, t]) => `<option value="${k}" ${(m.iluminacion || 'realista') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
        <div class="prop"><label>Dos caras</label><div class="valor">${interruptor(!!m.dos_caras, '', 'dos_caras')}</div></div>
        <div class="prop"><label>Fuerza de la emisión</label><div class="valor"><div class="desliz"><input type="range" class="deslizador" min="0" max="10" step="0.1" value="${m.intensidad_emision ?? 1.4}" data-refk="intensidad_emision"><span class="num">${(m.intensidad_emision ?? 1.4).toFixed(2)}</span></div></div></div>
        <div class="prop"><label>Proyecta sombras</label><div class="valor">${interruptor(m.sombras !== false, '', 'sombras')}</div></div></div>
      <div class="seccion-insp"><div class="titulo-seccion">Reflejos · Lumbre</div>
        <div class="segmentado lleno" style="margin-bottom:10px">${[['sonda', 'Escena'], ['plano', 'Plano'], ['curvo', 'Curvo']].map(([k, t]) => `<button data-refl="${k}" class="${(m.reflejo || 'sonda') === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <p style="font-size:13px;color:var(--texto-2);margin:0 0 12px;line-height:1.5">${{ sonda: 'Refleja una captura de la escena alrededor de la cámara. Barato; vale para casi todo.', plano: 'Refleja como un espejo de verdad: suelos pulidos, espejos de pared o agua quieta. La cara que refleja es la de arriba del objeto (su eje Y).', curvo: 'Cada objeto captura la escena desde su centro: esferas de cromo, jarrones o carrocerías.' }[m.reflejo || 'sonda']} La rugosidad del material desenfoca el reflejo.</p>
        ${(m.reflejo || 'sonda') === 'sonda' ? '' : ['reflejo_intensidad', 'reflejo_desenfoque'].map(k => `<div class="prop"><label>${k === 'reflejo_intensidad' ? 'Intensidad' : 'Desenfoque por rugosidad'}</label><div class="valor"><div class="desliz"><input type="range" class="deslizador" min="0" max="${k === 'reflejo_intensidad' ? 1 : 2}" step="0.01" value="${m[k] ?? 1}" data-refk="${k}"><span class="num">${(m[k] ?? 1).toFixed(2)}</span></div></div></div>`).join('')}
        <p style="font-size:12px;color:var(--texto-3);margin:6px 0 0">Los espejos se ven en el modo «Final · Lumbre» y en el juego. Su número depende de la calidad: Media 1 plano, Alta 3, Ultra 6.</p></div>
      <div class="seccion-insp"><div class="titulo-seccion">Parámetros editables</div><p style="font-size:13px;color:var(--texto-2);margin:0 0 12px;line-height:1.5">Estos valores se pueden cambiar en cada instancia sin tocar el grafo.</p>
        ${params.map(p => `<div class="fila-flex" style="margin-bottom:8px">${p.tipo === 'color' ? `<span style="width:28px;height:28px;border-radius:6px;background:${esc(p.valor)};border:1px solid var(--borde)"></span>` : `<span class="mono" style="width:28px;height:28px;border-radius:6px;background:var(--fondo);border:1px solid var(--verde-borde);display:grid;place-items:center;font-size:11px">${Number(p.valor).toFixed(1)}</span>`}<span class="crece">${esc(p.parametro)}</span><span style="font-size:12px;color:var(--texto-2)">${p.tipo === 'color' ? 'color' : 'número'}</span>${esInstancia ? '' : `<button class="btn-icono peq" data-quitar="${esc(p.id)}" data-ayuda="Dejar de ser parámetro">${icono('cerrar', '', 12)}</button>`}</div>`).join('') || '<div class="vacio-texto" style="text-align:left;padding:0 0 8px">Ninguno todavía.</div>'}
        ${esInstancia ? '' : '<button class="btn texto peq" data-a="hacer-param">+ Convertir un color o número en parámetro</button>'}
        <button class="btn principal ancho" data-a="instancia" style="margin-top:12px" ${esInstancia ? 'disabled' : ''}>Crear instancia de material</button></div>
      <div class="seccion-insp"><div class="titulo-seccion">Usado en</div><div class="usado-en"><div class="vacio-texto" style="text-align:left;padding:0">Buscando…</div></div></div>`;
    $$('[data-s]', c).forEach(b => b.onclick = () => doc.cambiar(() => { m.superficie = b.dataset.s; }));
    $('[data-k=iluminacion]', c).onchange = (e) => doc.cambiar(() => { m.iluminacion = e.target.value; });
    $('[data-campo=dos_caras]', c).onchange = (e) => doc.cambiar(() => { m.dos_caras = e.target.checked; });
    $('[data-campo=sombras]', c).onchange = (e) => doc.cambiar(() => { m.sombras = e.target.checked; });
    $$('[data-refl]', c).forEach(x => x.onclick = () => doc.cambiar(() => { if (x.dataset.refl === 'sonda') delete m.reflejo; else m.reflejo = x.dataset.refl; }));
    $$('[data-refk]', c).forEach(x => { x.oninput = () => { x.nextElementSibling.textContent = Number(x.value).toFixed(2); }; x.onchange = () => doc.cambiar(() => { m[x.dataset.refk] = Number(x.value); }); });
    $$('[data-quitar]', c).forEach(b => b.onclick = () => doc.cambiar(() => { const n = m.grafo.nodos.find(x => x.id === b.dataset.quitar); if (n) delete n.parametro; }));
    const hp = $('[data-a=hacer-param]', c);
    if (hp) hp.onclick = (e) => {
      const candidatos = m.grafo.nodos.filter(n => (n.tipo === 'color' || n.tipo === 'numero') && !n.parametro);
      menuBajo(e.currentTarget, candidatos.length ? candidatos.map(n => ({ texto: n.tipo === 'color' ? `Color ${n.valor}` : `Número ${n.valor} (${n.etiqueta || ''})`, accion: async () => { const nombre = await pedirTexto({ titulo: 'Nombre del parámetro', etiqueta: 'Nombre', valor: n.etiqueta || (n.tipo === 'color' ? 'tinte' : 'valor') }); if (nombre) doc.cambiar(() => { n.parametro = nombre; }); } })) : [{ texto: 'No hay colores ni números libres', desactivado: true }]);
    };
    const bi = $('[data-a=instancia]', c); if (bi) bi.onclick = crearInstancia;
    usadoEn().then(lista => { const u = $('.usado-en', c); if (u) u.innerHTML = lista.length ? lista.map(x => `<div class="fila-flex" style="padding:4px 0;font-size:14px"><span style="color:var(--ambar)">${icono('cubo', '', 15)}</span>${esc(x)}</div>`).join('') : '<div class="vacio-texto" style="text-align:left;padding:0">Ninguna malla lo usa todavía. Arrástralo sobre una malla en el visor 3D.</div>'; });
  }

  async function usadoEn() {
    const r = new Set();
    for (const a of archivosDeTipo('malla')) { try { const d = await est.proyecto.leerJSON(a.rel); if ((d.ranuras || []).some(x => x.material === doc.rel)) r.add(nombreBase(a.rel)); } catch {} }
    for (const a of est.archivos.filter(x => x.rel.endsWith('.fscn'))) {
      try { const e = normalizarEscena(await est.proyecto.leer(a.rel)); recorrer(e.raiz, n => { if (n.props.material === doc.rel) r.add(`${n.nombre.toLowerCase()}.malla (${sinExtension(a.rel)})`); }); } catch {}
    }
    return [...r];
  }

  async function crearInstancia() {
    const nombre = await pedirTexto({ titulo: 'Crear instancia de material', etiqueta: 'Nombre', valor: mat().nombre + '_variante' });
    if (!nombre) return;
    const rel = doc.rel.replace(/[^/]+$/, nombre.replace(/\.mat$/, '') + '.mat');
    const parametros = {};
    for (const n of mat().grafo.nodos) if (n.parametro) parametros[n.parametro] = n.valor;
    await est.proyecto.escribirJSON(rel, { formato: 'falcon-material', version: 1, nombre, base: doc.rel, parametros });
    await refrescarArchivos();
    log(`Instancia creada: ${rel}`, 'ok');
    abrirDocumento(rel);
  }

  montarGrafo();
  pintarDetalles();
  pintarPrevia();
  const pintarLuego = (() => { let t = 0; return () => { clearTimeout(t); t = setTimeout(pintarPrevia, 60); }; })();
  const quitar = [
    bus.on('doc:cambio', ({ doc: d, op }) => {
      if (d !== doc) return;
      pintarLuego();
      if (op && (op.soloPosicion || op.valor)) { if (op.valor && grafo) {} return; }
      if (grafo) grafo.pintar(); else pintarInstancia();
      pintarDetalles();
    }),
  ];
  return {
    destruir: () => {
      quitar.forEach(f => f()); partes.forEach(p => p.destruir && p.destruir());
      grafo && grafo.destruir(); ro.disconnect(); renderer.dispose();
      window.removeEventListener('mousemove', moverGiro); window.removeEventListener('mouseup', soltarGiro);
    },
  };
}
