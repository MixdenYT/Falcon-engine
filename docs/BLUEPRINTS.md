# Blueprints

Estado del 21-11-2026, rama `motor-ara`. Todo lo que se describe aquí existe y tiene pruebas.

## Flujo

```
.bp (JSON) ──> compilador de Blueprints: dos versiones con el mismo resultado
                  · en Ara: src/motor/ara-blueprints/blueprints.ara → blueprints.wasm (juego)
                  · en JS: compilarBlueprint, src/motor/blueprints.js:247 (editor, exportación, respaldo)
                  ├─ validación: nombres, tipos de cable, miembros de la API ─> errores por bloque
                  └─ código Ara: «clase <Nombre>Bp extiende <base>:» + líneas por bloque
                         │
                         ├─ editor: se escribe en generado/blueprints/<nombre>.ara (solo lectura)
                         └─ juego / exportación: entra en el mismo módulo que los .ara ─> compilador de Ara ─> wasm
```

- **Formato del `.bp`:** `{ formato: 'falcon-blueprint', version: 1, nombre, base, variables, funciones, grafos }` (`blueprintVacio`, `blueprints.js:186`). El grafo `eventos` va en `grafos.eventos` y cada función en `grafos['fn:<nombre>']`.
- **Qué devuelve el compilador:** `{ codigo, clase, errores, avisos, lineas }` (`blueprints.js:702`). `lineas` da la línea de cada bloque, para situar los errores de ejecución.
- **Dos pasadas.** La primera deduce lo que devuelve cada función (lo que llega a «Devolver»); la segunda genera el código (`blueprints.js:684`).
- **`generado/` no cuenta al ejecutar.** `Mundo.compilarAra` (`mundo.js:439-453`) y `exportar.js:58-63` compilan siempre desde el `.bp`, así que nunca corre una versión vieja.
- **El compilador también está escrito en Ara** (bloque 5 de la fase 2, [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md)). Ver la sección siguiente.

## Compilador en Ara

- **Archivos:**
  - `src/motor/ara-blueprints/blueprints.ara`: traduce `compilarBlueprint` función por función;
  - `blueprints.wasm`: el anterior compilado, versionado como `nucleo.wasm`. Se regenera con `node herramientas/compilar-blueprints-ara.mjs` y se comprueba con `--comprobar` o con la prueba;
  - `src/motor/blueprints-ara.js`: lo carga una vez y ofrece `compiladorBlueprintsAra()` (`{ compilar(bp, archivo) }`) y `compiladorBlueprints()`, que usa Ara y, si no carga o falla, JS.
- **Quién lo usa:**
  - el juego (`Mundo.compilarAra`) usa `compiladorBlueprints()`;
  - el editor, la exportación y las plantillas siguen con `compilarBlueprint`, que es síncrono.
  - Los dos dan lo mismo, así que el código de `generado/` no cambia.
- **Frontera.** JS no decide nada; solo aplana:
  - una vez, el catálogo (`NODOS`) y la API (`API_MOTOR`), con llamadas escalares;
  - en cada compilación, el `.bp` en **un solo texto**: campos separados por el carácter 31 y cada registro con su letra delante (`E`, `V`, `F`, `P`, `G`, `N`, `v`, `C`); el 27 escapa al 31 y a sí mismo;
  - cada valor cruza como su clase de JS (`typeof`), `String(v)` y `Number(v)`. Con eso Ara repite `??`, `||`, `Number(v) < 0` y `String(v)` como JS.
  - El resultado vuelve por cuatro externas (`bp_codigo`, `bp_clase`, `bp_error`, `bp_linea`). Las funciones `C.func` no pueden devolver textos.
