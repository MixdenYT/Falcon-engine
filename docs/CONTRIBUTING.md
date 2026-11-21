# Cómo contribuir

Este documento recoge la forma de trabajar de [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md), «Cómo se trabaja». Si los dos no coinciden, manda la hoja de ruta.

## Ramas y repositorios

- **Falcon:** `falcon-engine`, rama `motor-ara`. **Ara:** `ara-etapa5/ara`, rama `motor-ara`. `main` (Falcon) y `master` (Ara) no se tocan.
- Los cambios de Ara se hacen en Ara y llegan a Falcon con `copiar-a-falcon.sh` ([`ARA_INTEGRATION.md`](ARA_INTEGRATION.md) §4). Nunca se edita a mano `src/ara/ara_web.wasm`, `ara_runtime.wasm` ni `src/motor/ara/nucleo.wasm`.
- Las worktrees de otros agentes (por ejemplo `ara-a5`) no se tocan. Su trabajo llega a `motor-ara` con una fusión (Ara `7e4e99b`).
- No se hace push sin permiso del dueño. Hoy solo hay commits locales.

## Commits

- Mensaje en español, en imperativo o descriptivo, que diga qué cambia y por qué. Si cierra un bloque o un hallazgo, se nombra: «(B3)», «(C1, A2)».
- Un commit por cambio coherente. Un `.ara` del núcleo va siempre en el mismo commit que su `nucleo.wasm`.
- Solo se añaden los ficheros propios (`git add <rutas>`), nunca `git add -A`: hay varios agentes trabajando en el mismo árbol.
- Si un agente hizo el trabajo, el mensaje acaba con `Co-Authored-By:`.

## Pruebas obligatorias

Antes de cada commit que toque código:

| Orden | Cuándo |
|---|---|
| `npm test` | Siempre. Incluye «nucleo.wasm está al día» y «api-motor.js está al día» |
| `npm run test:actualizaciones` | Si se toca `src/principal/actualizaciones.js` o `notas-release.js` |
| `node herramientas/compilar-nucleo-ara.mjs` | Si se cambia `src/motor/ara/*.ara` o se actualiza Ara |
| `node herramientas/api-ara.mjs` | Si se cambia `src/ara/motor.ara` |
| `cargo test --release --target x86_64-pc-windows-msvc` (en Ara) | Si se toca Ara. En Windows ARM64 corre emulado (ver [`TESTING.md`](TESTING.md)) |
| `herramientas/medir-ara.mjs`, `medir-fisica2d.mjs` | Si el cambio pretende ser más rápido. Las cifras van a [`BENCHMARKS.md`](BENCHMARKS.md) |

- Una ruta nueva de Ara necesita una prueba que la compare con JS paso a paso.
- Lo que no se pueda probar headless (render, audio, Electron) se comprueba a mano y se apunta con la fecha y la plataforma en [`PLATFORM_MATRIX.md`](PLATFORM_MATRIX.md).
- Último resultado (21-11-2026, `6117105` más cambios de otros agentes sin confirmar en `lumbre.js` y `visor3d.js`): `node pruebas/ejecutar.js`, código de salida 0.
  - `node:test`: 79 de 79.
  - Pruebas caseras: Águila 31, Huecos 3, Sombras 3, Texturas 2.

## Revisión cruzada por bloque

Antes de integrar un bloque, lo revisa otro rol, distinto del que lo escribió. Busca:
1. **Simplificación:** ¿sobra código, una abstracción o una dependencia? ¿Algo existente ya lo resuelve?
2. **Optimización:** ¿hay un coste medible (CPU, memoria, cruces Ara↔JS) que se pueda quitar?
3. **Arquitectura:** ¿respeta las reglas de frontera de [`ARCHITECTURE.md`](ARCHITECTURE.md)? ¿Obliga a Ara a algo que solo necesita Falcon?

Lo encontrado se aplica, o se anota en el bloque con su justificación (ejemplo: `2e4289b`, revisión de B2).

## Estados de una tarea

**Pendiente → En desarrollo → En revisión → Completado**, o **Bloqueado** (con el motivo).

Para estar **Completado** hacen falta:
- el código;
- las pruebas en verde;
- la revisión cruzada;
- la documentación al día.

## Agentes y skills

- **Skills.** Se cargan al empezar cada sesión:
  - **Caveman:** respuestas breves en el chat. No se aplica a los documentos, los commits ni el código.
  - **Ponytail:** el cambio más pequeño que resuelve la tarea entera. Los atajos se marcan con `shortcut: <límite>, <cuándo mejorarlo>`.
- **Agentes.** Los 8 agentes son roles. No se presenta como independiente a un agente que no lo es.
- **Documentación.** Se documenta lo que existe, con `fichero:línea` o un commit como prueba. Lo planeado se marca como **Plan**.

## Seguridad

- Todo lo que viene de un proyecto (`.falcon`, `.fscn`, `.bp`, `.mat`, scripts) es **dato no confiable**:
  - se valida al cargar (`normalizarNodo`);
  - se escapa con `esc()` antes de llegar a `innerHTML`;
  - no se pone `on*=` ni `'unsafe-inline'` en las CSP (lo comprueba `pruebas/seguridad.test.js`).
- El IPC nuevo comprueba quién lo llama (`de(e, …)`) y la ruta (`rutaPermitida`, `src/principal/rutas.js`).
- Sin secretos en el repositorio. Antes de añadir una dependencia, `npm audit` (ver [`DEPENDENCIES.md`](DEPENDENCIES.md)).
- Hallazgos y estado: [`SECURITY.md`](SECURITY.md).
