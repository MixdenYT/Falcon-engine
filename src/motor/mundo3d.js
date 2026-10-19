// Parte 3D del mundo en ejecución: three.js, física sencilla con cajas y personajes.
import { Escena3D, THREE, aplicarTransformacion, aplicarReflejos } from './escena3d.js';
import { RECORTABLES, restarCajas, solapan } from './huecos.js';
import { Lumbre } from './lumbre.js';
import { Controles3D } from './control3d.js';
import { resolverCalidad, AjusteAutomatico, CALIDADES } from './graficos.js';

const RAD = Math.PI / 180;

export class Mundo3D {
  constructor(mundo) {
    this.m = mundo;
    this.lienzo = mundo.op.lienzo3d;
    this.escena = new Escena3D(mundo.proyecto, { editor: false });
    this.renderer = null;
    this.camaraPorDefecto = new THREE.PerspectiveCamera(65, 16 / 9, 0.05, 1000);
    this.camaraPorDefecto.position.set(0, 6, 10);
    this.camaraPorDefecto.lookAt(0, 0, 0);
    this.orbita = { yaw: 0, pitch: 0 };
    this.solidos = [];
    this.raycaster = new THREE.Raycaster();
    this.controles = new Controles3D(this);
  }

  async construir() {
    this.lienzo.classList.remove('oculto');
    this.renderer = this.m._renderer3d || new THREE.WebGLRenderer({ canvas: this.lienzo, antialias: true, preserveDrawingBuffer: true });
    this.m._renderer3d = this.renderer;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    await this.escena.construir(this.m.raiz);
    aplicarReflejos(this.renderer, this.escena.scene, 0.35);
    // Lumbre: iluminación global y posproceso según la calidad gráfica.
    if (this.lumbre) this.lumbre.destruir();
    this.lumbre = new Lumbre(this.renderer, this.escena, {});
    this.escena.alCambiarEntorno = (p) => this.lumbre.configurar(this.lumbre.nivel, p);
    this.escena.alCambiarGeometria = (o) => this.lumbre && this.lumbre.geometriaCambiada(o);
    this.ajuste = new AjusteAutomatico((nivel, fps) => {
      this.lumbre.configurar(nivel);
      this.m.calidadNivel = nivel;
      this.m.informar({ tipo: 'mostrar', texto: `Calidad gráfica bajada a ${CALIDADES[nivel].nombre} (${Math.round(fps)} FPS)` });
      this.m.op.alCalidad && this.m.op.alCalidad(nivel);
    });
    this.aplicarCalidad();
    if (!this.m.ctx) this.m.ctx = this.m.lienzo.getContext('2d');
    this.prepararRaton();
    if (!this.controles.lienzo) this.controles.conectar(this.m.lienzo);
  }

  prepararRaton() {
    const act = this.escena.camaraActiva();
    this.usaRaton = !!(act && act.nodo.props.raton);
    if (!this.usaRaton || this._raton) return;
    const lienzo = this.m.lienzo;
    this._raton = (e) => { if (document.pointerLockElement === lienzo) { this.orbita.yaw -= e.movementX * 0.25; this.orbita.pitch = Math.max(-40, Math.min(40, this.orbita.pitch - e.movementY * 0.2)); } };
    this._clic = () => { if (this.usaRaton && document.pointerLockElement !== lienzo) lienzo.requestPointerLock?.(); };
    window.addEventListener('mousemove', this._raton);
    lienzo.addEventListener('click', this._clic);
  }

  aplicarCalidad() {
    const opcion = this.m.calidadOpcion || 'automatica';
    const nivel = resolverCalidad(opcion, this.renderer);
    this.m.calidadNivel = nivel;
    this.ajuste.activo = opcion === 'automatica';
    this.ajuste.reiniciar();
    this.lumbre.activada = this.m.lumbreActivada;
    this.lumbre.configurar(nivel);
    this.m.op.alCalidad && this.m.op.alCalidad(nivel);
  }

  destruir() {
    if (this.lumbre) { this.lumbre.destruir(); this.lumbre = null; }
    this.escena.limpiar();
    if (this._raton) { window.removeEventListener('mousemove', this._raton); this.m.lienzo.removeEventListener('click', this._clic); }
    this.controles.desconectar();
    if (document.pointerLockElement) document.exitPointerLock();
    this.lienzo.classList.add('oculto');
  }

