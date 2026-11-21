// GITHUB_TOKEN del workflow; ningún token se incorpora al programa distribuido.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { verificarDirectorio } = require('./verificar-release.cjs');
const version = require('../package.json').version;
if (process.env.RELEASE_VERSION !== version || !/^\d+\.\d+\.\d+$/.test(version)) throw Error('Versión solicitada incorrecta');
// Canal Pruebas = prerelease de GitHub: el canal Estable y /releases/latest la ignoran.
const canal = process.env.RELEASE_CHANNEL;
if (!['pruebas', 'estable'].includes(canal)) throw Error('Canal desconocido: usa pruebas o estable');
const tipo = canal === 'pruebas' ? ['--prerelease', '--latest=false'] : ['--prerelease=false', '--latest'];
const tag = 'v' + version, archivos = verificarDirectorio('instaladores');
const notas = path.join('notas', tag + '.md');
if (!fs.existsSync(notas)) throw Error('Faltan las notas de cambios');
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let existente;
try { existente = JSON.parse(gh('release', 'view', tag, '--json', 'isDraft,tagName')); } catch (e) {
  // No confundir un fallo de permisos/red con ausencia: comprobar específicamente el 404.
  try { gh('api', `repos/${process.env.GH_REPO}/releases/tags/${tag}`); throw Error('No se pudo consultar la release'); }
  catch (error) { if (!String(error.stderr || error.message).includes('HTTP 404')) throw error; }
}
if (existente && !existente.isDraft) throw Error('Esta versión ya está publicada; no se reemplazan binarios públicos');
if (!existente) gh('release', 'create', tag, '--draft', '--target', process.env.RELEASE_COMMIT, '--title', `Falcon Engine ${version}`, '--notes-file', notas, ...(canal === 'pruebas' ? ['--prerelease'] : []));
gh('release', 'upload', tag, ...archivos.map(a => path.join('instaladores', a)), '--clobber');
const remoto = JSON.parse(gh('release', 'view', tag, '--json', 'assets,isDraft'));
if (!remoto.isDraft || archivos.some(n => !remoto.assets.some(a => a.name === n && a.size === fs.statSync(path.join('instaladores', n)).size))) throw Error('No se publicará: la subida está incompleta');
gh('release', 'edit', tag, '--draft=false', ...tipo, '--title', `Falcon Engine ${version}`, '--notes-file', notas);
console.log(gh('release', 'view', tag, '--json', 'url', '--jq', '.url').trim());
