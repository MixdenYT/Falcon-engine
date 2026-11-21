# Benchmarks

## Equipo y versión

| | |
|---|---|
| Fecha | 21-11-2026 |
| Código | `falcon-engine` rama `motor-ara`, `git rev-parse HEAD` = `db8923f5a240e39feb979929c519247ec78c7bf3`. El árbol tenía cambios sin commit de otros agentes en `src/motor/lumbre.js`, `src/editor/visores/visor3d.js` y `src/motor/ara/`; ninguno de esos archivos lo carga `medir-ara.mjs`. `src/motor/mundo.js` estaba igual que en `HEAD`. |
| CPU | Snapdragon(R) X Plus X1P42100 (Qualcomm Oryon), 8 núcleos lógicos |
| Memoria | 15,6 GB |
| Sistema | Windows 11 Home ARM64, compilación 26300 |
| Node | v26.13.1, `arm64` nativo (V8 14.6.202.34) |

## Scripts: Águila contra Ara (`herramientas/medir-ara.mjs`)

### Metodología

- `node herramientas/medir-ara.mjs [fotogramas]`, con el valor por defecto: 600 fotogramas.
- Solo se miden los scripts. La física, el dibujo y el audio no se ejecutan en Node; el audio y la parte 3D son objetos de mentira.
- **Shooter:**
  - La escena `base_abierta` de la plantilla, con 6, 60 y 300 drones; los que faltan son copias repartidas por el mapa.
  - Águila ejecuta los scripts de Falcon 1.2 (`pruebas/aguila/*_shooter.agl`); Ara, los de la plantilla.
  - Se hacen 60 fotogramas de calentamiento y después se mide el tiempo medio por fotograma de `se_actualiza` en todos los nodos.
  - «Arranque» es lo que tardan en compilarse e iniciarse los scripts.
- **Bandada:**
  - `pruebas/aguila/bandada.agl` contra su conversión automática a Ara, con 50, 150 y 300 pájaros.
  - Se hacen 3 fotogramas de calentamiento y se mide la media de 30 (`max(5, fotogramas / 20)`).
- `performance.now()`, un solo proceso, sin fijar la frecuencia de la CPU. Se ejecutó 3 veces seguidas; la tabla da las tres medidas.

### Resultados (ms por fotograma; ejecuciones 1 / 2 / 3)

**Shooter**: scripts que sobre todo llaman al motor.

| Drones | Águila | Ara | Ara es… | Arranque Águila / Ara |
|---|---|---|---|---|
| 6 | 0,028 / 0,024 / 0,027 | 0,024 / 0,023 / 0,023 | 1,0–1,2× más rápido | 4 / 47 ms (la primera compilación de Ara) |
| 60 | 0,060 / 0,058 / 0,061 | 0,049 / 0,048 / 0,050 | 1,2× | 2 / 2 ms |
| 300 | 0,262 / 0,247 / 0,289 | 0,222 / 0,198 / 0,192 | 1,2–1,5× | 2–3 / 3 ms |

**Bandada**: lógica propia del script, con listas y bucles anidados.

| Pájaros | Águila | Ara | Ara es… |
|---|---|---|---|
| 50 | 2,11 / 2,08 / 2,05 | 0,038 / 0,035 / 0,036 | 55–59× |
| 150 | 15,94 / 15,34 / 16,72 | 0,070 / 0,081 / 0,070 | 189–240× |
| 300 | 63,85 / 59,38 / 68,95 | 0,268 / 0,283 / 0,265 | 209–260× |

### Lectura

- **Lógica propia:** Ara es entre 55 y 260 veces más rápido que Águila, y la ventaja crece con el trabajo. `REWRITE_ROADMAP.md` decía «98–195×»: era una medida anterior y con menos ejecuciones.
- **Scripts que sobre todo llaman al motor:** la ventaja es solo de 1,0 a 1,5×. El tiempo se va en cruzar de Ara a JS y en el propio motor en JS, no en el script.
  - Esto confirma el riesgo 4 de la hoja de ruta: la frontera Ara↔JS por escalar.
  - Es la cifra que debe mejorar al mover el núcleo a Ara.
- Con 300 drones, los scripts de Ara cuestan 0,2 ms por fotograma, menos del 2 % de un fotograma a 60 Hz (16,7 ms).
- La primera compilación de Ara tarda unos 47 ms (el compilador wasm en frío); las siguientes, de 2 a 3 ms.

## Núcleo en Ara: física 2D

Pendiente: cifras del agente 03 (`src/motor/ara/fisica2d.ara` contra `fisica2d` de `mundo.js`).

## Ara contra Rust (`ara-etapa5/ara/bench/contra-rust.sh`)

- No se ha vuelto a medir en esta sesión, porque otro agente estaba usando la batería de Ara.
- Las últimas cifras publicadas son de `ara-etapa5/ara/bench/README.md`. Se midieron en este mismo equipo el 19-11-2026, con el mejor de 7 o de 11 tiempos.
- Resumen:
  - **x86-64 emulado (Prism)**, Ara (`nativo.ara`) contra Rust x64:
    - de 0,4× a 1,6× según el programa (`inline` 1,6×, `criba` 1,4×, `memoria/oleadas` 0,4×);
    - unos 70 ms de cada medida son el arranque de un proceso emulado.
  - **ARM64 nativo**, Ara (`arm64.ara`, ya optimizado) contra Rust ARM64:
    - de 0,8× a 1,1× en los 17 programas (`inline` y `fib` 1,1×, `textos` y `oleadas` 0,8×);
    - unos 60 ms son el arranque.
- En Linux x86-64 (17-11-2026, otra máquina), por instrucciones con callgrind, Ara ejecuta 1,32× las instrucciones de Rust (media geométrica).
- El objetivo del proyecto es que Ara tarde como mucho 0,9× lo que tarda Rust. Con los tiempos de pared de arriba, aún no se cumple en todos los programas.
