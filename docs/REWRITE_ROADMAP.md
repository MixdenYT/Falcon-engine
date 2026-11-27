# Falcon Engine — Powered by Ara: hoja de ruta

Estado: **arquitectura aprobada por el usuario el 21-11-2026**. Esta hoja conserva la auditoría histórica de esa fecha; las actualizaciones de GitHub se registran debajo.
Rama de trabajo actual: `codex/fisica3d-ara` en `MixdenYT/Falcon-engine`. Los cambios están aislados en una rama y no modifican `main`.


## Actualización de trabajo en GitHub — 27-11-2026

Esta sección prevalece sobre el estado de «solo commits locales» y el informe de continuidad del 21-11.

- Rama: `codex/fisica3d-ara` (Falcon Engine); `main` no se ha modificado.
- `src/motor/ara/fisica3d.ara`: el `Solucionador3D` resuelve en Ara el movimiento X/Z de personajes, escalones, impulsos, gravedad, suelo/pared/techo, contactos y la dinámica vertical y horizontal de cuerpos empujables.
- `src/motor/ara/camara3d.ara`: nuevo `ControlCamara3D` en Ara. Calcula la órbita con ratón/stick, zona muerta analógica, límites de inclinación por perspectiva, seguimiento exponencial del pivote, retorno de yaw detrás del movimiento y suavizado de distancia tras la consulta de obstáculos.
- `src/motor/ara/nucleo.ara` y `src/motor/nucleo-ara.js`: exponen el estado matemático de cámara al adaptador.
- `src/motor/control3d.js`: delega esos cálculos a Ara y aplica los resultados a Three.js. Conserva respaldo JS si el núcleo no está disponible y sincroniza el estado al cambiar entre primera y tercera persona.
- `pruebas/camara3d-ara.test.js`: verifica órbita, sensibilidad/inversión, zona muerta, límites de pitch, seguimiento de pivote, auto-yaw y suavizado de distancia.
- Los empujes se validan en Ara contra todas las AABB del paso. Si hay espacio, Ara desplaza el cuerpo y registra el movimiento; si no, bloquea el empuje. Las AABB móviles se sincronizan después de cada movimiento para que los siguientes personajes y cuerpos vean el estado actualizado.
- `src/motor/ara/nucleo.ara` y `src/motor/nucleo-ara.js`: exponen las operaciones de movimiento, empuje, apoyo y sincronización de AABB.
- `src/motor/mundo3d.js`: entrega las AABB estáticas y móviles a Ara y aplica al grafo de escena los desplazamientos devueltos. El camino JS de física queda como recuperación si Ara falla; ya no se desvía a JS solo porque haya un cuerpo empujable cerca.
- `pruebas/fisica3d-ara.test.js`: 500 escenarios deterministas de AABB comparados con la referencia JS, más pruebas de caída, apoyo, empuje libre, empuje bloqueado, contactos e integración de `Mundo3D`.
- CI de la PR: compilación y comprobación de `nucleo.wasm`, `npm test`, `npm run test:actualizaciones` y validación de configuración de paquetes superadas en la ejecución del 27-11-2026. La regeneración del WebAssembly se mantiene automatizada.
 
**Límites todavía explícitos:** Three.js sigue calculando las transformaciones de escena y las AABB, y el runtime JS aplica los desplazamientos al grafo de nodos. La cámara solo ha migrado la órbita, el seguimiento y el suavizado; quedan la resolución geométrica de obstrucciones, la colocación final, el balanceo/efectos de primera persona y la integración del renderizador. Por tanto, ni la cámara completa ni la física/renderizado 3D están todavía íntegramente en Ara.

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
Electron 44 + three.js 0.186; unas 22.900 líneas de JS en `src/`. `npm test` (headless): 79 de 79 más las suites propias, con código de salida 0. La línea base inicial, «50 de 50», era falsa: el runner se cortaba en `release.test.js` y no ejecutaba 7 pruebas (corregido en `86b418e` y `6ca1704`).

