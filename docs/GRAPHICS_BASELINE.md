# Línea base gráfica (GFX-00)

Estado del 28-11-2026, rama `ccr-3188c819-wbjlj9`, que parte de `main` en `bac4915`. El bloque es GFX-00 del plan maestro *Graphics Evolution* (línea base y observabilidad). **Estado: En revisión.** Está cubierto en parte: ver «Qué falta».

## Cómo se ejecuta

```sh
npm install --no-save playwright-core      # o Playwright instalado a nivel global
node herramientas/linea-base-grafica.mjs                # mide, compara con las referencias y comprueba el cambio deliberado
node herramientas/linea-base-grafica.mjs --actualizar   # guarda las capturas actuales como referencias
node herramientas/linea-base-grafica.mjs S03            # solo una escena
```

| Variable | Qué hace |
|---|---|
| `CHROME_PATH` | Chromium que se usa. Por defecto, el de Playwright. |
| `LINEA_BASE_GPU=1` | Usa la GPU del equipo en vez de SwiftShader. Las referencias versionadas son de SwiftShader: con GPU real, la comparación de imágenes no aplica, pero las métricas sí. |
| `LINEA_BASE_SALIDA` | Carpeta de resultados. Por defecto `pruebas/linea-base/salida/` (ignorada por git): una captura por escena y `resultados.json`. |

| Pieza | Qué hace |
|---|---|
| `pruebas/linea-base/escenas.js` | Datos de las escenas patrón: nodos del motor, cámara y calidad. |
| `pruebas/linea-base/pagina.html` | Monta cada escena con el código real (`render2d.js`, `escena3d.js`, `lumbre.js`), mide, captura y compara. |
| `herramientas/linea-base-grafica.mjs` | Sirve el repositorio, abre Chromium, recorre las escenas y escribe `resultados.json`. Sale con 1 si una escena falla. |
| `pruebas/linea-base/referencias/*.png` | Capturas de referencia (SwiftShader, 384×216, DPR 1). |

## Qué se mide y cómo

| Métrica | Fuente | Nota |
|---|---|---|
| CPU por fotograma: media, p95, p99, máx. | `performance.now()` alrededor de `lumbre.actualizar` + `lumbre.renderizar` (3D) o de `dibujarMundo` + `dibujarInterfaz` (2D). 5 fotogramas de calentamiento y 60 medidos, con `dt` fijo de 1/60. | En 3D mide **el envío de comandos**, no la ejecución en la GPU. Con 60 muestras, p99 es el máximo. El navegador redondea `performance.now()` a 0,1 ms. |
| GPU por fotograma | `EXT_disjoint_timer_query_webgl2` | Si la extensión no existe o hay `GPU_DISJOINT`: **NO SOPORTADO**. |
| Llamadas de dibujo, triángulos, líneas, puntos | `renderer.info.render` con `autoReset = false` y `reset()` por fotograma: suma sombras, sondas, posproceso y escena. | En 2D (Canvas2D): **NO SOPORTADO**. |
| Instancias | Suma de `count` de cada `InstancedMesh`. | El motor no usa instancing: 0 es el valor real. |
| Geometrías, texturas, programas | `renderer.info.memory`, `renderer.info.programs` | Recuentos, no bytes. |
| Memoria GPU en MB | — | **NO SOPORTADO**: WebGL no la expone. |
| Coste por pase | — | **NO SOPORTADO**: no hay Render Graph. Lumbre solo mide sus sondas (`RelojGPU`). |
| Compilación de shaders | `renderer.compile()` antes del primer fotograma | Tiempo de CPU hasta que three.js entrega los programas. El driver puede seguir compilando después. No incluye los pases del composer (GTAO, bloom, exposición), que se compilan durante el calentamiento: en S03 la cifra se queda corta. |
| Carga de escena | `Escena3D.construir()` | Solo primitivas: sin GLB ni texturas. |
| Comparación visual | Píxel a píxel, máximo de los canales RGB | Distinto si la diferencia es mayor que `umbral` (16/255). La escena falla si los píxeles distintos superan su `tolerancia` (en `escenas.js`: 0,05 % en S01 y S02, 0,4 % en S03). Los dos se cambian con `?umbral=` y `?tolerancia=`. |

**Por qué estas tolerancias.** Medido en 14 ejecuciones seguidas sobre 82.944 píxeles:
- S01 y S02 dieron siempre 0 píxeles distintos. Su tolerancia de 0,05 % (41 px) solo cubre redondeos.
- S03 (sondas de GI, GTAO, bloom) varió entre 57 y 106 píxeles (máximo 0,13 %, diferencia máxima de 31). Su tolerancia de 0,4 % (332 px) deja tres veces de margen al ruido.
- El cambio deliberado que se prueba, una esfera de rojo a azul en S02, da 922 píxeles (1,1 %). En S02 queda 22 veces por encima de la tolerancia.

