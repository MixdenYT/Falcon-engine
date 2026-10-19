// Extrae los canales de animación para compartir las texturas del personaje.
// No llama a Meshy ni crea cargos. Los GLB de origen permanecen intactos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { sonidoCQB } from '../src/motor/sonidos-cqb.js';

const repo = path.resolve(import.meta.dirname, '..'), destino = path.join(repo, 'recursos/cqb');
const carpetas = { operador: process.argv[2], enemigo: process.argv[3] };
if (!carpetas.operador || !carpetas.enemigo) throw Error('Indica las dos carpetas de tareas Meshy ya descargadas.');
function glb(archivo) {
  const b = fs.readFileSync(archivo); if (b.toString('ascii', 0, 4) !== 'glTF' || b.readUInt32LE(4) !== 2) throw Error('GLB inválido: '+archivo);
  let json, bin;
  for (let o = 12; o < b.length;) { const n = b.readUInt32LE(o), t = b.readUInt32LE(o+4), parte = b.subarray(o+8,o+8+n); if (t === 0x4e4f534a) json = JSON.parse(parte.toString()); if (t === 0x004e4942) bin = parte; o += n+8; }
  const leer = i => {
    const a = json.accessors[i]; if (a.sparse) throw Error('Animación con accessor disperso: '+archivo);
    const v = json.bufferViews[a.bufferView], tam = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 }[a.type];
    if (a.componentType !== 5126) throw Error('Animación no flotante: '+archivo);
    const r = new Float32Array(a.count*tam), salto = v.byteStride || tam*4, inicio = (v.byteOffset || 0)+(a.byteOffset || 0);
    for (let k = 0; k < a.count; k++) for (let n = 0; n < tam; n++) r[k*tam+n] = bin.readFloatLE(inicio+k*salto+n*4);
    return r;
  };
  return { json, leer };
}
const acciones = ['walk','run','aim','fire','reload','hit','death'], resumen = [];
fs.mkdirSync(path.join(destino,'modelos/animaciones'),{recursive:true});
fs.mkdirSync(path.join(destino,'sonidos'),{recursive:true});
for (const nombre of ['carabina','pistola','enemigo']) fs.writeFileSync(path.join(destino,'sonidos',nombre+'.wav'),sonidoCQB(nombre));
for (const tipo of Object.keys(carpetas)) {
  const modelo = glb(path.join(destino,'modelos/personajes',tipo+'.glb')).json;
  const nombres = new Set(modelo.nodes.filter(n=>n.name).map(n=>THREE.PropertyBinding.sanitizeNodeName(n.name)));
  const clips = {};
  for (const nombre of acciones) {
    const { json, leer } = glb(path.join(carpetas[tipo],nombre+'.glb')), animacion = json.animations?.[0]; if (!animacion) throw Error('Sin animación: '+tipo+'/'+nombre);
    const tracks = [];
    for (const canal of animacion.channels) {
      const nodo = THREE.PropertyBinding.sanitizeNodeName(json.nodes[canal.target.node].name || '');
      if (!nombres.has(nodo)) throw Error('El clip usa un hueso que no existe en el personaje: '+nodo);
      const sampler = animacion.samplers[canal.sampler]; if (sampler.interpolation && !['LINEAR','STEP'].includes(sampler.interpolation)) throw Error('Interpolación no contemplada: '+sampler.interpolation);
      const propiedad = {translation:'position',rotation:'quaternion',scale:'scale'}[canal.target.path]; if (!propiedad) throw Error('Canal inesperado: '+canal.target.path);
      let tiempos = leer(sampler.input), valores = leer(sampler.output);
      if (nombre === 'aim') { const tam = propiedad === 'quaternion' ? 4 : 3; tiempos = new Float32Array([0,1]); valores = new Float32Array([...valores.subarray(0,tam),...valores.subarray(0,tam)]); }
      const Clase = propiedad === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
      tracks.push(new Clase(nodo+'.'+propiedad,tiempos,valores,sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear));
    }
    const clip = new THREE.AnimationClip(tipo+'_'+nombre,-1,tracks); if (!clip.validate()) throw Error('Clip inválido '+nombre); clip.optimize();
    const rel = `modelos/animaciones/${tipo}-${nombre}.json`; fs.writeFileSync(path.join(destino,rel),JSON.stringify(THREE.AnimationClip.toJSON(clip))); clips[nombre] = rel;
    console.log(tipo,nombre,clip.duration.toFixed(3)+' s',tracks.length+' canales');
  }
  const config = { formato:'falcon-personaje-3d', version:1, modelo:`modelos/personajes/${tipo}.glb`, frente:180, textura_max:1024, manos:`modelos/personajes/${tipo}-manos.json`, ...(tipo === 'operador' ? {recorte_uv:'modelos/personajes/operador-recorte.json'} : {}), clips };
  fs.writeFileSync(path.join(destino,`modelos/personajes/${tipo}.json`),JSON.stringify(config,null,2));
  const animaciones = JSON.parse(fs.readFileSync(path.join(carpetas[tipo],'animaciones-enviadas.json'),'utf8'));
  const tareas = fs.readdirSync(carpetas[tipo]).filter(n=>/^task_.*\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(carpetas[tipo],n),'utf8'))).map(t=>({id:t.id,tipo:t.type,estado:t.status,creditos:t.consumed_credits}));
  resumen.push({personaje:tipo,tareas,animaciones:Object.fromEntries(Object.entries(animaciones).map(([k,v])=>[k,{id:v.id,action_id:v.action_id,creditos:v.consumed_credits}])),triangulos:tipo==='operador'?18692:18665});
}
fs.writeFileSync(path.join(destino,'procedencia.json'),JSON.stringify({generador:'Meshy CLI 0.4.0',fecha:'2026-10-19',creditos_confirmados:110,personajes:resumen,armas:'Diseños originales de Falcon Engine; generados desde armas3d.js',superficies:'Texturas procedurales originales de Falcon Engine'},null,2));
function listar(dir, prefijo='') { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?listar(path.join(dir,e.name),prefijo+e.name+'/'):[prefijo+e.name]); }
const fragmentos = {};
fs.mkdirSync(path.join(destino, 'fragmentos'), {recursive:true});
for (const tipo of ['operador','enemigo']) {
  const modelo = `modelos/personajes/${tipo}.glb`, bytes = fs.readFileSync(path.join(destino, modelo)), partes = [];
  for (let i=0; i<bytes.length; i+=8*1024*1024) {
    const bloque = bytes.subarray(i,i+8*1024*1024), ruta = `fragmentos/${tipo}-${String(partes.length).padStart(3,'0')}.bin`;
    fs.writeFileSync(path.join(destino,ruta),bloque); partes.push({ruta,bytes:bloque.length,sha256:crypto.createHash('sha256').update(bloque).digest('hex')});
  }
  fragmentos[modelo] = partes;
}
const archivos = listar(destino).filter(p=>p!=='manifest.json'&&!p.startsWith('fragmentos/')).sort();
const hashes = Object.fromEntries(archivos.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(destino,p))).digest('hex')]));
const guia = `# Umbral CQB — Falcon Engine 1.2.0\n\nCrea Shooter · CQB en el gestor y pulsa Jugar. Los modelos, texturas y sonidos están incluidos; no necesitas Meshy para jugar. Despeja las oficinas, el archivo y control y asegura el terminal.\n\n## Controles\n\n| Acción | Tecla / ratón |\n|---|---|\n| Mover / mirar | WASD / ratón |\n| Paso lento / avance rápido | Alt / Shift, mantener |\n| Agacharse | Ctrl, mantener |\n| Inclinarse izquierda / derecha | Q / E, mantener |\n| Apuntar con miras | Clic derecho, mantener |\n| Disparo manual | Un clic izquierdo o J por disparo |\n| Recargar | R |\n| Principal / secundaria / alternar | 1 / 2 / T |\n| Puertas, suministros, terminal | F, a menos de 2,2 m y mirando el objeto |\n| Ayuda / idioma | H / L |\n| Sensibilidad | [ / ] |\n| Soltar ratón / pausa | Esc / P o F7 |\n| Reiniciar / cerrar prueba | F5 / F8 en el reproductor del editor |\n\n## Combate\n\nKestrel C9: 24 cartuchos, reserva 96, intervalo 0,16 s, recarga 2,25 s, daño 40. Lynx P8: 12 cartuchos, reserva 48, intervalo 0,23 s, recarga 1,75 s, daño 34. Cada pulsación dispara una vez. Cambiar de arma cancela la recarga y conserva ambos inventarios. La mira marca la dirección real del rayo; la cobertura próxima también puede detener el disparo. El arma baja ante obstáculos.\n\n## Blueprints y Águila\n\nAbre blueprints/operador.bp, enemigo_cqb.bp, puerta_cqb.bp, terminal_cqb.bp y suministros_cqb.bp. Munición, vida, tiempos, cambio de arma, reacción enemiga y victoria se ejecutan desde esos grafos. generado/ permite comparar el resultado en Águila; edita el Blueprint. El motor aporta rayos, física, cámara, navegación y animación. Leer propiedad, Cambiar propiedad, Consultar método y Ejecutar método son bloques generales del catálogo y tienen lecciones en Academia.\n\nLa IA utiliza visión de 105 grados y rayos bloqueados por paredes/puertas, memoria temporal de la última posición y audición de disparos. Tras recibir daño intenta alcanzar una de las coberturas del mapa mediante A*. Sin visión no dispara. Las balizas Ruta… y Cubierta… son editables en la escena; los muros siguen siendo Malla3D.\n\n## Recursos\n\nDos personajes originales creados con Meshy, optimizados a aproximadamente 19.000 triángulos, rig de 24 huesos, siete clips por personaje y texturas PBR. operador.json configura el recorte de una pieza de arma incorporada al modelo y la adaptación de las palmas para el agarre. Se reutiliza el mismo modelo del operador para los brazos y el mismo enemigo para los tres contactos. Las tres armas, superficies y efectos WAV son originales del proyecto. procedencia.json conserva los IDs y el consumo confirmado de 110 créditos.\n`;
const guia_en = `# Threshold CQB — Falcon Engine 1.2.0\n\nCreate Shooter · CQB in the project manager and press Play. All assets are included. Clear the offices, storage and control room, then secure the terminal.\n\nWASD move; mouse look; hold Alt to walk slowly, Shift to move quickly, Ctrl to crouch, Q/E to lean and right mouse to aim. Left click or J fires once per press. R reloads. 1/2 select the carbine/sidearm; T swaps. F interacts with doors, supplies and the terminal within 2.2 m. H shows help, L changes language, [/] adjust sensitivity. Esc releases the mouse; P or F7 pauses. F5 restarts and F8 closes an editor playtest.\n\nThe C9 holds 24 rounds with 96 in reserve, a 0.16 s interval, 2.25 s reload and 40 damage. The P8 holds 12/48, a 0.23 s interval, 1.75 s reload and 34 damage. Swapping cancels reloads and preserves both inventories. Camera aim and muzzle obstruction are checked against real collisions.\n\nEditable Blueprints implement ammunition, health, timers, AI decisions, doors and the objective and compile to executable Águila. The engine provides collision, rays, animation and A* navigation. AI uses a 105-degree initial view cone, occlusion, gunshot hearing, short memory and authored cover markers. Hidden targets are not shot.\n\nThe two original Meshy characters share a coherent PBR style, about 19,000 triangles each, 24-bone rigs and seven clips each. The operator asset is reused for first-person arms and the enemy for all three hostiles. Source task IDs and the confirmed 110-credit cost are recorded in procedencia.json. Weapons, surfaces and generated WAV effects are original Falcon resources.\n`;
fs.writeFileSync(path.join(destino,'manifest.json'),JSON.stringify({formato:'falcon-cqb-assets',version:1,estado:'integrado',archivos,hashes,fragmentos,guia,guia_en},null,2));
console.log('Manifiesto:',archivos.length,'archivos; ninguna llamada a Meshy.');
