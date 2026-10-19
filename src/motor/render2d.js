// Dibujo 2D con Canvas, compartido por el editor y el juego.

const RAD = Math.PI / 180;
const TIPOS_UI = new Set(['Interfaz', 'Etiqueta', 'Boton', 'PanelUI']);

export class CacheImagenes {
  constructor(proyecto, alCargar = () => {}) {
    this.proyecto = proyecto;
    this.mapa = new Map();
    this.alCargar = alCargar;
    this.fuentes = new Map();
  }

  obtener(rel) {
    if (!rel) return null;
    let e = this.mapa.get(rel);
    if (!e) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      e = { img, listo: false, error: false };
      img.onload = () => { e.listo = true; this.alCargar(rel); };
      img.onerror = () => { e.error = true; };
      img.src = this.proyecto.url(rel) + '?v=' + (this.version || 0);
      this.mapa.set(rel, e);
    }
    const a = this.proyecto.ajustesImportacion(rel);
    e.columnas = Math.max(1, a.columnas | 0 || 1);
    e.filas = Math.max(1, a.filas | 0 || 1);
    e.filtro = a.filtro;
    e.ajustes = a;
    return e;
  }

  recargar(rel) {
    this.version = Date.now();
    if (rel) this.mapa.delete(rel); else this.mapa.clear();
  }

  async precargar(rels) {
    await Promise.all([...new Set(rels)].filter(Boolean).map(rel => new Promise((ok) => {
      const e = this.obtener(rel);
      if (e.listo || e.error) return ok();
      e.img.addEventListener('load', ok, { once: true });
      e.img.addEventListener('error', ok, { once: true });
    })));
  }

  // Fuentes de los proyectos (.ttf/.otf) para las etiquetas.
  fuente(rel) {
    if (!rel) return 'Manrope';
    let f = this.fuentes.get(rel);
    if (!f) {
      const familia = 'F_' + rel.replace(/[^a-z0-9]/gi, '_');
      f = { familia, lista: false };
      this.fuentes.set(rel, f);
      const ff = new FontFace(familia, `url("${this.proyecto.url(rel)}")`);
      ff.load().then((x) => { document.fonts.add(x); f.lista = true; this.alCargar(rel); }).catch(() => {});
    }
    return f.lista ? f.familia : 'Manrope';
  }
}

export function matrizLocal(n) {
  const p = n.props;
  const m = new DOMMatrix();
  const pos = p.posicion || [0, 0];
  m.translateSelf(pos[0] || 0, pos[1] || 0);
  if (p.rotacion && typeof p.rotacion === 'number') m.rotateSelf(p.rotacion);
  const e = p.escala;
  if (Array.isArray(e) && e.length === 2) m.scaleSelf(e[0] ?? 1, e[1] ?? 1);
  return m;
}

/**
 * Recorre los nodos 2D con su matriz de mundo.
 * fn(nodo, matriz, zHeredada, enInterfaz, padre)
 */
export function recorrerConMatriz(raiz, fn, opciones = {}) {
  const visitar = (n, padreM, zBase, enUI, padre) => {
    if (opciones.saltarOcultos && n.visible === false) return;
    const enInterfaz = enUI || n.tipo === 'Interfaz';
    const m = n.tipo === 'Fondo' || n.tipo === 'Interfaz' ? padreM : padreM.multiply(matrizLocal(n));
    const z = zBase + (n.props.z || 0);
    if (fn(n, m, z, enInterfaz, padre) === false) return;
    for (const h of n.hijos) visitar(h, m, z, enInterfaz, n);
  };
  visitar(raiz, new DOMMatrix(), 0, false, null);
}

// Tamaño visible de un nodo (para selección y colisiones por defecto).
export function tamanoNodo(n) {
  const p = n.props;
  switch (n.tipo) {
    case 'Sprite': case 'Plataforma': case 'Colision': case 'Boton': case 'PanelUI':
      return [p.ancho || 32, p.alto || 32];
    case 'Etiqueta': return [Math.max(20, String(p.texto || '').length * (p.tam || 24) * 0.55), (p.tam || 24) * 1.2];
    case 'Particulas2D': return [24, 24];
    default: return null;
  }
}

