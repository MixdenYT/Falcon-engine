// Entrada del juego: teclado, ratón y mando, agrupados en «acciones» con nombre.

export class Entrada {
  constructor(acciones, mando = {}) {
    this.acciones = acciones;      // { saltar: ['Space'], ... }
    this.mando = mando;            // { saltar: ['b0'], ... }
    this.teclas = new Set();
    this.estado = new Map();       // acción → pulsada este fotograma
    this.anterior = new Map();
    this.raton = { x: 0, y: 0, pulsado: false, clic: false, dentro: false };
    this.clicPendiente = false;
    this.ejesMando = [];
    this.botonesMando = [];
    this.activa = true;
    this._limpiar = [];
  }

  conectar(objetivo = window, lienzo = null) {
    const abajo = (e) => {
      if (!this.activa) return;
      if (e.repeat) return;
      this.teclas.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    const arriba = (e) => this.teclas.delete(e.code);
    const fuera = () => this.teclas.clear();
    objetivo.addEventListener('keydown', abajo);
    objetivo.addEventListener('keyup', arriba);
    window.addEventListener('blur', fuera);
    this._limpiar.push(() => { objetivo.removeEventListener('keydown', abajo); objetivo.removeEventListener('keyup', arriba); window.removeEventListener('blur', fuera); });
    if (lienzo) {
      const mov = (e) => { const r = lienzo.getBoundingClientRect(); this.raton.px = e.clientX - r.left; this.raton.py = e.clientY - r.top; this.raton.dentro = true; };
      const bajar = (e) => { mov(e); this.teclas.add('Raton' + e.button); if (e.button === 0) { this.raton.pulsado = true; this.clicPendiente = true; } };
      const subir = (e) => { this.teclas.delete('Raton' + e.button); if (e.button === 0) this.raton.pulsado = false; };
      lienzo.addEventListener('mousemove', mov);
      lienzo.addEventListener('mousedown', bajar);
      window.addEventListener('mouseup', subir);
      lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
      this._limpiar.push(() => { lienzo.removeEventListener('mousemove', mov); lienzo.removeEventListener('mousedown', bajar); window.removeEventListener('mouseup', subir); });
    }
  }

  desconectar() { this._limpiar.forEach(f => f()); this._limpiar = []; }

  // Llamar una vez por fotograma, antes de la lógica.
  actualizar() {
    this.anterior = this.estado;
    this.estado = new Map();
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads[0];
    this.ejesMando = pad ? [...pad.axes] : [];
    this.botonesMando = pad ? pad.buttons.map(b => b.pressed) : [];
    for (const accion of new Set([...Object.keys(this.acciones), ...Object.keys(this.mando)])) {
      this.estado.set(accion, this.valorAccion(accion) > 0.5);
    }
    this.raton.clic = this.clicPendiente;
    this.clicPendiente = false;
  }

  valorAccion(accion) {
    let v = 0;
    for (const t of this.acciones[accion] || []) if (this.teclas.has(t)) v = 1;
    for (const b of this.mando[accion] || []) {
      const m = /^eje(\d+)([+-])$/.exec(b);
      if (m) {
        const a = this.ejesMando[Number(m[1])] || 0;
        const x = m[2] === '+' ? a : -a;
        if (x > 0.25) v = Math.max(v, Math.min(1, (x - 0.25) / 0.6));
      } else if (/^b\d+$/.test(b) && this.botonesMando[Number(b.slice(1))]) v = 1;
    }
    return v;
  }

  existe(accion) { return accion in this.acciones || accion in this.mando; }
  mantiene(accion) { return !!this.estado.get(accion); }
  pulsa(accion) { return !!this.estado.get(accion) && !this.anterior.get(accion); }
  suelta(accion) { return !this.estado.get(accion) && !!this.anterior.get(accion); }
  eje(negativa, positiva) {
    const v = this.valorAccion(positiva) - this.valorAccion(negativa);
    return Math.abs(v) < 0.05 ? 0 : Math.max(-1, Math.min(1, v));
  }
  pulsadasAhora() { return [...this.estado.keys()].filter(a => this.pulsa(a)); }
  soltadasAhora() { return [...this.anterior.keys()].filter(a => this.suelta(a)); }
}
