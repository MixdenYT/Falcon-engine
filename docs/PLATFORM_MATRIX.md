# Matriz de plataformas

Estado del 21-11-2026, rama `motor-ara` (`db8923f`).

**Qué se puede comprobar en este equipo:**
- Windows 11 ARM64 (Snapdragon X Plus): binarios ARM64 nativos y x64 emulados con Prism.
- WebAssembly en Node v26.13.1 arm64.

No hay WSL ni máquinas Linux. Todo lo demás está marcado como **pendiente de verificación**. Lo que solo dice la configuración o la documentación no cuenta como prueba.

Leyenda:
- **Verificado aquí**: ejecutado en este equipo en esta fecha.
- **Configurado**: el código o la configuración lo generan, pero no se ha ejecutado aquí.
- **Pendiente de verificación**: no se ha probado.
- **No soportado**: no existe en el código.

## Falcon Engine (Electron 44.9.0)

### Qué genera cada herramienta

| Herramienta | Windows x64 | Linux x64 | Windows ARM64 | Linux ARM64 | Web/wasm |
|---|---|---|---|---|---|
| `electron-builder.config.cjs` (`npm run release:*`) | NSIS x64 (`release:win`) | AppImage x64 (`release:linux`) | No soportado (`win.target` solo `x64`) | AppImage arm64 (`release:linux-arm`) | No soportado |
| `herramientas/construir.js` (`npm run build:*`) | Carpeta con `Falcon Engine.exe` (`build:win`) | `.tar.gz` (`build:linux`) | Sin script. `@electron/packager` aceptaría `win32 arm64` a mano: pendiente de verificación. | `.tar.gz` (`build:linux-arm`) | No soportado |
| `src/principal/exportar.js` (juegos exportados, `PLATAFORMAS`) | `win32-x64` | `linux-x64` | No soportado (no está en `PLATAFORMAS`) | `linux-arm64` | No soportado (no hay exportación web) |
| CI `releases.yml` (`probar-instalado.cjs`, Electron real) | `windows-latest` | `ubuntu-24.04` | — | `ubuntu-24.04-arm` | — |

### Estado real

| Plataforma | Estado | Pruebas |
|---|---|---|
| Windows x64 | **Parcial:** el binario corre emulado. | `node_modules/electron/dist/electron.exe` es PE x86-64 y arranca en modo Node bajo Prism: `ELECTRON_RUN_AS_NODE=1` da `44.9.0 x64 node v24.22.0`. **No** se ha abierto el editor ni un juego exportado en esta sesión. NSIS e instalador: pendiente de verificación. Hay un job de CI configurado, pero aquí no se ha visto ninguna ejecución. |
| Linux x64 | Pendiente de verificación | Solo configurado (AppImage, `.tar.gz`, exportación `linux-x64`, CI `ubuntu-24.04`). |
| Windows ARM64 | **No soportado de forma nativa.** Funciona en x64 emulado, sin abrir la GUI (ver Windows x64). | No hay objetivo ARM64 en electron-builder ni en `exportar.js`. Un juego exportado desde este equipo para «Windows x64» usa el Electron local, porque coinciden `platform` y `arch` del proceso x64 emulado. |
| Linux ARM64 | Pendiente de verificación | Solo configurado (AppImage arm64, `.tar.gz`, exportación `linux-arm64`, CI `ubuntu-24.04-arm`). |
| WebAssembly (scripts de Ara del juego) | **Verificado aquí en Node arm64**: las 50 pruebas de `node:test` (`npm test`) compilan y ejecutan Ara→wasm, también `esperar` con JSPI. | En el proceso de render de Electron 44, y con la CSP que exige `ara.test.js`: pendiente de verificación en esta sesión. |
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
| FFI nativa (`externa` en ejecutables) | No soportado: rechazada en `nativo.ara`; solo hay imports fijos de KERNEL32 | No soportado | No soportado | No soportado | `externa` contra JS: funciona en Falcon |
| Ventanas, GPU, audio | No soportado | No soportado | No soportado | No soportado | Mediante el motor JS de Falcon |

**Notas:**
- En esta sesión no se ha ejecutado `cargo test` ni `bench/contra-rust.sh`, porque otro agente estaba usando la batería de Ara.
- Lo marcado «mide» viene de `ara-etapa5/ara/bench/README.md`, con su fecha, y no se ha repetido aquí.
- La reproducción está descrita en `TESTING.md`.

## Qué falta para cerrar la matriz (fase 6)

1. Abrir el editor y un juego exportado en este equipo (x64 emulado): plantillas 2D y 3D, audio, entrada.
2. Ejecutar `releases.yml` completo (`solo_windows: false`) y guardar las evidencias de `probar-instalado.cjs` para Windows x64, Linux x64 y Linux ARM64.
3. Decidir si se añade un objetivo Windows ARM64 nativo: `win.target` arch `arm64`, `PLATAFORMAS['win32-arm64']` y `build:win-arm`. Electron suele publicar `win32-arm64`; no se ha comprobado para la 44.9.0.
4. Ara:
   - instalar clang para ARM64 y compilar `ara` de forma nativa;
   - pasar `cargo test` en Linux x64;
   - backend ELF para ARM64.
