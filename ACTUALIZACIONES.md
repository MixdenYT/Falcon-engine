# Releases y actualizaciones de Falcon Engine

La interfaz de apoyo y actualizaciones se muestra únicamente en el gestor de
proyectos. Los IPC de actualizaciones rechazan llamadas desde el editor y los
juegos. El proceso principal gestiona las consultas, descargas e instalación.

## Estándar de versiones y notas

Usar SemVer 2.0.0: `1.2.3`, con tags `v1.2.3`. Las pruebas usan, por ejemplo,
`v1.3.0-beta.1` y deben marcarse como prerelease en GitHub. El canal Estable
excluye prereleases, borradores, versiones iguales y anteriores. El canal Pruebas
permite prereleases nuevas; nunca se hace downgrade automático.

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

- Windows x64: `npm run release:win` genera un instalador NSIS y `latest.yml`.
- Linux x64: `npm run release:linux` genera una AppImage y sus metadatos.
- Linux ARM64: `npm run release:linux-arm` genera una AppImage y sus metadatos.

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

El workflow `.github/workflows/releases.yml` se ejecuta al publicar una release.
Exige que su tag coincida con package.json y package-lock.json, ejecuta pruebas
y publica los artefactos. Durante la compilación la release puede ser visible
sin todos sus archivos: si ocurre, el gestor comunica el error y permite
reintentar; no marca la aplicación como actualizada por un fallo de consulta.

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
