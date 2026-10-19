// Ejecuta las plantillas desde el NSIS instalado o la AppImage extraída, con el
// protocolo falcon://, preload e IPC reales. Nunca usa el árbol src del checkout.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const guionCQB = require('./guion-cqb.cjs');
const version = require('../package.json').version;
const salida = path.resolve(process.env.FALCON_QA_DIR || 'pruebas-instalador');
fs.mkdirSync(salida, { recursive: true });
const trabajo = fs.mkdtempSync(path.join(os.tmpdir(), 'Falcon instalado ñ '));
const ejecutar = (binario, args, opciones = {}) => {
  const r = spawnSync(binario, args, { encoding: 'utf8', timeout: 2400000, maxBuffer: 8 * 1024 * 1024, ...opciones });
  if (r.error || r.status !== 0) throw Error(`${binario}: ${r.error?.message || r.status}\n${r.stdout || ''}\n${r.stderr || ''}`);
  return r;
};
let ejecutable;
if (process.env.FALCON_QA_EXE) ejecutable = path.resolve(process.env.FALCON_QA_EXE);
else if (process.platform === 'win32') {
  const instalado = path.join(trabajo, 'aplicacion');
  // NSIS exige /D como último argumento, sin comillas aunque la ruta contenga espacios.
  ejecutar(path.resolve(`dist-actualizaciones/Falcon-Engine-${version}-win-x64.exe`), ['/S', '/D=' + instalado], { windowsVerbatimArguments: true });
  ejecutable = path.join(instalado, 'Falcon Engine.exe');
} else {
  const arch = process.arch === 'x64' ? 'x86_64' : process.arch;
  const imagen = path.resolve(`dist-actualizaciones/Falcon-Engine-${version}-linux-${arch}.AppImage`);
  fs.chmodSync(imagen, 0o755); ejecutar(imagen, ['--appimage-extract'], { cwd: trabajo });
  ejecutable = path.join(trabajo, 'squashfs-root', 'falcon-engine');
  if (!(fs.statSync(ejecutable).mode & 0o111)) throw Error('El ejecutable dentro de AppImage no tiene permiso de ejecución');
}

function capturar(caso, pagina, cuerpo, juego = false) {
  const guion = path.join(trabajo, caso + '.js');
  const resultado = path.join(salida, caso + '.json').replace(/\\/g, '/');
  fs.writeFileSync(guion, `(async()=>{try{const resultado=await(async()=>{${cuerpo}})();await falcon.fs.escribir(${JSON.stringify(resultado)},JSON.stringify({ok:true,...resultado},null,2));return resultado;}catch(e){await falcon.fs.escribir(${JSON.stringify(resultado)},JSON.stringify({ok:false,error:e.stack||e.message}));throw e;}})()`);
  const args = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--captura=' + path.join(salida, caso + '.png'), '--pagina=' + pagina, '--guion=' + guion,
    '--espera=800', '--esperaGuion=250', '--datos-prueba=' + path.join(trabajo, 'datos'), '--consola=1'];
  if (process.platform === 'linux') args.push('--ozone-platform=headless');
  if (caso.startsWith('cqb-')) args.push('--tamano=960x540');
  if (juego) args.push('--ventana=juego');
  const r = ejecutar(ejecutable, args);
  fs.writeFileSync(path.join(salida, caso + '.log'), r.stdout + '\n' + r.stderr);
  if (!fs.existsSync(resultado)) throw Error(`${caso}: el proceso terminó sin resultado de prueba\n${r.stdout}\n${r.stderr}`);
  const datos = JSON.parse(fs.readFileSync(resultado, 'utf8'));
  if (!datos.ok) throw Error(`${caso}: ${datos.error}`);
  console.log('INSTALADO OK:', caso); return datos;
}

const proyectos = capturar('crear-todas', 'src/gestor/gestor.html', `
  const {PLANTILLAS,crearProyecto}=await import('falcon://app/src/motor/plantillas.js');
  const {Proyecto}=await import('falcon://app/src/motor/proyecto.js');
  const proyectos=[];
  for(const plantilla of PLANTILLAS){
    const ruta=${JSON.stringify(trabajo.replace(/\\/g, '/'))}+'/proyectos con acentos ñ/'+plantilla.id;
    await crearProyecto(ruta,plantilla.nombre,plantilla.id);
    const p=await new Proyecto(ruta).cargar();
    const archivos=await p.listar();
    for(const archivo of archivos.filter(a=>a.rel.endsWith('.malla'))){
      const malla=await p.leerJSON(archivo.rel);if(malla.fuente&&!await p.existe(malla.fuente))throw Error('Modelo no generado: '+malla.fuente);
    }
    for(const archivo of archivos.filter(a=>!a.carpeta&&/\\.(png|wav|glb)$/.test(a.rel))){
      const respuesta=await fetch(p.url(archivo.rel)); if(!respuesta.ok)throw Error(archivo.rel+': '+respuesta.status);
      const bytes=await respuesta.arrayBuffer(); if(!bytes.byteLength)throw Error('Recurso vacío: '+archivo.rel);
    }
    // Baja calidad usa WebGL real y conserva la resolución y la interfaz propias de la plantilla.
    p.datos.calidad_grafica='baja';await p.guardar();
    proyectos.push({id:plantilla.id,ruta,escena:p.datos.escena_principal});
  }
  return {proyectos};
`).proyectos;

