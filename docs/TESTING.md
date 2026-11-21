# Pruebas de Falcon Engine y de Ara

Estado comprobado el 21-11-2026 en la rama `motor-ara` (`db8923f`), con Windows 11 ARM64 y Node v26.13.1 arm64.

## Falcon Engine

### Cómo se ejecutan

| Orden | Qué hace |
|---|---|
| `npm test` | Primero `pretest`: `node herramientas/reconstruir-cqb.cjs` rehace los GLB del CQB a partir de sus fragmentos. Después `node pruebas/ejecutar.js` importa, uno tras otro y por orden alfabético, todos los `pruebas/*.test.js`. |
| `npm run test:actualizaciones` | `node --test pruebas/actualizaciones.test.cjs`: el actualizador. Es CommonJS, así que `npm test` no lo incluye. |
| `node pruebas/<archivo>.test.js` | Ejecuta un solo archivo. |

- **Todo es headless, en Node**: no se abre Electron, no hay WebGL ni Canvas, no suena nada y no hay DOM real.
  - `pruebas/dom.js` añade lo mínimo del DOM que necesita el motor: `DOMMatrix` y `DOMPoint` para transformaciones afines 2D. Lo importan las pruebas que crean un `Mundo` 2D.
  - El audio y la parte 3D se sustituyen en cada prueba por objetos de mentira, como `m.audio = { sonar() {}, pararNodo() {} }` o un `m.d3` con `lineaVision`.
- **Dos formatos de prueba conviven:**
  - `node:test`: `test(...)`, que entra en el resumen `ℹ tests N`.
  - Un `prueba(...)` casero (`aguila`, `huecos`, `sombras`, `texturas`). Imprime `X: n pruebas correctas, m fallidas` y pone `process.exitCode = 1` si falla alguna. Estas pruebas **no** cuentan en el resumen de `node:test`.
- **CI** (`.github/workflows/`):
  - `verificar-actualizaciones.yml`, en cada pull request y en `ubuntu-latest` con Node 22: `npm ci --ignore-scripts`, `npm test`, `npm run test:actualizaciones` y la validación de `electron-builder.config.cjs`.
  - `releases.yml`, a mano: `npm ci`, las dos baterías, el instalador y `herramientas/probar-instalado.cjs`, que abre el NSIS o la AppImage instalados y juega las plantillas con Electron de verdad. Corre en Windows x64, Linux x64 y Linux ARM64.
  - Desde este equipo no se ha visto ninguna ejecución de CI.

### Resultado real hoy

- `npm test` termina con **código de salida 1**:
  - `node:test` da 50 aprobadas y 0 fallidas; Águila, 31 correctas; Huecos, 3 correctas.
  - El fallo es un `uncaughtException`: `Cannot find module 'js-yaml'`, desde `herramientas/verificar-release.cjs`, que importa `pruebas/release.test.js`.
- **Ese fallo esconde 7 pruebas.**
  - `ejecutar.js` hace `await import(...)` en bucle y no captura errores.
  - Al fallar el import de `release.test.js`, el bucle se corta. No llegan a ejecutarse:
    - `release.test.js` (2)
    - `sombras.test.js` (3)
    - `texturas.test.js` (2)
  - Por separado, `node pruebas/sombras.test.js` y `node pruebas/texturas.test.js` pasan (3/3 y 2/2).
  - Las «50 pruebas que pasan» de `REWRITE_ROADMAP.md` son las de `node:test` sin `release`.
- `npm run test:actualizaciones`: 10/10.

**Causa del `js-yaml`:**
- `node_modules/` está versionado en git (3.383 archivos de una instantánea antigua), aunque `.gitignore` lo excluye. Esa instantánea es anterior a `electron-builder` y `electron-updater`.
- En este equipo no se ha ejecutado `npm ci`. Por eso `npm ls` da `UNMET DEPENDENCY electron-builder@^26.15.3` y `electron-updater@^6.8.9`.
- `js-yaml` (4.3.2 en el lockfile) solo llega como dependencia transitiva de `app-builder-lib`, `builder-util`, `dmg-builder` y `electron-updater`.
- Aun así, `verificar-release.cjs` hace `require('js-yaml')` directamente, sin declararlo.
- En CI pasa porque `npm ci` instala el árbol completo y `js-yaml` queda en la raíz de `node_modules`.

**Arreglo propuesto. No se ha aplicado.**
1. Declarar la dependencia que se usa: `"js-yaml": "^4.1.0"` en `devDependencies`.
   - El lockfile ya resuelve `node_modules/js-yaml` a 4.3.2; solo cambiaría la entrada raíz `packages[""]`.
   - Orden: `npm install -D js-yaml@^4.1.0`.
2. En local, `npm ci` completa `node_modules`.
   - Ojo: reescribe la instantánea versionada y el diff en git es enorme.
   - Conviene decidir antes si se deja de versionar: `git rm -r --cached node_modules`.
