// Construcción de escenas 3D con three.js, compartida por el editor y el juego.
import * as THREE from 'three';
import { ajustarSesgo } from './lumbre-parche.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { construirMaterial, resolverInstancia } from './materiales.js';
import { RECORTABLES, cargarCSG, csgListo, recortar, solapan } from './huecos.js';

const RAD = Math.PI / 180;
export { THREE };

// ---------- Geometrías básicas ----------
const geometrias = new Map();
export function geometriaPrimitiva(nombre) {
  if (geometrias.has(nombre)) return geometrias.get(nombre);
  let g;
  switch (nombre) {
    case 'esfera': g = new THREE.SphereGeometry(0.5, 32, 20); break;
    case 'cilindro': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 28); break;
    case 'plano': g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); break;
    case 'capsula': g = new THREE.CapsuleGeometry(0.32, 0.36, 8, 20); break;
    case 'cono': g = new THREE.ConeGeometry(0.5, 1, 28); break;
    case 'terreno': {
      g = new THREE.PlaneGeometry(1, 1, 48, 48); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, (Math.sin(x * 9) * Math.cos(z * 7) * 0.5 + Math.sin(x * 17 + z * 13) * 0.25) * 0.06);
      }
      g.computeVertexNormals();
      break;
    }
    case 'escalera': {
      const partes = [];
      const n = 5;
      for (let i = 0; i < n; i++) {
        const b = new THREE.BoxGeometry(1, (i + 1) / n, 1 / n);
        b.translate(0, (i + 1) / n / 2 - 0.5, -0.5 + (i + 0.5) / n);
        partes.push(b);
      }
      g = mezclarGeometrias(partes);
      break;
    }
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geometrias.set(nombre, g);
  return g;
}

function mezclarGeometrias(lista) {
  const pos = [], nor = [], uv = [], ind = [];
  let base = 0;
  for (const g of lista) {
    const gi = g.index ? g : g;
    pos.push(...gi.attributes.position.array); nor.push(...gi.attributes.normal.array); uv.push(...gi.attributes.uv.array);
    for (const i of gi.index.array) ind.push(i + base);
    base += gi.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  r.setIndex(ind);
  return r;
}

// Reflejos suaves para que los metales no se vean negros.
const reflejos = new WeakMap();
export function aplicarReflejos(renderer, scene, intensidad = 0.5) {
  let t = reflejos.get(renderer);
  if (!t) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    reflejos.set(renderer, t);
    pmrem.dispose();
  }
  scene.environment = t;
  scene.environmentIntensity = intensidad;
}

export const PRIMITIVAS = ['cubo', 'esfera', 'cilindro', 'plano', 'capsula', 'cono', 'terreno', 'escalera'];

// Formas de caras planas: cada cara recibe UV según sus medidas reales, así la textura conserva
// su tamaño en metros en todas las caras (una pared estirada en Z repite la textura a lo largo).
const CARAS_PLANAS = ['cubo', 'escalera', 'plano', 'terreno'];
export const TAMANO_TEXTURA = 2;   // metros por repetición si el nodo no dice otra cosa
// Geometría → malla dueña. No se marca en geometry.userData porque clone() lo comparte por referencia
// con la original, y entonces todas las mallas acababan escribiendo en la geometría compartida.
const duenoGeometria = new WeakMap();
function adoptarGeometria(malla, g) {
  const vieja = malla.geometry;
  if (duenoGeometria.get(vieja) === malla) vieja.dispose();
  g.userData = {};
  malla.geometry = g;
  duenoGeometria.set(g, malla);
}
function proyectarUV(malla, nombre, escala, tam) {
  if (duenoGeometria.get(malla.geometry) !== malla) adoptarGeometria(malla, geometriaPrimitiva(nombre).clone());
  uvPorCara(malla.geometry, escala, tam);
}
// Caja en el mundo de la forma básica completa (sin recortar) de una malla.
function cajaBase(m) {
  const base = geometriaPrimitiva(PRIMITIVAS.includes(m.userData.forma) ? m.userData.forma : 'cubo');
  if (!base.boundingBox) base.computeBoundingBox();
  return base.boundingBox.clone().applyMatrix4(m.matrixWorld);
}

