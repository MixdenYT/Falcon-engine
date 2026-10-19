// Iconos propios de Falcon: trazo de 2 px, esquinas redondeadas, cuadrícula de 24.
// Color por familia: turquesa 2D, ámbar 3D, lila interfaz, verde lógica.

const P = {
  imagen: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M6.5 16l4-4.5 3 3 2-2 2.5 3.5"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  persona: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 19.5c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5"/>',
  camara: '<rect x="3" y="7" width="12.5" height="10" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
  cubo: '<path d="M12 3.2l8 4.4v8.8l-8 4.4-8-4.4V7.6z"/><path d="M4 7.6l8 4.4 8-4.4M12 12v8.8"/>',
  bombilla: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.7h5.2v-.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z"/>',
  globo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z"/>',
  boton: '<rect x="3.5" y="8" width="17" height="8" rx="2.5"/><path d="M8 12h8"/>',
  texto: '<path d="M6 5.5h12M12 5.5v13M9.5 18.5h5"/>',
  blueprint: '<rect x="3.5" y="4" width="6.5" height="6" rx="1.6"/><rect x="14" y="14" width="6.5" height="6" rx="1.6"/><path d="M10 7h2.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 0 1.5 1.5"/>',
  rayo: '<path d="M13 3L5.5 13.5h5.5L10.5 21 18.5 10.5H13z"/>',
  codigo: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/>',
  altavoz: '<path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  silencio: '<path d="M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  carpeta: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  carpetaAbierta: '<path d="M3.5 17.5V7.5a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2v1"/><path d="M3.5 17.5l2.4-6a2 2 0 0 1 1.9-1.3h12.7l-2.6 7.3a2 2 0 0 1-1.9 1.3H5.4a1.9 1.9 0 0 1-1.9-1.3z"/>',
  archivo: '<path d="M7 3.5h6.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-14A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8H18"/>',
  escena: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M9.5 9v11"/>',
  mosaicos: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  moneda: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9"/>',
  colision: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  nodo: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  ojoCerrado: '<path d="M4 4l16 16M10.6 6.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 7.6C4 9.4 2.5 12 2.5 12S6 18.5 12 18.5a8.6 8.6 0 0 0 3.6-.8"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  play: '<path d="M7.5 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pausa: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor"/>',
  paso: '<path d="M6.5 5.5v13l8.5-6.5zM18 5.5v13"/>',
  reiniciar: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4.5v4h-4"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  minimizar: '<path d="M5.5 12h13"/>',
  maximizar: '<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>',
  restaurar: '<rect x="5" y="8.5" width="10.5" height="10.5" rx="1.5"/><path d="M8.5 8.5V6.5A1.5 1.5 0 0 1 10 5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 16h-2.5"/>',
  descargar: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  subir: '<path d="M12 15.5v-11M7.5 9L12 4.5 16.5 9M5 19.5h14"/>',
  libro: '<path d="M5 4.5h10.5a2 2 0 0 1 2 2V19.5H6.5A1.5 1.5 0 0 1 5 18z"/><path d="M5 18a1.5 1.5 0 0 1 1.5-1.5h11"/>',
  ajustes: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  plantillas: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  cursor: '<path d="M6 4l12 6.5-5.2 1.6L10.5 18z"/>',
  mover: '<path d="M12 3.5v17M3.5 12h17M9.5 6L12 3.5 14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5L3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5"/>',
  rotar: '<path d="M18.5 12a6.5 6.5 0 1 1-1.9-4.6"/><path d="M18.5 4.5v3.5H15"/>',
  escalar: '<path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6 6M4.5 19.5l6-6"/>',
  lapiz: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path d="M13 7l4 4"/>',
  borrador: '<path d="M8.5 19.5l-4-4a1.5 1.5 0 0 1 0-2.1L13.4 4.5a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L11 19.5zM19.5 19.5H11M9 9l6 6"/>',
  cuadricula: '<path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4M12 17v.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/>',
  flechaAbajo: '<path d="M7 10l5 5 5-5"/>',
  flechaArriba: '<path d="M7 14l5-5 5 5"/>',
  flechaDerecha: '<path d="M10 7l5 5-5 5"/>',
  flechaIzquierda: '<path d="M14 7l-5 5 5 5"/>',
  puntos: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  copiar: '<rect x="8" y="8" width="11.5" height="11.5" rx="2"/><path d="M16 8V6a1.5 1.5 0 0 0-1.5-1.5h-8A1.5 1.5 0 0 0 5 6v8a1.5 1.5 0 0 0 1.5 1.5H8"/>',
  papelera: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>',
  guardar: '<path d="M5 4.5h11l3.5 3.5v10A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5z"/><path d="M8 4.5v4.5h7V4.5M7.5 19.5v-6h9v6"/>',
  deshacer: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  rehacer: '<path d="M15 14l4.5-4.5L15 5"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  musica: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  fuente: '<path d="M5 19.5L12 4.5l7 15M7.8 14h8.4"/>',
  onda: '<path d="M3 12h2M6.5 8.5v7M10 5v14M13.5 8v8M17 10v4M20.5 11.5v1"/>',
  esfera: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12c0 2 3.8 3.5 8.5 3.5s8.5-1.5 8.5-3.5"/>',
  cilindro: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/>',
  plano: '<path d="M2.5 13L12 8.5l9.5 4.5L12 17.5z"/>',
  capsula: '<rect x="7.5" y="3" width="9" height="18" rx="4.5"/>',
  cono: '<path d="M12 3.5L5 18.5M12 3.5l7 15"/><ellipse cx="12" cy="18.5" rx="7" ry="2"/>',
  terreno: '<path d="M2.5 18.5l5-7 3.5 4 3-5 7.5 8z"/>',
  escalera: '<path d="M4 19.5h4v-4h4v-4h4v-4h4"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  material: '<circle cx="12" cy="12" r="8.5"/><path d="M8 8.5a5 5 0 0 1 5-1.5"/>',
  malla: '<path d="M12 3.2l8 4.4v8.8l-8 4.4-8-4.4V7.6z"/><path d="M4 7.6l16 8.8M20 7.6L4 16.4M12 3.2v17.6"/>',
  personaje3d: '<circle cx="12" cy="6.5" r="3"/><path d="M7.5 21v-6a4.5 4.5 0 0 1 9 0v6"/>',
  temporizador: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M10 3h4"/>',
  area: '<rect x="4" y="4" width="16" height="16" rx="2.5" stroke-dasharray="3 2.5"/>',
  plataforma: '<rect x="3.5" y="10" width="17" height="6" rx="1.5"/><path d="M3.5 12.5h17"/>',
  fondo: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 15l5-4 4 3 3-2 5 3.5"/>',
  panel: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 9h17"/>',
  pinchos: '<path d="M3 19.5l3.5-8 3.5 8 3.5-8 3.5 8 3.5-8"/>',
  bandera: '<path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6"/>',
  enemigo: '<path d="M5 19V11a7 7 0 0 1 14 0v8l-2.3-1.6L14.4 19 12 17.4 9.6 19l-2.3-1.6z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17.5" r=".9" fill="currentColor"/>',
  ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 16.8v.2"/>',
  exportar: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10"/>',
  importar: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  hoja: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h3.5"/>',
  objetivo: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
  capturar: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="3"/>',
  rayos: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4.5"/>',
  vida: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.4c0 5.4-7.5 10-7.5 10z"/>',
  cadena: '<path d="M4.5 12h15M4.5 12l3-3M4.5 12l3 3"/>',
  ordenar: '<path d="M4 6.5h16M4 12h10M4 17.5h6"/>',
  agrandar: '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>',
  pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
  luzPuntual: '<circle cx="12" cy="10" r="4"/><path d="M12 17v4M8.5 14.5l-2.5 3M15.5 14.5l2.5 3"/>',
  foco: '<path d="M8 4h8l-1.5 6h-5z"/><path d="M9.5 10L5 20h14l-4.5-10"/>',
  vacio: '',
};