Una primera versión usaba un 0,2 % común. La revisión cruzada lo marcó: S03 dio 82 px y 106 px, con solo 1,6 veces de margen hasta el límite.

## Escenas patrón

| ID | Escena | Estado | Qué cubre |
|---|---|---|---|
| S01 | Render 2D | Hecha | Fondo, mosaicos, plataforma, sprites con forma, escala no uniforme, rotación, alpha, orden por `z`, fotograma de un atlas 2×2, partículas congeladas, panel de UI. **Sin texto**, porque las fuentes cambian entre sistemas; queda pendiente. |
| S02 | PBR Lab | Hecha | 8 esferas: metálico 0/1 × rugosidad 0,05/0,35/0,65/0,95, sol con sombra, calidad `baja`. Pendiente: normal, emisión, transparencia y UV (necesitan archivos `.mat`). |
| S03 | Lumbre Interior | Hecha | Habitación cerrada con ventana, bombilla con sombra, GI por sondas, calidad `media` (GI, GTAO, bloom). Pendiente: emisores móviles y cámara en movimiento. |
| S04 | Lumbre Exterior | Pendiente | |
| S05 | Reflections | Pendiente | |
| S06 | Stress Scene | Pendiente | |
| S07 | Native Runtime | Pendiente | Ya existe una comparación bit a bit del runtime nativo 2D (`pruebas/nativo-2d.test.js`), solo en Windows con el compilador de Ara. |

## Resultados medidos

