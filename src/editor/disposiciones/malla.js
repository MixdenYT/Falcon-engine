// Editor de mallas (.malla): forma, materiales por ranura, LOD, colisión y física.
import * as THREE from 'three';
import { est, bus, abrirDocumento, archivosDeTipo, activarDocumento, log } from '../estado.js';
import { guardar } from '../acciones.js';
import { anadirNodo } from '../operaciones.js';
import { crearPestanas } from '../paneles/documentos.js';
import { Escena3D, geometriaPrimitiva, PRIMITIVAS, aplicarReflejos } from '../../motor/escena3d.js';
import { nombreBase, sinExtension } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menuBajo, avisar, interruptor } from '../../ui/componentes.js';

const NOMBRES_PRIM = { cubo: ['Cubo', 'cubo'], esfera: ['Esfera', 'esfera'], cilindro: ['Cilindro', 'cilindro'], plano: ['Plano', 'plano'], capsula: ['Cápsula', 'capsula'], cono: ['Cono', 'cono'], terreno: ['Terreno', 'terreno'], escalera: ['Escalera', 'escalera'] };

export async function crearDisposicionMalla(contenedor) {
  const doc = est.activo;
  const m = () => doc.datos;
  const raiz = el(`<div style="flex:1;min-height:0;display:flex;flex-direction:column"><div class="cab-material"></div><div class="disp-material"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div></div>`);
  contenedor.append(raiz);
  const [izq, centro, der] = $('.disp-material', raiz).children;
  const partes = [];
  const pest = crearPestanas($('.cab-material', raiz), {
    nuevo: false,
    derecha: (d) => {
      const r = el('<button class="btn secundario peq">Reimportar</button>');
      r.onclick = () => { escena3.invalidarModelo(m().fuente); construir(); log(`Reimportado: ${m().fuente || 'forma básica'}`, 'ok'); };
      const g = el('<button class="btn principal peq">Guardar</button>');
      g.onclick = async () => { await guardar(doc); bus.emit('malla:guardada', doc.rel); avisar('Malla guardada'); };
      d.append(r, g);
    },
  });
  pest.el.style.flex = '1';
  partes.push(pest);

  // ---------- Izquierda ----------
  const panelBasicas = el(`<section class="panel" style="flex:none"><div class="cab-panel"><h3>Crear malla básica</h3></div><div class="basicas-malla">${PRIMITIVAS.map(p => `<button class="basica" data-p="${p}">${icono(NOMBRES_PRIM[p][1], '', 20)}${NOMBRES_PRIM[p][0]}</button>`).join('')}</div></section>`);
  const panelRanuras = el(`<section class="panel" style="flex:none"><div class="cab-panel"><h3>Materiales de la malla</h3><button class="btn-mas" data-ayuda="Añadir ranura">${icono('mas', '', 15)}</button></div><div class="ranuras"></div><p style="margin:0 12px 12px;font-size:12px;color:var(--texto-2);line-height:1.5">Arrastra un material desde Recursos encima de la ranura o de la propia malla.</p></section>`);
  const panelLod = el(`<section class="panel" style="flex:1"><div class="cab-panel"><h3>Nivel de detalle</h3><span class="mono">LOD</span></div><div class="lods"></div></section>`);
  izq.append(panelBasicas, panelRanuras, panelLod);
  $$('[data-p]', panelBasicas).forEach(b => b.onclick = () => doc.cambiar(() => { m().primitiva = b.dataset.p; m().fuente = null; }));
  $('.btn-mas', panelRanuras).onclick = () => doc.cambiar(() => { m().ranuras.push({ nombre: 'ranura' + (m().ranuras.length + 1), material: '' }); });

  const muestra = (rel) => {
    const n = (rel || '').toLowerCase();
    if (n.includes('madera')) return 'radial-gradient(circle at 35% 30%, #D29A60, #8A5A2E 60%, #40260F)';
    if (n.includes('metal')) return 'radial-gradient(circle at 35% 30%, #FFFFFF, #A7AEB2 45%, #3D4245)';
    if (n.includes('piedra')) return 'radial-gradient(circle at 35% 30%, #CFC6B4, #7E7666 60%, #3E3A33)';
    if (n.includes('llama') || n.includes('brillo')) return 'radial-gradient(circle at 40% 35%, #FFE0B0, #FF8A2A 50%, #6B2A00)';
    return rel ? 'radial-gradient(circle at 35% 30%, #DDD, #777 60%, #333)' : 'repeating-conic-gradient(#333 0 25%, #222 0 50%) 0 0 / 8px 8px';
  };
  function pintarRanuras() {
    const c = $('.ranuras', panelRanuras);
    c.innerHTML = m().ranuras.map((r, i) => `<div class="ranura" data-i="${i}"><label>Ranura ${i + 1} · ${esc(r.nombre)}</label><div class="sel-mat"><span class="esfera" style="background:${muestra(r.material)}"></span>${esc(r.material ? nombreBase(r.material) : 'Sin material')}${icono('flechaAbajo', '', 13)}</div></div>`).join('');
    $$('.ranura', c).forEach(rn => {
      const i = Number(rn.dataset.i);
      rn.querySelector('.sel-mat').onclick = (e) => menuBajo(e.currentTarget, [
        ...archivosDeTipo('material').map(a => ({ texto: a.rel, icono: 'material', marcado: a.rel === m().ranuras[i].material, accion: () => doc.cambiar(() => { m().ranuras[i].material = a.rel; }) })),
        '-', { texto: 'Sin material', accion: () => doc.cambiar(() => { m().ranuras[i].material = ''; }) },
        ...(m().ranuras[i].material ? [{ texto: 'Editar este material', icono: 'lapiz', accion: () => abrirDocumento(m().ranuras[i].material) }] : []),
        ...(m().ranuras.length > 1 ? [{ texto: 'Quitar la ranura', icono: 'papelera', peligro: true, accion: () => doc.cambiar(() => { m().ranuras.splice(i, 1); }) }] : []),
      ]);
      rn.ondragover = (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) { e.preventDefault(); rn.classList.add('encima'); } };
      rn.ondragleave = () => rn.classList.remove('encima');
      rn.ondrop = (e) => { rn.classList.remove('encima'); const rel = e.dataTransfer.getData('text/falcon-archivo'); if (rel.endsWith('.mat')) doc.cambiar(() => { m().ranuras[i].material = rel; }); else avisar('Suelta un material (.mat).', 'aviso'); };
    });
  }
  let lodSel = 0;
  const TEXTO_LOD = ['Máximo detalle · de cerca', 'Medio · a media distancia', 'Bajo · de lejos'];
  function pintarLod() {
    const c = $('.lods', panelLod);
    const lods = m().lod && m().lod.length ? m().lod : [{ nivel: 0, distancia: 0 }];
    while (lods.length < 3) lods.push({ nivel: lods.length, distancia: lods.length * 20 });
    c.innerHTML = lods.slice(0, 3).map((l, i) => `<div class="lod ${i === lodSel ? 'sel' : ''}" data-i="${i}"><b>LOD ${i}</b><span>${TEXTO_LOD[i]}</span>${i ? `<span class="mono" style="margin-left:auto;font-size:12px">${l.distancia} m</span>` : ''}</div>`).join('');
    $$('.lod', c).forEach(x => x.onclick = () => { lodSel = Number(x.dataset.i); pintarLod(); construir(); });
  }

  // ---------- Centro: visor ----------
  const panelVisor = el(`<section class="panel visor"><div class="barra-visor">
    <div class="segmentado peq modo-vista"><button data-v="texturas" class="activo">Con texturas</button><button data-v="solido">Sólido</button><button data-v="alambre">Alambre</button></div>
    <div class="separador-v"></div>
    <button class="btn secundario peq activo" data-t="colision">${icono('check', '', 14)}Colisión</button>
    <button class="btn secundario peq" data-t="normales">Normales</button>
    <button class="btn secundario peq activo" data-t="ejes">${icono('check', '', 14)}Ejes</button>
    <button class="btn secundario peq" data-a="luz" style="margin-left:auto">Luz de estudio ${icono('flechaAbajo', '', 13)}</button>
    </div><div class="lienzo-visor"><canvas></canvas><div class="estadisticas-malla"></div><div class="pildora-colision"></div></div></section>`);
  centro.append(panelVisor);
  const lienzo = $('canvas', panelVisor);
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const escena3 = new Escena3D(est.proyecto, { editor: true, alCambiar: () => dibujar() });
  const scene = escena3.scene;
  aplicarReflejos(renderer, scene, 0.8);
  scene.background = new THREE.Color('#0B0E0C');
  const camara = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  const ver = { modo: 'texturas', colision: true, normales: false, ejes: true, luz: 'estudio' };
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(3, 5, 4); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
  scene.add(sol);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShadowMaterial({ opacity: 0.45 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  const rejilla = new THREE.GridHelper(20, 20, 0x1E2521, 0x151A17);
  scene.add(suelo, rejilla);
  let objeto = null, ayudantes = new THREE.Group();
  scene.add(ayudantes);
  let orbita = { yaw: 0.75, pitch: 0.42, dist: 3 };
  let centroObj = new THREE.Vector3(0, 0.5, 0);

  async function construir() {
    if (objeto) scene.remove(objeto);
    ayudantes.clear();
    const nodoFalso = { id: 'previa', nombre: 'previa', tipo: 'Malla3D', props: { malla: '__x', material: '', color: '#8A8F8C', rugosidad: 0.7, metalico: 0, sombras: m().sombras !== false, escala: [1, 1, 1] }, hijos: [] };
    let obj;
    if (m().fuente) obj = await escena3.crearDesdeMalla(doc.rel, nodoFalso).catch(() => null);
    else {
      const matRel = m().ranuras[0]?.material;
      obj = new THREE.Mesh(geometriaPrimitiva(m().primitiva || 'cubo'), matRel ? await escena3.material(matRel) : new THREE.MeshStandardMaterial({ color: 0x8A8F8C, roughness: 0.7 }));
      obj.scale.multiplyScalar(m().escala || 1);
    }
    if (!obj) obj = new THREE.Mesh(geometriaPrimitiva('cubo'), new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
    // Simplificación aproximada para los LOD 1 y 2 (solo en la vista previa).
    if (lodSel > 0) obj.traverse(o => { if (o.isMesh && o.geometry && o.geometry.index) { const g = o.geometry.clone(); const idx = g.index.array; const paso = lodSel === 1 ? 2 : 4; const nuevo = []; for (let i = 0; i < idx.length; i += 3 * paso) nuevo.push(idx[i], idx[i + 1], idx[i + 2]); g.setIndex(nuevo); o.geometry = g; } });
    obj.traverse(o => { if (o.isMesh) { o.castShadow = m().sombras !== false; o.receiveShadow = true; } });
    objeto = obj;
    scene.add(obj);
    const caja = new THREE.Box3().setFromObject(obj);
    centroObj = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());
    orbita.dist = Math.max(1.5, tam.length() * 1.6);
    suelo.scale.setScalar(Math.max(tam.x, tam.z) * 0.9 || 1);
    suelo.position.y = caja.min.y + 0.001;
    rejilla.position.y = caja.min.y;
    // Colisión
    if (ver.colision) {
      let geo;
      const c = m().colision || 'caja';
      if (c === 'esfera') geo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(Math.max(tam.x, tam.y, tam.z) / 2 * 1.02, 1));
      else if (c === 'capsula') geo = new THREE.EdgesGeometry(new THREE.CapsuleGeometry(Math.max(tam.x, tam.z) / 2, Math.max(0.01, tam.y - Math.max(tam.x, tam.z)), 4, 10));
      else if (c === 'exacta') geo = null;
      else geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(tam.x * 1.02, tam.y * 1.02, tam.z * 1.02));
      if (geo) {
        const lineas = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: 0x3DDC84, dashSize: 0.06, gapSize: 0.05, depthTest: false }));
        lineas.computeLineDistances();
        lineas.position.copy(centroObj);
        lineas.renderOrder = 10;
        ayudantes.add(lineas);
      } else obj.traverse(o => { if (o.isMesh) { const w = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: 0x3DDC84, wireframe: true, transparent: true, opacity: 0.35 })); o.updateWorldMatrix(true, false); w.applyMatrix4(o.matrixWorld); ayudantes.add(w); } });
    }
    if (ver.normales) obj.traverse(o => { if (o.isMesh) { const n = crearNormales(o); if (n) ayudantes.add(n); } });
    if (ver.ejes) {
      const e = new THREE.AxesHelper(Math.max(0.6, tam.length() * 0.35));
      e.position.set(caja.min.x - 0.25, caja.min.y, caja.max.z + 0.25);
      ayudantes.add(e);
    }
    // Estadísticas
    let tris = 0, verts = 0;
    obj.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; verts += g.attributes.position.count; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } });
    $('.estadisticas-malla', panelVisor).innerHTML = `<span>Triángulos</span><span>${Math.round(tris).toLocaleString('es')}</span><span>Vértices</span><span>${verts.toLocaleString('es')}</span><span>Tamaño</span><span>${[tam.x, tam.y, tam.z].map(v => v.toFixed(2).replace('.', ',')).join(' × ')} m</span>`;
    const nombresCol = { caja: 'caja', esfera: 'esfera', capsula: 'cápsula', exacta: 'exacta' };
    $('.pildora-colision', panelVisor).innerHTML = `<span style="letter-spacing:-1px">- -</span> Colisión: ${nombresCol[m().colision || 'caja']}${m().colision_auto !== false ? ' automática' : ''}`;
    $('.pildora-colision', panelVisor).style.display = ver.colision ? '' : 'none';
    aplicarModoVista();
    dibujar();
  }

  function crearNormales(o) {
    const g = o.geometry;
    if (!g.attributes.normal) return null;
    const pos = g.attributes.position, nor = g.attributes.normal;
    const pts = [];
    const paso = Math.max(1, Math.floor(pos.count / 400));
    o.updateWorldMatrix(true, false);
    const mN = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < pos.count; i += paso) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const n = new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(mN).normalize().multiplyScalar(0.12);
      pts.push(p, p.clone().add(n));
    }
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x74B6F7 }));
  }

  const materialSolido = new THREE.MeshStandardMaterial({ color: 0xB7BDB9, roughness: 0.8 });
  const materialAlambre = new THREE.MeshBasicMaterial({ color: 0x9AA59F, wireframe: true });
  function aplicarModoVista() {
    scene.overrideMaterial = null;
    if (!objeto) return;
    objeto.traverse(o => {
      if (!o.isMesh) return;
      o.userData.original ||= o.material;
      o.material = ver.modo === 'solido' ? materialSolido : ver.modo === 'alambre' ? materialAlambre : o.userData.original;
    });
  }

  function aplicarLuz() {
    const l = ver.luz;
    if (l === 'exterior') { escena3.hemi.color.set('#cfe3ff'); escena3.hemi.groundColor.set('#4a3c2a'); escena3.hemi.intensity = 1.6; sol.intensity = 3; sol.color.set('#fff3dd'); scene.background = new THREE.Color('#1B2730'); }
    else if (l === 'noche') { escena3.hemi.color.set('#344a6e'); escena3.hemi.groundColor.set('#0a0c10'); escena3.hemi.intensity = 0.8; sol.intensity = 0.9; sol.color.set('#9fb7ff'); scene.background = new THREE.Color('#06080C'); }
    else { escena3.hemi.color.set('#dfe8ff'); escena3.hemi.groundColor.set('#2a2620'); escena3.hemi.intensity = 1.3; sol.intensity = 2.4; sol.color.set('#ffffff'); scene.background = new THREE.Color('#0B0E0C'); }
  }

  function dibujar() {
    const r = lienzo.getBoundingClientRect();
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(r.width, r.height, false);
    camara.aspect = r.width / Math.max(1, r.height);
    camara.position.set(centroObj.x + Math.sin(orbita.yaw) * Math.cos(orbita.pitch) * orbita.dist, centroObj.y + Math.sin(orbita.pitch) * orbita.dist, centroObj.z + Math.cos(orbita.yaw) * Math.cos(orbita.pitch) * orbita.dist);
    camara.lookAt(centroObj);
    camara.updateProjectionMatrix();
    renderer.render(scene, camara);
  }

  let arr = null;
  lienzo.addEventListener('mousedown', (e) => { arr = { x: e.clientX, y: e.clientY }; });
  const mover = (e) => { if (!arr) return; orbita.yaw -= (e.clientX - arr.x) * 0.008; orbita.pitch = Math.max(-1.3, Math.min(1.4, orbita.pitch + (e.clientY - arr.y) * 0.008)); arr = { x: e.clientX, y: e.clientY }; dibujar(); };
  const soltar = () => { arr = null; };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
  lienzo.addEventListener('wheel', (e) => { e.preventDefault(); orbita.dist = Math.max(0.3, orbita.dist * (e.deltaY > 0 ? 1.1 : 0.9)); dibujar(); }, { passive: false });
  lienzo.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) e.preventDefault(); });
  lienzo.addEventListener('drop', (e) => { const rel = e.dataTransfer.getData('text/falcon-archivo'); if (rel.endsWith('.mat')) doc.cambiar(() => { m().ranuras[0].material = rel; }); else if (/\.(glb|gltf)$/i.test(rel)) doc.cambiar(() => { m().fuente = rel; m().primitiva = null; }); });
  $$('[data-v]', panelVisor).forEach(b => b.onclick = () => { ver.modo = b.dataset.v; $$('[data-v]', panelVisor).forEach(x => x.classList.toggle('activo', x === b)); aplicarModoVista(); dibujar(); });
  $$('[data-t]', panelVisor).forEach(b => b.onclick = () => { ver[b.dataset.t] = !ver[b.dataset.t]; b.classList.toggle('activo', ver[b.dataset.t]); b.innerHTML = (ver[b.dataset.t] ? icono('check', '', 14) : '') + { colision: 'Colisión', normales: 'Normales', ejes: 'Ejes' }[b.dataset.t]; construir(); });
  $('[data-a=luz]', panelVisor).onclick = (e) => menuBajo(e.currentTarget, [['estudio', 'Luz de estudio'], ['exterior', 'Exterior'], ['noche', 'Noche']].map(([k, t]) => ({ texto: t, marcado: ver.luz === k, accion: () => { ver.luz = k; e.target.closest('button').innerHTML = `${t} ${icono('flechaAbajo', '', 13)}`; aplicarLuz(); dibujar(); } })));
  const ro = new ResizeObserver(() => dibujar());
  ro.observe(lienzo);

  // ---------- Derecha ----------
  let pestDer = 'detalles';
  const panelDer = el(`<section class="panel" style="flex:1"><div class="pestanas"><button data-p="detalles" class="activo">Detalles</button><button data-p="importacion">Importación</button></div><div class="desplazable cont-malla"></div></section>`);
  der.append(panelDer);
  $$('.pestanas button', panelDer).forEach(b => b.onclick = () => { pestDer = b.dataset.p; $$('.pestanas button', panelDer).forEach(x => x.classList.toggle('activo', x === b)); pintarDetalles(); });

  function pintarDetalles() {
    const c = $('.cont-malla', panelDer);
    const d = m();
    if (pestDer === 'importacion') {
      c.innerHTML = `<div class="seccion-insp"><div class="titulo-seccion">Archivo de origen</div>
        <div class="prop"><label>Origen</label><div class="valor mono" style="font-size:12px">${esc(d.fuente || 'forma básica: ' + (d.primitiva || 'cubo'))}</div></div>
        <button class="btn secundario ancho" data-a="origen">${icono('carpeta', '', 15)}Usar otro modelo (.glb)…</button></div>`;
      $('[data-a=origen]', c).onclick = (e) => menuBajo(e.currentTarget, archivosDeTipo('modelo').map(a => ({ texto: a.rel, icono: 'cubo', accion: () => doc.cambiar(() => { d.fuente = a.rel; d.primitiva = null; }) })).concat(archivosDeTipo('modelo').length ? [] : [{ texto: 'No hay modelos .glb importados', desactivado: true }]));
      return;
    }
    c.innerHTML = `<div class="seccion-insp"><div class="titulo-seccion">Colisión</div><p style="font-size:13px;color:var(--texto-2);margin:0 0 12px;line-height:1.5">La forma invisible con la que el objeto choca. Cuanto más simple, más rápido va el juego.</p>
        <div class="segmentado lleno" style="margin-bottom:10px">${[['caja', 'Caja'], ['esfera', 'Esfera'], ['capsula', 'Cápsula'], ['exacta', 'Exacta']].map(([k, t]) => `<button data-c="${k}" class="${(d.colision || 'caja') === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <button class="btn secundario ancho" data-a="auto">Generar automáticamente</button></div>
      <div class="seccion-insp"><div class="titulo-seccion">Física</div>
        <div class="prop"><label>Se puede empujar</label><div class="valor">${interruptor(!!d.empujable, '', 'empujable')}</div></div>
        <div class="prop"><label>Peso</label><div class="valor"><input class="campo" data-k="peso" value="${esc(d.peso ?? 10)} kg"></div></div>
        <div class="prop"><label>Proyecta sombras</label><div class="valor">${interruptor(d.sombras !== false, '', 'sombras')}</div></div></div>
      <div class="seccion-insp"><div class="titulo-seccion">Importación</div>
        <div class="prop"><label>Escala</label><div class="valor"><input class="campo mono" data-k="escala" value="${esc(d.escala ?? 1)}"></div></div>
        <div class="prop"><label>Eje hacia arriba</label><div class="valor"><div class="segmentado peq lleno" style="flex:1"><button data-e="Y" class="${(d.eje_arriba || 'Y') === 'Y' ? 'activo' : ''}">Y</button><button data-e="Z" class="${d.eje_arriba === 'Z' ? 'activo' : ''}">Z</button></div></div></div>
        <div class="prop"><label>Origen fuente</label><div class="valor mono" style="font-size:12px;color:var(--texto-2)">${esc(d.fuente || '(forma básica)')}</div></div></div>
      <div style="padding:14px 12px"><button class="btn principal ancho grande" data-a="colocar">Colocar en la escena</button></div>`;
    $$('[data-c]', c).forEach(b => b.onclick = () => doc.cambiar(() => { d.colision = b.dataset.c; d.colision_auto = false; }));
    $('[data-a=auto]', c).onclick = () => {
      // Elige la forma más sencilla que se ajusta: esfera si es casi cúbica y redonda, cápsula si es alta, caja si no.
      const caja = objeto ? new THREE.Box3().setFromObject(objeto).getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
      const forma = d.primitiva === 'esfera' ? 'esfera' : d.primitiva === 'capsula' || caja.y > Math.max(caja.x, caja.z) * 1.8 ? 'capsula' : 'caja';
      doc.cambiar(() => { d.colision = forma; d.colision_auto = true; });
      avisar(`Colisión automática: ${forma}`);
    };
    $('[data-campo=empujable]', c).onchange = (e) => doc.cambiar(() => { d.empujable = e.target.checked; });
    $('[data-campo=sombras]', c).onchange = (e) => doc.cambiar(() => { d.sombras = e.target.checked; });
    $('[data-k=peso]', c).onchange = (e) => doc.cambiar(() => { d.peso = Math.max(0.1, Number(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')) || 1); });
    $('[data-k=escala]', c).onchange = (e) => doc.cambiar(() => { d.escala = Math.max(0.001, Number(e.target.value.replace(',', '.')) || 1); });
    $$('[data-e]', c).forEach(b => b.onclick = () => doc.cambiar(() => { d.eje_arriba = b.dataset.e; }));
    $('[data-a=colocar]', c).onclick = colocar;
  }

  async function colocar() {
    await guardar(doc);
    let esc3 = est.docs.find(x => x.tipo === 'escena' && x.dim === '3D' && x.rel === est.ultimoDocDe.escena3D) || est.docs.find(x => x.tipo === 'escena' && x.dim === '3D');
    if (!esc3) { avisar('Abre una escena 3D para colocar la malla.', 'aviso'); return; }
    const d = m();
    activarDocumento(esc3);
    anadirNodo(esc3, 'Malla3D', { nombre: sinExtension(doc.rel).replace(/^./, c => c.toUpperCase()), props: { malla: doc.rel, colision: d.colision === 'esfera' ? 'esfera' : 'caja', empujable: !!d.empujable, peso: d.peso ?? 10, sombras: d.sombras !== false, posicion: [0, 0, 0] }, padre: esc3.datos.raiz.id });
  }

  pintarRanuras();
  pintarLod();
  pintarDetalles();
  aplicarLuz();
  await construir();
  const quitar = [
    bus.on('doc:cambio', ({ doc: d }) => { if (d !== doc) return; pintarRanuras(); pintarDetalles(); construir(); }),
    bus.on('material:guardado', (rel) => { escena3.invalidarMaterial(rel); construir(); }),
  ];
  return {
    destruir: () => {
      quitar.forEach(f => f()); partes.forEach(p => p.destruir && p.destruir());
      ro.disconnect(); renderer.dispose();
      window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar);
    },
  };
}
