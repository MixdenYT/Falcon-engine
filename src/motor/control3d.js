// Controles listos para usar de Personaje3D: tercera persona y primera persona.
//
// · Movimiento con inercia (acelera y frena), menos control en el aire, salto con «tiempo de
//   coyote» (se puede saltar un instante después de salir de un borde), salto recordado (si se
//   pulsa justo antes de tocar el suelo) y altura variable (soltar pronto = salto corto).
// · Tercera persona: cámara que orbita con el ratón (al hacer clic se captura el puntero), el
//   stick derecho del mando o la rueda para acercar; sigue al personaje con suavidad, no atraviesa
//   paredes y, si solo se usa el teclado, se coloca poco a poco detrás del personaje.
// · Primera persona: vista desde los ojos, balanceo al andar, golpe al aterrizar y un poco más de
//   campo de visión al correr. El cuerpo no se ve, pero sigue proyectando sombra y sale en espejos.

import { THREE } from './escena3d.js';
import { CAPA_CUERPO } from './lumbre.js';

const RAD = Math.PI / 180;
const _a = new THREE.Vector3(), _dir = new THREE.Vector3(), _hit = new THREE.Vector3(), _caja = new THREE.Box3();
const _rayo = new THREE.Ray();

const esJugador = (n) => n.tipo === 'Personaje3D' && (n.props.controles === 'tercera_persona' || n.props.controles === 'primera_persona');

export class Controles3D {
  constructor(d3) {
    this.d3 = d3;
    this.camara = new THREE.PerspectiveCamera(65, 16 / 9, 0.05, 1000);
    this.camara.layers.set(0);
    this.yaw = 0; this.pitch = 0;
    this.dist = 5; this.distActual = 5; this.zoom = 1;
    this.pivote = new THREE.Vector3();
    this.jugador = null;
    this.raton = { x: 0, y: 0, rueda: 0 };
    this.sinRaton = 99;
    this.fase = 0; this.bob = 0; this.golpe = 0; this.caidaMax = 0; this.enSueloAntes = true;
    this.fovBase = 65; this.fov = 65;
    this.activo = false;
    this.cuerpoOculto = null;
  }

  conectar(lienzo) {
    this.lienzo = lienzo;
    this._mov = (e) => { if (document.pointerLockElement === lienzo) { this.raton.x += e.movementX; this.raton.y += e.movementY; } };
    this._rueda = (e) => { if (this.activo && !this.primeraPersona) { this.raton.rueda += Math.sign(e.deltaY); e.preventDefault(); } };
    this._clic = () => { if (this.activo && document.pointerLockElement !== lienzo) lienzo.requestPointerLock?.(); };
    window.addEventListener('mousemove', this._mov);
    lienzo.addEventListener('wheel', this._rueda, { passive: false });
    lienzo.addEventListener('click', this._clic);
  }

  desconectar() {
    if (!this.lienzo) return;
    window.removeEventListener('mousemove', this._mov);
    this.lienzo.removeEventListener('wheel', this._rueda);
    this.lienzo.removeEventListener('click', this._clic);
    this.mostrarCuerpo();
  }

  get capturado() { return !!this.lienzo && document.pointerLockElement === this.lienzo; }
  get primeraPersona() { return !!this.jugador && this.jugador.props.controles === 'primera_persona'; }

  buscarJugador(nodos) {
    return nodos.find(n => esJugador(n) && !n.eliminado && n.visible !== false) || null;
  }

