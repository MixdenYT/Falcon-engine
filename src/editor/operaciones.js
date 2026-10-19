// Operaciones sobre los nodos de una escena (todas se pueden deshacer).
import { est, bus, log, anotarEvento } from './estado.js';
import { crearNodo, buscarNodo, buscarPadre, clonarNodo, recorrer, tipo as tipoNodo, TIPOS, nuevoId } from '../motor/tipos.js';
import { seleccionar, nombreUnico, enviarAlJuego } from './acciones.js';

export function anadirNodo(doc, tipoId, op = {}) {
  let nuevo;
  doc.cambiar((e) => {
    const sel = op.padre ? buscarNodo(e.raiz, op.padre) : (doc.nodoSel || e.raiz);
    // Los nodos «hoja» (Sprite, Colisión…) no suelen tener hijos: se añade al lado.
    let padre = sel;
    if (!op.padre && sel !== e.raiz && ['Colision', 'Sprite', 'Etiqueta', 'Boton', 'Camara2D', 'Sonido'].includes(sel.tipo) && !['Colision', 'Sprite'].includes(tipoId)) padre = buscarPadre(e.raiz, sel.id) || e.raiz;
    if (tipoId === 'Etiqueta' || tipoId === 'Boton' || tipoId === 'PanelUI') {
      if (padre.tipo !== 'Interfaz' && !esDentroDeInterfaz(e.raiz, padre)) {
        let capa = e.raiz.hijos.find(h => h.tipo === 'Interfaz');
        if (!capa) { capa = crearNodo('Interfaz', 'Interfaz'); e.raiz.hijos.push(capa); }
        padre = capa;
      }
    }
    nuevo = op.nodo || crearNodo(tipoId, null, op.props || {});
    nuevo.nombre = nombreUnico(padre, op.nombre || nuevo.nombre);
    if (op.posicion && Array.isArray(nuevo.props.posicion)) nuevo.props.posicion = op.posicion.slice(0, nuevo.props.posicion.length);
    padre.hijos.push(nuevo);
  });
  seleccionar([nuevo.id], doc);
  log(`Añadido ${nuevo.nombre} (${tipoNodo(nuevo.tipo).nombreVisible})`);
  anotarEvento('anadido:' + nuevo.nombre.replace(/\d+$/, ''));
  return nuevo;
}

function esDentroDeInterfaz(raiz, n) {
  for (let p = buscarPadre(raiz, n.id); p; p = buscarPadre(raiz, p.id)) if (p.tipo === 'Interfaz') return true;
  return false;
}

export function eliminarNodos(doc, ids = doc.seleccion) {
  const lista = ids.filter(id => id !== doc.datos.raiz.id);
  if (!lista.length) return;
  doc.cambiar((e) => {
    for (const id of lista) {
      const p = buscarPadre(e.raiz, id);
      if (p) p.hijos = p.hijos.filter(h => h.id !== id);
    }
  });
  seleccionar([], doc);
}

export function duplicarNodos(doc, ids = doc.seleccion) {
  const nuevos = [];
  doc.cambiar((e) => {
    for (const id of ids) {
      if (id === e.raiz.id) continue;
      const n = buscarNodo(e.raiz, id), p = buscarPadre(e.raiz, id);
      if (!n || !p) continue;
      const c = clonarNodo(n);
      c.nombre = nombreUnico(p, n.nombre.replace(/\d+$/, '') || n.nombre);
      if (Array.isArray(c.props.posicion) && c.props.posicion.length === 2) { c.props.posicion[0] += 24; c.props.posicion[1] += 24; }
      if (Array.isArray(c.props.posicion) && c.props.posicion.length === 3) c.props.posicion[0] += 1;
      p.hijos.splice(p.hijos.indexOf(n) + 1, 0, c);
      nuevos.push(c.id);
    }
  });
  seleccionar(nuevos, doc);
}

export function copiarNodos(doc, ids = doc.seleccion) {
  const nodos = ids.map(id => buscarNodo(doc.datos.raiz, id)).filter(n => n && n !== doc.datos.raiz);
  if (!nodos.length) return;
  est.portapapeles = { tipo: 'nodos', dim: doc.dim, nodos: structuredClone(nodos) };
  log(`Copiado: ${nodos.map(n => n.nombre).join(', ')}`);
}

