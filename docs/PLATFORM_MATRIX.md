# Matriz de plataformas

Estado del 21-11-2026, rama `motor-ara` (`db8923f`; Electron y lo verificado en Electron, `ee249af`).

**Qué se puede comprobar en este equipo:**
- Windows 11 ARM64 (Snapdragon X Plus): binarios ARM64 nativos y x64 emulados con Prism.
- WebAssembly en Node v26.13.1 arm64.

No hay WSL ni máquinas Linux. Todo lo demás está marcado como **pendiente de verificación**. Lo que solo dice la configuración o la documentación no cuenta como prueba.

Leyenda:
- **Verificado aquí**: ejecutado en este equipo en esta fecha.
- **Configurado**: el código o la configuración lo generan, pero no se ha ejecutado aquí.
- **Pendiente de verificación**: no se ha probado.
- **No soportado**: no existe en el código.

## Falcon Engine (Electron 44.11.5)

### Qué genera cada herramienta

Release 1.4.0 (canal Pruebas). Cada archivo lleva la arquitectura:

| Plataforma | Instalador | Metadatos de actualización |
|---|---|---|
| Windows x86_64 | `Falcon-Engine-1.4.0-windows-x86_64.exe` | `latest.yml` |
| Windows arm64 | `Falcon-Engine-1.4.0-windows-arm64.exe` | `latest-arm64.yml` (canal propio; ver `ACTUALIZACIONES.md`) |
| Linux x86_64 | `Falcon-Engine-1.4.0-linux-x86_64.AppImage` | `latest-linux.yml` |
| Linux arm64 | `Falcon-Engine-1.4.0-linux-arm64.AppImage` | `latest-linux-arm64.yml` |

| Herramienta | Windows x64 | Linux x64 | Windows ARM64 | Linux ARM64 | Web/wasm |
|---|---|---|---|---|---|
| `electron-builder.config.cjs` (`npm run release:*`) | NSIS x86_64 (`release:win`) | AppImage x86_64 (`release:linux`) | NSIS arm64 (`release:win-arm`) | AppImage arm64 (`release:linux-arm`) | No soportado |
| `herramientas/construir.js` (`npm run build:*`) | Carpeta con `Falcon Engine.exe` (`build:win`) | `.tar.gz` (`build:linux`) | Sin script. `@electron/packager` aceptaría `win32 arm64` a mano: pendiente de verificación. | `.tar.gz` (`build:linux-arm`) | No soportado |
| `src/principal/exportar.js` (juegos exportados, `PLATAFORMAS`) | `win32-x64` («Windows x86_64») | `linux-x64` («Linux x86_64») | `win32-arm64` («Windows arm64») | `linux-arm64` («Linux arm64») | No soportado (no hay exportación web) |
| CI `releases.yml` (`probar-instalado.cjs`, Electron real) | `windows-latest` | `ubuntu-24.04` | `windows-11-arm` | `ubuntu-24.04-arm` | — |

### Estado real

| Plataforma | Estado | Pruebas |
|---|---|---|
| Windows x64 | **Juego exportado verificado aquí (x64 emulado).** NSIS 1.4.0 compilado aquí (`release:win`): nombre, `latest.yml`, tamaño y SHA-512 comprobados. Instalación y editor: pendiente de verificación en x64. | `ee249af`: el editor (Electron arm64, ver Windows ARM64) exportó «Plataformas» a `win32-x64` descargando con `@electron/get` el runtime x64 44.11.5. El `Plat.exe` es PE x86-64, corre bajo Prism con `sandbox: true` y el preload reducido, carga la escena con el núcleo de Ara y sin errores, y niega cámara, micrófono, ubicación y avisos. NSIS: hay un job de CI configurado, pero aquí no se ha visto ninguna ejecución. |
| Linux x64 | Pendiente de verificación | Solo configurado (AppImage, `.tar.gz`, exportación `linux-x64`, CI `ubuntu-24.04`). |
| Windows ARM64 | **Instalador NSIS arm64 1.4.0 verificado aquí** (`release:win-arm`): `Falcon Engine.exe` es PE ARM64 (`0xAA64`); `probar-instalado.cjs` lo instala con `/S` y crea, abre en el editor y juega las 11 plantillas, y la CQB hasta la victoria con reapertura. Juego exportado `win32-arm64` («Plataformas», PE ARM64) arranca y se juega. | `npm install` en este equipo (Node arm64) instala Electron 44.11.5 **arm64**, y con él se verificó (modo `--captura` con guiones, `sandbox: true`): el gestor crea las plantillas «Plataformas», «Shooter · CQB» y «Pruebas de iluminación»; el editor edita, guarda y exporta; «Probar» juega la 2D a 60 fps y la CQB a 60 fps (WebGL 2); «Pruebas de iluminación» en calidad alta usa Lumbre (3376 sondas, 4 espejos) a unos 35 fps. Desde 1.4.0 hay objetivo ARM64 en electron-builder y en `exportar.js`. |
| Linux ARM64 | Pendiente de verificación | Solo configurado (AppImage arm64, `.tar.gz`, exportación `linux-arm64`, CI `ubuntu-24.04-arm`). |
| WebAssembly (scripts de Ara del juego) | **Verificado aquí en Node arm64**: las pruebas de `node:test` (`npm test`: 79/79 con salida 0 el 21-11-2026; 85/85 tras `ee249af` y el trabajo en curso de otros agentes) compilan y ejecutan Ara→wasm, también `esperar` con JSPI. | **Verificado en el renderer de Electron 44.11.5** (arm64, con sandbox y la CSP de `ara.test.js`): los scripts de Ara de «Plataformas» y «CQB» corren en la prueba del juego y en el `.exe` exportado (x64). |
| Motor headless (lógica, Blueprints, CQB) | **Verificado aquí en Node arm64 nativo** (`npm test`; ver `TESTING.md`) | No incluye render, audio, entrada ni DOM. |
| macOS, navegador web, móvil | No soportado | No hay objetivos. |

