// El compilador de Ara dentro de JavaScript (navegador, Node o Electron), a partir de `ara_web.wasm`
// (`herramientas/compilador-wasm.sh`). Lleva dentro el runtime, así que compilar y ejecutar no necesita nada más:
//
//   import { crearCompilador } from './compilador.mjs';
//   import { cargar } from './ara.mjs';
//   const ara = await crearCompilador(bytesDeAraWeb);
//   const r = ara.compilar([['motor.ara', textoMotor], ['jugador.ara', textoJugador]]);
//   if (!r.ok) mostrar(r.errores);           // [{ archivo, linea, columna, linea_fin, columna_fin, mensaje, nota, ... }]
//   else await cargar(r.modulo, { runtime: ara.runtime, ... });

/** Instancia el compilador. */
export async function crearCompilador(bytes) {
  // El compilador lleva dentro el runtime (que importa estas dos funciones), pero no las usa para compilar.
  const { instance } = await WebAssembly.instantiate(bytes, { anfitrion: { escribir: () => {}, ahora: () => 0 } });
  const x = instance.exports;
  const codificador = new TextEncoder();
  const decodificador = new TextDecoder();
  const copiar = (p, n) => new Uint8Array(x.memory.buffer, p, n).slice();
  const texto = () => decodificador.decode(copiar(x.ara_web_texto_puntero(), x.ara_web_texto_largo()));
  const conEntrada = (cadena, f) => {
    const bytes = codificador.encode(cadena);
    const p = x.ara_web_reservar(bytes.length);
    new Uint8Array(x.memory.buffer, p, bytes.length).set(bytes);
    try { return f(p, bytes.length); } finally { x.ara_web_liberar(p, bytes.length); }
  };
  return {
    /** Bytes de `ara_runtime.wasm`, para `cargar(modulo, { runtime })`. */
    runtime: copiar(x.ara_web_runtime_puntero(), x.ara_web_runtime_largo()),
    /**
     * Compila varios archivos (clave y texto) como un solo programa.
     * @returns {{ ok: boolean, errores: object[], archivos: {clave: string, base: number}[], modulo: Uint8Array | null }}
     */
    compilar(archivos) {
      const ok = conEntrada(JSON.stringify({ archivos }), (p, n) => x.ara_web_compilar(p, n));
      const r = JSON.parse(texto());
      r.modulo = ok ? copiar(x.ara_web_modulo_puntero(), x.ara_web_modulo_largo()) : null;
      return r;
    },
    /** Da formato a un archivo: `{ ok, texto }` (si no es válido, `texto` es el error). */
    formatear(codigo) {
      const ok = conEntrada(codigo, (p, n) => x.ara_web_formatear(p, n));
      return { ok: ok === 1, texto: texto() };
    },
  };
}

/**
 * Sitúa una posición del programa completo (un error de ejecución) en su archivo, con `archivos` del resultado de
 * `compilar` y los textos: `{ archivo, linea, columna }` (desde 1), o `null`.
 */
export function situar(posicion, archivos, textos) {
  if (posicion == null) return null;
  let f = null;
  for (const a of archivos) if (a.base <= posicion) f = a;
  if (!f) return null;
  const t = textos[f.clave] ?? '';
  const antes = new TextDecoder().decode(new TextEncoder().encode(t).slice(0, posicion - f.base));
  const lineas = antes.split('\n');
  return { archivo: f.clave, linea: lineas.length, columna: [...lineas[lineas.length - 1]].length + 1 };
}
