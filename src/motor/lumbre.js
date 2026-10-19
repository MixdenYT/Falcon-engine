// Lumbre: iluminación global en tiempo real de Falcon Engine (inspirada en Lumen de Unreal).
//
// · Iluminación global difusa: rejillas de sondas de armónicos esféricos (L2) calculadas en la GPU
//   (WebGL2, sin trazado de rayos por hardware). Al empezar se calculan enteras; después solo se
//   recalculan las sondas afectadas por algo que cambia (una luz que se mueve o cambia, el sol,
//   el cielo, un objeto que se desplaza), empezando por las más cercanas a la cámara. Si nada
//   cambia, la iluminación global no gasta casi nada.
//   Las sondas que caen dentro de muros o bajo el suelo se sacan fuera antes de capturar, para que
//   la luz de fuera no se cuele en las salas. Los nodos «VolumenLumbre» añaden rejillas más densas.
// · Reflejos: sonda de reflejo alrededor de la cámara, espejos planos (cámara reflejada) y curvos.
//   Solo se actualizan si se ven y algo ha cambiado.
// · Sombras: el sol, bombillas y focos. Cada mapa de sombra se redibuja solo cuando la luz o algo
//   cercano se mueve; los bordes son suaves (PCF con disco de Vogel).
// · Posproceso: oclusión ambiental (GTAO), resplandor (bloom) y exposición automática (el «ojo»
//   se adapta al pasar de un exterior soleado a una sala oscura).
//
// La calidad (Baja · Media · Alta · Ultra) decide cuántas sondas, espejos y sombras se usan.

import * as THREE from 'three';
import { LightProbeGridWebGL } from 'three/addons/lighting/LightProbeGridWebGL.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { restarCajas } from './huecos.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { INTENSIDAD_GI, ESPEJOS_ACTIVOS, AO_PANTALLA, prepararMaterial, prepararEspejo, ajustarSesgo } from './lumbre-parche.js';
import { CALIDADES, soportaGI } from './graficos.js';
import { ProxyCapturas, QUIETO } from './lumbre-proxy.js';

// En la imagen final queda un poco de luz ambiental plana; el resto llega rebotada por las sondas.
const FACTOR_AMBIENTE = 0.12;
// Capa del cuerpo del jugador en primera persona: proyecta sombra y sale en los espejos,
// pero la cámara del jugador no lo ve.
export const CAPA_CUERPO = 1;

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
const _mira = new THREE.Vector3(), _obj = new THREE.Vector3(), _rot = new THREE.Matrix4(), _m4 = new THREE.Matrix4();
const _plano = new THREE.Plane(), _clip = new THREE.Vector4(), _q = new THREE.Vector4();
const _frustum = new THREE.Frustum(), _esfera = new THREE.Sphere(), _caja = new THREE.Box3();
const _E = new THREE.Color(), _col = new THREE.Color();
const _der = new THREE.Vector3(), _arr = new THREE.Vector3(), _arribaY = new THREE.Vector3(0, 1, 0);
const CAPAS_POR_CUADRO = 48;   // capas de atlas que se copian como mucho en un fotograma (ver instantaneaRebote)
const TIPOS = ['global', 'locales'];
const _sesgo = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

export class Lumbre {
  /**
   * @param renderer WebGLRenderer
   * @param escena   Escena3D (de escena3d.js)
   * @param op       { ocultar: () => [Object3D] } objetos que no deben verse en las capturas (ayudas del editor)
   */
  constructor(renderer, escena, op = {}) {
    this.r = renderer;
    this.e = escena;
    this.scene = escena.scene;
    this.op = op;
    this.nivel = 'baja';
    this.aj = CALIDADES.baja;
    this.ent = {};
    this.rejillas = [];
    this.firmaRejillas = '';
    this.lejos = 40;
    this.composer = null;
    this.reflejo = null;
    this.espejos = new Map();
    this.mallas = new Map();      // malla → { firma, caja, dinamica }
    this.luces = new Map();       // luz → estado para sombras e iluminación global
    this.dinamicos = [];          // grupos de personajes: no se capturan en las sondas
    this.proxy = new ProxyCapturas(this.scene);   // escena simplificada para las sondas
    this.cuadro = 0;
    this.goteo = 0;
    this.camPrev = new THREE.Matrix4();
    this.giDisponible = soportaGI(renderer);
    this.ultimoTam = '';
    this.estado = 'apagada';
    this.exposicion = { valor: 1, medida: 0, leyendo: false };
    this.stats = { sondas: 0, sombras: 0, espejos: 0 };
    this.activada = true;         // los ajustes del proyecto (o el jugador) pueden apagar Lumbre
    this.reloj = new RelojGPU(renderer);
    this.factorGI = 1;
  }

  // Coste de una sonda: lo que más tarde de procesador (preparar los dibujos) o GPU (dibujarlos).
  get msSonda() { return Math.max(this._msSonda || 0.5, this._msSondaGPU || 0); }

  // Parte del presupuesto de iluminación global que se usa (0,2 a 1). Las capturas de sondas tienen
  // un coste que no ven ni el reloj del procesador ni el de la GPU: el del proceso de GPU del
  // navegador, que traduce cada dibujo (ANGLE). Si se pasa, el navegador se salta fotogramas. Así que
  // se vigila el resultado: si un fotograma llega tarde mientras se capturan sondas, se baja el ritmo
  // un 30 %; si no, se recupera poco a poco (10 % por segundo).
  regularGI(dt) {
    if (this.factorGI === undefined) this.factorGI = 1;
    if (!(dt > 0) || dt > 0.25) return;
    this._dtMedio = this._dtMedio ? this._dtMedio + (dt - this._dtMedio) * 0.05 : dt;
    const tarde = dt > Math.max(this._dtMedio * 2.5, this._dtMedio + 0.008);
    if (tarde && this.cuadro - (this._ultimaCaptura ?? -1e9) <= 3) this.factorGI = Math.max(0.2, this.factorGI * 0.7);
    else this.factorGI = Math.min(1, this.factorGI + dt * 0.1);
  }

  get usaGI() { return !!(this.activada && this.giDisponible && this.aj.gi && this.ent.iluminacion_global); }
  get usaReflejos() { return !!(this.activada && this.aj.reflejos && this.ent.iluminacion_global && this.ent.reflejos_escena !== false); }
  get usaComposer() { return !!((this.aj.ao && this.ent.oclusion !== false) || (this.aj.bloom && this.ent.resplandor !== false) || this.usaExposicionAuto); }
  get usaExposicionAuto() { return !!(this.activada && this.aj.exposicionAuto && this.ent.exposicion_automatica !== false); }
  get total() { return this.rejillas.reduce((s, r) => s + r.total, 0); }

  /** Aplica un nivel de calidad y los ajustes del nodo Entorno. */
  configurar(nivel, entorno = this.e.entornoProps || {}) {
    const cambioNivel = nivel !== this.nivel;
    this.nivel = CALIDADES[nivel] ? nivel : 'baja';
    this.aj = CALIDADES[this.nivel];
    this.ent = entorno || {};
    INTENSIDAD_GI.value = this.ent.intensidad_gi ?? 1;
    this.r.toneMappingExposure = this.ent.exposicion ?? 1;
    // Con iluminación global, el cielo y los rebotes sustituyen a la luz ambiental plana.
    this.e.factorAmbiente = this.usaGI ? FACTOR_AMBIENTE : 1;
    this.e.aplicarEntorno();
    this.recogerEscena();
    // Los materiales llevan el enganche de Lumbre si hay iluminación global o posproceso (oclusión).
    if (this.usaGI || this.usaComposer) this.prepararMateriales();
    if (this.usaGI) this.asegurarRejillas(cambioNivel);
    else { this.quitarRejillas(); this.proxy.quitar(); }
    if (!this.usaReflejos) this.quitarReflejo();
    this.ajustarSombras();
    this.asegurarEspejos(cambioNivel);
    if (!this.usaComposer || cambioNivel) this.quitarComposer();
    this.estado = this.usaGI ? 'calculando' : 'apagada';
    this._forzar = true;
  }

  // Ayudas del editor que no deben salir en sondas, reflejos ni espejos.
  ocultables() {
    const r = this.op.ocultar ? this.op.ocultar() : [];
    return [...r, ...(this.e.ayudasEditor || [])].filter(Boolean);
  }

  /** Cambios ligeros del Entorno (colores, luz ambiental, intensidades) sin rehacer nada. */
  actualizarEntorno(entorno) {
    this.ent = entorno || {};
    INTENSIDAD_GI.value = this.ent.intensidad_gi ?? 1;
    this.e.aplicarEntorno();
  }

  pixelRatio() { return Math.min(window.devicePixelRatio || 1, this.aj.escala || 1); }

