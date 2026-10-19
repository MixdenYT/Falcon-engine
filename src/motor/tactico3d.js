// Primitivas físicas CQB. Las reglas, munición y decisiones se ejecutan en los
// Blueprints del proyecto; este módulo solo aporta rayos, navegación y acciones 3D.
import * as THREE from 'three';
import { Animador3D, clonarRig, soloBrazos } from './animacion3d.js';
import { objetivoMano } from './agarre3d.js';

const RAD = Math.PI / 180;
const numero = (v, defecto) => v === null || v === undefined ? defecto : Number(v);
export const EQUIPO_CQB = [
  { nombre: 'Kestrel C9', modelo: 'modelos/armas/kestrel.glb', capacidad: 24, reserva: 96, intervalo: 0.16, recarga: 2.25, dano: 40, alcance: 65 },
  { nombre: 'Lynx P8', modelo: 'modelos/armas/lynx.glb', capacidad: 12, reserva: 48, intervalo: 0.23, recarga: 1.75, dano: 34, alcance: 40 },
];

export class Tactico3D {
  constructor(d3) { this.d3 = d3; this.rutas = new Map(); this.disparos = new Map(); }
  async preparar() {
    const d = this.d3; if (!d.m.proyecto.datos.cqb) return;
    this.armas = new Map(); this.equipados = new Map();
    const jugador = d.controles.buscarJugador(d.m.todos());
    for (const rel of [...EQUIPO_CQB.map(a => a.modelo), 'modelos/armas/hostil.glb']) {
      const modelo = await d.escena.modelo(rel); if (!modelo) throw Error('Falta el arma CQB ' + rel); this.armas.set(rel, modelo);
    }
    for (const n of d.m.todos().filter(n => n.tipo === 'Personaje3D')) {
      const o = d.obj(n), visual = o?.userData.visual; if (!visual) continue;
      const arma = clonarRig(this.armas.get(n === jugador ? EQUIPO_CQB[0].modelo : n.props.arma_modelo || 'modelos/armas/hostil.glb'));
      visual.add(arma); this.equipados.set(n.id, { arma, indice: 0 });
    }
    if (jugador) {
      const o = d.obj(jugador); this.vista = new THREE.Group(); this.vista.name = '__equipo_primera_persona'; this.vista.userData.lumbreDinamico = true;
      this.armasVista = EQUIPO_CQB.map(a => { const arma = clonarRig(this.armas.get(a.modelo)); this.vista.add(arma); return arma; });
      if (o?.userData.modeloRig) {
        this.brazos = soloBrazos(o.userData.modeloRig); const altura = jugador.props.altura || 1.78;
        const pivote = new THREE.Group(); pivote.position.set(0.08, -altura * 0.92, -0.22); pivote.add(this.brazos); this.vista.add(pivote);
        const clips = Object.fromEntries([...o.userData.animador.acciones].map(([k, a]) => [k, a.getClip()]));
        this.animadorBrazos = new Animador3D(this.brazos, clips, { ...o.userData.configRig, primeraPersona: true });
      }
      this.vista.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      d.escena.scene.add(this.vista);
    }
  }
  boca(n) {
    const arma = this.d3.controles.jugador === n && this.armaVistaActual ? this.armaVistaActual : this.equipados?.get(n.id)?.arma;
    return arma?.getObjectByName('Boca')?.getWorldPosition(new THREE.Vector3()) || null;
  }
  agarrar(animador, arma, raiz, recargando = false) {
    if (!animador || !arma || !raiz) return;
    raiz.updateWorldMatrix(true, true);
    for (const [lado, punto, signo] of [['r', 'GripR', 1], ['l', 'GripL', -1]]) {
      const p = arma.getObjectByName(punto)?.getWorldPosition(new THREE.Vector3()); if (!p) continue;
      if (recargando && lado === 'l') {
        const cargador = arma.getObjectByName('Cargador');
        if (cargador) p.copy(cargador.localToWorld(new THREE.Vector3(-0.025, -0.04, 0)));
      }
      const codo = raiz.localToWorld(new THREE.Vector3(signo * 0.43, -0.40, 0.05));
      const objetivo = objetivoMano(animador, lado, arma, p, !!arma.getObjectByName('lynx'));
      animador.agarrar(lado, objetivo.posicion, codo, objetivo.rotacion);
    }
  }
  actualizar(dt) {
    const d = this.d3, jugador = d.controles.jugador;
    if (!this.equipados) return;
    for (const n of d.m.todos().filter(n => n.tipo === 'Personaje3D')) {
      const equipo = this.equipados.get(n.id), o = d.obj(n); if (!equipo || !o) continue;
      const e = this.estado(n);
      if (n === jugador && equipo.indice !== e.arma) {
        equipo.arma.removeFromParent(); equipo.arma = clonarRig(this.armas.get(EQUIPO_CQB[e.arma].modelo)); equipo.indice = e.arma; o.userData.visual.add(equipo.arma);
        equipo.arma.traverse(a => { a.layers.mask = o.userData.visual.layers.mask; });
      }
      if (n._muerto) {
        const mano = o.userData.animador?.huesos.r.mano;
        if (mano) {
          if (!equipo.manoArma) equipo.manoArma = new THREE.Matrix4().copy(mano.matrixWorld).invert().multiply(equipo.arma.matrixWorld);
          const matriz = new THREE.Matrix4().copy(o.userData.visual.matrixWorld).invert().multiply(mano.matrixWorld).multiply(equipo.manoArma);
          matriz.decompose(equipo.arma.position, equipo.arma.quaternion, equipo.arma.scale);
        }
      } else {
        this.recargaVisual(n, equipo.arma);
        const libre = n === jugador || this.libre(n);
        equipo.arma.position.set(0.10, (n._agachado ? 0.88 : 1.33) - (libre ? 0 : 0.1), libre ? -0.16 : 0.05);
        equipo.arma.rotation.set(libre ? n._apuntarPitch || 0 : -1.05, 0, 0);
        this.agarrar(o.userData.animador, equipo.arma, o.userData.visual, !!n.aguilaObtener('recargando'));
      }
    }
    if (!this.vista || !jugador) return;
    this.vista.visible = !!d.controles.primeraPersona;
    const cam = d.camaraUsada || d.controles.camara; this.vista.position.copy(cam.position); this.vista.quaternion.copy(cam.quaternion);
    const e = this.estado(jugador), ads = d.controles.ads || 0, libre = this.libre(jugador), recargando = !!jugador.aguilaObtener('recargando');
    this.armasVista.forEach((a, i) => { a.visible = i === e.arma; });
    const arma = this.armaVistaActual = this.armasVista[e.arma];
    this.recargaVisual(jugador, arma);
    const recoil = Math.exp(-Math.max(0, d.m.tiempo - (e.ultimoTiro ?? -10)) * 30);
    const baja = !libre ? 0.15 : recargando ? 0.12 : 0;
    const miraY = arma.getObjectByName('Mira')?.position.y || 0.08;
    arma.position.set((libre ? 0.19 : 0.04) * (1 - ads), (e.arma ? -0.16 : -0.24) * (1 - ads) - miraY * ads - baja, (libre ? -0.35 : -0.05) + recoil * 0.025);
    if (libre && recargando) arma.position.set(0.12, 0.02, -0.50);
    arma.rotation.set((!libre ? -1.05 : recargando ? 0.13 : 0) + recoil * 0.018, recargando ? 0.32 : 0, recargando ? -0.35 : 0);
    if (this.animadorBrazos) { this.animadorBrazos.actualizar(jugador, d.m.tiempo, d.m.pausado ? 0 : dt); this.agarrar(this.animadorBrazos, arma, this.vista, recargando); }
    this.vista.updateWorldMatrix(true, true);
  }
  recargaVisual(n, arma) {
    const mag = arma.getObjectByName('Cargador'); if (!mag) return;
    const base = mag.userData.reposo ||= mag.position.toArray(); mag.position.fromArray(base);
    if (!n.aguilaObtener('recargando')) return;
    const e = this.estado(n), duracion = n === this.d3.controles.jugador ? EQUIPO_CQB[e.arma].recarga : 2.6;
    const fase = Math.max(0, Math.min(1, 1 - n.aguilaObtener('recarga') / duracion));
    const salida = fase < 0.24 ? fase / 0.24 : fase < 0.66 ? 1 : Math.max(0, (0.9 - fase) / 0.24);
    mag.position.y -= salida * 0.20; mag.position.x -= Math.sin(fase * Math.PI) * 0.045;
  }
  dibujarHUD(c, W, H) {
    const d = this.d3, j = d.controles.jugador; if (!d.m.proyecto.datos.cqb || !j) return;
    const en = !!j.aguilaObtener('ingles'), escala = Math.min(W / 1280, H / 720), margen = 28;
    const tr = (es, ingles) => en ? ingles : es;
    c.save(); c.setTransform(escala, 0, 0, escala, 0, 0); const ancho = W / escala, alto = H / escala;
    const texto = (s, x, y, tam = 14, color = '#D4DEDA', peso = 500) => { c.font = `${peso} ${tam}px Manrope, system-ui, sans-serif`; c.fillStyle = color; c.fillText(s, x, y); };
    const panel = (x, y, w, h) => { c.fillStyle = 'rgba(12,23,22,0.84)'; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill(); };
    panel(margen, 22, 320, 64); texto(tr('UMBRAL · OPERACIÓN CQB', 'THRESHOLD · CQB OPERATION'), margen + 14, 46, 13, '#BBD4C4', 700);
    texto(tr('Neutraliza 3 contactos y asegura el terminal', 'Clear 3 hostiles and secure the terminal'), margen + 14, 69, 13);
    const bajas = j.aguilaObtener('bajas'); texto(`${bajas} / 3`, ancho - 82, 48, 19, '#D9DBC9', 700);
    const posicion = d.posicionGlobal(j), zona = posicion[2] > 7.5 ? tr('ACCESO', 'ENTRY') : posicion[2] < -6.5 ? tr('CONTROL', 'CONTROL') : posicion[0] < -1.9 ? tr('OFICINAS', 'OFFICES') : posicion[0] > 1.9 ? tr('ARCHIVO', 'STORAGE') : tr('PASILLO', 'CORRIDOR');
    texto(zona, ancho / 2 - 35, 37, 12, '#AABEB6');
    panel(margen, alto - 89, 228, 62); texto(tr('ESTADO', 'STATUS'), margen + 13, alto - 68, 10, '#A7BEB3');
    const vida = j.aguilaObtener('vida'); texto(`${tr('SALUD', 'HEALTH')} ${vida}`, margen + 13, alto - 43, 17, vida < 35 ? '#F3AB91' : '#E3E9DF', 700);
    c.fillStyle = '#31453B'; c.fillRect(margen + 128, alto - 52, 80, 4); c.fillStyle = vida < 35 ? '#C37459' : '#9DBDA5'; c.fillRect(margen + 128, alto - 52, Math.max(0, vida) * 0.8, 4);
    const estado = j._agachado ? tr('AGACHADO', 'CROUCHED') : j._lento ? tr('PASO LENTO', 'SLOW WALK') : j._correr ? tr('AVANCE RÁPIDO', 'FAST MOVE') : tr('DE PIE', 'STANDING'); texto(estado + (j._apuntando ? ' · ADS' : ''), margen, alto - 102, 11, '#A4BBB0');
    const arma = EQUIPO_CQB[this.estado(j).arma]; panel(ancho - margen - 210, alto - 106, 210, 79);
    texto(arma.nombre.toUpperCase(), ancho - margen - 194, alto - 83, 11, '#AABDAE', 700);
    texto(`${j.aguilaObtener('municion')} / ${j.aguilaObtener('reserva')}`, ancho - margen - 194, alto - 47, 30, '#E6E7DB', 700);
    if (j.aguilaObtener('recargando')) {
      texto(tr('RECARGANDO', 'RELOADING'), ancho / 2 - 45, alto / 2 + 66, 11, '#D9C896');
      c.fillStyle = '#31453B'; c.fillRect(ancho / 2 - 60, alto / 2 + 77, 120, 3); c.fillStyle = '#C9BB8B'; c.fillRect(ancho / 2 - 60, alto / 2 + 77, 120 * (1 - Math.max(0, j.aguilaObtener('recarga')) / arma.recarga), 3);
    }
    const obj = this.interaccion(j);
    if (obj) {
      let accion = obj.props.descripcion || obj.nombre;
      if (obj.grupos.has('interactuable') && obj.scripts.some(s => s.tiene('abierta'))) accion = tr(obj.aguilaObtener('abierta') ? 'Cerrar puerta' : 'Abrir puerta', obj.aguilaObtener('abierta') ? 'Close door' : 'Open door');
      else if (accion.includes(' / ')) accion = accion.split(' / ')[en ? 1 : 0];
      if (obj.nombre === 'Terminal' && bajas < 3) accion = tr('Despeja los 3 contactos antes de asegurar', 'Clear all 3 hostiles before securing');
      texto('F · ' + accion, ancho / 2 - Math.min(150, accion.length * 3), alto / 2 + 44, 13, '#E4D9AC', 600);
    } else if (!this.libre(j) && !j._correr) texto(tr('ARMA BAJA · Obstáculo cercano', 'LOW READY · Close obstacle'), ancho / 2 - 93, alto / 2 + 44, 11, '#D2BE96');
    texto(tr('H controles · L English', 'H controls · L Español'), ancho / 2 - 75, alto - 29, 11, '#94A99E');
    if (j.aguilaObtener('ayuda')) {
      const x = ancho / 2 - 245, y = alto / 2 - 150; panel(x, y, 490, 297);
      const lineas = en ? ['CQB CONTROLS', 'W A S D  Move   ·   Mouse  Look', 'Alt  Slow walk   ·   Shift  Fast move', 'Ctrl (hold)  Crouch   ·   Q / E (hold)  Lean', 'Right mouse (hold)  Aim down sights', 'Left click / J  Single shot   ·   R  Reload', '1 / 2  Primary / sidearm   ·   T  Swap', 'F  Doors / supplies / terminal', '[ / ]  Mouse sensitivity   ·   L  Language', 'Esc  Release mouse   ·   P  Pause', 'H  Close this help'] : ['CONTROLES CQB', 'W A S D  Mover   ·   Ratón  Mirar', 'Alt  Paso lento   ·   Shift  Avance rápido', 'Ctrl (mantener)  Agacharse   ·   Q / E  Inclinarse', 'Clic derecho (mantener)  Apuntar con miras', 'Clic izquierdo / J  Un disparo   ·   R  Recargar', '1 / 2  Principal / secundaria   ·   T  Cambiar', 'F  Puertas / suministros / terminal', '[ / ]  Sensibilidad   ·   L  Idioma', 'Esc  Soltar ratón   ·   P  Pausa', 'H  Cerrar esta ayuda'];
      lineas.forEach((s, i) => texto(s, x + 20, y + 28 + i * 24, i ? 13 : 16, i ? '#CDD8CD' : '#DCE3CF', i ? 500 : 700));
    }
    c.restore();
  }
  destruir() { this.animadorBrazos?.destruir(); this.vista?.removeFromParent(); }
  estado(n) { return n._tactico ||= { arma: 0, animacion: 'idle', hasta: 0, patrulla: 0 }; }
  animar(n, nombre, segundos = 0.3) {
    const e = this.estado(n); e.animacion = String(nombre); e.evento = (e.evento || 0) + 1; e.duracion = Math.max(0.01, numero(segundos, 0.3)); e.hasta = this.d3.m.tiempo + e.duracion;
    if (nombre === 'death') { n._muerto = true; n.mueveX = n.mueveZ = 0; n._vx = n._vz = 0; e.hasta = Infinity; }
    return null;
  }
  equipar(n, indice) { const e = this.estado(n); e.arma = Math.max(0, Math.min(1, Math.trunc(Number(indice) || 0))); this.animar(n, 'equip', 0.35); return null; }
  ojos(n, factor = 0.86) { return this.d3.puntoVista(n, factor); }
  mirar(n, objetivo) {
    if (!objetivo || n._muerto) return null;
    const a = this.ojos(n), b = this.ojos(objetivo), d = b.sub(a);
    n._mirarYaw = Math.atan2(-d.x, -d.z); n._apuntarPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    return null;
  }
  detectar(n, objetivo, alcance = 18, angulo = 105) {
    if (!objetivo || objetivo._muerto || n._muerto || !this.d3.lineaVision(n, objetivo, numero(alcance, 18))) return false;
    const a = this.ojos(n), b = this.ojos(objetivo), d = b.sub(a).setY(0).normalize();
    const yaw = this.d3.obj(n)?.userData.visual?.rotation.y ?? (n.props.rotacion[1] || 0) * RAD;
    return d.dot(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))) >= Math.cos(numero(angulo, 105) * RAD / 2);
  }
  oir(n, objetivo, alcance = 12) {
    const t = this.disparos.get(objetivo?.id);
    return t !== undefined && this.d3.m.tiempo - t < 1.2 && this.ojos(n).distanceTo(this.ojos(objetivo)) < numero(alcance, 12);
  }
  recordar(n, objetivo) { if (objetivo) this.estado(n).recuerdo = this.d3.posicionGlobal(objetivo).slice(); return null; }
  libre(n) {
    const c = this.d3.controles;
    if (c.jugador !== n) {
      if (n._muerto) return false;
      const visual = this.d3.obj(n)?.userData.visual, dir = new THREE.Vector3(0, 0, -1);
      if (visual) dir.applyQuaternion(visual.getWorldQuaternion(new THREE.Quaternion()));
      const hit = this.d3.primerImpacto(this.ojos(n, 0.78), dir, 0.88, [n]);
      return !hit || hit.nodo.tipo === 'Personaje3D';
    }
    if (n._correr || n._muerto) return false;
    const cam = this.d3.camaraUsada || c.camara, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const p = this.d3.primerImpacto(cam.position, dir, this.estado(n).arma ? 0.68 : 1.03, [n]);
    if (p && p.nodo.tipo !== 'Personaje3D') return false;
    const arma = this.armasVista?.[this.estado(n).arma], nodoBoca = arma?.getObjectByName('Boca');
    if (nodoBoca) {
      const ads = c.ads || 0, mira = arma.getObjectByName('Mira')?.position.y || 0.08;
      const listo = nodoBoca.position.clone().add(new THREE.Vector3(0.19 * (1 - ads), -0.24 * (1 - ads) - mira * ads, -0.35)).applyQuaternion(cam.quaternion).add(cam.position);
      const puente = listo.sub(cam.position), obstruccion = this.d3.primerImpacto(cam.position, puente, puente.length(), [n]);
      if (obstruccion && obstruccion.nodo.tipo !== 'Personaje3D') return false;
    }
    return true;
  }
  disparar(n, dano = 40, alcance = 65) {
    const d = this.d3, jugador = d.controles.buscarJugador(d.m.todos());
    if (n._muerto || !this.libre(n)) return false;
    this.disparos.set(n.id, d.m.tiempo); this.animar(n, 'fire', 0.16);
    let impacto = null;
    if (n === jugador) impacto = d.dispararRayo(numero(alcance, 65));
    else if (jugador && d.lineaVision(n, jugador, numero(alcance, 65))) {
      const a = this.boca(n) || this.ojos(n, 0.78), b = this.ojos(jugador, 0.68), dir = b.clone().sub(a);
      const origen = this.ojos(n, 0.78), puente = a.clone().sub(origen);
      const previo = d.primerImpacto(origen, puente, puente.length(), [n]);
      const hit = previo || d.primerImpacto(a, dir, dir.length() + 0.03, [n]);
      impacto = hit?.nodo || null;
      d.trazar(a, hit?.punto || b);
    }
    d.m.audio?.sonar(n === jugador ? (this.estado(n).arma ? 'pistola.wav' : 'carabina.wav') : 'enemigo.wav', n === jugador ? 0.36 : 0.18);
    if (n === jugador) { d.controles.retroceso = Math.min(0.04, (d.controles.retroceso || 0) + 0.017); this.estado(n).ultimoTiro = d.m.tiempo; }
    if (impacto?.scripts.some(s => s.tiene('recibir_dano')) && impacto !== n && (n !== jugador || impacto.grupos.has('enemigos'))) d.m.llamarFuncion(impacto, 'recibir_dano', [numero(dano, 40)]);
    return !!impacto;
  }
  interaccion(n) {
    const d = this.d3, cam = d.camaraUsada || d.controles.camara, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const hit = d.primerImpacto(cam.position, dir, 2.2, [n]);
    if (!hit) return null;
    for (let o = hit.nodo; o; o = o.padre) if (o.grupos.has('interactuable')) return o;
    return null;
  }
  interactuar(n) { const o = this.interaccion(n); if (o) this.d3.m.llamarFuncion(o, 'usar', []); return null; }
  puerta(n, abierta, delta) {
    const e = this.estado(n), hoja = n.hijo('Hoja'); if (!hoja) return false;
    if (e.angulo === undefined) { e.angulo = 0; e.base = n.props.rotacion[1] || 0; }
    const anterior = e.angulo, objetivo = abierta ? 92 : 0;
    const paso = Math.min(1 / 15, Math.max(0, numero(delta, 1 / 60))) * 85;
    const siguiente = anterior + Math.sign(objetivo - anterior) * Math.min(paso, Math.abs(objetivo - anterior));
    // Comprueba todo el barrido con pasos de <= 3 grados. La puerta se detiene
    // ante cualquier cuerpo; nunca empuja al jugador al otro lado de un tabique.
    const pasos = Math.max(1, Math.ceil(Math.abs(siguiente - anterior) / 3)); let bloqueada = false;
    const objeto = this.d3.obj(n);
    for (let i = 1; i <= pasos; i++) {
      n.props.rotacion[1] = e.base + anterior + (siguiente - anterior) * i / pasos;
      if (objeto) { objeto.rotation.y = n.props.rotacion[1] * RAD; objeto.updateWorldMatrix(true, true); }
      const b = this.d3.cajaMundo(hoja);
      if (b && this.d3.m.todos().some(p => p.tipo === 'Personaje3D' && !p._muerto && b.intersectsBox(this.d3.cajaPersonaje(p, this.d3.posicionGlobal(p))))) { bloqueada = true; break; }
    }
    e.angulo = bloqueada ? anterior : siguiente; e.bloqueada = bloqueada;
    n.props.rotacion[1] = e.base + e.angulo;
    if (objeto) { objeto.rotation.y = n.props.rotacion[1] * RAD; objeto.updateWorldMatrix(true, true); }
    return !bloqueada;
  }
  // A* sobre una cuadrícula de 50 cm. Solo se usa en este mapa pequeño. Cada
  // búsqueda comprueba las mismas cajas y puertas que la física y los disparos.
  calcularRuta(n, destino) {
    const d = this.d3, limites = d.m.proyecto.datos.navegacion || [-9, -12, 9, 12], celda = 0.5;
    const [x0, z0, x1, z1] = limites, ancho = Math.round((x1 - x0) / celda) + 1, alto = Math.round((z1 - z0) / celda) + 1;
    const coord = p => [Math.max(0, Math.min(ancho - 1, Math.round((p[0] - x0) / celda))), Math.max(0, Math.min(alto - 1, Math.round((p[2] - z0) / celda)))];
    const inicio = coord(d.posicionGlobal(n)), fin = coord(destino), clave = (x, z) => z * ancho + x;
    const desde = clave(...inicio), hasta = clave(...fin), prev = new Map(), coste = new Map([[desde, 0]]), abiertos = new Set([desde]), cerrados = new Set();
    const bloqueos = d.solidos.filter(s => s.b.max.y > 0.36 && s.b.min.y < (n._alturaColision || 1.8));
    const libre = (x, z) => x >= 0 && z >= 0 && x < ancho && z < alto && !bloqueos.some(s => s.b.max.x > x0 + x * celda - 0.4 && s.b.min.x < x0 + x * celda + 0.4 && s.b.max.z > z0 + z * celda - 0.4 && s.b.min.z < z0 + z * celda + 0.4);
    if (!libre(...fin)) return [];
    for (let intentos = 0; abiertos.size && intentos < 4000; intentos++) {
      let actual = null, mejor = Infinity;
      for (const k of abiertos) { const h = coste.get(k) + Math.abs(k % ancho - fin[0]) + Math.abs(Math.floor(k / ancho) - fin[1]); if (h < mejor) { mejor = h; actual = k; } }
      if (actual === hasta) { const ruta = []; for (let k = hasta; k !== desde; k = prev.get(k)) ruta.unshift([x0 + k % ancho * celda, 0, z0 + Math.floor(k / ancho) * celda]); return ruta; }
      abiertos.delete(actual); cerrados.add(actual);
      const x = actual % ancho, z = Math.floor(actual / ancho);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, k = clave(nx, nz), nuevo = coste.get(actual) + 1;
        if (cerrados.has(k) || !libre(nx, nz) || nuevo >= (coste.get(k) ?? Infinity)) continue;
        prev.set(k, actual); coste.set(k, nuevo); abiertos.add(k);
      }
    }
    return [];
  }
  ir(n, destino, velocidad = 1.4) {
    if (!destino || n._muerto) return null;
    const e = this.estado(n), pos = this.d3.posicionGlobal(n), clave = destino.map(v => Number(v).toFixed(1)).join(',');
    if (e.destino !== clave || this.d3.m.tiempo >= (e.recalcular || 0)) { e.ruta = this.calcularRuta(n, destino); e.destino = clave; e.recalcular = this.d3.m.tiempo + 0.65; }
    while (e.ruta?.length && Math.hypot(e.ruta[0][0] - pos[0], e.ruta[0][2] - pos[2]) < 0.14) e.ruta.shift();
    const siguiente = e.ruta?.[0]; if (!siguiente) return null;
    const dx = siguiente[0] - pos[0], dz = siguiente[2] - pos[2], l = Math.hypot(dx, dz), v = Math.min(numero(velocidad, 1.4), l / (this.d3.m.dtPaso || 1 / 60));
    n.mueveX = dx / l * v; n.mueveZ = dz / l * v; return null;
  }
  patrullar(n, velocidad) {
    delete n._mirarYaw;
    const e = this.estado(n), puntos = n.props.ruta_patru ? n.props.ruta_patru.split(';').map(nombre => this.d3.m.buscarPorNombre(nombre)).filter(Boolean) : n.hijos.filter(h => h.grupos.has('patrulla')); if (!puntos.length) return null;
    const p = this.d3.posicionGlobal(puntos[e.patrulla % puntos.length]), a = this.d3.posicionGlobal(n);
    if (Math.hypot(p[0] - a[0], p[2] - a[2]) < 0.3) e.patrulla++;
    return this.ir(n, p, velocidad);
  }
  investigar(n, velocidad) { delete n._mirarYaw; return this.ir(n, this.estado(n).recuerdo, velocidad); }
  cobertura(n, objetivo, velocidad) {
    if (!objetivo) return null;
    const d = this.d3, e = this.estado(n), origen = this.ojos(objetivo), a = this.ojos(n);
    let mejor = null, distancia = Infinity;
    for (const c of d.m.grupo('cobertura')) {
      const p = new THREE.Vector3(...d.posicionGlobal(c)); p.y = 1;
      const dir = p.clone().sub(origen), largo = dir.length(), hit = d.primerImpacto(origen, dir, largo, [n, objetivo]);
      if (!hit || hit.distancia > largo - 0.35 || a.distanceTo(p) > 7) continue;
      const dist = a.distanceTo(p); if (dist < distancia) { distancia = dist; mejor = p; }
    }
    e.cubierto = !!mejor && distancia < 0.7;
    if (mejor) this.ir(n, [mejor.x, 0, mejor.z], velocidad);
    else this.investigar(n, velocidad);
    return null;
  }
}
