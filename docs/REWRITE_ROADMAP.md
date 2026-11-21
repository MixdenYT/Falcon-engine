# Falcon Engine — Powered by Ara: hoja de ruta

Estado: **Fase 0 completada. La arquitectura está pendiente de aprobación** (paso 5 del prompt maestro). No hay reescritura estructural masiva hasta que se apruebe.
Rama de trabajo: `motor-ara`, en `falcon-engine` y en `ara-etapa5/ara`. Solo hay commits locales; no se ha subido nada a GitHub.

## Cómo se trabaja

- **Skills.** Caveman y Ponytail se cargan al inicio de cada sesión.
- **Agentes.** Los 8 agentes son roles. Cuando hay cupo, algunos corren como subagentes reales; si no, el mismo asistente los ejecuta en secuencia. Nunca se presentan como agentes independientes si no lo son.
  - El 20-11-2026 los subagentes se cortaron porque se alcanzó el límite semanal de uso.
- **Revisión cruzada de cada bloque**, antes de integrarlo. La hace otro rol, distinto del que escribió el código, y busca:
  1. Simplificación: ¿sobra código, una abstracción o una dependencia? ¿Algo de lo existente ya lo resuelve?
  2. Optimización: ¿hay un coste medible en CPU, memoria o llamadas Ara↔JS que se pueda quitar?
  3. Arquitectura: ¿encaja con los límites Ara/Falcon? ¿Fuerza a Ara a algo exclusivo de Falcon?

  Lo encontrado se aplica o queda anotado en el bloque con su justificación.
- **Estados:** Pendiente / En desarrollo / En revisión / Completado / Bloqueado. Completado exige código, pruebas pasadas, revisión cruzada y documentación al día.

## Auditoría: qué existe de verdad (21-11-2026)

### Falcon Engine 1.3.0
Electron 44 + three.js 0.186; unas 22.900 líneas de JS en `src/`. Hay 50 pruebas headless (`npm test`) y pasan las 50.

| Sistema | Dónde | Líneas | Estado real | Ara hoy |
|---|---|---|---|---|
| Escena, nodos y eventos | `motor/mundo.js`, `tipos.js` | 1.700 | Funciona | No |
| Física 2D | `mundo.js` (`fisica2d`, `contactos2d`) | 160 | Funciona | **En revisión** (B3): `fisica2d`, cajas, matrices de mundo y pares de `contactos2d` en Ara (`motor/ara/fisica2d.ara`), idénticos bit a bit; JS de respaldo. Ara es 1,8–4× más rápido (`docs/BENCHMARKS.md`) |
| Física 3D (cajas), controles, CQB | `mundo3d.js`, `control3d.js`, `tactico3d.js` | 1.075 | Funciona, mezclada con three.js | La IA de CQB sí (Blueprints→Ara) |
| Render 2D | `render2d.js` (Canvas2D) | 400 | Funciona | No |
| Render 3D y Lumbre | `lumbre*.js`, `escena3d.js`, `materiales.js` | 2.500 | Funciona: WebGL2, sondas, GTAO, bloom | No |
| Audio | `audio.js` (Web Audio) | 124 | Funciona | No |
| Entrada | `entrada.js` (DOM) | 78 | Funciona | No |
| Blueprints | `blueprints.js` y `cqb-blueprints.js` | 790 | Compilan a Ara de verdad (lo prueban los tests) | Generan Ara; el compilador del grafo es JS |
| Scripts | `src/ara/*` | 1.665 | Ara→wasm, entre 98 y 195× más rápido que Águila | Sí |
| Editor y gestor | `editor/`, `ui/`, `gestor/` | 8.570 | Funciona (DOM) | No |
| Exportación y actualizaciones | `principal/` | 1.078 | Funciona: NSIS, AppImage, electron-updater | No |
| Red / multijugador | — | 0 | No existe | — |

### Ara 0.3.0 (`ara-etapa5/ara`)

