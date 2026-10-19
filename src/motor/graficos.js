// Calidad gráfica: niveles, detección de la tarjeta gráfica y ajuste automático por FPS.

export const ORDEN_CALIDAD = ['baja', 'media', 'alta', 'ultra'];

// Cada nivel decide qué partes de la iluminación se usan y con qué detalle.
export const CALIDADES = {
  baja: {
    nombre: 'Baja', descripcion: 'Gráficas integradas y equipos modestos',
    gi: false, ao: false, bloom: false, reflejos: false,
    sombras: 1024, msaa: 0, escala: 1,
    sombrasPuntuales: 0, sombraSuave: 1, espejosPlanos: 0, espejosCurvos: 0,
  },
  media: {
    nombre: 'Media', descripcion: 'GTX 1060 · RX 580 · Intel Arc · Apple M1',
    gi: true, celda: 3, maxSondas: 600, maxSondasVolumen: 300, cubo: 8, presupuesto: 3, msGI: 1.5, rebotes: 2,
    ao: true, aoEscala: 0.5, aoMuestras: 8, bloom: true, reflejos: true, reflejoTam: 128, reflejoIntervalo: 0.5, exposicionAuto: true,
    sombras: 2048, msaa: 2, escala: 1.25,
    sombrasPuntuales: 2, sombraPuntualTam: 512, sombraHz: 20, sombraSuave: 1.5, goteo: 0.1, espejosPlanos: 1, espejoEscala: 0.5, espejoHz: 30, espejosCurvos: 1, curvoTam: 128, curvoIntervalo: 1,
  },
  alta: {
    nombre: 'Alta', descripcion: 'RTX 2060 o superior · RX 5700 o superior',
    gi: true, celda: 2, maxSondas: 1600, maxSondasVolumen: 700, cubo: 16, presupuesto: 6, msGI: 3, rebotes: 2,
    ao: true, aoEscala: 0.5, aoMuestras: 12, bloom: true, reflejos: true, reflejoTam: 256, reflejoIntervalo: 0.25, exposicionAuto: true,
    sombras: 2048, msaa: 4, escala: 1.5,
    sombrasPuntuales: 4, sombraPuntualTam: 1024, sombraHz: 30, sombraSuave: 2, goteo: 0.25, espejosPlanos: 3, espejoEscala: 0.75, espejoHz: 0, espejosCurvos: 2, curvoTam: 256, curvoIntervalo: 0.33,
  },
  ultra: {
    nombre: 'Ultra', descripcion: 'RTX 3070 o superior · RX 6800 o superior',
    gi: true, celda: 1.25, maxSondas: 3000, maxSondasVolumen: 1000, cubo: 16, presupuesto: 10, msGI: 4.5, rebotes: 2,
    ao: true, aoEscala: 0.75, aoMuestras: 16, bloom: true, reflejos: true, reflejoTam: 512, reflejoIntervalo: 0.1, exposicionAuto: true,
    sombras: 4096, msaa: 4, escala: 2,
    sombrasPuntuales: 8, sombraPuntualTam: 1024, sombraHz: 60, sombraSuave: 2.5, goteo: 0.5, espejosPlanos: 6, espejoEscala: 1, espejoHz: 0, espejosCurvos: 4, curvoTam: 256, curvoIntervalo: 0.1,
  },
};

export const NOMBRES_OPCION = { automatica: 'Automática', baja: 'Baja', media: 'Media', alta: 'Alta', ultra: 'Ultra' };

/** Nombre de la tarjeta gráfica tal como lo da el controlador (o '' si no se puede saber). */
export function nombreGPU(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch { return ''; }
}

/** ¿Puede esta gráfica usar la iluminación global? (texturas 3D en coma flotante con filtrado) */
export function soportaGI(renderer) {
  const ext = renderer.extensions;
  return !!(renderer.capabilities.isWebGL2 && ext.has('EXT_color_buffer_float') && ext.has('OES_texture_float_linear'));
}

/**
 * Elige un nivel a partir del nombre de la gráfica. Si no se reconoce, se
 * empieza en «media» y el ajuste automático baja el nivel si va lento.
 */
export function detectarCalidad(renderer) {
  const gpu = nombreGPU(renderer);
  const g = gpu.toLowerCase();
  let nivel = 'media';
  const num = (re) => { const m = re.exec(g); return m ? Number(m[1]) : 0; };
  if (/swiftshader|llvmpipe|software|microsoft basic|virgl|softpipe/.test(g)) nivel = 'baja';
  else if (/rtx\s*(50|40|30)\d0|rtx\s*a\d{4}|rx\s*(9|7|6)[89]\d0|radeon pro w7/.test(g)) nivel = /rtx\s*(50|40)\d0|rtx\s*30[789]0|rx\s*[79][89]\d0/.test(g) ? 'ultra' : 'alta';
  else if (/rtx\s*20\d0|rtx\s*30[56]0|rx\s*(5[67]00|6[67]\d0|7[67]00)|arc\s*a7/.test(g)) nivel = 'alta';
  else if (/gtx\s*1[06][5-8]0|gtx\s*16|rx\s*(5[0-9]{2}|5500|5600)|arc|apple m[2-4]|radeon 7[68]0m|radeon 890m/.test(g)) nivel = 'media';
  else if (/gtx\s*(9|10[35]0)|mx\s*\d|apple m1/.test(g)) nivel = 'media';
  else if (/intel|uhd|iris|hd graphics|mali|adreno|powervr|vivante|videocore|radeon(\(tm\))? graphics|vega \d/.test(g)) nivel = /iris xe|arc/.test(g) ? 'media' : 'baja';
  if (nivel !== 'baja' && !soportaGI(renderer)) nivel = 'baja';
  return { nivel, gpu };
}

/**
 * Resuelve la opción elegida («automatica» o un nivel) al nivel real.
 * Aplica límites de la gráfica (sin soporte de GI no puede pasar de «baja» con GI).
 */
export function resolverCalidad(opcion, renderer) {
  if (!opcion || opcion === 'automatica') return detectarCalidad(renderer).nivel;
  return CALIDADES[opcion] ? opcion : 'media';
}

/** Ajuste automático: si en modo «automática» el juego va lento, baja un nivel. */
export class AjusteAutomatico {
  constructor(alCambiar) {
    this.alCambiar = alCambiar;
    this.tiempo = 0; this.cuadros = 0; this.esperar = 3; this.activo = true;
  }
  reiniciar() { this.tiempo = 0; this.cuadros = 0; this.esperar = 3; }
  medir(dt, nivelActual) {
    if (!this.activo) return;
    if (this.esperar > 0) { this.esperar -= dt; return; }
    this.tiempo += dt; this.cuadros++;
    if (this.tiempo < 4) return;
    const fps = this.cuadros / this.tiempo;
    this.tiempo = 0; this.cuadros = 0;
    const i = ORDEN_CALIDAD.indexOf(nivelActual);
    if (fps < 42 && i > 0) { this.esperar = 3; this.alCambiar(ORDEN_CALIDAD[i - 1], fps); }
  }
}
