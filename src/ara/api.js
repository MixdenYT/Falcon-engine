// La API de motor.ara como datos, para lo que genera código de Ara sin compilarlo (el compilador de Blueprints).
// `api-motor.js` es esta tabla ya calculada (la escribe `node herramientas/api-ara.mjs`; una prueba comprueba que
// coincide con motor.ara).

const ID = '[\\p{L}_][\\p{L}\\p{N}_]*';
const RE_TIPO = new RegExp(`^externa tipo (${ID})(?: extiende (${ID}))?$`, 'u');
const RE_PROPIEDAD = new RegExp(`^externa propiedad (${ID})\\.(${ID}): (.+)$`, 'u');
const RE_FUNC = new RegExp(`^externa func (?:(${ID})\\.)?(${ID})\\((.*)\\)(?: -> (.+))?$`, 'u');
const RE_EVENTO = new RegExp(`^externa evento (${ID})\\((.*)\\)$`, 'u');

const params = (texto) => texto.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
  const [nombre, tipo] = p.split(':').map((x) => x.trim());
  return { nombre, tipo: tipo || null };
});

/**
 * Lee las declaraciones `externa` de motor.ara.
 * @returns {{ tipos: Object<string, string|null>, propiedades: Object<string, string>,
 *   metodos: Object<string, Array<{params, retorno}>>, funciones: Object<string, Array<{params, retorno}>>,
 *   eventos: Object<string, Array<{nombre, tipo}>> }}  Las claves de propiedades y métodos son `Tipo.nombre`;
 *   los parámetros de los métodos no incluyen `este`.
 */
export function analizarMotor(texto) {
  const api = { tipos: {}, propiedades: {}, metodos: {}, funciones: {}, eventos: {} };
  for (const cruda of texto.split('\n')) {
    const l = cruda.trim();
    let m;
    if ((m = RE_TIPO.exec(l))) api.tipos[m[1]] = m[2] || null;
    else if ((m = RE_PROPIEDAD.exec(l))) api.propiedades[`${m[1]}.${m[2]}`] = m[3].trim();
    else if ((m = RE_EVENTO.exec(l))) api.eventos[m[1]] = params(m[2]);
    else if ((m = RE_FUNC.exec(l))) {
      const ps = params(m[3]);
      const firma = { params: m[1] ? ps.slice(1) : ps, retorno: (m[4] || 'nada').trim() };
      const tabla = m[1] ? api.metodos : api.funciones;
      const clave = m[1] ? `${m[1]}.${m[2]}` : m[2];
      (tabla[clave] ||= []).push(firma);
    }
  }
  return api;
}

/** Busca un miembro de un tipo de nodo subiendo por sus bases: `{ clave, propiedad }` o `{ clave, firmas }`, o null. */
export function miembroDe(api, tipo, nombre) {
  for (let t = tipo; t; t = api.tipos[t]) {
    const k = `${t}.${nombre}`;
    if (k in api.propiedades) return { clave: k, propiedad: api.propiedades[k] };
    if (k in api.metodos) return { clave: k, firmas: api.metodos[k] };
  }
  return null;
}