  obj(n) { return this.escena.objetos.get(n.id); }

  posicionGlobal(n) {
    const o = this.obj(n);
    if (!o) return (n.props.posicion || [0, 0, 0]).slice();
    aplicarTransformacion(o, n.props);
    o.updateWorldMatrix(true, false);
    const v = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    return [v.x, v.y, v.z];
  }

  fijarPosicionGlobal(n, x, y, z) {
    const o = this.obj(n);
    const v = new THREE.Vector3(x, y, z);
    if (o && o.parent) { o.parent.updateWorldMatrix(true, false); o.parent.worldToLocal(v); }
    n.props.posicion = [v.x, v.y, v.z];
  }

  anadir(n) {
    setTimeout(() => this.lumbre && this.lumbre.marcarCambio(), 50);
    this.escena.anadir(n, n.padre);
  }
  quitar(n) { this.escena.quitar(n); if (this.lumbre) this.lumbre.marcarCambio(); }
  actualizarNodo(n, clave) { this.escena.actualizarNodo(n, clave); }

  // ---------- Movimiento ----------
  ejesCamara() {
    const cam = this.camaraUsada || this.camaraPorDefecto;
    const f = new THREE.Vector3();
    cam.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    return { f, r };
  }

  moverPersonaje(n, x, z) {
    const { f, r } = this.ejesCamara();
    n.mueveX = r.x * x - f.x * z;
    n.mueveZ = r.z * x - f.z * z;
  }

  // Controles integrados de tercera y primera persona (ver control3d.js).
  controlPersonaje(n) { this.controles.moverJugador(n, this.m.dtPaso || 1 / 60); }

  // ---------- Física ----------
  cajaMundo(n) {
    const o = this.obj(n);
    if (!o) return null;
    const b = new THREE.Box3().setFromObject(o.userData.malla || o);
    if (b.isEmpty()) return null;
    if (b.max.y - b.min.y < 0.2) b.min.y = b.max.y - 0.2;
    return b;
  }

  cajaPersonaje(n, pos) {
    const r = 0.38, h = n.props.altura || 1.8;
    return new THREE.Box3(new THREE.Vector3(pos[0] - r, pos[1], pos[2] - r), new THREE.Vector3(pos[0] + r, pos[1] + h, pos[2] + r));
  }

