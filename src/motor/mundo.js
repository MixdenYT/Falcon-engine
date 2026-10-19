// El mundo del juego en ejecución: nodos vivos, scripts, física, eventos y API de Águila.

import { crearInterprete, InstanciaScript, aTexto, tipoDe, ErrorAguila, FuncionAguila, analizar } from '../aguila/index.js';
import { compilarBlueprint } from './blueprints.js';
import { tipo as tipoNodo, nombresMiembros } from './tipos.js';
import { normalizarEscena, tipoRecurso, sinExtension, nombreBase } from './proyecto.js';
import { matrizLocal, tamanoNodo, Render2D, CacheImagenes, recorrerConMatriz } from './render2d.js';
import { Entrada } from './entrada.js';
import { Audio } from './audio.js';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sinNumero = (s) => String(s).replace(/\s*\d+$/, '');
let contadorNodos = 0;

// ---------------- Nodo vivo ----------------

export class NodoVivo {
  constructor(mundo, datos, padre) {
    this.mundo = mundo;
    this.datos = datos;
    this.idOrigen = datos.id;
    this.id = ++contadorNodos;
    this.nombre = datos.nombre;
    this.tipo = datos.tipo;
    this.props = structuredClone(datos.props);
    this.visible = datos.visible !== false;
    this.grupos = new Set(datos.grupos || []);
    this.senales = datos.senales || [];
    this.padre = padre;
    this.hijos = [];
    this.scripts = [];
    this.eliminado = false;
    // Física
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.mueveX = 0; this.mueveY = 0; this.mueveZ = 0;
    this.empX = 0; this.empY = 0; this.empZ = 0;
    this.enSuelo = false; this.enPared = false; this.enTecho = false;
    this.contactos = new Set();
    this._metodos = null;
    if (this.tipo === 'Temporizador') { this.restante = this.props.tiempo; this.activo = !!this.props.al_empezar; }
    if (this.tipo === 'Particulas2D') { this._particulas = []; this._acum = 0; }
    if (this.tipo === 'Sprite') { this._cuadro = this.props.cuadro || 0; }
    for (const h of datos.hijos || []) this.hijos.push(new NodoVivo(mundo, h, this));
  }

  get aguilaTipo() { return this.tipo; }
  aguilaTexto() { return `${this.nombre} (${tipoNodo(this.tipo).nombreVisible})`; }
  aguilaContiene(x) { return this.hijos.includes(x); }
  aguilaIterar() { return this.hijos.filter(h => !h.eliminado); }

  es(x) {
    const s = String(x);
    const n = norm(s);
    if (norm(this.nombre) === n || norm(sinNumero(this.nombre)) === n) return true;
    if (norm(this.tipo) === n || norm(tipoNodo(this.tipo).nombreVisible) === n) return true;
    for (const g of this.grupos) if (norm(g) === n) return true;
    for (const sc of this.scripts) if (sc.nombreClase && norm(sc.nombreClase) === n) return true;
    return false;
  }

  hijo(nombre) {
    const n = norm(nombre);
    const buscar = (x) => {
      for (const h of x.hijos) { if (!h.eliminado && norm(h.nombre) === n) return h; }
      for (const h of x.hijos) { const r = buscar(h); if (r) return r; }
      return null;
    };
    return buscar(this);
  }

  metodos() {
    if (this._metodos) return this._metodos;
    const m = this.mundo;
    const yo = this;
    const M = {
      es: (x) => yo.es(x),
      eliminar: () => { m.eliminar(yo); return null; },
      hijo: (n) => yo.hijo(n),
      en_grupo: (g) => yo.grupos.has(g),
      'añadir_a_grupo': (g) => { yo.grupos.add(String(g)); return null; },
      quitar_de_grupo: (g) => { yo.grupos.delete(String(g)); return null; },
      llamar: (f, ...a) => m.llamarFuncion(yo, f, a),
      mover_a: (x, y, z) => { m.fijarPosicion(yo, x, y, z); return null; },
      desplazar: (dx, dy, dz) => { m.desplazar(yo, dx, dy, dz); return null; },
      distancia_a: (o) => m.distancia(yo, o),
      mirar_a: (o) => { const a = m.posicion(yo), b = m.posicion(o); yo.props.rotacion = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; return null; },
      // Personajes
      mover: (vx = 0, vy = null) => {
        if (yo.tipo === 'Personaje3D') { m.d3 && m.d3.moverPersonaje(yo, vx, vy ?? 0); return null; }
        yo.mueveX = Number(vx) || 0;
        if (vy !== null && vy !== undefined) yo.mueveY = Number(vy) || 0;
        return null;
      },
      saltar: (f) => {
        const fuerza = f === undefined || f === null ? yo.props.salto : Number(f);
        if (yo.tipo === 'Personaje3D') yo.vy = fuerza; else yo.vy = -fuerza;
        yo.enSuelo = false;
        m.telemetria('salto');
        return null;
      },
      en_el_suelo: () => yo.enSuelo,
      en_pared: () => yo.enPared,
      en_techo: () => yo.enTecho,
      empujar: (x = 0, y = 0, z = 0) => {
        if (yo.tipo === 'Personaje3D') { yo.empX = x; yo.vy = y; yo.empZ = z; }
        else { yo.empX = Number(x) || 0; if (yo.props.usa_gravedad) yo.vy = Number(y) || 0; else yo.empY = Number(y) || 0; }
        yo.enSuelo = false;
        return null;
      },
      girar: (g) => { if (Array.isArray(yo.props.rotacion)) yo.props.rotacion[1] += Number(g) || 0; else yo.props.rotacion += Number(g) || 0; return null; },
      // Sprites
      animar: (nombre) => { m.animar(yo, nombre); return null; },
      parar_animacion: () => { yo.props.animando = false; return null; },
      // Mosaicos
      poner: (c, f, t = 0) => { yo.props.celdas[`${Math.floor(c)},${Math.floor(f)}`] = t; return null; },
      quitar: (c, f) => { delete yo.props.celdas[`${Math.floor(c)},${Math.floor(f)}`]; return null; },
      hay_mosaico: (c, f) => `${Math.floor(c)},${Math.floor(f)}` in yo.props.celdas,
      // Área
      tocando: () => m.tocandoA(yo),
      // Cámara
      temblar: (f = 8, s = 0.3) => { m.temblar(f, s); return null; },
      // Partículas
      estallar: (n = 30) => { m.estallar(yo, n); return null; },
      // Sonido
      reproducir: () => { m.audio.reproducirNodo(yo); return null; },
      parar: () => { if (yo.tipo === 'Temporizador') yo.activo = false; else m.audio.pararNodo(yo); return null; },
      iniciar: () => { yo.restante = yo.props.tiempo; yo.activo = true; return null; },
    };
    for (const [k, f] of Object.entries(M)) f.nombreAguila = k;
    this._metodos = M;
    return M;
  }

