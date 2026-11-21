# Blueprints

Estado del 21-11-2026, rama `motor-ara` (`6117105`). Todo lo que se describe aquí existe y tiene pruebas.

## Flujo

```
.bp (JSON) ──> compilarBlueprint (src/motor/blueprints.js:247, JS)
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
- **El compilador de Blueprints es JS.** Pasarlo a Ara es el bloque 5 de la fase 2 (Plan, [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md)).

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
