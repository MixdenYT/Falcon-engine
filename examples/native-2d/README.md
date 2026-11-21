# Falcon nativo 2D (fase 4)

El nivel de la plantilla «plataformas» corre en un `.exe` de Windows x64 hecho en Ara, sin Electron ni JavaScript, **con sus scripts y Blueprints de verdad**: el mismo código de juego que en el editor.

![El juego nativo en el paso 560 del guion de la prueba: tras morir en los pinchos (en rojo), salta la roca](../../docs/img/nativo-2d.png)

- **Juego.** El anfitrión del motor escrito en Ara, `src/motor/nativo/anfitrion2d.ara`:
  - implementa en Ara la parte de `src/ara/motor.ara` que usan los scripts del nivel (`externa func ...:` con cuerpo; ver `docs/NATIVO.md` de Ara);
  - lleva la tabla de nodos y hace lo mismo que `Mundo.paso` con `ProgramaAra`, en el mismo orden: `se_pulsa`/`se_suelta`, `se_actualiza`, las esperas, la física, `toca`/`deja_de_tocar`, los eliminados y el reinicio del nivel.
- **Scripts y Blueprints.** Son las clases de Ara de la plantilla, sin tocar:
  - el Blueprint del jugador (`JugadorBp`, compilado con el compilador de Blueprints);
  - `moneda.ara`, `peligro.ara`, `enemigo.ara`, `meta.ara`, `contador.ara` y `nivel.ara`.

  La escena generada (`build/escena.ara`) los crea con `Clase(yo)` y les manda los eventos con `avisar(objeto, "evento", ...)`.
- **`esperar`.** Los pinchos esperan 0,4 s antes de reiniciar. Cada evento corre en una fibra de Windows (`CreateFiber`/`SwitchToFiber`); `esperar` vuelve a la principal y el anfitrión la reanuda cuando pasa ese tiempo de juego, como las promesas de JSPI en Falcon.
- **Física.** La del motor: `src/motor/ara/fisica2d.ara`, el mismo fuente que Falcon compila a `nucleo.wasm`.
- **Ventana, dibujo y entrada** (`juego.ara`):
  - ventana Win32, con la función de ventana en Ara (`retrollamada`);
  - OpenGL 1.1, rectángulos de color con una cámara que sigue al jugador;
  - teclado con `GetAsyncKeyState`: ← → o A/D para andar; Espacio, ↑ o W para saltar;
  - paso fijo de 1/60 s con el reloj real (`QueryPerformanceCounter`), hasta 5 pasos por fotograma.

## Compilar y jugar

Hace falta Windows (x64, o ARM64 con la emulación x64) y el repositorio de Ara con su `ara.exe` (`motor-ara`, `fced30d` o posterior: el anfitrión en Ara):

```sh
node herramientas/escena-nativa-2d.mjs          # deja examples/native-2d/build/falcon-2d.exe
examples/native-2d/build/falcon-2d.exe          # jugar; se cierra con la ventana
```

- Por defecto, Ara se busca en `../ara-etapa5/ara` junto a Falcon. Con otra ruta, usa `ARA_DIR`; con otro binario, `ARA`.
- El script:
  1. genera `build/escena.ara` (los nodos y lo que une sus scripts con el anfitrión) y un `build/clase_*.ara` por cada clase de script o Blueprint que usa el nivel;
  2. copia junto a `juego.ara` lo que importa: `fisica2d.ara`, `anfitrion2d.ara` y `motor.ara` del motor, y `nativo/bufer.ara` de Ara;
  3. compila con `printf "runtime …\nwasm …\nnativo …" | ara compilador/ara.ara`.
- `build/` no va en git.

Modos sin teclado (variables de entorno):

| Variable | Qué hace |
|---|---|
| `FALCON_GUION=texto` | La entrada: una letra por paso, `a` + 1 (derecha) + 2 (izquierda) + 4 (saltar); el último se repite. Sin ella, uno fijo. |
| `FALCON_PASOS=N` | Sin ventana. Da N pasos con el guion y escribe el estado final y los ms por paso. |
| `FALCON_PASOS=N` y `FALCON_TRAZA=1` | Igual, pero escribe el estado tras cada paso. Lo usa la prueba. |
| `FALCON_CAPTURA=ruta.bmp` | Con ventana. Juega el guion 150 pasos (o `FALCON_CAPTURA_PASOS`), guarda el fotograma con `glReadPixels` y se cierra. |