  aguilaObtener(nombre) {
    const m = this.mundo;
    switch (nombre) {
      case 'nombre': return this.nombre;
      case 'visible': return this.visible;
      case 'padre': return this.padre;
      case 'hijos': return this.hijos.filter(h => !h.eliminado);
      case 'grupos': return [...this.grupos];
      case 'tipo': return this.tipo;
      case 'x': return m.posicion(this)[0];
      case 'y': return m.posicion(this)[1];
      case 'z': if (this.tipo.endsWith('3D') || this.tipo === 'Malla3D') return m.posicion(this)[2]; break;
      case 'posicion': return m.posicion(this);
      case 'escala_x': return Array.isArray(this.props.escala) ? this.props.escala[0] : 1;
      case 'escala_y': return Array.isArray(this.props.escala) ? this.props.escala[1] : 1;
      case 'escala_z': return Array.isArray(this.props.escala) ? this.props.escala[2] : 1;
      case 'rotacion_x': return Array.isArray(this.props.rotacion) ? this.props.rotacion[0] : 0;
      case 'rotacion_y': return Array.isArray(this.props.rotacion) ? this.props.rotacion[1] : 0;
      case 'rotacion_z': return Array.isArray(this.props.rotacion) ? this.props.rotacion[2] : 0;
      case 'velocidad_x': return this.tipo === 'Personaje3D' ? this.vx : this.mueveX + this.empX;
      case 'velocidad_y': return this.vy;
      case 'velocidad_z': return this.vz;
      case 'restante': return this.restante ?? 0;
      case 'emitiendo': return !!this.props.emitiendo;
    }
    const met = this.metodos();
    if (Object.prototype.hasOwnProperty.call(met, nombre) && (nombresMiembros(this.tipo).includes(nombre) || ['es', 'eliminar', 'hijo', 'llamar', 'mover_a', 'desplazar', 'distancia_a', 'en_grupo', 'añadir_a_grupo', 'quitar_de_grupo', 'girar'].includes(nombre))) return met[nombre];
    if (Object.prototype.hasOwnProperty.call(this.props, nombre)) {
      const v = this.props[nombre];
      return Array.isArray(v) ? v.slice() : (v !== null && typeof v === 'object') ? undefined : v;
    }
    // Variables y funciones de los scripts del nodo («jugador.monedas»).
    for (const s of this.scripts) if (s.tiene(nombre)) return s.obtener(nombre);
    return undefined;
  }

  aguilaAsignar(nombre, v) {
    const m = this.mundo;
    switch (nombre) {
      case 'nombre': this.nombre = String(v); m.indiceSucio = true; return true;
      case 'visible': this.visible = !!v; return true;
      case 'x': { const p = m.posicion(this); p[0] = Number(v); m.fijarPosicion(this, ...p); return true; }
      case 'y': { const p = m.posicion(this); p[1] = Number(v); m.fijarPosicion(this, ...p); return true; }
      case 'z': if (this.props.posicion && this.props.posicion.length === 3) { const p = m.posicion(this); p[2] = Number(v); m.fijarPosicion(this, ...p); return true; } break;
      case 'posicion': if (Array.isArray(v)) { m.fijarPosicion(this, v[0], v[1], v[2]); return true; } return false;
      case 'escala_x': case 'escala_y': case 'escala_z': {
        const i = { escala_x: 0, escala_y: 1, escala_z: 2 }[nombre];
        if (Array.isArray(this.props.escala)) { this.props.escala[i] = Number(v); return true; }
        return false;
      }
      case 'rotacion_x': case 'rotacion_y': case 'rotacion_z': {
        const i = { rotacion_x: 0, rotacion_y: 1, rotacion_z: 2 }[nombre];
        if (Array.isArray(this.props.rotacion)) { this.props.rotacion[i] = Number(v); return true; }
        return false;
      }
      case 'velocidad_x': this.mueveX = Number(v); return true;
      case 'velocidad_y': this.vy = Number(v); return true;
      case 'emitiendo': this.props.emitiendo = !!v; return true;
      case 'color': this.props.color = String(v); this._color = null; return true;
    }
    if (Object.prototype.hasOwnProperty.call(this.props, nombre)) {
      const actual = this.props[nombre];
      if (typeof actual === 'number' && typeof v !== 'number') { if (Number.isNaN(Number(v))) return false; v = Number(v); }
      if (typeof actual === 'boolean') v = !!v;
      if (typeof actual === 'string' && typeof v !== 'string') v = aTexto(v);
      this.props[nombre] = v;
      if (nombre === 'tiempo' && this.tipo === 'Temporizador') this.restante = v;
      return true;
    }
    for (const s of this.scripts) if (s.asignar(nombre, v)) return true;
    return false;
  }

  aguilaMiembros() {
    return [...nombresMiembros(this.tipo), ...Object.keys(this.props), ...this.scripts.flatMap(s => [...s.entorno.vars.keys()])];
  }
}

// ---------------- Mundo ----------------

export class Mundo {
  /**
   * @param op { proyecto, lienzo, modo: 'prueba'|'exportado', informar(msg), alEstado(estado), alError(err), alMostrar(texto) }
   */
  constructor(op) {
    this.op = op;
    this.proyecto = op.proyecto;
    this.lienzo = op.lienzo;
    this.ctx = null;
    this.informar = op.informar || (() => {});
    this.imagenes = new CacheImagenes(this.proyecto);
    this.render = new Render2D(this.imagenes);
    this.entrada = new Entrada(this.proyecto.datos.acciones, this.proyecto.datos.mando);
    this.audio = null;
    this.raiz = null;
    this.escenaRel = null;
    this.tipoEscena = '2D';
    this.tiempo = 0;
    this.pausado = false;
    this.velocidad = 1;
    this.estado = 'jugando';
    this.pendiente = null;
    this.colaEliminar = [];
    this.temporizadores = [];
    this.pares = new Map();
    this.indice = new Map();
    this.indiceSucio = true;
    this.camara = { x: 0, y: 0, zoom: 1, temblor: 0, tiempoTemblor: 0, dx: 0, dy: 0 };
    this.camaraLibre = null;
    this.textos = new Map();      // rel → código fuente de scripts y blueprints
    this.programas = new Map();   // rel → programa compilado
    this.errores = [];
    this.puntosIniciales = 0;
    this.telemetriaEnviada = new Map();
    this.d3 = null;
    this.mostrarColisiones = false;
    this.resolucion = this.proyecto.datos.resolucion || [1280, 720];
    // Calidad gráfica (3D): «automatica» o un nivel. El jugador puede cambiarla.
    this.calidadOpcion = op.calidad || this.proyecto.datos.calidad_grafica || 'automatica';
    this.preferenciaLumbre = op.lumbre !== false;
    this.calidadNivel = null;
    this.crearInterprete();
  }

