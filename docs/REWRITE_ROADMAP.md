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
| Física 2D | `mundo.js` (`fisica2d`, `contactos2d`) | 160 | Funciona | **En desarrollo**: `motor/ara/fisica2d.ara` |
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
| Trigonometría | No existe como integrada. **En desarrollo** (`sen`, `cos`, `tan`, `atan2`, de fdlibm); trabajo interrumpido, sin commit |
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
| 1 | Fundación:<br>• trigonometría en Ara<br>• `herramientas/compilar-nucleo-ara.mjs`<br>• `src/motor/ara/nucleo.wasm` versionado | En desarrollo |
| 2 | Núcleo en Ara, por bloques, cada uno con las pruebas headless en verde:<br>1. física 2D (en desarrollo)<br>2. contactos 2D<br>3. temporizadores, partículas, animación de sprites<br>4. física 3D, controles y CQB<br>5. compilador de Blueprints | En desarrollo |
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
  - Aún sin conectar a `mundo.js` y sin probar.
