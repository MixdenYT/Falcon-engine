# Falcon Engine

Motor de videojuegos 2D y 3D para **Windows y Linux**, con el lenguaje de programación en español **Águila** y lógica visual con **Blueprints**. La interfaz sigue la propuesta «Falcon Engine — Propuestas de interfaz».

## Cómo se usa

| Acción | Cómo |
| --- | --- |
| Abrir el motor en desarrollo | `npm start` |
| Pasar las pruebas del lenguaje y los Blueprints | `npm test` |
| Empaquetar para Windows | `npm run build:win` → `dist/Falcon Engine-win32-x64/` |
| Empaquetar para Linux x64 | `npm run build:linux` → `dist/Falcon Engine-linux-x64.tar.gz` |
| Empaquetar para Linux ARM64 | `npm run build:linux-arm` → `dist/Falcon Engine-linux-arm64.tar.gz` |

En Linux, descomprime el `.tar.gz` y abre `./falcon.sh` (usa `--no-sandbox` solo si el sandbox de Chromium no está disponible).

## Pantallas

1. **Gestor de proyectos** — proyectos recientes con miniatura, nuevo proyecto (2D, 3D o plantilla), abrir, importar, plantillas, curso, guías y ajustes. Abre proyectos de Talon Engine (`proyecto.talon`) sin conversión.
2. **Editor 2D** — árbol de escena, archivos, visor con herramientas (seleccionar, mover, rotar, escalar, lápiz de mosaicos), ajuste a cuadrícula, área de cámara, Inspector, Señales y Grupos.
3. **Editor 3D** — visor three.js con gizmos, vuelo con clic derecho + WASD, iconos de luces y cámaras, Iluminado / Sin luz / Alambre, perspectiva / ortográfica, vista previa de la cámara del juego.
4. **Blueprints** — variables, eventos, funciones, catálogo de bloques, grafo con cables tipados, comentarios, compilación a Águila en directo y ayuda de cada bloque.
5. **Águila** — editor con resaltado, autocompletado, errores en español con «Arreglar», ordenar código, buscar, diccionario y ayuda contextual.
6. **Recursos** — carpetas, filtros, importación arrastrando archivos, ajustes de importación (píxel/suave, hoja de sprites…), «Usado en» y referencias rotas.
7. **Modo Sencillo** — lo esencial del nivel y el curso «Mi primer juego» (10 lecciones con pasos que se comprueban solos).
8. **Materiales** — grafo de material con vista previa y plantillas, parámetros e instancias.
9. **Mallas** — formas básicas, ranuras de material, LOD, colisión y física.
10. **Ventana de prueba** — pausa, paso a paso, reinicio, silencio, cámara libre, valores en vivo, velocidad, resolución y capturas (F12). Los cambios hechos en el editor llegan al juego en marcha.

**Iluminación global «Lumbre»** (inspirada en Lumen de Unreal): se activa en el nodo Entorno de una escena 3D. La luz rebota entre superficies en tiempo real mediante una rejilla de sondas calculada en la GPU, el cielo ilumina pero se tapa con techos y muros, los metales reflejan la escena, y hay oclusión ambiental (GTAO) y resplandor. Hay cuatro calidades (Baja, Media, Alta y Ultra) y un modo Automático que reconoce la gráfica (una RTX 2060 va a Alta) y baja de nivel si el juego va lento. Funciona con WebGL2 en cualquier gráfica de NVIDIA, AMD o Intel; donde no se puede, vuelve sola a la iluminación clásica. El jugador la cambia con F10 y los scripts con `calidad_grafica()`. Lumbre se puede desactivar para todo el proyecto en Proyecto › Ajustes › Gráficos, y el jugador también puede apagarla en el menú F10.

Lumbre también incluye espejos (reflejo **plano**, con cámara reflejada, y **curvo**, con sonda propia por objeto; se eligen en el material o en el Inspector), sombras de sol, bombillas y focos sobre mallas y personajes (la sombra del sol sigue a la cámara), y nodos **Volumen Lumbre** con más sondas para salas cerradas. La plantilla **Pruebas de iluminación** reúne una Caja de Cornell, una sala oscura con ventana, espejos, neón, esferas de rugosidad × metal, luz que gira, antorchas y día/noche con la tecla E.

Para gastar poco, Lumbre solo recalcula la luz cerca de lo que cambia (luces que se mueven, el sol, objetos desplazados), usa una versión simplificada de la escena para calcular las sondas, redibuja cada sombra solo cuando algo se mueve cerca y no dibuja los espejos que no se ven. Con la escena quieta apenas gasta medio milisegundo por fotograma. Las sondas que caen dentro de muros se sacan fuera para que la luz no se cuele, y la **exposición automática** adapta la imagen al entrar en sitios oscuros.

**Controles 3D**: un Personaje3D puede usar controles de **tercera persona** (cámara que orbita con el ratón o el mando, rueda para acercar, choca con las paredes y sigue con suavidad) o de **primera persona** (vista desde los ojos, el cuerpo sigue dando sombra). Movimiento con inercia, salto con margen al borde y altura variable, y la tecla V cambia de vista.

**Exportar** (Proyecto › Exportar juego…) crea un juego independiente para Windows x64 (carpeta con `.exe`), Linux x64 y Linux ARM64 (`.tar.gz` con permisos). La primera exportación a otra plataforma descarga su motor de ejecución.

## Águila en un vistazo

```
clase Jugador extiende Personaje2D:
    exportar variable velocidad = 220
    variable monedas = 0

    cuando se_actualiza(delta):
        mover(eje("izquierda", "derecha") * velocidad)
        si se_pulsa("saltar") y en_el_suelo():
            saltar()

    cuando toca(otro):
        si otro.es("Moneda"):
            monedas = monedas + 1
            otro.eliminar()
            si monedas >= 10:
                ganar_partida()
```

Bloques por sangría, `si / sino si / sino`, `mientras`, `para cada … en`, `repetir N veces`, `función`, `devolver`, clases, listas y diccionarios, y `esperar(segundos)` dentro de los eventos sin congelar el juego. `y` y `o` funcionan como operadores entre valores y como nombres normales (la coordenada `y`) en cualquier otro sitio.

## Estructura

```
src/aguila      Lenguaje: léxico, sintaxis, intérprete, analizador y biblioteca
src/motor       Tipos de nodo, Blueprints, proyecto, plantillas, mundo 2D/3D, render, física, audio, entrada
src/editor      Editor: estado, acciones, paneles, visores y disposiciones de cada modo
src/gestor      Gestor de proyectos
src/juego       Ventana de prueba y reproductor de juegos exportados
src/principal   Proceso principal de Electron, puente seguro y exportador
pruebas         Pruebas del lenguaje y del compilador de Blueprints
herramientas    Empaquetado e iconos
```

## Formatos de archivo

| Archivo | Contenido |
| --- | --- |
| `proyecto.falcon` | Ajustes del proyecto (JSON) |
| `*.fscn` | Escena: árbol de nodos con sus propiedades |
| `*.bp` | Blueprint; al guardar se compila a `generado/*.agl` |
| `*.agl` | Script de Águila |
| `*.mat` | Material (grafo) o instancia de material |
| `*.malla` | Malla: modelo o forma básica, materiales, colisión y física |
| `.falcon/` | Ajustes de importación, sesión del editor y miniatura |