  prepararMateriales() {
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) prepararMaterial(m);
    });
  }

  // ---------- Inventario de la escena ----------
  // Lista de mallas (para saber qué se mueve), luces y personajes.
  recogerEscena() {
    const ocultos = new Set(this.ocultables());
    const vistas = new Set();
    const dinamicos = [];
    const luces = new Set();
    const visitar = (o, dinamico) => {
      if (ocultos.has(o) || o.isLightProbeGrid || o.userData.lumbreProxy) return;
      if (o.userData.lumbreDinamico) { dinamico = true; dinamicos.push(o); }
      if (o.isLight) luces.add(o);
      if (o.isMesh && o.geometry) {
        vistas.add(o);
        sombraDosCaras(o);
        if (!this.mallas.has(o)) {
          o.updateWorldMatrix(true, false);
          const reg = { firma: new Float64Array(13), caja: new THREE.Box3().setFromObject(o), dinamica: dinamico };
          firmaMalla(o, reg.firma);
          if (o.castShadow) {
            if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
            reg.esfera = new THREE.Sphere().copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
          }
          this.mallas.set(o, reg);
          // Un objeto nuevo cambia la luz a su alrededor.
          if (!dinamico && this.rejillas.length) this.ensuciarCaja(reg.caja);
          if (!dinamico) this.proxy.sucio = true;
        }
      }
      for (const h of o.children) visitar(h, dinamico);
    };
    visitar(this.scene, false);
    for (const [o, reg] of this.mallas) {
      if (vistas.has(o)) continue;
      if (!reg.dinamica && this.rejillas.length) this.ensuciarCaja(reg.caja);
      if (this.proxy.enProxy.has(o)) this.proxy.sucio = true;
      this.mallas.delete(o);
    }
    // Objetos que llevan un rato quietos y aún no están fundidos, o materiales que han cambiado.
    if (this.usaGI) {
      for (const [o, reg] of this.mallas) {
        if (this.proxy.enProxy.has(o) || reg.dinamica || this.cuadro - (reg.ultimoMov ?? -1e9) < QUIETO) continue;
        if (ProxyCapturas.apta(o, reg, this.cuadro)) { this.proxy.sucio = true; break; }
      }
      for (const o of this.proxy.materialesCambiados()) {
        this.proxy.sucio = true;
        const reg = this.mallas.get(o);
        if (reg && this.rejillas.length) this.ensuciarCaja(reg.caja, 0.5);
      }
    }
    for (const l of [...this.luces.keys()]) if (!luces.has(l)) { this.luces.delete(l); this._forzar = true; }
    luces.forEach((l, i) => { if (!this.luces.has(l)) this.luces.set(l, { desfase: this.luces.size }); });
    this.dinamicos = dinamicos;
  }

  // Compara cada malla con el fotograma anterior: devuelve lo que se ha movido.
  // `sombra`: esferas de lo que se ha movido y proyecta sombra; `estaticos`: cajas (antes y
  // después) de objetos quietos que se han movido, para la iluminación global.
  detectarMovimiento() {
    const sombra = [], estaticos = [];
    let dinamicos = 0;
    for (const [o, reg] of this.mallas) {
      if (!o.parent) continue;
      if (!firmaMalla(o, reg.firma)) continue;
      if (o.castShadow) {
        // La sombra cambia donde estaba el objeto y donde está ahora: si solo se mirara la posición
        // nueva, al salir del alcance de una luz su sombra vieja se quedaría pintada.
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const ant = reg.esfera;
        reg.esfera = (reg.esferaLibre || new THREE.Sphere()).copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
        reg.esferaLibre = ant || null;
        reg.esfera.dinamica = reg.dinamica;
        sombra.push(reg.esfera);
        if (ant) { ant.dinamica = reg.dinamica; sombra.push(ant); }
      }
      if (reg.dinamica) { dinamicos++; continue; }
      reg.ultimoMov = this.cuadro;
      if (this.proxy.enProxy.has(o)) this.proxy.sucio = true;
      const antes = reg.caja.clone();
      reg.caja.setFromObject(o);
      estaticos.push(antes, reg.caja.clone());
    }
    return { sombra, estaticos, dinamicos };
  }

  // ---------- Sombras ----------
  // El sol siempre proyecta sombra si se pide. Bombillas y focos son caros (seis vistas cada uno),
  // así que solo las luces más fuertes la proyectan, según la calidad.
  ajustarSombras() {
    const tam = this.aj.sombras || 1024;
    const puntuales = [];
    let cambio = false;
    this.scene.traverse((o) => {
      if (!o.isLight || !o.shadow) return;
      if (o.userData.sombraDeseada === undefined) o.userData.sombraDeseada = o.castShadow;
      // El cuerpo del jugador en primera persona también proyecta sombra.
      o.shadow.camera.layers.enable(CAPA_CUERPO);
      if (o.isPointLight || o.isSpotLight) {
        if (o.userData.sombraDeseada) puntuales.push(o);
        else if (o.castShadow) { o.castShadow = false; cambio = true; }
        return;
      }
      o.shadow.radius = this.aj.sombraSuave ?? 2;
      if (o.castShadow && o.shadow.mapSize.x !== tam) {
        o.shadow.mapSize.set(tam, tam);
        if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
        cambio = true;
      }
      ajustarSesgo(o);
    });
    // Las que ya tienen sombra llevan ventaja: así una antorcha que parpadea no le quita
    // la sombra a otra luz cada medio segundo.
    const peso = (l) => l.intensity * (l.distance || 20) * (l.castShadow ? 1.4 : 1);
    puntuales.sort((a, b) => peso(b) - peso(a));
    const tamP = this.aj.sombraPuntualTam || 512;
    puntuales.forEach((l, i) => {
      const si = i < (this.aj.sombrasPuntuales || 0);
      if (l.castShadow !== si) { l.castShadow = si; cambio = true; }
      if (si) {
        l.shadow.radius = this.aj.sombraSuave ?? 2;
        l.shadow.camera.near = 0.1;
        l.shadow.camera.far = l.distance || 25;
        if (l.shadow.mapSize.x !== tamP) { l.shadow.mapSize.set(tamP, tamP); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } cambio = true; }
        ajustarSesgo(l);   // sin sesgo de profundidad: ver lumbre-parche.js
      }
    });
    // Las capturas (sondas, reflejos, espejos) usan los mapas de sombra ya dibujados: si hay
    // luces nuevas con sombra, se espera a que el siguiente fotograma cree sus mapas.
    if (cambio) { this._dibujada = false; this._forzar = true; }
  }

  // El sol cubre con su sombra una zona limitada (±22 m). Para que los personajes tengan sombra
  // estén donde estén, esa zona sigue a la cámara sin cambiar la dirección de la luz.
  seguirSombras(camara) {
    if (!camara) return;
    camara.getWorldPosition(_c);
    _rot.extractRotation(camara.matrixWorld);
    _mira.set(0, 0, -1).applyMatrix4(_rot);
    _mira.y = 0;
    if (_mira.lengthSq() > 1e-6) _mira.normalize().multiplyScalar(10);
    const foco = _c.add(_mira);
    this.scene.traverse((l) => {
      if (!l.isDirectionalLight || !l.castShadow || !l.parent) return;
      const grupo = l.parent;
      grupo.updateWorldMatrix(true, false);
      _rot.extractRotation(grupo.matrixWorld);
      _n.set(0, 0, -1).applyMatrix4(_rot).normalize();      // dirección de la luz
      // Para que la sombra no tiemble al moverse, la cámara de sombra solo se desplaza en pasos de un
      // texel, medidos en sus propios ejes (los de lookAt con «arriba» = Y, como hace three.js). En
      // los ejes del mundo no basta: con el sol inclinado, el mapa se seguía desplazando a medio texel.
      const paso = (l.shadow.camera.right - l.shadow.camera.left) / l.shadow.mapSize.x;
      _p.copy(foco).addScaledVector(_n, -40);
      _der.crossVectors(_arribaY, _v.copy(_n).negate());
      if (_der.lengthSq() > 1e-8) {
        _der.normalize();
        _arr.crossVectors(_v, _der);
        const a = Math.round(_p.dot(_der) / paso) * paso, b = Math.round(_p.dot(_arr) / paso) * paso, c = _p.dot(_v);
        _p.copy(_der).multiplyScalar(a).addScaledVector(_arr, b).addScaledVector(_v, c);
      } else _p.set(Math.round(_p.x / paso) * paso, _p.y, Math.round(_p.z / paso) * paso);   // sol vertical
      grupo.worldToLocal(_p);
      if (l.position.distanceToSquared(_p) > 1e-10) {
        l.position.copy(_p);
        l.target.position.copy(_p).add(_v.set(0, 0, -1));
        l.updateMatrixWorld();
        l.target.updateMatrixWorld();
      }
      if (l.shadow.camera.far !== 100) { l.shadow.camera.far = 100; l.shadow.camera.updateProjectionMatrix(); }
    });
  }

  // Cada mapa de sombra se redibuja solo si hace falta:
  //  · al momento si la luz se ha movido, si un objeto quieto ha cambiado o si falta el mapa;
  //  · si solo se mueve un personaje, las bombillas y focos se reparten entre fotogramas, como mucho
  //    `sombraHz` veces por segundo cada una (igual a 60 que a 165 FPS), y las que no se ven (su
  //    alcance queda fuera de la cámara) esperan a verse: su sombra no sale en pantalla.
  actualizarSombras(mov, camara, dt) {
    const todo = !!this._forzar;
    let n = 0, faltaMapa = false;
    if (camara) _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse));
    const candidatas = [];
    for (const [l, reg] of this.luces) {
      if (!l.castShadow || !l.shadow) { if (l.shadow) l.shadow.autoUpdate = true; continue; }
      const sh = l.shadow;
      sh.autoUpdate = false;
      l.getWorldPosition(_p);
      l.getWorldDirection ? l.getWorldDirection(_n) : _n.set(0, 0, 0);
      let necesita = todo || !sh.map;
      if (!reg.sPos || reg.sPos.distanceToSquared(_p) > 1e-8 || (l.isSpotLight && reg.sDir.dot(_n) < 0.99999)) necesita = true;
      if (l.isDirectionalLight && l.target && reg.sObj && reg.sObj.distanceToSquared(l.target.getWorldPosition(_v)) > 1e-8) necesita = true;
      let porPersonaje = !!reg.pendienteDin;
      if (!necesita && mov.sombra.length) {
        if (l.isDirectionalLight) necesita = true;
        else {
          const alcance = l.distance || Infinity;
          for (const s of mov.sombra) {
            if (s.center.distanceTo(_p) >= alcance + s.radius) continue;
            if (s.dinamica) porPersonaje = true;
            else { necesita = true; break; }
          }
        }
      }
      if (!sh.map) faltaMapa = true;
      if (!necesita && porPersonaje) {
        reg.pendienteDin = true;
        _esfera.set(_p, l.distance || Infinity);
        if (!camara || _frustum.intersectsSphere(_esfera)) candidatas.push([l, reg]);
        continue;
      }
      if (!necesita) continue;
      this.marcarSombra(l, reg);
      n++;
    }
    // Reparto: cada fotograma se añaden candidatas × sombraHz × dt actualizaciones al cupo.
    if (candidatas.length) {
      const hz = this.aj.sombraHz || 60;
      this._cupoSombras = Math.min(candidatas.length, (this._cupoSombras || 0) + candidatas.length * hz * Math.min(dt, 0.1));
      candidatas.sort((a, b) => (a[1].tSombra || 0) - (b[1].tSombra || 0));
      for (const [l, reg] of candidatas) {
        if (this._cupoSombras < 1) break;
        this._cupoSombras -= 1;
        this.marcarSombra(l, reg);
        n++;
      }
    } else this._cupoSombras = 0;
    this.stats.sombras = n;
    // Una luz recién encendida aún no tiene mapa: las capturas esperan al siguiente fotograma.
    if (faltaMapa) this._dibujada = false;
  }

  marcarSombra(l, reg) {
    l.shadow.needsUpdate = true;
    reg.pendienteDin = false;
    reg.tSombra = performance.now();
    reg.sPos = (reg.sPos || new THREE.Vector3()).copy(l.getWorldPosition(_p));
    if (l.getWorldDirection) reg.sDir = (reg.sDir || new THREE.Vector3()).copy(l.getWorldDirection(_n));
    if (l.isDirectionalLight && l.target) reg.sObj = (reg.sObj || new THREE.Vector3()).copy(l.target.getWorldPosition(_v));
  }

  /** Para el modo del editor que no usa Lumbre: sombras como siempre. */
  modoSimple() {
    for (const l of this.luces.keys()) if (l.shadow) l.shadow.autoUpdate = true;
    this.r.toneMappingExposure = this.ent.exposicion ?? 1;
  }

  // ---------- Rejillas de sondas ----------
  cajaEscena() {
    const caja = new THREE.Box3();
    for (const [o, reg] of this.mallas) {
      if (reg.dinamica || !o.visible) continue;
      if (!reg.caja.isEmpty() && isFinite(reg.caja.min.x)) caja.union(reg.caja);
    }
    if (caja.isEmpty()) caja.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    caja.expandByScalar(0.5);
    if (caja.max.y - caja.min.y < 3) caja.max.y = caja.min.y + 3;
    return caja;
  }

  // Volúmenes de detalle definidos con nodos «VolumenLumbre».
  volumenes() {
    const r = [];
    for (const [id, n] of this.e.nodos) {
      if (n.tipo !== 'VolumenLumbre' || n.visible === false || n.eliminado) continue;
      const o = this.e.objetos.get(id);
      if (!o) continue;
      o.updateWorldMatrix(true, false);
      const centro = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      const t = new THREE.Vector3().setFromMatrixScale(o.matrixWorld);
      r.push({ caja: new THREE.Box3().setFromCenterAndSize(centro, new THREE.Vector3(Math.abs(t.x), Math.abs(t.y), Math.abs(t.z))), densidad: n.props.densidad || 1.5, nombre: n.nombre });
    }
    return r;
  }

  // Cada zona (un volumen o la escena entera) tiene tres rejillas iguales:
  //  · «global»: la luz del sol y del cielo, guardada por unidad de luz (dividida por la luz que
  //    había al capturarla);
  //  · «locales»: bombillas, focos, antorchas y materiales que brillan;
  //  · la final, la única que ven los materiales: global × luz actual + locales, combinada en la
  //    GPU. Si el sol o el cielo cambian de color o de fuerza (amanecer, noche…), la final se
  //    rehace al instante sin recalcular ninguna sonda.
  asegurarRejillas(forzar = false) {
    const vols = this.volumenes();
    const global = this.cajaEscena();
    const firmaCaja = (c) => [c.min.x, c.min.y, c.min.z, c.max.x, c.max.y, c.max.z].map(v => Math.round(v * 2)).join(',');
    const firma = [...vols.map(v => firmaCaja(v.caja) + '@' + v.densidad), firmaCaja(global)].join('|') + '|' + this.nivel;
    if (this.rejillas.length && !forzar && firma === this.firmaRejillas) return;
    this.quitarRejillas();
    this.firmaRejillas = firma;
    // Todas las rejillas usan el mismo alcance de captura: así three.js no rehace su cubemapa interno.
    this.lejos = Math.max(20, global.getSize(_v).length() * 1.2);
    const solidos = this.solidosEscena();
    // Los volúmenes van primero: three.js usa la primera rejilla que contiene cada objeto.
    for (const v of vols) this.crearRejilla(v.caja, 1 / v.densidad, this.aj.maxSondasVolumen || 500, v.nombre, solidos);
    this.crearRejilla(global, this.aj.celda, this.aj.maxSondas, 'escena', solidos);
    // La escena simplificada se reparte por zonas: necesita saber dónde está cada una.
    this.proxy.sucio = true;
    this.estado = 'calculando';
    this.precompilar();
    this.componer(true);
  }

  // Cajas de los objetos quietos y opacos, para sacar de ellos las sondas.
  solidosEscena() {
    const r = [];
    for (const [o, reg] of this.mallas) {
      if (reg.dinamica || !o.visible || reg.caja.isEmpty()) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent || m.isMeshBasicMaterial || m.isLineBasicMaterial) continue;
      const t = reg.caja.getSize(_v);
      const plano = t.y < 0.06 && t.x > 0.3 && t.z > 0.3;
      if (!plano && Math.min(t.x, t.y, t.z) < 0.06) continue;
      // En un muro con puerta, las sondas del hueco se quedan donde están.
      const huecos = o.userData.cajasHuecos;
      if (huecos && huecos.length) for (const b of restarCajas(reg.caja, huecos)) r.push({ b, plano });
      else r.push({ b: reg.caja, plano });
    }
    return r;
  }

  crearRejilla(caja, celdaBase, maxSondas, nombre, solidos) {
    const t = caja.getSize(new THREE.Vector3());
    let celda = celdaBase;
    const contar = (c) => [t.x, t.y, t.z].map(v => Math.max(2, Math.ceil(v / c) + 1));
    let n = contar(celda);
    while (n[0] * n[1] * n[2] > maxSondas) { celda *= 1.12; n = contar(celda); }
    const nueva = (sufijo) => {
      const g = new LightProbeGridWebGL(t.x, t.y, t.z, n[0], n[1], n[2]);
      g.name = '__lumbre_' + nombre + sufijo;
      caja.getCenter(g.position);
      g.updateMatrixWorld();
      g.updateBoundingBox();
      this.scene.add(g);
      return g;
    };
    const total = n[0] * n[1] * n[2];
    const final = nueva('');
    final._ensureTextures();
    const comp = (tipo) => {
      const g = nueva('_' + tipo);
      g.visible = false;
      this.copiaRapidaRebote(g);
      return { tipo, g, sucias: new Uint8Array(total), nSucias: 0, indice: 0, ciclos: 0, indiceGoteo: 0 };
    };
    const paso = new THREE.Vector3(t.x / (n[0] - 1), t.y / (n[1] - 1), t.z / (n[2] - 1));
    const r = { final, total, nx: n[0], ny: n[1], nz: n[2], caja: caja.clone(), paso, nombre, desplazadas: 0, componer: true, capasSucias: new Uint8Array(n[2]) };
    r.comps = { global: comp('global'), locales: comp('locales') };
    for (const c of Object.values(r.comps)) c.region = r;
    this.reubicarSondas(r, solidos);
    this.rejillas.push(r);
  }

  // three.js guarda el «rebote anterior» copiando el atlas con copyTextureToTexture, que con texturas
  // 3D de coma flotante en Windows (ANGLE/Direct3D) tarda 25-35 ms de GPU. Aquí se copia capa a capa
  // con un shader (texelFetch: copia exacta, sin filtrar), en unas décimas de milisegundo.
  copiaRapidaRebote(g) {
    const original = g._updateBakeTexture.bind(g);
    g._updateBakeTexture = (renderer, pass, start) => {
      if (pass === 0) return original(renderer, pass, start);
      if (start === 0 || !g._bounceTarget) {
        if (!g._bounceTarget) g._bounceTarget = g._renderTarget.clone();
        this.copiarAtlas(g._renderTarget, g._bounceTarget);
        g._bouncePass = pass;
      }
      g.texture = g._bounceTarget.texture;
    };
  }

  quadCopia() {
    if (!this._quadCopia) {
      this._quadCopia = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { tOrigen: { value: null }, capa: { value: 0 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `precision highp sampler3D; uniform sampler3D tOrigen; uniform int capa;
          void main() { gl_FragColor = texelFetch(tOrigen, ivec3(gl_FragCoord.xy, capa), 0); }`,
        depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      }));
    }
    return this._quadCopia;
  }

  copiarAtlas(origen, destino, desde = 0, hasta = destino.depth) {
    this.quadCopia();
    const r = this.r;
    r.initRenderTarget(origen);
    const mat = this._quadCopia.material;
    mat.uniforms.tOrigen.value = origen.texture;
    const previo = r.getRenderTarget(), autoClear = r.autoClear;
    r.autoClear = false;
    destino.viewport.set(0, 0, destino.width, destino.height);
    for (let capa = desde; capa < Math.min(hasta, destino.depth); capa++) {
      mat.uniforms.capa.value = capa;
      r.setRenderTarget(destino, capa);
      this._quadCopia.render(r);
    }
    r.autoClear = autoClear;
    r.setRenderTarget(previo);
  }

  /** Lista de componentes (global y locales de cada zona). */
  componentes() {
    const r = [];
    for (const z of this.rejillas) r.push(z.comps.global, z.comps.locales);
    return r;
  }

  // Sondas dentro de un muro verían el exterior a través de sus caras interiores (que no se
  // dibujan) y meterían luz en la sala: se sacan por la cara más cercana. Las que quedan justo
  // bajo un suelo se suben encima.
  reubicarSondas(r, solidos) {
    const { nx, ny, nz, paso } = r;
    const g0 = r.final;
    const lista = solidos.filter(s => s.b.intersectsBox(r.caja));
    if (!lista.length) return;
    const margen = Math.min(0.2, Math.min(paso.x, paso.y, paso.z) * 0.25);
    const desp = new Float32Array(r.total * 3);
    const p = new THREE.Vector3(), base = new THREE.Vector3();
    let cuantas = 0;
    for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      g0.getProbePosition(ix, iy, iz, base);
      p.copy(base);
      for (let vuelta = 0; vuelta < 4; vuelta++) {
        let mejor = null, mejorD = Infinity, eje = 0, signo = 1;
        for (const s of lista) {
          const b = s.b;
          if (p.x <= b.min.x || p.x >= b.max.x || p.z <= b.min.z || p.z >= b.max.z) continue;
          if (s.plano) {
            if (p.y < b.max.y && p.y > b.max.y - paso.y * 0.9) { const d = b.max.y - p.y; if (d < mejorD) { mejorD = d; mejor = s; eje = 1; signo = 1; } }
            continue;
          }
          if (p.y <= b.min.y || p.y >= b.max.y) continue;
          const opciones = [[p.x - b.min.x, 0, -1], [b.max.x - p.x, 0, 1], [p.y - b.min.y, 1, -1], [b.max.y - p.y, 1, 1], [p.z - b.min.z, 2, -1], [b.max.z - p.z, 2, 1]];
          for (const [d, e, sg] of opciones) if (d < mejorD) { mejorD = d; mejor = s; eje = e; signo = sg; }
        }
        if (!mejor) break;
        p.setComponent(eje, p.getComponent(eje) + signo * (mejorD + margen));
      }
      if (p.distanceToSquared(base) > 1e-8) {
        const k = (ix + iz * nx + iy * nx * nz) * 3;
        desp[k] = p.x - base.x; desp[k + 1] = p.y - base.y; desp[k + 2] = p.z - base.z;
        cuantas++;
      }
    }
    if (!cuantas) return;
    r.desplazadas = cuantas;
    for (const c of Object.values(r.comps)) {
      const g = c.g;
      const original = g.getProbePosition.bind(g);
      g.getProbePosition = (ix, iy, iz, destino) => {
        original(ix, iy, iz, destino);
        const k = (ix + iz * nx + iy * nx * nz) * 3;
        destino.x += desp[k]; destino.y += desp[k + 1]; destino.z += desp[k + 2];
        return destino;
      };
    }
  }

  quitarRejillas() {
    for (const r of this.rejillas) for (const g of [r.final, r.comps.global.g, r.comps.locales.g]) { this.scene.remove(g); g.dispose(); }
    this.rejillas = [];
    this.firmaRejillas = '';
  }

  // ---------- Luz del sol y del cielo ----------
  // Lo que aportan el sol y el cielo (color × fuerza), para normalizar la componente global.
  energiaGlobal(destino) {
    destino.setRGB(0, 0, 0);
    this.scene.traverse((l) => {
      if (!l.isDirectionalLight || !visibleDeVerdad(l)) return;
      destino.r += l.color.r * l.intensity; destino.g += l.color.g * l.intensity; destino.b += l.color.b * l.intensity;
    });
    const cielo = this.colorCielo(_col);
    destino.r += cielo.r; destino.g += cielo.g; destino.b += cielo.b;
    destino.r = Math.max(destino.r, 1e-3); destino.g = Math.max(destino.g, 1e-3); destino.b = Math.max(destino.b, 1e-3);
    return destino;
  }

  // Brillo del cielo en las capturas. Se divide entre π: un cielo de brillo L ilumina un suelo
  // con π·L, y así la luz del cielo coincide con la luz ambiental clásica (antes era tres veces
  // más fuerte y rellenaba las sombras).
  colorCielo(destino) {
    const ambiente = (this.ent.ambiente ?? 0.35) * 2.2;
    return destino.copy(this.e.hemi.color).multiplyScalar(ambiente * (this.ent.luz_cielo ?? 1) / Math.PI);
  }

  // Prepara la escena para capturar una componente; devuelve cómo dejarla como estaba.
  prepararComponente(tipo) {
    const guardado = [];
    for (const r of this.rejillas) {
      guardado.push([r.final, r.final.visible]);
      r.final.visible = false;
      for (const c of Object.values(r.comps)) { guardado.push([c.g, c.g.visible]); c.g.visible = c.tipo === tipo; }
    }
    const luces = [];
    const E = tipo === 'global' ? this.energiaGlobal(_E) : null;
    this.scene.traverse((l) => {
      if (!l.isLight || l.isHemisphereLight || l.isAmbientLight) return;
      if (l.isDirectionalLight) {
        if (tipo === 'global') { luces.push([l, l.intensity, l.color.clone()]); l.color.setRGB(l.color.r / E.r, l.color.g / E.g, l.color.b / E.b); }
        else { luces.push([l, l.intensity, null]); l.intensity = 0; }
      } else if (tipo === 'global') { luces.push([l, l.intensity, null]); l.intensity = 0; }
    });
    // Lo que brilla es luz local: no entra en la componente global.
    const brillos = [];
    if (tipo === 'global' && this.proxy.grupo) for (const m of this.proxy.grupo.children) if (m.userData.brilla) { brillos.push([m, m.visible]); m.visible = false; }
    this._cieloComp ||= new THREE.Color();
    if (tipo === 'global') { this.colorCielo(this._cieloComp); this._cieloComp.setRGB(this._cieloComp.r / E.r, this._cieloComp.g / E.g, this._cieloComp.b / E.b); }
    else this._cieloComp.setRGB(0, 0, 0);
    const fondo = this.scene.background;
    this.scene.background = this._cieloComp;
    return () => {
      for (const [g, v] of guardado) g.visible = v;
      for (const [l, i, c] of luces) { l.intensity = i; if (c) l.color.copy(c); }
      for (const [m, v] of brillos) m.visible = v;
      this.scene.background = fondo;
    };
  }

  quadComponer() {
    if (!this._quadComponer) {
      this._quadComponer = new FullScreenQuad(new THREE.ShaderMaterial({
        uniforms: { tG: { value: null }, tL: { value: null }, capa: { value: 0 }, escala: { value: new THREE.Vector4() } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        // texelFetch: cada texel de la final sale exactamente de su texel en global y locales.
        fragmentShader: `precision highp sampler3D;
          uniform sampler3D tG; uniform sampler3D tL; uniform int capa; uniform vec4 escala;
          void main() { ivec3 p = ivec3(gl_FragCoord.xy, capa); gl_FragColor = texelFetch(tG, p, 0) * escala + texelFetch(tL, p, 0); }`,
        depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      }));
    }
    return this._quadComponer;
  }

  // Los shaders de copia y combinación se compilan al crear las rejillas (durante la carga): si se
  // compilaran al usarse por primera vez, darían un tirón de ~30 ms en mitad de la partida.
  precompilar() {
    const cam = new THREE.OrthographicCamera();
    // Con un destino que no es la pantalla, como al usarlos (sin tonos ni sRGB): mismo programa.
    const previo = this.r.getRenderTarget();
    this.r.setRenderTarget(this.rejillas[0].final._renderTarget);
    for (const q of [this.quadCopia(), this.quadComponer()]) this.r.compile(q._mesh, cam);
    this.r.setRenderTarget(previo);
  }

  // ---------- Combinación final ----------
  // final = global × luz del sol y del cielo + locales, coeficiente a coeficiente (los armónicos
  // esféricos se pueden sumar y escalar). Cada «capa» del atlas guarda 4 números de 27 por sonda:
  // el canal de color de cada uno depende de su posición.
  componer(todo = false) {
    if (!this.rejillas.length) return;
    const E = this.energiaGlobal(_E);
    const cambioLuz = !this._Ecomp || Math.abs(E.r - this._Ecomp.r) + Math.abs(E.g - this._Ecomp.g) + Math.abs(E.b - this._Ecomp.b) > 0.002 * (E.r + E.g + E.b);
    if (cambioLuz) {
      (this._Ecomp ||= new THREE.Color()).copy(E);
      for (const r of this.rejillas) r.pendienteLuz = true;
    }
    // Si cambia la luz (un amanecer animado la cambia en cada fotograma) hay que rehacer cada zona
    // entera; para no saturar el proceso de GPU del navegador, como mucho una zona por fotograma.
    // Dentro de una zona se hace todo a la vez, para que no se vean capas con luces distintas.
    let porLuz = 0;
    const pendientes = this.rejillas.filter(r => todo || r.componer || (r.pendienteLuz && porLuz++ < 1));
    if (!pendientes.length) return;
    this.quadComponer();
    const mat = this._quadComponer.material;
    const previo = this.r.getRenderTarget();
    const autoClear = this.r.autoClear;
    this.r.autoClear = false;
    const ch = [E.r, E.g, E.b];
    for (const r of pendientes) {
      const rt = r.final._renderTarget;
      const g = r.comps.global.g, l = r.comps.locales.g;
      if (!rt || !g._renderTarget || !l._renderTarget) { g._ensureTextures(); l._ensureTextures(); }
      mat.uniforms.tG.value = g._renderTarget.texture;
      mat.uniforms.tL.value = l._renderTarget.texture;
      const prof = rt.depth, porSub = r.nz + 2;
      // Si solo han cambiado unas sondas, se rehacen solo sus capas Z (y el relleno de los bordes,
      // que repite la primera y la última).
      const capas = todo || r.pendienteLuz ? null : r.capasSucias;
      rt.viewport.set(0, 0, rt.width, rt.height);
      for (let capa = 0; capa < prof; capa++) {
        if (capas && !capas[Math.min(r.nz - 1, Math.max(0, (capa % porSub) - 1))]) continue;
        const t = Math.floor(capa / porSub);
        mat.uniforms.escala.value.set(ch[(4 * t) % 3], ch[(4 * t + 1) % 3], ch[(4 * t + 2) % 3], ch[(4 * t + 3) % 3]);
        mat.uniforms.capa.value = capa;
        this.r.setRenderTarget(rt, capa);
        this._quadComponer.render(this.r);
      }
      r.capasSucias.fill(0);
      r.componer = false;
      r.pendienteLuz = false;
      r.final.texture = rt.texture;
    }
    this.r.autoClear = autoClear;
    this.r.setRenderTarget(previo);
  }

  // ---------- Sondas pendientes ----------
  ensuciarCaja(caja, extra = 0, tipos = TIPOS) {
    for (const r of this.rejillas) {
      if (!r.caja.intersectsBox(caja)) continue;
      const min = r.caja.min, { paso } = r;
      const rango = (eje, n) => {
        const a = Math.floor((caja.min.getComponent(eje) - extra - min.getComponent(eje)) / paso.getComponent(eje)) - 1;
        const b = Math.ceil((caja.max.getComponent(eje) + extra - min.getComponent(eje)) / paso.getComponent(eje)) + 1;
        return [Math.max(0, a), Math.min(n - 1, b)];
      };
      const [x0, x1] = rango(0, r.nx), [y0, y1] = rango(1, r.ny), [z0, z1] = rango(2, r.nz);
      for (const tipo of tipos) {
        const c = r.comps[tipo];
        for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
          const k = ix + iz * r.nx + iy * r.nx * r.nz;
          if (!c.sucias[k]) { c.sucias[k] = 1; c.nSucias++; }
        }
      }
    }
  }

  // Un hueco ha recortado (o dejado de recortar) una malla: la luz de alrededor cambia.
  geometriaCambiada(o) {
    const reg = this.mallas.get(o);
    if (!reg) return;
    const antes = reg.caja.clone();
    reg.caja.setFromObject(o);
    if (this.rejillas.length) { this.ensuciarCaja(antes, 0.5); this.ensuciarCaja(reg.caja, 0.5); }
    this.proxy.sucio = true;
    this._forzar = true;
  }

  ensuciarEsfera(centro, radio, tipos = TIPOS) {
    _caja.min.set(centro.x - radio, centro.y - radio, centro.z - radio);
    _caja.max.set(centro.x + radio, centro.y + radio, centro.z + radio);
    this.ensuciarCaja(_caja, 0, tipos);
  }

  ensuciarTodo(tipo) {
    for (const r of this.rejillas) { const c = r.comps[tipo]; c.sucias.fill(1); c.nSucias = r.total; }
  }

  // Luces que se mueven o cambian: bombillas y focos marcan sus sondas «locales». El sol y el
  // cielo no hace falta recalcularlos para que se note el cambio (la combinación lo hace al
  // instante); solo se recalculan poco a poco si cambia la dirección del sol o el reparto entre
  // sol y cielo, para afinar.
  detectarCambiosLuz() {
    let global = false, cambio = false;
    for (const [l, reg] of this.luces) {
      if (!l.parent || l.isHemisphereLight || l.isAmbientLight) continue;
      const visible = visibleDeVerdad(l);
      l.getWorldPosition(_p);
      if (l.isDirectionalLight) { l.target.getWorldPosition(_n); _n.sub(_p).normalize(); }
      const gi = reg.gi;
      if (!gi) { reg.gi = { pos: _p.clone(), dir: _n.clone(), int: l.intensity, col: l.color.clone(), vis: visible }; continue; }
      const ref = Math.max(0.05, gi.int);
      const brillo = Math.abs(l.intensity - gi.int) / ref > 0.3;
      const color = Math.abs(l.color.r - gi.col.r) + Math.abs(l.color.g - gi.col.g) + Math.abs(l.color.b - gi.col.b) > 0.08;
      const vis = visible !== gi.vis;
      let mov = false;
      if (l.isDirectionalLight) mov = gi.dir.dot(_n) < 0.9995;
      else mov = gi.pos.distanceTo(_p) > Math.max(0.35, (this.rejillas[0]?.paso.x || 1) * 0.4);
      if (!(brillo || color || vis || mov)) continue;
      cambio = true;
      if (l.isDirectionalLight) global = true;
      else {
        // Más allá de ~70 % de su alcance la luz ya apenas cambia los rebotes.
        const radio = (l.distance > 0 ? l.distance : 15) * 0.7;
        this.ensuciarEsfera(gi.pos, radio, ['locales']);
        if (mov) this.ensuciarEsfera(_p, radio, ['locales']);
      }
      gi.pos.copy(_p); gi.dir.copy(_n); gi.int = l.intensity; gi.col.copy(l.color); gi.vis = visible;
    }
    const cielo = [this.ent.cielo, this.ent.horizonte, Math.round((this.ent.ambiente ?? 0.35) * 40), this.ent.luz_cielo].join('|');
    if (this._firmaCielo !== undefined && this._firmaCielo !== cielo) { global = true; cambio = true; }
    this._firmaCielo = cielo;
    if (global) this.ensuciarTodo('global');
    return cambio;
  }

  // Elige las sondas pendientes más cercanas a la cámara y las agrupa en tramos seguidos.
  elegirSucias(camara, cuantas) {
    camara.getWorldPosition(_c);
    const cand = [];
    for (const c of this.componentes()) {
      const r = c.region;
      if (!c.nSucias || c.ciclos < 1) continue;
      const { nx, nz, paso } = r, min = r.caja.min, sucias = c.sucias;
      // Lo local primero: es lo que cambia ante los ojos (luces que se mueven o parpadean).
      const extra = c.tipo === 'locales' ? 0 : 4;
      for (let k = 0; k < r.total; k++) {
        if (!sucias[k]) continue;
        const ix = k % nx, iz = Math.floor(k / nx) % nz, iy = Math.floor(k / (nx * nz));
        const dx = min.x + ix * paso.x - _c.x, dy = min.y + iy * paso.y - _c.y, dz = min.z + iz * paso.z - _c.z;
        const d = dx * dx + dy * dy + dz * dz + extra;
        if (cand.length < cuantas) { cand.push([d, c, k]); if (cand.length === cuantas) cand.sort((a, b) => a[0] - b[0]); }
        else if (d < cand[cuantas - 1][0]) {
          let i = cuantas - 1;
          while (i > 0 && cand[i - 1][0] > d) { cand[i] = cand[i - 1]; i--; }
          cand[i] = [d, c, k];
        }
      }
    }
    // Tramos [componente, inicio, cuántas]
    const porComp = new Map();
    for (const [, c, k] of cand) { if (!porComp.has(c)) porComp.set(c, []); porComp.get(c).push(k); }
    const tramos = [];
    // Huecos pequeños entre sondas se capturan también (sale más barato que otra llamada), pero sin
    // pasarse más de un 25 % del presupuesto: si no, un fotograma podía capturar el doble de lo previsto.
    let extra = Math.floor(cuantas / 4);
    for (const [c, ks] of porComp) {
      ks.sort((a, b) => a - b);
      let ini = ks[0], fin = ks[0];
      for (let i = 1; i <= ks.length; i++) {
        const hueco = i < ks.length ? ks[i] - fin - 1 : Infinity;
        if (hueco <= Math.min(2, extra)) { extra -= hueco; fin = ks[i]; continue; }
        tramos.push([c, ini, fin - ini + 1]);
        if (i < ks.length) { ini = fin = ks[i]; }
      }
    }
    return tramos;
  }

  // Captura un tramo de sondas de una componente. Las sombras no se redibujan: cada luz ya
  // decidió en actualizarSombras si lo necesitaba este fotograma.
  capturar(c, inicio, cuantas) {
    const t0 = performance.now();
    const midiendo = this.reloj.empezar();
    try {
      c.g.bake(this.r, this.scene, { cubemapSize: this.aj.cubo, near: 0.05, far: this.lejos, start: inicio, count: cuantas, pass: 1 });
    } catch (e) { console.warn('Lumbre', e); return false; }
    finally {
      // Lo que tarda de verdad en la GPU (llega unos fotogramas después).
      if (midiendo) this.reloj.terminar((ms) => { const v = ms / cuantas; this._msSondaGPU = this._msSondaGPU ? this._msSondaGPU * 0.8 + v * 0.2 : v; });
    }
    this._ultimaCaptura = this.cuadro;
    const r = c.region;
    for (let k = inicio; k < inicio + cuantas; k++) {
      if (c.sucias[k]) { c.sucias[k] = 0; c.nSucias--; }
      r.capasSucias[Math.floor(k / r.nx) % r.nz] = 1;
    }
    r.componer = true;
    this.stats.sondas += cuantas;
    // Lo que tarda cada sonda en este equipo y esta escena: sirve para repartir el presupuesto.
    const ms = (performance.now() - t0) / Math.max(1, cuantas);
    this._msSonda = this._msSonda ? this._msSonda * 0.8 + ms * 0.2 : ms;
    return true;
  }

  // Copia la iluminación actual de las componentes como «rebote anterior» para sus capturas. Cada
  // capa del atlas es un cambio de destino de dibujo, y con varias zonas son cientos: hechos de golpe
  // saturaban el proceso de GPU del navegador y se saltaba fotogramas. Se copian como mucho
  // CAPAS_POR_CUADRO capas por fotograma; la instantánea completa tarda unos pocos fotogramas.
  instantaneaRebote(dt, comps) {
    this._tInstantanea = (this._tInstantanea || 0) - dt;
    if (this._tInstantanea <= 0 && !this._colaInstantanea?.length) {
      this._tInstantanea = 1;
      this._colaInstantanea = comps.filter(c => c.ciclos >= 1 && c.g._bouncePass === 1 && c.g._bounceTarget).map(c => [c, 0]);
    }
    const cola = this._colaInstantanea;
    let quedan = CAPAS_POR_CUADRO;
    while (cola?.length && quedan > 0) {
      const tarea = cola[0], g = tarea[0].g;
      const hasta = Math.min(g._bounceTarget.depth, tarea[1] + quedan);
      this.copiarAtlas(g._renderTarget, g._bounceTarget, tarea[1], hasta);
      quedan -= hasta - tarea[1];
      tarea[1] = hasta;
      if (hasta >= g._bounceTarget.depth) cola.shift();
    }
  }

  actualizarGI(camara, ocultar, restaurar, dt) {
    if (!this.rejillas.length || !this._dibujada) return;
    const dinamica = this.ent.gi_dinamica !== false;
    const rebotes = this.aj.rebotes || 1;
    const comps = this.componentes();
    // Primero la primera vuelta de todas las componentes (para que haya luz cuanto antes, empezando
    // por la del sol y el cielo) y después los rebotes.
    const inicial = comps.find(x => x.ciclos < 1 && x.tipo === 'global') || comps.find(x => x.ciclos < 1) || comps.find(x => x.ciclos < rebotes);
    // Los presupuestos de las calidades están pensados para 60 FPS. Con más FPS cada fotograma recibe
    // su parte proporcional: el trabajo por segundo (y la parte del tiempo que se lleva) no cambia con
    // la frecuencia del monitor. Con menos FPS no se aumenta, para no hundirlos más.
    const parte = Math.min(1, Math.max(0.1, dt * 60));
    if (dinamica) {
      // Goteo: una sonda de vez en cuando, para que los rebotes terminen de asentarse.
      this.goteo += (this.aj.goteo || 0) * parte;
      while (this.goteo >= 1) {
        this.goteo -= 1;
        const c = comps[(this._turnoGoteo = ((this._turnoGoteo || 0) + 1)) % comps.length];
        c.indiceGoteo = (c.indiceGoteo + 1) % c.region.total;
        if (c.ciclos >= 1 && !c.sucias[c.indiceGoteo]) { c.sucias[c.indiceGoteo] = 1; c.nSucias++; }
      }
    }
    const pendientes = dinamica && comps.some(c => c.nSucias && c.ciclos >= 1);
    this.estado = comps.every(x => x.ciclos >= 1) ? 'lista' : 'calculando';
    if (inicial || pendientes) {
      // La escena simplificada se rehace como mucho dos veces por segundo.
      if (this.proxy.sucio && this.cuadro - this.proxy.ultimo > 30) this.proxy.construir(this.mallas, this.cuadro, this.zonasProxy());
      // Trabajo de este fotograma, por componente.
      const trabajo = { global: [], locales: [] };
      // Un solo presupuesto de tiempo por fotograma (msGI de la calidad), medido con lo que de verdad
      // tarda una sonda (procesador o GPU, lo que más), y repartido entre la vuelta de rebotes en curso
      // y las sondas que han cambiado. La primera vuelta (la escena aún sin luz rebotada) usa más.
      // Como puede caber menos de una sonda por fotograma, lo que sobra se guarda para el siguiente.
      // Sin ráfagas: como mucho el doble del ritmo medio en un fotograma. Fuera de la primera vuelta,
      // el ritmo lo modera `factorGI` (ver regularGI).
      const primera = !!inicial && inicial.ciclos < 1;
      const ritmo = (primera ? 16 : (this.aj.msGI || 3) * this.factorGI) * parte / this.msSonda;
      const tope = Math.min(primera ? 64 : this.aj.presupuesto, Math.max(1, Math.ceil(ritmo * 2)));
      this._cupoGI = Math.min(tope, (this._cupoGI || 0) + ritmo);
      const cupo = Math.max(primera ? 1 : 0, Math.floor(this._cupoGI));
      this._cupoGI = Math.max(0, this._cupoGI - cupo);
      let resto = cupo;
      if (inicial && cupo > 0) {
        const n = Math.min(pendientes ? Math.ceil(cupo / 2) : cupo, inicial.region.total - inicial.indice);
        trabajo[inicial.tipo].push(['inicial', inicial, inicial.indice, n]);
        resto -= n;
      }
      if (pendientes) {
        // La luz rebotada que ven las capturas se refresca cada cierto tiempo.
        this.instantaneaRebote(dt, comps);
        if (resto > 0) for (const [c, ini, n] of this.elegirSucias(camara, resto).slice(0, 6)) trabajo[c.tipo].push(['sucia', c, ini, n]);
      }
      if (!trabajo.global.length && !trabajo.locales.length) { this.componer(); return; }
      ocultar(true);
      ESPEJOS_ACTIVOS.value = 0;
      try {
        for (const tipo of TIPOS) {
          if (!trabajo[tipo].length) continue;
          const deshacer = this.prepararComponente(tipo);
          try {
            for (const [clase, c, ini, n] of trabajo[tipo]) {
              if (!this.capturar(c, ini, n)) { this.quitarRejillas(); return; }
              if (clase === 'inicial') {
                c.indice += n;
                if (c.indice >= c.region.total) { c.indice = 0; c.ciclos++; c.sucias.fill(0); c.nSucias = 0; }
              }
            }
          } finally { deshacer(); }
        }
        this.estado = comps.every(x => x.ciclos >= 1) ? 'lista' : 'calculando';
      } finally {
        ESPEJOS_ACTIVOS.value = 1;
        restaurar();
      }
    }
    // Combinación final: si cambió la luz del sol o del cielo, o alguna zona recibió capturas.
    this.componer();
  }

  // Zonas para la escena simplificada: cada malla fundida se coloca dentro de su zona para que,
  // al capturar, use la rejilla de esa zona (y no la de la escena entera).
  zonasProxy() {
    const zonas = [];
    for (const r of this.rejillas) {
      const pos = r.caja.getCenter(new THREE.Vector3());
      // El centro de la zona general puede caer dentro de un volumen: se busca otro punto.
      const libre = (p) => zonas.every(z => !z.caja.containsPoint(p));
      if (!libre(pos)) {
        const t = r.caja.getSize(new THREE.Vector3()).multiplyScalar(0.49);
        for (const s of [[-1, -1, -1], [1, -1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, -1], [1, 1, 1]]) {
          const p = pos.clone().add(new THREE.Vector3(s[0] * t.x, s[1] * t.y, s[2] * t.z));
          if (libre(p)) { pos.copy(p); break; }
        }
      }
      zonas.push({ caja: r.caja, pos });
    }
    return zonas;
  }

  /** La escena ha cambiado (objetos nuevos o borrados, materiales…). */
  marcarCambio() {
    this.recogerEscena();
    if (this.usaGI || this.usaComposer) this.prepararMateriales();
    if (this.usaGI) this.asegurarRejillas();
    this.ajustarSombras();
    this.asegurarEspejos();
    this._forzar = true;
  }

  // ---------- Espejos ----------
  // Un objeto es espejo si su material (o el nodo) pide reflejo «plano» o «curvo».
  asegurarEspejos(forzar = false) {
    const planos = [], curvos = [];
    const ocultos = new Set(this.ocultables());
    const visitar = (o) => {
      if (ocultos.has(o)) return;
      if (o.isMesh && o.material && !Array.isArray(o.material)) {
        const reg = this.espejos.get(o);
        const cfg = reg ? reg.cfg : (o.userData.espejo || o.material.userData.espejo);
        if (cfg && cfg.tipo === 'plano' && o.material.isMeshStandardMaterial) planos.push({ o, cfg });
        if (cfg && cfg.tipo === 'curvo' && o.material.isMeshStandardMaterial) curvos.push({ o, cfg });
      }
      for (const h of o.children) visitar(h);
    };
    visitar(this.scene);
    const maxP = this.activada ? this.aj.espejosPlanos || 0 : 0, maxC = this.activada ? this.aj.espejosCurvos || 0 : 0;
    const quiero = new Set([...planos.slice(0, maxP), ...curvos.slice(0, maxC)].map(x => x.o));
    for (const [o, reg] of this.espejos) if (forzar || !quiero.has(o) || !o.parent) this.quitarEspejo(o, reg);
    for (const { o, cfg } of [...planos, ...curvos]) if (quiero.has(o) && !this.espejos.has(o)) this.crearEspejo(o, cfg);
  }

  clonarMaterial(o) {
    const original = o.material;
    const m = original.clone();
    delete m.userData.lumbre;
    delete m.userData.espejoListo;
    o.material = m;
    return original;
  }

  crearEspejo(o, cfg) {
    const original = this.clonarMaterial(o);
    if (cfg.tipo === 'plano') {
      const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      const u = {
        tEspejo: { value: rt.texture }, matEspejo: { value: new THREE.Matrix4() },
        espejoIntensidad: { value: cfg.intensidad ?? 1 }, espejoDesenfoque: { value: cfg.desenfoque ?? 1 }, espejoMaxLod: { value: 4 },
      };
      prepararEspejo(o.material, u);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const camara = new THREE.PerspectiveCamera();
      camara.layers.enable(CAPA_CUERPO);   // en el espejo sí se ve el cuerpo del jugador
      this.espejos.set(o, { tipo: 'plano', cfg, original, rt, u, camara, firma: new Float32Array(16) });
    } else {
      prepararMaterial(o.material);
      const cubo = new THREE.WebGLCubeRenderTarget(this.aj.curvoTam || 128, { type: THREE.HalfFloatType });
      this.pmremCurvos ||= new THREE.PMREMGenerator(this.r);
      o.material.envMapIntensity = cfg.intensidad ?? 1;
      const camara = new THREE.CubeCamera(0.05, 500, cubo);
      camara.children.forEach(c => c.layers.enable(CAPA_CUERPO));
      cubo.texture.generateMipmaps = false;   // el filtrado (PMREM) lee solo el nivel 0
      this.espejos.set(o, { tipo: 'curvo', cfg, original, cubo, camara, rt: null, t: 0, cara: -1 });
    }
  }

  quitarEspejo(o, reg) {
    if (o.material !== reg.original) { o.material.dispose(); o.material = reg.original; }
    reg.rt?.dispose();
    reg.cubo?.dispose();
    this.espejos.delete(o);
  }

  // Cámara reflejada respecto al plano del objeto (su eje Y local), como en el Reflector de three.js.
  renderizarEspejoPlano(o, reg, camara, ancho, alto) {
    o.updateWorldMatrix(true, false);
    _rot.extractRotation(o.matrixWorld);
    _n.set(0, 1, 0).applyMatrix4(_rot).normalize();
    _p.set(0, o.geometry.boundingBox.max.y, 0).applyMatrix4(o.matrixWorld);
    _c.setFromMatrixPosition(camara.matrixWorld);
    _v.subVectors(_p, _c);
    if (_v.dot(_n) > 0) return false; // la cámara está detrás del espejo
    const w = Math.max(16, Math.round(ancho * this.pixelRatio() * (this.aj.espejoEscala || 0.5)));
    const h = Math.max(16, Math.round(alto * this.pixelRatio() * (this.aj.espejoEscala || 0.5)));
    if (reg.rt.width !== w || reg.rt.height !== h) { reg.rt.setSize(w, h); reg.u.espejoMaxLod.value = Math.floor(Math.log2(Math.max(w, h))); }
    const rc = reg.camara;
    _v.reflect(_n).negate().add(_p);
    _rot.extractRotation(camara.matrixWorld);
    _mira.set(0, 0, -1).applyMatrix4(_rot).add(_c);
    _obj.subVectors(_p, _mira).reflect(_n).negate().add(_p);
    rc.position.copy(_v);
    rc.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n);
    rc.lookAt(_obj);
    rc.far = camara.far;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(camara.projectionMatrix);
    reg.u.matEspejo.value.copy(_sesgo).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
    // Plano de recorte oblicuo: no se dibuja lo que hay detrás del espejo.
    _plano.setFromNormalAndCoplanarPoint(_n, _p).applyMatrix4(rc.matrixWorldInverse);
    _clip.set(_plano.normal.x, _plano.normal.y, _plano.normal.z, _plano.constant);
    const pm = rc.projectionMatrix.elements;
    _q.set((Math.sign(_clip.x) + pm[8]) / pm[0], (Math.sign(_clip.y) + pm[9]) / pm[5], -1, (1 + pm[10]) / pm[14]);
    _clip.multiplyScalar(2 / _clip.dot(_q));
    pm[2] = _clip.x; pm[6] = _clip.y; pm[10] = _clip.z + 1 - 0.003; pm[14] = _clip.w;
    rc.projectionMatrixInverse.copy(rc.projectionMatrix).invert();
    const previo = this.r.getRenderTarget();
    const sombras = this.r.shadowMap.autoUpdate;
    this.r.shadowMap.autoUpdate = false;
    o.visible = false;
    ESPEJOS_ACTIVOS.value = 0;   // los demás espejos, dentro de este, usan la sonda de reflejo
    this.r.setRenderTarget(reg.rt);
    this.r.clear();
    this.r.render(this.scene, rc);
    this.r.setRenderTarget(previo);
    ESPEJOS_ACTIVOS.value = 1;
    o.visible = true;
    this.r.shadowMap.autoUpdate = sombras;
    return true;
  }

  // Solo se redibujan los espejos que se ven, y solo si algo ha cambiado.
  actualizarEspejos(camara, dt, ancho, alto, ocultar, restaurar, hayCambios) {
    if (!this.espejos.size) return;
    camara.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camara.projectionMatrix, camara.matrixWorldInverse));
    camara.getWorldPosition(_c);
    let n = 0, curvoHecho = false;
    for (const [o, reg] of this.espejos) {
      if (!o.parent || !visibleDeVerdad(o)) continue;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      _esfera.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (!_frustum.intersectsSphere(_esfera)) continue;
      const dist = Math.max(0, _esfera.center.distanceTo(_c) - _esfera.radius);
      if (reg.tipo === 'plano') {
        if (dist > 80) continue;
        // Con espejoHz = 0 se redibuja en cada fotograma (el reflejo depende de la vista).
        reg.t = (reg.t || 0) - dt;
        if (this.aj.espejoHz && reg.t > 0) continue;
        if (!hayCambios && !reg.sucio) continue;
        if (this.aj.espejoHz) reg.t = Math.max(0, reg.t + 1 / this.aj.espejoHz);
        ocultar();
        reg.sucio = !this.renderizarEspejoPlano(o, reg, camara, ancho, alto);
        restaurar();
        n++;
      } else {
        if (dist > 35) continue;
        // Como el reflejo general: dos caras por fotograma y el filtrado (PMREM) en el siguiente, y
        // un solo espejo curvo avanza en cada fotograma. Mientras, se usa el reflejo anterior.
        if (reg.cara < 0) {
          reg.t -= dt;
          if (curvoHecho || reg.t > 0 || (!hayCambios && reg.rt && !reg.sucio)) continue;
          reg.t = this.aj.curvoIntervalo || 1;
          reg.sucio = false;
          _caja.setFromObject(o).getCenter(reg.camara.position);
          reg.camara.updateMatrixWorld();
          reg.cara = 0;
        }
        if (curvoHecho) continue;
        curvoHecho = true;
        if (reg.cara >= 6) {
          reg.rt = this.pmremCurvos.fromCubemap(reg.cubo.texture, reg.rt || undefined);
          if (o.material.envMap !== reg.rt.texture) { o.material.envMap = reg.rt.texture; o.material.needsUpdate = true; }
          reg.cara = -1;
          n++;
          continue;
        }
        const sombras = this.r.shadowMap.autoUpdate;
        this.r.shadowMap.autoUpdate = false;
        ocultar();
        ESPEJOS_ACTIVOS.value = 0;
        o.visible = false;
        dibujarCaras(this.r, this.scene, reg.camara, reg.cara, reg.cara + 2);
        reg.cara += 2;
        o.visible = true;
        ESPEJOS_ACTIVOS.value = 1;
        restaurar();
        this.r.shadowMap.autoUpdate = sombras;
        n++;
      }
    }
    this.stats.espejos = n;
  }

  // ---------- Reflejo general de la escena ----------
  asegurarReflejo() {
    const tam = this.aj.reflejoTam || 128;
    if (this.reflejo && this.reflejo.tam === tam) return;
    this.quitarReflejo();
    const cubo = new THREE.WebGLCubeRenderTarget(tam, { type: THREE.HalfFloatType });
    cubo.texture.generateMipmaps = false;   // el filtrado (PMREM) lee solo el nivel 0
    const camara = new THREE.CubeCamera(0.05, 500, cubo);
    camara.children.forEach(c => c.layers.enable(CAPA_CUERPO));
    this.reflejo = { tam, cubo, camara, pmrem: new THREE.PMREMGenerator(this.r), rt: null, entornoPrevio: this.scene.environment, pos: null, t: 0, espera: 0, cara: -1 };
  }

  quitarReflejo() {
    if (!this.reflejo) return;
    if (this.scene.environment === this.reflejo.rt?.texture) this.scene.environment = this.reflejo.entornoPrevio;
    this.reflejo.cubo.dispose();
    this.reflejo.rt?.dispose();
    this.reflejo.pmrem.dispose();
    this.reflejo = null;
  }

  // Se recaptura al moverse la cámara un poco, cuando cambia la luz, o cada pocos segundos.
  // La captura se reparte: dos caras del cubo por fotograma y el filtrado (PMREM) en el siguiente.
  // El reflejo anterior se sigue usando hasta que el nuevo está completo.
  actualizarReflejo(camara, dt, ocultar, restaurar, cambioLuz) {
    this.asegurarReflejo();
    const rf = this.reflejo;
    rf.espera -= dt; rf.t += dt;
    if (rf.cara < 0) {
      camara.getWorldPosition(_c);
      const movida = !rf.pos || rf.pos.distanceTo(_c) > 0.75;
      if (rf.espera > 0 || !(movida || cambioLuz || rf.t > 3)) return;
      rf.espera = this.aj.reflejoIntervalo || 1;
      rf.t = 0;
      rf.pos = (rf.pos || new THREE.Vector3()).copy(_c);
      rf.camara.position.copy(_c);
      rf.camara.updateMatrixWorld();
      rf.cara = 0;
    }
    if (rf.cara >= 6) {
      rf.rt = rf.pmrem.fromCubemap(rf.cubo.texture, rf.rt || undefined);
      this.scene.environment = rf.rt.texture;
      this.scene.environmentIntensity = 1;
      rf.cara = -1;
      return;
    }
    const sombras = this.r.shadowMap.autoUpdate;
    this.r.shadowMap.autoUpdate = false;
    ocultar();
    ESPEJOS_ACTIVOS.value = 0;
    dibujarCaras(this.r, this.scene, rf.camara, rf.cara, rf.cara + 2);
    rf.cara += 2;
    ESPEJOS_ACTIVOS.value = 1;
    restaurar();
    this.r.shadowMap.autoUpdate = sombras;
  }

  // ---------- Posproceso ----------
  asegurarComposer(ancho, alto, camara) {
    const pr = this.pixelRatio();
    const clave = `${ancho}x${alto}@${pr}|${this.nivel}`;
    if (this.composer && this.ultimoTam === clave) return;
    this.quitarComposer();
    const rt = new THREE.WebGLRenderTarget(Math.max(1, ancho * pr), Math.max(1, alto * pr), { type: THREE.HalfFloatType, samples: this.aj.msaa || 0 });
    const c = new EffectComposer(this.r, rt);
    c.setPixelRatio(pr);
    c.setSize(ancho, alto);
    this.pasoRender = new RenderPass(this.scene, camara);
    c.addPass(this.pasoRender);
    if (this.aj.ao) {
      // La oclusión no va en la cadena: se calcula antes de dibujar la escena y los materiales la
      // aplican solo a la luz indirecta (ver AO_PANTALLA en lumbre-parche.js). Así además se ahorran
      // la copia y la mezcla de la imagen entera que hacía GTAOPass.
      const e = this.aj.aoEscala || 1;
      this.pasoAO = new GTAOPass(this.scene, camara, Math.round(ancho * pr * e), Math.round(alto * pr * e));
      this.pasoAO.output = GTAOPass.OUTPUT.Off;
      // Oclusión marcada: oscurece rincones y zonas de contacto (bases de columnas, bloques en el suelo).
      this.pasoAO.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.6, thickness: 2, distanceFallOff: 1, scale: 1.7, samples: this.aj.aoMuestras || 12 });
    }
    this.pasoExposicion = new PasoExposicion(this);
    c.addPass(this.pasoExposicion);
    if (this.aj.bloom) {
      this.pasoBloom = new UnrealBloomPass(new THREE.Vector2(ancho * pr, alto * pr), 0.5, 0.45, 0.88);
      c.addPass(this.pasoBloom);
    }
    c.addPass(new OutputPass());
    this.composer = c;
    this.ultimoTam = clave;
  }

  quitarComposer() {
    if (!this.composer) return;
    this.composer.dispose?.();
    this.pasoAO?.dispose?.();
    this.pasoBloom?.dispose?.();
    this.pasoExposicion?.dispose?.();
    this.pasoAO = this.pasoBloom = this.pasoExposicion = null;
    this.composer = null;
    this.ultimoTam = '';
  }

  // Exposición automática: se mide el brillo medio de la imagen (con más peso en el centro)
  // y la exposición se adapta poco a poco, más despacio hacia la oscuridad, como el ojo.
  actualizarExposicion(dt) {
    const base = this.ent.exposicion ?? 1;
    if (!this.usaExposicionAuto || !this.composer || !this.exposicion.medida) {
      this.exposicion.valor += (1 - this.exposicion.valor) * (1 - Math.exp(-dt * 3));
    } else {
      const objetivo = Math.min(2, Math.max(0.5, (0.2 / this.exposicion.medida) ** 0.55));
      const vel = objetivo > this.exposicion.valor ? 1.1 : 2.2;
      this.exposicion.valor += (objetivo - this.exposicion.valor) * (1 - Math.exp(-dt * vel));
    }
    this.r.toneMappingExposure = base * this.exposicion.valor;
  }

  // ---------- Cada fotograma ----------
  /** Actualiza sondas, sombras, reflejos y espejos. Llamar antes de renderizar. */
  actualizar(camara, dt = 1 / 60, ancho = 1280, alto = 720) {
    this.cuadro++;
    this.stats.sondas = 0;
    this.regularGI(dt);
    this.reloj.revisar();
    // Cada medio segundo se revisan luces, mallas y espejos (por si un script añade o quita alguno).
    if (this.cuadro % 30 === 0) { this.recogerEscena(); this.ajustarSombras(); this.asegurarEspejos(); }
    this.scene.updateMatrixWorld();
    this.seguirSombras(camara);
    const mov = this.detectarMovimiento();
    if (this.usaGI && this.rejillas.length) for (let i = 0; i < mov.estaticos.length; i++) this.ensuciarCaja(mov.estaticos[i], 0.5);
    const cambioLuz = this.usaGI && this.rejillas.length ? this.detectarCambiosLuz() : false;
    if (camara) camara.updateMatrixWorld();
    this.actualizarSombras(mov, camara, dt);
    let camaraMovida = false;
    if (camara) {
      const a = camara.matrixWorld.elements, b = this.camPrev.elements;
      for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-5) { camaraMovida = true; break; }
      this.camPrev.copy(camara.matrixWorld);
    }
    const hayCambios = this._forzar || camaraMovida || cambioLuz || mov.dinamicos > 0 || mov.estaticos.length > 0 || this.cuadro % 60 === 0;

    const ocultos = this.ocultables();
    const visibles = ocultos.map(o => o.visible);
    const dinVisibles = this.dinamicos.map(o => o.visible);
    // Luz del cielo (como el SkyLight de Unreal): en las capturas de sondas el cielo emite la luz
    // ambiental del Entorno, así llega tapada por muros y techos y rebotada en las superficies.
    const hemi = this.e.hemi;
    const ambiente = (this.ent.ambiente ?? 0.35) * 2.2;
    if (this.usaGI) {
      // Mientras se calculan las sondas por primera vez, la luz ambiental plana va dejando paso
      // a los rebotes poco a poco: así la escena no se ve negra al empezar.
      const comps = this.componentes();
      const hechas = comps.reduce((s, x) => s + (x.ciclos >= 1 ? x.region.total : x.indice), 0);
      const progreso = this.estado === 'lista' || !this.total ? 1 : hechas / (this.total * 2);
      const f = FACTOR_AMBIENTE + (1 - FACTOR_AMBIENTE) * (1 - progreso) ** 2;
      this.e.factorAmbiente = f;
      hemi.intensity = ambiente * f;
    }
    const hemiFinal = hemi.intensity;
    const fondo = this.scene.background;
    const ocultar = (sondas) => {
      ocultos.forEach(o => { o.visible = false; });
      if (sondas) {
        // Los personajes no entran en la iluminación global: se mueven demasiado y apenas aportan.
        this.dinamicos.forEach(o => { o.visible = false; });
        this.proxy.mostrar();
        if (this.usaGI) {
          hemi.intensity = 0;
          this._cielo ||= new THREE.Color();
          this._cielo.copy(hemi.color).multiplyScalar(ambiente * (this.ent.luz_cielo ?? 1));
          this.scene.background = this._cielo;
        }
      }
    };
    const restaurar = () => {
      this.proxy.ocultar();
      ocultos.forEach((o, i) => { o.visible = visibles[i]; });
      this.dinamicos.forEach((o, i) => { o.visible = dinVisibles[i]; });
      hemi.intensity = hemiFinal;
      this.scene.background = fondo;
    };

    // Las sombras que toca redibujar se dejan para el dibujado normal: si se redibujaran durante
    // una captura, faltarían los personajes (ocultos en las sondas) y la sombra del jugador
    // desaparecería. Las capturas usan las sombras del fotograma anterior.
    const aplazadas = [];
    for (const l of this.luces.keys()) if (l.shadow && l.shadow.needsUpdate) { l.shadow.needsUpdate = false; aplazadas.push(l); }
    try {
      if (this.usaGI) this.actualizarGI(camara || this.scene, ocultar, restaurar, dt);
      if (this.usaReflejos && camara && this._dibujada) this.actualizarReflejo(camara, dt, ocultar, restaurar, cambioLuz || this._forzar);
      if (camara && this._dibujada) this.actualizarEspejos(camara, dt, ancho, alto, () => ocultar(false), restaurar, hayCambios);
    } finally {
      for (const l of aplazadas) l.shadow.needsUpdate = true;
    }
    this.actualizarExposicion(dt);
    this._forzar = false;
  }

  /** Dibuja la escena con los efectos activos. */
  renderizar(camara, ancho, alto) {
    this._dibujada = true;
    if (!this.usaComposer) { this.r.render(this.scene, camara); return; }
    this.asegurarComposer(ancho, alto, camara);
    this.pasoRender.camera = camara;
    const ao = this.pasoAO && this.ent.oclusion !== false;
    if (ao) {
      this.pasoAO.camera = camara;
      this.pasoAO.render(this.r, null, null);
      const rt = this.composer.renderTarget1;
      AO_PANTALLA.textura.value = this.pasoAO.pdRenderTarget.texture;
      AO_PANTALLA.inv.value.set(1 / rt.width, 1 / rt.height);
      AO_PANTALLA.intensidad.value = this.ent.intensidad_oclusion ?? 1;
    }
    if (this.pasoBloom) {
      this.pasoBloom.enabled = this.ent.resplandor !== false;
      this.pasoBloom.strength = this.ent.intensidad_resplandor ?? 0.5;
    }
    this.pasoExposicion.enabled = this.usaExposicionAuto;
    try { this.composer.render(); }
    finally { AO_PANTALLA.intensidad.value = 0; }
  }

  descripcion() {
    const espejos = this.espejos.size ? ` · ${this.espejos.size} espejo${this.espejos.size > 1 ? 's' : ''}` : '';
    if (!this.activada) return 'Lumbre desactivada · iluminación clásica';
    if (!this.giDisponible && this.ent.iluminacion_global) return 'Esta gráfica no admite iluminación global';
    if (!this.usaGI) return (this.ent.iluminacion_global ? `Iluminación global apagada en calidad ${this.aj.nombre}` : 'Iluminación clásica') + espejos;
    const vols = this.rejillas.length - 1;
    const pendientes = this.componentes().reduce((s, c) => s + (c.ciclos >= 1 ? c.nSucias : 0), 0);
    const estado = this.estado !== 'lista' ? 'calculando…' : pendientes > 0 ? `actualizando ${pendientes}` : 'lista';
    return `Lumbre · ${this.total} sondas${vols > 0 ? ` (${vols} volumen${vols > 1 ? 'es' : ''})` : ''}${espejos} · ${estado}`;
  }

  destruir() {
    this.quitarRejillas();
    this.quitarReflejo();
    this.quitarComposer();
    for (const [o, reg] of [...this.espejos]) this.quitarEspejo(o, reg);
    this.pmremCurvos?.dispose();
    for (const q of [this._quadCopia, this._quadComponer]) if (q) { q.material.dispose(); q.dispose(); }
    this._quadCopia = this._quadComponer = null;
    this.proxy.quitar();
    this.modoSimple();
    this.e.factorAmbiente = 1;
  }
}

