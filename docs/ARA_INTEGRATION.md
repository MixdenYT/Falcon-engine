# Integración de Ara en Falcon

Estado del 21-11-2026:
- Falcon: `motor-ara` en `6117105`. Su copia del compilador y del runtime de Ara es de `2ff41f0`.
- Ara: `ara-etapa5/ara`, `motor-ara` en `7e4e99b`.
El lenguaje y su API para juegos están en `ara-etapa5/ara/docs/JUEGOS.md`. Aquí solo se cuenta cómo lo usa Falcon.

## 1. Scripts de juego

| Archivo (`src/ara/`) | Papel |
|---|---|
| `ara_web.wasm` | El compilador de Ara (Rust, crate `ara_web`) compilado a wasm. Va en el editor, **no** en los juegos exportados (`exportar.js:21-22`) |
| `ara_runtime.wasm` | El runtime. Desde `abc24d9` es el escrito en Ara (`crates/ara_wasm/runtime/`) |
| `ara.mjs`, `compilador.mjs` | El cargador y la envoltura del compilador |
| `motor.ara` | La API de Falcon en Ara: 24 `externa tipo` y 10 `externa evento` |
| `api-motor.js` | La misma API en JS, para el compilador de Blueprints. La regenera `node herramientas/api-ara.mjs`; la prueba `api-motor.js está al día con motor.ara` lo comprueba |
| `puente.js` | `ProgramaAra` (todos los `.ara` del proyecto compilados juntos con `motor.ara`) e `InstanciaAra` (el script de un nodo) |
| `convertir.js` | El conversor de Águila a Ara (ver [`MIGRATION.md`](MIGRATION.md)) |

Flujo: `Mundo.compilarAra` (`mundo.js:439`) junta:
- los `.ara`, salvo `generado/`;
- el Ara de cada `.bp`.

Después:
- **En el editor**, compila todo con `ProgramaAra.crear`.
- **En un juego exportado**, monta `.falcon/ara.wasm` con `ProgramaAra.desdeCompilado` (`puente.js:142`).

Pruebas: `pruebas/ara.test.js` (12) y `pruebas/convertir.test.js`.

## 2. Blueprints → Ara

Cada `.bp` se compila a una clase de Ara con `compilarBlueprint`. Esa clase entra en el mismo módulo que los scripts. Detalle en [`BLUEPRINTS.md`](BLUEPRINTS.md).

## 3. Núcleo del motor en Ara

| Pieza | Qué es |
|---|---|
| `src/motor/ara/*.ara` | El código. Hoy solo `fisica2d.ara`, la clase `Fisica2D extiende Nucleo` |
| `src/motor/ara/nucleo.wasm` | El código compilado, **versionado** en git. Los juegos exportados lo llevan porque copian `src/motor`, y lo cargan sin el compilador |
| `herramientas/compilar-nucleo-ara.mjs` | Regenera `nucleo.wasm`; con `--comprobar` solo verifica |
| `src/motor/nucleo-ara.js` | Lo carga una vez (`nucleoAra()`) y expone `fisica2d.*` con llamadas síncronas |

- El JS de `mundo.js` sigue siendo el respaldo. Se usa si el núcleo no carga o si da un error en ejecución (`mundo.js:825-828`).
- La prueba `nucleo.wasm está al día con src/motor/ara/*.ara` (`pruebas/fisica2d-ara.test.js:208`) falla si alguien cambia un `.ara` y no regenera.

## 4. Actualizar el Ara de Falcon

```sh
# 1. En Ara (rama motor-ara): compila ara_web a wasm y copia compilador, runtime y cargadores.
ara-etapa5/ara/herramientas/copiar-a-falcon.sh ruta/a/falcon-engine
# 2. En Falcon: regenera el núcleo con el compilador y el runtime nuevos.
node herramientas/compilar-nucleo-ara.mjs
# 3. Pruebas.
npm test
```

- **El paso 2 es obligatorio.** El `nucleo.wasm` viejo con el runtime nuevo da posiciones erróneas (`REWRITE_ROADMAP.md`, actualización a `2ff41f0`).
- Confirma en un mismo commit `src/ara/*` y `src/motor/ara/nucleo.wasm`, como en `abc24d9`.
- `copiar-a-falcon.sh` no copia `motor.ara`, `puente.js` ni `api-motor.js`: son de Falcon.

## 5. Determinismo

- **Ara es la referencia.** La trigonometría (`sen`, `cos`…) es de fdlibm y da el mismo resultado bit a bit en JIT, wasm y código máquina (Ara `2857d96`). Falcon calcula con ella el seno y el coseno de la rotación (`abc24d9`).
- **V8 y Chromium no son estables:**
  - `Math.sin` y `Math.cos` de V8 difieren de fdlibm en 1 ulp en algunos ángulos;
  - Electron 44 y Node 26 difieren entre sí;
  - la `DOMMatrix` nativa de Chromium suma en otro orden y reduce los ángulos.

  Las cifras están en `REWRITE_ROADMAP.md`, «Verificación en Electron».
- **Consecuencias:**
  - las pruebas comparan Ara con la `DOMMatrix` de `pruebas/dom.js`, no con la de Chromium;
  - en Electron, el respaldo JS puede separarse de Ara al cabo de cientos de pasos;
  - la ruta válida es la de Ara.

## 6. FFI nativa de Ara: base de la fase nativa

Referencia: `ara-etapa5/ara/docs/NATIVO.md`. Las líneas citadas son de Ara `7e4e99b`, el `HEAD` de `motor-ara` a las 13:52 del 21-11-2026. El compilador que lleva Falcon es todavía el de `2ff41f0`.

- **Qué hay en Ara:**
  - **FFI.** `compilador/nativo.ara` traduce `externa "x.dll" func f(...)` a llamadas Win64 a DLL del sistema (`b016792`; `funciones_de_bibliotecas`, `nativo.ara:8065`).
  - **Búfer de bytes** `ara:memoria` (`ejemplos/nativo/bufer.ara`) y ventana Win32 con un triángulo OpenGL 1.1 (`fc4e549`).
  - **Tipos de frontera** `f32`, `i32` y `u32`, solo en las `externa` (`0106860`).
  - **Llamadas indirectas** con `ara:indirecta` (`b8e8884`).
  - **Funciones de Ara para una DLL** con `retrollamada(f)`, por ejemplo un `WNDPROC` propio (`98634f6`).
  - **Ejemplo** de cubo con OpenGL moderno (`ejemplos/ventana_cubo.ara`, `eb22a34`).
- **Límites:**
  - solo Windows x64: ELF y ARM64 lo rechazan (`nativo.ara:409`);
  - no se puede dar a una DLL una función de Ara con `f32`, `i32`, `u32`, textos, listas u objetos;
  - una DLL no puede leer la memoria de Ara, así que todo pasa por el búfer;
  - no hay funciones variádicas;
  - el JIT no ejecuta `externa`.
- **En Falcon, nada usa la FFI todavía.** Es la base de las fases 3 y 4 de [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md), que están en Plan.
- En wasm, una `externa "x.dll"` se importa del módulo `"x.dll"`. El cargador solo da los módulos `ara` y `anfitrion` (`ara.mjs:311`), así que un script de juego que la declare no se puede instanciar. Es una deducción del código; no se ha probado.