  // ---------- Movimiento (en cada paso de la lógica) ----------
  moverJugador(n, dt) {
    const m = this.d3.m, e = m.entrada;
    // Si cae muy por debajo de donde empezó (por ejemplo, fuera del mapa), reaparece allí.
    const pos = this.d3.posicionGlobal(n);
    if (!n._inicio) n._inicio = pos.slice();
    if (pos[1] < n._inicio[1] - 30) {
      this.d3.fijarPosicionGlobal(n, ...n._inicio);
      n.vy = 0; n._vx = 0; n._vz = 0;
      if (this.jugador === n) this.pivote.set(n._inicio[0], n._inicio[1] + (n.props.altura || 1.8) * 0.85, n._inicio[2]);
    }
    let x = e.eje('izquierda', 'derecha'), z = e.eje('adelante', 'atras');
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    const correr = e.mantiene('correr') && l > 0.1;
    const v = (n.props.velocidad ?? 5) * (correr ? 1.7 : 1);
    let objX, objZ;
    if (this.activo && this.jugador === n) {
      // Relativo a hacia dónde mira la cámara de los controles.
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      objX = (c * x + s * z) * v;
      objZ = (-s * x + c * z) * v;
    } else {
      const { f, r } = this.d3.ejesCamara();
      objX = (r.x * x - f.x * z) * v;
      objZ = (r.z * x - f.z * z) * v;
    }
    n._vx ??= 0; n._vz ??= 0;
    // Inercia: en el suelo acelera rápido y frena aún más rápido; en el aire se controla menos.
    const tasa = n.enSuelo ? (l > 0.05 ? 14 : 20) : (l > 0.05 ? 4 : 1.2);
    const k = 1 - Math.exp(-tasa * dt);
    n._vx += (objX - n._vx) * k;
    n._vz += (objZ - n._vz) * k;
    if (Math.abs(n._vx) < 0.01 && !objX) n._vx = 0;
    if (Math.abs(n._vz) < 0.01 && !objZ) n._vz = 0;
    n.mueveX = n._vx; n.mueveZ = n._vz;
    n._correr = correr;
    if (l > 0.1) m.telemetria('andar');
    // Salto: tiempo de coyote, salto recordado y altura variable.
    n._coyote = n.enSuelo ? 0.12 : Math.max(0, (n._coyote || 0) - dt);
    n._recordado = e.pulsa('saltar') ? 0.14 : Math.max(0, (n._recordado || 0) - dt);
    if (n._recordado > 0 && n._coyote > 0) {
      n.vy = n.props.salto; n.enSuelo = false; n._coyote = 0; n._recordado = 0; n._saltando = true;
      m.telemetria('salto');
    }
    if (n._saltando && !e.mantiene('saltar') && n.vy > 0) { n.vy *= 0.55; n._saltando = false; }
    if (n.vy <= 0) n._saltando = false;
    // «cambiar_vista» (V o Y en el mando) pasa de tercera a primera persona y al revés.
    if (n.props.cambiar_vista !== false && e.pulsa('cambiar_vista')) {
      n.props.controles = n.props.controles === 'primera_persona' ? 'tercera_persona' : 'primera_persona';
    }
    // En primera persona el cuerpo mira siempre hacia donde mira la cámara.
    if (n.props.controles === 'primera_persona' && this.activo) n._mirarYaw = this.yaw;
    else delete n._mirarYaw;
  }

