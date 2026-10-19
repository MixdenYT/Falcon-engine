// Disposición de los modos 2D y 3D: Escena + Archivos | pestañas + visor + panel inferior | Inspector.
import { est, bus } from '../estado.js';
import { nuevaEscena, nuevoScript, nuevoBlueprint, nuevoMaterial, abrirArchivo } from '../acciones.js';
import { crearPestanas } from '../paneles/documentos.js';
import { crearArbol } from '../paneles/arbol.js';
import { crearArchivos } from '../paneles/archivos.js';
import { crearInspector } from '../paneles/inspector.js';
import { crearInferior } from '../paneles/inferior.js';
import { crearVisor2D } from '../visores/visor2d.js';
import { icono } from '../../ui/iconos.js';
import { el, menu } from '../../ui/componentes.js';

export function menuNuevo(boton) {
  const r = boton.getBoundingClientRect();
  menu(r.left, r.bottom + 4, [
    { texto: 'Nueva escena 2D', icono: 'imagen', accion: () => nuevaEscena('2D') },
    { texto: 'Nueva escena 3D', icono: 'cubo', accion: () => nuevaEscena('3D') },
    { texto: 'Nuevo Blueprint', icono: 'blueprint', accion: async () => { const x = await nuevoBlueprint(null); if (x) abrirArchivo(x); } },
    { texto: 'Nuevo script de Águila', icono: 'codigo', accion: async () => { const x = await nuevoScript(null); if (x) abrirArchivo(x); } },
    { texto: 'Nuevo material', icono: 'material', accion: () => nuevoMaterial() },
  ]);
}

export async function crearDisposicionEscena(contenedor, dim) {
  const cuerpo = el('<div class="cuerpo"><div class="col-izq"></div><div class="col-centro"></div><div class="col-der"></div></div>');
  contenedor.append(cuerpo);
  const [izq, centro, der] = cuerpo.children;
  const partes = [];
  partes.push(crearArbol(izq));
  partes.push(crearArchivos(izq, { modo: dim === '3D' ? 'cuadricula' : 'lista' }));
  partes.push(crearPestanas(centro, { alNuevo: menuNuevo }));
  const doc = est.activo;
  if (doc && doc.tipo === 'escena') {
    if (dim === '3D') {
      const { crearVisor3D } = await import('../visores/visor3d.js');
      partes.push(await crearVisor3D(centro));
    } else partes.push(crearVisor2D(centro));
  } else {
    const v = el(`<section class="panel visor"><div class="vacio-visor"><div><b>No hay ninguna escena ${dim} abierta</b>Abre una desde Archivos o crea una nueva.<br><button class="btn principal">${icono('mas', '', 16)}Nueva escena ${dim}</button></div></div></section>`);
    v.querySelector('button').onclick = () => nuevaEscena(dim);
    centro.append(v);
  }
  partes.push(crearInferior(centro, { plegado: dim === '3D' ? est._inferiorPlegado3d ?? true : est._inferiorPlegado2d ?? false, alPlegar: (s) => { if (dim === '3D') est._inferiorPlegado3d = s; else est._inferiorPlegado2d = s; } }));
  partes.push(crearInspector(der));
  return { destruir: () => partes.forEach(p => p && p.destruir && p.destruir()) };
}
