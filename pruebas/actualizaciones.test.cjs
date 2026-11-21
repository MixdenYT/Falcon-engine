const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { versionNueva, versionValida, elegirRelease, agruparNotas } = require('../src/principal/notas-release');
const { crearActualizaciones, repositorio } = require('../src/principal/actualizaciones');

const release = (tag, op = {}) => ({ tag_name: tag, name: 'Release oficial', body: '## Added\n- Editor de materiales\n## Fixed\n- Corrige un fallo', published_at: '2026-10-19T12:00:00Z', ...op });
function entorno(t, op = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-update-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const handlers = {}, mensajes = [], consultas = [];
  const updater = new EventEmitter();
  const plataforma = op.plataforma || 'linux', arquitectura = op.arquitectura || 'x64';
  const url = op.urlMetadatos || `Falcon-Engine-1.2.0-${plataforma === 'win32' ? 'windows' : 'linux'}-${arquitectura === 'x64' ? 'x86_64' : arquitectura}.${plataforma === 'win32' ? 'exe' : 'AppImage'}`;
  Object.assign(updater, { setFeedURL(x) { this.feed = x; }, checkForUpdates: async () => ({ updateInfo: { version: op.versionMetadata || '1.2.0', files: [{ url, size: 300 }] } }),
    downloadUpdate: async () => { if (op.fallaDescarga) throw new Error('sha512 mismatch; secret token must not leak'); updater.emit('download-progress', { percent: 50, transferred: 150, total: 300 }); updater.emit('update-downloaded'); },
    quitAndInstall(...args) { this.instalacion = args; } });
  const servicio = crearActualizaciones({
    app: { isPackaged: !!op.instalable, getVersion: () => '1.0.0', getAppPath: () => path.resolve(__dirname, '..'), getPath: () => dir },
    ipcMain: { handle: (nombre, fn) => { handlers[nombre] = fn; } }, esGestor: sender => sender === 'gestor', publicar: s => mensajes.push(s),
    plataforma, arquitectura, entorno: { ...(op.instalable ? { APPIMAGE: '/test/Falcon.AppImage' } : {}), ...(op.token ? { FALCON_UPDATE_TOKEN: op.token } : {}) }, updater,
    net: { fetch: async (url, opciones) => {
      consultas.push({ url, opciones });
      if (op.errorHTTP) return { ok: false, status: op.errorHTTP };
      const pagina = Number(new URL(url).searchParams.get('page'));
      return { ok: true, json: async () => op.paginas ? op.paginas[pagina - 1] || [] : op.releases || [release('v1.2.0')] };
    } },
  });
  const llamar = (accion, dato, sender = 'gestor') => handlers['actualizaciones:' + accion]({ sender }, dato);
  return { dir, updater, mensajes, consultas, servicio, llamar };
}