/** Devuelve el SVG del icono como texto. */
export function icono(nombre, clase = '', tam = 18) {
  const p = P[nombre] ?? P.archivo;
  return `<svg class="ico ${clase}" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

export const NOMBRES_ICONOS = Object.keys(P);

// Logotipo: perfil de halcón geométrico en un cuadrado redondeado.
export function logo(tam = 32, variante = 'verde') {
  const fondo = { verde: '#3DDC84', oscuro: '#151A17', claro: '#E7EDE9', contorno: 'none' }[variante];
  const ave = { verde: '#06130B', oscuro: '#3DDC84', claro: '#050605', contorno: 'none' }[variante];
  const borde = variante === 'contorno' ? '<rect x="2" y="2" width="60" height="60" rx="16" fill="none" stroke="#3DDC84" stroke-width="3"/>' : '';
  const trazoAve = variante === 'contorno'
    ? `<path d="${PERFIL}" fill="none" stroke="#3DDC84" stroke-width="3" stroke-linejoin="round"/>`
    : `<path d="${PERFIL}" fill="${ave}"/><circle cx="40.5" cy="21" r="2.6" fill="${fondo}"/>`;
  return `<svg class="logo" width="${tam}" height="${tam}" viewBox="0 0 64 64" aria-label="Falcon Engine">${variante !== 'contorno' ? `<rect width="64" height="64" rx="17" fill="${fondo}"/>` : ''}${borde}${trazoAve}</svg>`;
}

// Silueta del halcón: cabeza curvada con el pico hacia la derecha y la cola partida abajo.
const PERFIL = 'M47.5 15.2 50.8 20.6 44.6 22.4C44.2 31.6 39.2 39.6 31.9 44.6L27.6 40.7 22.7 49.5 13.5 45.1C17 31.1 26.4 18.6 38.7 14.4 41.9 13.3 44.9 13.6 47.5 15.2Z';
