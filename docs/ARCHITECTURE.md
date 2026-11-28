# Arquitectura de Falcon engine

Estado del 21-11-2026, rama `motor-ara` (`6117105`). Las referencias `fichero:línea` son de ese commit.
Lo marcado **Plan** no existe en el código. Plan y fases: [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md).

## Arquitectura actual

```
┌─ Proceso principal (Node, Electron 44) ── src/principal/
│   main.js: ventanas, protocolo falcon://, IPC de disco/diálogos, exportar, actualizar
│   jugador.js: el mismo papel en un juego exportado (sin editor)
│
├─ Renderer «gestor»  src/gestor/gestor.html  (proyectos, ajustes, actualizaciones)
├─ Renderer «editor»  src/editor/editor.html  (paneles DOM, visor2d, visor3d, grafo de Blueprints)
└─ Renderer «juego»   src/juego/juego.html    (prueba desde el editor o juego exportado)
        │
        └─ Mundo (src/motor/mundo.js) ─ un paso por fotograma (requestAnimationFrame)
             ├─ scripts: Ara→wasm (src/ara/puente.js) · Águila interpretado (src/aguila/) · Blueprints→Ara
             ├─ física 2D: núcleo Ara (src/motor/ara/nucleo.wasm) o JS de respaldo
             ├─ 3D: Mundo3D (three.js, cajas, Controles3D, CQB) + Lumbre (WebGL2)
             ├─ dibujo 2D: Render2D (Canvas2D)
             ├─ audio: Web Audio (audio.js) · entrada: DOM y Gamepad (entrada.js)
             └─ datos: Proyecto (proyecto.js) a través de window.falcon (preload → IPC)
```

### Procesos y páginas