// Guarda en `f` la transformación de una malla (las 12 cifras de la matriz afín) y si se ve;
// devuelve true si ha cambiado. Antes solo se miraban 6 cifras y no se notaba, por ejemplo,
// escalar en Z o algunas rotaciones.
const CIFRAS = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14];
function firmaMalla(o, f) {
  const e = o.matrixWorld.elements;
  const vis = visibleDeVerdad(o) ? 1 : 0;
  let igual = f[12] === vis;
  for (let i = 0; igual && i < 12; i++) igual = f[i] === e[CIFRAS[i]];
  if (igual) return false;
  let habia = f[12] !== 0;
  for (let i = 0; !habia && i < 12; i++) habia = f[i] !== 0;
  for (let i = 0; i < 12; i++) f[i] = e[CIFRAS[i]];
  f[12] = vis;
  return habia;
}

// Mallas de dos caras: en el mapa de sombras se dibujan por delante (no hay cara trasera), así que
// sin sesgo de profundidad se sombrearían a sí mismas («acné»: rayas y puntos). Se les da un sesgo
// por pendiente del propio hardware (polygonOffset) solo al dibujar el mapa: casi cero donde la
// superficie mira a la luz (la sombra no se despega) y mayor en ángulos rasantes, que es donde
// aparece el acné. three.js copia en cada dibujo lado, textura y recorte alfa del material original.
const sombrasDosCaras = new WeakMap();   // material → [profundidad, distancia]
function sombraDosCaras(o) {
  const m = o.material;
  const dos = o.castShadow && m && !Array.isArray(m) && m.side === THREE.DoubleSide && m.shadowSide == null;
  if (!dos) {
    if (o.userData.sombraDosCaras) { o.customDepthMaterial = o.customDistanceMaterial = undefined; o.userData.sombraDosCaras = false; }
    return;
  }
  let par = sombrasDosCaras.get(m);
  if (!par) {
    const op = { polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 };
    par = [new THREE.MeshDepthMaterial(op), new THREE.MeshDistanceMaterial(op)];
    sombrasDosCaras.set(m, par);
  }
  o.customDepthMaterial = par[0];
  o.customDistanceMaterial = par[1];
  o.userData.sombraDosCaras = true;
}