| Capacidad | Estado real |
|---|---|
| Compilador en Rust (JIT Cranelift, wasm, LSP) | Funciona; unas 225 pruebas |
| Compilador autoalojado (`compilador/`, unas 23.000 líneas de Ara) | Llega a punto fijo; su wasm es idéntico byte a byte al del compilador de Rust |
| Backend x86-64 (`nativo.ara`) | PE y ELF sin enlazador; de 1,0 a 2× las instrucciones de Rust |
| Backend ARM64 (`arm64.ara`) | Solo Windows y sin optimizar |
| WebAssembly | Funciona; es lo que usa Falcon |
| FFI nativa (`externa` en `.exe`) | **No existe**: rechazada en `nativo.ara:313`; imports fijos de KERNEL32 |
| Ventanas, GPU, audio, imágenes | **No existen** en el lenguaje ni en la biblioteca |
| `f32`, búferes de bytes, estructuras por valor | No existen |
| Trigonometría | Integrada (`sen`, `cos`, `tan`, `asen`, `acos`, `atan`, `atan2`, de fdlibm, igual bit a bit en JIT, wasm y código máquina). Falcon la usa desde el 21-11-2026 |
| Closures, genéricos, traits, hilos | No existen |
| Memoria | Conteo de referencias; los ciclos se pierden |

## Diagnóstico

1. «Motor 100 % Ara» se divide en dos problemas:
   - **(a) la lógica del motor.** Ya se puede hacer hoy: Ara→wasm, con JS solo para dibujar, sonar, leer la entrada y el editor.
   - **(b) quitar Electron y three.js.** Exige primero hacer crecer Ara: FFI nativa, `f32`, búferes y punteros a función.
2. El editor DOM (8.500 líneas) no tiene sustituto en Ara a corto plazo. Se conserva hasta que exista una UI nativa.
3. Lo primero que hay que resolver en Ara, y que sirve fuera de Falcon:
   - FFI nativa con DLL declaradas
   - `f32` y búferes de bytes
   - trigonometría
   - llamadas indirectas
4. Riesgo: cruzar Ara↔JS en cada escalar. Hay que medirlo en cada bloque y agrupar las llamadas si cuesta.

## Arquitectura propuesta (pendiente de aprobación)

```
Editor Falcon (DOM, se conserva) ─┐
Blueprints → Ara (código)         ├─> compilador de Ara ─> wasm ─┐
Scripts .ara del juego            ┘                   └> x86-64 / ARM64 (.exe)
                                                                 │
Falcon Runtime ── núcleo en Ara: escena, física, controles, IA, animación
               └─ capa de plataforma (fina, sustituible):
                    · hoy: JS (three.js/Canvas, Web Audio, DOM)
                    · mañana: Ara nativo (Win32 + OpenGL/D3D11, WASAPI)
```

Reglas de la frontera:
- El núcleo en Ara es dueño del estado de simulación.
- La capa de plataforma solo lee ese estado para dibujar y sonar, y le pasa la entrada.
- Si una capacidad sirve a cualquier programa (FFI, `f32`, trigonometría), va a Ara. Si es lógica de juego, va a Falcon.

## Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Auditoría, línea base y esta hoja de ruta | Completado |
| 1 | Fundación:<br>• trigonometría en Ara<br>• `herramientas/compilar-nucleo-ara.mjs`<br>• `src/motor/ara/nucleo.wasm` versionado | Completado |
| 2 | Núcleo en Ara, por bloques, cada uno con las pruebas headless en verde:<br>1. física 2D (en revisión)<br>2. contactos 2D (los pares, en revisión con B3)<br>3. temporizadores, partículas, animación de sprites<br>4. física 3D, controles y CQB<br>5. compilador de Blueprints | En desarrollo |
| 3 | Ara nativo:<br>• FFI con DLL, convención Win64<br>• `f32` y búferes<br>• ventana Win32<br>• triángulo OpenGL<br>• llamadas indirectas | Pendiente |
| 4 | Runtime nativo: el núcleo de la fase 2 corre en un `.exe` y dibuja con la fase 3; escena 2D primero | Pendiente |
| 5 | Lumbre nativo: capacidades documentadas por plataforma | Pendiente |
| 6 | Compatibilidad: matriz real Windows x64, Linux x64, ARM64 y wasm | Pendiente |
| 7 | Seguridad (fuzzing del parser e importadores), benchmarks, ejemplos (`examples/`) | Pendiente |
| 8 | Estabilización y versión | Pendiente |