function colorConAlfa(hex, a) {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function aclarar(hex, cant) {
  const h = (hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (cant > 0 ? (255 - v) * cant : v * cant))));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------- Formas sencillas para sprites sin imagen ----------
export function dibujarForma(c, forma, w, h, color, t = 0) {
  c.fillStyle = color;
  switch (forma) {
    case 'circulo':
      c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-w * 0.12, -h * 0.14, w * 0.18, h * 0.14, 0, 0, Math.PI * 2); c.fill();
      break;
    case 'redondeado':
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-w / 2 + 6, h / 2 - 8, w - 12, 4);
      break;
    case 'triangulo':
      c.beginPath(); c.moveTo(0, -h / 2); c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); c.fill();
      break;
    case 'personaje': {
      const piernas = h * 0.2;
      c.fillStyle = aclarar(color, -0.35);
      c.beginPath(); c.roundRect(-w * 0.3, h / 2 - piernas, w * 0.22, piernas, 4); c.roundRect(w * 0.08, h / 2 - piernas, w * 0.22, piernas, 4); c.fill();
      c.fillStyle = color;
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h - piernas + 2, Math.min(w, h) * 0.32); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.18, -h * 0.22, Math.min(w, h) * 0.13, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0B1A10'; c.beginPath(); c.arc(w * 0.22, -h * 0.22, Math.min(w, h) * 0.065, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'enemigo': {
      c.beginPath(); c.ellipse(0, h * 0.1, w / 2, h * 0.4, 0, Math.PI, 0); c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-w * 0.15, -h * 0.05, w * 0.09, 0, Math.PI * 2); c.arc(w * 0.15, -h * 0.05, w * 0.09, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0a10'; c.beginPath(); c.arc(-w * 0.13, -h * 0.05, w * 0.045, 0, Math.PI * 2); c.arc(w * 0.17, -h * 0.05, w * 0.045, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'estrella': {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.42 : 1;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        c.lineTo(Math.cos(a) * w / 2 * r, Math.sin(a) * h / 2 * r);
      }
      c.closePath(); c.fill();
      break;
    }
    case 'bandera': {
      c.fillStyle = '#C9D2CC'; c.fillRect(-w / 2, -h / 2, 5, h);
      c.fillStyle = color;
      const ola = Math.sin(t * 4) * 3;
      c.beginPath(); c.moveTo(-w / 2 + 5, -h / 2 + 2); c.quadraticCurveTo(w * 0.1, -h / 2 + ola, w / 2, -h / 2 + 12); c.quadraticCurveTo(w * 0.1, -h / 2 + 24 - ola, -w / 2 + 5, -h / 2 + 30); c.closePath(); c.fill();
      break;
    }
    default:
      c.fillRect(-w / 2, -h / 2, w, h);
  }
}

function dibujarIconoUI(c, icono, x, y, r) {
  if (icono === 'moneda') {
    c.fillStyle = '#C98F2E'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F2C46D'; c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.fill();
  } else if (icono === 'vida') {
    c.fillStyle = '#F07A7A';
    c.beginPath(); c.moveTo(x, y + r * 0.8);
    c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.5, y - r * 1.4, x, y - r * 0.4);
    c.bezierCurveTo(x + r * 0.5, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.8); c.fill();
  } else if (icono === 'estrella') {
    c.save(); c.translate(x, y); dibujarForma(c, 'estrella', r * 2.2, r * 2.2, '#4FD1C5'); c.restore();
  }
}

export class Render2D {
  constructor(imagenes) {
    this.imagenes = imagenes;
    this.tiempo = 0;
  }

