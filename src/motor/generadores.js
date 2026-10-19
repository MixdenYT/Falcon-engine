// Genera recursos de ejemplo para las plantillas: sprites (PNG) y sonidos (WAV).
// Se ejecuta en el navegador (gestor de proyectos).

// ---------- Sonido ----------

export function codificarWav(muestras, frecuencia = 22050) {
  const n = muestras.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true); v.setUint32(28, frecuencia * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, muestras[i])) * 32767, true);
  return new Uint8Array(buf);
}

const FR = 22050;
const onda = {
  cuadrada: (f) => (f % 1 < 0.5 ? 1 : -1),
  triangulo: (f) => 4 * Math.abs((f % 1) - 0.5) - 1,
  seno: (f) => Math.sin(f * Math.PI * 2),
};

function tono(salida, inicio, dur, frec, tipo = 'cuadrada', vol = 0.3, frecFin = frec) {
  const a = Math.floor(inicio * FR), n = Math.floor(dur * FR);
  let fase = 0;
  for (let i = 0; i < n && a + i < salida.length; i++) {
    const t = i / n;
    const f = frec + (frecFin - frec) * t;
    fase += f / FR;
    const env = Math.min(1, i / (FR * 0.005)) * (1 - t) ** 1.5;
    salida[a + i] += onda[tipo](fase) * vol * env;
  }
}

export function sintetizar(nombre) {
  let s;
  switch (nombre) {
    case 'salto': s = new Float32Array(FR * 0.22); tono(s, 0, 0.22, 330, 'cuadrada', 0.22, 880); break;
    case 'moneda': s = new Float32Array(FR * 0.3); tono(s, 0, 0.07, 988, 'cuadrada', 0.2); tono(s, 0.07, 0.22, 1319, 'cuadrada', 0.2); break;
    case 'golpe': {
      s = new Float32Array(FR * 0.25);
      for (let i = 0; i < s.length; i++) { const t = i / s.length; s[i] = (Math.random() * 2 - 1) * 0.5 * (1 - t) ** 3; }
      tono(s, 0, 0.18, 160, 'triangulo', 0.5, 50);
      break;
    }
    case 'ganar': {
      s = new Float32Array(FR * 0.9);
      [523, 659, 784, 1047].forEach((f, i) => tono(s, i * 0.12, i === 3 ? 0.5 : 0.14, f, 'cuadrada', 0.18));
      break;
    }
    case 'tema': {
      const bpm = 132, negra = 60 / bpm, compases = 8;
      s = new Float32Array(Math.ceil(FR * negra * 4 * compases));
      const melodia = [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 76, 74, 72, 69, 67, 72, 76, 79, 81, 79, 76, 74, 72, 74, 72, 69, 67, 69, 72, 72, 0];
      const bajos = [48, 48, 45, 45, 41, 41, 43, 43];
      const midi = (m) => 440 * 2 ** ((m - 69) / 12);
      melodia.forEach((m, i) => { if (m) tono(s, i * negra, negra * 0.9, midi(m), 'cuadrada', 0.09); });
      for (let c = 0; c < compases; c++) for (let b = 0; b < 4; b++) tono(s, (c * 4 + b) * negra, negra * 0.8, midi(bajos[c]), 'triangulo', 0.22);
      break;
    }
    default: s = new Float32Array(FR * 0.1); tono(s, 0, 0.1, 440);
  }
  return codificarWav(s, FR);
}

// ---------- Imágenes ----------