Equipo: contenedor Linux x64 (kernel 6.18), Intel Xeon a 2,10 GHz con 4 núcleos, Node v22.23.5, Chromium 158.0.8127.36 headless. GPU: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`, es decir, rasterizado por CPU. Resolución 384×216, DPR 1.

| Escena | CPU media | p95 | p99 / máx. | GPU | Dibujos | Triángulos | Geometrías / texturas / programas | Compilación | Carga |
|---|---|---|---|---|---|---|---|---|---|
| S01 | 0,20 ms | 0,3 ms | 1,8 ms | NO SOPORTADO | NO SOPORTADO | NO SOPORTADO | — | — | — |
| S02 (`baja`) | 0,56 ms | 1,0 ms | 1,6 ms | NO SOPORTADO | 10 | 9.732 | 3 / 4 / 3 | 6,9 ms | 6,7 ms |
| S03 (`media`) | 2,25 ms | 3,5 ms | 18,5 ms | NO SOPORTADO | 34 | 412 | 22 / 34 / 32 | 6,4 ms | 7,5 ms |

- **S03.** Lumbre queda en `lista`: GI activa, 48 sondas, composer activo. El p99 de 18,5 ms es un único fotograma alto que se repite en cada ejecución (entre 18,5 y 23 ms). No se ha atribuido a ningún pase, porque no hay medida por pase.
- **GPU.** SwiftShader no ofrece `EXT_disjoint_timer_query_webgl2`, así que el tiempo de GPU queda NO SOPORTADO. Con `LINEA_BASE_GPU=1` y una GPU que la ofrezca se mide. La página activa `__falconPerfilGPU` para que el `RelojGPU` de Lumbre no abra una consulta dentro de la suya. Las consultas sin resultado se cuentan en `gpuMs.perdidas`. **Esa ruta no se ha ejecutado: aquí no hay GPU real.**
- **Interpretación.** Estas cifras son la referencia de este entorno de CI. **No** son presupuestos ni indican rendimiento en GPU de usuario. En 3D, el trabajo de dibujo real se cuenta en la GPU (aquí, en la CPU vía SwiftShader), no en «CPU por fotograma».

## Revisión cruzada

La hizo un agente distinto del autor, que leyó el código y ejecutó la batería. No encontró nada crítico en SwiftShader. Hallazgos y qué se hizo:

| Gravedad | Hallazgo | Estado |
|---|---|---|
| Crítico (solo GPU real) | La consulta de tiempo de la página y la de `RelojGPU` de Lumbre se anidaban: `INVALID_OPERATION` y S03 fallaba. | Corregido con `__falconPerfilGPU`. Sin verificar en GPU real. |
| Importante | `--actualizar` guardaba como referencia una escena con errores. | Corregido: solo se guarda si la escena está bien. |
| Importante | Poco margen en la tolerancia común de S03. | Corregido: tolerancia por escena, medida en 10 ejecuciones. |
| Importante | Un solo `GPU_DISJOINT` descartaba todo y las consultas pendientes se perdían sin avisar. | Corregido: espera de hasta 2 s y recuento de consultas perdidas. |
| Menor | Commit leído de `.git/HEAD` (era una referencia, no un hash); `%` mal formado tumbaba el servidor; `umbral=0` imposible; recursos sin liberar tras una excepción; compilación sin los pases del composer. | Corregidos; lo último, documentado. |

## Hallazgos

1. **Metales negros en calidad `baja` (S02).** Con `metalico: 1` y sin reflejos de Lumbre (desactivados en `baja`), las esferas metálicas salen casi negras: no tienen nada que reflejar. Es el comportamiento real de hoy en equipos modestos. Decidir si `baja` debe dar un mapa de entorno estático de reserva.
2. **`lumbre.stats.sombras` vale 0 en S02 y S03** aunque en la imagen hay sombras. Parece contar solo los redibujados del fotograma. No sirve como «sombras activas»; hay que revisarlo antes de usarlo en un panel.
3. **No hay tiempos por pase ni de GPU fuera de las sondas.** Es la primera carencia para F1: el Render Graph MVP debería medir cada pase.
4. **Las PR #8–#12 forman una cadena apilada:** #9 contiene #8, #10 contiene #9, etc. #12 incluye todo, y #8–#11 no se pueden revisar ni fusionar por separado sin rebase. Esta línea base mide `main`, sin ellas.

## Relación con las PR abiertas y nombres de bloque

Comprobado el 28-11-2026 en GitHub y con `git log main..origin/<rama>`. Todas son borradores con base `main` (`bac4915`), salvo #14 (base `codex/fisica3d-ara`).

| PR | Rama | Qué aporta a GFX-00 | Qué no cubre |
|---|---|---|---|
| #8 | `codex/gfx-00-calidad-adaptativa` | Nada de línea base: histéresis de la calidad automática (bajar a menos de 42 FPS, subir a más de 58). | — |
| #9 | `codex/gfx-01-diagnostico-render` | `leerEstadisticasRenderer` y `Lumbre.diagnostico()`: dibujos, triángulos, geometrías, texturas, programas y sondas en vivo. Con `autoReset = false` acumula todo el fotograma, igual que aquí. | Ni GPU ni p95/p99, y no distingue «no soportado» de 0: `numero()` convierte lo que falta en 0. |
| #10 | `codex/gfx-02-panel-rendimiento` | Panel en el editor con lo de #9. | Sin escenas ni capturas. |
| #11 | `codex/gfx-03-liberacion-recursos` | `Escena3D.destruir()`. | — |
| #12 | `codex/gfx-04-pruebas-webgl` | Primera prueba WebGL real en CI (Chromium + SwiftShader): una escena, 6 fotogramas, píxeles distintos del fondo. | Sin referencia de imagen ni tolerancias, una sola escena y sin métricas de tiempo. |

Cuando #9 y #12 entren en `main`, esta línea base debería:
- leer las estadísticas con `leerEstadisticasRenderer`, después de que distinga «no soportado» de 0;
- compartir el servidor estático con `pruebas/webgl.test.mjs`;
- tener su propio paso en CI.

Hoy no puede, porque ese código no está en `main`.

**Nomenclatura propuesta.** No se ha renombrado ninguna PR ni rama. Los IDs `GFX-0x` de las ramas `codex/` chocan con los del plan maestro.

- Para los bloques del plan maestro, usar la fase y un número: `F0-01` línea base y observabilidad (este documento), `F1-01` API gráfica mínima, etc.
- Para el trabajo de las PR, usar un prefijo por tema: `CAL-01` calidad adaptativa (#8), `DIAG-01` diagnóstico (#9), `DIAG-02` panel (#10), `REC-01` liberación de recursos (#11), `WEBGL-01` prueba WebGL real (#12). Los mismos que ya usan #13 (`FIS-3D-ARA`) y #14 (`CTRL-3D-ARA`).

## Qué falta para cerrar GFX-00

- Escenas S04–S07, y en S01–S03 lo marcado como pendiente.
- Tiempo de GPU medido en hardware real (bajo, medio y alto) con `LINEA_BASE_GPU=1`, y registro del driver.
- Coste por pase, ligado a F1 y al Render Graph.
- Paso en CI. No se ha añadido porque Chrome cambia de versión en CI y puede mover píxeles fuera de la tolerancia: primero hay que fijar la versión del navegador o generar las referencias en CI.
- Inventario detallado de materiales, shaders y recursos GPU. Hoy está en `GRAPHICS.md` (leyendo el código) y aquí solo como recuentos.

## Estado del roadmap gráfico

| Fase | Estado |
|---|---|
| F0: validación y línea base | En desarrollo (este bloque: En revisión) |
| F1: fundación del renderer | Pendiente |
| F2–F8 | Pendiente |