  fisica(dt) {
    const nodos = this.m.todos();
    // Sincroniza transformaciones (los scripts pueden haber cambiado posiciones).
    for (const n of nodos) {
      const o = this.obj(n);
      if (!o) continue;
      if (n.tipo !== 'Interfaz') aplicarTransformacion(o, n.props);
      o.visible = n.visible !== false;
    }
    this.escena.scene.updateMatrixWorld(true);
    const solidos = [];
    // Los huecos no chocan: parten la caja de los sólidos que tocan para poder pasar por ellos.
    const huecos = [];
    for (const n of nodos) if (n.tipo === 'Malla3D' && n.props.modo === 'hueco' && n.visible !== false) { const b = this.cajaMundo(n); if (b) huecos.push(b); }
    for (const n of nodos) {
      if (n.tipo !== 'Malla3D' || n.props.modo === 'hueco' || n.props.colision === 'ninguna' || n.props.colision === 'area' || n.visible === false) continue;
      const b = this.cajaMundo(n);
      if (!b) continue;
      const movil = !!n.props.empujable;
      const corta = !movil && huecos.length && RECORTABLES.includes(n.props.malla || 'cubo') ? huecos.filter(h => solapan(b, h)) : [];
      if (corta.length) for (const t of restarCajas(b, corta)) solidos.push({ n, b: t, movil });
      else solidos.push({ n, b, movil });
    }
    this.solidos = solidos;
    const gGlobal = this.m.interp.globales.vars.get('gravedad');
    const escalaG = (this.m.proyecto.datos.gravedad || 18) ? gGlobal / (this.m.proyecto.datos.gravedad || 18) : 1;

    // Cuerpos empujables: caen con gravedad.
    for (const s of solidos) {
      if (!s.movil) continue;
      const n = s.n;
      // Con aceleración constante, el desplazamiento exacto usa la velocidad media del intervalo:
      // así la caída es la misma a 60 que a 165 FPS.
      const vyAnt = n.vy || 0;
      n.vy = vyAnt - 18 * escalaG * dt;
      const dy = (vyAnt + n.vy) * 0.5 * dt;
      const b2 = s.b.clone().translate(new THREE.Vector3(0, dy, 0));
      let apoyo = false;
      for (const o of solidos) {
        if (o === s || !o.b.intersectsBox(b2)) continue;
        if (dy < 0 && s.b.min.y >= o.b.max.y - 0.05) { apoyo = true; const corr = o.b.max.y - s.b.min.y; n.props.posicion[1] += corr; s.b.translate(new THREE.Vector3(0, corr, 0)); n.vy = 0; break; }
      }
      if (!apoyo) { n.props.posicion[1] += dy; s.b.copy(b2); }
    }

    for (const n of nodos) {
      if (n.tipo !== 'Personaje3D') continue;
      const pos = this.posicionGlobal(n);
      const ini = pos.slice();
      n.empX *= Math.pow(0.05, dt); n.empZ *= Math.pow(0.05, dt);
      const vx = n.mueveX + n.empX, vz = n.mueveZ + n.empZ;
      n.enPared = false;
      n._contactosSolidos = new Set();
      const moverEje = (i, d) => {
        if (!d) return;
        pos[i] += d;
        let caja = this.cajaPersonaje(n, pos);
        caja.min.y += 0.05;
        for (const s of solidos) {
          if (!s.b.intersectsBox(caja)) continue;
          // Escalones bajos: se suben solos.
          if (s.b.max.y - pos[1] < 0.35 && !s.movil) { pos[1] = s.b.max.y; caja = this.cajaPersonaje(n, pos); continue; }
          if (s.movil) {
            const desp = new THREE.Vector3(); desp.setComponent(i === 0 ? 0 : 2, d);
            const b2 = s.b.clone().translate(desp);
            const libre = !solidos.some(o => o !== s && o.b.intersectsBox(b2) && b2.min.y < o.b.max.y - 0.05);
            if (libre) { s.n.props.posicion[i] += d; s.b.copy(b2); n._contactosSolidos.add(s.n); continue; }
          }
          const mitad = 0.38;
          if (d > 0) pos[i] = Math.min(pos[i], (i === 0 ? s.b.min.x : s.b.min.z) - mitad - 0.001);
          else pos[i] = Math.max(pos[i], (i === 0 ? s.b.max.x : s.b.max.z) + mitad + 0.001);
          n.enPared = true;
          n._contactosSolidos.add(s.n);
          caja = this.cajaPersonaje(n, pos);
        }
      };
      moverEje(0, vx * dt);
      moverEje(2, vz * dt);
      // Velocidad media del intervalo (exacto con gravedad constante): el salto llega a la misma
      // altura a cualquier frecuencia de fotogramas.
      const vyAnt = n.vy || 0;
      if (n.props.usa_gravedad) n.vy = vyAnt - (n.props.gravedad ?? 18) * escalaG * dt;
      n.vy = Math.max(n.vy, -60);
      const dy = (vyAnt + n.vy) * 0.5 * dt;
      pos[1] += dy;
      n.enSuelo = false;
      const caja = this.cajaPersonaje(n, pos);
      for (const s of solidos) {
        if (!s.b.intersectsBox(caja)) continue;
        if (dy <= 0 && ini[1] >= s.b.max.y - 0.36) { pos[1] = s.b.max.y; n.vy = 0; n.enSuelo = true; }
        else if (dy > 0 && ini[1] + (n.props.altura || 1.8) <= s.b.min.y + 0.05) { pos[1] = s.b.min.y - (n.props.altura || 1.8); n.vy = 0; n.enTecho = true; }
        n._contactosSolidos.add(s.n);
      }
      if (!n.props.usa_gravedad) n.enSuelo = true;
      this.fijarPosicionGlobal(n, ...pos);
      // Gira el cuerpo hacia donde anda.
      const o = this.obj(n);
      const vis = o && o.userData.visual;
      if (vis && n._mirarYaw !== undefined) vis.rotation.y = n._mirarYaw;
      else if (vis && Math.hypot(vx, vz) > 0.1) {
        const objetivo = Math.atan2(-vx, -vz);
        let d = objetivo - vis.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        vis.rotation.y += d * (1 - Math.exp(-dt * 12));
      }
      n.mueveX = 0; n.mueveZ = 0;
    }
  }

