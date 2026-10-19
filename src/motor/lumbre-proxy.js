// Escena simplificada para las capturas de sondas de Lumbre.
//
// Cada sonda dibuja la escena seis veces (una por cara del cubo), a 8–16 píxeles. A ese tamaño
// da igual el detalle de cada objeto, pero cada objeto cuesta una llamada de dibujo. Por eso, para
// esas capturas, las mallas quietas se funden en unas pocas: una para todo lo que no tiene textura
// (el color va en los vértices), una por cada imagen de textura y una para lo que brilla.
// Lo que se mueve, lo transparente y lo raro se sigue dibujando tal cual.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepararMaterial } from './lumbre-parche.js';

const _uv = new THREE.Vector2(), _centro = new THREE.Vector3();
// Un objeto que se ha movido hace menos de esto (en fotogramas) no se funde.
export const QUIETO = 120;

function visible(o) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

function firmaMaterial(m) {
  return [m.color?.getHex(), m.emissive?.getHex(), m.emissiveIntensity, m.metalness, m.map?.source?.uuid, m.visible].join('|');
}

export class ProxyCapturas {
  constructor(scene) {
    this.scene = scene;
    this.grupo = null;
    this.originales = [];
    this.enProxy = new Set();
    this.firmas = [];
    this.sucio = true;
    this.ultimo = -1e9;
    this.mostrado = false;
    this.llamadas = 0;
  }

  /** ¿Se puede fundir esta malla? */
  static apta(o, reg, cuadro) {
    if (reg.dinamica || cuadro - (reg.ultimoMov ?? -1e9) < QUIETO) return false;
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh || Array.isArray(o.material)) return false;
    const g = o.geometry;
    if (!g || !g.attributes.position || !g.attributes.normal) return false;
    if (g.morphAttributes && Object.keys(g.morphAttributes).length) return false;
    const m = o.material;
    if (!m || m.transparent || m.alphaTest > 0 || m.alphaMap || m.isShaderMaterial || m.visible === false) return false;
    if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshBasicMaterial)) return false;
    if (m.isMeshBasicMaterial && m.map) return false;
    if (m.map && (!m.map.source || !g.attributes.uv)) return false;
    return visible(o);
  }

  /** zonas: [{ caja, pos }] en el orden de las rejillas (volúmenes primero). */
  construir(mallas, cuadro, zonas = []) {
    this.quitar();
    const grupos = new Map();
    const originales = [];
    for (const [o, reg] of mallas) {
      if (!ProxyCapturas.apta(o, reg, cuadro)) continue;
      const m = o.material;
      const color = new THREE.Color();
      let tipo, mapa = null;
      const brilla = !m.isMeshBasicMaterial && m.emissive && !m.emissiveMap && (m.emissive.r + m.emissive.g + m.emissive.b) * (m.emissiveIntensity ?? 1) > 0.03;
      if (m.isMeshBasicMaterial) { tipo = 'brilla'; color.copy(m.color); }
      else if (brilla) { tipo = 'brilla'; color.copy(m.emissive).multiplyScalar(m.emissiveIntensity ?? 1); }
      else if (m.map) { tipo = 'textura'; mapa = m.map; color.copy(m.color); }
      else { tipo = 'liso'; color.copy(m.color); }
      // Los metales apenas tienen color difuso.
      if (tipo !== 'brilla' && m.metalness) color.multiplyScalar(1 - m.metalness * 0.6);
      // Cada malla fundida va en la zona (rejilla de sondas) donde está el objeto.
      _centro.setFromMatrixPosition(o.matrixWorld);
      let zona = zonas.findIndex(z => z.caja.containsPoint(_centro));
      if (zona < 0) zona = zonas.length - 1;
      const clave = `${zona}|${tipo}|${mapa ? mapa.source.uuid + '|' + mapa.colorSpace : ''}|${m.side}|${o.castShadow ? 1 : 0}`;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (mapa) {
        // La repetición y el desplazamiento de la textura se pasan a las coordenadas UV.
        if (mapa.matrixAutoUpdate) mapa.updateMatrix();
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) { _uv.fromBufferAttribute(uv, i).applyMatrix3(mapa.matrix); uv.setXY(i, _uv.x, _uv.y); }
      } else if (geo.attributes.uv) geo.deleteAttribute('uv');
      geo.applyMatrix4(o.matrixWorld);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!grupos.has(clave)) grupos.set(clave, { tipo, mapa, side: m.side, sombra: o.castShadow, geos: [], pos: zonas[zona] ? zonas[zona].pos : null });
      grupos.get(clave).geos.push(geo);
      originales.push(o);
    }
    this.sucio = false;
    this.ultimo = cuadro;
    if (!originales.length) return;
    const grupo = new THREE.Group();
    grupo.name = '__lumbre_proxy';
    grupo.userData.lumbreProxy = true;
    grupo.visible = false;
    for (const gr of grupos.values()) {
      const geo = mergeGeometries(gr.geos, false);
      gr.geos.forEach(x => x.dispose());
      if (!geo) continue;
      // La malla se coloca dentro de su zona: three.js elige la rejilla por la posición del objeto.
      if (gr.pos) geo.translate(-gr.pos.x, -gr.pos.y, -gr.pos.z);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      let mat;
      if (gr.tipo === 'brilla') mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: gr.side });
      else {
        let mapa = null;
        if (gr.mapa) {
          mapa = gr.mapa.clone();
          mapa.matrixAutoUpdate = false;
          mapa.matrix.identity();
          mapa.wrapS = mapa.wrapT = THREE.RepeatWrapping;
        }
        mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: mapa, roughness: 0.9, metalness: 0, side: gr.side });
        prepararMaterial(mat);
      }
      const malla = new THREE.Mesh(geo, mat);
      malla.castShadow = gr.sombra;
      malla.receiveShadow = true;
      if (gr.pos) malla.position.copy(gr.pos);
      malla.updateMatrix();
      malla.matrixAutoUpdate = false;
      malla.userData.brilla = gr.tipo === 'brilla';
      grupo.add(malla);
    }
    this.scene.add(grupo);
    grupo.updateMatrixWorld(true);
    this.grupo = grupo;
    this.originales = originales;
    this.enProxy = new Set(originales);
    this.firmas = originales.map(o => firmaMaterial(o.material));
    this.llamadas = grupo.children.length;
  }

  /** Mallas fundidas cuyo material ha cambiado (color, brillo…). */
  materialesCambiados() {
    const r = [];
    this.originales.forEach((o, i) => { if (o.material && firmaMaterial(o.material) !== this.firmas[i]) r.push(o); });
    return r;
  }

  // Durante una captura de sondas: se ven las mallas fundidas en lugar de las originales.
  mostrar() {
    if (!this.grupo || this.mostrado) return;
    this.antes = this.originales.map(o => o.visible);
    for (const o of this.originales) o.visible = false;
    this.grupo.visible = true;
    this.mostrado = true;
  }

  ocultar() {
    if (!this.mostrado) return;
    this.originales.forEach((o, i) => { o.visible = this.antes[i]; });
    this.grupo.visible = false;
    this.mostrado = false;
  }

  quitar() {
    this.ocultar();
    if (!this.grupo) return;
    this.scene.remove(this.grupo);
    this.grupo.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    this.grupo = null;
    this.originales = [];
    this.enProxy = new Set();
    this.sucio = true;
  }
}
