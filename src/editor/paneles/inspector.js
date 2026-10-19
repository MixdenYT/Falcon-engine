// Inspector de nodos con pestañas Inspector · Señales · Grupos.
import { est, bus, abrirDocumento, archivosDeTipo, log } from '../estado.js';
import { seleccionar, nuevoBlueprint, nuevoScript } from '../acciones.js';
import { cambiarProp, cambiarNodo, cambiarExportado, renombrarNodo, eliminarNodos, duplicarNodos, copiarNodos } from '../operaciones.js';
import { tipo as tipoNodo, COLORES_FAMILIA, recorrer, buscarNodo } from '../../motor/tipos.js';
import { contarNodos } from '../../motor/blueprints.js';
import { tipoRecurso, nombreBase, carpetaDe, sinExtension } from '../../motor/proyecto.js';
import { EVENTOS, analizarCodigo } from '../../aguila/index.js';
import { PRIMITIVAS } from '../../motor/escena3d.js';
import { icono } from '../../ui/iconos.js';
import { el, esc, $, $$, menu, menuBajo, dialogo, pedirTexto, interruptor, pintarDeslizador, avisar } from '../../ui/componentes.js';
import { ajustarTamanoImagen } from './arbol.js';

const NOMBRES_SECCION = { 'Transformación': 'Transformación' };
const cacheExportadas = new Map();