  contactos() {
    const m = this.m;
    const nodos = m.todos();
    const part = [];
    for (const n of nodos) {
      if (n.tipo === 'Personaje3D') { const b = this.cajaPersonaje(n, this.posicionGlobal(n)); b.expandByScalar(0.06); part.push({ n, b }); }
      else if (n.tipo === 'Malla3D' && (n.scripts.length || n.props.colision === 'area')) { const b = this.cajaMundo(n); if (b) part.push({ n, b }); }
    }
    const actuales = new Map();
    const clave = (a, b) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    for (let i = 0; i < part.length; i++) for (let j = i + 1; j < part.length; j++) {
      const a = part[i], b = part[j];
      if (a.n.tipo !== 'Personaje3D' && b.n.tipo !== 'Personaje3D') continue;
      if (a.b.intersectsBox(b.b)) actuales.set(clave(a.n, b.n), [a.n, b.n]);
    }
    for (const [k, [a, b]] of actuales) if (!m.pares.has(k)) { m.emitirNodo(a, 'toca', [b]); m.emitirNodo(b, 'toca', [a]); }
    for (const [k, [a, b]] of m.pares) if (!actuales.has(k)) { if (!a.eliminado) m.emitirNodo(a, 'deja_de_tocar', [b]); if (!b.eliminado) m.emitirNodo(b, 'deja_de_tocar', [a]); }
    m.pares = actuales;
  }

  // ---------- Clics y ratón ----------
  rayo(sx, sy) {
    const [W, H] = this.m.resolucion;
    const cam = this.camaraUsada || this.camaraPorDefecto;
    this.raycaster.setFromCamera(new THREE.Vector2(sx / W * 2 - 1, -(sy / H * 2 - 1)), cam);
    return this.raycaster;
  }

  ratonMundo(sx, sy) {
    const r = this.rayo(sx, sy);
    const p = new THREE.Vector3();
    r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return [p.x, p.y, p.z];
  }

  clic() {
    const [sx, sy] = this.m.ratonPantalla();
    const r = this.rayo(sx, sy);
    const hits = r.intersectObjects(this.escena.scene.children, true);
    for (const h of hits) {
      for (let o = h.object; o; o = o.parent) {
        const id = o.userData.nodoId;
        if (id === undefined) continue;
        const n = this.escena.nodos.get(id);
        if (n && n.scripts.some(s => s.tieneEvento('hace_clic'))) { this.m.emitirNodo(n, 'hace_clic', []); return; }
      }
    }
  }

