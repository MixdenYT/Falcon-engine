# Gráficos: render 2D, render 3D y Lumbre

Estado del 21-11-2026, rama `motor-ara` (`6117105`). Es un inventario hecho leyendo el código.

**Advertencia:** en esta rama no se ha abierto ninguna escena 3D en Electron.
- La única verificación en Electron de `REWRITE_ROADMAP.md` es de plantillas 2D.
- `PLATFORM_MATRIX.md` dice que el editor no se ha abierto.
- Lo que el `README.md` dice de Lumbre (rendimiento, reconocer la gráfica) **no tiene evidencia registrada** en el repositorio.

## Render 2D: `render2d.js` (Canvas2D)

| Capacidad | Dónde |
|---|---|
| Transformación afín por nodo con `DOMMatrix` (posición, rotación, escala) | `matrizLocal`, `recorrerConMatriz` |
| Sprites con imagen y animación por fotogramas, plataformas, mosaicos, partículas, colisiones visibles | `Render2D.dibujarMundo`; los `case` desde la línea 262 |
| Formas de dibujo sin imagen (círculo, redondeado, triángulo, personaje, enemigo, estrella, bandera) | `dibujarForma` (línea 116) |
| Interfaz (`Interfaz`, `Etiqueta`, `Boton`, `PanelUI`) dibujada aparte | `TIPOS_UI`, `dibujarInterfaz` |
| Caché de imágenes del proyecto | `CacheImagenes` |

- **Dónde se usa.** En el editor (`visor2d.js`) y en el juego (`Mundo.dibujar`, `mundo.js:1328`).
- **Plataforma.** El juego 2D se ha visto funcionar en Electron 44 x64 emulado en Windows ARM64 (plantillas `plataformas` y `topdown`; `REWRITE_ROADMAP.md`, «Verificación en Electron»).
- **Pruebas:** ninguna, porque no hay Canvas en Node ([`TESTING.md`](TESTING.md)).

## Render 3D: three.js 0.186 (WebGL2)

| Pieza | Qué hace |
|---|---|
| `escena3d.js`, `Escena3D` | Construye la escena: primitivas (`PRIMITIVAS`: cubo, esfera, cilindro, plano, cápsula, cono, terreno, escalera), modelos GLB (`GLTFLoader`), luces, entorno (`RoomEnvironment`) y huecos en muros (CSG con `three-bvh-csg`, `huecos.js`). UV por cara al escalar |
| `materiales.js` | Material `.mat` como un grafo de nodos (textura, relieve, color, número, multiplicar, sumar, mezclar). Se convierte en `MeshStandardMaterial`, `MeshToonMaterial` («dibujo») o `MeshBasicMaterial` («sin luz»). Superficie opaca, transparente o recortada; reflejo `sonda`, `plano` o `curvo` |
| `animacion3d.js`, `agarre3d.js`, `armas3d.js` | Rigs clonados, clips e IK de las manos (CQB) |
| `mundo3d.js`, `Mundo3D` | El 3D en ejecución: física de cajas y personajes (`fisica`), rayos, línea de visión, ratón en el mundo. Todo en JS |

## Lumbre (`lumbre.js`, `lumbre-proxy.js`, `lumbre-parche.js`, `graficos.js`)

Lo que **existe en el código** (líneas de `HEAD`; `lumbre.js` tiene cambios sin confirmar de otro agente a partir de la línea 1258):

| Capacidad | Dónde |
|---|---|
| GI difusa: rejillas de sondas de armónicos esféricos L2 (`LightProbeGridWebGL` de three.js), capturadas en la GPU | `crearRejilla` (471), `capturar` (872), `actualizarGI` (918) |
| Recalcula solo las sondas afectadas, empezando por las cercanas a la cámara | `ensuciarCaja` (748), `detectarCambiosLuz` (793), `elegirSucias` (828) |
| Saca fuera las sondas que caen dentro de un sólido | `reubicarSondas` (560) |
| Nodo `VolumenLumbre`, con rejillas más densas | `volumenes` (411); `tipos.js:311` |
| Escena simplificada (mallas quietas fundidas) para las capturas | `lumbre-proxy.js`, `ProxyCapturas` |
| Reflejos: sonda alrededor de la cámara, espejos planos (cámara reflejada) y curvos (sonda propia) | `actualizarReflejo` (1224), `renderizarEspejoPlano` (1091), `actualizarEspejos` (1138) |
| Sombras de sol, bombillas y focos, redibujadas solo si algo cambia; PCF con disco de Vogel | `actualizarSombras` (328); sesgo en `lumbre-parche.js` |
| Posproceso: GTAO, bloom (`UnrealBloomPass`) y exposición automática | `asegurarComposer` (1258), `PasoExposicion` (1548) |
| Calidades `baja`, `media`, `alta` y `ultra`; detección por nombre de la GPU; bajar de nivel si hay menos de 42 FPS | `graficos.js`: `CALIDADES`, `detectarCalidad`, `AjusteAutomatico` |
| Sin `EXT_color_buffer_float` y `OES_texture_float_linear` no hay GI: se queda en `baja` | `soportaGI`, `detectarCalidad` |
| Medida de tiempo de GPU | `RelojGPU` (1507) |

**Pruebas:**
- solo el sesgo de las sombras (`sombras.test.js`, 3) y las UV y el CSG (`texturas.test.js`, `huecos.test.js`);
- no hay prueba de WebGL ni comparación de imágenes.

**Plataforma comprobada:** ninguna en esta rama (ver la advertencia del principio).

## Lo que no existe

- Ni WebGPU, ni trazado de rayos por hardware, ni D3D, Vulkan u OpenGL nativo. Todo pasa por WebGL2 dentro de Electron.
- Render en Ara dentro de Falcon: no hay nada.
  - Ara tiene dos ejemplos nativos que Falcon no usa: un triángulo OpenGL 1.1 (`ejemplos/ventana_triangulo.ara`) y un cubo con OpenGL moderno (`ejemplos/ventana_cubo.ara`, Ara `eb22a34`).
  - En Ara, `f32` solo existe en la frontera de las `externa` y en el búfer, no como tipo del lenguaje.
- Pruebas de imagen en CI. Hay una línea base manual con capturas de referencia para tres escenas: [`GRAPHICS_BASELINE.md`](GRAPHICS_BASELINE.md).

Lumbre nativo es la fase 5 de [`REWRITE_ROADMAP.md`](REWRITE_ROADMAP.md) y está en Plan.