| Sistema | Dónde | Líneas | Estado real | Ara hoy |
|---|---|---|---|---|
| Escena, nodos y eventos | `motor/mundo.js`, `tipos.js` | 1.700 | Funciona | No |
| Física 2D | `mundo.js` (`fisica2d`, `contactos2d`) | 160 | Funciona | **En revisión** (B3): `fisica2d`, cajas, matrices de mundo y pares de `contactos2d` en Ara (`motor/ara/fisica2d.ara`), idénticos bit a bit; JS de respaldo. Ara es 1,8–4× más rápido (`docs/BENCHMARKS.md`) |
| Física 3D (cajas), controles, CQB | `mundo3d.js`, `control3d.js`, `tactico3d.js` | 1.075 | Funciona; núcleo parcialmente Ara | Rayos y A* ya estaban en Ara (B4). Nueva rama `codex/fisica3d-ara`: movimiento de personajes, colisiones AABB estáticas y de cuerpos, escalones, gravedad, suelo/pared/techo y contactos resueltos en `fisica3d.ara`. Three.js sigue aportando AABB y escena. Las cajas estáticas se cargan una vez por lista y se reutilizan entre personajes; las cajas de otros personajes se añaden por personaje. Respaldo JS solo cuando un cuerpo empujable intersecta el volumen barrido del personaje; los cuerpos lejanos no desactivan Ara. Cámara y física de objetos empujables siguen pendientes |
| Render 2D | `render2d.js` (Canvas2D) | 400 | Funciona | No |
| Render 3D y Lumbre | `lumbre*.js`, `escena3d.js`, `materiales.js` | 2.500 | Funciona: WebGL2, sondas, GTAO, bloom | No |
| Audio | `audio.js` (Web Audio) | 124 | Funciona | No |
| Entrada | `entrada.js` (DOM) | 78 | Funciona | No |
| Blueprints | `blueprints.js` y `cqb-blueprints.js` | 790 | Compilan a Ara de verdad (lo prueban los tests) | **En revisión** (bloque 5): el compilador del grafo también está en Ara (`motor/ara-blueprints/blueprints.ara`, cargado por `motor/blueprints-ara.js`) y es el único: lo usan el editor (errores en vivo, guardar), las plantillas, el juego y la exportación. El de JS se retiró (−500 líneas de `blueprints.js`); queda solo el catálogo `NODOS`, que se aplana a Ara. Da la referencia que generó el de JS antes de retirarlo (`pruebas/blueprints-esperado.json`): los 76 Blueprints que existen, 16 casos límite y 608 variaciones con errores (`pruebas/blueprints-ara.test.js`). Sin respaldo: si `blueprints.wasm` no carga, error claro. Es 1,6–1,7× más lento que el de JS: la mitad es la frontera (`docs/BENCHMARKS.md`) |
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
| FFI nativa (`externa "x.dll" func`) | **Existe en Windows x64** (`b016792`): ABI Win64 e IAT generada. Tipos de frontera `f32`/`i32`/`u32` (`0106860`), llamadas indirectas `ara:indirecta` (`b8e8884`) y `retrollamada(f)` (`98634f6`). No existe en Linux ni en ARM64. Ver `docs/NATIVO.md` de Ara |
| Ventanas, GPU | Por FFI: ventana Win32 con `WndProc` en Ara y OpenGL 4.6 con shaders (`ejemplos/ventana_cubo.ara`). No hay biblioteca propia. Audio e imágenes no existen |
| Búferes de bytes | `ara:memoria` + `ejemplos/nativo/bufer.ara` (u8, u16, i32, i64, f32, con límites comprobados) |
| Estructuras por valor | No existen |
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

## Arquitectura (aprobada el 21-11-2026)

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
| 2 | Núcleo en Ara, por bloques, cada uno con las pruebas headless en verde:<br>1. física 2D — completado (B2/B3, revisado)<br>2. contactos 2D — completado (pares en Ara)<br>3. temporizadores, partículas, animación de sprites — pendiente<br>4. física 3D, controles y CQB — rayos/A* (B4) y solucionador de movimiento/colisiones de personajes en Ara; cámara y física de objetos empujables pendientes<br>5. compilador de Blueprints — completado (en Ara, único; el de JS retirado) | En desarrollo |
| 3 | Ara nativo (Windows x64):<br>• FFI con DLL, convención Win64<br>• `f32` y búferes<br>• ventana Win32<br>• triángulo y cubo OpenGL<br>• llamadas indirectas y retrollamadas<br>• anfitrión escrito en Ara (`externa func` con cuerpo, `Clase(yo)`, `avisar`) | Completado (Ara `fced30d`) |
| 4 | Runtime nativo: el núcleo de la fase 2 corre en un `.exe` y dibuja con la fase 3; escena 2D primero | En desarrollo: el nivel «plataformas» con sus scripts y Blueprints corre en un `.exe`, igual bit a bit que Falcon (`fc2b5c7`, `064b90d`, `eda6a59`). Falta: resto de la API, Inspector y Señales, sprites, texto, audio, cargar escenas |
| 5 | Lumbre nativo: capacidades documentadas por plataforma | Pendiente |
| 6 | Compatibilidad: matriz real Windows x64, Linux x64, ARM64 y wasm | Pendiente |
| 7 | Seguridad (fuzzing del parser e importadores), benchmarks, ejemplos (`examples/`) | Pendiente |
| 8 | Estabilización y versión | Pendiente |

