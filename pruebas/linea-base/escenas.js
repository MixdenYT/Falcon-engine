// Escenas patrón de la línea base gráfica (GFX-00). Son datos: la página las monta con el código real
// del motor (render2d.js, escena3d.js, lumbre.js). Todo es estático para que las capturas se repitan.
// tolerancia: fracción máxima de píxeles distintos (ruido medido en 10 ejecuciones: S01/S02 0 px, S03 59–106 px).

const nodo = (id, tipo, props = {}, hijos = []) => ({ id, nombre: id, tipo, props, hijos, visible: true });

// Celdas de mosaico: un suelo con un escalón.
const celdas = {};
for (let x = -6; x <= 6; x++) celdas[`${x},3`] = 0;
for (let x = 2; x <= 4; x++) celdas[`${x},2`] = 0;

// Partículas congeladas: el render solo las dibuja; la simulación vive en Mundo.
const particulas = Array.from({ length: 24 }, (_, i) => ({ x: Math.cos(i * 0.7) * (20 + i * 2), y: Math.sin(i * 1.3) * 18, vida: 1 + (i % 4), max: 4 }));

export const ESCENAS = {
  S01: {
    nombre: 'Render 2D', tipo: '2d', tolerancia: 0.0005,
    camara: { x: 0, y: 20, zoom: 1.6 },
    raiz: nodo('raiz', 'Escena', {}, [
      nodo('fondo', 'Fondo', { color: '#16324A', color2: '#0B1A26' }),
      nodo('suelo', 'Mosaicos', { tam_celda: 16, color: '#2E5E3E', color_borde: '#6FBF73', celdas }),
      nodo('plataforma', 'Plataforma', { posicion: [-50, 0], ancho: 60, alto: 12, color: '#7A5230', color_borde: '#B98B57' }),
      // Escala, rotación y alpha; z invertida respecto al orden de los hijos para probar el orden de dibujo.
      nodo('estrella', 'Sprite', { posicion: [0, -10], forma: 'estrella', ancho: 28, alto: 28, color: '#F2C14E', rotacion: 20, escala: [1.4, 0.8], z: 2 }),
      nodo('jugador', 'Sprite', { posicion: [8, -4], forma: 'personaje', ancho: 24, alto: 32, color: '#4EA8F2', z: 1 }),
      nodo('fantasma', 'Sprite', { posicion: [-30, -24], forma: 'circulo', ancho: 22, alto: 22, color: '#E84B3C', opacidad: 0.5 }),
      // Atlas 2×2: se dibuja el fotograma 3.
      nodo('atlas', 'Sprite', { posicion: [40, -18], imagen: 'recursos/cqb/texturas/pared.png', ancho: 24, alto: 24, cuadro: 3 }),
      Object.assign(nodo('chispas', 'Particulas2D', { posicion: [0, 0], color: '#FFD27A', tam: 3 }), { _particulas: particulas }),
      nodo('hud', 'Interfaz', {}, [nodo('panel', 'PanelUI', { posicion: [8, 8], ancho: 90, alto: 20, color: '#000000', opacidad: 0.6 })]),
    ]),
    // Atlas 2×2 de la imagen del sprite.
    ajustes: { 'recursos/cqb/texturas/pared.png': { columnas: 2, filas: 2, filtro: 'pixel' } },
  },
  S02: {
    nombre: 'PBR Lab', tipo: '3d', calidad: 'baja', tolerancia: 0.0005,
    camara: { pos: [0, 2.6, 7.5], mira: [0, 0.6, 0], fov: 45 },
    // Rejilla de esferas: metálico por filas, rugosidad por columnas; más un emisor y un transparente pendientes de material propio.
    raiz: nodo('raiz', 'Escena', {}, [
      nodo('entorno', 'Entorno', { cielo: '#1B2A3A', horizonte: '#6B7C8C', ambiente: 0.4 }),
      nodo('sol', 'Luz3D', { tipo_luz: 'direccional', intensidad: 2.5, sombras: true, posicion: [4, 8, 5], rotacion: [-50, 35, 0] }),
      nodo('suelo', 'Malla3D', { malla: 'plano', escala: [12, 1, 8], color: '#8A8F8C', rugosidad: 0.9 }),
      ...[0, 1].flatMap(f => [0, 1, 2, 3].map(c => nodo(`esfera_${f}_${c}`, 'Malla3D', {
        malla: 'esfera', posicion: [-2.25 + c * 1.5, 0.6 + f * 1.3, 0], escala: [1, 1, 1],
        color: f ? '#D9A441' : '#C0392B', metalico: f, rugosidad: [0.05, 0.35, 0.65, 0.95][c],
      }))),
    ]),
  },
  S03: {
    nombre: 'Lumbre Interior', tipo: '3d', calidad: 'media', tolerancia: 0.004,
    camara: { pos: [0, 1.6, 3.6], mira: [0, 1.2, -1], fov: 60 },
    // Habitación cerrada con una ventana, una bombilla y un objeto rojo que debe teñir el suelo por GI.
    raiz: nodo('raiz', 'Escena', {}, [
      nodo('entorno', 'Entorno', { cielo: '#8EC3F0', horizonte: '#DDE8F0', ambiente: 0.5, iluminacion_global: true, exposicion_automatica: false }),
      nodo('sol', 'Luz3D', { tipo_luz: 'direccional', intensidad: 3, sombras: true, posicion: [6, 6, -6], rotacion: [-35, 135, 0] }),
      nodo('bombilla', 'Luz3D', { tipo_luz: 'puntual', intensidad: 3, alcance: 8, sombras: true, color: '#FFD9A0', posicion: [-1.5, 2.4, -1] }),
      nodo('suelo', 'Malla3D', { malla: 'cubo', posicion: [0, -0.1, -1], escala: [6, 0.2, 6], color: '#C8C2B8' }),
      nodo('techo', 'Malla3D', { malla: 'cubo', posicion: [0, 3.1, -1], escala: [6, 0.2, 6], color: '#C8C2B8' }),
      nodo('pared_fondo', 'Malla3D', { malla: 'cubo', posicion: [0, 1.5, -4], escala: [6, 3, 0.2], color: '#B8C4C8' }),
      nodo('pared_izq', 'Malla3D', { malla: 'cubo', posicion: [-3, 1.5, -1], escala: [0.2, 3, 6], color: '#B8C4C8' }),
      // Pared derecha partida en dos para dejar una ventana por la que entra el sol.
      nodo('pared_der_a', 'Malla3D', { malla: 'cubo', posicion: [3, 1.5, -2.9], escala: [0.2, 3, 2.2], color: '#B8C4C8' }),
      nodo('pared_der_b', 'Malla3D', { malla: 'cubo', posicion: [3, 1.5, 0.9], escala: [0.2, 3, 2.2], color: '#B8C4C8' }),
      nodo('caja_roja', 'Malla3D', { malla: 'cubo', posicion: [0.8, 0.5, -1.8], escala: [1, 1, 1], color: '#D23A2E' }),
      nodo('columna', 'Malla3D', { malla: 'cilindro', posicion: [-1, 1, -2.4], escala: [0.5, 2, 0.5], color: '#E0E0E0', rugosidad: 0.3 }),
    ]),
  },
};
