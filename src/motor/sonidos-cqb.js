// Efectos originales sintetizados, sin muestras ni sonidos de otros juegos.
export function sonidoCQB(tipo = 'carabina') {
  const tasa = 22050, duracion = tipo === 'pistola' ? 0.17 : 0.23, n = Math.round(tasa * duracion);
  const bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
  const texto = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  texto(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); texto(8, 'WAVE'); texto(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, tasa, true); v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); texto(36, 'data'); v.setUint32(40, n * 2, true);
  let semilla = tipo === 'pistola' ? 1807 : tipo === 'enemigo' ? 2719 : 811, suave = 0;
  for (let i = 0; i < n; i++) {
    const t = i / tasa; semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    const ruido = semilla / 2147483648 - 1; suave = suave * 0.74 + ruido * 0.26;
    const grave = Math.sin(2 * Math.PI * (tipo === 'pistola' ? 145 : 92) * t) * Math.exp(-t * 58);
    const golpe = (ruido * 0.50 + suave * 0.65) * Math.exp(-t * (tipo === 'pistola' ? 48 : 37));
    const cola = suave * Math.exp(-t * 15) * 0.15;
    const muestra = Math.tanh((golpe + grave * 0.37 + cola) * 1.2) * Math.min(1, t * 2500);
    v.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, muestra * 29000)), true);
  }
  return bytes;
}
