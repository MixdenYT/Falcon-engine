import { logo, icono } from '../ui/iconos.js';
import { el, esc, avisar } from '../ui/componentes.js';

const corazon = '<svg class="corazon" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M12 21 3 12C-3 5 6-1 12 6 18-1 27 5 21 12Z"/></svg>';
const niveles = [
  { id: '4558101', nombre: 'Polluelo', precio: 3, lema: 'Apoya el nido', clase: 'polluelo', texto: 'Tu aportación da más tiempo al desarrollo.', beneficios: ['Devlogs exclusivos con avances, capturas y decisiones del motor', 'Tu nombre o alias en los créditos de agradecimiento, si quieres', 'Comunidad de Falcon Engine'], nota: 'Gracias por formar parte del comienzo de Falcon Engine.' },
  { id: '4558100', nombre: 'Halcón', precio: 6, lema: 'Vuela con el motor', clase: 'halcon', texto: 'Todo lo de Polluelo, más:', beneficios: ['Acceso anticipado a versiones de prueba cuando haya compilaciones', 'Encuestas para priorizar las próximas funciones', 'Comunidad de Falcon Engine'], nota: 'Las versiones de prueba pueden contener errores.' },
  { id: '4558099', nombre: 'Halcón Peregrino', precio: 12, lema: 'El más rápido del cielo', clase: 'peregrino', texto: 'Todo lo de Halcón y Polluelo, más:', beneficios: ['Acceso al código de Falcon Engine en GitHub, sujeto a la licencia y disponibilidad', 'Tu nombre o alias destacado en los agradecimientos del editor cuando se integren', 'Comunidad de Falcon Engine'], nota: 'El acceso al código no concede derechos de modificación o redistribución.' },
];
const abrirUrl = url => window.falcon.sistema.abrirUrl(url);
const membresias = 'https://www.patreon.com/3909625/join';
let estado = null, modalActualizacion = null, seleccion = niveles[0], accionPendiente = false;

export function tarjetaApoyo() {
  return `<section class="tarjeta-apoyo"><div class="aves-apoyo"><span class="polluelo">${logo(31, 'contorno')}</span>${logo(40)}<span class="peregrino">${logo(30)}</span></div><b>Ayuda a Falcon a volar</b><p>Falcon es gratis y lo crea Mixden. Tu apoyo trae nuevas funciones antes.</p><button class="btn principal" data-comunidad="apoyar">${corazon}Apoyar en Patreon</button><small>Desde 3 $ al mes · + IVA</small></section>`;
}
export function botonApoyo() { return `<button class="btn secundario btn-apoyar" data-comunidad="apoyar">${corazon}Apoyar</button>`; }

