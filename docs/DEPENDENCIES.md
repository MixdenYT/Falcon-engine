# Dependencias de Falcon Engine

Estado a 21-11-2026 (Falcon Engine 1.3.0). Fuentes: `package.json`, `package-lock.json` (lockfileVersion de npm 11.20.0) y un grep de los imports en `src/`, `herramientas/` y `electron-builder.config.cjs`.

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
| `electron` | ^44.9.0 (instalada 44.9.0) | **Runtime de la app**: electron-builder lo empaqueta y la exportación lo copia dentro de cada juego (`exportar.js:97-98`). Aunque figure como devDependency, en la práctica es una dependencia de ejecución | `npm start`, empaquetado, `pruebas/` |
| `electron-builder` | ^26.15.3 | Instaladores NSIS y AppImage, y metadatos `latest*.yml` | `electron-builder.config.cjs`, scripts `release:*` |
| `@electron/packager` | ^20.3.0 | Build portable (`build:*`) | `herramientas/construir.js` |

## Dependencias usadas pero no declaradas

| Paquete | Llega por | Usado en | Riesgo |
|---|---|---|---|
| `resedit` 2.0.3 (lock `dev: true`) | `@electron/packager` y electron-builder | `src/principal/exportar.js:275`, para poner el icono y la versión al `.exe` exportado | En la app instalada no va (es una dependencia de desarrollo transitiva). `editarExeWindows` falla, el fallo se captura y el `.exe` exportado sale con el icono de Electron. Si se quiere esa función, hay que declararlo en `dependencies` |
| `js-yaml` 4.3.2 | electron-builder | `herramientas/verificar-release.cjs:5` | Solo CI. Conviene declararlo como devDependency para que no se rompa si cambia el árbol |

## Resultado de `npm audit`

Ejecutado el 21-11-2026 con npm 11.20.0 contra el `package-lock.json` versionado. No se ha modificado ni `package.json` ni el lockfile.

### `npm audit --omit=dev`

```
found 0 vulnerabilities
```

### `npm audit` (completo)

```
electron  44.0.0-alpha.1 - 44.9.0
Severity: high
Electron: Mitigation for compromised eMudhra intermediate certificates - https://github.com/advisories/GHSA-jr5w-w6x2-84p9
fix available via `npm audit fix`
node_modules/electron

fast-uri  3.0.0 - 3.1.8
Severity: moderate
(4 avisos: GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp)
fix available via `npm audit fix`

glob  9.0.0 - 14.0.1
Severity: moderate
Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal - GHSA-3g3m-2fjr-6pw4
  @electron/asar  4.0.0 - 4.3.1 (depende de glob y minimatch)

minimatch  7.0.0 - 11.0.0
Severity: moderate
minimatch has potential denial of service via globparts amplification - GHSA-g3hv-75wg-m249
fix available via `npm audit fix --force` (instalaría electron-builder@25.1.0, cambio incompatible)
  @electron/universal, app-builder-lib, dmg-builder, electron-builder, electron-builder-squirrel-windows

10 vulnerabilities (9 moderate, 1 high)
```

### Triaje por alcance

| Aviso | ¿Se alcanza? | Decisión |
|---|---|---|
| `electron` GHSA-jr5w-w6x2-84p9 (alta) | **Sí, en ejecución**: es el runtime que se distribuye y que va dentro de los juegos exportados. `--omit=dev` lo oculta | Subir Electron a la versión 44 corregida (`npm audit fix` sin `--force`), probar y publicar. Ver SECURITY.md, M4 |
| `fast-uri` (moderada) | Solo herramientas de build (cadena de validación de esquemas de electron-builder). No se procesan URI no confiables | `npm audit fix` en la próxima subida de herramientas. Revisar el 31-12-2026 |
| `glob`, `@electron/asar` (moderada) | Solo build, sobre archivos propios | Igual que el anterior |
| `minimatch` y la cadena de electron-builder (moderada) | Solo build, con patrones propios y no de usuario | **No** aplicar `--force`: bajaría electron-builder a 25.1.0. Esperar a que electron-builder 26.x publique la corrección. Revisar el 31-12-2026 |

## Cadena de suministro

- **`node_modules` está versionado en git**: `git ls-files node_modules` da 3.383 archivos. El árbol local está incompleto respecto al lockfile: faltan, por ejemplo, `electron-updater` y el contenido de `yauzl`. CI lo ignora y usa `npm ci` (`.github/workflows/releases.yml`, con un sparse-checkout sin `node_modules`). Recomendación: sacar `node_modules` del repositorio y añadirlo a `.gitignore`, para que el lockfile sea la única fuente de verdad.
- Los scripts de instalación de las dependencias se ejecutan en `npm ci` (no hay `--ignore-scripts` ni política). `electron` descarga su binario en `postinstall`.
- `three-mesh-bvh` y `three-bvh-csg` están fijados a una versión exacta. El resto usa `^`, pero el lockfile y `npm ci` fijan lo que se instala.
- Pendiente: ejecutar `npm audit signatures` en CI para verificar las firmas del registro. No se ejecutó en esta auditoría.