export function crearInspector(contenedor) {
  let pestana = 'inspector';
  const raiz = el(`<section class="panel inspector" style="flex:1">
    <div class="pestanas"><button data-p="inspector" class="activo">Inspector</button><button data-p="senales">Señales</button><button data-p="grupos">Grupos</button></div>
    <div class="desplazable cuerpo-insp"></div></section>`);
  contenedor.append(raiz);
  const cuerpo = $('.cuerpo-insp', raiz);
  $$('.pestanas button', raiz).forEach(b => b.onclick = () => { pestana = b.dataset.p; $$('.pestanas button', raiz).forEach(x => x.classList.toggle('activo', x === b)); pintar(); });

  function pintar() {
    const doc = est.activo;
    cuerpo.innerHTML = '';
    if (!doc || doc.tipo !== 'escena') { cuerpo.append(el(`<div class="vacio-insp">${icono('info', '', 26)}Abre una escena para ver aquí las propiedades de sus nodos.</div>`)); return; }
    if (doc.seleccion.length > 1) return pintarMultiple(doc);
    const n = doc.nodoSel;
    if (!n) return pintarEscena(doc);
    if (pestana === 'senales') return pintarSenales(doc, n);
    if (pestana === 'grupos') return pintarGrupos(doc, n);
    pintarNodo(doc, n);
  }

  // ---------- Nodo ----------
  function pintarNodo(doc, n) {
    const d = tipoNodo(n.tipo);
    const cab = el(`<div class="cab-nodo" style="padding-top:8px">
      <div class="caja-ico" style="color:${COLORES_FAMILIA[d.familia]}">${icono(d.icono, '', 18)}</div>
      <div class="t"><b class="nombre-edit" data-ayuda="Doble clic para renombrar">${esc(n.nombre)}</b><span>${esc(d.nombreVisible)}</span></div>
      <button class="btn-icono peq" data-a="mas">${icono('puntos', '', 16)}</button></div>`);
    cuerpo.append(cab);
    cab.querySelector('.nombre-edit').ondblclick = async () => {
      const v = await pedirTexto({ titulo: 'Renombrar nodo', etiqueta: 'Nombre', valor: n.nombre });
      if (v) renombrarNodo(doc, n.id, v);
    };
    cab.querySelector('[data-a=mas]').onclick = (e) => menuBajo(e.currentTarget, [
      { texto: 'Renombrar…', icono: 'lapiz', accion: () => cab.querySelector('.nombre-edit').ondblclick() },
      { texto: 'Duplicar', icono: 'copiar', atajo: 'Ctrl D', accion: () => duplicarNodos(doc), desactivado: n === doc.datos.raiz },
      { texto: 'Copiar', atajo: 'Ctrl C', accion: () => copiarNodos(doc) },
      { texto: 'Restablecer valores', icono: 'reiniciar', accion: () => cambiarNodo(doc, n.id, (x) => { for (const p of d.props) if (!['posicion', 'celdas'].includes(p.clave)) x.props[p.clave] = structuredClone(p.defecto); }) },
      '-',
      { texto: 'Eliminar', icono: 'papelera', peligro: true, desactivado: n === doc.datos.raiz, accion: () => eliminarNodos(doc) },
    ]);
    // Secciones de propiedades
    const secciones = new Map();
    for (const p of d.props) {
      if (p.tipo === 'oculto') continue;
      if (!secciones.has(p.seccion)) secciones.set(p.seccion, []);
      secciones.get(p.seccion).push(p);
    }
    for (const [titulo, props] of secciones) {
      const s = el(`<div class="seccion-insp"><div class="titulo-seccion">${esc(titulo)}</div></div>`);
      for (const p of props) s.append(campo(doc, n, p));
      cuerpo.append(s);
    }
    if (n.tipo === 'Mosaicos') cuerpo.append(el(`<div class="seccion-insp"><div style="font-size:13px;color:var(--texto-2);line-height:1.5">Usa el lápiz (B) en el visor para dibujar; con Mayús borras. ${Object.keys(n.props.celdas || {}).length} celdas.</div></div>`));
    cuerpo.append(seccionLogica(doc, n));
  }

  function fila(etiqueta, html, ayuda) {
    const f = el(`<div class="prop"><label>${esc(etiqueta)}</label><div class="valor">${html}</div>${ayuda ? `<div class="ayuda-prop">${esc(ayuda)}</div>` : ''}</div>`);
    return f;
  }

  function campo(doc, n, p) {
    const v = p.clave === 'visible' ? n.visible : n.props[p.clave];
    const fijar = (valor, fusionar) => { cambiarProp(doc, n.id, p.clave, valor, { fusionar }); };
    const num = (x) => Number.isFinite(Number(x)) ? Number(x) : 0;
    const redondo = (x) => Math.round(Number(x) * 1000) / 1000;
    switch (p.tipo) {
      case 'vector2': case 'vector3': case 'angulo3': case 'vector4': {
        const ejes = p.tipo === 'vector2' ? ['x', 'y'] : p.tipo === 'vector4' ? ['x', 'y', 'z', 'w'] : ['x', 'y', 'z'];
        const etq = p.tipo === 'vector4' ? ['←', '↑', '→', '↓'] : ejes.map(e => e.toUpperCase());
        const f = fila(p.etiqueta, `<div class="vector" style="flex:1">${ejes.map((e, i) => `<div class="eje"><b class="${e}">${etq[i]}</b><input data-i="${i}" value="${redondo(v?.[i] ?? 0)}${p.tipo === 'angulo3' ? '°' : ''}" spellcheck="false"></div>`).join('')}</div>`);
        $$('input', f).forEach(inp => {
          const aplicar = () => { const arr = (n.props[p.clave] || []).slice(); arr[Number(inp.dataset.i)] = num(inp.value.replace('°', '').replace(',', '.')); fijar(arr); };
          inp.onchange = aplicar;
          inp.onkeydown = (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const paso = (p.paso || (p.tipo === 'angulo3' ? 5 : 1)) * (e.shiftKey ? 10 : 1);
              inp.value = redondo(num(inp.value.replace('°', '')) + (e.key === 'ArrowUp' ? paso : -paso)) + (p.tipo === 'angulo3' ? '°' : '');
              aplicar();
            }
            if (e.key === 'Enter') inp.blur();
          };
          inp.onfocus = () => { inp.value = inp.value.replace('°', ''); inp.select(); };
        });
        return f;
      }
      case 'angulo': case 'numero': case 'entero': {
        const f = fila(p.etiqueta, `<input class="campo" value="${redondo(v ?? 0)}${p.tipo === 'angulo' ? '°' : ''}" spellcheck="false">`, p.ayuda);
        const inp = $('input', f);
        const aplicar = () => {
          let x = num(inp.value.replace('°', '').replace(',', '.'));
          if (p.tipo === 'entero') x = Math.round(x);
          if (p.min !== undefined) x = Math.max(p.min, x);
          if (p.max !== undefined) x = Math.min(p.max, x);
          fijar(x);
        };
        inp.onchange = aplicar;
        inp.onfocus = () => { inp.value = inp.value.replace('°', ''); inp.select(); };
        inp.onkeydown = (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const paso = (p.paso || 1) * (e.shiftKey ? 10 : 1); inp.value = redondo(num(inp.value) + (e.key === 'ArrowUp' ? paso : -paso)); aplicar(); }
          if (e.key === 'Enter') inp.blur();
        };
        return f;
      }
      case 'deslizador': {
        const f = fila(p.etiqueta, `<div class="desliz"><input type="range" class="deslizador" min="${p.min ?? 0}" max="${p.max ?? 1}" step="${p.paso ?? 0.01}" value="${v}"><span class="num">${redondo(v)}</span></div>`, p.ayuda);
        const r = $('input', f);
        pintarDeslizador(r);
        r.oninput = () => { $('.num', f).textContent = redondo(r.value); fijar(Number(r.value)); };
        return f;
      }
      case 'color': {
        const f = fila(p.etiqueta, `<div class="color"><input type="color" value="${esc(normalizarColor(v))}"><input type="text" value="${esc(String(v).toUpperCase())}" spellcheck="false"></div>`);
        const [c, t] = $$('input', f);
        c.oninput = () => { t.value = c.value.toUpperCase(); fijar(c.value.toUpperCase()); };
        t.onchange = () => { const x = normalizarColor(t.value); c.value = x; fijar(x.toUpperCase()); };
        return f;
      }
      case 'bool': {
        const textos = p.texto || ['Sí', 'No'];
        const f = fila(p.etiqueta, interruptor(!!v, v ? textos[0] : textos[1]));
        const inp = $('input', f);
        inp.onchange = () => { $('.txt', f).textContent = inp.checked ? textos[0] : textos[1]; fijar(inp.checked); };
        return f;
      }
      case 'texto': {
        const f = fila(p.etiqueta, `<input class="campo" value="${esc(v ?? '')}">`, p.ayuda);
        const inp = $('input', f);
        inp.oninput = () => fijar(inp.value);
        return f;
      }
      case 'opciones': {
        const f = fila(p.etiqueta, `<select class="campo">${p.opciones.map(([k, t]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`, p.ayuda);
        $('select', f).onchange = (e) => fijar(e.target.value);
        return f;
      }
      case 'nodo': {
        const nombres = [];
        recorrer(doc.datos.raiz, (x) => { if (x !== n) nombres.push(x.nombre); });
        const f = fila(p.etiqueta, `<select class="campo"><option value="">(el nodo padre)</option>${nombres.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`, p.ayuda);
        $('select', f).onchange = (e) => fijar(e.target.value);
        return f;
      }
      case 'recurso': return campoRecurso(doc, n, p, v, fijar);
      case 'malla': return campoMalla(doc, n, p, v, fijar);
    }
    return el('<div></div>');
  }

  function campoRecurso(doc, n, p, v, fijar) {
    const filtro = p.filtro;
    const lista = filtro === 'escena' ? est.archivos.filter(a => a.rel.endsWith('.fscn')) : archivosDeTipo(filtro);
    const f = fila(p.etiqueta, `<div class="recurso"><input class="campo" readonly value="${esc(v || '')}" placeholder="Ninguno · arrastra un archivo aquí"><button class="btn-icono peq" data-a="elegir">${icono('carpeta', '', 15)}</button>${v ? `<button class="btn-icono peq" data-a="quitar">${icono('cerrar', '', 14)}</button>` : ''}</div>`, p.ayuda);
    const aplicar = (rel) => {
      fijar(rel);
      if (filtro === 'imagen' && rel && n.tipo === 'Sprite') ajustarTamanoImagen(doc, rel, est.proyecto.ajustesImportacion(rel));
    };
    const elegir = (e) => menuBajo(e.currentTarget.closest('.recurso'), lista.length ? lista.map(a => ({ texto: a.rel, icono: filtro === 'imagen' ? 'imagen' : filtro === 'sonido' ? 'onda' : filtro === 'material' ? 'material' : 'archivo', marcado: a.rel === v, accion: () => aplicar(a.rel) })) : [{ texto: 'No hay archivos de este tipo', desactivado: true }]);
    $('[data-a=elegir]', f).onclick = elegir;
    $('input', f).onclick = elegir;
    const q = $('[data-a=quitar]', f);
    if (q) q.onclick = () => fijar('');
    const inp = $('input', f);
    inp.ondragover = (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) e.preventDefault(); };
    inp.ondrop = (e) => { const rel = e.dataTransfer.getData('text/falcon-archivo'); if (rel && (lista.some(a => a.rel === rel))) aplicar(rel); else avisar('Ese archivo no es del tipo adecuado.', 'aviso'); };
    if (filtro === 'material' && v) {
      const b = el(`<button class="btn texto peq" style="grid-column:2;justify-self:start">${icono('material', '', 14)}Editar material</button>`);
      b.onclick = () => abrirDocumento(v);
      f.append(b);
    }
    return f;
  }

  function campoMalla(doc, n, p, v, fijar) {
    const esPrim = PRIMITIVAS.includes(v);
    const f = el(`<div style="margin-bottom:8px"><div class="recurso-malla"><div class="mini">${icono(esPrim ? ({ esfera: 'esfera', cilindro: 'cilindro', plano: 'plano', capsula: 'capsula', cono: 'cono', terreno: 'terreno', escalera: 'escalera' }[v] || 'cubo') : 'cubo', '', 20)}</div><div style="min-width:0"><b>${esc(esPrim ? p.opciones.find(o => o[0] === v)?.[1] || v : nombreBase(v))}</b><span>${esc(esPrim ? 'Forma básica' : carpetaDe(v) + '/')}</span></div></div></div>`);
    const modelos = [...archivosDeTipo('modelo'), ...archivosDeTipo('malla')];
    f.querySelector('.recurso-malla').onclick = (e) => menuBajo(e.currentTarget, [
      { cabecera: 'Formas básicas' },
      ...p.opciones.map(([k, t]) => ({ texto: t, marcado: k === v, accion: () => fijar(k) })),
      { cabecera: 'Modelos del proyecto' },
      ...(modelos.length ? modelos.map(a => ({ texto: a.rel, marcado: a.rel === v, accion: () => fijar(a.rel) })) : [{ texto: 'Importa .glb desde Recursos', desactivado: true }]),
      ...(v.endsWith('.malla') ? ['-', { texto: 'Abrir en el editor de mallas', icono: 'malla', accion: () => abrirDocumento(v) }] : []),
    ]);
    f.ondragover = (e) => { if (e.dataTransfer.types.includes('text/falcon-archivo')) e.preventDefault(); };
    f.ondrop = (e) => { const rel = e.dataTransfer.getData('text/falcon-archivo'); if (/\.(glb|gltf|malla)$/i.test(rel)) fijar(rel); };
    return f;
  }

  // ---------- Lógica ----------
  function seccionLogica(doc, n) {
    const s = el(`<div class="seccion-insp"><div class="titulo-seccion">Lógica</div></div>`);
    if (n.blueprint) {
      const docBp = est.docs.find(d => d.rel === n.blueprint);
      const t = el(`<div class="tarjeta-logica"><div class="fila-flex">${icono('blueprint', '', 16)}<b>${esc(nombreBase(n.blueprint))}</b><span class="cuenta"></span><button class="btn-icono peq" data-a="quitar" data-ayuda="Quitar el Blueprint">${icono('cerrar', '', 13)}</button></div><button class="btn principal ancho" data-a="abrir">Abrir en Blueprints</button></div>`);
      const pintarCuenta = (bp) => { t.querySelector('.cuenta').textContent = `${contarNodos(bp)} nodos`; };
      if (docBp) pintarCuenta(docBp.datos); else est.proyecto.leerJSON(n.blueprint).then(pintarCuenta).catch(() => { t.querySelector('.cuenta').textContent = 'no se encuentra'; });
      t.querySelector('[data-a=abrir]').onclick = () => abrirDocumento(n.blueprint);
      t.querySelector('[data-a=quitar]').onclick = () => cambiarNodo(doc, n.id, x => { x.blueprint = null; });
      s.append(t);
    }
    if (n.script) {
      const t = el(`<div class="tarjeta-logica aguila"><div class="fila-flex">${icono('codigo', '', 16)}<b>${esc(nombreBase(n.script))}</b><span class="cuenta">Águila</span><button class="btn-icono peq" data-a="quitar" data-ayuda="Quitar el script">${icono('cerrar', '', 13)}</button></div><div class="exportadas"></div><button class="btn secundario ancho" data-a="abrir">Abrir en Águila</button></div>`);
      t.querySelector('[data-a=abrir]').onclick = () => abrirDocumento(n.script);
      t.querySelector('[data-a=quitar]').onclick = () => cambiarNodo(doc, n.id, x => { x.script = null; });
      pintarExportadas(doc, n, n.script, t.querySelector('.exportadas'));
      s.append(t);
    }
    if (n.blueprint) {
      const exp = el('<div></div>');
      pintarExportadas(doc, n, n.blueprint, exp);
      s.append(exp);
    }
    if (!n.blueprint) {
      const b = el(`<button class="anadir-logica" data-accion="anadir-blueprint">${icono('mas', '', 15)}Añadir Blueprint</button>`);
      b.onclick = (e) => {
        const existentes = archivosDeTipo('blueprint');
        const crear = async () => { const r = await nuevoBlueprint(n); if (r) { cambiarNodo(doc, n.id, x => { x.blueprint = r; }); abrirDocumento(r); } };
        if (!existentes.length) return crear();
        menuBajo(b, [{ texto: 'Nuevo Blueprint…', icono: 'mas', accion: crear }, { cabecera: 'Usar uno existente' }, ...existentes.map(a => ({ texto: a.rel, icono: 'blueprint', accion: () => cambiarNodo(doc, n.id, x => { x.blueprint = a.rel; }) }))]);
      };
      s.append(b);
    }
    if (!n.script) {
      const b = el(`<button class="anadir-logica aguila" data-accion="escribir-aguila">${icono('codigo', '', 15)}Escribir en Águila</button>`);
      b.onclick = () => {
        const existentes = archivosDeTipo('script').filter(a => !a.rel.startsWith('generado/'));
        const crear = async () => { const r = await nuevoScript(n); if (r) { cambiarNodo(doc, n.id, x => { x.script = r; }); abrirDocumento(r); } };
        if (!existentes.length) return crear();
        menuBajo(b, [{ texto: 'Nuevo script…', icono: 'mas', accion: crear }, { cabecera: 'Usar uno existente' }, ...existentes.map(a => ({ texto: a.rel, icono: 'codigo', accion: () => cambiarNodo(doc, n.id, x => { x.script = a.rel; }) }))]);
      };
      s.append(b);
    }
    return s;
  }

  // Variables «exportar variable» del script o Blueprint, editables por nodo.
  async function pintarExportadas(doc, n, rel, cont) {
    let vars = [];
    try {
      if (rel.endsWith('.bp')) {
        const d = est.docs.find(x => x.rel === rel);
        const bp = d ? d.datos : await est.proyecto.leerJSON(rel);
        vars = bp.variables.filter(v => v.exportar).map(v => ({ nombre: v.nombre, tipo: v.tipo, valor: v.valor }));
      } else {
        const d = est.docs.find(x => x.rel === rel);
        const texto = d ? d.datos : await est.proyecto.leer(rel);
        const a = analizarCodigo(texto);
        vars = a.simbolos.variables.filter(v => v.exportar).map(v => ({ nombre: v.nombre, tipo: v.tipo, valor: v.valor }));
      }
    } catch { return; }
    if (!vars.length) return;
    cont.append(el(`<div class="titulo-seccion" style="margin:4px 0 10px">${rel.endsWith('.bp') ? 'Variables del Blueprint' : 'Variables del script'}</div>`));
    for (const v of vars) {
      const actual = n.exportados[v.nombre] ?? v.valor;
      let f;
      if (typeof actual === 'boolean' || v.tipo === 'sí/no' || v.tipo === 'bool') {
        f = fila(v.nombre, interruptor(!!actual, actual ? 'Sí' : 'No'));
        $('input', f).onchange = (e) => { $('.txt', f).textContent = e.target.checked ? 'Sí' : 'No'; cambiarExportado(doc, n.id, v.nombre, e.target.checked); };
      } else {
        f = fila(v.nombre, `<input class="campo ${typeof actual === 'number' ? 'mono' : ''}" value="${esc(actual ?? '')}">`);
        $('input', f).onchange = (e) => {
          const x = typeof v.valor === 'number' || v.tipo === 'entero' || v.tipo === 'decimal' ? Number(e.target.value.replace(',', '.')) || 0 : e.target.value;
          cambiarExportado(doc, n.id, v.nombre, x);
        };
      }
      if (n.exportados[v.nombre] !== undefined) {
        const r = el(`<button class="btn-icono peq" data-ayuda="Volver al valor del script (${esc(v.valor)})">${icono('reiniciar', '', 13)}</button>`);
        r.onclick = () => cambiarNodo(doc, n.id, x => { delete x.exportados[v.nombre]; });
        $('.valor', f).append(r);
      }
      cont.append(f);
    }
  }

  // ---------- Selección múltiple y escena ----------
  function pintarMultiple(doc) {
    cuerpo.append(el(`<div class="vacio-insp">${icono('lista', '', 26)}<b style="display:block;color:var(--texto);margin-bottom:6px">${doc.seleccion.length} nodos seleccionados</b>Arrástralos juntos en el visor, duplícalos (Ctrl D) o bórralos (Supr).</div>`));
    const b = el(`<div style="padding:0 14px;display:flex;gap:8px"><button class="btn secundario crece" data-a="dup">${icono('copiar', '', 15)}Duplicar</button><button class="btn peligro crece" data-a="del">${icono('papelera', '', 15)}Eliminar</button></div>`);
    b.querySelector('[data-a=dup]').onclick = () => duplicarNodos(doc);
    b.querySelector('[data-a=del]').onclick = () => eliminarNodos(doc);
    cuerpo.append(b);
  }

  function pintarEscena(doc) {
    const principal = est.proyecto.datos.escena_principal === doc.rel;
    const c = el(`<div><div class="cab-nodo" style="padding-top:8px"><div class="caja-ico" style="color:var(--verde)">${icono('escena', '', 18)}</div><div class="t"><b>${esc(doc.titulo)}</b><span>Escena ${doc.dim}</span></div></div>
      <div class="seccion-insp"><div class="titulo-seccion">Escena</div>
        <div class="prop"><label>Principal</label><div class="valor">${interruptor(principal, principal ? 'Se abre al jugar' : 'No')}</div></div>
        <div class="prop"><label>Nodos</label><div class="valor mono" style="font-size:13px">${contar(doc.datos.raiz)}</div></div>
        <div class="prop"><label>Archivo</label><div class="valor mono" style="font-size:12px;color:var(--texto-2);word-break:break-all">${esc(doc.rel)}</div></div>
      </div>
      <div class="vacio-insp" style="padding-top:10px">Selecciona un nodo en el árbol o en el visor para ver sus propiedades.</div></div>`);
    $('input', c).onchange = async (e) => { if (e.target.checked) { est.proyecto.datos.escena_principal = doc.rel; await est.proyecto.guardar(); log(`Escena principal: ${doc.rel}`, 'ok'); } pintar(); };
    cuerpo.append(c);
  }

  // ---------- Señales ----------
  function pintarSenales(doc, n) {
    const d = tipoNodo(n.tipo);
    const cont = el(`<div class="seccion-insp lista-senales"><div class="titulo-seccion">Señales de ${esc(n.nombre)}</div></div>`);
    const eventos = EVENTOS.filter(e => e.nombre !== 'se_actualiza' || true);
    for (const ev of eventos) {
      const conexiones = n.senales.filter(s => s.evento === ev.nombre);
      const f = el(`<div class="senal" data-ayuda="${esc(ev.descripcion)}">${icono('rayo', '', 14)}<span class="mono">${esc(ev.nombre)}(${ev.params.join(', ')})</span><button class="btn-icono peq" style="margin-left:auto" data-ayuda="Conectar">${icono('enlace', '', 14)}</button></div>`);
      f.querySelector('button').onclick = () => conectarSenal(doc, n, ev.nombre);
      cont.append(f);
      for (const c of conexiones) {
        const cx = el(`<div class="conexion">→ ${esc(c.destino || n.nombre)}.${esc(c.funcion)}()<button class="btn-icono peq" style="margin-left:auto">${icono('cerrar', '', 12)}</button></div>`);
        cx.querySelector('button').onclick = () => cambiarNodo(doc, n.id, x => { x.senales = x.senales.filter(s => s !== x.senales.find(y => y.evento === c.evento && y.destino === c.destino && y.funcion === c.funcion)); });
        cont.append(cx);
      }
    }
    cuerpo.append(cont);
    cuerpo.append(el('<div class="vacio-insp" style="padding-top:4px;font-size:13px">Conecta un evento de este nodo con una función del script de otro nodo, sin escribir código: por ejemplo, cuando el Interruptor «toca», llamar a Puerta.abrir().</div>'));
  }

  async function conectarSenal(doc, n, evento) {
    const nombres = [];
    recorrer(doc.datos.raiz, (x) => nombres.push(x));
    const c = el(`<div><div class="fila"><label class="etiqueta-campo">Cuando ${esc(n.nombre)} lance «${esc(evento)}», llamar en el nodo</label><select class="campo" data-k="destino">${nombres.map(x => `<option value="${esc(x.nombre)}" ${x === n ? 'selected' : ''}>${esc(x.nombre)}${x.script || x.blueprint ? '' : ' (sin lógica)'}</option>`).join('')}</select></div>
      <div class="fila"><label class="etiqueta-campo">a la función</label><input class="campo mono" data-k="funcion" list="funciones-destino" placeholder="abrir"><datalist id="funciones-destino"></datalist></div></div>`);
    const sel = $('[data-k=destino]', c), lista = $('datalist', c);
    const rellenar = async () => {
      const x = nombres.find(y => y.nombre === sel.value);
      lista.innerHTML = '';
      for (const rel of [x?.script, x?.blueprint].filter(Boolean)) {
        try {
          if (rel.endsWith('.bp')) { const bp = await est.proyecto.leerJSON(rel); for (const f of bp.funciones) lista.append(el(`<option value="${esc(f.nombre)}">`)); }
          else { const a = analizarCodigo(await est.proyecto.leer(rel)); for (const f of a.simbolos.funciones) lista.append(el(`<option value="${esc(f.nombre)}">`)); }
        } catch {}
      }
    };
    sel.onchange = rellenar; rellenar();
    const r = await dialogo({ titulo: 'Conectar señal', contenido: c, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Conectar', tipo: 'principal', accion: () => ({ destino: sel.value, funcion: $('[data-k=funcion]', c).value.trim() }) }] });
    if (!r || !r.funcion) return;
    cambiarNodo(doc, n.id, x => { x.senales.push({ evento, destino: r.destino === n.nombre ? '' : r.destino, funcion: r.funcion }); });
  }

  // ---------- Grupos ----------
  function pintarGrupos(doc, n) {
    const todos = new Set();
    recorrer(doc.datos.raiz, (x) => x.grupos.forEach(g => todos.add(g)));
    const cont = el(`<div class="seccion-insp lista-grupos"><div class="titulo-seccion">Grupos de ${esc(n.nombre)}</div>
      <div class="fila-flex" style="margin-bottom:10px"><input class="campo" placeholder="Nombre del grupo, p. ej. enemigos"><button class="btn principal peq">Añadir</button></div></div>`);
    for (const g of n.grupos) {
      const f = el(`<div class="grupo-item">${icono('lista', '', 14)}<span class="mono">${esc(g)}</span><button class="btn-icono peq" style="margin-left:auto">${icono('cerrar', '', 12)}</button></div>`);
      f.querySelector('button').onclick = () => cambiarNodo(doc, n.id, x => { x.grupos = x.grupos.filter(y => y !== g); });
      cont.append(f);
    }
    if (!n.grupos.length) cont.append(el('<div class="vacio-texto" style="text-align:left;padding:4px 0">Este nodo no está en ningún grupo.</div>'));
    const otros = [...todos].filter(g => !n.grupos.includes(g));
    if (otros.length) {
      cont.append(el('<div class="titulo-seccion" style="margin:16px 0 8px">Grupos de la escena</div>'));
      const chips = el('<div style="display:flex;flex-wrap:wrap;gap:6px"></div>');
      for (const g of otros) { const ch = el(`<button class="chip">${icono('mas', '', 12)}${esc(g)}</button>`); ch.onclick = () => cambiarNodo(doc, n.id, x => { x.grupos.push(g); }); chips.append(ch); }
      cont.append(chips);
    }
    const inp = $('input', cont);
    const anadir = () => { const g = inp.value.trim(); if (g && !n.grupos.includes(g)) cambiarNodo(doc, n.id, x => { x.grupos.push(g); }); };
    $('button.principal', cont).onclick = anadir;
    inp.onkeydown = (e) => { if (e.key === 'Enter') anadir(); };
    cuerpo.append(cont);
    cuerpo.append(el(`<div class="vacio-insp" style="padding-top:4px;font-size:13px">Los grupos sirven para tratar muchos nodos a la vez: <span class="mono">grupo("enemigos")</span> o <span class="mono">otro.es("enemigos")</span>.</div>`));
  }

  // Repintar sin perder el foco de lo que se está escribiendo.
  const repintar = () => {
    if (raiz.contains(document.activeElement) && document.activeElement.matches('input:not([type=range]):not([type=checkbox]), select, textarea')) return;
    const s = cuerpo.scrollTop;
    pintar();
    cuerpo.scrollTop = s;
  };
  pintar();
  const quitar = [
    bus.on('doc:activo', pintar), bus.on('seleccion', () => { cuerpo.scrollTop = 0; pintar(); }),
    bus.on('doc:cambio', ({ doc, op }) => { if (doc === est.activo && !(op && op.prop && raiz.contains(document.activeElement))) repintar(); }),
    bus.on('doc:guardado', (d) => { if (d.tipo !== 'escena') repintar(); }),
  ];
  return { el: raiz, pintar, destruir: () => quitar.forEach(f => f()) };
}

function contar(n) { let c = 0; recorrer(n, () => { c++; }); return c; }

export function normalizarColor(v) {
  let s = String(v || '#000000').trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s.slice(1).split('').map(c => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : '#000000';
}