async function aPng(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Personaje verde con ojo, 4 cuadros de andar (64×80 cada uno). */
export async function spriteJugador() {
  const W = 64, H = 80, N = 4;
  const cv = new OffscreenCanvas(W * N, H);
  const c = cv.getContext('2d');
  for (let i = 0; i < N; i++) {
    const ox = i * W;
    const paso = [0, 4, 0, -4][i];
    const bote = i % 2 ? -2 : 0;
    c.fillStyle = '#239A5A';
    rrect(c, ox + 16 + paso * 0.5, 60, 13, 18, 4); c.fill();
    rrect(c, ox + 35 - paso * 0.5, 60, 13, 18, 4); c.fill();
    c.fillStyle = '#3DDC84';
    rrect(c, ox + 10, 6 + bote, 44, 58, 16); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)';
    rrect(c, ox + 15, 11 + bote, 10, 22, 5); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(ox + 40, 24 + bote, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0B1A10';
    c.beginPath(); c.arc(ox + 42, 24 + bote, 3.5, 0, Math.PI * 2); c.fill();
  }
  return aPng(cv);
}

/** Enemigo: babosa morada que bota, 6 cuadros (64×64). */
export async function spriteEnemigo() {
  const W = 64, H = 64, N = 6;
  const cv = new OffscreenCanvas(W * N, H);
  const c = cv.getContext('2d');
  for (let i = 0; i < N; i++) {
    const ox = i * W;
    const t = Math.sin(i / N * Math.PI * 2);
    const ancho = 48 + t * 5, alto = 38 - t * 5;
    c.fillStyle = '#B04A6A';
    c.beginPath();
    c.ellipse(ox + 32, 62 - alto / 2, ancho / 2, alto / 2, 0, Math.PI, 0);
    c.lineTo(ox + 32 + ancho / 2, 62); c.lineTo(ox + 32 - ancho / 2, 62); c.closePath(); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(ox + 24, 62 - alto * 0.6, 5, 0, Math.PI * 2); c.arc(ox + 40, 62 - alto * 0.6, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a0a10';
    c.beginPath(); c.arc(ox + 25, 62 - alto * 0.6, 2.5, 0, Math.PI * 2); c.arc(ox + 41, 62 - alto * 0.6, 2.5, 0, Math.PI * 2); c.fill();
  }
  return aPng(cv);
}

/** Moneda que gira, 8 cuadros (32×32). */
export async function spriteMoneda() {
  const W = 32, N = 8;
  const cv = new OffscreenCanvas(W * N, W);
  const c = cv.getContext('2d');
  for (let i = 0; i < N; i++) {
    const ox = i * W;
    const a = Math.abs(Math.cos(i / N * Math.PI));
    const rx = Math.max(2, 13 * a);
    c.fillStyle = '#C98F2E';
    c.beginPath(); c.ellipse(ox + 16, 16, rx, 13, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F2C46D';
    c.beginPath(); c.ellipse(ox + 16, 16, Math.max(1, rx - 2.5), 10.5, 0, 0, Math.PI * 2); c.fill();
    if (rx > 6) { c.fillStyle = '#FFE3A3'; c.fillRect(ox + 15, 10, 2, 12); }
  }
  return aPng(cv);
}

/** Paleta de mosaicos: césped, tierra, piedra, ladrillo (40×40 cada uno). */
export async function spriteCesped() {
  const T = 40;
  const cv = new OffscreenCanvas(T * 4, T);
  const c = cv.getContext('2d');
  const ruido = (ox, base, puntos) => {
    c.fillStyle = base; c.fillRect(ox, 0, T, T);
    for (const [col, n] of puntos) { c.fillStyle = col; for (let k = 0; k < n; k++) c.fillRect(ox + Math.floor(Math.random() * 38), Math.floor(Math.random() * 38), 3, 3); }
  };
  ruido(0, '#6B4528', [['#5A3A21', 10], ['#7E5434', 8]]);
  c.fillStyle = '#52B85A'; c.fillRect(0, 0, T, 11); c.fillStyle = '#6BCB66'; c.fillRect(0, 0, T, 4);
  ruido(T, '#6B4528', [['#5A3A21', 12], ['#7E5434', 10]]);
  ruido(T * 2, '#59615C', [['#4A514D', 12], ['#6B746E', 10]]);
  c.fillStyle = '#8C3F32'; c.fillRect(T * 3, 0, T, T);
  c.fillStyle = '#6E2F25';
  for (let f = 0; f < 4; f++) { c.fillRect(T * 3, f * 10 + 9, T, 2); const d = f % 2 ? 10 : 0; c.fillRect(T * 3 + d + 9, f * 10, 2, 10); c.fillRect(T * 3 + d + 29, f * 10, 2, 10); }
  return aPng(cv);
}

/** Fondo con montañas para el efecto paralaje. */
export async function spriteFondo() {
  const W = 960, H = 540;
  const cv = new OffscreenCanvas(W, H);
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#10293A'); g.addColorStop(1, '#1D4A4F');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#E9DDB0';
  c.beginPath(); c.arc(760, 120, 46, 0, Math.PI * 2); c.fill();
  const sierra = (color, base, alturas) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, H);
    alturas.forEach((h, i) => c.lineTo(i * W / (alturas.length - 1), base - h));
    c.lineTo(W, H); c.closePath(); c.fill();
  };
  sierra('#1E4A3C', 380, [40, 120, 70, 160, 90, 140, 60, 110, 50]);
  sierra('#265A42', 450, [30, 70, 40, 100, 50, 80, 30, 60, 40]);
  return aPng(cv);
}

/** Textura de piedra para materiales 3D (256×256, se repite). */
export async function texturaPiedra() {
  const S = 256;
  const cv = new OffscreenCanvas(S, S);
  const c = cv.getContext('2d');
  c.fillStyle = '#8F887A'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const v = 110 + Math.floor(Math.random() * 60);
    c.fillStyle = `rgba(${v},${v - 6},${v - 18},.5)`;
    c.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  c.strokeStyle = 'rgba(40,36,30,.6)'; c.lineWidth = 3;
  for (let f = 0; f < 4; f++) {
    c.beginPath(); c.moveTo(0, f * 64); c.lineTo(S, f * 64); c.stroke();
    const d = f % 2 ? 64 : 0;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(d + k * 128, f * 64); c.lineTo(d + k * 128, f * 64 + 64); c.stroke(); }
  }
  return aPng(cv);
}