  // ---------- Intérprete y API de Águila ----------
  crearInterprete() {
    const m = this;
    const salida = (t) => {
      m.informar({ tipo: 'mostrar', texto: t });
      m.telemetria('mostrar');
      m.op.alMostrar && m.op.alMostrar(t);
      if (m.op.modo === 'exportado') console.log(t);
    };
    this.interp = crearInterprete({
      salida,
      limitePasos: 3_000_000,
      resolverNombre: (nombre) => { const n = m.buscarPorNombre(nombre); return n || undefined; },
    });
    const g = (nombre, fn) => { fn.nombreAguila = nombre; this.interp.definirGlobal(nombre, fn); };
    const e = this.entrada;
    const comprobarAccion = (a) => {
      if (!e.existe(a)) throw Object.assign(new Error(`no existe la acción «${a}».`), { esErrorAguilaNativo: true, explicacion: 'Las acciones se configuran en Proyecto › Ajustes del proyecto › Controles. Existen: ' + Object.keys(e.acciones).join(', ') + '.' });
    };
    g('se_pulsa', (a) => { comprobarAccion(a); return e.pulsa(a); });
    g('se_mantiene', (a) => { comprobarAccion(a); return e.mantiene(a); });
    g('se_suelta', (a) => { comprobarAccion(a); return e.suelta(a); });
    g('eje', (a, b) => { comprobarAccion(a); comprobarAccion(b); return e.eje(a, b); });
    g('raton_x', () => m.ratonMundo()[0]);
    g('raton_y', () => m.ratonMundo()[1]);
    g('raton_pulsado', () => e.raton.pulsado);
    g('ganar_partida', () => { m.terminar('ganado'); return null; });
    g('perder_partida', () => { m.terminar('perdido'); return null; });
    g('ganar_puntos', (n = 1) => { m.interp.globales.vars.set('puntos', (m.interp.globales.vars.get('puntos') || 0) + Number(n)); m.telemetria('puntos'); return null; });
    this.interp.definirGlobal('puntos', 0);
    this.interp.definirGlobal('gravedad', this.proyecto.datos.gravedad ?? 1200);
    g('reiniciar_nivel', () => { m.pendiente = { tipo: 'reiniciar' }; m.telemetria('reinicio'); return null; });
    g('cambiar_escena', (nombre) => { m.pendiente = { tipo: 'escena', nombre: String(nombre) }; return null; });
    g('tiempo', () => m.tiempo);
    g('guardar', (k, v) => { try { localStorage.setItem(m.claveGuardado(k), JSON.stringify(serializar(v))); } catch {} return null; });
    g('cargar', (k, def = null) => { try { const s = localStorage.getItem(m.claveGuardado(k)); return s === null ? def : deserializar(JSON.parse(s)); } catch { return def; } });
    g('temblar_camara', (f = 8, s = 0.3) => { m.temblar(f, s); return null; });
    g('pausar_juego', (si = true) => { m.pausado = !!si; m.informar({ tipo: 'estado', pausado: m.pausado }); return null; });
    g('nodo', (nombre) => m.buscarPorNombre(nombre) || null);
    g('grupo', (nombre) => m.grupo(nombre));
    g('crear', (plantilla, x = 0, y = 0, z = 0) => m.crear(plantilla, x, y, z));
    g('emitir', (senal, datos = null) => { m.emitirSenal(String(senal), datos); return null; });
    g('sonar', (s, v = 1) => { m.audio && m.audio.sonar(s, v); return null; });
    g('musica', (s, v = 1) => { m.audio && m.audio.musica(s, v); return null; });
    g('parar_musica', () => { m.audio && m.audio.pararMusica(); return null; });
    g('despues', (seg, fn) => {
      if (!(fn instanceof FuncionAguila) && typeof fn !== 'function') throw Object.assign(new Error('«despues» necesita una función como segundo dato.'), { esErrorAguilaNativo: true, explicacion: 'Escribe el nombre de una función sin paréntesis, como en despues(2, reaparecer).' });
      m.temporizadores.push({ restante: Number(seg) || 0, fn, archivo: m.interp.archivoActual });
      return null;
    });
    g('calidad_grafica', (nivel) => {
      if (nivel !== undefined && nivel !== null) {
        const n = String(nivel).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (!['automatica', 'baja', 'media', 'alta', 'ultra'].includes(n)) throw Object.assign(new Error(`«${nivel}» no es una calidad gráfica.`), { esErrorAguilaNativo: true, explicacion: 'Usa "automatica", "baja", "media", "alta" o "ultra".' });
        m.fijarCalidad(n);
      }
      return m.calidadNivel || 'baja';
    });
    g('distancia', (a, b, c, d) => {
      if (typeof a === 'number') return Math.hypot(c - a, d - b);
      return m.distancia(a, b);
    });
  }

  fijarCalidad(opcion) {
    this.calidadOpcion = opcion;
    if (this.d3) this.d3.aplicarCalidad();
  }

  // Lumbre se puede apagar en los ajustes del proyecto y, si el proyecto la usa, también el jugador (F10).
  get lumbrePermitida() { return this.proyecto.datos.lumbre !== false; }
  get lumbreActivada() { return this.lumbrePermitida && this.preferenciaLumbre !== false; }
  fijarLumbre(si) {
    this.preferenciaLumbre = !!si;
    if (this.d3) this.d3.aplicarCalidad();
  }

  claveGuardado(k) { return 'falcon:' + (this.proyecto.datos.nombre || 'juego') + ':' + k; }

  telemetria(evento) {
    if (this.op.modo !== 'prueba') return;
    const ahora = performance.now();
    if ((this.telemetriaEnviada.get(evento) || 0) > ahora - 400) return;
    this.telemetriaEnviada.set(evento, ahora);
    this.informar({ tipo: 'evento', nombre: evento });
  }

  // ---------- Carga ----------
  async iniciar() {
    const archivos = await this.proyecto.listar('', true);
    this.archivos = archivos.filter(a => !a.carpeta).map(a => a.rel.replace(/\\/g, '/'));
    this.audio = new Audio(this.proyecto, this.archivos.filter(a => tipoRecurso(a) === 'sonido'));
    // Textos de scripts y blueprints.
    await Promise.all(this.archivos.filter(a => /\.(agl|bp|fscn)$/i.test(a)).map(async (a) => {
      try { this.textos.set(a, await this.proyecto.leer(a)); } catch {}
    }));
    this.audio.precargar();
    const imgs = this.archivos.filter(a => tipoRecurso(a) === 'imagen');
    await this.imagenes.precargar(imgs);
    this.entrada.conectar(window, this.lienzo);
  }

  programaDe(rel) {
    if (this.programas.has(rel)) return this.programas.get(rel);
    let fuente = this.textos.get(rel);
    let archivo = rel;
    if (fuente === undefined) throw new ErrorAguila(`no se encuentra el archivo «${rel}».`, { archivo: rel, explicacion: 'Puede que se haya movido o borrado. Revisa la lógica del nodo en el Inspector.' });
    if (rel.endsWith('.bp')) {
      const bp = JSON.parse(fuente);
      const r = compilarBlueprint(bp, nombreBase(rel));
      if (r.errores.length) throw new ErrorAguila(r.errores[0].mensaje, { archivo: rel, explicacion: 'Revisa las conexiones del Blueprint.' });
      fuente = r.codigo;
      archivo = 'generado/' + sinExtension(rel) + '.agl';
    }
    const { programa, errores } = analizar(fuente, archivo);
    if (errores.length) { errores[0].archivo = archivo; throw errores[0]; }
    this.programas.set(rel, programa);
    return programa;
  }

  resolverEscena(nombre) {
    const n = String(nombre).replace(/\\/g, '/');
    if (this.archivos.includes(n)) return n;
    const bajo = norm(n.replace(/\.fscn$/i, ''));
    return this.archivos.find(a => a.endsWith('.fscn') && (norm(a.replace(/\.fscn$/i, '')) === bajo || norm(sinExtension(a)) === bajo)) || null;
  }

  async cargarEscena(rel) {
    const datos = await this.proyecto.leerEscena(rel);
    this.escenaRel = rel;
    this.tipoEscena = datos.tipo;
    this.datosEscena = datos;
    this.limpiarEscena();
    this.raiz = new NodoVivo(this, datos.raiz, null);
    this.indiceSucio = true;
    this.tiempo = 0;
    this.estado = 'jugando';
    this.pares = new Map();
    this.temporizadores = [];
    this.puntosIniciales = this.interp.globales.vars.get('puntos') || 0;
    if (this.tipoEscena === '3D') {
      const { Mundo3D } = await import('./mundo3d.js');
      this.d3 = new Mundo3D(this);
      await this.d3.construir();
    } else {
      this.d3 = null;
      if (!this.ctx) this.ctx = this.lienzo.getContext('2d');
    }
    this.iniciarScripts(this.raiz);
    this.colocarCamaraInicial();
    this.informar({ tipo: 'escena', escena: rel, tipoEscena: this.tipoEscena });
  }