// Dibuja las caras [desde, hasta) de una CubeCamera (como CubeCamera.update, pero por partes).
function dibujarCaras(r, scene, cubo, desde, hasta) {
  if (cubo.coordinateSystem !== r.coordinateSystem) { cubo.coordinateSystem = r.coordinateSystem; cubo.updateCoordinateSystem(); }
  const rt = cubo.renderTarget;
  const previo = r.getRenderTarget(), cara = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel();
  for (let i = desde; i < Math.min(6, hasta); i++) {
    r.setRenderTarget(rt, i, cubo.activeMipmapLevel);
    r.render(scene, cubo.children[i]);
  }
  r.setRenderTarget(previo, cara, mip);
}

function visibleDeVerdad(o) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

// Mide cuánto tarda la GPU en un trabajo (EXT_disjoint_timer_query_webgl2). El resultado llega unos
// fotogramas después y se entrega a la función indicada; no detiene nada. Si la gráfica no tiene la
// extensión (o la usa otra medición: `window.__falconPerfilGPU`), no mide y Lumbre se guía solo por
// el tiempo de procesador.
class RelojGPU {
  constructor(renderer) {
    this.gl = renderer.getContext();
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pendientes = [];
    this.activa = null;
  }

  empezar() {
    if (!this.ext || this.activa || this.pendientes.length > 8 || globalThis.__falconPerfilGPU) return false;
    this.revisar();
    this.activa = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.activa);
    return true;
  }

  terminar(alAcabar) {
    if (!this.activa) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pendientes.push([this.activa, alAcabar]);
    this.activa = null;
  }

  revisar() {
    const gl = this.gl;
    while (this.pendientes.length && gl.getQueryParameter(this.pendientes[0][0], gl.QUERY_RESULT_AVAILABLE)) {
      const [q, alAcabar] = this.pendientes.shift();
      // Si la GPU se ha interrumpido (cambio de energía, otra aplicación…), la medida no vale.
      if (!gl.getParameter(this.ext.GPU_DISJOINT_EXT)) alAcabar(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
  }
}

// Mide el brillo de la imagen: la media geométrica de la luminancia (media de log2), que es la que
// usa la exposición de las cámaras y no se deja arrastrar por un punto muy brillante. Se calcula
// sobre TODOS los píxeles en dos pasadas exactas (texelFetch, sin muestreo):
//  1) cada celda de 160×90 guarda la media de log2 de su bloque de píxeles y cuántos son;
//  2) cada celda de 32×18 junta 5×5 de esas, pesando por el número de píxeles.
// Después se lee sin parar la GPU y se da más peso al centro de la pantalla.
const EXP_A = [160, 90], EXP_B = [32, 18];
class PasoExposicion extends Pass {
  constructor(lumbre) {
    super();
    this.lumbre = lumbre;
    this.needsSwap = false;
    const op = { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtA = new THREE.WebGLRenderTarget(EXP_A[0], EXP_A[1], op);
    this.rtB = new THREE.WebGLRenderTarget(EXP_B[0], EXP_B[1], op);
    this.datos = new Float32Array(EXP_B[0] * EXP_B[1] * 4);
    this.ultima = 0;
    const vs = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.quadA = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tam: { value: new THREE.Vector2() } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 tam;
        void main() {
          ivec2 c = ivec2(gl_FragCoord.xy);
          ivec2 a = ivec2(floor(vec2(c) * tam / vec2(${EXP_A[0]}.0, ${EXP_A[1]}.0)));
          ivec2 b = max(a + 1, ivec2(floor(vec2(c + 1) * tam / vec2(${EXP_A[0]}.0, ${EXP_A[1]}.0))));
          float s = 0.0;
          for (int y = a.y; y < b.y; y++) for (int x = a.x; x < b.x; x++) {
            vec3 col = texelFetch(tDiffuse, ivec2(x, y), 0).rgb;
            s += log2(max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
          }
          float n = float((b.x - a.x) * (b.y - a.y));
          gl_FragColor = vec4(s / n, n, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    }));
    this.quadB = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tA: { value: this.rtA.texture } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D tA;
        void main() {
          ivec2 c = ivec2(gl_FragCoord.xy) * 5;
          float s = 0.0, n = 0.0;
          for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) {
            vec2 v = texelFetch(tA, c + ivec2(x, y), 0).rg;
            s += v.r * v.g; n += v.g;
          }
          gl_FragColor = vec4(s / n, n, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    }));
  }

  render(renderer, writeBuffer, readBuffer) {
    // 10 medidas por segundo bastan: la exposición se adapta en segundos.
    const ahora = performance.now();
    if (this.leyendo || ahora - this.ultima < 100) return;
    this.ultima = ahora;
    const ua = this.quadA.material.uniforms;
    ua.tDiffuse.value = readBuffer.texture;
    ua.tam.value.set(readBuffer.width, readBuffer.height);
    const previo = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rtA);
    this.quadA.render(renderer);
    renderer.setRenderTarget(this.rtB);
    this.quadB.render(renderer);
    renderer.setRenderTarget(previo);
    this.leyendo = true;
    const [w, h] = EXP_B;
    renderer.readRenderTargetPixelsAsync(this.rtB, 0, 0, w, h, this.datos).then(() => {
      let suma = 0, pesos = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = (x + 0.5) / w - 0.5, dy = (y + 0.5) / h - 0.5;
        const p = (1 - Math.min(0.75, Math.hypot(dx, dy) * 1.2)) * this.datos[i + 1];   // centro × píxeles
        suma += this.datos[i] * p; pesos += p;
      }
      if (pesos > 0) this.lumbre.exposicion.medida = 2 ** (suma / pesos);
    }).catch(() => {}).finally(() => { this.leyendo = false; });
  }

  dispose() {
    this.rtA.dispose(); this.rtB.dispose();
    for (const q of [this.quadA, this.quadB]) { q.dispose(); q.material.dispose(); }
  }
}