  // ---------- Cámara (en cada fotograma) ----------
  /** Coloca la cámara de los controles. nodoCam: la Cámara3D hija del jugador (o null). */
  actualizarCamara(n, nodoCam, dt) {
    const fp = n.props.controles === 'primera_persona';
    const alt = n.props.altura || 1.8;
    const pos = this.d3.posicionGlobal(n);
    if (this.jugador !== n) this.iniciar(n, nodoCam, pos, alt, fp);
    else if (this._modo !== n.props.controles) this.cambiarModo(n, pos, alt, fp);
    // Entrada: ratón capturado, stick derecho del mando y rueda.
    const sens = n.props.sensibilidad ?? 1;
    const inv = n.props.invertir_y ? -1 : 1;
    const ejes = this.d3.m.entrada.ejesMando || [];
    const zona = (a) => Math.abs(a || 0) < 0.15 ? 0 : (a - Math.sign(a) * 0.15) / 0.85;
    const sx = zona(ejes[2]), sy = zona(ejes[3]);
    const mx = this.raton.x, my = this.raton.y;
    this.raton.x = this.raton.y = 0;
    const vStick = 2.8 * sens;
    this.yaw -= mx * 0.0024 * sens + sx * vStick * dt;
    const dp = (my * 0.0024 * sens + sy * vStick * dt) * inv;
    if (fp) this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dp));
    else this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + dp));
    this.sinRaton = (mx || my || sx || sy) ? 0 : this.sinRaton + dt;
    if (this.raton.rueda) { this.zoom = Math.max(0.4, Math.min(2.2, this.zoom * 1.12 ** this.raton.rueda)); this.raton.rueda = 0; }
    const cam = this.camara;
    if (nodoCam) cam.far = 1000;
    if (fp) this.camaraPrimera(n, pos, alt, dt); else this.camaraTercera(n, pos, alt, dt);
    // Campo de visión: un poco más abierto al correr.
    const objetivo = this.fovBase + (n._correr ? (fp ? 8 : 5) : 0);
    this.fov += (objetivo - this.fov) * (1 - Math.exp(-dt * 6));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; }
    return cam;
  }

  iniciar(n, nodoCam, pos, alt, fp) {
    this.mostrarCuerpo();
    this.jugador = n;
    this._modo = n.props.controles;
    const off = nodoCam ? nodoCam.props.posicion : [0, 2.8, 5.5];
    const rot = nodoCam ? nodoCam.props.rotacion : [-15, 0, 0];
    const piv = alt * 0.82;
    const dy = off[1] - piv, h = Math.hypot(off[0], off[2]);
    this.dist = Math.max(1.2, Math.min(30, Math.hypot(h, dy)));
    this.distActual = this.dist;
    this.zoom = 1;
    const vis = this.d3.obj(n)?.userData.visual;
    if (fp) {
      this.yaw = vis ? vis.rotation.y : (rot[1] || 0) * RAD;
      this.pitch = 0;
    } else {
      this.yaw = (h > 0.01 ? Math.atan2(off[0], off[2]) : 0) + (rot[1] || 0) * RAD;
      this.pitch = Math.max(-0.35, Math.min(1.25, Math.atan2(dy, Math.max(0.01, h))));
    }
    this.pivote.set(pos[0], pos[1] + (fp ? alt * 0.92 : piv), pos[2]);
    this.fovBase = this.fov = nodoCam?.props.fov || 65;
    this.camara.fov = this.fov;
    this.golpe = 0; this.bob = 0; this.caidaMax = 0;
  }

  // Al cambiar de vista se conserva hacia dónde se mira.
  cambiarModo(n, pos, alt, fp) {
    this._modo = n.props.controles;
    if (fp) { this.pitch = -this.pitch * 0.5; this.pivote.set(pos[0], pos[1] + alt * 0.92, pos[2]); }
    else { this.pitch = Math.max(-0.35, Math.min(1.25, 0.25 - this.pitch * 0.5)); this.distActual = 0.4; this.mostrarCuerpo(); }
  }

  camaraTercera(n, pos, alt, dt) {
    const cam = this.camara;
    this.mostrarCuerpo();
    // El punto al que mira sigue al personaje con suavidad (más en vertical, por saltos y escalones).
    _a.set(pos[0], pos[1] + alt * 0.82, pos[2]);
    if (_a.distanceTo(this.pivote) > 6) this.pivote.copy(_a);
    const kh = 1 - Math.exp(-dt * 16), kv = 1 - Math.exp(-dt * 8);
    this.pivote.x += (_a.x - this.pivote.x) * kh;
    this.pivote.z += (_a.z - this.pivote.z) * kh;
    this.pivote.y += (_a.y - this.pivote.y) * kv;
    // Solo con teclado: la cámara se coloca poco a poco detrás de hacia donde anda.
    const vel = Math.hypot(n._vx || 0, n._vz || 0);
    if (!this.capturado && this.sinRaton > 1.2 && vel > 1) {
      const yawObj = Math.atan2(-(n._vx || 0), -(n._vz || 0));
      let d = yawObj - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 2.2) this.yaw += d * Math.min(1, dt * 1.1 * Math.min(1, vel / (n.props.velocidad || 5)));
    }
    const deseada = this.dist * this.zoom;
    _dir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // No atraviesa paredes: se acerca si hay algo entre el personaje y la cámara.
    let libre = deseada;
    _rayo.set(this.pivote, _dir);
    for (const s of this.d3.solidos) {
      _caja.copy(s.b).expandByScalar(0.18);
      if (_caja.containsPoint(this.pivote)) continue;
      if (_rayo.intersectBox(_caja, _hit)) { const t = _hit.distanceTo(this.pivote); if (t < libre) libre = t; }
    }
    libre = Math.max(0.3, libre);
    const k = libre < this.distActual ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 3.5);
    this.distActual += (libre - this.distActual) * k;
    cam.position.copy(this.pivote).addScaledVector(_dir, this.distActual);
    cam.lookAt(this.pivote);
    // Muy cerca, el personaje taparía la vista: se oculta (su sombra sigue).
    if (this.distActual < 0.7) this.ocultarCuerpo(n); else this.mostrarCuerpo();
  }

  camaraPrimera(n, pos, alt, dt) {
    const cam = this.camara;
    this.ocultarCuerpo(n);
    // Los ojos siguen al cuerpo; al subir escalones la vista sube con suavidad.
    const ojos = pos[1] + alt * 0.92;
    if (Math.abs(ojos - this.pivote.y) > 3) this.pivote.y = ojos;
    this.pivote.x = pos[0]; this.pivote.z = pos[2];
    this.pivote.y += (ojos - this.pivote.y) * (1 - Math.exp(-dt * 18));
    // Balanceo al andar.
    const vel = Math.hypot(n._vx || 0, n._vz || 0);
    const amp = n.enSuelo && vel > 0.5 ? Math.min(1, vel / 7) * 0.05 : 0;
    this.bob += (amp - this.bob) * (1 - Math.exp(-dt * 8));
    if (amp > 0) this.fase += dt * (5 + vel * 0.9);
    // Golpe al aterrizar, según lo rápido que caía.
    if (!n.enSuelo) this.caidaMax = Math.min(this.caidaMax, n.vy || 0);
    if (n.enSuelo && !this.enSueloAntes && this.caidaMax < -3) this.golpe = Math.min(0.25, -this.caidaMax * 0.02);
    if (n.enSuelo) this.caidaMax = 0;
    this.enSueloAntes = !!n.enSuelo;
    this.golpe *= Math.exp(-dt * 7);
    const lado = Math.sin(this.fase) * this.bob * 0.5;
    const arriba = Math.sin(this.fase * 2) * this.bob * 0.6;
    cam.position.set(this.pivote.x + Math.cos(this.yaw) * lado, this.pivote.y + arriba - this.golpe, this.pivote.z - Math.sin(this.yaw) * lado);
    cam.rotation.set(this.pitch, this.yaw, Math.sin(this.fase) * this.bob * 0.03, 'YXZ');
  }

  // El cuerpo pasa a una capa que la cámara del jugador no ve, pero las sombras y los espejos sí.
  ocultarCuerpo(n) {
    const vis = this.d3.obj(n)?.userData.visual;
    if (!vis || this.cuerpoOculto === vis) return;
    this.mostrarCuerpo();
    vis.traverse(o => o.layers.set(CAPA_CUERPO));
    this.cuerpoOculto = vis;
  }

  mostrarCuerpo() {
    if (!this.cuerpoOculto) return;
    this.cuerpoOculto.traverse(o => o.layers.set(0));
    this.cuerpoOculto = null;
  }

  /** Mira en primera persona y aviso para capturar el ratón, encima de la interfaz. */
  dibujarAyudas(c, ancho, alto, escala) {
    if (!this.activo) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.primeraPersona && this.capturado) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 1.5 * escala;
      c.beginPath(); c.arc(ancho / 2, alto / 2, 2.5 * escala, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    if (!this.capturado) {
      const texto = 'Haz clic para mirar con el ratón · Esc para soltarlo';
      c.font = `600 ${13 * escala}px Manrope, system-ui, sans-serif`;
      const w = c.measureText(texto).width + 28 * escala, h = 30 * escala;
      const x = (ancho - w) / 2, y = 62 * escala;
      c.fillStyle = 'rgba(8,12,10,0.72)';
      c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill();
      c.fillStyle = '#E7EDE9';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(texto, ancho / 2, y + h / 2 + 0.5);
    }
    c.restore();
  }
}
