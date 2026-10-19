# Componentes de terceros / Third-party components

La licencia propietaria de Falcon Engine se aplica únicamente a material propio
que el titular pueda licenciar. No sustituye las licencias de los componentes
siguientes ni las de sus componentes incorporados.

Falcon Engine's proprietary license covers only original material the rights
holder may license. Third-party components and their bundled components remain
under their own licenses.

## Inventario declarado / Declared inventory

Fuente: `package-lock.json` del repositorio. Esta tabla recoge declaraciones de
metadatos; no certifica la licencia de cada archivo ni sustituye sus textos.
Las categorías runtime/optional y build/dev proceden del indicador `dev` del lockfile.
Electron y sus binarios incluyen componentes adicionales que no enumera npm.

| Paquete / Package path | Versión / Version | Licencia declarada / Declared license | Grupo / Group |
| --- | --- | --- | --- |
| @electron-internal/extract-zip | 1.0.5 | BSD-2-Clause | build/dev |
| @electron/asar | 4.3.1 | MIT | build/dev |
| @electron/get | 5.1.0 | MIT | runtime/optional |
| @electron/notarize | 3.1.2 | MIT | build/dev |
| @electron/osx-sign | 2.7.1 | BSD-2-Clause | build/dev |
| @electron/packager | 20.3.0 | BSD-2-Clause | build/dev |
| @electron/universal | 3.0.6 | MIT | build/dev |
| @electron/windows-sign | 2.1.0 | BSD-2-Clause | build/dev |
| @fontsource/jetbrains-mono | 5.3.0 | OFL-1.1 | runtime/optional |
| @fontsource/manrope | 5.3.0 | OFL-1.1 | runtime/optional |
| @malept/cross-spawn-promise | 2.0.0 | Apache-2.0 | build/dev |
| @xmldom/xmldom | 0.9.12 | MIT | build/dev |
| balanced-match | 4.0.4 | MIT | build/dev |
| base64-js | 1.5.1 | MIT | build/dev |
| brace-expansion | 5.0.12 | MIT | build/dev |
| buffer-crc32 | 0.2.13 | MIT | runtime/optional |
| commander | 9.5.0 | MIT | build/dev |
| cross-spawn | 7.0.6 | MIT | build/dev |
| debug | 4.4.3 | MIT | runtime/optional |
| electron | 44.9.0 | MIT | build/dev |
| electron/node_modules/@types/node | 24.19.2 | MIT | build/dev |
| electron/node_modules/undici-types | 7.24.6 | MIT | build/dev |
| env-paths | 3.0.0 | MIT | runtime/optional |
| err-code | 2.0.3 | MIT | build/dev |
| fd-slicer | 1.1.0 | MIT | runtime/optional |
| filename-reserved-regex | 3.0.0 | MIT | build/dev |
| filenamify | 6.0.0 | MIT | build/dev |
| flora-colossus | 3.0.2 | MIT | build/dev |
| galactus | 2.0.2 | MIT | build/dev |
| glob | 13.0.6 | BlueOak-1.0.0 | build/dev |
| graceful-fs | 4.2.11 | ISC | runtime/optional |
| isbinaryfile | 4.0.10 | MIT | build/dev |
| isexe | 2.0.0 | ISC | build/dev |
| junk | 4.0.1 | MIT | build/dev |
| lru-cache | 11.5.3 | BlueOak-1.0.0 | build/dev |
| minimatch | 10.2.6 | BlueOak-1.0.0 | build/dev |
| minipass | 7.1.3 | BlueOak-1.0.0 | build/dev |
| ms | 2.1.3 | MIT | runtime/optional |
| path-key | 3.1.1 | MIT | build/dev |
| path-scurry | 2.0.2 | BlueOak-1.0.0 | build/dev |
| pe-library | 1.0.1 | MIT | build/dev |
| pend | 1.2.0 | MIT | runtime/optional |
| plist | 3.1.1 | MIT | build/dev |
| postject | 1.0.0-alpha.6 | MIT | build/dev |
| progress | 2.0.3 | MIT | runtime/optional |
| promise-retry | 2.0.1 | MIT | build/dev |
| resedit | 2.0.3 | MIT | build/dev |
| retry | 0.12.0 | MIT | build/dev |
| semver | 7.8.5 | ISC | runtime/optional |
| shebang-command | 2.0.0 | MIT | build/dev |
| shebang-regex | 3.0.0 | MIT | build/dev |
| sumchecker | 3.0.1 | Apache-2.0 | runtime/optional |
| three | 0.186.1 | MIT | runtime/optional |
| three-bvh-csg | 0.0.18 | MIT | runtime/optional |
| three-mesh-bvh | 0.9.7 | MIT | runtime/optional |
| undici | 7.30.1 | MIT | runtime/optional |
| which | 2.0.2 | ISC | build/dev |
| xmlbuilder | 15.1.1 | MIT | build/dev |
| yargs-parser | 22.0.0 | ISC | build/dev |
| yauzl | 2.10.0 | MIT | runtime/optional |

## Distribuciones / Distributions

Conservar los textos LICENSE, NOTICE, copyright y atribuciones que suministren
las dependencias efectivamente distribuidas, incluidos los de Electron,
Chromium y las fuentes. Respetar las condiciones de MIT, BSD, Apache, ISC,
OFL y las demás licencias aplicables. No eliminar avisos porque el motor sea
propietario. Este inventario no reemplaza esos textos ni acredita una auditoría
completa del paquete final.

Preserve the actual license texts, notices, copyrights and attributions shipped
with distributed dependencies, including Electron, Chromium and fonts. This
inventory is not a substitute for those texts or a completed distribution audit.

Las licencias se revisan de nuevo al actualizar dependencias o incorporar código,
imágenes, modelos, sonidos, fuentes, plantillas o contribuciones externas.
Recheck licenses when dependencies or external code, assets or contributions change.