La captura de arriba sale de `FALCON_CAPTURA` con el guion de la prueba (`GUION` de `herramientas/escena-nativa-2d.mjs`) y `FALCON_CAPTURA_PASOS=560`, pasada a PNG.

## La escena: un atajo

- Ara no tiene JSON en su biblioteca. Por eso el `.exe` no lee el `.fscn`: `herramientas/escena-nativa-2d.mjs` genera un módulo de Ara (`escena.ara`).
- El módulo lleva lo que `Mundo.sincronizarAra` le manda al núcleo para cada nodo, grabado tal cual, y lo que usan los scripts (nombre, tipo, grupos, gravedad, salto, texto). Lleva también los colores y las celdas, y `0.02^dt`.
- Así el `.exe` parte del mismo estado que el motor. Para otra escena hay que volver a compilar.
- Está marcado con `shortcut:` en el script.

## Prueba

`pruebas/nativo-2d.test.js` compila el `.exe` en una carpeta temporal y lo ejecuta con `FALCON_PASOS`, `FALCON_TRAZA` y un guion. Después compara cada paso, bit a bit, con Falcon: un `Mundo` con el mismo nivel, sus scripts y Blueprints compilados a WebAssembly con el anfitrión de JS (`ProgramaAra`), el núcleo de Ara y el mismo guion. Compara:
- posición, `vy`, empujes, suelo y nodo de suelo de cada personaje;
- los pares que se tocan;
- los puntos, el estado de la partida y cuántos nodos quedan.

Son dos casos:
1. **La plantilla tal cual**, 1000 pasos. El guion, buscado con el propio Falcon, recoge monedas, muere en los pinchos (empujón, `esperar(0.4)` y reinicio del nivel, con los puntos y los nodos de vuelta) y en la segunda vida llega a la meta: gana en el paso 928 con 4 puntos.
2. **El enemigo patrullando**, 300 pasos. En la plantilla, la caja del enemigo entra 4 px en el suelo y el primer paso lo saca hacia el hueco de las columnas 44-45, donde cae: pasa igual en Falcon (con el núcleo de Ara y con la física en JS) y en el `.exe`. Para ver la patrulla, la prueba lo apoya en el suelo (`y = 572`). Anda a la izquierda hasta la roca y allí se da la vuelta en cada paso, porque su script mira `en_pared()` del paso anterior después de `mover`. También igual en los dos.

Sin Windows o sin el compilador de Ara, la prueba se salta con un aviso.

## Qué cubre y qué no

Cubre:
- los scripts y Blueprints del nivel: andar y saltar, monedas, pinchos con `esperar`, enemigo, meta, contador de puntos y el reinicio al caer;
- de `motor.ara`: `existe`, `es`, `eliminar`, `hijo`, `en_grupo`, `nombre`, `x` e `y` (leer), `voltear_h` y `texto`, `mover`, `saltar`, `en_el_suelo`, `en_pared`, `en_techo`, `empujar` (x e y), `se_pulsa`, `se_mantiene`, `se_suelta`, `eje`, `nodo`, `ganar_partida`, `perder_partida`, `ganar_puntos`, `puntos`, `poner_puntos`, `reiniciar_nivel`, `tiempo` y `esperar`. `sonar`, `musica`, `parar_musica` y `temblar_camara` existen pero no hacen nada todavía;
- la física 2D completa del núcleo: plataformas, mosaicos, paredes, techos y contactos.

No cubre todavía:
- **el resto de `motor.ara`** (3D, `crear`, `grupo`, `llamar`, `leer_numero`…): un script que lo use no compila a nativo, y `nativo` dice qué externa falta;
- **los valores del Inspector** (`exportados`) y las conexiones de la pestaña Señales;
- **dos `cuando` del mismo evento en una clase si el primero espera**: en Falcon el segundo corre en el mismo fotograma; aquí, cuando el primero termina;
- **un error en un script** acaba el programa con su mensaje; en Falcon, ese `cuando` deja de ejecutarse y el juego sigue;
- **sprites, texturas, texto, audio y temblor de cámara**: todo son rectángulos de color;
- **plataformas móviles**: el arrastre va a 0, porque en este nivel no hay ninguna;
- **cargar escenas sin recompilar**: ver «La escena: un atajo»;
- **otras plataformas**: la FFI de Ara solo existe para Windows x64, así que no hay Linux ni ARM64 nativo.