## Registro de cambios de esta rama

- Logo nuevo:
  - `recursos/logo.png` es la fuente; `herramientas/generar-iconos.js` genera a partir de él `icono.png` e `icono.ico`.
  - Se retira `icono.svg`, que ya no se usaba.
  - La marca vectorial de la interfaz (`src/ui/iconos.js`, `PERFIL`) aún es la antigua: hay que vectorizar el logo nuevo.
- Núcleo en Ara:
  - `src/motor/ara/fisica2d.ara` (física 2D, idéntica bit a bit a `mundo.js`).
  - `herramientas/compilar-nucleo-ara.mjs`.
  - B2 (física 2D), en revisión:
    - `src/motor/nucleo-ara.js` carga `nucleo.wasm` una vez (Electron, juegos exportados, Node).
    - `Mundo.iniciar` lo precarga; `fisica2d` lo usa si está y, si no, sigue en JS.
    - `pruebas/fisica2d-ara.test.js`: 5 escenas, estado idéntico JS/Ara en cada paso, y `nucleo.wasm` al día.
    - 200 personajes (Node, ms/paso): con plataformas, JS 0,26 y Ara 0,29; con mosaicos, JS 0,75 y Ara 0,47.
    - Reutilizar las listas de `choques` en Ara bajó `mover` de 850 a 110 ns.
    - El ~75 % del paso es JS común a las dos rutas (`caja`, matrices). Los 11 cruces por personaje son ~12 %; agruparlos no compensa todavía.
    - Pendiente: `contactos2d` en Ara; no reenviar las celdas de los mosaicos en cada fotograma.
  - B3 (transformaciones, cajas y contactos 2D), en revisión:
    - Ara guarda por nodo (índice = posición en `Mundo.todos()`) su padre, su matriz local y su caja local. Con eso calcula `matrizPadre`, `caja`, `mover` (con `aplicarMovimiento2d`) y los pares de `contactos2d`.
    - `Mundo.sincronizarAra` solo manda los nodos que cambiaron. Compara con lo último que mandó; si el núcleo pasa a otro mundo, lo manda todo. Las celdas se reenvían solo si cambian (`poner`, `quitar` o un objeto `celdas` nuevo).
    - Las sumas son las de la `DOMMatrix` de `pruebas/dom.js`, en el mismo orden. El seno y el coseno de la rotación los calcula Ara (`sen`/`cos`, fdlibm) desde los grados.
    - `pruebas/fisica2d-ara.test.js`, 10 pruebas. Cubren padres anidados con escala y rotación, `Fondo` y áreas, y scripts que entre pasos cambian padres, posiciones, escalas, visibilidad y celdas, crean y eliminan nodos. También dos mundos que se turnan el núcleo. Los pares de `contactos2d` también salen iguales.
    - 200 personajes (Node, ms/paso, JS → Ara):
      - con plataformas, 0,27 → 0,12;
      - con mosaicos, 0,74 → 0,19;
      - con `contactos2d`, 0,63 → 0,34 y 1,15 → 0,45.
    - Riesgo: en Electron la ruta JS usa la `DOMMatrix` nativa de Chromium. En nodos girados (y quizá en el signo de algún cero) puede redondear distinto que Ara. Las pruebas comparan con la de `pruebas/dom.js`. Medido el 21-11-2026, ver «Verificación en Electron».
    - Pendiente:
      - leer los resultados de `mover` y los pares con menos cruces;
      - `contactos2d` es O(n²);
      - ~~pasar la trigonometría a Ara cuando Falcon actualice su compilador~~ (hecho, ver abajo).