test('SemVer: numeric ordering, prerelease opt-in, build metadata, invalid tags and no downgrade', () => {
  assert.equal(versionNueva('1.9.0', 'v1.10.0'), true);
  assert.equal(versionNueva('1.10.0', '1.9.0'), false);
  assert.equal(versionNueva('1.0.0', '1.1.0-beta.2'), false);
  assert.equal(versionNueva('1.0.0', '1.1.0-beta.2', true), true);
  assert.equal(versionNueva('1.0.0+one', '1.0.0+two'), false);
  assert.equal(versionNueva('1.1.0-beta.2', '1.1.0', false), true);
  assert.equal(versionValida('release-1'), null);
  assert.equal(elegirRelease([release('v2.0.0', { draft: true }), release('v1.10.0'), release('v1.9.0'), release('v3.0.0-rc.1', { prerelease: true })], '1.0.0', false).tag_name, 'v1.10.0');
});
test('Keep a Changelog headings keep real text, unknown changes and hostile input inert', () => {
  const g = agruparNotas('## Added\n- **Materials**: preview\n## Changed\n- Better UI\n## Fixed\n- Crash\n## Security\n- <img src=x onerror=alert(1)>\n## Removed\n- Old feature');
  assert.equal(g.nuevo[0].texto, '**Materials**: preview');
  assert.equal(g.mejorado.length, 1); assert.equal(g.corregido.length, 1);
  assert.match(g.seguridad[0].texto, /onerror/); assert.equal(g.otros[0].texto, 'Old feature');
});
test('repository configuration rejects paths, query strings and URLs', () => {
  assert.deepEqual(repositorio('MixdenYT/Falcon-engine'), { owner: 'MixdenYT', repo: 'Falcon-engine' });
  for (const s of ['https://evil.test/a', 'owner/repo?token=x', '../x/y']) assert.throws(() => repositorio(s));
});
test('portable client paginates and preserves release notes/tag URL from GitHub', async t => {
  const e = entorno(t, { paginas: [Array.from({ length: 100 }, () => release('v0.9.0')), [release('1.2.0')]] });
  const s = await e.llamar('comprobar', true);
  assert.equal(e.consultas.length, 2); assert.equal(s.fase, 'disponible'); assert.equal(s.instalable, false);
  assert.equal(s.release.url, 'https://github.com/MixdenYT/Falcon-engine/releases/tag/1.2.0');
  assert.equal(s.release.grupos.nuevo[0].texto, 'Editor de materiales');
  assert.equal((await e.llamar('descargar')).fase, 'disponible');
});
test('404 is an access/configuration error, never "up to date"; token stays main-only', async t => {
  const e = entorno(t, { errorHTTP: 404, token: 'private-secret' });
  const s = await e.llamar('comprobar', true);
  assert.equal(s.fase, 'error'); assert.match(s.error, /privado/);
  assert.equal(e.consultas[0].opciones.headers.Authorization, 'Bearer private-secret');
  assert.doesNotMatch(JSON.stringify(e.mensajes), /private-secret/);
});
test('all updater IPC calls reject non-manager senders', t => {
  const e = entorno(t);
  for (const a of ['estado', 'comprobar', 'descargar', 'instalar', 'configurar']) assert.throws(() => e.llamar(a, undefined, 'editor'), /gestor/);
});
test('notification preference stops automatic checks, manual check still works', async t => {
  const e = entorno(t);
  e.llamar('configurar', { avisar: false });
  await e.llamar('comprobar', false); assert.equal(e.consultas.length, 0);
  await e.llamar('comprobar', true); assert.equal(e.consultas.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(e.dir, 'falcon-actualizaciones.json'))).avisar, false);
});
test('a channel change clears the previous candidate, stable cannot install a prerelease', async t => {
  const e = entorno(t, { releases: [release('v1.2.0-beta.1', { prerelease: true })] });
  assert.equal((await e.llamar('comprobar', true)).fase, 'actualizada');
  e.llamar('configurar', { canal: 'pruebas' });
  assert.equal((await e.llamar('comprobar', true)).fase, 'disponible');
  const s = e.llamar('configurar', { canal: 'estable' });
  assert.equal(s.release, null); assert.equal(s.fase, 'reposo');
});
test('installer requires matching metadata, manual download and verified completion before install', async t => {
  const e = entorno(t, { instalable: true });
  e.llamar('instalar', false); assert.equal(e.updater.instalacion, undefined);
  assert.equal(e.updater.autoDownload, false); assert.equal(e.updater.autoInstallOnAppQuit, false);
  await e.llamar('comprobar', true); assert.equal(e.updater.allowDowngrade, false);
  const s = await e.llamar('descargar'); assert.equal(s.fase, 'descargada');
  assert.ok(e.mensajes.some(x => x.progreso?.porcentaje === 50));
  fs.writeFileSync(path.join(e.dir, 'falcon-datos.json'), '{"recientes":[]}');
  e.llamar('instalar', true); assert.equal(e.updater.autoInstallOnAppQuit, true);
  const raiz = path.join(e.dir, 'copias-actualizaciones');
  const copia = path.join(raiz, fs.readdirSync(raiz)[0]);
  assert.equal(fs.readFileSync(path.join(copia, 'falcon-datos.json'), 'utf8'), '{"recientes":[]}');
  e.llamar('instalar', false); assert.deepEqual(e.updater.instalacion, [false, true]);
});
test('mismatched metadata and failed checksum never reach an installable state', async t => {
  const e = entorno(t, { instalable: true, versionMetadata: '1.1.0' });
  assert.equal((await e.llamar('comprobar', true)).fase, 'error');
  assert.notEqual((await e.llamar('descargar')).fase, 'descargada');
  const f = entorno(t, { instalable: true, fallaDescarga: true });
  await f.llamar('comprobar', true);
  assert.equal((await f.llamar('descargar')).fase, 'error');
  f.llamar('instalar', false); assert.equal(f.updater.instalacion, undefined);
  assert.match(f.servicio.estado().error, /integridad/);
  assert.doesNotMatch(f.servicio.estado().error, /secret token/);
});
test('plain X.Y.Z release marked prerelease on GitHub is only offered in the Pruebas channel', async t => {
  const e = entorno(t, { instalable: true, releases: [release('v1.2.0', { prerelease: true })] });
  assert.equal((await e.llamar('comprobar', true)).fase, 'actualizada');
  e.llamar('configurar', { canal: 'pruebas' });
  assert.equal((await e.llamar('comprobar', true)).fase, 'disponible');
  assert.equal(e.updater.allowPrerelease, true);
});
test('Windows metadata is split by architecture: x86_64 keeps latest.yml, arm64 reads latest-arm64.yml', async t => {
  // El servicio comprueba app-update.yml junto a resources en Windows.
  const recursos = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-recursos-'));
  fs.writeFileSync(path.join(recursos, 'app-update.yml'), 'provider: github');
  const anterior = process.resourcesPath; process.resourcesPath = recursos;
  t.after(() => { process.resourcesPath = anterior; fs.rmSync(recursos, { recursive: true, force: true }); });
  const x64 = entorno(t, { instalable: true, plataforma: 'win32', arquitectura: 'x64' });
  assert.equal(x64.updater.feed.channel, undefined);
  assert.equal((await x64.llamar('comprobar', true)).fase, 'disponible');
  const arm = entorno(t, { instalable: true, plataforma: 'win32', arquitectura: 'arm64', releases: [release('v1.2.0', { assets: [
    { name: 'Falcon-Engine-1.2.0-windows-x86_64.exe', size: 100 }, { name: 'Falcon-Engine-1.2.0-windows-arm64.exe.blockmap', size: 1 }, { name: 'Falcon-Engine-1.2.0-windows-arm64.exe', size: 200 }] })] });
  assert.equal(arm.updater.feed.channel, 'latest-arm64');
  const s = await arm.llamar('comprobar', true);
  assert.equal(s.fase, 'disponible'); assert.equal(s.release.tamano, 300);
  // Metadatos de otra arquitectura (p. ej. si se sirviera latest.yml a un equipo arm64): error, nunca instalable.
  const mal = entorno(t, { instalable: true, plataforma: 'win32', arquitectura: 'arm64', urlMetadatos: 'Falcon-Engine-1.2.0-windows-x86_64.exe' });
  assert.equal((await mal.llamar('comprobar', true)).fase, 'error');
  assert.notEqual((await mal.llamar('descargar')).fase, 'descargada');
});
test('asset size comes from the installer of this platform and architecture, not its blockmap', async t => {
  const e = entorno(t, { arquitectura: 'arm64', releases: [release('v1.2.0', { assets: [
    { name: 'Falcon-Engine-1.2.0-linux-arm64.AppImage.blockmap', size: 1 }, { name: 'Falcon-Engine-1.2.0-windows-arm64.exe', size: 2 }, { name: 'Falcon-Engine-1.2.0-linux-arm64.AppImage', size: 3 }] })] });
  assert.equal((await e.llamar('comprobar', true)).release.tamano, 3);
});