- **Números.** Ara escribe los decimales con las mismas cifras que JS, pero cambia a notación científica en otros límites (`1e-06` frente a `0.000001`, `1e+16` frente a `10000000000000000`). Por eso `numero_js` rehace `String(x)` con la regla de JS.
- **Límites conocidos** (en el código con `shortcut:`):
  - `es_letra` / `es_alfanumerico` de Ara son la propiedad «Alphabetic» de Unicode, algo más que `\p{L}`/`\p{N}` de JS: un nombre con marcas como las vocales de devanagari sería válido en Ara y no en JS;
  - `toFixed(12)` (decimales menores que 1e-6) redondea en coma flotante;
  - nombres que no son textos (un `true` o una lista como nombre de variable) se comparan por su texto.
  - El editor no escribe ninguno de estos casos.
- **Rendimiento.** Ara es 1,6–1,7× más lento que JS: 3,2 ms frente a 1,85 ms para los 76 Blueprints. La mitad es la frontera ([`BENCHMARKS.md`](BENCHMARKS.md)).

## Validación

- **Tipos de pin** (`TIPOS_DATO`): `exec`, `bool`, `decimal`, `entero`, `texto`, `objeto`, `lista` y `cualquiera`.
- **Al conectar** (`compatibles`, `blueprints.js:175`):
  - `exec` solo con `exec`;
  - los números entre sí;
  - cualquier valor hacia `texto` o `bool`;
  - `cualquiera` con todo.
- **Al compilar:**
  - inserta la conversión que hacía Águila (`texto(x)`, `x != 0`, `otro.existe()`…);
  - si no hay conversión, da un error en ese bloque;
  - también da error con nombres que no son identificadores o que son palabras de Ara (`PALABRAS_ARA`), con miembros que no existen en `src/ara/api-motor.js` y con variables exportadas que no son número, texto ni sí/no.
- **Los parámetros `cualquiera`** toman el tipo del primer valor que les llega en una llamada; si no les llega ninguno, son `decimal`.

## Tipos de bloque

Hay 67 bloques en 9 categorías (`NODOS`, `CATEGORIAS`):

| Categoría | Bloques |
|---|---|
| Eventos | 10 |
| Entrada | 5 |
| Movimiento | 7 |
| Lógica | 10 |
| Matemáticas | 8 |
| Variables | 9 |
| Escena | 12 |
| Texto | 3 |
| Audio | 3 |

Los bloques `ob_*` leen y cambian propiedades, y llaman a métodos y funciones de otro nodo por su nombre. El nombre del miembro tiene que ser constante (`blueprints.js:255-261`).

## Editor

- `src/editor/disposiciones/blueprints.js`: listas de variables, eventos y funciones; buscador de bloques; Inspector.
- Recompila en vivo (`compilarBlueprint`, línea 43). Marca en rojo los bloques con error (línea 150) y muestra el código generado en solo lectura (línea 262).
- `src/ui/grafo.js` (`crearGrafo`) es el lienzo de nodos genérico. Lo comparten Blueprints y materiales; la semántica la pone quien lo usa (`definicion`, `compatibles`, `cambiar`).
- **CQB.** `src/motor/cqb-blueprints.js` (`blueprintsCQB`) construye por código los grafos de la IA del CQB. Pasan por el mismo compilador y se pueden editar en el editor.

## Pruebas

| Archivo | Qué demuestra |
|---|---|
| `pruebas/blueprints.test.js` (7) | Clases con campos tipados, eventos con filtro, funciones con parámetros y retorno deducidos, otros nodos, errores por bloque, nombres, y que **todo el catálogo** compila a Ara |
| `pruebas/ara.test.js` | Los Blueprints van compilados al exportar, y uno con errores detiene la exportación |
| `pruebas/cqb.test.js`, `pruebas/ejemplos.test.js` | Grafos reales (CQB, plantillas, Academia) que compilan y juegan |
| `pruebas/blueprints-ara.test.js` (4) | El compilador en Ara da exactamente lo mismo que el de JS (texto, errores, avisos y líneas) con los 76 Blueprints que existen (`pruebas/corpus-blueprints.js`), con casos límite (números, escapes, nombres, base) y con 608 variaciones al azar de semilla fija; `blueprints.wasm` está al día |