- Compilador de Ara al día y trigonometría en el núcleo (21-11-2026):
  - `src/ara/` actualizado desde `motor-ara` de Ara (2ff41f0) con `herramientas/copiar-a-falcon.sh`:
    - `ara_web.wasm`: 1.620.646 → 1.457.050 bytes;
    - `ara_runtime.wasm`: 96.279 → 87.758 bytes. Ahora es el runtime escrito en Ara (`crates/ara_wasm/runtime/`), el que copia el script; antes era el de Rust de `runtime-web.sh`;
    - `ara.mjs` (fotos de memoria y anfitrión de sistema); `compilador.mjs` sin cambios.
  - El runtime va a la par con el compilador: el `nucleo.wasm` anterior con el runtime nuevo da posiciones erróneas. Hay que regenerar `nucleo.wasm` en cada actualización; la prueba «nucleo.wasm está al día» lo detecta.
  - `Fisica2D.nodo` recibe los grados y calcula `cos`/`sen` en Ara. Se quita el `shortcut:` de `mundo.js`.
  - Ara (fdlibm) y `Math.sin`/`Math.cos` de V8 no siempre coinciden en el último bit:
    - en Node 26 difieren en 12 de los 721 grados enteros entre −360 y 360 (por ejemplo, 48°), y en un 2 % de ángulos al azar;
    - V8 tampoco es estable: Electron 44 y Node 26 difieren entre sí en 198 de 2.881 medios grados;
    - `DOMMatrix.rotateSelf` de Chromium difiere de Ara en 2.520 de esos 2.881 (reduce el ángulo y redondea los múltiplos de 90°).
  - Decisión: la ruta de Ara es la del juego y es determinista en todas las plataformas; JS es el respaldo. Las pruebas de `fisica2d-ara.test.js` siguen idénticas (giran 12° y −27,5°, donde coinciden). Con 48° la ruta JS de Node se separa en el paso 9 por 1 ulp (−187,76070527542387 frente a …393).
  - Verificación en Electron 44 (plantillas `plataformas` y `topdown`, `electron . --captura --guion`):
    - (a) el núcleo se carga por `falcon://`: `nucleo` no nulo tras `cargarEscena`, y el jugador anda con teclas de verdad (x 220 → 487,7 en 1,2 s) sin perder el núcleo;
    - (b) tres mundos completos (scripts, Blueprints, física y contactos) con la misma entrada y `Math.random` sembrado, 1.200 pasos:
      - Ara contra JS con la `DOMMatrix` de `pruebas/dom.js`: idénticos en los 1.200 pasos, en las dos plantillas, también con plataformas giradas 48°, 194°, 311°…;
      - Ara contra JS con la `DOMMatrix` nativa: se separan. Sin giros, en el paso 671 de `plataformas` (x 1026,666666666664 frente a …642, con el jugador caído a y ≈ 22.817) y en el 452 de `topdown` (y 71 frente a 70,99999996747634). Con plataformas giradas, en los pasos 88 y 500;
      - causa: la aritmética de la `DOMMatrix` de Chromium (orden de las sumas y su propio seno y coseno), no la ruta de Ara. Para igualar el respaldo habría que cambiar `matrizLocal`/`matrizPadre` por la aritmética de `pruebas/dom.js`. No se ha hecho: el respaldo solo se usa si el núcleo no carga.
    - (c) juego exportado con `exportarJuego` (win32-x64, motor local) y abierto con `FALCON_GUION`: `nucleo` no nulo, `.falcon/ara.wasm` cargado, `ara_web.wasm` da 404 (no lleva el compilador) y el jugador avanza 330 px en 90 pasos sin errores del núcleo. Con el árbol anterior a `be4429d` no arrancaba: faltaban `src/ara/api.js` y `api-motor.js` en `ARCHIVOS_APP` (ventana negra, sin errores en consola); `be4429d` los añadió.
  - `Mundo.iniciar` omite las carpetas que no son del juego (`exportado`, `capturas`, `exportaciones`, `.git`), con el mismo criterio que `OMITIR_PROYECTO` de `exportar.js`. Antes, exportar a `<proyecto>/exportado` (el destino por defecto) metía en el juego los `.ara` de la exportación, y no arrancaba («el tipo `Nodo` ya está definido»). Lo prueba `pruebas/carpetas-omitidas.test.js`, que también exige que las dos listas sigan iguales.
