# Compatibilidad de proyectos, formatos y APIs

Estado del 21-11-2026, rama `motor-ara` (`6117105`). Compatibilidad por plataforma: [`PLATFORM_MATRIX.md`](PLATFORM_MATRIX.md).

## Formatos de archivo

| Archivo | Marca de formato | Qué pasa al cargar |
|---|---|---|
| `proyecto.falcon` | `formato: 'falcon-proyecto'`, `version: 1` (`VERSION_FORMATO`, `proyecto.js:4`) | `Proyecto.cargar` (`proyecto.js:127`) rellena con los valores por defecto lo que falte. **No mira `version`:** un proyecto de un formato futuro se abre sin aviso |
| `.talon` (Talon Engine) | — | Se abre sin convertir (`proyecto.js:129`, `editor.js:42`) |
| Escenas `.fscn` | `formato: 'falcon-escena'`, `version: 1` | `normalizarEscena` (`proyecto.js:99`): el tipo de escena solo puede ser `2D` o `3D`; los nodos pasan por `normalizarNodo` |
| Nodos | — | `normalizarNodo` (`tipos.js:452`). Desde `5f79601` descarta lo que no es del tipo de su valor por defecto (`delTipo`, `tipos.js:437`). Un número escrito como texto se convierte; uno no válido se cambia por el valor por defecto. Las propiedades desconocidas se conservan. `pruebas/ejemplos.test.js` comprueba que las plantillas no cambian |
| Blueprints `.bp` | `formato: 'falcon-blueprint'`, `version: 1` (`blueprints.js:182`) | No se mira la versión. Se compila desde el `.bp` en cada ejecución; `generado/*.ara` es solo una copia para leer |
| Materiales `.mat`, `.malla`, `.falcon/importacion.json` | — | Ver `materiales.js` y `SECURITY.md` (C1) |
| Juego exportado: `.falcon/ara.json` | `disposicion: 1` (`DISPOSICION_EXPORTADA`, `puente.js:86`) | Si no coincide, el juego no carga los scripts y pide volver a exportar (`puente.js:143`) |

## Juegos exportados

- Cada juego lleva su propio Electron, `src/motor` (con `nucleo.wasm`), el runtime de Ara y sus scripts ya compilados (`exportar.js:19-30`, `exportar.js:241`).
- Por eso un juego ya exportado no cambia al actualizar Falcon. Para recoger cambios del motor hay que volver a exportarlo.
- El runtime de Ara y los `.wasm` compilados van a la par:
  - `abc24d9` cambió el runtime (el de Rust por el escrito en Ara) y obligó a regenerar `nucleo.wasm`;
  - un `.falcon/ara.wasm` hecho con otro runtime no está garantizado;
  - `disposicion` no detecta ese caso: solo cambia si cambia la forma de lo exportado.

## APIs de script

| API | Contrato | Garantía |
|---|---|---|
| Ara (`.ara`) | `src/ara/motor.ara` (24 tipos, 10 eventos). Sin cambios entre `main` y `motor-ara` | `ara.test.js`: `motor.ara declara toda la API de Falcon` y `api-motor.js está al día con motor.ara` |
| Águila (`.agl`) | `src/aguila/` sin cambios en esta rama | `pruebas/aguila.test.js` (31) |
| Blueprints | Bloques de `NODOS` y la API de `api-motor.js` | `blueprints.test.js`: todo el catálogo compila |
| Diferencias entre Águila y Ara | `puntos()`, `poner_puntos(n)`, `gravedad_global()`, `yo.y`, `.existe()`; `despues` no existe en Ara | `ara-etapa5/ara/docs/JUEGOS.md` §4 |

- **Determinismo.** Con el núcleo de Ara, la física 2D da lo mismo en todas las plataformas. El respaldo JS en Electron puede separarse ([`ARA_INTEGRATION.md`](ARA_INTEGRATION.md) §5). Solo con el núcleo cargado la misma entrada da la misma simulación en todas las plataformas.
- **Pendiente:**
  - no hay política de versiones de formato (rechazar o migrar un `version` mayor que 1);
  - los `.bp` y los proyectos no se migran entre versiones.
