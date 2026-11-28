# Dependencias de Falcon engine

Estado a 21-11-2026 (Falcon Engine 1.3.0, actualizado en `ee249af`). Fuentes: `package.json`, `package-lock.json` (lockfileVersion de npm 11.20.0) y un grep de los imports en `src/`, `herramientas/` y `electron-builder.config.cjs`.

## De ejecución (`dependencies`)

| Paquete | Rango / instalada (lock) | Para qué | Dónde se usa |
|---|---|---|---|
| `three` | ^0.186.1 | Render 3D, cargador GLTF, utilidades de geometría | Import map de `src/editor/editor.html`, `src/gestor/gestor.html` y `src/juego/juego.html`. Unos 18 módulos de `src/motor` y `src/editor`, por ejemplo `motor/escena3d.js` (GLTFLoader), `editor/visores/visor3d.js` y `juego/juego.js`. Se copia en los juegos exportados (`principal/exportar.js:25-28`) |
| `three-mesh-bvh` | 0.9.7 (fija) | Aceleración de raycast y colisiones contra mallas | Import map de las tres páginas HTML. `exportar.js:29`, `herramientas/verificar-paquete.cjs` |
| `three-bvh-csg` | 0.0.18 (fija) | Operaciones booleanas para abrir huecos (puertas y ventanas) | `src/motor/huecos.js`, `exportar.js:29`, `herramientas/verificar-paquete.cjs` |
| `@fontsource/manrope`, `@fontsource/jetbrains-mono` | ^5.3.0 | Fuentes de la interfaz y del código | `src/ui/base.css`. Se copian en los juegos exportados (`exportar.js:217-221`) |
| `electron-updater` | ^6.8.9 (lock 6.8.9) | Auto-actualización NSIS y AppImage desde las releases de GitHub | `src/principal/actualizaciones.js:23` |
| `semver` | ^7.8.5 | Comparar versiones y canales de release | `src/principal/notas-release.js` |
| `@electron/get` | ^5.1.0 (lock 5.1.0) | Descargar el runtime de Electron de otra plataforma al exportar (valida contra SHASUMS256) | `src/principal/exportar.js:105` |
| `yauzl` | ^2.10.0 (lock 2.10.0) | Descomprimir ese zip de Electron | `src/principal/exportar.js:121` |

## De desarrollo (`devDependencies`)

| Paquete | Rango / instalada | Para qué | Dónde se usa |
|---|---|---|---|
| `electron` | ^44.11.5 (instalada 44.11.5; antes 44.9.0) | **Runtime de la app**: electron-builder lo empaqueta y la exportación lo copia dentro de cada juego, o descarga la misma versión para otra plataforma (`exportar.js`, `process.versions.electron`). Aunque figure como devDependency, en la práctica es una dependencia de ejecución | `npm start`, empaquetado, `pruebas/` |
| `electron-builder` | ^26.15.3 (lock 26.18.1) | Instaladores NSIS y AppImage, y metadatos `latest*.yml` | `electron-builder.config.cjs`, scripts `release:*` |
| `@electron/packager` | ^20.3.0 | Build portable (`build:*`) | `herramientas/construir.js` |
| `js-yaml` | ^4.3.2 | Leer `latest*.yml` al verificar una release | `herramientas/verificar-release.cjs` (solo CI) |

## Dependencias usadas pero no declaradas

| Paquete | Llega por | Usado en | Riesgo |
|---|---|---|---|
| `resedit` 2.0.3 (lock `dev: true`) | `@electron/packager` y electron-builder | `src/principal/exportar.js`, para poner el icono y la versión al `.exe` exportado | En la app instalada no va (es una dependencia de desarrollo transitiva). `editarExeWindows` falla, el fallo se captura y el `.exe` exportado sale con el icono de Electron. Si se quiere esa función, hay que declararlo en `dependencies` |

## Resultado de `npm audit`

Ejecutado el 21-11-2026 con npm 11.20.0 contra el `package-lock.json`, antes y después de `ee249af`.

### `npm audit --omit=dev`

Antes y después:

```
found 0 vulnerabilities
```