  limpiarEscena() {
    if (this.d3) { this.d3.destruir(); this.d3 = null; }
    if (this.audio) {
      const visitar = (n) => { this.audio.pararNodo(n); n.hijos.forEach(visitar); };
      if (this.raiz) visitar(this.raiz);
    }
  }

  iniciarScripts(raiz) {
    const nuevos = [];
    const visitar = (n) => {
      for (const rel of [n.datos.blueprint, n.datos.script]) {
        if (!rel) continue;
        try {
          const prog = this.programaDe(rel);
          const archivo = rel.endsWith('.bp') ? 'generado/' + sinExtension(rel) + '.agl' : rel;
          const inst = new InstanciaScript(this.interp, prog, n, archivo);
          inst.rel = rel;
          inst.iniciar(n.datos.exportados || {});
          n.scripts.push(inst);
        } catch (e) { this.reportarError(e, n); }
      }
      if (n.tipo === 'Sonido' && n.props.al_empezar) this.audio.reproducirNodo(n);
      nuevos.push(n);
      n.hijos.forEach(visitar);
    };
    visitar(raiz);
    for (const n of nuevos) this.emitirNodo(n, 'empieza', []);
  }

  reportarError(e, nodo) {
    const err = e instanceof ErrorAguila ? e : new ErrorAguila(String(e && e.message || e), { fase: 'ejecucion' });
    const o = err.aObjeto();
    o.nodo = nodo ? nodo.nombre : null;
    const clave = o.archivo + ':' + o.linea + ':' + o.mensaje;
    if (this.errores.some(x => x.clave === clave)) return;
    this.errores.push({ ...o, clave });
    console.warn('[Águila]', o.archivo, o.linea, o.mensaje);
    this.informar({ tipo: 'error', error: o });
    this.op.alError && this.op.alError(o);
  }

  // ---------- Búsquedas ----------
  reconstruirIndice() {
    this.indice = new Map();
    const visitar = (n) => {
      if (n.eliminado) return;
      const k = norm(n.nombre);
      if (!this.indice.has(k)) this.indice.set(k, n);
      n.hijos.forEach(visitar);
    };
    if (this.raiz) visitar(this.raiz);
    this.indiceSucio = false;
  }

  buscarPorNombre(nombre) {
    if (typeof nombre !== 'string') return null;
    if (this.indiceSucio) this.reconstruirIndice();
    const n = this.indice.get(norm(nombre));
    return n && !n.eliminado ? n : null;
  }

  grupo(nombre) {
    const r = [];
    const visitar = (n) => { if (n.eliminado) return; if (n.grupos.has(nombre)) r.push(n); n.hijos.forEach(visitar); };
    if (this.raiz) visitar(this.raiz);
    return r;
  }

  todos() {
    const r = [];
    const visitar = (n) => { if (n.eliminado) return; r.push(n); n.hijos.forEach(visitar); };
    if (this.raiz) visitar(this.raiz);
    return r;
  }

  llamarFuncion(nodo, nombre, args) {
    for (const s of nodo.scripts) {
      if (s.tiene(nombre)) {
        const f = s.obtener(nombre);
        if (f instanceof FuncionAguila) return this.interp.llamarValor(f, args, null);
      }
    }
    throw Object.assign(new Error(`${nodo.nombre} no tiene ninguna función «${nombre}».`), { esErrorAguilaNativo: true });
  }

  // ---------- Posiciones (2D y 3D) ----------
  matrizPadre(n) {
    const cadena = [];
    for (let p = n.padre; p; p = p.padre) cadena.push(p);
    let m = new DOMMatrix();
    for (let i = cadena.length - 1; i >= 0; i--) {
      const p = cadena[i];
      if (p.tipo !== 'Fondo' && p.tipo !== 'Interfaz') m = m.multiply(matrizLocal(p));
    }
    return m;
  }

  posicion(n) {
    if (this.d3 && Array.isArray(n.props.posicion) && n.props.posicion.length === 3) return this.d3.posicionGlobal(n);
    const p = n.props.posicion || [0, 0];
    const g = this.matrizPadre(n).transformPoint(new DOMPoint(p[0], p[1]));
    return [g.x, g.y];
  }

  fijarPosicion(n, x, y, z) {
    if (this.d3 && Array.isArray(n.props.posicion) && n.props.posicion.length === 3) { this.d3.fijarPosicionGlobal(n, Number(x), Number(y), Number(z ?? n.props.posicion[2])); return; }
    const inv = this.matrizPadre(n).inverse();
    const l = inv.transformPoint(new DOMPoint(Number(x) || 0, Number(y) || 0));
    n.props.posicion = [l.x, l.y];
  }

  desplazar(n, dx = 0, dy = 0, dz = 0) {
    const p = n.props.posicion;
    if (!p) return;
    p[0] += Number(dx) || 0; p[1] += Number(dy) || 0;
    if (p.length === 3) p[2] += Number(dz) || 0;
  }

  distancia(a, b) {
    if (!a || !b) return Infinity;
    const pa = this.posicion(a), pb = this.posicion(b);
    return Math.hypot(pb[0] - pa[0], pb[1] - pa[1], (pb[2] || 0) - (pa[2] || 0));
  }

  // Caja de colisión 2D en coordenadas de mundo: [cx, cy, ancho, alto]
  caja(n) {
    const m = this.matrizPadre(n).multiply(matrizLocal(n));
    const col = n.hijos.find(h => h.tipo === 'Colision' && !h.eliminado);
    const sx = Math.abs(m.a) || 1, sy = Math.abs(m.d) || 1;
    if (col) {
      const o = col.props.posicion || [0, 0];
      const c = m.transformPoint(new DOMPoint(o[0], o[1]));
      return [c.x, c.y, col.props.ancho * sx, col.props.alto * sy];
    }
    let t = tamanoNodo(n);
    if (!t) { const s = n.hijos.find(h => h.tipo === 'Sprite'); t = s ? [s.props.ancho, s.props.alto] : [32, 32]; }
    return [m.e, m.f, t[0] * sx, t[1] * sy];
  }

  // ---------- Bucle ----------
  paso(dtReal) {
    const dt = Math.min(dtReal, 1 / 20) * this.velocidad;
    this.dtPaso = dt;
    this.entrada.actualizar();
    if (this.pausado || this.estado !== 'jugando') { this.dibujar(); return; }
    this.tiempo += dt;
    this.render.tiempo = this.tiempo;
    const nodos = this.todos();

    // Entrada → eventos
    for (const a of this.entrada.pulsadasAhora()) for (const n of nodos) this.emitirNodo(n, 'se_pulsa', [a]);
    for (const a of this.entrada.soltadasAhora()) for (const n of nodos) this.emitirNodo(n, 'se_suelta', [a]);
    if (this.entrada.raton.clic) this.clicEn(nodos);
    this.hoverBotones(nodos);

    // Controles listos para usar
    for (const n of nodos) this.controlesIntegrados(n);

    // Lógica
    for (const n of nodos) this.emitirNodo(n, 'se_actualiza', [dt]);
    for (const n of nodos) for (const s of n.scripts) { const e = s.actualizarCorrutinas(dt); if (e) this.reportarError(e, n); }
    this.actualizarTemporizadores(dt, nodos);

    // Física y contactos
    if (this.d3) { this.d3.fisica(dt); this.d3.contactos(); }
    else { this.fisica2d(dt, nodos); this.contactos2d(nodos); }

    // Animación y efectos
    for (const n of nodos) {
      if (n.tipo === 'Sprite' && n.props.animando) this.avanzarAnimacion(n, dt);
      if (n.tipo === 'Particulas2D') this.actualizarParticulas(n, dt);
    }
    this.procesarEliminados();
    this.actualizarCamara(dt);
    this.dibujar();
    if (this.pendiente) this.procesarPendiente();
  }