export function pegarNodos(doc) {
  const pp = est.portapapeles;
  if (!pp || pp.tipo !== 'nodos') return;
  const nuevos = [];
  doc.cambiar((e) => {
    const destino = doc.nodoSel || e.raiz;
    const padre = ['Sprite', 'Colision'].includes(destino.tipo) ? (buscarPadre(e.raiz, destino.id) || e.raiz) : destino;
    for (const n of pp.nodos) {
      const c = clonarNodo(n);
      c.nombre = nombreUnico(padre, c.nombre);
      padre.hijos.push(c);
      nuevos.push(c.id);
    }
  });
  seleccionar(nuevos, doc);
}

export function moverNodo(doc, id, nuevoPadreId, indice) {
  const e = doc.datos;
  if (id === e.raiz.id) return false;
  // No se puede meter un nodo dentro de sí mismo.
  const n = buscarNodo(e.raiz, id);
  if (!n || buscarNodo(n, nuevoPadreId)) return false;
  doc.cambiar((esc) => {
    const nodo = buscarNodo(esc.raiz, id);
    const viejo = buscarPadre(esc.raiz, id);
    const nuevo = buscarNodo(esc.raiz, nuevoPadreId);
    const i0 = viejo.hijos.indexOf(nodo);
    viejo.hijos.splice(i0, 1);
    let i = indice ?? nuevo.hijos.length;
    if (viejo === nuevo && i0 < i) i--;
    nuevo.hijos.splice(Math.max(0, Math.min(i, nuevo.hijos.length)), 0, nodo);
  });
  return true;
}

export function renombrarNodo(doc, id, nombre) {
  nombre = String(nombre).trim();
  if (!nombre) return;
  doc.cambiar((e) => { const n = buscarNodo(e.raiz, id); if (n) n.nombre = nombre; });
  enviarAlJuego({ tipo: 'propiedad', id, clave: 'nombre', valor: nombre });
}

/** Cambia una propiedad. «fusionar» agrupa cambios seguidos (arrastres) en un solo deshacer. */
export function cambiarProp(doc, id, clave, valor, op = {}) {
  doc.cambiar((e) => {
    const n = buscarNodo(e.raiz, id);
    if (!n) return;
    if (clave === 'visible') n.visible = valor;
    else n.props[clave] = valor;
  }, { fusionar: op.fusionar ?? `${id}:${clave}`, prop: clave, id });
  enviarAlJuego({ tipo: 'propiedad', id, clave, valor });
  anotarEvento('prop:' + clave);
}

export function cambiarNodo(doc, id, fn, desc) {
  doc.cambiar((e) => { const n = buscarNodo(e.raiz, id); if (n) fn(n); }, { desc });
}

export function cambiarExportado(doc, id, nombre, valor) {
  doc.cambiar((e) => { const n = buscarNodo(e.raiz, id); if (n) n.exportados[nombre] = valor; }, { fusionar: `${id}:exp:${nombre}` });
  enviarAlJuego({ tipo: 'exportado', id, nombre, valor });
}

// Tipos que se ofrecen en el menú «+» según la dimensión de la escena.
export function tiposMenu(dim) {
  const grupos = dim === '3D'
    ? [['3D', ['Nodo3D', 'Malla3D', 'Personaje3D', 'Luz3D', 'Camara3D', 'Entorno', 'VolumenLumbre']], ['Interfaz', ['Interfaz', 'Etiqueta', 'Boton', 'PanelUI']], ['Lógica y sonido', ['Temporizador', 'Sonido']]]
    : [['2D', ['Nodo2D', 'Personaje2D', 'Sprite', 'Colision', 'Area2D', 'Plataforma', 'Mosaicos', 'Camara2D', 'Fondo', 'Particulas2D']], ['Interfaz', ['Interfaz', 'Etiqueta', 'Boton', 'PanelUI']], ['Lógica y sonido', ['Temporizador', 'Sonido']]];
  return grupos;
}

export function existeTipo(id) { return !!TIPOS[id]; }
export { nuevoId };