for (const p of proyectos) capturar('editor-juego-' + p.id, 'src/editor/editor.html?proyecto=' + encodeURIComponent(p.ruta), `
  const esperar=async(fn,mensaje)=>{const fin=Date.now()+30000;while(!fn()){if(Date.now()>fin)throw Error(mensaje);await new Promise(r=>setTimeout(r,100));}};
  await esperar(()=>window.__falconEditor&&!document.querySelector('.cargando-editor'),'El editor no terminó de cargar');
  if(document.body.innerText.includes('Error al mostrar esta vista:'))throw Error(document.body.innerText);
  if(!window.__falconEditor.est.docs.length||!document.querySelector('.visor'))throw Error('No se creó el visor de la escena');
  const errores=[];let iniciado=false;
  const quitar=falcon.juego.alInformar(m=>{if(m.tipo==='iniciado')iniciado=true;if(m.tipo==='error')errores.push(m.error);});
  await window.__falconEditor.A.probar();
  await esperar(()=>iniciado||errores.length,'El juego no confirmó su inicio');
  await new Promise(r=>setTimeout(r,1500));quitar();
  if(errores.length)throw Error(JSON.stringify(errores));
  return {id:${JSON.stringify(p.id)},editor:true,juego:iniciado,errores};
`, true);
console.log(`INSTALADOR VERIFICADO: ${proyectos.length} plantillas creadas, abiertas en editor y ejecutadas.`);

const cqb = proyectos.find(p => p.id === 'shooter_primera');
if (!cqb) throw Error('El instalador no ofrece la plantilla CQB');
const paginaCQB = 'src/juego/juego.html?proyecto=' + encodeURIComponent(cqb.ruta) + '&modo=exportado';
const datosCQB = { directorio: salida.replace(/\\/g, '/') };
capturar('cqb-jugabilidad', paginaCQB, `return await (${guionCQB.toString()})(${JSON.stringify(datosCQB)});`);
// Nuevo proceso, mismo proyecto creado por el instalador: no se reconstruye ni
// se sustituyen modelos con los del checkout entre las dos aperturas.
capturar('cqb-reabrir-juego', paginaCQB, `return await (${guionCQB.toString()})(${JSON.stringify({ ...datosCQB, reabrir: true })});`);
capturar('cqb-reabrir-editor', 'src/editor/editor.html?proyecto=' + encodeURIComponent(cqb.ruta), `
  const fin=Date.now()+90000;while(!window.__falconEditor||document.querySelector('.cargando-editor')){if(Date.now()>fin)throw Error('No reabre el editor');await new Promise(r=>setTimeout(r,100));}
  if(!window.__falconEditor.est.docs.length||!document.querySelector('.visor'))throw Error('No reabrió la escena CQB');
  return {reabierto:true,documentos:window.__falconEditor.est.docs.map(d=>d.rel||d.ruta)};
`);
// El paquete independiente conserva exactamente el proyecto generado por esta
// instalación. No añade el código fuente del motor ni los archivos de trabajo.
const plantilla = path.join(salida, 'Umbral-CQB-' + version + '.zip');
if (process.platform === 'win32') {
  const origen = cqb.ruta.replace(/'/g, "''"), destino = plantilla.replace(/'/g, "''");
  ejecutar('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Compress-Archive -LiteralPath '${origen}' -DestinationPath '${destino}' -Force`]);
} else ejecutar('python3', ['-c', 'import pathlib,sys,zipfile; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(f,"Umbral-CQB/"+str(f.relative_to(p))) for f in p.rglob("*") if f.is_file()]; z.close()', cqb.ruta, plantilla]);
fs.writeFileSync(path.join(salida, 'instalacion.json'), JSON.stringify({ version, plataforma: process.platform, arquitectura: process.arch, instalador: process.env.FALCON_QA_EXE ? 'Ejecutable indicado explícitamente' : process.platform === 'win32' ? 'NSIS /S' : 'AppImage extraída', plantillas: proyectos.map(p => p.id), cqb: 'crear → editor → jugar hasta victoria → cerrar → reabrir juego y editor', paquete: path.basename(plantilla) }, null, 2));
console.log('CQB VERIFICADO: recursos, controles, combate, cobertura, misión completa y reapertura.');
