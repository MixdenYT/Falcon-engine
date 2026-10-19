// Materiales de Falcon (.mat): un grafo de nodos que se convierte en un material de three.js.

export const PINES_SALIDA = [
  { n: 'color_base', etq: 'Color base', t: 'color' },
  { n: 'metalico', etq: 'Metálico', t: 'numero' },
  { n: 'brillo', etq: 'Brillo especular', t: 'numero' },
  { n: 'rugosidad', etq: 'Rugosidad', t: 'numero' },
  { n: 'emision', etq: 'Emisión (luz propia)', t: 'color' },
  { n: 'normal', etq: 'Normal (relieve)', t: 'direccion' },
  { n: 'opacidad', etq: 'Opacidad', t: 'numero' },
  { n: 'oclusion', etq: 'Oclusión', t: 'numero' },
];

export const NODOS_MATERIAL = {
  salida: { titulo: 'Material', entradas: PINES_SALIDA, salidas: [] },
  textura: { titulo: 'Textura', entradas: [], salidas: [{ n: 'color', t: 'color', etq: 'color' }, { n: 'alfa', t: 'numero', etq: 'alfa' }] },
  relieve: { titulo: 'Textura · relieve', entradas: [], salidas: [{ n: 'normal', t: 'direccion', etq: 'normal' }] },
  color: { titulo: 'Color', entradas: [], salidas: [{ n: 'color', t: 'color', etq: '' }] },
  numero: { titulo: 'Número', entradas: [], salidas: [{ n: 'valor', t: 'numero', etq: '' }] },
  multiplicar: { titulo: 'Multiplicar', entradas: [{ n: 'a', t: 'cualquiera', etq: 'A' }, { n: 'b', t: 'cualquiera', etq: 'B' }], salidas: [{ n: 'resultado', t: 'cualquiera', etq: 'resultado' }] },
  sumar: { titulo: 'Sumar', entradas: [{ n: 'a', t: 'cualquiera', etq: 'A' }, { n: 'b', t: 'cualquiera', etq: 'B' }], salidas: [{ n: 'resultado', t: 'cualquiera', etq: 'resultado' }] },
  mezclar: { titulo: 'Mezclar', entradas: [{ n: 'a', t: 'cualquiera', etq: 'A' }, { n: 'b', t: 'cualquiera', etq: 'B' }, { n: 't', t: 'numero', etq: 'cantidad' }], salidas: [{ n: 'resultado', t: 'cualquiera', etq: 'resultado' }] },
};

export const COLOR_TIPO_MAT = { color: '#F2C46D', numero: '#B5E35A', direccion: '#74B6F7', cualquiera: '#A9B5AE' };