3. `pruebas/ejecutar.js` debe capturar el error de cada archivo, marcar `process.exitCode = 1` y seguir con el siguiente. Así un import roto no oculta las pruebas posteriores.

### Qué cubre cada archivo

| Archivo | Pruebas | Cubre |
|---|---|---|
| `aguila.test.js` | 31 (caseras) | Intérprete de Águila: aritmética, control, funciones, listas, diccionarios, clases, mensajes de error (sugerencias, palabra inglesa, bucle infinito), scripts de nodo con eventos y `esperar`, analizador del editor, formateador. |
| `animacion3d.test.js` | 6 | `animacion3d.js`, `agarre3d.js`, `armas3d.js`, `tactico3d.js`: rigs clonados independientes, rig real de Meshy (escala, agarre de las dos palmas durante la recarga), IK sin estirar huesos, quitar desplazamiento de cadera, reinicio del clip de disparo. Lee GLB reales. |
| `ara.test.js` | 12 | `src/ara/puente.js` con `mundo.js`: scripts de Ara que mueven nodos, eventos con filtro, campos exportados, errores con archivo y línea, `esperar` con JSPI, `nodo.llamar` y señales entre Ara y Águila, ayudas del editor (`comprobarAra`, `formatearAra`, símbolos), `motor.ara` y `api-motor.js` al día, exportación con Ara y Blueprints precompilados (`compilarAra` de `exportar.js`), CSP que permite wasm. |
| `blueprints.test.js` | 7 | Compilador Blueprint→Ara: tipos, eventos, funciones, otros nodos, errores por bloque, nombres, todo el catálogo de bloques. |
| `convertir.test.js` | 6 | Conversor Águila→Ara: los scripts de `pruebas/aguila/` compilan, reglas, avisos de lo que no se puede convertir, el shooter convertido juega igual, `convertirProyecto`. |
| `cqb-recursos.test.js` | 2 | Hash de cada recurso de `recursos/cqb` y reconstrucción exacta de los GLB. |
| `cqb.test.js` | 8 | CQB en `Mundo3D`: grafos que compilan, munición, rayos, recarga, IA y cobertura, puertas, A* con radio, muros entre cámara y boca, a quemarropa. |
| `ejemplos.test.js` | 8 | Plantillas y Academia: cada bloque real en un grafo ejecutable, todas las plantillas compilan su Ara, puzle de cajas en Ara que se gana, combate e IA con scripts, rayos y cobertura, crear proyectos (WAV y metadatos). |
| `huecos.test.js` | 3 (caseras) | `huecos.js` y `escena3d.js`: CSG del muro con puerta, colisión partida en cajas. |
| `release.test.js` | 2 | `verificar-release.cjs`: tres plataformas completas, `SHA256SUMS.txt`, rechazo de binarios alterados, de plataformas incompletas y de versiones distintas. **Hoy no se ejecuta** (ver arriba). |
| `sombras.test.js` | 3 (caseras) | `lumbre-parche.js`: sesgo de las sombras del sol, de las bombillas y de los focos. **No se ejecuta con `npm test`.** |
| `texturas.test.js` | 2 (caseras) | `escena3d.js`: UV por cara y recálculo al escalar. **No se ejecuta con `npm test`.** |
| `actualizaciones.test.cjs` | 10 | `actualizaciones.js` y `notas-release.js`: SemVer, notas de versión hostiles, repositorio válido, paginación, 404, IPC solo desde el gestor, canales, metadatos y suma de verificación antes de instalar. |

### Huecos de cobertura por subsistema

Archivos de `src/` que ninguna prueba importa, directa o indirectamente:

| Subsistema | Archivos | Cobertura real |
|---|---|---|
| Render 2D | `render2d.js` (425 líneas) | **Ninguna.** No hay Canvas en Node. |
| Render 3D y Lumbre | `lumbre.js` (1.632), `lumbre-proxy.js`, `materiales.js`, `graficos.js` | Solo el cálculo del sesgo de las sombras (`lumbre-parche.js`) y las UV y CSG de `escena3d.js`. Ni WebGL2, ni sondas, GTAO o bloom, ni comparación de imágenes. |
| Audio | `audio.js`, `sonidos-cqb.js` | **Ninguna.** Las pruebas lo sustituyen por un objeto vacío. |
| Entrada | `entrada.js` | **Ninguna.** Las pruebas emiten los eventos directamente (`emitirNodo(j, 'se_pulsa', …)`). |
| Física 2D | `mundo.js` (`fisica2d`, `contactos2d`) | Solo indirecta (el puzle de cajas). Otro agente está escribiendo una prueba propia. `src/motor/ara/fisica2d.ara` no tiene ninguna prueba todavía. |
| Controles 3D | `control3d.js` | Indirecta, vía CQB y `Mundo3D`. |
| Editor, UI y gestor | `src/editor/`, `src/ui/`, `src/gestor/` (unas 8.500 líneas) | Solo las ayudas de Ara para el editor. No se prueba nada del DOM: paneles, visores, grafo, gestor, comunidad. |
| Exportación | `exportar.js` (363) | Solo `compilarAra`. No se prueba la exportación de un juego: descarga de Electron, copia, icono con `resedit`, `.tar.gz` con permisos, `LÉEME.txt`. |
| Empaquetado | `herramientas/construir.js`, `electron-builder.config.cjs`, `verificar-paquete.cjs` | Solo en CI de release (`probar-instalado.cjs`). En CI de PR se valida el esquema de la configuración. |
| Proceso principal | `main.js`, `preload.js`, `jugador.js` | Solo el IPC del actualizador. Ni protocolo `falcon://`, ni ventanas, ni el resto del IPC, salvo en `probar-instalado.cjs` de CI. |
| Generadores | `generadores.js` | **Ninguna.** |
| Red | — | No existe. |
| Seguridad | Parser de Ara y Águila, importadores GLB y `.fscn` | Sin fuzzing (fase 7). |
| Rendimiento | — | Sin umbrales en las pruebas. `herramientas/medir-ara.mjs` se ejecuta a mano (ver `BENCHMARKS.md`). |

