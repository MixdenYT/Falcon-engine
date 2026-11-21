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

`src/motor/ara/fisica2d.ara` contra `fisica2d` y `contactos2d` de `mundo.js`. Los dos dan el mismo estado bit a bit (`pruebas/fisica2d-ara.test.js`).

### Metodología

- `node herramientas/medir-fisica2d.mjs [pasos]`, con el valor por defecto: 300 pasos de calentamiento y 2.000 medidos, `dt` = 1/60.
- Mismo equipo y Node de arriba (v26.13.1, `arm64`, V8 14.6.202.34). Árbol en `6ca1704` más los cambios de este bloque; `DOMMatrix` es la de `pruebas/dom.js` (Node no trae una).
- Dos escenas, cada una con 200 `Personaje2D` (con hijo `Colision`) que andan, saltan y chocan entre sí:
  - 21 plataformas (un suelo y 20 repisas; la mitad `solo_arriba`);
  - un mosaico sólido de 450 celdas.
- «fisica2d» es solo `Mundo.fisica2d`; «+ contactos2d», el paso de física completo de `Mundo.paso`. Con 200 personajes amontonados, `contactos2d` encuentra unos 300 pares por paso.
- Se ejecutó 3 veces seguidas; la tabla da las tres medidas.

### Resultados (ms por paso; ejecuciones 1 / 2 / 3)

**B3 (este bloque):** Ara calcula las matrices de mundo, las cajas y los pares de `contactos2d`. JS solo le manda los nodos que cambiaron.

| Escena | JS | Ara | Ara es… |
|---|---|---|---|
| 21 plataformas, fisica2d | 0,267 / 0,261 / 0,268 | 0,119 / 0,120 / 0,124 | 2,2× más rápido |
| 21 plataformas, + contactos2d | 0,638 / 0,613 / 0,636 | 0,339 / 0,338 / 0,335 | 1,8–1,9× |
| 450 celdas, fisica2d | 0,736 / 0,740 / 0,735 | 0,185 / 0,189 / 0,188 | 3,9–4,0× |
| 450 celdas, + contactos2d | 1,149 / 1,149 / 1,172 | 0,449 / 0,454 / 0,452 | 2,5–2,6× |

**B2 (antes, `6ca1704` sin cambios, misma herramienta):** Ara solo hacía `mover`; las cajas, las matrices (`DOMMatrix`) y `contactos2d` seguían en JS, y las celdas se mandaban en cada paso.

| Escena | JS | Ara | Ara es… |
|---|---|---|---|
| 21 plataformas, fisica2d | 0,269 / 0,266 / 0,265 | 0,304 / 0,309 / 0,329 | 0,8–0,9× (más lento) |
| 21 plataformas, + contactos2d | 0,626 / 0,632 / 0,640 | 0,684 / 0,666 / 0,653 | 0,9–1,0× |
| 450 celdas, fisica2d | 0,744 / 0,744 / 0,760 | 0,454 / 0,455 / 0,480 | 1,6× |
| 450 celdas, + contactos2d | 1,162 / 1,181 / 1,844 | 0,889 / 0,880 / 1,096 | 1,3–1,7× (la última ejecución, con ruido) |

### Lectura

- La ruta de Ara bajó de 0,30 a 0,12 ms con plataformas y de 0,46 a 0,19 ms con mosaicos. Se quitó el JS común a las dos rutas (`caja`, `matrizPadre` con `DOMMatrix`) y el reenvío de las celdas.
- Lo que queda en la ruta de Ara, por paso y con 200 personajes:
  - unos 25 µs en `sincronizarAra`, que compara cada nodo con lo que se mandó;
  - unas 9 llamadas Ara↔JS por personaje para leer el resultado de `mover`;
  - en `contactos2d`, unos 100 µs del recorrido O(n²) de pares dentro de Ara, y otros 100 µs en JS para leer los ~300 pares y construir el `Map` de claves (esa parte también la hace la ruta JS).
- Estas cifras son de Node con la `DOMMatrix` de `pruebas/dom.js`. En Electron, la ruta JS usa la `DOMMatrix` nativa de Chromium y no se ha medido aquí.

## Compilador de Ara nuevo (Ara `motor-ara` 2ff41f0, con trigonometría)

- Fecha: 21-11-2026. Falcon en `c8e2c05` más este bloque (compilador, runtime y `nucleo.wasm` nuevos; `sen`/`cos` en el núcleo).
- «Antes» es `c1b2b95` (`git archive` en una carpeta aparte, con el compilador y el runtime anteriores); «después», el árbol de trabajo. Se alternan antes y después, tres veces cada uno.
- Mismo equipo y Node de arriba. **El equipo estaba muy cargado** (otros agentes y Electron a la vez): todas las cifras salen de 4 a 15 veces más altas que las de las secciones anteriores y varían mucho entre ejecuciones. Solo sirven para comparar antes y después dentro de esta sección.

### Scripts (`node herramientas/medir-ara.mjs`, Ara, ms por fotograma; ejecuciones 1 / 2 / 3)

| Caso | Antes | Después |
|---|---|---|
| Shooter, 6 drones | 0,103 / 0,107 / 0,274 | 0,097 / 0,370 / 0,339 |
| Shooter, 60 drones | 0,234 / 0,253 / 0,680 | 0,319 / 3,049 / 0,632 |
| Shooter, 300 drones | 0,915 / 0,914 / 2,760 | 0,860 / 2,371 / 2,274 |
| Bandada, 50 | 0,159 / 0,160 / 0,167 | 0,155 / 0,150 / 0,148 |
| Bandada, 150 | 0,253 / 0,305 / 0,980 | 0,311 / 1,009 / 0,328 |
| Bandada, 300 | 1,392 / 3,999 / 2,427 | 1,262 / 4,878 / 3,102 |

### Física 2D (`node herramientas/medir-fisica2d.mjs`, ruta Ara, ms por paso; ejecuciones 1 / 2 / 3)

| Escena | Antes | Después |
|---|---|---|
| 21 plataformas, fisica2d | 1,562 / 1,625 / 1,528 | 1,319 / 1,614 / 1,573 |
| 21 plataformas, + contactos2d | 10,774 / 4,210 / 4,425 | 7,483 / 4,285 / 4,362 |
| 450 celdas, fisica2d | 2,495 / 2,326 / 2,200 | 1,537 / 1,529 / 0,809 |
| 450 celdas, + contactos2d | 5,211 / 5,479 / 6,055 | 4,817 / 4,732 / 5,399 |

### Lectura

- No hay empeoramiento que salga del ruido. En la ejecución más limpia (la 1), los scripts quedan igual o algo mejor, salvo el shooter con 60 drones (0,234 → 0,319), que en la 3 da lo contrario.
- La física con mosaicos baja de forma repetida, de unos 2,3 a unos 1,5 ms. Es lo esperable de las listas de booleanos compactas del compilador nuevo: `fisica2d.ara` guarda varias por nodo.
- Calcular `sen`/`cos` en Ara solo ocurre cuando un nodo cambia (`sincronizarAra`), así que no se nota en el paso.
- Hay que repetir estas medidas con el equipo en reposo.

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