  emitirNodo(n, evento, args) {
    if (n.eliminado) return;
    for (const s of n.scripts) {
      if (!s.tieneEvento(evento)) continue;
      const e = s.emitir(evento, args);
      if (e) this.reportarError(e, n);
    }
    // Conexiones de la pestaña Señales.
    if (n.senales.length) {
      for (const c of n.senales) {
        if (c.evento !== evento) continue;
        const destino = c.destino ? this.buscarPorNombre(c.destino) : n;
        if (!destino) continue;
        try { this.llamarFuncion(destino, c.funcion, evento === 'toca' || evento === 'deja_de_tocar' ? args : []); }
        catch (e) { this.reportarError(e, destino); }
      }
    }
  }

  emitirSenal(senal, datos) {
    for (const n of this.todos()) this.emitirNodo(n, 'recibe', [senal, datos]);
  }

  controlesIntegrados(n) {
    const c = n.props.controles;
    if (!c || c === 'ninguno') return;
    const e = this.entrada;
    if (n.tipo === 'Personaje2D') {
      const dx = e.eje('izquierda', 'derecha');
      if (c === 'plataformas') {
        n.mueveX = dx * n.props.velocidad;
      } else if (c === 'vista_superior') {
        const dy = e.eje('arriba', 'abajo');
        const l = Math.hypot(dx, dy) || 1;
        n.mueveX = dx / Math.max(1, l) * n.props.velocidad;
        n.mueveY = dy / Math.max(1, l) * n.props.velocidad;
      }
      if (dx) {
        this.telemetria('andar');
        const s = n.hijos.find(h => h.tipo === 'Sprite');
        if (s) { s.props.voltear_h = dx < 0; if (!s.props.animando) { s._animAuto = true; s.props.animando = true; } }
      } else {
        const s = n.hijos.find(h => h.tipo === 'Sprite');
        if (s && s._animAuto) { s.props.animando = false; s._cuadro = 0; }
      }
    } else if (n.tipo === 'Personaje3D' && (c === 'tercera_persona' || c === 'primera_persona') && this.d3) {
      this.d3.controlPersonaje(n);
    }
  }

  actualizarTemporizadores(dt, nodos) {
    if (this.temporizadores.length) {
      const lista = this.temporizadores;
      this.temporizadores = [];
      for (const t of lista) {
        t.restante -= dt;
        if (t.restante > 0) { this.temporizadores.push(t); continue; }
        try { this.interp.archivoActual = t.archivo; this.interp.pasos = 0; this.interp.llamarValor(t.fn, [], null); }
        catch (e) { this.reportarError(e, null); }
      }
    }
    for (const n of nodos) {
      if (n.tipo !== 'Temporizador' || !n.activo) continue;
      n.restante -= dt;
      if (n.restante <= 0) {
        if (n.props.repetir) n.restante += n.props.tiempo; else n.activo = false;
        this.emitirNodo(n, 'termina', []);
      }
    }
  }

  // ---------- Física 2D ----------
  solidos2d(nodos) {
    const lista = [];
    for (const n of nodos) {
      if (n.tipo === 'Plataforma' && n.props.solido && n.visible !== false) {
        const [cx, cy, w, h] = this.caja(n);
        const prev = n._cajaPrev;
        n._delta = prev ? [cx - prev[0], cy - prev[1]] : [0, 0];
        n._cajaPrev = [cx, cy];
        lista.push({ n, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, unaCara: !!n.props.solo_arriba });
      }
    }
    return lista;
  }

  celdasSolidas(nodos, x0, y0, x1, y1, salida) {
    for (const n of this.mosaicosSolidos) {
      const T = n.props.tam_celda;
      const m = this.matrizPadre(n).multiply(matrizLocal(n));
      const ox = m.e, oy = m.f;
      const c0 = Math.floor((x0 - ox) / T), c1 = Math.floor((x1 - ox - 0.0001) / T);
      const f0 = Math.floor((y0 - oy) / T), f1 = Math.floor((y1 - oy - 0.0001) / T);
      for (let c = c0; c <= c1; c++) for (let f = f0; f <= f1; f++) {
        if (`${c},${f}` in n.props.celdas) salida.push({ n, x0: ox + c * T, y0: oy + f * T, x1: ox + (c + 1) * T, y1: oy + (f + 1) * T });
      }
    }
  }

  fisica2d(dt, nodos) {
    const solidos = this.solidos2d(nodos);
    this.mosaicosSolidos = nodos.filter(n => n.tipo === 'Mosaicos' && n.props.solido);
    const g = this.interp.globales.vars.get('gravedad');
    const escalaG = (this.proyecto.datos.gravedad || 1200) ? g / (this.proyecto.datos.gravedad || 1200) : 1;
    const choques = (x0, y0, x1, y1) => {
      const r = [];
      for (const s of solidos) if (x1 > s.x0 && x0 < s.x1 && y1 > s.y0 && y0 < s.y1) r.push(s);
      this.celdasSolidas(nodos, x0, y0, x1, y1, r);
      return r;
    };
    for (const n of nodos) {
      if (n.tipo !== 'Personaje2D') continue;
      const [cx0, cy0, w, h] = this.caja(n);
      let cx = cx0, cy = cy0;
      const antes = { suelo: n.enSuelo, nodoSuelo: n._nodoSuelo };
      n.enPared = false; n.enTecho = false;
      const contactos = new Set();
      // Plataforma móvil: arrastra al personaje que está encima.
      if (antes.suelo && antes.nodoSuelo && antes.nodoSuelo._delta) { cx += antes.nodoSuelo._delta[0]; cy += antes.nodoSuelo._delta[1]; }
      // Horizontal
      n.empX *= Math.pow(0.02, dt);
      if (Math.abs(n.empX) < 1) n.empX = 0;
      const dx = (n.mueveX + n.empX) * dt;
      if (dx) {
        cx += dx;
        for (const s of choques(cx - w / 2, cy - h / 2 + 0.5, cx + w / 2, cy + h / 2 - 0.5)) {
          if (s.unaCara) continue;
          if (dx > 0) cx = Math.min(cx, s.x0 - w / 2); else cx = Math.max(cx, s.x1 + w / 2);
          n.enPared = true; n.empX = 0;
          contactos.add(s.n);
        }
      }
      // Vertical
      let vyTotal;
      if (n.props.usa_gravedad) {
        n.vy += (n.props.gravedad ?? 1200) * escalaG * dt;
        n.vy = Math.min(n.vy, 2400);
        vyTotal = n.vy;
      } else {
        n.empY *= Math.pow(0.02, dt);
        if (Math.abs(n.empY) < 1) n.empY = 0;
        vyTotal = n.mueveY + n.empY;
      }
      const dy = vyTotal * dt;
      const fondoAntes = cy + h / 2;
      cy += dy;
      n.enSuelo = false; n._nodoSuelo = null;
      for (const s of choques(cx - w / 2 + 0.5, cy - h / 2, cx + w / 2 - 0.5, cy + h / 2)) {
        if (dy >= 0) {
          if (s.unaCara && fondoAntes > s.y0 + 0.5) continue;
          cy = Math.min(cy, s.y0 - h / 2);
          if (n.props.usa_gravedad) n.vy = 0;
          n.enSuelo = true; n._nodoSuelo = s.n;
        } else {
          if (s.unaCara) continue;
          cy = Math.max(cy, s.y1 + h / 2);
          if (n.props.usa_gravedad) n.vy = Math.max(0, n.vy);
          n.enTecho = true;
        }
        contactos.add(s.n);
      }
      if (!n.props.usa_gravedad) n.enSuelo = true;
      // Aplicar desplazamiento a la posición local.
      const p = n.props.posicion;
      const m = this.matrizPadre(n);
      const sx = Math.abs(m.a) || 1, sy = Math.abs(m.d) || 1;
      p[0] += (cx - cx0) / sx; p[1] += (cy - cy0) / sy;
      n.mueveX = 0; n.mueveY = 0;
      n._contactosSolidos = contactos;
    }
  }

