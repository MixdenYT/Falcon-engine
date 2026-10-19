// Standard electron-updater (NSIS / AppImage). No bundled GitHub credentials.
const fs = require('node:fs');
const path = require('node:path');
const { versionNueva, notasTexto, agruparNotas, elegirRelease } = require('./notas-release');

function repositorio(valor) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(valor || '')) throw new Error('Repositorio de actualizaciones no válido.');
  const [owner, repo] = valor.split('/');
  return { owner, repo };
}
function crearActualizaciones({ app, ipcMain, net, esGestor, publicar, plataforma = process.platform, entorno = process.env, updater: inyectado }) {
  const archivo = path.join(app.getPath('userData'), 'falcon-actualizaciones.json');
  let preferencias = { canal: 'estable', avisar: true, copiaAjustes: true };
  try { const d = JSON.parse(fs.readFileSync(archivo, 'utf8')); preferencias = { canal: d.canal === 'pruebas' ? 'pruebas' : 'estable', avisar: d.avisar !== false, copiaAjustes: d.copiaAjustes !== false }; } catch {}
  const version = app.getVersion();
  const paquete = require(path.join(app.getAppPath(), 'package.json'));
  const repo = repositorio(entorno.FALCON_RELEASE_REPOSITORY || paquete.falconUpdates?.repository || 'MixdenYT/Falcon-engine');
  // Token provisioned by the owner of this machine, main process only. Never serialize it.
  const token = entorno.FALCON_UPDATE_TOKEN;
  const soportado = app.isPackaged && ((plataforma === 'win32' && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) || (plataforma === 'linux' && !!entorno.APPIMAGE));
  let updater = null;
  if (soportado) {
    updater = inyectado || require('electron-updater').autoUpdater;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.setFeedURL({ provider: 'github', ...repo, ...(token ? { private: true, token } : {}) });
  }
  let estado = { fase: 'reposo', versionActual: version, instalable: !!updater, preferencias, repositorio: `${repo.owner}/${repo.repo}`, release: null, progreso: null, error: null, alSalir: false };
  let tarea = null, ultimaComprobacion = 0;
  function emitir(cambios = {}) { estado = { ...estado, ...cambios, preferencias: { ...preferencias } }; publicar({ ...estado }); return { ...estado }; }
  function fallo(error) {
    // Avoid forwarding request headers, URLs with credentials, or arbitrary provider diagnostics.
    if (updater) updater.autoInstallOnAppQuit = false;
    const codigo = error?.statusCode || error?.status;
    const texto = String(error?.message || '');
    const mensaje = codigo === 401 || codigo === 404 || /401|404|Not Found/i.test(texto)
      ? 'No se puede acceder a las releases: comprueba el repositorio, su visibilidad y si hay una versión publicada. Un repositorio privado requiere acceso autorizado en este equipo.'
      : codigo === 403 || codigo === 429 || /rate.?limit|403|429/i.test(texto)
      ? 'GitHub ha limitado la consulta o el acceso no está autorizado. Vuelve a intentarlo más tarde.'
      : /sha512|checksum|signature|digest/i.test(texto)
      ? 'No se ha podido verificar la integridad o firma de la descarga. No se instalará.'
      : 'No se pudo completar la actualización. Comprueba tu conexión, el espacio disponible y los archivos publicados en GitHub.';
    return emitir({ fase: 'error', error: mensaje, alSalir: false });
  }
  function datosRelease(v, notas, fecha, nombre, tamano) {
    return { version: v, nombre: nombre || `Falcon Engine ${v}`, fecha: fecha || null, tamano: Number.isFinite(tamano) ? tamano : null,
      notas: notasTexto(notas), grupos: agruparNotas(notas), url: `https://github.com/${repo.owner}/${repo.repo}/releases/tag/v${v}` };
  }
  async function comprobar(manual = false) {
    if (tarea || ['descargando', 'descargada', 'instalando'].includes(estado.fase)) return estado;
    if (!manual && (!preferencias.avisar || Date.now() - ultimaComprobacion < 30 * 60 * 1000)) return estado;
    ultimaComprobacion = Date.now();
    emitir({ fase: 'comprobando', error: null });
    tarea = (async () => {
      try {
        const releases = [];
        // Paginate rather than relying on /latest's commit date ordering.
        for (let pagina = 1; pagina <= 5; pagina++) {
          const respuesta = await net.fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases?per_page=100&page=${pagina}`, {
            headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            signal: AbortSignal.timeout(20000),
          });
          if (!respuesta.ok) throw Object.assign(new Error('GitHub HTTP ' + respuesta.status), { status: respuesta.status });
          const lote = await respuesta.json();
          if (!Array.isArray(lote)) throw new Error('Respuesta no válida');
          releases.push(...lote);
          if (lote.length < 100) break;
          if (pagina === 5) throw new Error('Demasiadas releases para comprobarlas con seguridad');
        }
        const r = elegirRelease(releases, version, preferencias.canal === 'pruebas');
        let release;
        if (r) {
          const v = r.tag_name.replace(/^v/, '');
          const arquitecturas = process.arch === 'x64' ? ['x64', 'x86_64'] : [process.arch];
          const asset = r.assets?.find(a => a.name?.includes(plataforma === 'win32' ? 'win' : 'linux') && arquitecturas.some(arch => a.name?.includes(arch)));
          release = datosRelease(v, r.body, r.published_at, r.name, asset?.size);
          release.url = `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${encodeURIComponent(r.tag_name)}`;
          if (updater) {
            updater.allowPrerelease = preferencias.canal === 'pruebas';
            const resultado = await updater.checkForUpdates();
            const i = resultado?.updateInfo;
            if (!i || i.version !== v || !versionNueva(version, i.version, preferencias.canal === 'pruebas')) {
              throw new Error('Los metadatos de instalación no coinciden con la release seleccionada.');
            }
            if (Number.isFinite(i.files?.[0]?.size)) release.tamano = i.files[0].size;
          }
        }
        return emitir({ fase: release ? 'disponible' : 'actualizada', release: release || null, progreso: null });
      } catch (e) { return fallo(e); }
      finally { tarea = null; }
    })();
    return tarea;
  }
  if (updater) {
    updater.on('download-progress', p => emitir({ fase: 'descargando', progreso: { porcentaje: Math.max(0, Math.min(100, p.percent || 0)), recibidos: p.transferred, total: p.total, velocidad: p.bytesPerSecond } }));
    updater.on('update-downloaded', () => emitir({ fase: 'descargada', progreso: { porcentaje: 100 } }));
    updater.on('error', e => fallo(e));
  }
  async function descargar() {
    if (!updater || !estado.release || estado.fase !== 'disponible' || tarea) return estado;
    emitir({ fase: 'descargando', error: null, progreso: { porcentaje: 0 } });
    tarea = (async () => { try { await updater.downloadUpdate(); return emitir({ fase: 'descargada', progreso: { porcentaje: 100 } }); } catch (e) { return fallo(e); } finally { tarea = null; } })();
    return tarea;
  }
  function copiaAjustes() {
    if (!preferencias.copiaAjustes) return;
    const destino = path.join(app.getPath('userData'), 'copias-actualizaciones', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(destino, { recursive: true });
    for (const nombre of ['falcon-datos.json', 'falcon-actualizaciones.json']) {
      const origen = path.join(app.getPath('userData'), nombre);
      if (fs.existsSync(origen)) fs.copyFileSync(origen, path.join(destino, nombre));
    }
  }
  function instalar(alSalir) {
    if (!updater || estado.fase !== 'descargada') return estado;
    try {
      copiaAjustes();
      if (alSalir) { updater.autoInstallOnAppQuit = true; return emitir({ alSalir: true }); }
      emitir({ fase: 'instalando', alSalir: false });
      updater.quitAndInstall(false, true);
      return estado;
    } catch (e) { return fallo(e); }
  }
  function configurar(op = {}) {
    if (tarea || ['descargando', 'descargada', 'instalando'].includes(estado.fase)) return estado;
    const anterior = preferencias.canal;
    preferencias = { canal: op.canal === 'pruebas' ? 'pruebas' : op.canal === 'estable' ? 'estable' : preferencias.canal,
      avisar: typeof op.avisar === 'boolean' ? op.avisar : preferencias.avisar,
      copiaAjustes: typeof op.copiaAjustes === 'boolean' ? op.copiaAjustes : preferencias.copiaAjustes };
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo + '.tmp', JSON.stringify(preferencias, null, 2));
    fs.renameSync(archivo + '.tmp', archivo);
    return emitir(anterior !== preferencias.canal ? { fase: 'reposo', release: null, error: null } : {});
  }
  const acciones = { estado: () => estado, comprobar: comprobar, descargar, instalar, configurar };
  for (const [nombre, accion] of Object.entries(acciones)) ipcMain.handle('actualizaciones:' + nombre, (evento, dato) => {
    if (!esGestor(evento.sender)) throw new Error('Las actualizaciones solo están disponibles en el gestor de proyectos.');
    return accion(dato);
  });
  return { comprobar, estado: () => estado };
}
module.exports = { crearActualizaciones, repositorio };
