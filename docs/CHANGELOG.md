# Registro de cambios

Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.
Aquí van los cambios de la rama `motor-ara` respecto a `main` (`66fea90`, Falcon Engine 1.3.0).
- Falcon: `git log main..motor-ara`, 25 commits (más los del cierre).
- Ara: `git log master..motor-ara` en `ara-etapa5/ara`, 12 commits hasta `fced30d`; Ara no tiene rama `main`.

## [Sin publicar]

## [1.4.0] — 2026-11-21

Sale en el canal Pruebas (prerelease de GitHub). Notas para usuarios: `notas/v1.4.0.md`.

### Añadido
- **Windows arm64:** instalador NSIS nativo (`npm run release:win-arm`) con su canal de actualización `latest-arm64.yml`, job `windows-11-arm` en `releases.yml` y exportación de juegos a `win32-arm64`.
- `releases.yml`: entrada `canal` (`pruebas` publica como prerelease; `estable`, como Latest).
- **Núcleo del motor en Ara:**
  - física 2D (`src/motor/ara/fisica2d.ara`), precompilada a `src/motor/ara/nucleo.wasm` con `herramientas/compilar-nucleo-ara.mjs` y cargada por `src/motor/nucleo-ara.js` (`bf37180`, `2e4289b`);
  - transformaciones, cajas y pares de `contactos2d` en Ara, con envío al núcleo solo de lo que cambió (`c1b2b95`);
  - núcleo táctico 3D: rayos contra cajas y A* (`src/motor/ara/espacio3d.ara`, `f53a50a`).
- **Compilador de Blueprints escrito en Ara** (`src/motor/ara-blueprints/`), único desde `1f17541` (`1a00017`).
- **Runtime nativo 2D (fase 4):** `examples/native-2d/`, un `.exe` de Ara con ventana Win32 + OpenGL que corre el nivel «plataformas» con la misma física del núcleo y los mismos scripts y Blueprints que Falcon, igual bit a bit (`fc2b5c7`, `064b90d`). La API del motor para nativo está en `src/motor/nativo/anfitrion2d.ara`.
- Pruebas `fisica2d-ara.test.js` (Ara igual bit a bit que JS), `seguridad.test.js` y `carpetas-omitidas.test.js`.
- `herramientas/medir-fisica2d.mjs`.
- Documentación: `REWRITE_ROADMAP.md`, `TESTING.md`, `BENCHMARKS.md`, `PLATFORM_MATRIX.md`, `SECURITY.md`, `DEPENDENCIES.md` y los documentos de arquitectura y proceso de `docs/`.
- **Ara** (`ara-etapa5/ara`):
  - trigonometría integrada `sen`, `cos`, `tan`, `asen`, `acos`, `atan` y `atan2`, con fdlibm (`2857d96`);
  - FFI nativa `externa "x.dll" func` en Windows x64 (`b016792`);
  - búfer de bytes `ara:memoria` y ejemplo de ventana Win32 con OpenGL (`fc4e549`);
  - fusión en `2ff41f0`;
  - tipos de frontera `f32`, `i32` y `u32` en las `externa` (`0106860`);
  - llamadas indirectas con `ara:indirecta` (`b8e8884`);
  - funciones de Ara para una DLL con `retrollamada(f)` (`98634f6`);
  - ejemplo de cubo con OpenGL moderno (`eb22a34`);
  - fusión en `7e4e99b`;
  - anfitrión escrito en Ara: `externa func` con cuerpo, `Clase(yo)` y `avisar` (`e93ee0e`, fusión en `fced30d`).

### Cambiado
- Versión 1.4.0. Los instaladores llevan la arquitectura explícita: `Falcon-Engine-<versión>-windows-x86_64.exe`, `-windows-arm64.exe`, `-linux-x86_64.AppImage` y `-linux-arm64.AppImage` (antes `win-x64`). Exportar juego muestra x86_64/arm64.
- El actualizador rechaza metadatos de otra arquitectura y toma el tamaño del instalador de su plataforma, no del blockmap.
- Ara al día desde `2ff41f0` (`abc24d9`):
  - `ara_web.wasm` (1.620.646 → 1.457.050 bytes);
  - `ara_runtime.wasm`, ahora el runtime escrito en Ara (96.279 → 87.758 bytes);
  - `ara.mjs`.

  Hay que regenerar `nucleo.wasm` en cada actualización.
- El seno y el coseno de la rotación se calculan en Ara (`abc24d9`).
- `Mundo.iniciar` omite `exportado/`, `capturas/`, `exportaciones/` y `.git` (`6117105`).
- `normalizarNodo` descarta las propiedades de tipo incorrecto al cargar (`5f79601`). Ver `COMPATIBILITY.md`.
- Las CSP del editor, el gestor y el juego quitan `'unsafe-inline'` de `script-src` (`5f79601`).
- El juego usa un preload reducido de solo lectura (`preload-juego.js`) y el IPC queda limitado a las raíces permitidas por ventana (`be4429d`).
- `pruebas/ejecutar.js` sigue con los demás archivos aunque uno no cargue (`86b418e`).
- `node_modules` sale de git; `js-yaml` se declara como devDependency (`6ca1704`).
- Logo nuevo (`recursos/logo.png`, iconos) y silueta del halcón en la interfaz (`db8923f`, `224a608`).
- `sandbox: true` y gestor de permisos en todas las ventanas; Electron 44.9.0 → 44.11.5 (`ee249af`).

### Eliminado
- `recursos/icono.svg`, que ya no se usaba (`db8923f`).
- El compilador de Blueprints en JS (unas 500 líneas de `blueprints.js`): lo sustituye el escrito en Ara (`1f17541`).

### Corregido
- La prueba del instalador (`probar-instalado.cjs`, paso obligatorio de `releases.yml`) fallaba desde `be4429d`: el modo `--captura` no dejaba escribir los resultados fuera del proyecto. Ahora concede escritura a las carpetas de `--captura` y `--guion` (línea de comandos, de confianza) y una página de juego con guion usa el preload completo para guardar evidencias.
- Exportar al destino por defecto (`<proyecto>/exportado`) metía los `.ara` exportados en el juego, y no arrancaba (`6117105`).
- Los juegos exportados no arrancaban porque faltaban `src/ara/api.js` y `api-motor.js` en `ARCHIVOS_APP` (`be4429d`).
- `cargarEscena` descartaba el núcleo de Ara que había precargado `iniciar` (`2e4289b`).
- Ara nativo: `nativo.ara` pisaba r10/r11 en las llamadas y `acos` daba mal resultado en x64 (`9ca603f`).
- Plantilla «plataformas»: el enemigo empezaba dentro del suelo y caía al hueco, y vibraba contra la roca (`eda6a59`).

### Seguridad
- C1: XSS persistente con datos del proyecto (valores sin `esc()`) (`5f79601`).
- A2: path traversal en `falcon://app` (`5f79601`).
- A1: IPC con acceso a todo el disco; `falcon://fs` (`be4429d`).
- M1: ventanas sin sandbox y permisos concedidos sin preguntar (`ee249af`).
- M4: Electron con un aviso de gravedad alta (GHSA-jr5w-w6x2-84p9) (`ee249af`).
- Siguen abiertos M3 (actualizaciones sin firma) y los hallazgos B: ver `SECURITY.md`.