export function hexARgb(h) {
  const s = String(h || '#000').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbAHex(c) {
  return '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Aplica los parámetros de una instancia de material sobre su grafo base. */
export function resolverInstancia(datos, base) {
  if (!base) return datos;
  const r = structuredClone(base);
  r.nombre = datos.nombre || base.nombre;
  for (const k of ['superficie', 'iluminacion', 'dos_caras', 'sombras', 'reflejo', 'reflejo_intensidad', 'reflejo_desenfoque', 'intensidad_emision']) if (datos[k] !== undefined) r[k] = datos[k];
  for (const n of r.grafo.nodos) if (n.parametro && datos.parametros && n.parametro in datos.parametros) n.valor = datos.parametros[n.parametro];
  return r;
}

/** Evalúa el grafo y devuelve los valores de cada pin del nodo Material. */
export function evaluarMaterial(mat) {
  const nodos = new Map((mat.grafo?.nodos || []).map(n => [n.id, n]));
  const llega = new Map();
  for (const c of mat.grafo?.conexiones || []) llega.set(c.a + ':' + c.entrada, c);
  const cache = new Map();
  const valor = (id, pin, pila = new Set()) => {
    const k = id + ':' + pin;
    if (cache.has(k)) return cache.get(k);
    if (pila.has(id)) return null;
    pila.add(id);
    const n = nodos.get(id);
    let r = null;
    if (n) {
      const entrada = (p) => { const c = llega.get(id + ':' + p); return c ? valor(c.de, c.salida, pila) : null; };
      switch (n.tipo) {
        case 'color': r = { t: 'color', c: hexARgb(n.valor) }; break;
        case 'numero': r = { t: 'num', v: Number(n.valor) || 0 }; break;
        case 'textura': r = pin === 'alfa' ? { t: 'texalfa', archivo: n.archivo } : { t: 'tex', archivo: n.archivo, tinte: [1, 1, 1] }; break;
        case 'relieve': r = { t: 'normal', archivo: n.archivo }; break;
        case 'multiplicar': case 'sumar': case 'mezclar': {
          const a = entrada('a'), b = entrada('b');
          const t = n.tipo === 'mezclar' ? (entrada('t')?.v ?? Number(n.t ?? 0.5)) : 0;
          r = combinar(n.tipo, a, b, t);
          break;
        }
      }
    }
    pila.delete(id);
    cache.set(k, r);
    return r;
  };
  const salida = [...nodos.values()].find(n => n.tipo === 'salida');
  const res = {};
  if (!salida) return res;
  for (const p of PINES_SALIDA) {
    const c = llega.get(salida.id + ':' + p.n);
    res[p.n] = c ? valor(c.de, c.salida) : null;
  }
  return res;
}

function combinar(op, a, b, t) {
  if (!a) return b; if (!b) return a;
  const f = op === 'multiplicar' ? (x, y) => x * y : op === 'sumar' ? (x, y) => x + y : (x, y) => x + (y - x) * t;
  if (a.t === 'num' && b.t === 'num') return { t: 'num', v: f(a.v, b.v) };
  if (a.t === 'color' && b.t === 'color') return { t: 'color', c: a.c.map((v, i) => f(v, b.c[i])) };
  if (a.t === 'color' && b.t === 'num') return { t: 'color', c: a.c.map(v => f(v, b.v)) };
  if (a.t === 'num' && b.t === 'color') return { t: 'color', c: b.c.map(v => f(a.v, v)) };
  const tex = a.t === 'tex' ? a : b.t === 'tex' ? b : null;
  const otro = tex === a ? b : a;
  if (tex) {
    if (otro.t === 'color') return { ...tex, tinte: tex.tinte.map((v, i) => op === 'multiplicar' ? v * otro.c[i] : v) };
    if (otro.t === 'num') return { ...tex, tinte: tex.tinte.map(v => op === 'multiplicar' ? v * otro.v : v) };
    return tex;
  }
  return a;
}

/**
 * Crea un material de three.js a partir de un .mat ya resuelto.
 * cargarTextura(rel, { srgb }) → THREE.Texture
 */
export function construirMaterial(THREE, mat, cargarTextura) {
  const v = evaluarMaterial(mat);
  const ilum = mat.iluminacion || 'realista';
  const Clase = ilum === 'sin_luz' ? THREE.MeshBasicMaterial : ilum === 'dibujo' ? THREE.MeshToonMaterial : THREE.MeshStandardMaterial;
  const m = new Clase();
  m.name = mat.nombre || 'material';
  const cb = v.color_base;
  if (cb) {
    if (cb.t === 'color') m.color.setRGB(...cb.c, THREE.SRGBColorSpace);
    if (cb.t === 'tex' && cb.archivo) { m.map = cargarTextura(cb.archivo, { srgb: true }); m.color.setRGB(...cb.tinte, THREE.SRGBColorSpace); }
  }
  if (Clase === THREE.MeshStandardMaterial) {
    m.metalness = v.metalico?.t === 'num' ? v.metalico.v : 0;
    m.roughness = v.rugosidad?.t === 'num' ? v.rugosidad.v : 0.8;
    if (v.rugosidad?.t === 'tex') m.roughnessMap = cargarTextura(v.rugosidad.archivo, {});
    if (v.brillo?.t === 'num') m.roughness = Math.max(0, m.roughness - v.brillo.v * 0.3);
    if (v.oclusion?.t === 'tex') m.aoMap = cargarTextura(v.oclusion.archivo, {});
  }
  if (v.normal?.t === 'normal' && v.normal.archivo && 'normalMap' in m) m.normalMap = cargarTextura(v.normal.archivo, {});
  if (v.emision && 'emissive' in m) {
    if (v.emision.t === 'color') { m.emissive.setRGB(...v.emision.c, THREE.SRGBColorSpace); m.emissiveIntensity = mat.intensidad_emision ?? 1.4; }
    if (v.emision.t === 'tex') { m.emissiveMap = cargarTextura(v.emision.archivo, { srgb: true }); m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = mat.intensidad_emision ?? 1; }
  } else if (v.emision && ilum === 'sin_luz' && v.emision.t === 'color') m.color.setRGB(...v.emision.c, THREE.SRGBColorSpace);
  const sup = mat.superficie || 'opaca';
  if (v.opacidad?.t === 'num' && v.opacidad.v < 1) { m.opacity = v.opacidad.v; m.transparent = true; }
  if (v.opacidad?.t === 'texalfa') { m.alphaMap = cargarTextura(v.opacidad.archivo, {}); m.transparent = sup !== 'recortada'; }
  if (sup === 'transparente') { m.transparent = true; m.depthWrite = false; if (m.opacity === 1) m.opacity = 0.5; }
  if (sup === 'recortada') { m.alphaTest = 0.5; m.transparent = false; }
  m.side = mat.dos_caras ? THREE.DoubleSide : THREE.FrontSide;
  m.userData.sombras = mat.sombras !== false;
  // Reflejos con Lumbre: «sonda» (de la escena), «plano» (espejo de verdad) o «curvo» (sonda propia).
  if (m.isMeshStandardMaterial && (mat.reflejo === 'plano' || mat.reflejo === 'curvo')) {
    m.userData.espejo = { tipo: mat.reflejo, intensidad: mat.reflejo_intensidad ?? 1, desenfoque: mat.reflejo_desenfoque ?? 1 };
  }
  return m;
}

// Plantillas del editor de materiales («Empezar desde plantilla»).
export const PLANTILLAS_MATERIAL = {
  Piedra: { color: '#C9BFAA', rugosidad: 0.85, metalico: 0, muestra: 'radial-gradient(circle at 35% 30%, #CFC6B4, #7E7666 60%, #3E3A33)' },
  Madera: { color: '#9A6A3C', rugosidad: 0.7, metalico: 0, muestra: 'radial-gradient(circle at 35% 30%, #D29A60, #8A5A2E 60%, #40260F)' },
  Metal: { color: '#C4C9CC', rugosidad: 0.3, metalico: 1, muestra: 'radial-gradient(circle at 35% 30%, #FFFFFF, #A7AEB2 45%, #3D4245)' },
  Vidrio: { color: '#A9C8D9', rugosidad: 0.05, metalico: 0.1, opacidad: 0.35, superficie: 'transparente', muestra: 'radial-gradient(circle at 35% 30%, #DDE8EE, #61798A 55%, #263540)' },
  Brillo: { color: '#3DDC84', rugosidad: 0.4, metalico: 0, emision: '#3DDC84', muestra: 'radial-gradient(circle at 40% 35%, #C9FFE1, #3DDC84 45%, #0B4426)' },
  Espejo: { color: '#E8ECEE', rugosidad: 0.02, metalico: 1, reflejo: 'plano', muestra: 'linear-gradient(160deg, #F4F8FA 0%, #9AA6AD 45%, #F4F8FA 55%, #56616A 100%)' },
  Cromo: { color: '#D8DCDF', rugosidad: 0.08, metalico: 1, reflejo: 'curvo', muestra: 'radial-gradient(circle at 35% 30%, #FFFFFF, #8D979E 40%, #1E2326 75%, #B7C0C6)' },
  Dibujo: { color: '#F7A26B', rugosidad: 1, metalico: 0, iluminacion: 'dibujo', muestra: 'linear-gradient(135deg, #FFC08F 50%, #B4602A 50%)' },
};