### `npm audit` (completo)

Antes (Electron 44.9.0, electron-builder 26.15.3): **10 vulnerabilidades (9 moderadas, 1 alta)**.

```
electron  44.0.0-alpha.1 - 44.9.0          high      GHSA-jr5w-w6x2-84p9 (eMudhra)
fast-uri  3.0.0 - 3.1.8                    moderate  GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp
glob  9.0.0 - 14.0.1, @electron/asar       moderate  GHSA-3g3m-2fjr-6pw4
minimatch  7.0.0 - 11.0.0 y la cadena      moderate  GHSA-g3hv-75wg-m249
  de electron-builder
```

Cambios en `ee249af`: `npm install --save-dev electron@^44.11.5` y después `npm audit fix` **sin `--force`**. Todo es de desarrollo y sin saltos de versión mayor de paquetes directos: electron 44.9.0 → 44.11.5, electron-builder (y app-builder-lib, builder-util, dmg-builder, electron-publish) 26.15.3 → 26.18.1, fast-uri 3.1.8 → 3.1.9, glob 13.0.6 → 14.0.6, @electron/asar 4.3.1 → 4.3.2, minimatch (raíz) 10.2.6 → 11.0.9, tar 7.5.22 → 7.5.23 y otros transitivos.

Después: **6 vulnerabilidades moderadas**, todas del mismo aviso.

```
minimatch  7.0.0 - 11.0.0
Severity: moderate
minimatch has potential denial of service via globparts amplification - https://github.com/advisories/GHSA-g3hv-75wg-m249
fix available via `npm audit fix --force`
Will install electron-builder@25.1.0, which is a breaking change
node_modules/app-builder-lib/node_modules/@electron/universal/node_modules/minimatch
node_modules/app-builder-lib/node_modules/minimatch
  @electron/universal, app-builder-lib, dmg-builder, electron-builder, electron-builder-squirrel-windows

6 moderate severity vulnerabilities
```

Comprobado después: `npx electron-builder --version` da 26.18.1, `@electron/packager` carga, `npm test` pasa entero y la exportación a `win32-x64` funciona en Electron (ver `docs/SECURITY.md`, M4). `npm run release:*` no se ha ejecutado en este equipo.

### Triaje por alcance

| Aviso | ¿Se alcanza? | Decisión |
|---|---|---|
| `electron` GHSA-jr5w-w6x2-84p9 (alta) | Sí, en ejecución | **Corregido** en `ee249af` (44.11.5; el arreglo está desde 44.9.1) |
| `fast-uri`, `glob`, `@electron/asar` (moderada) | Solo build | **Corregido** en `ee249af` con `npm audit fix` |
| `minimatch` y la cadena de electron-builder (moderada) | Solo build, con patrones propios y no de usuario | **No** aplicar `--force`: bajaría electron-builder a 25.1.0. Esperar a que electron-builder 26.x lleve un minimatch corregido. Revisar el 31-12-2026 |

## Cadena de suministro

- `node_modules` ya no está versionado en git desde `6ca1704` (`git ls-files node_modules` da 0 y está en `.gitignore`). El lockfile es la única fuente de verdad. CI usa `npm ci` (`.github/workflows/releases.yml`).
- Los scripts de instalación de las dependencias se ejecutan en `npm ci` (no hay `--ignore-scripts`). `electron` descarga su binario en `postinstall`. Desde npm 11 se avisa de los scripts no aprobados: `electron-winstaller@5.4.0` (de electron-builder) tiene un `install` sin aprobar en `allowScripts`. No se ha aprobado ni revisado.
- `npm install` instala el Electron de la arquitectura de Node: en este equipo (Node arm64) quedó Electron **arm64**. Antes estaba el x64.
- `three-mesh-bvh` y `three-bvh-csg` están fijados a una versión exacta. El resto usa `^`, pero el lockfile y `npm ci` fijan lo que se instala.
- Pendiente: ejecutar `npm audit signatures` en CI para verificar las firmas del registro, y `npm audit` sin `--omit=dev` (Electron es runtime). No se ha hecho.