  /**
   * Dibuja el mundo 2D. «camara» = { x, y, zoom } (punto del mundo en el centro de la pantalla).
   * «vista» = { ancho, alto, escala } tamaño lógico y escala a píxeles reales.
   */
  dibujarMundo(c, raiz, camara, vista, op = {}) {
    const lista = [];
    const fondos = [];
    recorrerConMatriz(raiz, (n, m, z, enUI) => {
      if (n.visible === false && !op.mostrarOcultos) return false;
      if (enUI) return false;
      if (n.tipo === 'Fondo') { fondos.push(n); return; }
      lista.push({ n, m, z });
    });
    const base = new DOMMatrix()
      .scaleSelf(vista.escala, vista.escala)
      .translateSelf(vista.ancho / 2, vista.alto / 2)
      .scaleSelf(camara.zoom, camara.zoom)
      .translateSelf(-camara.x, -camara.y);
    for (const f of fondos) this.dibujarFondo(c, f, camara, vista);
    lista.sort((a, b) => a.z - b.z);
    for (const { n, m } of lista) {
      c.setTransform(base.multiply(m));
      c.globalAlpha = n.visible === false ? 0.35 : 1;
      this.dibujarNodo(c, n, op);
    }
    c.globalAlpha = 1;
    // Partículas (en coordenadas de mundo).
    c.setTransform(base);
    for (const { n } of lista) if (n._particulas) this.dibujarParticulas(c, n);
    c.setTransform(1, 0, 0, 1, 0, 0);
    return base;
  }