## Informe de continuidad (cierre del 21-11-2026)

**Estado verificado al cerrar:** Falcon `npm test` 91/91 con salida 0; Ara batería completa 233/233 en 29 grupos (`fced30d`). Todo en commits locales en `motor-ara` de los dos repos; **nada subido a GitHub**.

**Siguientes pasos, por orden:**
1. Núcleo 2D restante en Ara: temporizadores, partículas y animación de sprites (`mundo.js`), con el mismo patrón y pruebas JS↔Ara.
2. Fase 4: completar la API nativa del motor (`crear`, `grupo`, `llamar`, Inspector, Señales), sprites y texto con texturas OpenGL, y cargar `.fscn` sin recompilar (lector JSON en Ara, reutilizable).
3. Física de cajas 3D de `mundo3d` y cámara de `control3d` en Ara (B4 pendiente).
4. Ara: cruzar listas/búferes entre wasm y JS sin un texto por campo (lo pide el compilador de Blueprints, hoy 1,6× más lento que el JS que sustituyó).
5. Fase 6: probar Linux x64 / ARM64 de verdad (hoy solo Windows ARM64 y x64 emulado; ver `PLATFORM_MATRIX.md`).
6. Fase 7: `examples/` restantes, fuzzing del parser e importadores, repetir benchmarks con el equipo en reposo.

**Decisiones que esperan al usuario:**
- M3: firmar las actualizaciones (necesita un certificado de firma de código).
- Subir las ramas `motor-ara` a GitHub y abrir PR cuando se quiera publicar.
- Volver a exportar los juegos hechos antes de `ee249af` (llevan Electron 44.9.0).

**Avisos:**
- Los cambios del usuario sin commit en `src/motor/lumbre.js` (con `console.log` de depuración) y `src/editor/visores/visor3d.js` (en la línea 358, `n.id` sin `esc()`) no se han tocado.
- El compilador de Ara que lleva Falcon (`src/ara/`) es el de Ara `2ff41f0`; el `.exe` nativo usa el de `fced30d` directamente. Al actualizar el Ara de Falcon (`copiar-a-falcon.sh`), regenerar `nucleo.wasm` y `blueprints.wasm`; las pruebas «al día» lo detectan.

## Registro de cambios de esta rama

- Logo nuevo:
  - `recursos/logo.png` es la fuente; `herramientas/generar-iconos.js` genera a partir de él `icono.png` e `icono.ico`.
  - Se retira `icono.svg`, que ya no se usaba.
  - La marca vectorial de la interfaz (`src/ui/iconos.js`, `PERFIL`) se traza desde el logo con `herramientas/trazar-logo.js` (`224a608`).
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
- Fase 4, primer corte: un juego 2D nativo (`examples/native-2d`):
  - **Física compartida.** `src/motor/ara/fisica2d.ara` deja de ser una clase de script. Ahora es un módulo: la `estructura Fisica` con sus métodos y tres funciones sueltas. Así compila también a nativo.
    - `src/motor/ara/nucleo.ara` tiene `externa tipo Nucleo` y la clase `Fisica2D`: una envoltura fina que llama a `Fisica` y deja los resultados como números.
    - Las exportaciones a JS no cambian (`Fisica2D.func.*`), así que `nucleo-ara.js` sigue igual.
    - `fisica2d-ara.test.js` sigue 10/10.
    - `nucleo.wasm` baja de 141.148 a 106.753 bytes: los 80 campos de la clase ya no se exportan a JS (`Fisica2D.leer.*` y `Fisica2D.poner.*`).
    - Coste por paso (`herramientas/medir-fisica2d.mjs`, Ara, ms, antes → después; ruido de ±5 %):
      - plataformas, 0,121 → 0,112;
      - con contactos, 0,316 → 0,305;
      - celdas, 0,126 → 0,123;
      - celdas con contactos, 0,370 → 0,364.
  - **El `.exe`** (`examples/native-2d/juego.ara`):
    - ventana Win32 con `WndProc` en Ara (`retrollamada`) y OpenGL 1.1 (rectángulos de color);
    - teclado con `GetAsyncKeyState`;
    - paso fijo de 1/60 s con `QueryPerformanceCounter`;
    - importa `fisica2d.ara` del motor. Lo compila `herramientas/escena-nativa-2d.mjs`.
  - **La escena** es el nivel de la plantilla «plataformas»: `nivelPlataformas()`, que ahora exporta `plantillas.js`.
    - Llega al `.exe` como un módulo de Ara generado: las llamadas que `Mundo.sincronizarAra` haría al núcleo, grabadas tal cual.
    - `shortcut:` Ara no tiene JSON. Hay que pasar a leer el `.fscn` cuando lo tenga o cuando haga falta cargar escenas sin recompilar.
  - **Prueba** `pruebas/nativo-2d.test.js`:
    - 900 pasos de guion, comparados en cada paso, bit a bit, con la ruta wasm de Falcon. Compara posiciones, `vy`, empujes, suelo y nodo de suelo de los 2 personajes, y los pares de `contactos2d`;
    - el guion pisa mosaicos y plataformas, choca con paredes y toca monedas;
    - se salta, con aviso, sin Windows o sin el compilador de Ara (`ARA_DIR` / `ARA`).
    - `npm test`: 86/86, salida 0.
  - **Captura:** `docs/img/nativo-2d.png` (`glReadPixels` con `FALCON_CAPTURA`).
  - **Cifras** en este equipo (Snapdragon X Plus; el `.exe` es x64 emulado con Prism, Node es arm64 nativo):
    - paso completo del nivel (2 personajes, 64 nodos, contactos): `.exe` 0,0042 ms; Falcon con el núcleo wasm 0,0124 ms; Falcon con JS 0,044 ms. La ruta de Falcon incluye `sincronizarAra` y el reparto en JS;
    - la ventana va a 58,7 fps con sincronía vertical.
  - **Pendiente:**
    - sprites, texturas y texto;
    - audio;
    - ~~scripts y Blueprints en nativo~~: hecho en el segundo corte (abajo);
    - plataformas móviles (arrastre);
    - leer escenas sin recompilar;
    - Linux y ARM64 nativos (no hay FFI de Ara para ellos).
