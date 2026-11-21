// Traza la silueta negra de recursos/logo.png y la escribe como PERFIL (viewBox 64×64) en src/ui/iconos.js.
// Marching squares sobre la máscara del negro + simplificación Ramer–Douglas–Peucker.
// Uso: npx electron herramientas/trazar-logo.js
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const EPS = 2.2;       // tolerancia RDP en píxeles del logo
const AREA_MIN = 150;  // descarta motas (px²)

function mascara() {
  const img = nativeImage.createFromPath(path.join(raiz, 'recursos/logo.png'));
  const { width: an, height: al } = img.getSize();
  const bgra = img.toBitmap();
  const negro = new Uint8Array(an * al);
  let x0 = an, y0 = al, x1 = 0, y1 = 0; // caja del cuadrado (píxeles opacos)
  for (let y = 0; y < al; y++) for (let x = 0; x < an; x++) {
    const i = (y * an + x) * 4;
    if (bgra[i + 3] < 128) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (bgra[i] + bgra[i + 1] + bgra[i + 2] < 3 * 80) negro[y * an + x] = 1;
  }
  return { an, al, negro, caja: [x0, y0, x1 + 1, y1 + 1] };
}

// Segmentos por celda entre centros de píxel; los puntos medios de arista se enlazan en lazos cerrados.
function contornos({ an, al, negro }) {
  const v = (x, y) => (x >= 0 && y >= 0 && x < an && y < al ? negro[y * an + x] : 0);
  const vecinos = new Map();
  const enlaza = (a, b) => {
    for (const [p, q] of [[a, b], [b, a]]) (vecinos.get(p) ?? vecinos.set(p, []).get(p)).push(q);
  };
  // Clave de punto medio: arista horizontal (x+0.5, y) o vertical (x, y+0.5), en medios píxeles.
  const k = (x2, y2) => (x2 + 2) * 4096 + y2 + 2; // +2: el borde exterior da medios píxeles negativos
  for (let y = -1; y < al; y++) for (let x = -1; x < an; x++) {
    const c = v(x, y) << 3 | v(x + 1, y) << 2 | v(x + 1, y + 1) << 1 | v(x, y + 1);
    if (c === 0 || c === 15) continue;
    const ar = k(2 * x + 1, 2 * y), de = k(2 * x + 2, 2 * y + 1), ab = k(2 * x + 1, 2 * y + 2), iz = k(2 * x, 2 * y + 1);
    const tabla = {
      1: [[iz, ab]], 2: [[ab, de]], 3: [[iz, de]], 4: [[ar, de]], 5: [[iz, ar], [ab, de]],
      6: [[ar, ab]], 7: [[iz, ar]], 8: [[iz, ar]], 9: [[ar, ab]], 10: [[ar, de], [iz, ab]],
      11: [[ar, de]], 12: [[iz, de]], 13: [[ab, de]], 14: [[iz, ab]],
    }[c];
    for (const [a, b] of tabla) enlaza(a, b);
  }
  const visto = new Set(), lazos = [];
  for (const inicio of vecinos.keys()) {
    if (visto.has(inicio)) continue;
    const lazo = [];
    let prev = -1, p = inicio;
    do {
      visto.add(p);
      lazo.push([(Math.floor(p / 4096) - 2) / 2, (p % 4096 - 2) / 2]);
      const [a, b] = vecinos.get(p);
      [prev, p] = [p, a !== prev ? a : b];
    } while (p !== inicio);
    lazos.push(lazo);
  }
  return lazos;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / l;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

const area = (l) => Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

app.whenReady().then(() => {
  const m = mascara();
  const [x0, y0, x1] = m.caja, esc = 64 / (x1 - x0);
  const n = (t) => +t.toFixed(1) + '';
  const d = contornos(m).filter(l => area(l) >= AREA_MIN).map(l => {
    // Lazo cerrado: parte por el punto más lejano al inicio para que RDP conserve ambos extremos.
    let lejos = 0;
    l.forEach((p, i) => { if (Math.hypot(p[0] - l[0][0], p[1] - l[0][1]) > Math.hypot(l[lejos][0] - l[0][0], l[lejos][1] - l[0][1])) lejos = i; });
    const s = [...rdp(l.slice(0, lejos + 1), EPS).slice(0, -1), ...rdp([...l.slice(lejos), l[0]], EPS).slice(0, -1)];
    return 'M' + s.map(([x, y]) => n((x - x0) * esc) + ' ' + n((y - y0) * esc)).join(' ') + 'Z';
  }).join('');
  if (!d) throw new Error('No se encontró la silueta en recursos/logo.png');
  const archivo = path.join(raiz, 'src/ui/iconos.js');
  const src = fs.readFileSync(archivo, 'utf8');
  const nuevo = src.replace(/const PERFIL = '[^']*';/, `const PERFIL = '${d}';`);
  if (nuevo === src && !src.includes(d)) throw new Error('No se encontró const PERFIL en iconos.js');
  fs.writeFileSync(archivo, nuevo);
  console.log(`PERFIL: ${d.length} caracteres, ${d.split('M').length - 1} contornos`);
  app.quit();
});