  dibujarFondo(c, n, camara, vista) {
    const p = n.props;
    c.setTransform(vista.escala, 0, 0, vista.escala, 0, 0);
    const W = vista.ancho, H = vista.alto;
    const e = p.imagen ? this.imagenes.obtener(p.imagen) : null;
    if (e && e.listo) {
      const img = e.img;
      const esc = H / img.height;
      const ancho = img.width * esc;
      const desp = ((camara.x * (p.paralaje ?? 0.3)) % ancho + ancho) % ancho;
      c.imageSmoothingEnabled = e.filtro !== 'pixel';
      for (let x = -desp; x < W; x += ancho) c.drawImage(img, x, 0, ancho, H);
      return;
    }
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.color || '#10293A');
    g.addColorStop(1, p.color2 || p.color || '#1D4A4F');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    if (p.montanas) {
      const par = p.paralaje ?? 0.3;
      const sierra = (color, base, amp, escalaX, fase, factor) => {
        c.fillStyle = color;
        c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 20) {
          const wx = (x + camara.x * par * factor) / escalaX + fase;
          const y = base - (Math.sin(wx) * 0.5 + Math.sin(wx * 2.3 + 1) * 0.3 + Math.sin(wx * 0.5) * 0.4 + 1) * amp;
          c.lineTo(x, y);
        }
        c.lineTo(W, H); c.closePath(); c.fill();
      };
      c.fillStyle = 'rgba(233,221,176,.9)';
      c.beginPath(); c.arc(W * 0.82, H * 0.2, H * 0.065, 0, Math.PI * 2); c.fill();
      sierra(aclarar(p.color2 || '#1D4A4F', 0.05), H * 0.78, H * 0.17, 120, 0, 0.5);
      sierra(aclarar(p.color2 || '#1D4A4F', 0.14), H * 0.9, H * 0.12, 90, 2, 1);
    }
  }

  dibujarNodo(c, n, op) {
    const p = n.props;
    switch (n.tipo) {
      case 'Sprite': {
        const w = p.ancho || 32, h = p.alto || 32;
        c.globalAlpha *= p.opacidad ?? 1;
        const e = p.imagen ? this.imagenes.obtener(p.imagen) : null;
        if (p.voltear_h) c.scale(-1, 1);
        if (e && e.listo) {
          const cols = e.columnas, filas = e.filas;
          const total = cols * filas;
          const cuadro = ((Math.floor(n._cuadro ?? p.cuadro ?? 0) % total) + total) % total;
          const fw = e.img.width / cols, fh = e.img.height / filas;
          c.imageSmoothingEnabled = e.filtro !== 'pixel';
          c.drawImage(e.img, (cuadro % cols) * fw, Math.floor(cuadro / cols) * fh, fw, fh, -w / 2, -h / 2, w, h);
        } else {
          dibujarForma(c, p.forma, w, h, n._color || p.color, this.tiempo);
        }
        break;
      }
      case 'Plataforma': {
        const w = p.ancho, h = p.alto;
        c.fillStyle = p.color;
        c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, Math.min(4, h / 4)); c.fill();
        c.fillStyle = p.color_borde;
        const borde = Math.min(8, h / 3);
        c.beginPath(); c.roundRect(-w / 2, -h / 2, w, borde, [Math.min(4, h / 4), Math.min(4, h / 4), 0, 0]); c.fill();
        break;
      }
      case 'Mosaicos': this.dibujarMosaicos(c, n, op); break;
      case 'Particulas2D':
        if (op.editor) {
          c.strokeStyle = colorConAlfa(p.color, 0.8); c.setLineDash([3, 3]); c.lineWidth = 1.5;
          c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
          for (let i = 0; i < 6; i++) { c.fillStyle = p.color; c.beginPath(); c.arc(Math.cos(i) * 8, Math.sin(i * 2) * 8, 2, 0, Math.PI * 2); c.fill(); }
        }
        break;
      case 'Colision':
        if (op.editor || op.mostrarColisiones) {
          c.fillStyle = 'rgba(61,220,132,.10)';
          c.strokeStyle = 'rgba(61,220,132,.75)';
          c.lineWidth = 1.5 / (c.getTransform().a || 1);
          if (p.forma === 'circulo') { c.beginPath(); c.ellipse(0, 0, p.ancho / 2, p.alto / 2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
          else { c.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto); c.strokeRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto); }
        }
        break;
    }
  }

  dibujarMosaicos(c, n, op) {
    const p = n.props;
    const T = p.tam_celda || 32;
    const celdas = p.celdas || {};
    const e = p.imagen ? this.imagenes.obtener(p.imagen) : null;
    const usarImagen = e && e.listo;
    if (usarImagen) c.imageSmoothingEnabled = e.filtro !== 'pixel';
    // Solo las celdas visibles en pantalla.
    const inv = c.getTransform().inverse();
    const lim = op.limitesVista;
    let x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity;
    if (lim) {
      const a = inv.transformPoint(new DOMPoint(0, 0)), b = inv.transformPoint(new DOMPoint(lim[0], lim[1]));
      x0 = Math.floor(Math.min(a.x, b.x) / T) - 1; x1 = Math.ceil(Math.max(a.x, b.x) / T) + 1;
      y0 = Math.floor(Math.min(a.y, b.y) / T) - 1; y1 = Math.ceil(Math.max(a.y, b.y) / T) + 1;
    }
    for (const k in celdas) {
      const i = k.indexOf(',');
      const cx = +k.slice(0, i), cy = +k.slice(i + 1);
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
      const t = celdas[k];
      if (usarImagen) {
        const cols = e.columnas, fw = e.img.width / cols, fh = e.img.height / e.filas;
        const total = cols * e.filas;
        const idx = ((t % total) + total) % total;
        c.drawImage(e.img, (idx % cols) * fw, Math.floor(idx / cols) * fh, fw, fh, cx * T, cy * T, T + 0.5, T + 0.5);
      } else {
        c.fillStyle = p.color;
        c.fillRect(cx * T, cy * T, T + 0.5, T + 0.5);
        if (!((cx + ',' + (cy - 1)) in celdas)) { c.fillStyle = p.color_borde; c.fillRect(cx * T, cy * T, T + 0.5, Math.max(3, T * 0.22)); }
      }
    }
  }

  dibujarParticulas(c, n) {
    const p = n.props;
    c.fillStyle = p.color;
    for (const q of n._particulas) {
      const a = Math.max(0, q.vida / q.max);
      c.globalAlpha = a;
      const r = (p.tam || 5) * (0.5 + a * 0.5);
      c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  /** Dibuja las capas de Interfaz en coordenadas de pantalla. */
  dibujarInterfaz(c, raiz, vista, op = {}) {
    const capas = [];
    recorrerConMatriz(raiz, (n, m, z, enUI) => {
      if (n.visible === false && !op.mostrarOcultos) return false;
      if (n.tipo === 'Interfaz') { if (n.props.visible_capa === false && !op.editor) return false; capas.push(n); return false; }
    });
    for (const capa of capas) {
      const visitar = (n, ox, oy) => {
        if (n.visible === false && !op.mostrarOcultos) return;
        const pos = n.props.posicion || [0, 0];
        const x = ox + (n.tipo === 'Interfaz' ? 0 : pos[0]), y = oy + (n.tipo === 'Interfaz' ? 0 : pos[1]);
        c.setTransform(vista.escala, 0, 0, vista.escala, 0, 0);
        c.globalAlpha = n.visible === false ? 0.35 : 1;
        this.dibujarUI(c, n, x, y, op);
        for (const h of n.hijos) visitar(h, x, y);
      };
      visitar(capa, 0, 0);
    }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  dibujarUI(c, n, x, y, op) {
    const p = n.props;
    if (n.tipo === 'Etiqueta') {
      const tam = p.tam || 24;
      const familia = this.imagenes.fuente(p.fuente);
      c.font = `700 ${tam}px "${familia}", Manrope, sans-serif`;
      c.textBaseline = 'middle';
      const texto = String(p.texto ?? '');
      const anchoTexto = c.measureText(texto).width;
      const icono = p.icono && p.icono !== 'ninguno';
      const anchoIcono = icono ? tam * 1.05 : 0;
      const total = anchoTexto + anchoIcono;
      let x0 = x;
      if (p.alineacion === 'centro') x0 = x - total / 2;
      else if (p.alineacion === 'derecha') x0 = x - total;
      const cy = y + tam * 0.6;
      if (p.fondo) {
        const pad = tam * 0.55;
        c.fillStyle = 'rgba(8,12,10,.72)';
        c.beginPath(); c.roundRect(x0 - pad, cy - tam * 0.85, total + pad * 2, tam * 1.7, tam * 0.85); c.fill();
      }
      if (icono) dibujarIconoUI(c, p.icono, x0 + tam * 0.4, cy, tam * 0.42);
      c.fillStyle = p.color || '#E7EDE9';
      c.textAlign = 'left';
      c.fillText(texto, x0 + anchoIcono, cy + 1);
      n._limites = [x0, cy - tam * 0.85, total, tam * 1.7];
    } else if (n.tipo === 'Boton') {
      const w = p.ancho, h = p.alto;
      const hover = n._hover;
      c.fillStyle = hover ? aclarar(p.color, 0.15) : p.color;
      c.beginPath(); c.roundRect(x, y, w, h, Math.min(14, h / 2)); c.fill();
      c.fillStyle = p.color_texto || '#04140B';
      c.font = `800 ${Math.min(22, h * 0.38)}px Manrope, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(p.texto ?? ''), x + w / 2, y + h / 2 + 1);
      n._limites = [x, y, w, h];
    } else if (n.tipo === 'PanelUI') {
      c.globalAlpha *= p.opacidad ?? 1;
      c.fillStyle = p.color;
      c.beginPath(); c.roundRect(x, y, p.ancho, p.alto, p.radio ?? 12); c.fill();
      n._limites = [x, y, p.ancho, p.alto];
    } else if (n.tipo === 'Interfaz') {
      n._limites = null;
    }
    c.textAlign = 'left';
  }
}

export { TIPOS_UI, colorConAlfa };