## Ara (`ara-etapa5/ara`)

Solo se describe. Este documento no ejecuta la batería de Ara.

### Cómo se ejecuta en este equipo

```sh
cd ara-etapa5/ara
cargo test --release --target x86_64-pc-windows-msvc
```

- Se compila para x64 y corre emulado (Prism). El host de Rust es `aarch64-pc-windows-msvc`, pero `ring` necesita clang para ARM64 y aquí no está.
- `ARA_SIN_WASM=1` desactiva las comparaciones con WebAssembly (necesitan Node). `ARA_NODE` elige el ejecutable de Node.

### Qué hay

| Batería | Dónde | `#[test]` | Qué compara |
|---|---|---|---|
| Programas de extremo a extremo | `crates/ara_interprete/tests/programas.rs` | 122 | **Diferencial:** cada programa con el JIT (Cranelift) y compilado a wasm en Node debe dar la misma salida, el mismo error en la misma posición y ninguna fuga. |
| Optimizador | `crates/ara_interprete/tests/optimizador.rs` | 13 | **Diferencial:** el programa con y sin optimizar la HIR hace lo mismo. |
| Autoalojado | `crates/ara_interprete/tests/autoalojado.rs` | 11 | **Diferencial:** el compilador escrito en Ara (`compilador/*.ara`) da los mismos tokens, AST y HIR que el de Rust y llega a punto fijo. Además, `el_codigo_maquina_propio_hace_lo_mismo_que_webassembly` (x86-64: Linux o Windows) y `el_codigo_arm64_hace_lo_mismo_que_webassembly` (solo Windows, y solo si el ejecutable ARM64 puede correr) comparan cada ejecutable nativo con su wasm en Node. |
| Red | `crates/ara_interprete/tests/red.rs` | 15 | Servidor escrito en Ara contra un cliente de Rust. |
| Juegos | `crates/ara_wasm/tests/juegos.rs` | 8 | Clases de script, `externa` y `esperar` (JSPI, Node 25 o posterior) con `motor_pruebas.mjs`. |
| Runtime wasm | `crates/ara_wasm/tests/runtime.rs` | 2 | El `ara_runtime.wasm` de referencia no está desfasado (FNV-1a de las fuentes). |
| CLI | `crates/ara_cli/tests/{paquetes,sitio,tiempo}.rs` | 8 | Paquetes, sitio, tiempo. |
| LSP | `crates/ara_lsp/tests/protocolo.rs` | 1 | Protocolo LSP. |
| Documentación | `crates/ara_semantica/tests/documentacion.rs` | 2 | Los ejemplos de la documentación compilan. |
| Unitarias | `#[test]` dentro de `crates/*/src` | 45 | Lexer, formato, LSP, paquetes, reserva de memoria, web. |

En total hay unas 227 funciones `#[test]`. Sin Node, las pruebas diferenciales con wasm y las nativas avisan y no comprueban nada.

### Rendimiento

- `bench/contra-rust.sh` traduce `bench/*.ara` a código máquina con `compilador/nativo.ara`, o con `arm64.ara` si se pone `ORDEN=arm64`.
- Los compara con sus gemelos de `bench/rust/` (`rustc -C opt-level=3`, con y sin `overflow-checks`) y comprueba que las tres salidas coinciden.
- Da el mejor de N tiempos; con `--instrucciones` cuenta instrucciones con callgrind, solo en Linux.

En Windows (Git Bash):

```sh
ARA=target/x86_64-pc-windows-msvc/release/ara.exe RUST_TARGET=x86_64-pc-windows-msvc sh bench/contra-rust.sh
ARA=target/x86_64-pc-windows-msvc/release/ara.exe ORDEN=arm64 sh bench/contra-rust.sh
```

Las cifras publicadas están en `ara-etapa5/ara/bench/README.md` (ver `BENCHMARKS.md`).