/** Mapa de relieve (normal) a juego con la piedra. */
export async function texturaRelieve() {
  const S = 256;
  const cv = new OffscreenCanvas(S, S);
  const c = cv.getContext('2d');
  c.fillStyle = 'rgb(128,128,255)'; c.fillRect(0, 0, S, S);
  for (let f = 0; f < 4; f++) {
    c.fillStyle = 'rgb(128,90,230)'; c.fillRect(0, f * 64, S, 3);
    c.fillStyle = 'rgb(128,166,230)'; c.fillRect(0, f * 64 + 3, S, 2);
    const d = f % 2 ? 64 : 0;
    for (let k = 0; k < 3; k++) {
      c.fillStyle = 'rgb(90,128,230)'; c.fillRect(d + k * 128 - 1, f * 64, 3, 64);
      c.fillStyle = 'rgb(166,128,230)'; c.fillRect(d + k * 128 + 2, f * 64, 2, 64);
    }
  }
  return aPng(cv);
}

/** Textura de madera para el cofre. */
export async function texturaMadera() {
  const S = 256;
  const cv = new OffscreenCanvas(S, S);
  const c = cv.getContext('2d');
  c.fillStyle = '#8A6238'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    c.strokeStyle = `rgba(70,45,22,${0.15 + Math.random() * 0.3})`; c.lineWidth = 1 + Math.random() * 2;
    c.beginPath(); const y = Math.random() * S; c.moveTo(0, y);
    for (let x = 0; x <= S; x += 32) c.lineTo(x, y + Math.sin(x / 40 + i) * 4);
    c.stroke();
  }
  c.fillStyle = 'rgba(50,30,15,.7)';
  for (let k = 1; k < 4; k++) c.fillRect(0, k * 64 - 1, S, 3);
  return aPng(cv);
}
