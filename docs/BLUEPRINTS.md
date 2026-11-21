# Blueprints

Estado del 21-11-2026, rama `motor-ara`. Todo lo que se describe aquí existe y tiene pruebas.

## Flujo

```
.bp (JSON) ──> compilador de Blueprints, escrito en Ara (el único):
                  src/motor/ara-blueprints/blueprints.ara → blueprints.wasm, cargado por
                  src/motor/blueprints-ara.js (`compilarBlueprint`): editor, plantillas, juego y exportación
                  ├─ validación: nombres, tipos de cable, miembros de la API ─> errores por bloque
                  └─ código Ara: «clase <Nombre>Bp extiende <base>:» + líneas por bloque
                         │
                         ├─ editor: se escribe en generado/blueprints/<nombre>.ara (solo lectura)
                         └─ juego / exportación: entra en el mismo módulo que los .ara ─> compilador de Ara ─> wasm
```

- **Formato del `.bp`:** `{ formato: 'falcon-blueprint', version: 1, nombre, base, variables, funciones, grafos }` (`blueprintVacio`, `blueprints.js:180`). El grafo `eventos` va en `grafos.eventos` y cada función en `grafos['fn:<nombre>']`.
- **Qué devuelve el compilador:** `{ codigo, clase, errores, avisos, lineas }` (`blueprints-ara.js:28`). `lineas` da la línea de cada bloque, para situar los errores de ejecución.
- **Dos pasadas.** La primera deduce lo que devuelve cada función (lo que llega a «Devolver»); la segunda genera el código.
- **`generado/` no cuenta al ejecutar.** `Mundo.compilarAra` (`mundo.js:441-457`) y `exportar.js:58-66` compilan siempre desde el `.bp`, así que nunca corre una versión vieja.
- **El compilador está escrito en Ara** (bloque 5 de la fase 2, [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md)). Ver la sección siguiente.

## Compilador en Ara

- **Archivos:**
  - `src/motor/ara-blueprints/blueprints.ara`: el compilador. Nació como traducción función por función del de JS, que se retiró después (ver «Sin compilador de JS»);
  - `blueprints.wasm`: el anterior compilado, versionado como `nucleo.wasm`. Se regenera con `node herramientas/compilar-blueprints-ara.mjs` y se comprueba con `--comprobar` o con la prueba;
  - `src/motor/blueprints-ara.js`: `cargarCompiladorBlueprints()` carga el wasm una vez (promesa) y `compilarBlueprint(bp, archivo)` compila, síncrono, una vez cargado.
- **Quién lo carga** (una vez por ventana o proceso) y quién lo usa:
  - el editor, al abrir el proyecto (`editor.js`, `iniciar`); luego compilan síncronos los errores en vivo del grafo (`disposiciones/blueprints.js`), guardar (`estado.js`), crear un Blueprint (`acciones.js`) y «Compilar todo» (`editor.js`);
  - `crearProyecto` (`plantillas.js`), antes de construir la plantilla: las plantillas, la Academia y el CQB escriben el Ara de sus Blueprints en `generado/`;
  - el juego (`Mundo.compilarAra`), también el exportado;
  - la exportación (`exportar.js`, proceso principal): el módulo es ESM y el proceso principal ya lo importa con `import()`, así que carga el mismo wasm allí. No hace falta precompilar.
- **Sin compilador de JS.** Si `blueprints.wasm` no carga, no hay respaldo: `cargarCompiladorBlueprints()` falla con «No se pudo cargar el compilador de Blueprints (blueprints.wasm): …» y `compilarBlueprint` lanza ese error. El editor lo escribe en la consola, el juego lo da como error de cada `.bp` y la exportación se detiene con él.
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
- **Rendimiento.** 3,2 ms para los 76 Blueprints; el de JS retirado tardaba 1,85 ms, así que Ara es 1,6–1,7× más lento. La mitad es la frontera, y en el editor se compila un Blueprint cada vez (~0,04 ms) ([`BENCHMARKS.md`](BENCHMARKS.md)).

## Validación

- **Tipos de pin** (`TIPOS_DATO`): `exec`, `bool`, `decimal`, `entero`, `texto`, `objeto`, `lista` y `cualquiera`.
- **Al conectar** (`compatibles`, `blueprints.js:169`):
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

Los bloques `ob_*` leen y cambian propiedades, y llaman a métodos y funciones de otro nodo por su nombre. El nombre del miembro tiene que ser constante (`ara-blueprints/blueprints.ara:1595-1602`).

## Editor

- `src/editor/disposiciones/blueprints.js`: listas de variables, eventos y funciones; buscador de bloques; Inspector.
- Recompila en vivo (`compilarBlueprint`, líneas 44 y 435). Marca en rojo los bloques con error (línea 151) y muestra el código generado en solo lectura (línea 265).
- `src/ui/grafo.js` (`crearGrafo`) es el lienzo de nodos genérico. Lo comparten Blueprints y materiales; la semántica la pone quien lo usa (`definicion`, `compatibles`, `cambiar`).
- **CQB.** `src/motor/cqb-blueprints.js` (`blueprintsCQB`) construye por código los grafos de la IA del CQB. Pasan por el mismo compilador y se pueden editar en el editor.

## Pruebas

| Archivo | Qué demuestra |
|---|---|
| `pruebas/blueprints.test.js` (7) | Clases con campos tipados, eventos con filtro, funciones con parámetros y retorno deducidos, otros nodos, errores por bloque, nombres, y que **todo el catálogo** compila a Ara |
| `pruebas/ara.test.js` | Los Blueprints van compilados al exportar, y uno con errores detiene la exportación |
| `pruebas/cqb.test.js`, `pruebas/ejemplos.test.js` | Grafos reales (CQB, plantillas, Academia) que compilan y juegan |
| `pruebas/blueprints-ara.test.js` (4) | El compilador da exactamente la referencia guardada en `pruebas/blueprints-esperado.json` (texto, errores, avisos y líneas), que generó el compilador de JS antes de retirarlo: los 76 Blueprints que existen (`pruebas/corpus-blueprints.js`, con los ids de bloque renumerados), 16 casos límite (números, escapes, nombres, base) y la huella de 608 variaciones al azar de semilla fija (154 con errores); `blueprints.wasm` está al día. Si cambia a propósito una plantilla o el compilador: `FIJAR=1 node pruebas/blueprints-ara.test.js` y revisar el diff |