  contactos2d(nodos) {
    const participantes = [];
    for (const n of nodos) {
      if (n.visible === false && n.tipo !== 'Area2D') continue;
      const relevante = n.tipo === 'Area2D' || n.tipo === 'Personaje2D' || (n.scripts.length && (n.tipo === 'Sprite' || n.tipo === 'Plataforma'));
      if (!relevante) continue;
      const [cx, cy, w, h] = this.caja(n);
      participantes.push({ n, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    }
    const actuales = new Map();
    const clave = (a, b) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    for (let i = 0; i < participantes.length; i++) {
      const a = participantes[i];
      for (let j = i + 1; j < participantes.length; j++) {
        const b = participantes[j];
        if (a.n.tipo !== 'Personaje2D' && b.n.tipo !== 'Personaje2D' && a.n.tipo !== 'Area2D' && b.n.tipo !== 'Area2D') continue;
        if (esAncestro(a.n, b.n) || esAncestro(b.n, a.n)) continue;
        if (a.n.tipo === 'Area2D' && a.n.props.vigilar === 'personajes' && b.n.tipo !== 'Personaje2D') continue;
        if (b.n.tipo === 'Area2D' && b.n.props.vigilar === 'personajes' && a.n.tipo !== 'Personaje2D') continue;
        if (a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1) actuales.set(clave(a.n, b.n), [a.n, b.n]);
      }
    }
    // Contactos de personajes con sólidos que tienen scripts.
    for (const n of nodos) {
      if (n.tipo !== 'Personaje2D' || !n._contactosSolidos) continue;
      for (const s of n._contactosSolidos) if (s.scripts.length || n.scripts.length) actuales.set(clave(n, s), [n, s]);
    }
    for (const [k, [a, b]] of actuales) {
      if (!this.pares.has(k)) {
        this.emitirNodo(a, 'toca', [b]);
        this.emitirNodo(b, 'toca', [a]);
      }
    }
    for (const [k, [a, b]] of this.pares) {
      if (!actuales.has(k)) {
        if (!a.eliminado) this.emitirNodo(a, 'deja_de_tocar', [b]);
        if (!b.eliminado) this.emitirNodo(b, 'deja_de_tocar', [a]);
      }
    }
    this.pares = actuales;
  }

  tocandoA(n) {
    const r = [];
    for (const [a, b] of this.pares.values()) { if (a === n) r.push(b); else if (b === n) r.push(a); }
    return r;
  }

  // ---------- Clics ----------
  clicEn(nodos) {
    const [mx, my] = this.ratonPantalla();
    // Botones de interfaz (de arriba abajo).
    for (let i = nodos.length - 1; i >= 0; i--) {
      const n = nodos[i];
      if ((n.tipo === 'Boton' || n.tipo === 'PanelUI' || n.tipo === 'Etiqueta') && n._limites && n.visible) {
        const [x, y, w, h] = n._limites;
        if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
          if (n.tipo === 'Boton' || n.scripts.length) {
            this.emitirNodo(n, 'hace_clic', []);
            if (n.tipo === 'Boton' && n.props.escena) this.pendiente = { tipo: 'escena', nombre: n.props.escena };
            if (this.audio) this.audio.contexto();
            return;
          }
        }
      }
    }
    if (this.d3) { this.d3.clic(); return; }
    const [wx, wy] = this.ratonMundo();
    for (let i = nodos.length - 1; i >= 0; i--) {
      const n = nodos[i];
      if (!n.scripts.some(s => s.tieneEvento('hace_clic'))) continue;
      const [cx, cy, w, h] = this.caja(n);
      if (Math.abs(wx - cx) <= w / 2 && Math.abs(wy - cy) <= h / 2) { this.emitirNodo(n, 'hace_clic', []); return; }
    }
  }

  hoverBotones(nodos) {
    const [mx, my] = this.ratonPantalla();
    let cursor = 'default';
    for (const n of nodos) {
      if (n.tipo !== 'Boton' || !n._limites) continue;
      const [x, y, w, h] = n._limites;
      n._hover = mx >= x && mx <= x + w && my >= y && my <= y + h;
      if (n._hover) cursor = 'pointer';
    }
    if (this.lienzo.style.cursor !== cursor && !this.camaraLibre) this.lienzo.style.cursor = cursor;
  }

  ratonPantalla() {
    const v = this.vista;
    if (!v) return [0, 0];
    const r = this.entrada.raton;
    return [((r.px || 0) * this.dpr - v.ox) / v.escala, ((r.py || 0) * this.dpr - v.oy) / v.escala];
  }

  ratonMundo() {
    const [sx, sy] = this.ratonPantalla();
    if (this.d3) return this.d3.ratonMundo(sx, sy);
    const cam = this.camaraEfectiva();
    return [cam.x + (sx - this.resolucion[0] / 2) / cam.zoom, cam.y + (sy - this.resolucion[1] / 2) / cam.zoom];
  }

  // ---------- Animación, partículas ----------
  animar(n, nombre) {
    const a = this.proyecto.ajustesImportacion(n.props.imagen || '');
    const anims = { ...(a.animaciones || {}), ...(n.props.animaciones || {}) };
    const r = anims[nombre];
    if (!r) throw Object.assign(new Error(`el sprite no tiene una animación llamada «${nombre}».`), { esErrorAguilaNativo: true, explicacion: 'Las animaciones se definen en el panel Animación del editor. Hay: ' + (Object.keys(anims).join(', ') || 'ninguna') + '.' });
    if (n._anim && n._anim[0] === r[0] && n._anim[1] === r[1] && n.props.animando) return;
    n._anim = r;
    n._cuadro = r[0];
    n.props.animando = true;
    n._animAuto = false;
  }

  avanzarAnimacion(n, dt) {
    const e = n.props.imagen ? this.imagenes.obtener(n.props.imagen) : null;
    const total = e ? e.columnas * e.filas : 1;
    const [ini, fin] = n._anim || [0, total - 1];
    n._cuadro = (n._cuadro ?? ini) + (n.props.fps || 8) * dt;
    if (n._cuadro >= fin + 1) {
      n._cuadro = ini + ((n._cuadro - ini) % (fin - ini + 1));
      if (n._anim) this.emitirNodo(n, 'termina', []);
    }
  }

  actualizarParticulas(n, dt) {
    const p = n.props;
    if (p.emitiendo && p.cantidad > 0) {
      n._acum += p.cantidad * dt;
      const k = Math.floor(n._acum);
      n._acum -= k;
      if (k) this.estallar(n, k);
    }
    const g = p.gravedad_p || 0;
    const vivas = [];
    for (const q of n._particulas) {
      q.vida -= dt;
      if (q.vida <= 0) continue;
      q.vy += g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      vivas.push(q);
    }
    n._particulas = vivas;
  }

  estallar(n, cantidad) {
    const p = n.props;
    const [x, y] = this.posicion(n);
    for (let i = 0; i < Math.min(cantidad, 800); i++) {
      const a = ((p.direccion || 0) + (Math.random() - 0.5) * (p.dispersion ?? 360)) * Math.PI / 180;
      const v = (p.velocidad || 100) * (0.5 + Math.random() * 0.7);
      n._particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: p.vida * (0.6 + Math.random() * 0.4), max: p.vida });
    }
  }

  // ---------- Creación y borrado ----------
  eliminar(n) {
    if (n.eliminado) return;
    const marcar = (x) => { x.eliminado = true; x.hijos.forEach(marcar); };
    marcar(n);
    this.colaEliminar.push(n);
    this.indiceSucio = true;
  }

  procesarEliminados() {
    if (!this.colaEliminar.length) return;
    const lista = this.colaEliminar;
    this.colaEliminar = [];
    for (const n of lista) {
      const avisar = (x) => { for (const s of x.scripts) if (s.tieneEvento('se_elimina')) { const e = s.emitir('se_elimina', []); if (e) this.reportarError(e, x); } this.audio.pararNodo(x); x.hijos.forEach(avisar); };
      avisar(n);
      if (n.padre) n.padre.hijos = n.padre.hijos.filter(h => h !== n);
      if (this.d3) this.d3.quitar(n);
    }
    for (const [k, [a, b]] of this.pares) if (a.eliminado || b.eliminado) this.pares.delete(k);
  }

  crear(plantilla, x, y, z) {
    let datos = null;
    const escena = typeof plantilla === 'string' ? this.resolverEscena(plantilla) : null;
    let padre = this.raiz;
    if (escena && this.textos.has(escena)) {
      const e = normalizarEscena(this.textos.get(escena));
      const nuevo = new NodoVivo(this, e.raiz, padre);
      padre.hijos.push(nuevo);
      this.fijarPosicion(nuevo, x, y, z);
      this.indiceSucio = true;
      if (this.d3) this.d3.anadir(nuevo);
      this.iniciarScripts(nuevo);
      return nuevo;
    }
    const origen = plantilla instanceof NodoVivo ? plantilla : this.buscarPorNombre(String(plantilla)) || this.buscarDatosPorNombre(String(plantilla));
    if (!origen) throw Object.assign(new Error(`no encuentro ningún nodo llamado «${plantilla}» para copiarlo.`), { esErrorAguilaNativo: true, explicacion: 'crear() copia un nodo que ya exista en la escena. Puedes tener uno escondido (visible = falso) para usarlo de plantilla.' });
    datos = origen instanceof NodoVivo ? origen.datos : origen;
    if (origen instanceof NodoVivo && origen.padre) padre = origen.padre;
    const copia = structuredClone(datos);
    const nuevo = new NodoVivo(this, copia, padre);
    nuevo.visible = true;
    padre.hijos.push(nuevo);
    this.fijarPosicion(nuevo, x, y, z);
    this.indiceSucio = true;
    if (this.d3) this.d3.anadir(nuevo);
    this.iniciarScripts(nuevo);
    return nuevo;
  }

  buscarDatosPorNombre(nombre) {
    let r = null;
    const n = norm(nombre);
    const visitar = (d) => { if (r) return; if (norm(d.nombre) === n) { r = d; return; } (d.hijos || []).forEach(visitar); };
    if (this.datosEscena) visitar(this.datosEscena.raiz);
    return r;
  }

  // ---------- Fin de partida, reinicio, escenas ----------
  terminar(estado) {
    if (this.estado !== 'jugando') return;
    this.estado = estado;
    this.telemetria(estado === 'ganado' ? 'ganar' : 'perder');
    this.informar({ tipo: 'fin', estado, puntos: this.interp.globales.vars.get('puntos') });
    this.op.alEstado && this.op.alEstado(estado);
  }

  async procesarPendiente() {
    const p = this.pendiente;
    this.pendiente = null;
    if (p.tipo === 'reiniciar') await this.reiniciar();
    else if (p.tipo === 'escena') {
      const rel = this.resolverEscena(p.nombre);
      if (!rel) { this.reportarError(new ErrorAguila(`no existe ninguna escena llamada «${p.nombre}».`, { explicacion: 'Las escenas están en la carpeta escenas/ y terminan en .fscn.' })); return; }
      await this.cargarEscena(rel);
    }
  }

  async reiniciar() {
    this.interp.globales.vars.set('puntos', this.puntosIniciales);
    await this.cargarEscena(this.escenaRel);
    this.op.alEstado && this.op.alEstado('jugando');
  }

  // ---------- Cámara ----------
  colocarCamaraInicial() {
    const c = this.camaraEfectiva(true);
    this.camara.x = c.objetivoX; this.camara.y = c.objetivoY;
  }

  camaraActiva() {
    let r = null;
    const visitar = (n) => { if (r || n.eliminado) return; if (n.tipo === 'Camara2D' && n.props.actual) { r = n; return; } n.hijos.forEach(visitar); };
    if (this.raiz) visitar(this.raiz);
    return r;
  }

  camaraEfectiva(calcular = false) {
    const cam = this.camaraActiva();
    const [W, H] = this.resolucion;
    let tx = W / 2, ty = H / 2, zoom = 1;
    if (cam) {
      zoom = cam.props.zoom || 1;
      const seguido = cam.props.seguir ? this.buscarPorNombre(cam.props.seguir) : null;
      if (seguido) {
        const p = this.posicion(seguido);
        tx = p[0] + cam.props.posicion[0]; ty = p[1] + cam.props.posicion[1];
      } else {
        const p = this.posicion(cam);
        tx = p[0]; ty = p[1];
      }
      if (cam.props.limitar) {
        const [l, t, r, b] = cam.props.limites;
        const mw = W / 2 / zoom, mh = H / 2 / zoom;
        tx = r - l < mw * 2 ? (l + r) / 2 : Math.max(l + mw, Math.min(r - mw, tx));
        ty = b - t < mh * 2 ? (t + b) / 2 : Math.max(t + mh, Math.min(b - mh, ty));
      }
    }
    if (calcular) return { objetivoX: tx, objetivoY: ty, zoom, cam };
    const base = this.camaraLibre || this.camara;
    return { x: base.x + this.camara.dx, y: base.y + this.camara.dy, zoom: this.camaraLibre ? this.camaraLibre.zoom : zoom };
  }

  actualizarCamara(dt) {
    if (this.d3) return;
    const c = this.camaraEfectiva(true);
    const suav = c.cam ? c.cam.props.suavizado ?? 0.15 : 0;
    const k = suav <= 0 ? 1 : 1 - Math.pow(suav * 0.5, dt * 6);
    this.camara.x += (c.objetivoX - this.camara.x) * k;
    this.camara.y += (c.objetivoY - this.camara.y) * k;
    this.camara.zoom = c.zoom;
    if (this.camara.tiempoTemblor > 0) {
      this.camara.tiempoTemblor -= dt;
      const f = this.camara.temblor * Math.max(0, this.camara.tiempoTemblor / this.camara.duracionTemblor);
      this.camara.dx = (Math.random() * 2 - 1) * f; this.camara.dy = (Math.random() * 2 - 1) * f;
    } else { this.camara.dx = 0; this.camara.dy = 0; }
  }

  temblar(fuerza, seg) {
    this.camara.temblor = Number(fuerza) || 0;
    this.camara.tiempoTemblor = this.camara.duracionTemblor = Math.max(0.01, Number(seg) || 0.3);
  }

  // ---------- Dibujo ----------
  ajustarLienzo() {
    const dpr = window.devicePixelRatio || 1;
    const ancho = this.lienzo.clientWidth, alto = this.lienzo.clientHeight;
    if (this.lienzo.width !== Math.round(ancho * dpr) || this.lienzo.height !== Math.round(alto * dpr)) {
      this.lienzo.width = Math.round(ancho * dpr);
      this.lienzo.height = Math.round(alto * dpr);
    }
    this.dpr = dpr;
    const [W, H] = this.resolucion;
    const escala = Math.min(this.lienzo.width / W, this.lienzo.height / H);
    this.vista = { ancho: W, alto: H, escala, ox: (this.lienzo.width - W * escala) / 2, oy: (this.lienzo.height - H * escala) / 2 };
  }

  dibujar() {
    if (!this.raiz) return;
    this.ajustarLienzo();
    if (this.d3) { this.d3.dibujar(); return; }
    const c = this.ctx;
    const v = this.vista;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.lienzo.width, this.lienzo.height);
    c.save();
    c.translate(v.ox, v.oy);
    c.beginPath(); c.rect(0, 0, v.ancho * v.escala, v.alto * v.escala); c.clip();
    c.fillStyle = this.proyecto.datos.fondo || '#0B0F0D';
    c.fillRect(0, 0, v.ancho * v.escala, v.alto * v.escala);
    const cam = this.camaraEfectiva();
    const vistaDesplazada = { ancho: v.ancho, alto: v.alto, escala: v.escala };
    // Render2D usa setTransform: añadimos el desplazamiento del recuadro.
    const ctxProxy = desplazado(c, v.ox, v.oy);
    this.render.dibujarMundo(ctxProxy, this.raiz, cam, vistaDesplazada, { mostrarColisiones: this.mostrarColisiones, limitesVista: [this.lienzo.width, this.lienzo.height] });
    this.render.dibujarInterfaz(ctxProxy, this.raiz, vistaDesplazada, {});
    c.restore();
  }

  // ---------- Desde el editor (valores en vivo) ----------
  nodosConOrigen(id) { return this.todos().filter(n => n.idOrigen === id); }

  aplicarPropiedad(id, clave, valor) {
    for (const n of this.nodosConOrigen(id)) {
      if (clave === 'nombre') { n.nombre = valor; this.indiceSucio = true; }
      else if (clave === 'visible') n.visible = valor;
      else n.props[clave] = structuredClone(valor);
      if (this.d3) this.d3.actualizarNodo(n, clave);
    }
  }

  aplicarExportado(id, nombre, valor) {
    for (const n of this.nodosConOrigen(id)) for (const s of n.scripts) s.asignar(nombre, valor);
  }

  recargarScript(rel, texto) {
    this.textos.set(rel, texto);
    this.programas.delete(rel);
    let prog;
    try { prog = this.programaDe(rel); } catch (e) { this.reportarError(e, null); return false; }
    for (const n of this.todos()) {
      n.scripts = n.scripts.map((s) => {
        if (s.rel !== rel) return s;
        const nueva = new InstanciaScript(this.interp, prog, n, s.archivo);
        nueva.rel = rel;
        try {
          const valores = { ...(n.datos.exportados || {}) };
          nueva.iniciar(valores);
          for (const v of s.variables()) if (nueva.tiene(v.nombre) && !v.exportada) nueva.asignar(v.nombre, v.valor);
        } catch (e) { this.reportarError(e, n); return s; }
        return nueva;
      });
    }
    this.errores = this.errores.filter(e => e.archivo !== rel);
    return true;
  }

  valoresVivos(nombre) {
    const n = this.buscarPorNombre(nombre);
    if (!n) return null;
    const r = [];
    for (const s of n.scripts) for (const v of s.variables()) r.push({ nombre: v.nombre, valor: aTexto(v.valor), crudo: typeof v.valor === 'number' || typeof v.valor === 'boolean' ? v.valor : null, tipo: v.tipo });
    if (n.tipo === 'Personaje2D' || n.tipo === 'Personaje3D') {
      if (!r.some(x => x.nombre === 'velocidad')) r.push({ nombre: 'velocidad', valor: aTexto(n.props.velocidad), tipo: tipoDe(n.props.velocidad) });
      r.push({ nombre: 'en_el_suelo', valor: aTexto(n.enSuelo), tipo: 'sí/no', crudo: n.enSuelo });
    }
    if (!r.length) {
      const p = this.posicion(n);
      r.push({ nombre: 'x', valor: aTexto(Math.round(p[0] * 10) / 10), tipo: 'decimal' }, { nombre: 'y', valor: aTexto(Math.round(p[1] * 10) / 10), tipo: 'decimal' });
    }
    return { nodo: n.nombre, valores: r };
  }

  evaluar(codigo, nombreNodo) {
    const n = nombreNodo ? this.buscarPorNombre(nombreNodo) : null;
    const s = n && n.scripts[0];
    const { programa, errores } = analizar(codigo, 'consola');
    if (errores.length) throw errores[0];
    let ultimo;
    for (const st of programa.cuerpo) {
      const env = s ? s.entorno : this.interp.globales;
      if (st.tipo === 'Expresion') ultimo = this.interp.evaluar(st.expr, env);
      else this.interp.correrSync(this.interp.ejecutarSentencia(st, env));
    }
    return ultimo;
  }

  destruir() {
    this.limpiarEscena();
    this.entrada.desconectar();
    if (this.audio) this.audio.cerrar();
  }
}

function esAncestro(a, b) { for (let p = b.padre; p; p = p.padre) if (p === a) return true; return false; }

// Contexto que añade un desplazamiento a cada setTransform (para el recuadro con bandas negras).
function desplazado(c, ox, oy) {
  if (!ox && !oy) return c;
  return new Proxy(c, {
    get(t, k) {
      if (k === 'setTransform') return (a, b, cc, d, e, f) => {
        if (a instanceof DOMMatrix || (typeof a === 'object' && a !== null)) { const m = DOMMatrix.fromMatrix(a); m.e += ox; m.f += oy; return t.setTransform(m); }
        return t.setTransform(a, b, cc, d, e + ox, f + oy);
      };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function serializar(v) {
  if (v instanceof Map) return { __mapa: [...v].map(([k, x]) => [serializar(k), serializar(x)]) };
  if (Array.isArray(v)) return v.map(serializar);
  if (v && typeof v === 'object') return null;
  return v;
}
function deserializar(v) {
  if (v && v.__mapa) return new Map(v.__mapa.map(([k, x]) => [deserializar(k), deserializar(x)]));
  if (Array.isArray(v)) return v.map(deserializar);
  return v;
}
