// Keep a Changelog headings, rendered as text (never executable Markdown/HTML).
const semver = require('semver');

function versionValida(tag) {
  return typeof tag === 'string' ? semver.valid(tag.trim().replace(/^v/, '')) : null;
}
function versionNueva(actual, candidata, pruebas = false) {
  const a = versionValida(actual), b = versionValida(candidata);
  return !!(a && b && (pruebas || !semver.prerelease(b)) && semver.gt(b, a));
}
function notasTexto(notas) {
  if (Array.isArray(notas)) return notas.map(n => n.note || '').join('\n\n');
  return typeof notas === 'string' ? notas.slice(0, 100000) : '';
}
function agruparNotas(notas) {
  const grupos = { nuevo: [], mejorado: [], corregido: [], seguridad: [], otros: [] };
  let grupo = 'otros', ultimo = null;
  for (const linea of notasTexto(notas).split(/\r?\n/)) {
    const cabecera = /^#{1,6}\s+(.+)$/.exec(linea);
    if (cabecera) {
      const s = cabecera[1].trim().toLowerCase();
      grupo = /^(added|nuevo|nuevos|añadido|añadidos|agregado|agregados)\b/.test(s) ? 'nuevo'
        : /^(changed|improved|mejorado|mejoras|cambiado|cambios)\b/.test(s) ? 'mejorado'
        : /^(fixed|corregido|corregidos|correcciones)\b/.test(s) ? 'corregido'
        : /^(security|seguridad)\b/.test(s) ? 'seguridad' : 'otros';
      ultimo = null;
      continue;
    }
    const texto = linea.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, '').trim();
    if (!texto) { ultimo = null; continue; }
    // Preserve the author's actual text, including unknown headings/paragraphs.
    if (/^\s{2,}\S/.test(linea) && ultimo) ultimo.texto += ' ' + texto;
    else if (grupos[grupo].length < 100) { ultimo = { texto: texto.slice(0, 4000) }; grupos[grupo].push(ultimo); }
  }
  return grupos;
}
function elegirRelease(releases, actual, pruebas) {
  return releases.filter(r => !r.draft && (pruebas || !r.prerelease) && versionNueva(actual, r.tag_name, pruebas))
    .sort((a, b) => semver.rcompare(versionValida(a.tag_name), versionValida(b.tag_name)))[0] || null;
}
module.exports = { versionValida, versionNueva, notasTexto, agruparNotas, elegirRelease };
