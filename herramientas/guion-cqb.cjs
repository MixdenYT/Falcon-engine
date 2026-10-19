// Se serializa dentro de --guion y se ejecuta en el reproductor instalado.
// Solo introduce entradas. No cambia vida, munición, posición, IA ni velocidad.
module.exports = async function verificarCQB({ directorio, reabrir = false }) {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  let m;
  const exigir = (v, mensaje) => { if (!v) throw Error(mensaje); };
  const esperar = async (fn, mensaje, limite = 90000) => {
    const fin = Date.now() + limite;
    while (!fn()) {
      if (Date.now() > fin) throw Error(mensaje);
      if (m?.errores.length) throw Error(JSON.stringify(m.errores));
      if (m?.estado === 'perdido') throw Error('El jugador murió: ' + mensaje);
      await dormir(25);
    }
  };
  await esperar(() => window.__falconJuego?.raiz && !document.querySelector('.cargando-juego'), 'No inició CQB');
  m = window.__falconJuego;
  const d = m.d3, j = m.buscarPorNombre('Jugador'), c = d.controles, lienzo = document.querySelector('#lienzo');
  const { THREE } = await import('falcon://app/src/motor/escena3d.js');
  const checks = [], hitos = [], t0 = Date.now(); let combate = false;
  const latido = setInterval(() => console.log('CQB tiempo:', m.tiempo.toFixed(2), 'posición:', pos(j), 'pausa:', m.pausado, 'dibujos:', d.renderer.info.render.calls, 'triángulos:', d.renderer.info.render.triangles, 'lienzo:', [lienzo.width, lienzo.height]), 15000);
  const avanzar = async segundos => { const hasta = m.tiempo + segundos; await esperar(() => m.tiempo >= hasta, 'Simulación detenida'); };
  const tecla = (code, abajo) => window.dispatchEvent(new KeyboardEvent(abajo ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  const pulsar = async code => { tecla(code, true); await avanzar(0.07); tecla(code, false); await avanzar(0.07); };
  const raton = abajo => (abajo ? lienzo : window).dispatchEvent(new MouseEvent(abajo ? 'mousedown' : 'mouseup', { button: 2, bubbles: true }));
  const pos = n => d.posicionGlobal(n);
  const angular = a => Math.atan2(Math.sin(a), Math.cos(a));
  const mirar = async (x, y, z) => {
    const cam = d.camaraUsada, dx = x - cam.position.x, dy = y - cam.position.y, dz = z - cam.position.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const k = 0.0024 * j.props.sensibilidad * (j._apuntando ? 0.62 : 1);
    // Movimiento relativo del ratón que consumen los controles, también en
    // entornos de CI donde el sistema no permite capturar físicamente el cursor.
    c.raton.x += -angular(yaw - c.yaw) / k; c.raton.y += -(pitch - c.pitch) / k;
    await avanzar(0.07);
  };
  const ir = async (x, z) => {
    raton(false); const inicio = m.tiempo, limite = Math.hypot(x - pos(j)[0], z - pos(j)[2]) / 1.1 + 4;
    await mirar(x, d.camaraUsada.position.y, z); tecla('KeyW', true);
    try {
      while (Math.hypot(x - pos(j)[0], z - pos(j)[2]) > 0.17) {
        exigir(m.tiempo - inicio < limite, 'Ruta bloqueada hacia ' + [x, z] + '; posición ' + pos(j) + '; contactos ' + [...(j._contactosSolidos || [])].map(n => n.nombre));
        const cercano = combate && m.grupo('enemigos').find(n => !n._muerto && Math.hypot(pos(n)[0] - pos(j)[0], pos(n)[2] - pos(j)[2]) < 1.65 && d.lineaVision(j, n, 3));
        if (cercano) { tecla('KeyW', false); await avanzar(0.1); await disparar(cercano); }
        await mirar(x, d.camaraUsada.position.y, z);
        tecla('KeyW', true);
      }
    } finally { tecla('KeyW', false); }
    await avanzar(0.13);
  };
  const foto = async nombre => {
    // Composición de los dos lienzos que usa el juego: WebGL y HUD real.
    const v = document.querySelector('#lienzo3d'), out = document.createElement('canvas');
    out.width = lienzo.width; out.height = lienzo.height;
    exigir(out.width >= 640 && out.height >= 360, 'La captura tiene un tamaño inválido: ' + [out.width, out.height]);
    const ctx = out.getContext('2d'); ctx.drawImage(v, 0, 0, out.width, out.height); ctx.drawImage(lienzo, 0, 0);
    const bytes = Uint8Array.from(atob(out.toDataURL('image/png').split(',')[1]), x => x.charCodeAt(0));
    await falcon.fs.escribir(directorio + '/' + nombre + '.png', bytes);
    hitos.push({ nombre, tiempo: m.tiempo, posicion: pos(j), vida: j.aguilaObtener('vida') });
  };
  const registrar = async (nombre, datos = {}) => {
    checks.push({ nombre, ...datos });
    await falcon.fs.escribir(directorio + '/cqb-progreso.json', JSON.stringify({ checks, hitos }, null, 2));
    console.log('CQB QA:', nombre);
  };
  const agarres = () => Object.fromEntries(['r', 'l'].map(lado => {
    const a = d.tactico.animadorBrazos, perfil = a.config.perfiles_manos.perfiles[lado];
    const palma = a.huesos[lado].mano.localToWorld(new THREE.Vector3(...perfil.palma));
    const punto = d.tactico.armaVistaActual.getObjectByName(lado === 'r' ? 'GripR' : 'GripL').getWorldPosition(new THREE.Vector3());
    return [lado, palma.distanceTo(punto)];
  }));
  await avanzar(0.25);
  const personajes = m.todos().filter(n => n.tipo === 'Personaje3D').map(n => {
    const o = d.obj(n), a = o.userData.animador; let tri = 0, skins = 0, texturas = 0;
    o.userData.modeloRig.traverse(x => { if (x.isSkinnedMesh) { skins++; tri += (x.geometry.index?.count || x.geometry.attributes.position.count) / 3; if (x.material.map?.image && x.material.normalMap?.image && x.material.roughnessMap?.image) texturas++; } });
    exigir(skins > 0 && texturas > 0 && a.bones.length === 24 && a.acciones.size === 7 && tri < 20000, 'Rig, texturas o animaciones incompletos en ' + n.nombre);
    return { nombre: n.nombre, triangulos: tri, huesos: a.bones.length, clips: [...a.acciones.keys()], texturasPBR: texturas, recorte: o.userData.recorte };
  });
  const g = agarres(); exigir(g.r < 0.01 && g.l < 0.01, 'Manos fuera de los agarres (metros): ' + JSON.stringify(g));
  exigir(m.errores.length === 0 && j.aguilaObtener('municion') === 24 && j.aguilaObtener('vida') === 100, 'Estado inicial incorrecto');
  await registrar(reabrir ? 'Proyecto cerrado y abierto en un proceso nuevo: recursos y estado inicial correctos' : 'Modelos, texturas PBR, 7 clips por rig y agarres verificados', { personajes, agarres: g });
  await foto(reabrir ? 'cqb-reabierto' : 'cqb-inicio');
  if (reabrir) { clearInterval(latido); return { reabierto: true, checks, hitos, errores: m.errores }; }

  // Comprobar acciones sin contacto enemigo ni modificaciones del mundo.
  const sensibilidad = j.props.sensibilidad; await pulsar('BracketRight'); exigir(j.props.sensibilidad > sensibilidad, 'No aumenta sensibilidad'); await pulsar('BracketLeft');
  await pulsar('KeyL'); exigir(j.aguilaObtener('ingles') === true, 'No activa inglés'); await pulsar('KeyH'); await foto('cqb-controles-en'); await pulsar('KeyH'); await pulsar('KeyL');
  tecla('KeyP', true); await dormir(180); exigir(m.pausado, 'P no pausa'); tecla('KeyP', false); tecla('KeyP', true); tecla('KeyP', false); await avanzar(0.1);
  tecla('KeyW', true); await avanzar(1.8); tecla('KeyW', false); await avanzar(0.15);
  exigir(pos(j)[2] > 7.94, 'Atravesó puerta cerrada: ' + pos(j));
  const cerrada = pos(j).slice();
  const puerta = m.buscarPorNombre('PuertaAcceso'); await pulsar('KeyF'); await avanzar(1.2);
  exigir(d.tactico.estado(puerta).angulo > 85, 'F no abre la puerta');
  await ir(0, 4.8); exigir(pos(j)[2] < 6, 'No cruza la puerta abierta');
  await registrar('Puerta cerrada bloquea al jugador; F abre la hoja física y permite cruzar', { posicionBloqueada: cerrada, angulo: d.tactico.estado(puerta).angulo });

  const pie = d.camaraUsada.position.y;
  tecla('ControlLeft', true); await avanzar(0.4);
  exigir(j._agachado && j._alturaColision < 1.15 && d.camaraUsada.position.y < pie - 0.4, 'Agacharse no reduce cámara/collider'); tecla('ControlLeft', false); await avanzar(0.3);
  tecla('AltLeft', true); tecla('KeyW', true); await avanzar(0.25); exigir(Math.hypot(j.vx, j.vz) < 1.2, 'Paso lento demasiado rápido'); tecla('KeyW', false); tecla('AltLeft', false); await avanzar(0.15);
  tecla('ShiftLeft', true); tecla('KeyS', true); await avanzar(0.25); exigir(Math.hypot(j.vx, j.vz) > 2.8, 'Avance rápido incorrecto'); tecla('KeyS', false); tecla('ShiftLeft', false); await avanzar(0.15);
  for (const [key, signo] of [['KeyQ', -1], ['KeyE', 1]]) { tecla(key, true); await avanzar(0.3); exigir(c.inclinacion * signo > 0.7, 'No se inclina con ' + key); tecla(key, false); await avanzar(0.3); }
  raton(true); await avanzar(0.45);
  const mira = d.tactico.armaVistaActual.getObjectByName('Mira').getWorldPosition(new THREE.Vector3()).project(d.camaraUsada);
  exigir(d.camaraUsada.fov < 53 && Math.abs(mira.x) < 0.015 && Math.abs(mira.y) < 0.015, 'ADS y centro de mira no coinciden: ' + mira.toArray());
  await foto('cqb-miras'); raton(false); await avanzar(0.4);
  await registrar('Cámara: paso lento/rápido, agacharse, Q/E, sensibilidad, pausa y ADS centrado', { mira: mira.toArray() });

  await pulsar('Digit2'); await avanzar(0.4);
  tecla('KeyJ', true); await avanzar(0.75); tecla('KeyJ', false); await avanzar(0.07);
  exigir(j.aguilaObtener('municion') === 11, 'Mantener disparo produce más de una bala');
  await pulsar('KeyR'); exigir(j.aguilaObtener('recargando'), 'No inicia recarga'); await pulsar('Digit1'); exigir(!j.aguilaObtener('recargando'), 'Cambiar arma no cancela recarga');
  await pulsar('Digit2'); exigir(j.aguilaObtener('municion') === 11, 'Se perdió inventario de la pistola'); await pulsar('KeyR'); await avanzar(0.6); await foto('cqb-recarga'); await avanzar(1.3);
  exigir(j.aguilaObtener('municion') === 12 && j.aguilaObtener('reserva') === 47, 'Recarga no transfiere una bala real');
  await pulsar('KeyT'); await avanzar(0.45); exigir(j.aguilaObtener('arma') === 0 && j.aguilaObtener('municion') === 24, 'T no conserva inventarios');
  await registrar('Disparo manual, recarga visible, cancelación y dos inventarios reales');

  const abrir = async (nombre, punto) => { await mirar(...punto); exigir(d.tactico.interaccion(j)?.nombre === nombre, 'Objeto F no alcanzable: ' + nombre); await pulsar('KeyF'); await avanzar(1.2); exigir(d.tactico.estado(m.buscarPorNombre(nombre)).angulo > 85, 'No se abrió ' + nombre); };
  const disparar = async enemigo => {
    raton(true); await avanzar(0.2); let p = pos(enemigo); await mirar(p[0], p[1] + 1.35, p[2]);
    const direccion = new THREE.Vector3(); d.camaraUsada.getWorldDirection(direccion);
    const visto = d.primerImpacto(d.camaraUsada.position, direccion, 65, [j]);
    exigir(visto?.nodo === enemigo, 'La mira no ve a ' + enemigo.nombre + ': ' + visto?.nodo?.nombre);
    const antes = enemigo.aguilaObtener('vida'); await pulsar('KeyJ'); await avanzar(0.2); raton(false);
    exigir(enemigo.aguilaObtener('vida') < antes, 'El disparo no alcanzó a ' + enemigo.nombre);
  };
  const cubrir = async enemigo => {
    const p = pos(enemigo).slice(); await disparar(enemigo); await avanzar(1.4);
    exigir(enemigo.aguilaObtener('estado') === 'COBERTURA' || enemigo.aguilaObtener('estado') === 'BUSCANDO', 'No reaccionó al impacto');
    const mov = Math.hypot(pos(enemigo)[0] - p[0], pos(enemigo)[2] - p[2]);
    exigir(mov > 0.35, 'No avanza hacia cobertura ' + enemigo.nombre);
    await registrar('El enemigo percibe, recibe daño y se mueve físicamente hacia cobertura: ' + enemigo.nombre, { desde: p, hasta: pos(enemigo), movimiento: mov });
  };
  const neutralizar = async enemigo => { for (let n = 0; n < 3 && !enemigo._muerto; n++) await disparar(enemigo); exigir(enemigo._muerto, 'No murió ' + enemigo.nombre); await avanzar(0.9); };

  combate = true;
  await ir(0, 4.8); await abrir('PuertaOficina', [-1.8, 1.0, 4.85]);
  const oficina = m.buscarPorNombre('CentinelaOficina'); await ir(-2.6, 4.8); await mirar(...[pos(oficina)[0], 1.35, pos(oficina)[2]]); await foto('cqb-contacto');
  await cubrir(oficina); await ir(-3.4, 4.1); await neutralizar(oficina); await foto('cqb-oficina');
  await ir(-3.0, 4.85); await ir(0, 4.85); await ir(0, 0.2);
  await abrir('PuertaArchivo', [1.8, 1.0, 0.2]);
  const archivo = m.buscarPorNombre('CentinelaArchivo'); await ir(3.2, 0.2); await cubrir(archivo); await ir(3.95, 0.2); await ir(3.95, -4.7); await neutralizar(archivo); await foto('cqb-archivo');
  await ir(3.95, 0.2); await ir(0, 0.2); await ir(0, -5.1);
  await abrir('PuertaControl', [0, 1.0, -6.5]); await ir(0, -8.0);
  const control = m.buscarPorNombre('CentinelaControl'); await cubrir(control); await ir(-1.8, -10.5); await neutralizar(control);
  await avanzar(3.6);
  const muertos = m.grupo('enemigos').map(n => ({ nombre: n.nombre, muerto: n._muerto, clip: d.obj(n).userData.animador.nombre }));
  exigir(j.aguilaObtener('bajas') === 3 && muertos.every(n => n.muerto && n.clip === 'death'), 'Las tres bajas o clips de muerte no coinciden');
  await foto('cqb-despejado'); await ir(0, -9.9); await mirar(0, 1.05, -11.1); await pulsar('KeyF');
  exigir(m.estado === 'ganado', 'El terminal no completa la misión');
  await foto('cqb-victoria');
  await registrar('Recorrido completo: tres enemigos neutralizados, puertas y terminal, victoria por Blueprint', { muertos, saludFinal: j.aguilaObtener('vida') });
  clearInterval(latido);
  return { checks, hitos, personajes, estado: m.estado, bajas: j.aguilaObtener('bajas'), saludFinal: j.aguilaObtener('vida'), segundosSimulados: m.tiempo, segundosReales: (Date.now() - t0) / 1000, errores: m.errores, motor: 'Electron instalado / WebGL / Blueprints → Águila' };
};