  // ---------- Dibujo ----------
  dibujar() {
    const m = this.m;
    // Luces y colores que los scripts pueden cambiar.
    for (const [id, o] of this.escena.objetos) {
      const n = this.escena.nodos.get(id);
      if (!n) continue;
      if (n.tipo === 'Luz3D' && o.userData.luz) {
        const l = o.userData.luz, p = n.props;
        l.intensity = p.tipo_luz === 'puntual' ? p.intensidad * 2 : p.tipo_luz === 'foco' ? p.intensidad * 3 : p.intensidad;
        if (n._colorPrev !== p.color) { l.color.set(p.color); n._colorPrev = p.color; }
      } else if (n.tipo === 'Malla3D' && n._colorPrev !== n.props.color) {
        const malla = o.userData.malla;
        if (n._colorPrev !== undefined && malla && malla.isMesh && !malla.userData.hueco && !n.props.material) malla.material.color.set(n.props.color);
        n._colorPrev = n.props.color;
      }
      if (n.tipo === 'Entorno') {
        // Los scripts pueden cambiar el cielo, la luz ambiental o los ajustes de Lumbre.
        const p = n.props;
        const firma = [p.cielo, p.horizonte, p.ambiente, p.niebla, p.densidad, p.intensidad_gi, p.luz_cielo, p.exposicion, p.intensidad_oclusion, p.intensidad_resplandor].join('|');
        const firmaFuerte = [p.iluminacion_global, p.gi_dinamica, p.reflejos_escena, p.oclusion, p.resplandor, p.exposicion_automatica].join('|');
        if (n._firmaFuerte !== undefined && n._firmaFuerte !== firmaFuerte) this.lumbre.configurar(this.lumbre.nivel, p);
        else if (n._firmaEnt !== undefined && n._firmaEnt !== firma) this.lumbre.actualizarEntorno(p);
        n._firmaEnt = firma; n._firmaFuerte = firmaFuerte;
        continue;
      }
      if (n.tipo !== 'Interfaz' && n.tipo !== 'Personaje3D' && n.tipo !== 'Camara3D') aplicarTransformacion(o, n.props);
    }
    // Si un script mueve un hueco o un muro, el recorte se rehace.
    this.escena.revisarHuecos();
    const ancho = this.lienzo.clientWidth, alto = this.lienzo.clientHeight;
    const ahora = performance.now();
    const dtR = this._ultimo ? Math.min(0.1, (ahora - this._ultimo) / 1000) : 1 / 60;
    this._ultimo = ahora;
    this.renderer.setPixelRatio(this.lumbre ? this.lumbre.pixelRatio() : (window.devicePixelRatio || 1));
    this.renderer.setSize(ancho, alto, false);
    const act = this.escena.camaraActiva();
    let cam = this.camaraPorDefecto;
    // Un personaje con controles de tercera o primera persona lleva la cámara si esta va dentro
    // de él (o si la escena no tiene cámara).
    const jugador = this.controles.buscarJugador(m.todos());
    const jo = jugador && this.obj(jugador);
    let dentro = false;
    if (act && jo) for (let o = act.camara; o; o = o.parent) if (o === jo) { dentro = true; break; }
    this.controles.activo = !!jugador && (!act || dentro) && !m.camaraLibre;
    if (this.controles.activo) cam = this.controles.actualizarCamara(jugador, act ? act.nodo : null, dtR);
    else if (act) {
      this.controles.mostrarCuerpo();
      cam = act.camara;
      aplicarTransformacion(cam, act.nodo.props);
      if (this.usaRaton || this.orbita.yaw) {
        const p = act.nodo.props.posicion;
        const y = this.orbita.yaw * RAD;
        cam.position.set(p[0] * Math.cos(y) + p[2] * Math.sin(y), p[1], -p[0] * Math.sin(y) + p[2] * Math.cos(y));
        cam.rotation.set((act.nodo.props.rotacion[0] + this.orbita.pitch) * RAD, act.nodo.props.rotacion[1] * RAD + y, 0, 'YXZ');
      }
    }
    if (m.camaraLibre && m.camaraLibre.camara3d) cam = m.camaraLibre.camara3d;
    cam.aspect = ancho / Math.max(1, alto);
    cam.updateProjectionMatrix();
    this.camaraUsada = cam;
    // Temblor de cámara
    const t = m.camara.tiempoTemblor > 0 ? m.camara.temblor * 0.004 * (m.camara.tiempoTemblor / m.camara.duracionTemblor) : 0;
    if (m.camara.tiempoTemblor > 0 && !m.pausado) m.camara.tiempoTemblor -= dtR * (m.velocidad || 1);
    const prev = cam.position.clone();
    if (t) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * t * 60, (Math.random() - 0.5) * t * 60, 0));
    if (this.lumbre) {
      this.lumbre.actualizar(cam, dtR, ancho, alto);
      this.lumbre.renderizar(cam, ancho, alto);
      // Mientras Lumbre calcula las sondas por primera vez el juego va más lento: no se mide.
      if (!m.pausado && this.lumbre.estado !== 'calculando') this.ajuste.medir(dtR, this.lumbre.nivel);
    } else this.renderer.render(this.escena.scene, cam);
    cam.position.copy(prev);
    // Interfaz encima, en el lienzo 2D transparente.
    const c = m.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, m.lienzo.width, m.lienzo.height);
    const v = m.vista;
    c.save();
    c.translate(v.ox, v.oy);
    m.render.dibujarInterfaz(proxyDesplazado(c, v.ox, v.oy), m.raiz, { ancho: v.ancho, alto: v.alto, escala: v.escala }, {});
    c.restore();
    this.controles.dibujarAyudas(c, m.lienzo.width, m.lienzo.height, v.escala || 1);
  }
}

function proxyDesplazado(c, ox, oy) {
  return new Proxy(c, {
    get(t, k) {
      if (k === 'setTransform') return (a, b, cc, d, e, f) => t.setTransform(a, b, cc, d, e + ox, f + oy);
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
