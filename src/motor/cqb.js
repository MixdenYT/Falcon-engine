import { crearNodo } from './tipos.js';
import { datosProyecto, escenaVacia } from './proyecto.js';
import { blueprintsCQB } from './cqb-blueprints.js';

const N = (tipo, nombre, props = {}, hijos = [], extra = {}) => Object.assign(crearNodo(tipo, nombre, props, hijos), extra);
const caja = (nombre, pos, tam, color = '#99A5A4', extra = {}) => N('Malla3D', nombre, { posicion: pos, escala: tam, malla: 'cubo', color, rugosidad: 0.88, colision: 'caja', ...(color === '#99A5A4' ? { material: 'materiales/pared.mat' } : {}), ...extra });
const deco = (nombre, pos, tam, color, extra = {}) => caja(nombre, pos, tam, color, { colision: 'ninguna', sombras: false, ...extra });
const baliza = (nombre, x, z, grupo = '') => N('Nodo3D', nombre, { posicion: [x, 0, z] }, [], { grupos: grupo ? [grupo] : [] });

function puerta(nombre, x, z, yaw = 0, ancho = 1.6) {
  const hoja = N('Nodo3D', nombre, { descripcion: 'Puerta / Door' }, [
    caja('Hoja', [ancho / 2, 1.1, 0], [ancho, 2.2, 0.12], '#586E6B'),
    deco('Refuerzo', [ancho / 2, 0.33, 0.068], [ancho - 0.08, 0.5, 0.014], '#7F908D'),
    deco('Manilla', [ancho - 0.17, 1.03, 0.093], [0.20, 0.025, 0.08], '#C1C7C4', { metalico: 0.9, rugosidad: 0.28 }),
  ], { blueprint: 'blueprints/puerta_cqb.bp', grupos: ['interactuable'] });
  return N('Nodo3D', 'Marco' + nombre, { posicion: [x, 0, z], rotacion: [0, yaw, 0] }, [hoja,
    caja('MarcoBisagra', [-0.07, 1.14, 0], [0.14, 2.28, 0.28], '#304540'),
    caja('MarcoCierre', [ancho + 0.07, 1.14, 0], [0.14, 2.28, 0.28], '#304540'),
    caja('Dintel', [ancho / 2, 2.52, 0], [ancho + 0.28, 0.64, 0.28], '#7D908B'),
  ]);
}

