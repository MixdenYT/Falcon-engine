// Guías de ayuda integradas (se muestran en Aprender y en el menú Ayuda del editor).
export const GUIAS = [
  {
    id: 'primeros-pasos', icono: 'libro', titulo: 'Primeros pasos',
    resumen: 'Crea un proyecto, coloca a tu personaje y pruébalo en segundos.',
    html: `
<p>Falcon Engine se organiza en cinco modos que tienes siempre arriba: <b>2D</b>, <b>3D</b>, <b>Blueprints</b>, <b>Águila</b> y <b>Recursos</b>.</p>
<h3>1. Crea una escena y añade tu primer personaje</h3>
<p>En el panel <b>Escena</b> pulsa <b>+</b> y elige <i>Personaje2D</i>. Dentro de él añade un <i>Sprite</i> (su dibujo) y una <i>Colisión</i> (la forma con la que choca).</p>
<h3>2. Dale movimiento con un Blueprint, sin escribir código</h3>
<p>Con el personaje seleccionado, en el Inspector pulsa <b>Añadir Blueprint</b>. Une los bloques «Al actualizar», «Si», «Acción pulsada» y «Saltar».</p>
<h3>3. Pulsa Probar (F5) y juega al instante</h3>
<p>El juego se abre en otra ventana. Puedes cambiar valores en el editor mientras juegas y verlos en directo.</p>
<h3>Moverse por el editor</h3>
<table>
<tr><td>Mover la vista 2D</td><td>Botón central o Espacio + arrastrar</td></tr>
<tr><td>Acercar / alejar</td><td>Rueda del ratón</td></tr>
<tr><td>Volar en 3D</td><td>Clic derecho + WASD</td></tr>
<tr><td>Dibujar mosaicos</td><td>Herramienta lápiz (B) con un nodo Mosaicos seleccionado</td></tr>
</table>`,
  },
  {
    id: 'aguila', icono: 'codigo', titulo: 'El lenguaje Águila',
    resumen: 'Programación en español, con bloques por sangría como Python.',
    html: `
<p>Águila es un lenguaje pensado para aprender. Las órdenes que dependen de otra van debajo, con 4 espacios de sangría, y las líneas que abren un bloque terminan en <code>:</code>.</p>
<pre>clase Jugador extiende Personaje2D:
    exportar variable velocidad = 220
    variable monedas = 0

    cuando se_actualiza(delta):
        mover(eje("izquierda", "derecha") * velocidad)
        si se_pulsa("saltar") y en_el_suelo():
            saltar()

    cuando toca(otro):
        si otro.es("Moneda"):
            monedas = monedas + 1
            otro.eliminar()</pre>
<h3>Eventos</h3>
<p><code>cuando empieza()</code>, <code>cuando se_actualiza(delta)</code>, <code>cuando toca(otro)</code>, <code>cuando se_pulsa("saltar")</code>, <code>cuando recibe("señal")</code>, <code>cuando hace_clic()</code>, <code>cuando termina()</code>.</p>
<h3>Esperar sin parar el juego</h3>
<pre>cuando empieza():
    mostrar("Preparados…")
    esperar(1)
    mostrar("¡Ya!")</pre>
<h3>Listas, diccionarios y clases</h3>
<pre>variable inventario = ["espada", "llave"]
inventario.añadir("poción")
para cada cosa en inventario:
    mostrar(cosa)

clase Punto:
    variable x = 0
    variable y = 0
    función iniciar(a, b):
        x = a
        y = b</pre>
<p>Si te equivocas, el editor te dice qué pasa en español y muchas veces puede arreglarlo solo con el botón <b>Arreglar</b>.</p>`,
  },
  {
    id: 'blueprints', icono: 'blueprint', titulo: 'Blueprints paso a paso',
    resumen: 'Bloques que se unen con cables y se convierten en Águila.',
    html: `
<p>Un Blueprint es un grafo de bloques. Los cables blancos (<b>ejecución</b>) marcan el orden; los de color llevan <b>datos</b>:</p>
<table>
<tr><td style="color:#F07A7A">●</td><td>Sí / no</td><td style="color:#B5E35A">●</td><td>Decimal</td></tr>
<tr><td style="color:#74B6F7">●</td><td>Entero</td><td style="color:#F2B85C">●</td><td>Texto</td></tr>
<tr><td style="color:#B39DFF">●</td><td>Objeto</td><td style="color:#E7EDE9">▶</td><td>Ejecución</td></tr>
</table>
<h3>Atajos</h3>
<table>
<tr><td>Añadir bloque</td><td>Espacio o clic derecho</td></tr>
<tr><td>Conectar</td><td>Arrastra desde un punto hasta otro</td></tr>
<tr><td>Cortar un cable</td><td>Alt + clic en el punto</td></tr>
<tr><td>Borrar bloque</td><td>Supr</td></tr>
<tr><td>Duplicar</td><td>Ctrl + D</td></tr>
<tr><td>Comentario</td><td>C</td></tr>
</table>
<p>Pulsa <b>Ver código</b> para ver el Águila que genera. Es de solo lectura: si quieres retocarlo, copia el código a un script <code>.agl</code>.</p>`,
  },
  {
    id: 'atajos', icono: 'boton', titulo: 'Atajos de teclado',
    resumen: 'Todo lo que puedes hacer sin soltar el teclado.',
    html: `
<table>
<tr><td>Probar el juego</td><td><span class="kbd">F5</span></td></tr>
<tr><td>Probar la escena actual</td><td><span class="kbd">F6</span></td></tr>
<tr><td>Pausar / seguir</td><td><span class="kbd">F7</span></td></tr>
<tr><td>Detener</td><td><span class="kbd">F8</span></td></tr>
<tr><td>Captura de pantalla (en el juego)</td><td><span class="kbd">F12</span></td></tr>
<tr><td>Guardar / guardar todo</td><td><span class="kbd">Ctrl S</span> · <span class="kbd">Ctrl Mayús S</span></td></tr>
<tr><td>Deshacer / rehacer</td><td><span class="kbd">Ctrl Z</span> · <span class="kbd">Ctrl Y</span></td></tr>
<tr><td>Duplicar / borrar</td><td><span class="kbd">Ctrl D</span> · <span class="kbd">Supr</span></td></tr>
<tr><td>Copiar / pegar nodos</td><td><span class="kbd">Ctrl C</span> · <span class="kbd">Ctrl V</span></td></tr>
<tr><td>Seleccionar · mover · rotar · escalar · lápiz</td><td><span class="kbd">Q</span> <span class="kbd">W</span> <span class="kbd">E</span> <span class="kbd">R</span> <span class="kbd">B</span></td></tr>
<tr><td>Centrar en la selección</td><td><span class="kbd">F</span></td></tr>
<tr><td>Cambiar de modo</td><td><span class="kbd">Ctrl 1…5</span></td></tr>
<tr><td>Buscar en el código</td><td><span class="kbd">Ctrl F</span></td></tr>
<tr><td>Autocompletar</td><td><span class="kbd">Ctrl Espacio</span></td></tr>
<tr><td>Comentar línea</td><td><span class="kbd">Ctrl /</span></td></tr>
</table>`,
  },
  {
    id: 'exportar', icono: 'exportar', titulo: 'Exportar tu juego',
    resumen: 'Crea un ejecutable para Windows o Linux y compártelo.',
    html: `
<p>En el editor abre <b>Proyecto › Exportar juego…</b>. Elige las plataformas:</p>
<table>
<tr><td><b>Windows x64</b></td><td>Carpeta con <code>.exe</code>, lista para comprimir y compartir.</td></tr>
<tr><td><b>Linux x64</b></td><td>Archivo <code>.tar.gz</code> con el ejecutable ya marcado para abrirse.</td></tr>
<tr><td><b>Linux ARM64</b></td><td>Para equipos ARM como consolas portátiles o Raspberry Pi 4/5.</td></tr>
</table>
<p>La primera vez que exportas para otra plataforma, Falcon descarga su motor de ejecución (unos 100 MB) y lo guarda para las siguientes veces.</p>`,
  },
  {
    id: 'lumbre', icono: 'sol', titulo: 'Iluminación global · Lumbre',
    resumen: 'Luz que rebota en tiempo real, como Lumen en Unreal, para cualquier gráfica.',
    html: `
<p><b>Lumbre</b> es la iluminación global en tiempo real de Falcon. La luz del sol, de las antorchas y de los materiales que brillan rebota entre las superficies; el cielo ilumina la escena pero se tapa con techos y muros; los metales reflejan lo que tienen alrededor.</p>
<h3>Cómo se activa</h3>
<p>Selecciona el nodo <b>Entorno</b> de tu escena 3D y activa <b>Iluminación global</b>. En el visor 3D elige <b>Final · Lumbre</b> en el menú de iluminación para verla mientras editas.</p>
<table>
<tr><td>Intensidad de los rebotes</td><td>Cuánta luz indirecta hay</td></tr>
<tr><td>Luz del cielo</td><td>La luz que entra desde arriba (como el SkyLight de Unreal)</td></tr>
<tr><td>Tiempo real</td><td>Las luces que se mueven o parpadean cambian los rebotes. Desactívalo en escenas quietas para ganar rendimiento</td></tr>
<tr><td>Reflejos de la escena</td><td>Los metales reflejan la escena real</td></tr>
<tr><td>Oclusión ambiental</td><td>Sombras suaves en rincones y zonas de contacto</td></tr>
<tr><td>Resplandor</td><td>Halo alrededor de luces y materiales que brillan</td></tr>
</table>
<h3>Espejos</h3>
<p>En el editor de materiales, sección <b>Reflejos · Lumbre</b>:</p>
<table>
<tr><td>Escena</td><td>Refleja una captura de la escena alrededor de la cámara. Barato; vale para casi todo</td></tr>
<tr><td>Plano</td><td>Un espejo de verdad: suelos pulidos, espejos de pared, agua quieta. Refleja por la cara de arriba del objeto (su eje Y); para un espejo de pared, gira el objeto 90° en X</td></tr>
<tr><td>Curvo</td><td>El objeto captura la escena desde su centro: esferas de cromo, jarrones, carrocerías</td></tr>
</table>
<p>La rugosidad del material desenfoca el reflejo. Las formas básicas sin material tienen la misma opción en el Inspector (<b>Reflejo</b>). El número de espejos depende de la calidad; los que sobran usan el reflejo de la escena.</p>
<h3>Sombras</h3>
<p>El sol, las bombillas y los focos proyectan sombras de mallas y personajes (<b>Personaje3D › Sombras</b>). La sombra del sol sigue a la cámara, así que se ve en todo el nivel. Las bombillas y focos con sombra son caros: en Media proyectan las 2 luces más fuertes, en Alta 4 y en Ultra 8.</p>
<h3>Volúmenes Lumbre</h3>
<p>Añade un nodo <b>Volumen Lumbre</b> y ajústalo a una sala cerrada. Dentro hay más sondas, así la luz no se cuela por las paredes y los rebotes de color se notan más. Fuera del volumen se usa la rejilla general de la escena.</p>
<p>Para probarlo todo, crea un proyecto con la plantilla <b>Pruebas de iluminación</b>: tiene una Caja de Cornell, una sala oscura con ventana, espejos, neón, esferas de rugosidad y metal, y día y noche con <span class="kbd">E</span>.</p>
<h3>Calidad y rendimiento</h3>
<p>En <b>Proyecto › Ajustes › Gráficos</b> eliges la calidad por defecto. Con <b>Automática</b>, Falcon reconoce la tarjeta gráfica (una RTX 2060 va a Alta) y baja un nivel si el juego va lento. Los jugadores pueden cambiarla con <span class="kbd">F10</span>, y tus scripts con <code>calidad_grafica("alta")</code>.</p>
<p>Para no usar Lumbre en todo el proyecto, desactívala en <b>Proyecto › Ajustes › Gráficos</b> («Usar Lumbre»): las escenas pasan a la iluminación clásica, más ligera, y las sombras, la oclusión ambiental y el resplandor siguen funcionando. Si está activada, el jugador también puede apagarla en el menú de gráficos (<span class="kbd">F10</span>).</p>
<p>Funciona con WebGL2 en cualquier gráfica de NVIDIA, AMD o Intel, sin trazado de rayos por hardware. Si una gráfica no admite las texturas que necesita, Lumbre se apaga sola y se usa la iluminación clásica.</p>
<h3>Qué hace Lumbre para gastar poco</h3>
<table>
<tr><td>Solo lo que cambia</td><td>Al empezar calcula toda la luz en unos segundos. Después solo recalcula las sondas cerca de lo que cambia (una luz que se mueve o cambia, el sol, el cielo, un objeto que se desplaza), empezando por las más cercanas a la cámara. Si nada cambia, casi no gasta</td></tr>
<tr><td>Día y noche al instante</td><td>La luz rebotada se guarda en dos partes: la del sol y el cielo, y la de bombillas, antorchas y lo que brilla. Si el sol o el cielo cambian de color o de fuerza, la imagen se adapta en el mismo fotograma; las sondas solo se recalculan después, poco a poco, para afinar</td></tr>
<tr><td>Escena simplificada</td><td>Para calcular la luz, los objetos quietos se funden en unos pocos: cada sonda cuesta unas cinco veces menos</td></tr>
<tr><td>Sombras a demanda</td><td>Cada mapa de sombra se redibuja solo si su luz o algo cercano se mueve</td></tr>
<tr><td>Espejos visibles</td><td>Los espejos que no se ven, o con la escena quieta, no se vuelven a dibujar</td></tr>
<tr><td>Sondas fuera de los muros</td><td>Las sondas que caen dentro de paredes o bajo el suelo se sacan fuera, así la luz de fuera no se cuela en las salas</td></tr>
</table>
<p>Los personajes no entran en la iluminación global (sí proyectan sombra). <b>Exposición automática</b> (en el Entorno) adapta la imagen como el ojo: se aclara poco a poco al entrar en una sala oscura y se oscurece al salir al sol.</p>`,
  },
  {
    id: 'controles3d', icono: 'persona', titulo: 'Controles 3D · primera y tercera persona',
    resumen: 'Movimiento y cámara listos para usar en un Personaje3D.',
    html: `
<p>Selecciona tu <b>Personaje3D</b> y elige en <b>Controles</b> «Tercera persona» o «Primera persona». No hace falta escribir código.</p>
<table>
<tr><td><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span></td><td>Andar, relativo a hacia dónde mira la cámara</td></tr>
<tr><td><span class="kbd">Mayús</span></td><td>Correr</td></tr>
<tr><td><span class="kbd">Espacio</span></td><td>Saltar. Si lo sueltas pronto, el salto es más corto</td></tr>
<tr><td>Clic + ratón</td><td>Mirar (el puntero queda capturado; <span class="kbd">Esc</span> lo suelta)</td></tr>
<tr><td>Rueda</td><td>Acercar o alejar la cámara (tercera persona)</td></tr>
<tr><td><span class="kbd">V</span></td><td>Cambiar entre primera y tercera persona</td></tr>
<tr><td>Mando</td><td>Stick izquierdo para andar, derecho para mirar, A saltar, B correr, Y cambiar de vista</td></tr>
</table>
<h3>Tercera persona</h3>
<p>La <b>Cámara3D</b> hija del personaje marca la distancia y la altura de partida. La cámara sigue al personaje con suavidad, se acerca sola si hay una pared detrás y, si se juega solo con teclado, se coloca poco a poco detrás de hacia donde anda.</p>
<h3>Primera persona</h3>
<p>La vista va a la altura de los ojos, con un ligero balanceo al andar y un pequeño golpe al aterrizar. Tu cuerpo no tapa la vista, pero sigue proyectando sombra y se ve en los espejos.</p>
<h3>Ajustes</h3>
<p>En la sección <b>Cámara</b> del personaje: sensibilidad del ratón, invertir el eje vertical y permitir o no el cambio de vista. El movimiento tiene inercia, menos control en el aire y salto con margen: puedes saltar un instante después de salir de un borde, y si pulsas saltar justo antes de tocar el suelo, el salto sale igualmente.</p>`,
  },
  {
    id: 'talon', icono: 'enlace', titulo: 'Proyectos de Talon Engine',
    resumen: 'Abre tus proyectos anteriores sin conversión.',
    html: `
<p>Falcon reconoce las carpetas con <code>proyecto.talon</code> y las abre directamente, sin convertir nada. Verás la etiqueta <b style="color:var(--aviso)">Proyecto Talon · compatible</b> en la lista de proyectos.</p>
<p>Si guardas cambios desde Falcon, el archivo del proyecto se mantiene en el mismo formato para que siga funcionando en Talon.</p>`,
  },
];
