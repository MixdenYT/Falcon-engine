// Visor de escenas 3D del editor.
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { est, bus, anotarEvento } from '../estado.js';
import { seleccionar } from '../acciones.js';
import { anadirNodo, eliminarNodos, cambiarNodo, duplicarNodos } from '../operaciones.js';
import { Escena3D, aplicarTransformacion, aplicarReflejos } from '../../motor/escena3d.js';
import { Lumbre } from '../../motor/lumbre.js';
import { resolverCalidad, CALIDADES, NOMBRES_OPCION } from '../../motor/graficos.js';
import { buscarNodo, buscarPadre, recorrer } from '../../motor/tipos.js';
import { tipoRecurso, sinExtension } from '../../motor/proyecto.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menuBajo, menu, avisar } from '../../ui/componentes.js';
import { menuTipos } from '../paneles/arbol.js';

const RAD = Math.PI / 180;

export async function crearVisor3D(contenedor, op = {}) {
  const raiz = el(`<section class="panel visor visor-3d">
    <div class="barra-visor">
      <div class="herramientas-visor">
        <button data-h="seleccionar" data-ayuda="Seleccionar (Q)">${icono('cursor', '', 16)}</button>
        <button data-h="mover" data-ayuda="Mover (W)">${icono('mover', '', 16)}</button>
        <button data-h="rotar" data-ayuda="Rotar (E)">${icono('rotar', '', 16)}</button>
        <button data-h="escalar" data-ayuda="Escalar (R)">${icono('escalar', '', 16)}</button>
      </div>
      <button class="btn secundario peq" data-a="espacio">Local ${icono('flechaAbajo', '', 13)}</button>
      <button class="btn secundario peq" data-a="proyeccion">Perspectiva ${icono('flechaAbajo', '', 13)}</button>
      <button class="btn secundario peq" data-a="sombreado">Iluminado ${icono('flechaAbajo', '', 13)}</button>
      <button class="btn secundario peq" data-a="previa" style="margin-left:auto">${icono('camara', '', 15)}Vista previa de cámara</button>
    </div>
    <div class="lienzo-visor"><canvas tabindex="0"></canvas><div class="iconos-3d"></div><canvas class="ejes-3d" width="168" height="168"></canvas>
      <div class="pildoras-visor"><span class="pildora"><span class="punto ambar"></span>3D</span><span class="pildora">Clic derecho + WASD para volar</span></div>
    </div></section>`);
  contenedor.append(raiz);
  const lienzo = $('.lienzo-visor > canvas', raiz);
  const capaIconos = $('.iconos-3d', raiz);
  const ejesCanvas = $('.ejes-3d', raiz);
  const ejesCtx = ejesCanvas.getContext('2d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let sucio = true;
  let vivo = true;
  const escena = new Escena3D(est.proyecto, { editor: true, alCambiar: () => { sucio = true; } });
  const ayudantes = new THREE.Group();
  escena.scene.add(ayudantes);
  // Cuadrícula del suelo y ejes.
  const rejilla = new THREE.GridHelper(200, 200, 0x2A332E, 0x161B18);
  rejilla.material.transparent = true; rejilla.material.opacity = 0.9;
  ayudantes.add(rejilla);
  const lineaX = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-100, 0.002, 0), new THREE.Vector3(100, 0.002, 0)]), new THREE.LineBasicMaterial({ color: 0x8a3a3a }));
  const lineaZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.002, -100), new THREE.Vector3(0, 0.002, 100)]), new THREE.LineBasicMaterial({ color: 0x2f5f8a }));
  ayudantes.add(lineaX, lineaZ);
  const caja = new THREE.Box3Helper(new THREE.Box3(), 0x3DDC84);
  caja.visible = false;
  ayudantes.add(caja);
  const sombraSel = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  sombraSel.rotation.x = -Math.PI / 2; sombraSel.visible = false;
  ayudantes.add(sombraSel);

  const camPersp = new THREE.PerspectiveCamera(55, 1, 0.05, 2000);
  const camOrto = new THREE.OrthographicCamera(-10, 10, 10, -10, -1000, 1000);
  let ortografica = false;
  let camara = camPersp;
  const controles = new TransformControls(camPersp, lienzo);
  controles.setSize(0.9);
  const gizmo = controles.getHelper();
  escena.scene.add(gizmo);
  let herramienta = est._herramienta3d || 'mover';
  let sombreado = 'iluminado';
  let previa = false;
  let renderPrevia = null;

  const doc = () => (est.activo && est.activo.tipo === 'escena' && est.activo.dim === '3D') ? est.activo : null;
  const estadoCam = () => {
    const d = doc();
    if (!d) return { pos: [8, 6, 10], yaw: 0.68, pitch: -0.35 };
    return d.vista.cam3d ||= { pos: [8, 6.5, 10], yaw: 0.68, pitch: -0.38 };
  };

  function aplicarCamara() {
    const c = estadoCam();
    camPersp.position.set(...c.pos);
    camPersp.rotation.set(c.pitch, c.yaw, 0, 'YXZ');
    camOrto.position.copy(camPersp.position);
    camOrto.quaternion.copy(camPersp.quaternion);
    const r = lienzo.getBoundingClientRect();
    const asp = r.width / Math.max(1, r.height);
    camPersp.aspect = asp; camPersp.updateProjectionMatrix();
    const alto = c.ortoTam || 12;
    camOrto.left = -alto * asp / 2; camOrto.right = alto * asp / 2; camOrto.top = alto / 2; camOrto.bottom = -alto / 2;
    camOrto.updateProjectionMatrix();
    camara = ortografica ? camOrto : camPersp;
    controles.camera = camara;
  }

  async function construir() {
    const d = doc();
    if (!d) return;
    await escena.construir(d.datos.raiz);
    aplicarReflejos(renderer, escena.scene, 0.35);
    if (typeof lumbre !== 'undefined') { lumbre.marcarCambio(); configurarLumbre(); }
    escena.scene.add(ayudantes, gizmo);
    vincularSeleccion();
    sucio = true;
  }

  // ---------- Selección ----------
  function objetoSel() {
    const d = doc();
    const n = d && d.nodoSel;
    return n ? escena.objetos.get(n.id) : null;
  }

  function vincularSeleccion() {
    const o = objetoSel();
    const d = doc();
    if (o && herramienta !== 'seleccionar' && d.nodoSel !== d.datos.raiz && d.nodoSel.tipo !== 'Entorno') { controles.attach(o); controles.setMode({ mover: 'translate', rotar: 'rotate', escalar: 'scale' }[herramienta]); }
    else controles.detach();
    actualizarCaja();
    sucio = true;
  }

  function actualizarCaja() {
    const o = objetoSel();
    if (!o) { caja.visible = false; sombraSel.visible = false; return; }
    const b = new THREE.Box3().setFromObject(o.userData.malla || o, true);
    if (b.isEmpty() || !isFinite(b.min.x)) { caja.visible = false; sombraSel.visible = false; return; }
    caja.box.copy(b).expandByScalar(0.02);
    caja.visible = true;
    const t = b.getSize(new THREE.Vector3());
    sombraSel.scale.set(Math.max(t.x, t.z) * 0.62, Math.max(t.x, t.z) * 0.62, 1);
    sombraSel.position.set((b.min.x + b.max.x) / 2, b.min.y + 0.003, (b.min.z + b.max.z) / 2);
    sombraSel.visible = b.min.y > -0.05 && b.min.y < 0.3;
  }

  const raycaster = new THREE.Raycaster();
  function elegir(px, py) {
    const r = lienzo.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(px / r.width * 2 - 1, -(py / r.height) * 2 + 1), camara);
    const objetos = [...escena.objetos.values()].filter(o => o !== escena.objetos.get(doc().datos.raiz.id));
    const hits = raycaster.intersectObjects(escena.scene.children.filter(c => c !== ayudantes && c !== gizmo), true);
    for (const h of hits) {
      if (!h.object.visible || h.object.isLine || h.object.isPoints) continue;
      for (let o = h.object; o; o = o.parent) {
        if (o.userData.nodoId !== undefined && o !== escena.objetos.get(doc().datos.raiz.id)) return o.userData.nodoId;
      }
    }
    return null;
  }

  controles.addEventListener('dragging-changed', (e) => {
    const d = doc();
    if (e.value) { controles._clave = 'gizmo-' + Date.now(); return; }
    anotarEvento('nodo_movido');
    const n = d && d.nodoSel;
    if (n && est.juego.activo) for (const k of ['posicion', 'rotacion', 'escala']) window.falcon.juego.enviar({ tipo: 'propiedad', id: n.id, clave: k, valor: n.props[k] });
  });
  controles.addEventListener('objectChange', () => {
    const d = doc();
    const o = controles.object;
    if (!d || !o) return;
    const id = o.userData.nodoId;
    const r = (v) => Math.round(v * 1000) / 1000;
    const ajustar = est._ajustar3d;
    const snap = (v, paso) => ajustar ? Math.round(v / paso) * paso : v;
    d.cambiar((e) => {
      const n = buscarNodo(e.raiz, id);
      if (!n) return;
      if (herramienta === 'mover') n.props.posicion = [r(snap(o.position.x, 0.5)), r(snap(o.position.y, 0.5)), r(snap(o.position.z, 0.5))];
      if (herramienta === 'rotar') n.props.rotacion = [r(o.rotation.x / RAD), r(o.rotation.y / RAD), r(o.rotation.z / RAD)];
      if (herramienta === 'escalar') n.props.escala = [r(o.scale.x), r(o.scale.y), r(o.scale.z)];
    }, { fusionar: controles._clave, prop: herramienta === 'mover' ? 'posicion' : herramienta === 'rotar' ? 'rotacion' : 'escala', id, desde3d: true });
    actualizarCaja();
    sucio = true;
  });

  // ---------- Navegación ----------
  const teclas = new Set();
  let volando = false, arrastre = null;
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
  lienzo.addEventListener('mousedown', (e) => {
    const d = doc();
    if (!d) return;
    lienzo.focus();
    const r = lienzo.getBoundingClientRect();
    if (e.button === 2) { volando = true; arrastre = { x: e.clientX, y: e.clientY, movido: false, tipo: 'mirar' }; lienzo.requestPointerLock?.(); return; }
    if (e.button === 1) { arrastre = { x: e.clientX, y: e.clientY, tipo: 'pan' }; e.preventDefault(); return; }
    if (e.button === 0 && e.altKey) { arrastre = { x: e.clientX, y: e.clientY, tipo: 'orbita', centro: centroOrbita() }; return; }
    if (e.button === 0) {
      if (controles.dragging || controles.axis) return;
      arrastre = { x: e.clientX, y: e.clientY, tipo: 'clic' };
    }
  });
  const alMover = (e) => {
    if (!vivo || !arrastre) return;
    const c = estadoCam();
    const dx = e.movementX ?? (e.clientX - arrastre.x), dy = e.movementY ?? (e.clientY - arrastre.y);
    if (arrastre.tipo === 'mirar') {
      c.yaw -= dx * 0.0035; c.pitch = Math.max(-1.55, Math.min(1.55, c.pitch - dy * 0.0035));
      if (Math.abs(dx) + Math.abs(dy) > 2) arrastre.movido = true;
      anotarEvento('vista_movida');
    } else if (arrastre.tipo === 'pan') {
      const vel = 0.012 * Math.max(1, Math.hypot(...c.pos) / 10);
      const der = new THREE.Vector3(1, 0, 0).applyQuaternion(camPersp.quaternion), arr = new THREE.Vector3(0, 1, 0).applyQuaternion(camPersp.quaternion);
      c.pos = c.pos.map((v, i) => v - der.getComponent(i) * dx * vel + arr.getComponent(i) * dy * vel);
      anotarEvento('vista_movida');
    } else if (arrastre.tipo === 'orbita') {
      const centro = arrastre.centro;
      const v = new THREE.Vector3(...c.pos).sub(centro);
      v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.005);
      const lado = new THREE.Vector3(1, 0, 0).applyQuaternion(camPersp.quaternion);
      v.applyAxisAngle(lado, -dy * 0.005);
      c.pos = centro.clone().add(v).toArray();
      const dir = centro.clone().sub(new THREE.Vector3(...c.pos)).normalize();
      c.yaw = Math.atan2(-dir.x, -dir.z); c.pitch = Math.asin(dir.y);
    } else return;
    arrastre.x = e.clientX; arrastre.y = e.clientY;
    sucio = true;
  };
  const alSoltar = (e) => {
    if (!vivo || !arrastre) return;
    const a = arrastre;
    arrastre = null;
    if (a.tipo === 'mirar') { volando = false; if (document.pointerLockElement === lienzo) document.exitPointerLock(); if (!a.movido) menuContextual(e); }
    if (a.tipo === 'clic' && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 4) {
      const d = doc();
      const r = lienzo.getBoundingClientRect();
      const id = elegir(e.clientX - r.left, e.clientY - r.top);
      if (e.ctrlKey && id) seleccionar(d.seleccion.includes(id) ? d.seleccion.filter(x => x !== id) : [...d.seleccion, id], d);
      else seleccionar(id ? [seleccionable(d, id)] : [], d);
    }
  };
  window.addEventListener('mousemove', alMover);
  window.addEventListener('mouseup', alSoltar);

  // Un clic en el ojo o la llama de un objeto elige el objeto «con sentido» (no la pieza interna).
  function seleccionable(d, id) {
    const n = buscarNodo(d.datos.raiz, id);
    const p = buscarPadre(d.datos.raiz, id);
    if (n && p && p !== d.datos.raiz && (p.tipo === 'Personaje3D' || p.tipo === 'Luz3D') && !d.seleccion.includes(p.id) && !d.seleccion.includes(id)) return p.id;
    return id;
  }

  function centroOrbita() {
    const o = objetoSel();
    if (o) return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const c = estadoCam();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camPersp.quaternion);
    return new THREE.Vector3(...c.pos).add(dir.multiplyScalar(10));
  }

  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    const c = estadoCam();
    if (ortografica) { c.ortoTam = Math.max(1, (c.ortoTam || 12) * (e.deltaY > 0 ? 1.12 : 1 / 1.12)); }
    else {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camPersp.quaternion);
      const paso = Math.max(0.4, Math.hypot(...c.pos) * 0.08) * (e.deltaY > 0 ? -1 : 1);
      c.pos = c.pos.map((v, i) => v + dir.getComponent(i) * paso);
    }
    anotarEvento('zoom');
    sucio = true;
  }, { passive: false });

  const teclaAbajo = (e) => {
    if (!vivo) return;
    if (volando) { teclas.add(e.code); e.preventDefault(); return; }
    if (document.activeElement !== lienzo) return;
    const d = doc();
    const mapa = { KeyQ: 'seleccionar', KeyW: 'mover', KeyE: 'rotar', KeyR: 'escalar' };
    if (mapa[e.code] && !e.ctrlKey) { fijarHerramienta(mapa[e.code]); return; }
    if (e.code === 'KeyF') { enfocar(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && d) { eliminarNodos(d); e.preventDefault(); }
  };
  const teclaArriba = (e) => teclas.delete(e.code);
  window.addEventListener('keydown', teclaAbajo, true);
  window.addEventListener('keyup', teclaArriba, true);

  function volar(dt) {
    if (!volando || !teclas.size) return;
    const c = estadoCam();
    const v = (teclas.has('ShiftLeft') ? 18 : 6) * dt;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camPersp.quaternion), r = new THREE.Vector3(1, 0, 0).applyQuaternion(camPersp.quaternion);
    const m = new THREE.Vector3();
    if (teclas.has('KeyW')) m.add(f); if (teclas.has('KeyS')) m.sub(f);
    if (teclas.has('KeyD')) m.add(r); if (teclas.has('KeyA')) m.sub(r);
    if (teclas.has('KeyE')) m.y += 1; if (teclas.has('KeyQ')) m.y -= 1;
    if (m.lengthSq()) { m.normalize().multiplyScalar(v); c.pos = c.pos.map((x, i) => x + m.getComponent(i)); sucio = true; anotarEvento('vista_movida'); }
  }

  function enfocar() {
    const o = objetoSel();
    if (!o) return;
    const b = new THREE.Box3().setFromObject(o);
    const centro = b.getCenter(new THREE.Vector3());
    const r = Math.max(1.5, b.getSize(new THREE.Vector3()).length());
    const c = estadoCam();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camPersp.quaternion);
    c.pos = centro.clone().sub(dir.multiplyScalar(r * 1.6)).toArray();
    sucio = true;
  }

  function menuContextual(e) {
    const d = doc();
    if (!d) return;
    const r = lienzo.getBoundingClientRect();
    const id = elegir(e.clientX - r.left, e.clientY - r.top);
    if (id && !d.seleccion.includes(id)) seleccionar([id], d);
    menu(e.clientX, e.clientY, [
      { texto: 'Añadir nodo…', icono: 'mas', accion: () => menuTipos(e.clientX, e.clientY, d) },
      ...(id ? [{ texto: 'Duplicar', icono: 'copiar', atajo: 'Ctrl D', accion: () => duplicarNodos(d) }, { texto: 'Centrar la vista', atajo: 'F', accion: enfocar }, { texto: 'Eliminar', icono: 'papelera', peligro: true, accion: () => eliminarNodos(d) }] : []),
    ]);
  }

  // ---------- Soltar archivos ----------
  lienzo.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) { e.preventDefault(); } });
  lienzo.addEventListener('drop', (e) => {
    const rel = e.dataTransfer.getData('text/falcon-archivo');
    const d = doc();
    if (!rel || !d) return;
    e.preventDefault();
    const r = lienzo.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camara);
    const p = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    const t = tipoRecurso(rel);
    const nombre = sinExtension(rel).replace(/^./, c => c.toUpperCase());
    if (t === 'modelo' || t === 'malla') anadirNodo(d, 'Malla3D', { nombre, props: { malla: rel, posicion: [Math.round(p.x * 2) / 2, 0, Math.round(p.z * 2) / 2] }, padre: d.datos.raiz.id });
    else if (t === 'material') {
      const id = elegir(e.clientX - r.left, e.clientY - r.top);
      const n = id && buscarNodo(d.datos.raiz, id);
      if (n && n.tipo === 'Malla3D') { cambiarNodo(d, id, x => { x.props.material = rel; }); avisar(`${rel} aplicado a ${n.nombre}`); }
      else avisar('Suelta el material encima de una malla.', 'aviso');
    } else if (t === 'blueprint' || t === 'script') {
      const id = elegir(e.clientX - r.left, e.clientY - r.top);
      if (id) cambiarNodo(d, id, x => { if (t === 'script') x.script = rel; else x.blueprint = rel; });
    } else avisar('Ese archivo no se puede soltar en una escena 3D.', 'aviso');
  });

  // ---------- Iconos de luces y cámaras ----------
  function pintarIconos() {
    const d = doc();
    if (!d) return;
    const r = lienzo.getBoundingClientRect();
    const lista = [];
    recorrer(d.datos.raiz, (n) => { if (n.tipo === 'Luz3D' || n.tipo === 'Camara3D') lista.push(n); });
    const usados = new Set();
    for (const n of lista) {
      const o = escena.objetos.get(n.id);
      if (!o) continue;
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).project(camara);
      let ic = capaIconos.querySelector(`[data-id="${n.id}"]`);
      if (!ic) {
        ic = el(n.tipo === 'Luz3D' ? `<div class="icono-3d luz" data-id="${n.id}">${icono(n.props.tipo_luz === 'sol' ? 'sol' : 'bombilla', '', 20)}</div>` : `<div class="icono-3d camara-3d" data-id="${n.id}">${icono('camara', '', 56)}</div>`);
        ic.onclick = () => seleccionar([n.id], d);
        capaIconos.append(ic);
      }
      usados.add(String(n.id));
      const visible = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      ic.style.display = visible ? '' : 'none';
      ic.style.left = ((p.x + 1) / 2 * r.width) + 'px';
      ic.style.top = ((1 - p.y) / 2 * r.height) + 'px';
      ic.classList.toggle('sel', d.seleccion.includes(n.id));
      if (n.tipo === 'Luz3D') { ic.style.borderColor = n.props.color; ic.style.color = d.seleccion.includes(n.id) ? 'var(--verde)' : ''; }
      else ic.style.color = d.seleccion.includes(n.id) ? 'var(--verde)' : '';
    }
    $$('[data-id]', capaIconos).forEach(x => { if (!usados.has(x.dataset.id)) x.remove(); });
    // Etiqueta con el nombre del seleccionado.
    let etq = capaIconos.querySelector('.etiqueta-nodo-visor');
    const o = objetoSel();
    if (o && caja.visible) {
      if (!etq) { etq = el('<div class="etiqueta-nodo-visor"></div>'); capaIconos.append(etq); }
      const b = caja.box;
      const p = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(camara);
      etq.textContent = d.nodoSel.nombre;
      etq.style.left = ((p.x + 1) / 2 * r.width) + 'px';
      etq.style.top = ((1 - p.y) / 2 * r.height - 8) + 'px';
      etq.style.display = p.z < 1 ? '' : 'none';
    } else if (etq) etq.remove();
  }

  function pintarEjes() {
    const c = ejesCtx;
    const W = 168;
    c.clearRect(0, 0, W, W);
    const q = camara.quaternion.clone().invert();
    const ejes = [['X', new THREE.Vector3(1, 0, 0), '#F26B6B'], ['Y', new THREE.Vector3(0, 1, 0), '#74B6F7'], ['Z', new THREE.Vector3(0, 0, 1), '#7BDC7B']]
      .map(([n, v, col]) => ({ n, v: v.applyQuaternion(q), col }))
      .sort((a, b) => a.v.z - b.v.z);
    for (const e of ejes) {
      const x = W / 2 + e.v.x * 48, y = W / 2 - e.v.y * 48;
      c.strokeStyle = e.col; c.lineWidth = 3;
      c.beginPath(); c.moveTo(W / 2, W / 2); c.lineTo(x, y); c.stroke();
      c.fillStyle = e.col; c.beginPath(); c.arc(x, y, 15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0B0E0C'; c.font = '800 15px Manrope'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.n, x, y + 1);
    }
  }

  // ---------- Vista previa de la cámara del juego ----------
  function pintarPrevia() {
    let caja2 = raiz.querySelector('.vista-camara');
    if (!previa) { if (caja2) caja2.remove(); return; }
    if (!caja2) {
      caja2 = el('<div class="vista-camara"><canvas></canvas><span class="etq">Cámara del juego</span></div>');
      $('.lienzo-visor', raiz).append(caja2);
      renderPrevia = new THREE.WebGLRenderer({ canvas: caja2.querySelector('canvas'), antialias: true });
      renderPrevia.shadowMap.enabled = true;
      renderPrevia.toneMapping = THREE.ACESFilmicToneMapping;
      renderPrevia.outputColorSpace = THREE.SRGBColorSpace;
    }
    const act = escena.camaraActiva();
    if (!act) return;
    const cv = caja2.querySelector('canvas');
    renderPrevia.setSize(cv.clientWidth, cv.clientHeight, false);
    act.camara.aspect = cv.clientWidth / Math.max(1, cv.clientHeight);
    act.camara.updateProjectionMatrix();
    ayudantes.visible = false; gizmo.visible = false;
    renderPrevia.render(escena.scene, act.camara);
    ayudantes.visible = true; gizmo.visible = true;
  }

  // ---------- Barra ----------
  function fijarHerramienta(h) {
    herramienta = h; est._herramienta3d = h;
    $$('[data-h]', raiz).forEach(b => b.classList.toggle('activo', b.dataset.h === h));
    vincularSeleccion();
  }
  $$('[data-h]', raiz).forEach(b => b.onclick = () => fijarHerramienta(b.dataset.h));
  $('[data-a=espacio]', raiz).onclick = (e) => menuBajo(e.currentTarget, [
    { texto: 'Local', marcado: controles.space === 'local', accion: () => { controles.setSpace('local'); e.target.closest('button').innerHTML = `Local ${icono('flechaAbajo', '', 13)}`; sucio = true; } },
    { texto: 'Global', marcado: controles.space === 'world', accion: () => { controles.setSpace('world'); e.target.closest('button').innerHTML = `Global ${icono('flechaAbajo', '', 13)}`; sucio = true; } },
    '-',
    { texto: 'Ajustar al mover (0,5)', marcado: !!est._ajustar3d, accion: () => { est._ajustar3d = !est._ajustar3d; } },
  ]);
  $('[data-a=proyeccion]', raiz).onclick = (e) => {
    const b = e.currentTarget;
    const vistaFija = (nombre, yaw, pitch) => () => { const c = estadoCam(); const centro = centroOrbita(); const dist = 18; c.yaw = yaw; c.pitch = pitch; const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); c.pos = centro.clone().sub(dir.multiplyScalar(dist)).toArray(); ortografica = true; b.innerHTML = `${nombre} ${icono('flechaAbajo', '', 13)}`; sucio = true; };
    menuBajo(b, [
      { texto: 'Perspectiva', marcado: !ortografica, accion: () => { ortografica = false; b.innerHTML = `Perspectiva ${icono('flechaAbajo', '', 13)}`; sucio = true; } },
      { texto: 'Ortográfica', marcado: ortografica, accion: () => { ortografica = true; b.innerHTML = `Ortográfica ${icono('flechaAbajo', '', 13)}`; sucio = true; } },
      '-',
      { texto: 'Arriba', accion: vistaFija('Arriba', 0, -Math.PI / 2 + 0.0001) },
      { texto: 'Frente', accion: vistaFija('Frente', 0, 0) },
      { texto: 'Lado', accion: vistaFija('Lado', Math.PI / 2, 0) },
    ]);
  };
  const materialAlambre = new THREE.MeshBasicMaterial({ color: 0x9AA59F, wireframe: true });
  const NOMBRE_SOMBREADO = { iluminado: 'Iluminado', final: 'Final · Lumbre', sin_luz: 'Sin luz', alambre: 'Alambre' };
  const bSombreado = $('[data-a=sombreado]', raiz);
  function fijarSombreado(s) {
    sombreado = s;
    est._sombreado3d = s;
    bSombreado.innerHTML = `${NOMBRE_SOMBREADO[s]} ${icono('flechaAbajo', '', 13)}`;
    bSombreado.classList.toggle('activo', s === 'final');
    configurarLumbre();
    sucio = true;
  }
  bSombreado.onclick = (e) => {
    menuBajo(bSombreado, [
      { texto: 'Iluminado', marcado: sombreado === 'iluminado', accion: () => fijarSombreado('iluminado') },
      { texto: 'Final · iluminación global (Lumbre)', marcado: sombreado === 'final', accion: () => fijarSombreado('final') },
      { texto: 'Sin luz', marcado: sombreado === 'sin_luz', accion: () => fijarSombreado('sin_luz') },
      { texto: 'Alambre', marcado: sombreado === 'alambre', accion: () => fijarSombreado('alambre') },
      { cabecera: 'Calidad de la vista final' },
      ...['automatica', 'baja', 'media', 'alta', 'ultra'].map(k => ({
        texto: k === 'automatica' ? `Automática (${CALIDADES[resolverCalidad('automatica', renderer)].nombre})` : `${NOMBRES_OPCION[k]} · ${CALIDADES[k].descripcion}`,
        marcado: calidadVista === k,
        accion: () => { calidadVista = k; est._calidadVista = k; if (sombreado !== 'final') fijarSombreado('final'); else { configurarLumbre(); sucio = true; } },
      })),
    ]);
  };

  // Lumbre en el editor: la vista «Final» muestra la iluminación tal como saldrá en el juego.
  const lumbre = new Lumbre(renderer, escena, { ocultar: () => [ayudantes, gizmo] });
  escena.alCambiarGeometria = (o) => lumbre.geometriaCambiada(o);
  let calidadVista = est._calidadVista || est.proyecto.datos.calidad_grafica || 'automatica';
  escena.alCambiarEntorno = () => { configurarLumbre(); sucio = true; };
  function configurarLumbre() {
    const nivel = sombreado === 'final' ? resolverCalidad(calidadVista, renderer) : 'baja';
    lumbre.activada = est.proyecto.datos.lumbre !== false;
    lumbre.configurar(nivel, escena.entornoProps);
    pintarEstadoLumbre();
  }
  function pintarEstadoLumbre() {
    let p = raiz.querySelector('.pildora-lumbre');
    if (sombreado !== 'final') { if (p) p.remove(); return; }
    if (!p) { p = el('<span class="pildora pildora-lumbre"><span class="punto"></span><span class="t"></span></span>'); raiz.querySelector('.pildoras-visor').append(p); }
    p.querySelector('.t').textContent = `${lumbre.descripcion()} · ${lumbre.aj.nombre}`;
  }
  const bPrevia = $('[data-a=previa]', raiz);
  bPrevia.onclick = () => { previa = !previa; bPrevia.classList.toggle('contorno', previa); bPrevia.classList.toggle('secundario', !previa); pintarPrevia(); sucio = true; };

  // ---------- Bucle ----------
  let ultimo = performance.now();
  const ro = new ResizeObserver(() => { sucio = true; });
  ro.observe(lienzo);
  function bucle(t) {
    if (!vivo) return;
    const dt = Math.min(0.05, (t - ultimo) / 1000);
    ultimo = t;
    volar(dt);
    // Huecos: si se mueve o escala un hueco o la malla que recorta, se rehace el recorte.
    if (escena.revisarHuecos()) sucio = true;
    // En la vista final se dibuja siempre: las sondas se van actualizando.
    const final = sombreado === 'final';
    if (sucio || volando || final) {
      sucio = false;
      const r = lienzo.getBoundingClientRect();
      renderer.setPixelRatio(final ? lumbre.pixelRatio() : (window.devicePixelRatio || 1));
      renderer.setSize(r.width, r.height, false);
      aplicarCamara();
      gizmo.visible = !!controles.object;
      if (final) {
        lumbre.actualizar(camara, dt, r.width, r.height);
        lumbre.renderizar(camara, r.width, r.height);
        if ((t | 0) % 500 < 20) pintarEstadoLumbre();
      } else {
        lumbre.seguirSombras(camara);
        lumbre.modoSimple();
        const hemi = escena.hemi.intensity;
        if (sombreado === 'sin_luz') { escena.hemi.intensity = 3; renderer.toneMapping = THREE.NoToneMapping; }
        escena.scene.overrideMaterial = sombreado === 'alambre' ? materialAlambre : null;
        renderer.render(escena.scene, camara);
        escena.hemi.intensity = hemi; renderer.toneMapping = THREE.ACESFilmicToneMapping;
        escena.scene.overrideMaterial = null;
      }
      pintarIconos();
      pintarEjes();
      if (previa) pintarPrevia();
    }
    requestAnimationFrame(bucle);
  }

  await construir();
  fijarHerramienta(herramienta);
  // Si la escena usa iluminación global, se abre directamente en la vista final.
  fijarSombreado(est._sombreado3d || (escena.entornoProps && escena.entornoProps.iluminacion_global ? 'final' : 'iluminado'));
  requestAnimationFrame(bucle);

  const reconstruir = debounceAsync(construir);
  const quitar = [
    bus.on('doc:cambio', async ({ doc: d, op: o }) => {
      if (d !== doc()) return;
      lumbre.marcarCambio();
      if (o && o.desde3d) {
        // Al escalar con el gizmo, las texturas se reajustan en vivo para no estirarse.
        if (o.prop === 'escala') { const n = buscarNodo(d.datos.raiz, o.id), obj = escena.objetos.get(o.id); if (n && obj) escena.ajustarRepeticion(n, obj.userData.malla); }
        sucio = true;
        return;
      }
      if (o && o.prop && o.id && escena.objetos.has(o.id)) {
        const n = buscarNodo(d.datos.raiz, o.id);
        if (n) { await escena.actualizarNodo(n, o.prop); if (o.prop === 'nombre') reconstruir(); }
        vincularSeleccion();
        actualizarCaja();
        sucio = true;
        return;
      }
      reconstruir();
    }),
    bus.on('seleccion', () => { vincularSeleccion(); sucio = true; }),
    bus.on('proyecto:ajustes', () => { configurarLumbre(); sucio = true; }),
    bus.on('doc:activo', () => { construir(); }),
    bus.on('material:guardado', (rel) => { escena.invalidarMaterial(rel); reconstruir(); }),
    bus.on('malla:guardada', (rel) => { reconstruir(); }),
  ];

  return {
    el: raiz,
    redibujar: () => { sucio = true; },
    destruir() {
      vivo = false;
      ro.disconnect();
      quitar.forEach(f => f());
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
      window.removeEventListener('keydown', teclaAbajo, true);
      window.removeEventListener('keyup', teclaArriba, true);
      controles.dispose();
      lumbre.destruir();
      renderer.dispose();
      if (renderPrevia) renderPrevia.dispose();
    },
  };
}

function debounceAsync(fn) {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(fn, 30); };
}