- Fase 4, segundo corte: scripts y Blueprints en el `.exe` nativo, con el mismo código de juego que en Falcon.
  - **Ara** (`motor-ara`, `fced30d`; `docs/NATIVO.md`, «Un anfitrión escrito en Ara»). Son mejoras generales para cualquier programa con un anfitrión escrito en Ara:
    - `externa func f(...):` con cuerpo implementa una externa ya declarada (métodos, propiedades con lectura y escritura, y `esperar`), y no se importa;
    - `entero(nodo)` y `Nodo(n)` pasan entre un objeto del anfitrión y su manejador;
    - `Clase(yo)` crea un objeto de una clase de script, y `avisar(objeto, "evento", ...)` ejecuta sus `cuando`;
    - en `nativo`, un error en una función que llama una DLL acaba el programa con su mensaje, también desde una fibra;
    - los dos compiladores (Rust y Ara) sacan el mismo árbol, HIR, errores y wasm;
    - batería: 233/233, con los puntos fijos.
  - **Falcon:**
    - `src/motor/nativo/anfitrion2d.ara`: el anfitrión. Tiene la tabla de nodos, la API que usa el nivel sobre `fisica2d.ara`, el paso en el orden de `Mundo.paso` y `ProgramaAra`, y `esperar` con fibras de Windows;
    - `herramientas/escena-nativa-2d.mjs` genera la escena: los nodos, y el reparto de eventos a las clases de cada nodo;
    - `juego.ara` ya no repite el Blueprint: carga la escena, pone la entrada y llama al paso.
  - **Prueba** `pruebas/nativo-2d.test.js`. Falcon (wasm, con los Blueprints y scripts reales) y el `.exe`, bit a bit en cada paso: personajes, pares que se tocan, puntos, estado y nodos.
    - Guion de 1000 pasos: recoge monedas, muere en los pinchos (empujón, `esperar(0.4)` y reinicio) y gana en la meta en el paso 928 con 4 puntos.
    - Segundo caso: el enemigo patrullando, 300 pasos.
    - Lo que se vio al probar: en la plantilla, la caja del enemigo entra 4 px en el suelo, y el primer paso lo empuja al hueco de las columnas 44-45. Pasa igual en Falcon (con el núcleo y con JS) y en el `.exe`. La prueba lo apoya en el suelo para ver la patrulla. Corregido en la revisión cruzada: el enemigo empieza en y = 572 y su script se gira antes de moverse (antes vibraba contra la roca). El guion de la prueba ahora le cae encima.
  - **Cifras** (este equipo, `.exe` x64 emulado): paso del nivel con scripts, `.exe` 0,017 ms y Falcon (wasm + JS) 0,060 ms.
  - **Captura:** `docs/img/nativo-2d.png` (paso 560 del guion de la prueba).
  - `npm test`: 91/91, salida 0.
  - **Pendiente:**
    - el resto de `motor.ara`: 3D, `crear`, `grupo`, `llamar` y `leer_*`;
    - los valores del Inspector y las Señales;
    - audio y temblor de cámara (hoy no hacen nada);
    - un error de script cierra el `.exe`; en Falcon desactiva ese `cuando` y el juego sigue.
