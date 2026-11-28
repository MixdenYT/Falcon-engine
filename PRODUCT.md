# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Aplicación de escritorio Electron 44 para Windows y Linux; la interfaz es HTML/CSS/JS servida por el protocolo `falcon://`.)

## Users

Principiantes hispanohablantes que aprenden a crear videojuegos. Llegan sin saber programar o sabiendo poco, en su propio equipo (a menudo modesto), y su trabajo es pasar de una idea a un juego 2D o 3D que se pueda probar, sin salir de un editor en su idioma.

## Product Purpose

Falcon es un motor y editor de videojuegos 2D y 3D. Permite construir una escena, darle comportamiento con Blueprints visuales o scripts en Ara, y probarla en el mismo editor. El éxito es que un principiante termine y pruebe su propio juego, y que pueda exportarlo.

## Positioning

Todo en español como primera lengua: la interfaz, el lenguaje de scripts (Ara, con sintaxis en español), los mensajes de error, la Academia y las guías. No es una traducción de una herramienta pensada en inglés.

## Operating Context

- Gestor de proyectos → plantillas (Academia de Blueprints, Plataformas, Shooter · Base abierta, Shooter · CQB, Pruebas de iluminación) → editor 2D/3D → Probar (F5) → Exportar.
- Cada proyecto genera su guía en Markdown (`GUIA_BLUEPRINTS.md`, `GUIA_SHOOTER.md`, `GUIA_CQB.md`).
- Se usa en equipos de escritorio de gama variada; la calidad gráfica se ajusta a la GPU.

## Capabilities and Constraints

- Editor 2D (sprites, mosaicos, colisiones, cámaras) y 3D (mallas, materiales por grafo, luces, personajes).
- Blueprints compilados a Ara; scripts Ara compilados a WebAssembly; el lenguaje anterior, Águila, sigue funcionando.
- Iluminación global Lumbre (sondas, sombras, reflejos, GTAO, bloom, exposición automática).
- Runtime nativo 2D en desarrollo (Ara/OpenGL); el render 3D depende de three.js/WebGL2.
- Terminología fija del producto: Ara (lenguaje independiente, no es Falcon), Blueprints, Lumbre, Academia, Gestor.
- Licencia 2.0 (borrador): editor gratis; licencia de publicación de 20 € por juego; las exportaciones sin licencia son versiones de prueba con la marca de agua «Hecho con Falcon engine · versión de prueba». Pendiente: canal de pago y revisión legal.

## Brand Commitments

- Se mantienen el logo actual (`recursos/logo.png`, `recursos/icono.png`) y los colores actuales de la marca.
- Nombre visible: «Falcon engine» (antes «Falcon Engine — Powered by Ara»). Solo cambia el texto que ve el usuario. El `productName` de Electron, el `appId`, los nombres de los instaladores y la carpeta «Falcon Engine Proyectos» se mantienen para no perder datos ni actualizaciones.
- Licencia: ver Capabilities and Constraints.

## Evidence on Hand

- Capturas reales del editor: `docs/images/`, `docs/img/`.
- Web oficial: https://mixden.net/falcon-engine/
- No hay testimonios, cifras de usuarios ni casos de estudio en el repositorio: no inventarlos.
- Rendimiento: solo hay mediciones registradas en `docs/BENCHMARKS.md` y `docs/GRAPHICS_BASELINE.md`; no prometer cifras fuera de ellas.

## Product Principles

1. El español es la lengua original, no una traducción: textos, errores y ejemplos se escriben primero en español.
2. Aprender haciendo: cada capacidad debe poder probarse en una plantilla o laboratorio sin configuración previa.
3. Nada se presenta como terminado sin evidencia: compatibilidad y rendimiento solo con mediciones reales.
4. Un principiante con un equipo modesto también debe poder terminar su juego.