## Ara (`ara-etapa5/ara`, v0.3.0)

### Backends

| Backend | Windows x64 | Linux x64 | Windows ARM64 | Linux ARM64 | WebAssembly |
|---|---|---|---|---|---|
| JIT Cranelift (`ara` en Rust) | Se compila con `--target x86_64-pc-windows-msvc`. `target/x86_64-pc-windows-msvc/release/ara.exe` existe y corre emulado. | Pendiente de verificación aquí. La documentación lo mide en Linux x86-64 (17-11-2026, otra máquina). | **No compila de forma nativa en este equipo:** `ring` necesita clang para ARM64. Corre el binario x64 emulado. | Pendiente de verificación | — |
| `compilador/nativo.ara` (x86-64 propio, sin enlazador) | Genera PE. `bench/README.md` lo mide en este equipo con Prism (19-11-2026). Prueba `el_codigo_maquina_propio_hace_lo_mismo_que_webassembly` (`cfg(windows)`). | Genera ELF con `herramientas/sistema_linux_x64.s`. La misma prueba existe con `cfg(linux, x86_64)`. Pendiente de verificación aquí. | Corre emulado (x64) | No soportado | — |
| `compilador/arm64.ara` (ARM64 propio) | — | — | Genera PE ARM64 (`herramientas/sistema_windows_arm64.asm`). `bench/README.md` lo mide nativo en este equipo (19-11-2026). Prueba `el_codigo_arm64_hace_lo_mismo_que_webassembly` (`cfg(windows)`). | **No soportado:** no hay ELF ARM64 ni capa de sistema Linux ARM64. | — |
| `ara wasm` y `compilador/wasm.ara` | — | — | — | — | Funciona y es lo que usa Falcon. **Verificado aquí** en Node arm64 a través de `npm test` (`src/ara/ara_web.wasm`, `ara_runtime.wasm`). |
| FFI nativa (`externa` en ejecutables) | **Funciona** en el backend `nativo` (PE de Windows x64): `externa "x.dll" func` llama a funciones de DLL (Ara `b016792`), con los tipos de frontera `f32`, `i32` y `u32` (`0106860`), llamadas indirectas (`b8e8884`) y retrollamadas a funciones de Ara (`98634f6`). Ver `ara-etapa5/ara/docs/NATIVO.md`. No se ha repetido aquí | No soportado | Corre emulado (x64) con el mismo binario; no hay FFI en el backend ARM64 propio | No soportado | `externa` contra JS: funciona en Falcon |
| Ventanas, GPU, audio | No soportado | No soportado | No soportado | No soportado | Mediante el motor JS de Falcon |

**Notas:**
- En esta sesión no se ha ejecutado `cargo test` ni `bench/contra-rust.sh`, porque otro agente estaba usando la batería de Ara.
- Lo marcado «mide» viene de `ara-etapa5/ara/bench/README.md`, con su fecha, y no se ha repetido aquí.
- La reproducción está descrita en `TESTING.md`.

## Qué falta para cerrar la matriz (fase 6)

1. ~~Abrir el editor y un juego exportado en este equipo: plantillas 2D y 3D.~~ Hecho en `ee249af` (editor arm64, juego exportado x64). Quedan el audio y la entrada real (teclado, ratón y mando con una persona delante).
2. Ejecutar `releases.yml` completo (`solo_windows: false`) y guardar las evidencias de `probar-instalado.cjs` para Windows x86_64, Linux x86_64 y Linux arm64 (Windows arm64 ya pasa aquí).
3. ~~Objetivo Windows ARM64 nativo.~~ Hecho en 1.4.0 (`release:win-arm`, `latest-arm64.yml`, `PLATAFORMAS['win32-arm64']`). No hay `build:win-arm` (paquete portátil): no hace falta para la release. Falta ver el job `windows-11-arm` en CI.
4. Ara:
   - instalar clang para ARM64 y compilar `ara` de forma nativa;
   - pasar `cargo test` en Linux x64;
   - backend ELF para ARM64.
