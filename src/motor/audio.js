// Sonido del juego con Web Audio: efectos y música de fondo.

export class Audio {
  constructor(proyecto, archivos) {
    this.proyecto = proyecto;
    this.archivos = archivos;   // lista de rutas relativas de sonido del proyecto
    this.ctx = null;
    this.buffers = new Map();
    this.cargando = new Map();
    this.musicaActual = null;
    this.nombreMusica = null;
    this.silencio = false;
    const v = proyecto.datos.volumen || {};
    this.volumen = { general: v.general ?? 1, musica: v.musica ?? 0.7, efectos: v.efectos ?? 1 };
  }

  contexto() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.salida = this.ctx.createGain();
      this.salida.connect(this.ctx.destination);
      this.salida.gain.value = this.silencio ? 0 : this.volumen.general;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Busca un sonido por ruta exacta o por nombre de archivo («salto.wav» o «salto»).
  resolver(nombre) {
    if (!nombre) return null;
    const n = String(nombre).replace(/\\/g, '/');
    if (this.archivos.includes(n)) return n;
    const bajo = n.toLowerCase();
    const sinExt = bajo.replace(/\.[^.]+$/, '');
    return this.archivos.find(a => a.toLowerCase().endsWith('/' + bajo) || a.toLowerCase() === bajo)
      || this.archivos.find(a => a.toLowerCase().split('/').pop().replace(/\.[^.]+$/, '') === sinExt) || null;
  }

  async cargar(rel) {
    if (this.buffers.has(rel)) return this.buffers.get(rel);
    if (this.cargando.has(rel)) return this.cargando.get(rel);
    const p = (async () => {
      const datos = await this.proyecto.leerBinario(rel);
      const buf = await this.contexto().decodeAudioData(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength));
      this.buffers.set(rel, buf);
      return buf;
    })();
    this.cargando.set(rel, p);
    try { return await p; } catch (e) { this.cargando.delete(rel); throw e; }
  }

  async precargar() {
    await Promise.all(this.archivos.map(a => this.cargar(a).catch(() => null)));
  }

  sonar(nombre, volumen = 1) {
    const rel = this.resolver(nombre);
    if (!rel) return false;
    const ctx = this.contexto();
    const reproducir = (buf) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = Math.max(0, volumen) * this.volumen.efectos;
      s.connect(g).connect(this.salida);
      s.start();
      return s;
    };
    const buf = this.buffers.get(rel);
    if (buf) reproducir(buf);
    else this.cargar(rel).then(reproducir).catch(() => {});
    return true;
  }

  musica(nombre, volumen = 1) {
    const rel = this.resolver(nombre);
    if (!rel) return false;
    if (this.nombreMusica === rel && this.musicaActual) return true;
    this.pararMusica();
    this.nombreMusica = rel;
    const ctx = this.contexto();
    const empezar = (buf) => {
      if (this.nombreMusica !== rel) return;
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      const g = ctx.createGain();
      g.gain.value = volumen * this.volumen.musica;
      s.connect(g).connect(this.salida);
      s.start();
      this.musicaActual = { fuente: s, ganancia: g };
    };
    const buf = this.buffers.get(rel);
    if (buf) empezar(buf); else this.cargar(rel).then(empezar).catch(() => {});
    return true;
  }

  pararMusica() {
    if (this.musicaActual) { try { this.musicaActual.fuente.stop(); } catch {} }
    this.musicaActual = null;
    this.nombreMusica = null;
  }

  // Sonido ligado a un nodo «Sonido».
  reproducirNodo(nodo) {
    const rel = this.resolver(nodo.props.sonido);
    if (!rel) return;
    this.pararNodo(nodo);
    const ctx = this.contexto();
    const empezar = (buf) => {
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = !!nodo.props.bucle;
      const g = ctx.createGain();
      g.gain.value = (nodo.props.volumen ?? 1) * (s.loop ? this.volumen.musica : this.volumen.efectos);
      s.connect(g).connect(this.salida);
      s.start();
      nodo._sonido = { fuente: s, ganancia: g };
    };
    const buf = this.buffers.get(rel);
    if (buf) empezar(buf); else this.cargar(rel).then(empezar).catch(() => {});
  }

  pararNodo(nodo) {
    if (nodo._sonido) { try { nodo._sonido.fuente.stop(); } catch {} nodo._sonido = null; }
  }

  silenciar(si) {
    this.silencio = si;
    if (this.salida) this.salida.gain.value = si ? 0 : this.volumen.general;
  }

  cerrar() {
    this.pararMusica();
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}