// Sirve para cualquier geometría en el espacio de la forma básica, también la recortada por huecos.
function uvPorCara(g, escala, tam) {
  const tx =Math.abs(escala[0] ?? 1) / tam, ty = Math.abs(escala[1] ?? 1) / tam, tz = Math.abs(escala[2] ?? 1) / tam;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  // Misma orientación que BoxGeometry; las formas básicas miden 1 en cada eje (de -0,5 a 0,5).
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 0.5, y = pos.getY(i) + 0.5, z = pos.getZ(i) + 0.5;
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (ax >= ay && ax >= az) uv.setXY(i, (nx > 0 ? 1 - z : z) * tz, y * ty);
    else if (ay >= az) uv.setXY(i, x * tx, (ny > 0 ? 1 - z : z) * tz);
    else uv.setXY(i, (nz > 0 ? x : 1 - x) * tx, y * ty);
  }
  uv.needsUpdate = true;
}

export function aplicarTransformacion(obj, props) {
  const p = props.posicion || [0, 0, 0], r = props.rotacion || [0, 0, 0], e = props.escala || [1, 1, 1];
  obj.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
  obj.rotation.set((r[0] || 0) * RAD, (r[1] || 0) * RAD, (r[2] || 0) * RAD, 'YXZ');
  obj.scale.set(e[0] ?? 1, e[1] ?? 1, e[2] ?? 1);
}

/**
 * Gestiona los objetos three.js de una escena de nodos.
 * Los nodos pueden ser datos del editor o nodos vivos del juego (ambos tienen id, tipo, props, hijos).
 */