function modal(clase, nombre) {
  const anterior = document.activeElement;
  const d = el(`<dialog class="falcon-dialog ${clase}" aria-label="${nombre}"><div class="modal-interior"></div></dialog>`);
  document.body.append(d);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-cerrar]')) d.close(); });
  d.addEventListener('close', () => { if (d === modalActualizacion) modalActualizacion = null; d.remove(); anterior?.focus?.(); }, { once: true });
  d.showModal();
  return d;
}
const cerrarBoton = `<button class="btn-icono cerrar-modal" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>`;
function cabeceraApoyo() {
  return `<header class="apoyo-banner">${cerrarBoton}<div class="decoracion-bp izquierda" aria-hidden="true"><span>Al actualizar<small>cada fotograma　 ▸</small></span><i></i><span>Acción pulsada<small>“saltar”</small></span></div><div class="banner-marca">${logo(64)}<div><strong>Falcon</strong><small>ENGINE</small></div></div><p>Crea videojuegos <b>en español</b> · 2D, 3D, Blueprints y Águila</p><span class="firma-mixden">UN PROYECTO DE MIXDEN</span><div class="decoracion-bp derecha" aria-hidden="true"><span>Saltar<small>fuerza　 ●</small></span><code>cuando se_pulsa("saltar"):<br>　si en_el_suelo():<br>　　saltar(420)</code></div></header>`;
}
function abrirApoyo() {
  if (document.querySelector('.modal-apoyo')) return;
  const d = modal('modal-apoyo', 'Apoyar el proyecto en Patreon');
  d.querySelector('.modal-interior').innerHTML = `${cabeceraApoyo()}<section class="apoyo-cuerpo"><div class="apoyo-intro"><div><h2>Ayuda a Falcon Engine a levantar el vuelo</h2><p>Falcon es gratis para todos. Las membresías de Patreon financian su desarrollo y te dan ventajas.</p></div><small>Precios mensuales en USD, + IVA</small></div><div class="niveles">${niveles.map((n, i) => `<button class="nivel ${n.clase}" data-nivel="${n.id}" aria-pressed="false">${!i ? '<div class="recomendado">RECOMENDADO POR MIXDEN</div>' : ''}<div class="nivel-cabecera"><small>NIVEL ${i + 1}</small><div>${logo(44, !i ? 'contorno' : 'verde')}</div><p>${n.lema}</p></div><div class="nivel-info"><div class="nivel-precio"><h3>${n.nombre}</h3><b>$${n.precio}<small>/mes</small></b></div><p>${n.texto}</p><ul>${n.beneficios.map(b => `<li><span>✓</span>${b}</li>`).join('')}</ul><p class="nota-nivel">${n.nota}</p></div></button>`).join('')}</div><div class="otras-ayudas"><b>¿Ahora no puedes?</b><span>También ayuda:</span><button class="btn secundario peq" data-otra="compartir">Compartir Falcon</button><button class="btn secundario peq" data-otra="seguir">Seguir a Mixden</button><button class="btn secundario peq" data-otra="errores">Reportar errores</button></div><small class="precios-aviso">Precios y ventajas orientativos. Consulta las condiciones vigentes en Patreon.</small></section><footer class="modal-pie"><div class="nivel-elegido"></div><div class="acciones"><button class="btn secundario sin-borde" data-cerrar>Ahora no</button><button class="btn principal" data-unirse>${corazon}Unirme en Patreon</button></div></footer>`;
  const pintar = () => {
    d.querySelectorAll('[data-nivel]').forEach(b => { const activo = b.dataset.nivel === seleccion.id; b.classList.toggle('seleccionado', activo); b.setAttribute('aria-pressed', String(activo)); });
    d.querySelector('.nivel-elegido').innerHTML = `<span class="${seleccion.clase}">${logo(34)}</span><div><b>Has elegido ${seleccion.nombre} · $${seleccion.precio}/mes</b><small>Se abrirá la página de Falcon Engine en Patreon en tu navegador.</small></div>`;
  };
  d.querySelectorAll('[data-nivel]').forEach(b => b.onclick = () => { seleccion = niveles.find(n => n.id === b.dataset.nivel); pintar(); });
  d.querySelector('[data-unirse]').onclick = () => abrirUrl(`https://www.patreon.com/checkout/Mixden?rid=${seleccion.id}&vanity=3909625`);
  d.querySelector('[data-otra=compartir]').onclick = async () => { try { await navigator.clipboard.writeText('https://mixden.net/falcon-engine/'); avisar('Enlace de Falcon copiado'); } catch { abrirUrl('https://mixden.net/falcon-engine/'); } };
  d.querySelector('[data-otra=seguir]').onclick = () => abrirUrl('https://mixden.net/');
  d.querySelector('[data-otra=errores]').onclick = () => abrirUrl('https://github.com/MixdenYT/Falcon-engine/issues');
  pintar();
  d.querySelector('[data-cerrar]').focus();
}
const etiquetas = { nuevo: 'NUEVO', mejorado: 'MEJORADO', corregido: 'CORREGIDO', seguridad: 'SEGURIDAD', otros: 'OTROS CAMBIOS' };
const notaSegura = texto => esc(texto).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
function tamano(n) { return Number.isFinite(n) && n > 0 ? `${(n / 1024 / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} MB` : 'tamaño pendiente'; }
function fecha(f) { const d = new Date(f); return f && !isNaN(d) ? d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : 'fecha no disponible'; }
function pintarActualizacion() {
  const d = modalActualizacion;
  if (!d || !estado) return;
  const foco = document.activeElement?.dataset?.u;
  const s = estado, r = s.release, ocupado = accionPendiente || ['descargando', 'comprobando', 'instalando'].includes(s.fase);
  const texto = s.fase === 'comprobando' ? 'Buscando nuevas versiones en GitHub…' : s.fase === 'actualizada' ? 'Ya tienes la última versión de este canal.'
    : s.fase === 'descargada' ? s.alSalir ? 'Se instalará cuando cierres Falcon.' : 'Descarga verificada. Lista para instalar.'
    : s.fase === 'descargando' ? `Descargando · ${Math.round(s.progreso?.porcentaje || 0)} %`
    : s.fase === 'instalando' ? 'Cerrando Falcon para instalar…' : s.fase === 'error' ? s.error
    : r ? s.instalable ? 'Lista para descargar' : 'Descarga manual para esta instalación portátil' : 'Comprueba si hay una nueva versión.';
  d.querySelector('.modal-interior').innerHTML = `<header class="actualizacion-banner">${logo(82)}<div><span class="canal-etiqueta">${r ? 'NUEVA VERSIÓN' : 'ACTUALIZACIONES'} · CANAL ${s.preferencias.canal === 'pruebas' ? 'PRUEBAS' : 'ESTABLE'}</span><h2>Falcon Engine ${esc(r?.version || s.versionActual)}</h2><p>${r ? `Publicada el ${esc(fecha(r.fecha))} · ` : ''}Tienes la ${esc(s.versionActual)}${r ? ' · Descarga de ' + tamano(r.tamano) : ''}</p></div>${cerrarBoton}</header><div class="actualizacion-columnas"><section class="novedades"><div class="novedades-titulo"><h3>Qué hay de nuevo</h3><button class="enlace" data-u="notas">Leer las notas completas ↗</button></div>${r ? Object.entries(etiquetas).map(([id, etiqueta]) => r.grupos?.[id]?.length ? `<div class="grupo-notas ${id}"><span class="etiqueta-notas">${etiqueta}</span>${r.grupos[id].map(n => `<article class="nota-release"><span class="nota-icono">${icono(id === 'corregido' ? 'pantalla' : id === 'mejorado' ? 'codigo' : 'capas', '', 21)}</span><p>${notaSegura(n.texto)}</p></article>`).join('')}</div>` : '').join('') || '<p class="muted">Esta release no incluye notas. Puedes consultarla en GitHub.</p>' : '<p class="muted">Las notas oficiales aparecerán aquí cuando haya una nueva versión.</p>'}</section><aside class="opciones-actualizacion"><h4>CANAL DE ACTUALIZACIONES</h4><div class="canales"><button data-u="estable" aria-pressed="${s.preferencias.canal === 'estable'}" ${ocupado || s.fase === 'descargada' ? 'disabled' : ''}>Estable</button><button data-u="pruebas" aria-pressed="${s.preferencias.canal === 'pruebas'}" ${ocupado || s.fase === 'descargada' ? 'disabled' : ''}>Pruebas</button></div><p class="muted">${s.preferencias.canal === 'estable' ? 'Versiones estables publicadas por el proyecto.' : 'Incluye versiones preliminares; pueden contener errores.'}</p><hr><h4>TUS PROYECTOS</h4><p class="muted">${icono('escudo')}Guarda y cierra tus proyectos antes de instalar. La actualización sustituye la aplicación, sin convertir tus proyectos.</p><label class="opcion-toggle"><input type="checkbox" data-u="copia" ${s.preferencias.copiaAjustes ? 'checked' : ''} ${ocupado || s.fase === 'descargada' ? 'disabled' : ''}><span>Copia de ajustes antes de instalar</span></label><small class="muted">Copia los ajustes y la lista de recientes. No copia las carpetas de los proyectos.</small><label class="opcion-toggle"><input type="checkbox" data-u="avisar" ${s.preferencias.avisar ? 'checked' : ''} ${ocupado || s.fase === 'descargada' ? 'disabled' : ''}><span>Avisarme de nuevas versiones</span></label><div class="agradecimiento">${corazon}<span>Esta versión existe gracias a quienes apoyan en Patreon.</span></div></aside></div><footer class="modal-pie"><div class="estado-descarga" role="status" aria-live="polite"><b>${esc(texto)}</b><small>${s.instalable ? 'Puedes seguir trabajando mientras se descarga.' : 'Abre GitHub para descargar el paquete de tu plataforma. Instala con Falcon cerrado.'}</small>${s.fase === 'descargando' ? `<progress max="100" value="${s.progreso?.porcentaje || 0}" aria-label="Progreso de descarga"></progress>` : ''}</div><div class="acciones"><button class="btn secundario sin-borde" data-cerrar>Más tarde</button>${s.instalable && r ? `<button class="btn secundario" data-u="al-salir" ${ocupado || s.alSalir ? 'disabled' : ''}>${s.alSalir ? 'Instalación programada' : 'Instalar al cerrar Falcon'}</button><button class="btn principal" data-u="actualizar" ${ocupado ? 'disabled' : ''}>${icono('descargar')}${s.fase === 'descargada' ? 'Reiniciar e instalar' : 'Actualizar ahora'}</button>` : `<button class="btn principal" data-u="${r ? 'notas' : 'comprobar'}" ${ocupado ? 'disabled' : ''}>${r ? 'Descargar desde GitHub ↗' : 'Comprobar ahora'}</button>`}</div></footer>`;
  if (foco) d.querySelector(`[data-u="${foco}"]`)?.focus();
}
function abrirActualizacion() {
  if (!estado) return;
  if (modalActualizacion) { modalActualizacion.focus(); return; }
  modalActualizacion = modal('modal-actualizacion', 'Actualizaciones de Falcon Engine');
  modalActualizacion.addEventListener('click', async e => {
    const a = e.target.closest('[data-u]')?.dataset.u;
    if (!a || accionPendiente) return;
    if (a === 'notas') return abrirUrl(estado.release?.url || `https://github.com/${estado.repositorio}/releases`);
    if (a === 'comprobar') return window.falcon.actualizaciones.comprobar(true).catch(errorPuente);
    if (a === 'estable' || a === 'pruebas') {
      await window.falcon.actualizaciones.configurar({ canal: a }).catch(errorPuente);
      return window.falcon.actualizaciones.comprobar(true).catch(errorPuente);
    }
    if (!['actualizar', 'al-salir'].includes(a)) return;
    if (estado.fase === 'error') return window.falcon.actualizaciones.comprobar(true).catch(errorPuente);
    accionPendiente = true;
    try {
      let s = estado;
      if (s.fase !== 'descargada') s = await window.falcon.actualizaciones.descargar();
      if (s.fase === 'descargada') {
        if (a === 'al-salir') await window.falcon.actualizaciones.instalar(true);
        else if (window.confirm('Se cerrará Falcon Engine para instalar la actualización. Guarda tus proyectos antes de continuar. ¿Reiniciar e instalar ahora?')) await window.falcon.actualizaciones.instalar(false);
      }
    } catch (e) { errorPuente(e); }
    finally { accionPendiente = false; pintarActualizacion(); }
  });
  modalActualizacion.addEventListener('change', async e => {
    const a = e.target.dataset.u;
    if (a === 'copia' || a === 'avisar') await window.falcon.actualizaciones.configurar({ [a === 'copia' ? 'copiaAjustes' : 'avisar']: e.target.checked }).catch(errorPuente);
  });
  pintarActualizacion();
  modalActualizacion.querySelector('[data-cerrar]').focus();
}
function errorPuente() { avisar('No se pudo completar la operación. Vuelve a intentarlo desde el gestor.', 'error', 5000); }
export async function iniciarComunidad() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-comunidad]')?.dataset.comunidad;
    if (a === 'apoyar') abrirApoyo();
    if (a === 'actualizar') abrirActualizacion();
  });
  const api = window.falcon.actualizaciones;
  if (!api) return;
  function recibir(s) {
    estado = s;
    const b = document.querySelector('[data-comunidad=actualizar]');
    if (b) { b.textContent = s.fase === 'disponible' ? `Nueva versión ${s.release.version} ↗` : s.fase === 'descargando' ? `Descargando ${Math.round(s.progreso?.porcentaje || 0)} %` : s.fase === 'descargada' ? 'Actualización lista para instalar' : s.fase === 'error' ? 'No se pudo comprobar · Reintentar' : s.fase === 'actualizada' ? 'Falcon está actualizado · Comprobar' : 'Buscar actualizaciones'; b.classList.toggle('disponible', !!s.release); }
    pintarActualizacion();
    const clave = `falcon-release-vista-${s.release?.version}`;
    if (s.fase === 'disponible' && s.preferencias.avisar && !sessionStorage.getItem(clave)) {
      sessionStorage.setItem(clave, '1');
      // Native dialogs must not overlap: leave the badge available if another is open.
      if (!document.querySelector('dialog[open], .fondo-dialogo')) abrirActualizacion();
    }
  }
  const dejar = api.alCambiar(recibir);
  try { recibir(await api.estado()); await api.comprobar(false); } catch { errorPuente(); }
  const intervalo = setInterval(() => api.comprobar(false).catch(() => {}), 30 * 60 * 1000);
  window.addEventListener('beforeunload', () => { dejar(); clearInterval(intervalo); }, { once: true });
}
