# Releases y actualizaciones de Falcon Engine

La interfaz de apoyo y actualizaciones se muestra únicamente en el gestor de
proyectos. Los IPC de actualizaciones rechazan llamadas desde el editor y los
juegos. El proceso principal gestiona las consultas, descargas e instalación.

## Estándar de versiones y notas

Usar SemVer 2.0.0: `1.2.3`, con tags `v1.2.3`. El canal lo decide la marca
prerelease de GitHub, no un sufijo: una release `v1.4.0` marcada como prerelease
solo la ve el canal Pruebas (el workflow la publica así con `canal: pruebas`).
También se acepta un sufijo SemVer (`v1.3.0-beta.1`), que debe ir igualmente
marcado como prerelease. El canal Estable excluye prereleases, borradores,
versiones iguales y anteriores. El canal Pruebas permite prereleases nuevas;
nunca se hace downgrade automático. Para pasar una versión de Pruebas a Estable
se publica una versión superior con `canal: estable` (no se editan releases ya
publicadas).

Escribir el cuerpo de cada release con encabezados Keep a Changelog. El gestor
agrupa el contenido real por categoría; no inventa novedades. Las notas se
muestran como texto, sin ejecutar HTML o scripts. Se pueden usar encabezados en
español o inglés. Las categorías desconocidas siguen visibles en Otros cambios.

```markdown
## Added
- Nueva herramienta: explica brevemente cómo usarla.

## Changed
- Describe la mejora y su efecto.

## Fixed
- Describe el error corregido.

## Security
- Describe la corrección de seguridad cuando corresponda.
```

El ejemplo anterior es una plantilla, no notas de una versión publicada.

## Paquetes compatibles con instalación automática

Cada archivo publicado lleva la arquitectura explícita (`x86_64` o `arm64`):

| Plataforma | Script | Instalador | Metadatos |
|---|---|---|---|
| Windows x86_64 | `npm run release:win` | `Falcon-Engine-<versión>-windows-x86_64.exe` (+ `.blockmap`) | `latest.yml` |
| Windows arm64 | `npm run release:win-arm` | `Falcon-Engine-<versión>-windows-arm64.exe` (+ `.blockmap`) | `latest-arm64.yml` |
| Linux x86_64 | `npm run release:linux` | `Falcon-Engine-<versión>-linux-x86_64.AppImage` | `latest-linux.yml` |
| Linux arm64 | `npm run release:linux-arm` | `Falcon-Engine-<versión>-linux-arm64.AppImage` | `latest-linux-arm64.yml` |

electron-updater busca el instalador por los metadatos, no por el nombre. En
Linux el nombre de los metadatos ya lleva la arquitectura; en Windows siempre es
`latest.yml`, así que arm64 usa su propio canal: `electron-builder.config.cjs`
publica con `channel: latest-arm64` cuando se compila con `--arm64`, y
`actualizaciones.js` pasa ese canal a `setFeedURL` cuando el proceso es arm64.
x86_64 sigue en `latest.yml`, el que leen las instalaciones 1.3.0. El
actualizador rechaza metadatos cuyo instalador no sea de su plataforma y
arquitectura. Una instalación x86_64 que corre emulada en Windows ARM sigue
recibiendo x86_64; para pasar a arm64 se instala el instalador arm64.

Se usa electron-updater, con descarga explícita, progreso, comprobación de hashes
según los metadatos y validación de firma de Windows cuando se dispone de un
publicador configurado. No se desactiva la comprobación de firmas. Configura
la firma de producción mediante las opciones oficiales de electron-builder y
sus secretos de CI; no incluyas certificados ni claves en el repositorio.

Conserva y publica juntos los instaladores/AppImages, sus archivos `.yml` y los
blockmaps que genere electron-builder. No edites a mano hashes ni tamaños.
Los scripts `build:win`, `build:linux` y `build:linux-arm` mantienen los paquetes
portátiles anteriores. Esos paquetes detectan versiones y abren la release
para instalación manual: no prometen autoactualización.

El workflow `.github/workflows/releases.yml` se inicia desde Actions → Verificar
y publicar instaladores → Run workflow, seleccionando la rama e indicando la versión de package.json.
Para una release completa, elige `canal` (`pruebas` = prerelease, `estable` = Latest),
activa `publicar` y desactiva `solo_windows`.
Para una entrega de prueba de Windows (x86_64 y arm64), deja `publicar` desactivado y `solo_windows` activado.
La versión debe coincidir también con package-lock.json y existir en
`notas/v<version>.md`. Ejecuta pruebas, compila las cuatro plataformas sin publicar
(Windows arm64 en el ejecutor `windows-11-arm`),
verifica tamaños y SHA-512, genera SHA256SUMS.txt y sube todo a un borrador.
Antes de subir artefactos, instala el NSIS o extrae la AppImage y crea, abre en
el editor y ejecuta las 11 plantillas con la aplicación empaquetada. Guarda JSON,
logs y capturas en los artefactos `pruebas-instalador-*`. Cualquier fallo impide
publicar. Las pruebas no comparten los datos de una sesión de usuario.
Solo publica el borrador cuando sus archivos están completos. Si falla una
plataforma, no aparece una actualización incompleta. Una versión ya publicada
no se sobrescribe: se necesita un número superior.

## Repositorio privado y distribución pública

El destino por defecto es `MixdenYT/Falcon-engine`. Un cliente sin autorización
no puede consultar releases de un repositorio privado. El gestor comunica ese
caso como error de acceso/configuración, no como ausencia de actualizaciones.

Para distribuir sin acceso al código, utiliza un repositorio separado de
releases y cambia `falconUpdates.repository` en package.json **antes de compilar**.
Configura el workflow con un token limitado a publicar artefactos en ese destino.
`FALCON_RELEASE_REPOSITORY=propietario/repositorio` permite cambiar el destino
en un entorno controlado, pero no se incrusta por sí solo como configuración de
una aplicación ya instalada: la configuración incorporada es package.json.

Para pruebas privadas puede provisionarse `FALCON_UPDATE_TOKEN` únicamente en el
equipo autorizado. Nunca se copia al renderer, ajustes, logs, paquetes o GitHub.
No incluyas un PAT de propietario en una aplicación distribuida. Patreon no
autoriza automáticamente el acceso a GitHub ni desbloquea el canal Pruebas.

## Instalación y copias

Actualizar ahora descarga y verifica el paquete y pide guardar los proyectos
antes de reiniciar. Instalar al cerrar descarga primero y deja la instalación
programada en la sesión actual. La biblioteca administra el reemplazo, sin
scripts propios que sobrescriban binarios en uso.

La opción de copia guarda `falcon-datos.json` y `falcon-actualizaciones.json`
dentro de `userData/copias-actualizaciones/`. Es una copia de ajustes/lista de
recientes, **no una copia de las carpetas de proyectos**. No se promete un
rollback completo del motor ni compatibilidad de proyectos de versiones futuras.
Guarda los proyectos fuera de la carpeta de instalación.

## Referencias

- https://semver.org/
- https://keepachangelog.com/en/1.1.0/
- https://www.electron.build/docs/features/auto-update/
- https://docs.github.com/en/rest/releases/releases

## Patreon

Los botones y la selección de niveles abren el navegador en el Patreon de
Mixden; no cobran ni guardan datos de pago dentro del motor. Precios y ventajas
se muestran como referencia y se confirman en Patreon antes de suscribirse.
