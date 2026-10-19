// Exportación de juegos de Falcon Engine a Windows y Linux.
// Cada juego exportado es una copia del motor de ejecución (Electron) con el
// reproductor de Falcon y los archivos del proyecto dentro de resources/app.

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const zlib = require('node:zlib');
const os = require('node:os');

const PLATAFORMAS = {
  'win32-x64': { platform: 'win32', arch: 'x64', nombre: 'Windows x64' },
  'linux-x64': { platform: 'linux', arch: 'x64', nombre: 'Linux x64' },
  'linux-arm64': { platform: 'linux', arch: 'arm64', nombre: 'Linux ARM64' },
};

// Archivos de la aplicación que necesita el reproductor.
const ARCHIVOS_APP = [
  'src/package.json', 'src/aguila', 'src/motor', 'src/juego', 'src/ui/base.css', 'src/ui/iconos.js', 'src/ui/componentes.js',
  'src/principal/package.json', 'src/principal/jugador.js', 'src/principal/preload.js',
  'recursos/icono.png',
  'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js', 'node_modules/three/examples/jsm',
  'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'node_modules/three/examples/jsm/utils/SkeletonUtils.js',
  'node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js', 'node_modules/three/examples/jsm/environments/RoomEnvironment.js',
  'node_modules/three/package.json',
  'node_modules/three-bvh-csg/build/index.module.js', 'node_modules/three-mesh-bvh/build/index.module.js',
];
const FUENTES = ['manrope', 'jetbrains-mono'];