export class Escena3D {
  constructor(proyecto, op = {}) {
    this.proyecto = proyecto;
    this.op = op;
    this.scene = new THREE.Scene();
    this.objetos = new Map();     // id de nodo → Object3D
    this.nodos = new Map();       // id → nodo
    this.texturas = new Map();
    this.materiales = new Map();  // rel → Promise<material>
    this.modelos = new Map();     // rel → Promise<gltf.scene>
    this.cargador = new GLTFLoader();
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x30281e, 0.6);
    this.scene.add(this.hemi);
    this.fondoCanvas = null;
    this.ayudasEditor = [];       // objetos que solo ve el editor (Lumbre los oculta en sus capturas)
    this.alCambiar = op.alCambiar || (() => {});
  }

  // ---------- Recursos ----------
  textura(rel, { srgb = false } = {}) {
    const k = rel + (srgb ? '|s' : '');
    if (this.texturas.has(k)) return this.texturas.get(k);
    const t = new THREE.TextureLoader().load(this.proyecto.url(rel), () => this.alCambiar());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    const a = this.proyecto.ajustesImportacion(rel);
    if (a.filtro === 'pixel') { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; }
    this.texturas.set(k, t);
    return t;
  }

  async leerMaterial(rel) {
    const datos = await this.proyecto.leerJSON(rel);
    if (datos.base) return resolverInstancia(datos, await this.proyecto.leerJSON(datos.base));
    return datos;
  }

  material(rel) {
    if (!this.materiales.has(rel)) {
      this.materiales.set(rel, this.leerMaterial(rel).then(d => construirMaterial(THREE, d, (r, o) => this.textura(r, o))).catch((e) => {
        console.warn('Material', rel, e);
        return new THREE.MeshStandardMaterial({ color: 0xff00ff });
      }));
    }
    return this.materiales.get(rel);
  }

  invalidarMaterial(rel) { this.materiales.delete(rel); }
  invalidarModelo(rel) { this.modelos.delete(rel); }

  modelo(rel) {
    if (!this.modelos.has(rel)) {
      this.modelos.set(rel, this.cargador.loadAsync(this.proyecto.url(rel)).then(g => g.scene).catch((e) => {
        console.warn('Modelo', rel, e);
        return null;
      }));
    }
    return this.modelos.get(rel);
  }

  // ---------- Construcción ----------
  async construir(raiz) {
    this.limpiar();
    this.raiz = raiz;
    const obj = await this.crear(raiz);
    this.scene.add(obj);
    this.aplicarEntorno();
    await this.prepararHuecos();
    return obj;
  }

  limpiar() {
    for (const o of this.objetos.values()) if (o.parent) o.parent.remove(o);
    this.objetos.clear();
    this.nodos.clear();
    this.ayudasEditor = [];
  }

  async crear(n) {
    const obj = await this.crearObjeto(n);
    obj.userData.nodoId = n.id;
    obj.name = n.nombre;
    this.objetos.set(n.id, obj);
    this.nodos.set(n.id, n);
    if (n.tipo !== 'Interfaz') aplicarTransformacion(obj, n.props);
    obj.visible = n.visible !== false || !!this.op.editor;
    if (this.op.editor && n.visible === false) this.atenuar(obj);
    for (const h of n.hijos) {
      if (h.eliminado) continue;
      obj.add(await this.crear(h));
    }
    return obj;
  }

  atenuar(obj) {
    obj.traverse(o => { if (o.material && !o.userData.atenuado) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.3; o.userData.atenuado = true; } });
  }

  async crearObjeto(n) {
    const p = n.props;
    switch (n.tipo) {
      case 'Malla3D': return this.crearMalla(n);
      case 'Luz3D': return this.crearLuz(n);
      case 'Camara3D': {
        const c = new THREE.PerspectiveCamera(p.fov || 70, 16 / 9, 0.05, 1000);
        c.userData.esCamara = true;
        return c;
      }
      case 'Personaje3D': {
        const g = new THREE.Group();
        const alt = p.altura || 1.8;
        const visual = new THREE.Group();
        const base = p.modelo && /.(glb|gltf)$/i.test(p.modelo) ? await this.modelo(p.modelo) : null;
        if (base) {
          // El modelo se escala a la altura del personaje y se apoya en el suelo.
          const m = base.clone(true);
          const caja = new THREE.Box3().setFromObject(m);
          const alto = Math.max(0.01, caja.max.y - caja.min.y);
          m.scale.multiplyScalar(alt / alto);
          m.position.y = -caja.min.y * (alt / alto);
          visual.add(m);
        } else {
          const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, Math.max(0.1, alt - 0.76), 8, 20), new THREE.MeshStandardMaterial({ color: p.color || '#3DDC84', roughness: 0.55 }));
          cuerpo.position.y = alt / 2;
          const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x404040 }));
          ojo.position.set(0.14, alt * 0.78, -0.33);
          const ojo2 = ojo.clone(); ojo2.position.x = -0.14;
          visual.add(cuerpo, ojo, ojo2);
        }
        // Los personajes proyectan sombra con el sol, las bombillas y los focos, y también la reciben.
        visual.traverse(o => { if (o.isMesh) { o.castShadow = p.sombras !== false; o.receiveShadow = true; } });
        visual.name = '__visual';
        g.add(visual);
        g.userData.visual = visual;
        g.userData.lumbreDinamico = true;   // Lumbre no lo captura en la iluminación global
        return g;
      }
      case 'VolumenLumbre': {
        const g = new THREE.Group();
        if (this.op.editor) {
          // Caja discontinua que marca la zona de sondas detalladas.
          const caja = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineDashedMaterial({ color: 0xF2C46D, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0.85, depthTest: false }));
          caja.computeLineDistances();
          caja.renderOrder = 5;
          caja.userData.ayudaVolumen = true;
          g.add(caja);
          this.ayudasEditor.push(caja);
        }
        return g;
      }
      default: return new THREE.Group();
    }
  }

  async crearMalla(n) {
    const p = n.props;
    const ref = p.malla || 'cubo';
    if (p.modo === 'hueco') return this.crearHueco(n);
    let obj;
    if (PRIMITIVAS.includes(ref)) {
      obj = new THREE.Mesh(geometriaPrimitiva(ref), await this.materialNodo(n));
      obj.userData.forma = ref;
    } else if (/\.malla$/i.test(ref)) {
      obj = await this.crearDesdeMalla(ref, n);
    } else if (/\.(glb|gltf)$/i.test(ref)) {
      const base = await this.modelo(ref);
      obj = base ? base.clone(true) : new THREE.Mesh(geometriaPrimitiva('cubo'), new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
      if (p.material) { const m = await this.material(p.material); obj.traverse(o => { if (o.isMesh) o.material = m; }); }
    } else obj = new THREE.Mesh(geometriaPrimitiva('cubo'), await this.materialNodo(n));
    // Las mallas son grupos para poder colgar hijos sin heredar la geometría.
    const g = new THREE.Group();
    g.add(obj);
    g.userData.malla = obj;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = p.sombras !== false; o.receiveShadow = true; } });
    this.ajustarRepeticion(n, obj);
    // Espejo pedido desde el nodo (formas básicas sin archivo de material).
    if (p.reflejo === 'plano' || p.reflejo === 'curvo') obj.traverse(o => { if (o.isMesh) o.userData.espejo = { tipo: p.reflejo, intensidad: 1, desenfoque: 1 }; });
    return g;
  }

  // Un hueco no se dibuja en el juego: solo recorta. En el editor se ve como una caja roja translúcida.
  crearHueco(n) {
    const ref = PRIMITIVAS.includes(n.props.malla) ? n.props.malla : 'cubo';
    if (!this.matHueco) this.matHueco = new THREE.MeshBasicMaterial({ color: 0xE5484D, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const obj = new THREE.Mesh(geometriaPrimitiva(ref), this.matHueco);
    obj.visible = !!this.op.editor;
    obj.castShadow = obj.receiveShadow = false;
    obj.userData.hueco = true;
    obj.userData.forma = ref;
    const g = new THREE.Group();
    g.add(obj);
    g.userData.malla = obj;
    if (this.op.editor) {
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(geometriaPrimitiva(ref), 30), new THREE.LineDashedMaterial({ color: 0xFF6B6F, dashSize: 0.08, gapSize: 0.05 }));
      borde.computeLineDistances();
      obj.add(borde);
      this.ayudasEditor.push(obj);
    }
    return g;
  }

  // Recorta las mallas sólidas con los huecos que las tocan. Se llama en cada fotograma: solo rehace
  // la geometría si algo ha cambiado (firma). Devuelve true si cambió alguna malla.
  revisarHuecos() {
    const huecos = [], solidos = [];
    for (const [id, o] of this.objetos) {
      const n = this.nodos.get(id), m = o.userData.malla;
      if (!n || n.tipo !== 'Malla3D' || n.eliminado || !m || !m.isMesh) continue;
      if (n.props.modo === 'hueco') { if (n.visible !== false) huecos.push({ n, m }); }
      else if (RECORTABLES.includes(n.props.malla || 'cubo')) solidos.push({ n, m });
    }
    if (!huecos.length && !this._hayRecortes) return false;
    if (huecos.length && !csgListo()) { cargarCSG().then(() => this.alCambiar()); return false; }
    this.scene.updateMatrixWorld();
    const firma = (m) => m.matrixWorld.elements.map(v => v.toFixed(5)).join(',');
    for (const h of huecos) {
      h.caja = cajaBase(h.m);
      h.firma = h.n.id + ':' + (h.n.props.malla || 'cubo') + ':' + firma(h.m);
    }
    let cambio = false, hayRecortes = false;
    for (const s of solidos) {
      const caja = cajaBase(s.m);
      const suyos = huecos.filter(h => solapan(caja, h.caja));
      if (suyos.length) hayRecortes = true;
      const p = s.n.props;
      const f = suyos.length ? [firma(s.m), JSON.stringify(p.escala), p.escala_textura, ...suyos.map(h => h.firma)].join('|') : '';
      if ((s.m.userData.firmaHuecos || '') === f) continue;
      s.m.userData.firmaHuecos = f;
      s.m.userData.cajasHuecos = suyos.map(h => h.caja);
      const ref = p.malla || 'cubo';
      if (suyos.length) adoptarGeometria(s.m, recortar(geometriaPrimitiva(ref), s.m.matrixWorld, suyos.map(h => ({ geo: h.m.geometry, matriz: h.m.matrixWorld }))));
      else adoptarGeometria(s.m, geometriaPrimitiva(ref).clone());
      if (CARAS_PLANAS.includes(ref)) uvPorCara(s.m.geometry, p.escala || [1, 1, 1], Math.max(0.01, Number(p.escala_textura) || TAMANO_TEXTURA));
      this.alCambiarGeometria && this.alCambiarGeometria(s.m);
      cambio = true;
    }
    this._hayRecortes = hayRecortes;
    return cambio;
  }

  // Aplica los huecos al construir, esperando a la librería, para que el primer fotograma ya salga recortado.
  async prepararHuecos() {
    for (const n of this.nodos.values()) if (n.tipo === 'Malla3D' && n.props.modo === 'hueco') { await cargarCSG(); break; }
    this.revisarHuecos();
  }

  async crearDesdeMalla(rel, n) {
    let d;
    try { d = await this.proyecto.leerJSON(rel); } catch { return new THREE.Mesh(geometriaPrimitiva('cubo'), new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true })); }
    let obj;
    const ranuras = d.ranuras || [];
    const mats = await Promise.all(ranuras.map(r => r.material ? this.material(r.material) : null));
    if (d.fuente) {
      const base = await this.modelo(d.fuente);
      obj = base ? base.clone(true) : new THREE.Group();
      obj.traverse(o => {
        if (!o.isMesh) return;
        const nombre = o.material && o.material.name;
        const i = ranuras.findIndex(r => r.nombre === nombre);
        const m = n.props.material ? null : mats[i >= 0 ? i : -1];
        if (m) o.material = m;
      });
      if (n.props.material) { const m = await this.material(n.props.material); obj.traverse(o => { if (o.isMesh) o.material = m; }); }
    } else {
      obj = new THREE.Mesh(geometriaPrimitiva(d.primitiva || 'cubo'), n.props.material ? await this.material(n.props.material) : mats[0] || await this.materialNodo(n));
    }
    const e = d.escala || 1;
    obj.scale.multiplyScalar(e);
    if (d.eje_arriba === 'Z') obj.rotation.x = -Math.PI / 2;
    return obj;
  }

  async materialNodo(n) {
    const p = n.props;
    if (p.material) return this.material(p.material);
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color || '#8A8F8C'), roughness: p.rugosidad ?? 0.7, metalness: p.metalico ?? 0 });
  }

  // Ajusta las texturas de una forma básica a su escala; se llama al crearla y cada vez que cambia
  // la escala o el tamaño de textura, así nunca se estiran.
  ajustarRepeticion(n, obj) {
    const ref = n.props.malla || 'cubo';
    if (!obj || !obj.isMesh || !PRIMITIVAS.includes(ref) || obj.userData.hueco) return;
    const e = n.props.escala || [1, 1, 1];
    const tam = Math.max(0.01, Number(n.props.escala_textura) || TAMANO_TEXTURA);
    if (CARAS_PLANAS.includes(ref)) return proyectarUV(obj, ref, e, tam);
    // Formas redondas: la textura da la vuelta, así que se repite un número entero de veces (sin costura).
    const rx = Math.max(1, Math.round(Math.abs(e[0]) / tam)), rz = Math.max(1, Math.round(Math.max(Math.abs(e[1]), Math.abs(e[2])) / tam));
    const m = obj.material;
    if (!m || !m.map) return;
    if (!obj.userData.texturaPropia) {
      obj.material = m.clone();
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (m[k]) obj.material[k] = m[k].clone();
      obj.userData.texturaPropia = true;
    }
    for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) if (obj.material[k]) obj.material[k].repeat.set(rx, rz);
  }

  crearLuz(n) {
    const p = n.props;
    const color = new THREE.Color(p.color || '#FFFFFF');
    let luz;
    const g = new THREE.Group();
    if (p.tipo_luz === 'puntual') {
      luz = new THREE.PointLight(color, (p.intensidad ?? 2) * 2, p.alcance || 0, 1.4);
      luz.shadow.mapSize.set(512, 512);
    } else if (p.tipo_luz === 'foco') {
      luz = new THREE.SpotLight(color, (p.intensidad ?? 2) * 3, p.alcance || 0, Math.PI / 6, 0.35, 1.4);
      luz.target.position.set(0, 0, -1);
      g.add(luz.target);
    } else {
      luz = new THREE.DirectionalLight(color, p.intensidad ?? 2);
      luz.target.position.set(0, 0, -1);
      g.add(luz.target);
      luz.shadow.mapSize.set(2048, 2048);
      const s = luz.shadow.camera;
      s.left = -22; s.right = 22; s.top = 22; s.bottom = -22; s.near = 0.5; s.far = 80;
    }
    // Sin sesgo de profundidad (la sombra se despegaba de los objetos): ver ajustarSesgo.
    ajustarSesgo(luz);
    // Lumbre decide qué bombillas y focos proyectan sombra según la calidad; aquí se guarda lo pedido.
    luz.castShadow = !!p.sombras;
    luz.userData.sombraDeseada = !!p.sombras;
    g.add(luz);
    g.userData.luz = luz;
    return g;
  }

  // Cielo, niebla y luz ambiental desde el nodo Entorno.
  aplicarEntorno() {
    let ent = null;
    const visitar = (n) => { if (ent) return; if (n.tipo === 'Entorno' && !n.eliminado) { ent = n; return; } n.hijos.forEach(visitar); };
    if (this.raiz) visitar(this.raiz);
    const p = ent ? ent.props : { cielo: '#0B1410', horizonte: '#1A2620', ambiente: 0.5, niebla: false };
    this.entornoProps = p;
    if (!this.fondoCanvas) { this.fondoCanvas = document.createElement('canvas'); this.fondoCanvas.width = 4; this.fondoCanvas.height = 256; }
    const c = this.fondoCanvas.getContext('2d');
    const gr = c.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, p.cielo); gr.addColorStop(0.62, p.horizonte); gr.addColorStop(1, p.horizonte);
    c.fillStyle = gr; c.fillRect(0, 0, 4, 256);
    if (!this.fondoTex) { this.fondoTex = new THREE.CanvasTexture(this.fondoCanvas); this.fondoTex.colorSpace = THREE.SRGBColorSpace; }
    this.fondoTex.needsUpdate = true;
    this.scene.background = this.fondoTex;
    this.hemi.color.set(p.horizonte).lerp(new THREE.Color('#ffffff'), 0.55);
    this.hemi.groundColor.set(p.cielo);
    this.hemi.intensity = (p.ambiente ?? 0.35) * 2.2 * (this.factorAmbiente ?? 1);
    this.scene.fog = p.niebla ? new THREE.FogExp2(new THREE.Color(p.horizonte), p.densidad ?? 0.04) : null;
  }

  // ---------- Actualizaciones ----------
  async actualizarNodo(n, clave) {
    const obj = this.objetos.get(n.id);
    if (!obj) return;
    const p = n.props;
    if (['posicion', 'rotacion', 'escala'].includes(clave) || !clave) aplicarTransformacion(obj, p);
    if (clave === 'visible') obj.visible = n.visible !== false || !!this.op.editor;
    if (n.tipo === 'Entorno') { this.aplicarEntorno(); this.alCambiarEntorno && this.alCambiarEntorno(this.entornoProps); return; }
    if (n.tipo === 'Luz3D') {
      const l = obj.userData.luz;
      if (clave === 'tipo_luz') return this.reconstruir(n);
      l.color.set(p.color);
      l.intensity = p.tipo_luz === 'puntual' ? p.intensidad * 2 : p.tipo_luz === 'foco' ? p.intensidad * 3 : p.intensidad;
      if ('distance' in l && l.isPointLight || l.isSpotLight) l.distance = p.alcance || 0;
      l.userData.sombraDeseada = !!p.sombras;
      if (!(l.isPointLight || l.isSpotLight) || !p.sombras) l.castShadow = !!p.sombras;
      return;
    }
    if (n.tipo === 'Camara3D' && obj.isCamera) { obj.fov = p.fov; obj.updateProjectionMatrix(); return; }
    if (n.tipo === 'Personaje3D' && ['color', 'altura', 'modelo', 'sombras'].includes(clave)) return this.reconstruir(n);
    if (n.tipo === 'Malla3D') {
      const malla = obj.userData.malla;
      if (['malla', 'material', 'reflejo', 'modo'].includes(clave)) return this.reconstruir(n);
      if (clave === 'escala' || clave === 'escala_textura') { this.ajustarRepeticion(n, malla); this.alCambiar(); return; }
      if (['color', 'rugosidad', 'metalico'].includes(clave) && malla && malla.isMesh && !malla.userData.hueco && !p.material && PRIMITIVAS.includes(p.malla)) {
        malla.material.color.set(p.color); malla.material.roughness = p.rugosidad; malla.material.metalness = p.metalico;
      }
      if (clave === 'sombras') obj.traverse(o => { if (o.isMesh) o.castShadow = !!p.sombras; });
    }
  }

  async reconstruir(n) {
    const viejo = this.objetos.get(n.id);
    if (!viejo) return;
    const padre = viejo.parent;
    const hijosObj = viejo.children.filter(c => c.userData.nodoId !== undefined && c.userData.nodoId !== n.id);
    const nuevo = await this.crearObjeto(n);
    nuevo.userData.nodoId = n.id;
    nuevo.name = n.nombre;
    aplicarTransformacion(nuevo, n.props);
    for (const h of hijosObj) nuevo.add(h);
    if (padre) { padre.add(nuevo); padre.remove(viejo); }
    this.objetos.set(n.id, nuevo);
    this.alCambiar();
    return nuevo;
  }

  async anadir(n, padre) {
    const obj = await this.crear(n);
    const po = padre ? this.objetos.get(padre.id) : this.objetos.get(this.raiz.id);
    (po || this.scene).add(obj);
    return obj;
  }

  quitar(n) {
    const obj = this.objetos.get(n.id);
    if (obj && obj.parent) obj.parent.remove(obj);
    const borrar = (x) => { this.objetos.delete(x.id); this.nodos.delete(x.id); x.hijos.forEach(borrar); };
    borrar(n);
  }

  // Cámara 3D activa de la escena (la primera con «actual»).
  camaraActiva() {
    for (const [id, o] of this.objetos) {
      const n = this.nodos.get(id);
      if (n && n.tipo === 'Camara3D' && n.props.actual && !n.eliminado) return { nodo: n, camara: o };
    }
    return null;
  }
}