export function escenaCQB({ personajes = true } = {}) {
  const a = [
    caja('Suelo', [0, -0.25, 0], [18, 0.5, 24], '#414B4A', { material: 'materiales/hormigon.mat' }),
    caja('Techo', [0, 3.05, 0], [18, 0.3, 24], '#C0C7BF'),
    caja('ExteriorO', [-9, 1.4, 0], [0.3, 2.8, 24]), caja('ExteriorE', [9, 1.4, 0], [0.3, 2.8, 24]),
    caja('ExteriorN', [0, 1.4, -12], [18, 2.8, 0.3]), caja('ExteriorS', [0, 1.4, 12], [18, 2.8, 0.3]),
    caja('EntradaO', [-4.9, 1.4, 7.5], [8.2, 2.8, 0.25]), caja('EntradaE', [4.9, 1.4, 7.5], [8.2, 2.8, 0.25]),
    // Huecos construidos con segmentos: no hay CSG dinámico ni collider invisible.
    caja('OficinaOesteSur', [-1.8, 1.4, 6.55], [0.25, 2.8, 1.9]),
    caja('OficinaOesteNorte', [-1.8, 1.4, 2.05], [0.25, 2.8, 4.1]),
    caja('OesteCiego', [-1.8, 1.4, -3.23], [0.25, 2.8, 6.46]),
    caja('OficinaFondo', [-5.4, 1.4, -0.1], [7.2, 2.8, 0.25]),
    caja('ArchivoSur', [5.4, 1.4, 2.1], [7.2, 2.8, 0.25]), caja('ArchivoNorte', [5.4, 1.4, -5.7], [7.2, 2.8, 0.25]),
    caja('ArchivoEsteSur', [1.8, 1.4, 1.525], [0.25, 2.8, 1.15]),
    caja('ArchivoEsteNorte', [1.8, 1.4, -3.125], [0.25, 2.8, 5.15]),
    caja('EsteCiego', [1.8, 1.4, 4.8], [0.25, 2.8, 5.4]),
    caja('ControlSurO', [-4.9, 1.4, -6.5], [8.2, 2.8, 0.25]), caja('ControlSurE', [4.9, 1.4, -6.5], [8.2, 2.8, 0.25]),
    puerta('PuertaAcceso', -0.8, 7.5), puerta('PuertaOficina', -1.8, 5.6, 90, 1.5), puerta('PuertaArchivo', 1.8, -0.55, -90, 1.5), puerta('PuertaControl', -0.8, -6.5),
    caja('MostradorOficina', [-5.2, 0.55, 2.7], [2.4, 1.1, 0.8], '#A99B78'),
    caja('ArmarioOficina', [-8.5, 1.1, 3.1], [0.65, 2.2, 3.1], '#617574'),
    caja('ColumnaOficina', [-5, 1.4, 5.9], [0.6, 2.8, 0.6], '#91A29D'),
    caja('PilaArchivo', [5.9, 0.7, -1.7], [2.1, 1.4, 1.05], '#B09A6C'),
    caja('EstanteriaArchivo', [8.25, 1.15, -2.4], [0.9, 2.3, 4.6], '#5E706F'),
    caja('CoberturaControl', [2.6, 0.56, -9.1], [2.8, 1.12, 0.8], '#647F79'),
    caja('ColumnaControl', [-4.4, 1.4, -9.1], [0.7, 2.8, 0.7]),
    caja('ColumnaArchivo', [5.4, 1.4, -3.6], [0.7, 2.8, 0.7]),
    caja('PilarControlEste', [4.2, 1.4, -9.7], [0.7, 2.8, 0.7]),
    caja('BarreraPasillo', [-1.0, 0.5, -3.5], [1.1, 1, 0.7], '#AC956C'),
    caja('BancoAcceso', [-5.8, 0.37, 10.8], [3.1, 0.74, 0.65], '#6C8078'),
    deco('PanelAcceso', [-8.8, 1.6, 9.8], [0.035, 1.0, 2], '#507B6C'),
    deco('FranjaRuta', [0, 0.008, 1], [0.055, 0.016, 17], '#CBB77A'),
    baliza('CubiertaOficina', -5.85, 6.15, 'cobertura'), baliza('CubiertaArchivo', 6.3, -4.25, 'cobertura'), baliza('CubiertaControl', 4.8, -10.3, 'cobertura'),
    baliza('RutaOficinaA', -4.1, 4.4), baliza('RutaOficinaB', -6.8, 4.4), baliza('RutaArchivoA', 4, -0.5), baliza('RutaArchivoB', 6.7, -0.5), baliza('RutaControlA', 1.5, -8), baliza('RutaControlB', 4.9, -8),
  ];
  for (const n of a.slice()) {
    if (n.tipo !== 'Malla3D' || n.props.escala[1] !== 2.8 || ![0.25, 0.3].some(v => n.props.escala[0] === v || n.props.escala[2] === v)) continue;
    const [x, , z] = n.props.posicion, [sx, , sz] = n.props.escala;
    a.push(deco('Zocalo' + n.nombre, [x, 0.37, z], [sx + 0.012, 0.74, sz + 0.012], '#637D73'));
    a.push(deco('Remate' + n.nombre, [x, 0.75, z], [sx + 0.024, 0.025, sz + 0.024], '#A7B4A6'));
  }
  for (let i = 0; i < 7; i++) {
    const [x, z] = [[0, 10], [0, 4], [0, -2], [-5.3, 3.5], [5.4, -1.8], [0, -9.5], [5.7, -9.5]][i];
    a.push(deco('Luminaria' + i, [x, 2.86, z], [1.15, 0.06, 0.32], '#E6E4CE', { emision: '#FFF3CC', intensidad_emision: 1.5 }));
    a.push(N('Luz3D', 'Luz' + i, { posicion: [x, 2.60, z], tipo_luz: 'puntual', intensidad: 3.2, alcance: 9.5, color: '#F9EBD3', sombras: i === 3 || i === 4 || i === 5 }));
  }
  const suministros = caja('Suministros', [4.8, 0.55, 10.8], [1.25, 1.1, 0.65], '#718C77');
  suministros.props.descripcion = 'Reponer munición / Refill ammunition'; suministros.blueprint = 'blueprints/suministros_cqb.bp'; suministros.grupos = ['interactuable']; a.push(suministros);
  const terminal = caja('Terminal', [0, 1.05, -11.1], [1.4, 0.55, 0.30], '#354A45');
  terminal.props.descripcion = 'Asegurar terminal / Secure terminal'; terminal.blueprint = 'blueprints/terminal_cqb.bp'; terminal.grupos = ['interactuable']; a.push(terminal);
  a.push(deco('PantallaTerminal', [0, 1.09, -10.94], [1.18, 0.36, 0.015], '#5DAE8A', { emision: '#377E61', intensidad_emision: 0.8 }));
  const enemigos = [
    ['CentinelaOficina', [-6.4, 0.02, 4.4], 'RutaOficinaA;RutaOficinaB'],
    ['CentinelaArchivo', [6.5, 0.02, -0.5], 'RutaArchivoA;RutaArchivoB'],
    ['CentinelaControl', [4.8, 0.02, -8], 'RutaControlA;RutaControlB'],
  ].map(([nombre, posicion, ruta_patru]) => N('Personaje3D', nombre, { posicion, altura: 1.76, controles: 'ninguno', velocidad: 1.4, color: '#9A7854', ruta_patru, arma_modelo: 'modelos/armas/hostil.glb', ...(personajes ? { modelo: 'modelos/personajes/enemigo.glb', animaciones_3d: 'modelos/personajes/enemigo.json' } : {}) }, [], { blueprint: 'blueprints/enemigo_cqb.bp', grupos: ['enemigos', 'enemigos_cqb'] }));
  return escenaVacia('3D', N('Nodo3D', 'UmbralCQB', {}, [
    N('Entorno', 'Entorno', { cielo: '#182323', horizonte: '#45564F', ambiente: 0.65, niebla: false, exposicion: 1.2, exposicion_automatica: false, intensidad_resplandor: 0.15 }),
    N('Nodo3D', 'Edificio', {}, a),
    N('Personaje3D', 'Jugador', { posicion: [0, 0.04, 10.1], altura: 1.78, controles: 'primera_persona', tactico: true, cambiar_vista: false, sensibilidad: 0.75, color: '#647A6A', ...(personajes ? { modelo: 'modelos/personajes/operador.glb', animaciones_3d: 'modelos/personajes/operador.json' } : {}) }, [N('Camara3D', 'Camara', { fov: 74, posicion: [0, 1.64, 0] })], { blueprint: 'blueprints/operador.bp' }),
    N('Nodo3D', 'Contactos', {}, enemigos),
  ]));
}