function nombreSeguro(s) { return (s || 'Juego').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '').trim() || 'Juego'; }
function nombreBinario(s) { return nombreSeguro(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'juego'; }

async function copiar(de, a, filtro) {
  const st = await fsp.stat(de);
  if (st.isDirectory()) {
    await fsp.mkdir(a, { recursive: true });
    for (const n of await fsp.readdir(de)) {
      const s = path.join(de, n);
      if (filtro && !filtro(s, n)) continue;
      await copiar(s, path.join(a, n), filtro);
    }
  } else {
    await fsp.mkdir(path.dirname(a), { recursive: true });
    await fsp.copyFile(de, a);
  }
}

async function borrar(p) { await fsp.rm(p, { recursive: true, force: true }); }

// Obtiene una carpeta con Electron para la plataforma pedida.
async function motorEjecucion(clave, op) {
  const { platform, arch } = PLATAFORMAS[clave];
  const version = process.versions.electron;
  if (platform === process.platform && arch === process.arch) {
    return { dir: path.dirname(process.execPath), local: true, exe: path.basename(process.execPath) };
  }
  const destino = path.join(op.cache, `electron-${version}-${platform}-${arch}`);
  if (fs.existsSync(path.join(destino, platform === 'win32' ? 'electron.exe' : 'electron'))) {
    return { dir: destino, local: false, exe: platform === 'win32' ? 'electron.exe' : 'electron' };
  }
  op.progreso({ plataforma: clave, fase: 'descarga', texto: `Descargando el motor de ejecución para ${PLATAFORMAS[clave].nombre}…`, porcentaje: 0 });
  const { downloadArtifact } = await import('@electron/get');
  const zip = await downloadArtifact({
    version, platform, arch, artifactName: 'electron', cacheRoot: path.join(op.cache, 'descargas'),
    downloadOptions: {
      getProgressCallback: (p) => op.progreso({ plataforma: clave, fase: 'descarga', texto: `Descargando motor de ejecución (${Math.round(p.percent * 100)} %)`, porcentaje: p.percent * 40 }),
    },
  });
  op.progreso({ plataforma: clave, fase: 'descarga', texto: 'Descomprimiendo…', porcentaje: 42 });
  await borrar(destino);
  await descomprimirZip(zip, destino);
  return { dir: destino, local: false, exe: platform === 'win32' ? 'electron.exe' : 'electron' };
}

// Descomprime un .zip guardando aparte los permisos y enlaces de Unix,
// que Windows no puede representar, para usarlos al crear el .tar.gz.
function descomprimirZip(zip, destino) {
  const yauzl = require('yauzl');
  return new Promise((ok, mal) => {
    yauzl.open(zip, { lazyEntries: true, autoClose: true }, (err, z) => {
      if (err) return mal(err);
      const modos = {};
      const enlaces = [];
      z.on('error', mal);
      z.on('end', async () => {
        try {
          await fsp.writeFile(path.join(destino, '.falcon-modos.json'), JSON.stringify({ modos, enlaces }));
          ok();
        } catch (e) { mal(e); }
      });
      z.on('entry', (e) => {
        const rel = e.fileName.replace(/\\/g, '/');
        if (rel.includes('..')) { z.readEntry(); return; }
        const abs = path.join(destino, rel);
        const modo = (e.externalFileAttributes >>> 16) & 0xFFFF;
        const esEnlace = (modo & 0xF000) === 0xA000;
        if (rel.endsWith('/')) { fsp.mkdir(abs, { recursive: true }).then(() => z.readEntry(), mal); return; }
        if (modo & 0o777) modos[rel] = modo & 0o777;
        z.openReadStream(e, async (err2, lectura) => {
          if (err2) return mal(err2);
          try {
            await fsp.mkdir(path.dirname(abs), { recursive: true });
            if (esEnlace) {
              const trozos = [];
              for await (const t of lectura) trozos.push(t);
              enlaces.push({ ruta: rel, destino: Buffer.concat(trozos).toString('utf8') });
              z.readEntry();
              return;
            }
            const escritura = fs.createWriteStream(abs);
            lectura.on('error', mal);
            escritura.on('error', mal);
            escritura.on('close', () => z.readEntry());
            lectura.pipe(escritura);
          } catch (e3) { mal(e3); }
        });
      });
      z.readEntry();
    });
  });
}

// Electron trata los .asar como carpetas; al copiar el motor hay que verlos como archivos normales.
async function exportarJuego(op) {
  const anterior = process.noAsar;
  process.noAsar = true;
  try { return await exportarSinAsar(op); }
  finally { process.noAsar = anterior; }
}

async function exportarSinAsar(op) {
  const proyectoDir = op.proyecto;
  const datos = JSON.parse(await fsp.readFile(fs.existsSync(path.join(proyectoDir, 'proyecto.falcon')) ? path.join(proyectoDir, 'proyecto.falcon') : path.join(proyectoDir, 'proyecto.talon'), 'utf8'));
  const nombre = nombreSeguro(op.nombre || datos.exportacion?.nombre_ejecutable || datos.nombre);
  const version = op.version || datos.exportacion?.version || '1.0.0';
  const salidas = [];
  await fsp.mkdir(op.destino, { recursive: true });

  for (const clave of op.plataformas) {
    const plat = PLATAFORMAS[clave];
    if (!plat) throw new Error('Plataforma desconocida: ' + clave);
    const motor = await motorEjecucion(clave, op);
    const carpeta = path.join(op.destino, `${nombre}-${clave}`);
    op.progreso({ plataforma: clave, fase: 'copia', texto: 'Copiando el motor de ejecución…', porcentaje: 45 });
    await borrar(carpeta);
    await copiar(motor.dir, carpeta, (s, n) => {
      const rel = path.relative(motor.dir, s).split(path.sep).join('/');
      if (rel === 'resources/app' || rel === 'resources/app.asar' || rel === 'resources/default_app.asar') return false;
      if (motor.local && /\.(log|tmp-falcon)$/.test(n)) return false;
      // Solo las traducciones de Chromium en español e inglés (ahorra unos 45 MB).
      if (/^locales\/[^/]+\.pak$/.test(rel) && !/^locales\/(es|es-419|en-US)\.pak$/.test(rel)) return false;
      return true;
    });

    // Ejecutable con el nombre del juego.
    const exeOrigen = path.join(carpeta, motor.exe);
    const exeDestino = path.join(carpeta, plat.platform === 'win32' ? `${nombre}.exe` : nombreBinario(nombre));
    if (fs.existsSync(exeOrigen) && exeOrigen !== exeDestino) await fsp.rename(exeOrigen, exeDestino);
    // En un motor ya empaquetado, el ejecutable local se llama como el motor.
    for (const extra of ['electron.exe', 'electron', 'Falcon Engine.exe', 'falcon-engine']) {
      const p = path.join(carpeta, extra);
      if (p !== exeDestino && fs.existsSync(p) && extra !== motor.exe) await borrar(p);
    }

    // Aplicación del reproductor.
    op.progreso({ plataforma: clave, fase: 'app', texto: 'Preparando el reproductor del juego…', porcentaje: 60 });
    const app = path.join(carpeta, 'resources', 'app');
    for (const rel of ARCHIVOS_APP) {
      const de = path.join(op.raizApp, rel);
      if (fs.existsSync(de)) await copiar(de, path.join(app, rel));
    }
    for (const f of FUENTES) {
      const base = path.join(op.raizApp, 'node_modules', '@fontsource', f);
      for (const n of await fsp.readdir(base)) if (/^latin(-ext)?-\d+\.css$/.test(n)) await copiar(path.join(base, n), path.join(app, 'node_modules', '@fontsource', f, n));
      for (const n of await fsp.readdir(path.join(base, 'files'))) if (/latin.*\.woff2$/.test(n)) await copiar(path.join(base, 'files', n), path.join(app, 'node_modules', '@fontsource', f, 'files', n));
    }
    await fsp.writeFile(path.join(app, 'package.json'), JSON.stringify({
      name: nombreBinario(nombre), productName: nombre, version, main: 'src/principal/jugador.js', private: true,
    }, null, 2));

    // Archivos del proyecto.
    op.progreso({ plataforma: clave, fase: 'proyecto', texto: 'Copiando el proyecto…', porcentaje: 70 });
    const omitir = new Set(['capturas', 'exportado', 'exportaciones', '.git']);
    await copiar(proyectoDir, path.join(app, 'juego'), (s, n) => {
      const rel = path.relative(proyectoDir, s).split(path.sep).join('/');
      if (omitir.has(rel)) return false;
      if (rel.startsWith('.falcon/') && rel !== '.falcon/importacion.json') return false;
      if (n.endsWith('.tmp-falcon')) return false;
      if (path.resolve(s) === path.resolve(op.destino)) return false;
      return true;
    });
    const pj = path.join(app, 'juego', 'proyecto.falcon');
    if (!fs.existsSync(pj) && fs.existsSync(path.join(app, 'juego', 'proyecto.talon'))) await fsp.copyFile(path.join(app, 'juego', 'proyecto.talon'), pj);
    await fsp.writeFile(path.join(app, 'juego', '.exportado.json'), JSON.stringify({ pantalla_completa: !!op.pantallaCompleta, fecha: Date.now() }));

    if (plat.platform === 'win32') {
      op.progreso({ plataforma: clave, fase: 'icono', texto: 'Poniendo nombre e icono al ejecutable…', porcentaje: 80 });
      try { await editarExeWindows(exeDestino, { nombre, version, icono: op.icono }); }
      catch (e) { op.progreso({ plataforma: clave, fase: 'aviso', texto: 'No se pudo cambiar el icono del .exe: ' + e.message, porcentaje: 82 }); }
      await fsp.writeFile(path.join(carpeta, 'LÉEME.txt'), `${nombre} ${version}\r\n\r\nAbre «${nombre}.exe» para jugar.\r\nF10: opciones de gráficos · F11: pantalla completa · F12: captura\r\nHecho con Falcon Engine.\r\n`);
      salidas.push({ plataforma: clave, ruta: carpeta, ejecutable: exeDestino });
    } else {
      const bin = nombreBinario(nombre);
      await fsp.writeFile(path.join(carpeta, 'jugar.sh'), `#!/bin/sh\n# Abre ${nombre}. Si el sandbox de Chromium no está disponible, se usa --no-sandbox.\nDIR="$(cd "$(dirname "$0")" && pwd)"\n"$DIR/${bin}" "$@" 2>/dev/null || "$DIR/${bin}" --no-sandbox "$@"\n`);
      await fsp.writeFile(path.join(carpeta, 'LÉEME.txt'), `${nombre} ${version}\n\nPara jugar: ./jugar.sh\n(o directamente ./${bin})\n\nF10: opciones de gráficos · F11: pantalla completa · F12: captura\nHecho con Falcon Engine.\n`);
      op.progreso({ plataforma: clave, fase: 'tar', texto: 'Comprimiendo en .tar.gz…', porcentaje: 82 });
      const tgz = carpeta + '.tar.gz';
      // Permisos originales del zip de Electron (si se descargó) y los de nuestros archivos.
      let info = { modos: {}, enlaces: [] };
      try { info = JSON.parse(await fsp.readFile(path.join(carpeta, '.falcon-modos.json'), 'utf8')); } catch {}
      await borrar(path.join(carpeta, '.falcon-modos.json'));
      if (info.modos.electron) info.modos[bin] = info.modos.electron;
      info.modos['jugar.sh'] = 0o755;
      const ejecutables = new Set([bin, 'chrome_crashpad_handler', 'chrome-sandbox']);
      const modoDe = (rel) => info.modos[rel] ?? (ejecutables.has(rel) || /\.so(\.\d+)*$/.test(rel) ? 0o755 : 0o644);
      await crearTarGz(carpeta, tgz, path.basename(carpeta), modoDe, (p) => op.progreso({ plataforma: clave, fase: 'tar', texto: 'Comprimiendo en .tar.gz…', porcentaje: 82 + p * 16 }), info.enlaces || []);
      salidas.push({ plataforma: clave, ruta: tgz, carpeta, ejecutable: path.join(carpeta, bin) });
    }
    op.progreso({ plataforma: clave, fase: 'hecho', texto: `${plat.nombre}: listo`, porcentaje: 100 });
  }
  return salidas;
}

// Cambia icono y datos de versión del .exe (resedit es JavaScript puro, funciona en cualquier sistema).
async function editarExeWindows(exe, { nombre, version, icono }) {
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const datos = await fsp.readFile(exe);
  const ejecutable = R.NtExecutable.from(datos, { ignoreCert: true });
  const recursos = R.NtExecutableResource.from(ejecutable);
  const lang = 1033;
  if (icono && fs.existsSync(icono)) {
    const ico = R.Data.IconFile.from(await fsp.readFile(icono));
    R.Resource.IconGroupEntry.replaceIconsForResource(recursos.entries, 1, lang, ico.icons.map(i => i.data));
  }
  const vi = R.Resource.VersionInfo.fromEntries(recursos.entries)[0] || R.Resource.VersionInfo.createEmpty();
  const [a, b, c] = String(version).split('.').map(n => parseInt(n, 10) || 0);
  vi.setFileVersion(a, b, c, 0, lang);
  vi.setProductVersion(a, b, c, 0, lang);
  vi.setStringValues({ lang, codepage: 1200 }, {
    FileDescription: nombre, ProductName: nombre, OriginalFilename: `${nombre}.exe`, InternalName: nombre,
    CompanyName: 'Hecho con Falcon Engine', FileVersion: version, ProductVersion: version, LegalCopyright: '',
  });
  vi.outputToResourceEntries(recursos.entries);
  recursos.outputResource(ejecutable);
  await fsp.writeFile(exe, Buffer.from(ejecutable.generate()));
}

// ---- tar.gz con permisos (los permisos de Unix no existen al copiar desde Windows) ----

function cabeceraTar(nombre, tamano, modo, tipo, mtime, enlace = '') {
  const h = Buffer.alloc(512, 0);
  let n = nombre, prefijo = '';
  if (Buffer.byteLength(n) > 100) {
    const i = n.lastIndexOf('/', 154);
    prefijo = n.slice(0, i); n = n.slice(i + 1);
    if (Buffer.byteLength(n) > 100 || Buffer.byteLength(prefijo) > 155) throw new Error('Ruta demasiado larga para tar: ' + nombre);
  }
  const esc = (s, o, l) => h.write(s, o, l, 'utf8');
  const oct = (v, o, l) => esc(v.toString(8).padStart(l - 1, '0') + '\0', o, l);
  esc(n, 0, 100);
  oct(modo, 100, 8); oct(0, 108, 8); oct(0, 116, 8);
  oct(tamano, 124, 12); oct(Math.floor(mtime / 1000), 136, 12);
  h.fill(' ', 148, 156);
  esc(tipo, 156, 1);
  if (enlace) esc(enlace, 157, 100);
  esc('ustar\0', 257, 6); esc('00', 263, 2);
  esc('falcon', 265, 32); esc('falcon', 297, 32);
  esc(prefijo, 345, 155);
  let suma = 0; for (let i = 0; i < 512; i++) suma += h[i];
  esc(suma.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}

async function crearTarGz(dir, salida, raizEnTar, modoDe, alProgreso, enlaces = []) {
  const lista = [];
  async function recorrer(d, rel) {
    for (const e of await fsp.readdir(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { lista.push({ abs, rel: r, carpeta: true }); await recorrer(abs, r); }
      else lista.push({ abs, rel: r, carpeta: false, tamano: (await fsp.stat(abs)).size });
    }
  }
  await recorrer(dir, '');
  const total = lista.reduce((s, x) => s + (x.tamano || 0), 0) || 1;
  let hecho = 0;
  const gz = zlib.createGzip({ level: 6 });
  const out = fs.createWriteStream(salida);
  gz.pipe(out);
  const escribir = (buf) => new Promise((ok) => { if (!gz.write(buf)) gz.once('drain', ok); else ok(); });
  const ahora = Date.now();
  await escribir(cabeceraTar(raizEnTar + '/', 0, 0o755, '5', ahora));
  for (const x of lista) {
    const nombre = raizEnTar + '/' + x.rel + (x.carpeta ? '/' : '');
    if (x.carpeta) { await escribir(cabeceraTar(nombre, 0, 0o755, '5', ahora)); continue; }
    const modo = modoDe(x.rel);
    await escribir(cabeceraTar(nombre, x.tamano, modo, '0', ahora));
    await new Promise((ok, mal) => {
      const r = fs.createReadStream(x.abs);
      r.on('data', (c) => { if (!gz.write(c)) { r.pause(); gz.once('drain', () => r.resume()); } });
      r.on('end', ok); r.on('error', mal);
    });
    const relleno = (512 - (x.tamano % 512)) % 512;
    if (relleno) await escribir(Buffer.alloc(relleno, 0));
    hecho += x.tamano;
    alProgreso(hecho / total);
  }
  for (const e of enlaces) await escribir(cabeceraTar(raizEnTar + '/' + e.ruta, 0, 0o777, '2', ahora, e.destino));
  await escribir(Buffer.alloc(1024, 0));
  await new Promise((ok) => { out.on('finish', ok); gz.end(); });
}

module.exports = { exportarJuego, PLATAFORMAS, crearTarGz };