| Pieza | Qué hace | Prueba |
|---|---|---|
| Esquema `falcon://` (`app` y `fs`) | Sirve la app y los archivos del proyecto a las páginas | `main.js:17`, `main.js:46`; en juegos, `jugador.js:18`, `jugador.js:32` |
| Ventanas | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` | `main.js:129-131` (ver [`SECURITY.md`](SECURITY.md), M1) |
| Gestor y editor | `loadURL` de `gestor.html` y `editor.html` | `main.js:175`, `main.js:181` |
| Probar el juego | Ventana nueva con `preload-juego.js` (solo lectura) | `main.js:397-413` |
| Juego exportado | Electron + `jugador.js` + `src/motor`, `src/juego` y el runtime de Ara, sin compilador | `exportar.js:19-23` |

### Motor (`src/motor/`)

- **Bucle.** `juego.js:41` crea el `Mundo`; `juego.js:218-224` llama a `mundo.paso` cada fotograma.
- **Orden de `Mundo.paso`** (`mundo.js:682`): entrada → eventos → controles integrados → `se_actualiza` → corrutinas y `esperar` → temporizadores → física y contactos (`mundo.js:707-708`) → animación de sprites y partículas → eliminados.
- **2D o 3D.** `cargarEscena` importa `mundo3d.js` solo si la escena es 3D (`mundo.js:527`). `dibujar` usa `Mundo3D.dibujar` o `Render2D` (`mundo.js:1328-1348`).
- **Escena.** Árbol de nodos JSON (`.fscn`); los tipos y sus propiedades, en `tipos.js`.

### Núcleo en Ara

- `src/motor/ara/*.ara` se precompila a `nucleo.wasm`, que va versionado.
- La lógica va en módulos sin clases de script (`fisica2d.ara`, la `estructura Fisica`), que compilan también a nativo. Las clases que JS llama (`Fisica2D` en `nucleo.ara`) solo los envuelven.
- `Mundo.iniciar` lo precarga (`mundo.js:424`). Si no carga, la física sigue en JS (`mundo.js:305`, `mundo.js:820-828`).
- Hoy solo hay física 2D: matrices, cajas, `mover` y los pares de `contactos2d`. Detalle en [`ARA_INTEGRATION.md`](ARA_INTEGRATION.md).

### Puente Ara↔JS

- **Scripts.** `ProgramaAra` y `InstanciaAra` (`puente.js:109`, `puente.js:372`) implementan las `externa` de `src/ara/motor.ara`. Lo hacen con la misma API que Águila (`aguilaObtener`, `aguilaAsignar`, `metodos`).
- **Núcleo.** Llamadas síncronas a `Fisica2D.func.*` (`nucleo-ara.js:16-49`). Los `entero` cruzan como `BigInt`.
- **Coste.** Cada cruce cuesta. Medidas en [`BENCHMARKS.md`](BENCHMARKS.md).

### Render, audio, entrada y exportación

- **Render 2D.** Canvas2D (`render2d.js`).
- **Render 3D.** three.js 0.186 (`escena3d.js`) con Lumbre (`lumbre.js`). Inventario en [`GRAPHICS.md`](GRAPHICS.md).
- **Audio.** Web Audio (`audio.js`).
- **Entrada.** Teclado, ratón y mando agrupados en acciones (`entrada.js`).
- **Exportación** (`src/principal/exportar.js`):
  - copia Electron y la app;
  - compila los `.ara` y los Blueprints a `.falcon/ara.wasm` y `.falcon/ara.json` (`exportar.js:241`);
  - plataformas: `win32-x64`, `linux-x64` y `linux-arm64` (`exportar.js:12-16`). Estado real en [`PLATFORM_MATRIX.md`](PLATFORM_MATRIX.md).

## Arquitectura objetivo (Plan)

Es la propuesta de `REWRITE_ROADMAP.md`, «Arquitectura propuesta». Ese documento la da como **pendiente de aprobación**.

```
Editor Falcon (DOM, se conserva) ─┐
Blueprints → Ara                  ├─> compilador de Ara ─> wasm (hoy) | x86-64 / ARM64 .exe (Plan)
Scripts .ara del juego            ┘
Falcon Runtime ─ núcleo en Ara: escena, física, controles, IA, animación
               └ capa de plataforma fina y sustituible:
                   hoy: JS (three.js / Canvas2D, Web Audio, DOM)
                   Plan: Ara nativo (Win32 + OpenGL/D3D11, WASAPI) mediante `externa "x.dll"`
```

**Qué existe hoy de esa meta:**
- núcleo en Ara: solo la física 2D;
- FFI nativa de Ara a DLL de Windows x64 (Ara `7e4e99b`, `docs/NATIVO.md`), con:
  - tipos de frontera `f32`, `i32` y `u32`;
  - llamadas indirectas y retrollamadas;
  - ejemplos de ventana Win32 con OpenGL.

  Falcon la usa solo en `examples/native-2d`: el nivel de «plataformas» en un `.exe` (Win32, OpenGL 1.1, teclado) con sus scripts y Blueprints de verdad y la misma física 2D que el núcleo wasm, igual bit a bit que el juego en Falcon (ver [`ARA_INTEGRATION.md`](ARA_INTEGRATION.md) §6).

### Decisión: scripts y Blueprints en nativo con un anfitrión escrito en Ara

El mismo código de juego (las clases de Ara de los scripts y de los Blueprints) compila a dos destinos; solo cambia el anfitrión, el que da las `externa` de `src/ara/motor.ara`:

```
scripts .ara + Blueprints → clases de Ara ─┬─ wasm: anfitrión en JS (src/ara/puente.js, ProgramaAra)      → Electron
           + src/ara/motor.ara (la API)    └─ .exe: anfitrión en Ara (src/motor/nativo/anfitrion2d.ara)      → Windows x64
                                                    + escena generada + juego.ara (ventana, dibujo, teclado)
```

- **Cómo.** Tres mejoras generales de Ara (`docs/NATIVO.md`, «Un anfitrión escrito en Ara»; Ara `motor-ara`, `fced30d`):
  - `externa func f(...):` con cuerpo implementa una externa ya declarada (también propiedades y `esperar`), y no se importa;
  - `Clase(yo)` crea un objeto de una clase de script;
  - `avisar(objeto, "evento", ...)` ejecuta sus `cuando`.
- **El anfitrión nativo** (`anfitrion2d.ara`) implementa la parte de `motor.ara` que usa un juego 2D de plataformas sobre una tabla de nodos y `fisica2d.ara`. Repite `Mundo.paso` y `ProgramaAra` en el mismo orden: eventos, esperas, física, contactos, eliminados y reinicio.
- **`esperar`.** Cada evento corre en una fibra de Windows, y `esperar` vuelve a la principal: hace lo mismo que JSPI en wasm.
- **La escena** la genera `herramientas/escena-nativa-2d.mjs`: los nodos, y una función por evento que reparte con `avisar` a la clase de cada nodo.
- **Por qué así:**
  - las clases ya se compilaban a funciones normales; solo faltaba poder dar las externas desde Ara y llamar a las clases desde Ara;
  - wasm no cambia: sin cuerpos, el módulo sale igual byte a byte, con las mismas importaciones y exportaciones (`ProgramaAra` no se toca);
  - lo que no se implementa no compila a nativo, y `nativo` dice qué externa falta.
- **Alternativas descartadas** (detalle en `docs/NATIVO.md` de Ara):
  - un paso del compilador solo para nativo que convierta las clases en código con una tabla de eventos: seguirían faltando las externas;
  - enlazar en `nativo` un segundo módulo con el anfitrión: memoria, datos y runtime compartidos, y nombres de exportación que Ara no sabe declarar;
  - una API distinta para nativo con estructuras en vez de tipos externos: las clases solo extienden tipos externos.
- **Prueba.** `pruebas/nativo-2d.test.js` compara Falcon (wasm, con los Blueprints reales) y el `.exe` paso a paso, bit a bit, en un guion de 1000 pasos que recoge monedas, muere en los pinchos (`esperar` y reinicio) y gana en la meta.

## Reglas de frontera

1. El núcleo en Ara es dueño del estado de simulación. La capa de plataforma solo lo lee para dibujar y sonar, y le pasa la entrada.
   - Hoy aún no se cumple del todo: `Mundo` (JS) es dueño del árbol, y `sincronizarAra` manda a Ara lo que cambió (`mundo.js:948`).
2. Lo que sirve a cualquier programa (FFI, `f32`, trigonometría, búferes) va a Ara. La lógica de juego va a Falcon. Ara no sabe nada de Falcon: `motor.ara` vive en Falcon.
3. Toda ruta de Ara necesita una prueba que la compare bit a bit con su respaldo JS, mientras el respaldo exista (`pruebas/fisica2d-ara.test.js`).
4. Hay que medir los cruces Ara↔JS en cada bloque, y agruparlos solo si cuestan.
5. Los datos del proyecto no son de confianza: se validan al cargar (`normalizarNodo`, `tipos.js:452`) y se escapan al pintar. Ver [`SECURITY.md`](SECURITY.md).
