# Aplicación de la licencia propietaria de Falcon Engine

## Alcance de esta propuesta

Se incorpora LICENSE (español e inglés) y se cambia únicamente la declaración de
licencia del paquete raíz a `SEE LICENSE IN LICENSE`, tanto en package.json
como en package-lock.json. No cambian las licencias de las dependencias.
El texto ha sido preparado con asistencia de IA; no ha sido revisado ni firmado
por un abogado y no acredita la titularidad de cada archivo.

## Antes de incorporar el cambio a una distribución

1. Confirmar qué persona o entidad es titular de cada parte del código original
y documentar permisos de colaboradores. La cuenta MixdenYT identifica el canal
del proyecto; no sustituye los datos legales del proveedor que deban facilitarse
al distribuir o contratar con usuarios.
2. Revisar el historial y las distribuciones anteriores. El paquete raíz declaraba
MIT antes de esta propuesta. Esta propuesta no determina si esa declaración
constituyó una licencia válida para cada archivo y no revoca derechos ya
concedidos. La licencia propietaria solo debe aplicarse al material y versiones
que el titular esté facultado para distribuir bajo ella.
3. Confirmar el contenido exacto del editor y de los juegos exportados. Conservar
los avisos y textos completos de terceros que correspondan al paquete final.
THIRD_PARTY_NOTICES.md es un inventario de metadatos, no una auditoría de código
ni una recopilación completa de las licencias de los binarios de Electron.
4. Incluir LICENSE en cada distribución oficial y junto al runtime exportado.
El empaquetador actual copia el árbol del proyecto, pero se debe comprobar el
paquete final y el exportador antes de publicar. Esta propuesta no modifica
ni prueba el exportador o el instalador.
5. Para utilizarla como EULA, mostrar el texto completo antes de la aceptación,
permitir guardarlo y registrar qué versión aceptó el usuario. La mera presencia
del archivo en GitHub no implementa ese flujo. Esta propuesta no añade una
pantalla de aceptación ni afirma que los usuarios anteriores la hayan aceptado.
6. Mantener el repositorio de código privado si se desea limitar el acceso.
No publicar código privado mediante un repositorio de descargas. Si se hace
público en GitHub, aplicar también los derechos de la plataforma sobre vista
y forks. La licencia no puede impedir técnicamente las copias.

## Patreon

La aportación no concede automáticamente una licencia sobre el código.
Si se sigue ofreciendo acceso al código como recompensa, explicar que es
consulta mediante acceso autorizado y acordar por escrito cualquier permiso de
modificación o colaboración. No revocar beneficios adquiridos ni cambiar
retroactivamente compromisos anteriores mediante este archivo.

## Referencias consultadas

- Ley de Propiedad Intelectual, texto consolidado del BOE, especialmente el
  artículo 100 (límites y derechos de usuarios legítimos):
  https://www.boe.es/eli/es/rdlg/1996/04/12/1/con
- GitHub, licencias de repositorios:
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository

## English maintainer summary

This proposal adds a bilingual proprietary license and changes only the root
package's license metadata. It does not relicense third-party dependencies,
revoke valid earlier grants, establish ownership of contributions, implement
EULA acceptance, or certify distribution compliance. Review ownership, earlier
MIT metadata and releases, distribution notices, runtime exports, provider
identity, and acceptance before shipping under the proposed terms.