export function datosCQB(nombre) {
  const datos = datosProyecto(nombre, '3D');
  Object.assign(datos, { escena_principal: 'escenas/umbral_cqb.fscn', gravedad: 18, cqb: true, navegacion: [-8.5, -11.5, 8.5, 11.5] });
  Object.assign(datos.acciones, { saltar: [], cambiar_vista: [], accion: [], recargar: ['KeyR'], apuntar: ['Raton2'], agacharse: ['ControlLeft', 'ControlRight'], andar_lento: ['AltLeft'], inclinar_izquierda: ['KeyQ'], inclinar_derecha: ['KeyE'], interactuar: ['KeyF'], arma_1: ['Digit1'], arma_2: ['Digit2'], cambiar_arma: ['KeyT'], ayuda: ['KeyH'], idioma: ['KeyL'], sensibilidad_menos: ['BracketLeft'], sensibilidad_mas: ['BracketRight'] });
  datos.mando = {}; // Esta plantilla publica y verifica controles de teclado y ratón.
  return datos;
}

export async function plantillaCQB(nombre) {
  const base = new URL('../../recursos/cqb/', import.meta.url);
  const respuesta = await fetch(new URL('manifest.json', base));
  if (!respuesta.ok) throw Error('Falta el manifiesto de recursos CQB en el instalador.');
  const manifest = await respuesta.json();
  if (!['integrado', 'verificado'].includes(manifest.estado)) throw Error('Los personajes CQB todavía no están integrados.');
  const archivos = { ...blueprintsCQB(), 'escenas/umbral_cqb.fscn': escenaCQB(), 'GUIA_CQB.md': manifest.guia, 'GUIA_CQB_EN.md': manifest.guia_en, 'recursos-cqb.json': manifest };
  for (const rel of manifest.archivos) {
    const r = await fetch(new URL(rel, base)); if (!r.ok) throw Error('El instalador no contiene el recurso CQB ' + rel);
    const contenido = new Uint8Array(await r.arrayBuffer()); if (!contenido.byteLength) throw Error('Recurso CQB vacío: ' + rel);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', contenido))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.hashes[rel]) throw Error('Recurso CQB incompleto o dañado: ' + rel);
    archivos[rel] = contenido;
  }
  const carpetas = [...new Set(Object.keys(archivos).map(p => p.slice(0, p.lastIndexOf('/'))).filter(p => p && !p.includes('.')))];
  return { datos: datosCQB(nombre), archivos, carpetas, abrir: ['escenas/umbral_cqb.fscn'], importacion: {} };
}
