// Proyectos completos, sin modelos externos: geometría editable + lógica Águila comentada.
import { crearNodo } from './tipos.js';
import { datosProyecto, escenaVacia } from './proyecto.js';
import { sintetizar } from './generadores.js';

const N = (tipo, nombre, props = {}, hijos = [], extra = {}) => Object.assign(crearNodo(tipo, nombre, props, hijos), extra);
const caja = (nombre, x, y, z, sx, sy, sz, color = '#506579') => N('Malla3D', nombre, { posicion: [x, y, z], escala: [sx, sy, sz], malla: 'cubo', color, rugosidad: 0.82, colision: 'caja' });
const texto = (nombre, contenido, x, y, tam = 18, color = '#E7EDE9') => N('Etiqueta', nombre, { texto: contenido, posicion: [x, y], tam, color });

export const SCRIPT_JUGADOR_SHOOTER = `# jugador.agl — el mismo combate sirve para primera y tercera persona.
# Los controles integrados resuelven cámara, WASD, salto, carrera y colisión.
exportar variable total_enemigos = 6
variable vida = 100
variable municion = 12
variable reserva = 72
variable bajas = 0
variable enfriamiento = 0
variable recargando = falso
variable activo = falso
variable acabado = falso
variable ayuda = verdadero

función recibir_dano(cantidad):
    si activo y no acabado:
        vida = limitar(vida - cantidad, 0, 100)
        nodo("Aviso").texto = "¡Bajo fuego! Busca cobertura / Incoming fire!"
        temblar_camara(2, 0.12)
        si vida <= 0:
            acabado = verdadero
            activo = falso
            perder_partida()

función recargar():
    si activo y no recargando y municion < 12 y reserva > 0:
        recargando = verdadero
        nodo("Aviso").texto = "Recargando / Reloading…"
        esperar(1.4)
        si no acabado:
            variable cantidad = min(12 - municion, reserva)
            municion = municion + cantidad
            reserva = reserva - cantidad
            nodo("Aviso").texto = "Listo / Ready"
        recargando = falso

cuando se_pulsa("accion"):
    si no activo y no acabado:
        activo = verdadero
        nodo("Aviso").texto = "Elimina los drones / Eliminate the drones"
        nodo("Instrucciones").texto = "WASD · Shift correr · Espacio saltar · clic/J disparar · R recargar · V vista · H ayuda"

cuando se_pulsa("recargar"):
    recargar()

cuando se_pulsa("ayuda"):
    ayuda = no ayuda
    nodo("Instrucciones").visible = ayuda

cuando recibe("enemigo_eliminado", datos):
    si no acabado:
        bajas = bajas + 1
        ganar_puntos(100)
        nodo("Aviso").texto = "Impacto confirmado / Target down"
        si bajas >= total_enemigos:
            acabado = verdadero
            activo = falso
            ganar_partida()

cuando se_actualiza(delta):
    enfriamiento = max(0, enfriamiento - delta)
    si activo y no acabado y no recargando y se_mantiene("disparar") y enfriamiento <= 0:
        enfriamiento = 0.22
        si municion > 0:
            municion = municion - 1
            sonar("tiro.wav", 0.35)
            temblar_camara(0.6, 0.06)
            variable impacto = disparar_rayo(100)
            si impacto != nulo y impacto.es("enemigos"):
                impacto.llamar("recibir_dano", 34)
                nodo("Aviso").texto = "× IMPACTO / HIT"
            sino:
                nodo("Aviso").texto = "Disparo / Shot"
        sino:
            nodo("Aviso").texto = "Sin munición — R para recargar / Reload"
    nodo("Estado").texto = "VIDA / HP " + texto(vida) + "   |   MUNICIÓN / AMMO " + texto(municion) + " / " + texto(reserva)
    nodo("Objetivo").texto = "DRONES " + texto(bajas) + " / " + texto(total_enemigos) + "   |   PUNTOS " + texto(puntos)
`;

export const SCRIPT_ENEMIGO_SHOOTER = `# enemigo.agl — patrulla → detecta → persigue → ataca; cobertura corta la visión.
# perseguir usa la física del personaje, no navegación automática de rutas.
exportar variable punto_ax = 0
exportar variable punto_az = 0
exportar variable punto_bx = 3
exportar variable punto_bz = 0
exportar variable alcance = 22
exportar variable velocidad_ia = 1.7
variable vida = 100
variable ataque = 1.5
variable destino_b = verdadero
variable muerto = falso
variable alerta = falso

función recibir_dano(cantidad):
    si no muerto:
        vida = vida - cantidad
        alerta = verdadero
        color = "#FFCE66"
        si vida <= 0:
            muerto = verdadero
            emitir("enemigo_eliminado")
            sonar("baja.wav", 0.35)
            eliminar()

cuando se_actualiza(delta):
    variable jugador = nodo("Jugador")
    si muerto o no jugador.activo o jugador.acabado:
        devolver
    ataque = max(0, ataque - delta)
    variable distancia_jugador = distancia(yo, jugador)
    si ve_a(jugador, alcance):
        alerta = verdadero
        color = "#F36B64"
        si distancia_jugador > 6:
            perseguir(jugador, velocidad_ia)
        si ataque <= 0:
            ataque = 1.25
            jugador.llamar("recibir_dano", 8)
            sonar("tiro.wav", 0.12)
    sino:
        color = "#D9984C"
        variable tx = punto_bx
        variable tz = punto_bz
        si no destino_b:
            tx = punto_ax
            tz = punto_az
        variable dx = tx - x
        variable dz = tz - z
        variable longitud = raiz(dx * dx + dz * dz)
        si longitud < 0.6:
            destino_b = no destino_b
        sino:
            # Velocidades en ejes del mundo; la física evita atravesar muros.
            # El método perseguir apunta a un nodo: aquí usamos una baliza de patrulla.
            variable baliza = hijo("Destino")
            baliza.mover_a(tx, 0, tz)
            perseguir(baliza, velocidad_ia)
`;

function enemigo(i, x, z, bx, bz, cqb) {
  return N('Personaje3D', 'Drone' + (i + 1), { posicion: [x, 0, z], controles: 'ninguno', color: '#D9984C', altura: 1.65, usa_gravedad: true }, [
    N('Nodo3D', 'Destino'),
    N('Malla3D', 'Visor', { posicion: [0, 1.35, -0.32], escala: [0.42, 0.16, 0.15], malla: 'cubo', color: '#FFCE66', colision: 'ninguna', sombras: false }),
  ], { grupos: ['enemigos'], script: 'scripts/enemigo.agl', exportados: { punto_ax: x, punto_az: z, punto_bx: bx, punto_bz: bz, alcance: cqb ? 16 : 28, velocidad_ia: cqb ? 1.35 : 1.9 } });
}

function escenario(abierto) {
  const hijos = [];
  if (abierto) {
    hijos.push(caja('Terreno', 0, -0.5, 0, 76, 1, 76, '#3F6654'));
    hijos.push(caja('PerímetroN', 0, 2, -38, 76, 4, 1), caja('PerímetroS', 0, 2, 38, 76, 4, 1), caja('PerímetroO', -38, 2, 0, 1, 4, 76), caja('PerímetroE', 38, 2, 0, 1, 4, 76));
    // Tres rutas conectadas: central, flancos exteriores y pasos entre almacenes.
    for (const [i, x, z] of [[1, -13, -10], [2, 14, -15], [3, -16, 12], [4, 16, 10]]) {
      hijos.push(caja('Almacén' + i, x, 2.4, z, 8, 4.8, 7, i % 2 ? '#52788B' : '#AD7953'));
      hijos.push(caja('Cornisa' + i, x, 4.9, z, 8.5, 0.25, 7.5, '#C5C6B5'));
    }
    for (const [i, x, z] of [[1, -4, 16], [2, 5, 8], [3, -5, -2], [4, 5, -16], [5, -26, -3], [6, 27, 1], [7, 0, -28]]) {
      hijos.push(caja('CoberturaBaja' + i, x, 0.65, z, 3.4, 1.3, 1.2, '#B7A17B'));
    }
    for (let i = 0; i < 10; i++) {
      const x = i % 2 ? 33 : -33, z = -30 + Math.floor(i / 2) * 14;
      hijos.push(caja('Tronco' + i, x, 1.6, z, 0.7, 3.2, 0.7, '#68503B'));
      hijos.push(N('Malla3D', 'Copa' + i, { posicion: [x, 4, z], escala: [4, 5, 4], malla: 'esfera', color: '#315644', colision: 'ninguna' }));
    }
    hijos.push(caja('RutaCentral', 0, 0.015, 0, 4, 0.02, 64, '#8C917E'));
  } else {
    hijos.push(caja('SueloCQB', 0, -0.5, 0, 32, 1, 44, '#414953'));
    hijos.push(caja('Techo', 0, 3.7, 0, 32, 0.4, 44, '#66727F'));
    hijos.push(caja('ExteriorN', 0, 1.8, -22, 32, 3.6, 0.5), caja('ExteriorS', 0, 1.8, 22, 32, 3.6, 0.5), caja('ExteriorO', -16, 1.8, 0, 0.5, 3.6, 44), caja('ExteriorE', 16, 1.8, 0, 0.5, 3.6, 44));
    // Pasillo central de 4 m, puertas de 2.8 m hacia salas laterales. Sin paredes invisibles.
    for (const x of [-2.5, 2.5]) for (const [z, largo] of [[18, 8], [6, 10], [-6, 8], [-18, 8]]) hijos.push(caja('Tabique' + x + '_' + z, x, 1.8, z, 0.4, 3.6, largo, '#607384'));
    for (const x of [-9.25, 9.25]) for (const z of [-10, 4, 14]) hijos.push(caja('Separador' + x + '_' + z, x, 1.8, z, 13.1, 3.6, 0.4, '#7E8A91'));
    // Puertas interiores entre habitaciones, junto al extremo de cada tabique transversal.
    // Se abren con huecos nativos, utilizados también por física y rayos.
    for (const x of [-12, 12]) for (const z of [-10, 4, 14]) hijos.push(N('Malla3D', 'Puerta' + x + '_' + z, { posicion: [x, 1.35, z], escala: [2.8, 2.7, 1], malla: 'cubo', modo: 'hueco', colision: 'ninguna' }));
    for (const [i, x, z] of [[1, -7, 8], [2, 8, 8], [3, -7, -4], [4, 7, -4], [5, -8, -16], [6, 7, -16]]) {
      hijos.push(caja('CoberturaCQB' + i, x, 0.65, z, 3, 1.3, 1.4, '#BC965B'));
      hijos.push(N('Luz3D', 'LuzSala' + i, { posicion: [x, 3.1, z], tipo_luz: 'puntual', intensidad: 2.6, alcance: 11, color: i % 2 ? '#A3DFFF' : '#FFCE91', sombras: true }));
    }
    for (let z = -18; z <= 18; z += 9) {
      hijos.push(N('Luz3D', 'LuzPasillo' + z, { posicion: [0, 3.1, z], tipo_luz: 'puntual', intensidad: 2, alcance: 10, color: '#B8F2D7', sombras: false }));
      hijos.push(caja('GuíaSuelo' + z, 0, 0.015, z, 0.12, 0.02, 4, '#B0D6C7'));
    }
  }
  return hijos;
}

function escenaShooter(abierto) {
  const titulo = abierto ? 'OUTPOST / TERCERA PERSONA' : 'BREACH / PRIMERA PERSONA';
  const posiciones = abierto ? [[0, -14, 4, -14], [-26, 0, -26, -10], [26, -10, 26, 2], [-10, -26, -2, -26], [12, -29, 23, -29], [0, 6, -4, 6]] : [[-9, 8, -6, 8], [9, 7, 6, 7], [-8, -3, -12, -3], [9, -4, 6, -4], [-8, -16, -12, -16], [8, -16, 12, -16]];
  const ui = N('Interfaz', 'HUD', {}, [
    N('PanelUI', 'Cabecera', { posicion: [18, 14], ancho: 1244, alto: 90, color: '#0B1821', opacidad: 0.92 }),
    texto('Título', titulo, 38, 26, 23, '#71E5B0'), texto('Objetivo', 'DRONES 0 / 6', 38, 65, 18),
    texto('Estado', 'VIDA / HP 100 | MUNICIÓN / AMMO 12 / 72', 650, 26, 18),
    texto('Aviso', 'Pulsa E para iniciar / Press E to begin', 350, 124, 22, '#FFCE91'),
    N('PanelUI', 'Pie', { posicion: [18, 622], ancho: 1244, alto: 82, color: '#0B1821', opacidad: 0.92 }),
    texto('Instrucciones', 'WASD · Shift correr · Espacio saltar · clic/J disparar · R recargar · V vista · H ayuda', 38, 639, 16),
    texto('Consejo', abierto ? 'Flanquea los almacenes. Las coberturas bloquean fuego y visión. / Use the flanks and cover.' : 'Revisa las esquinas y despeja sala por sala. / Check corners and clear each room.', 38, 674, 15, '#A5BFCB'),
  ]);
  return escenaVacia('3D', N('Nodo3D', abierto ? 'BaseAbierta' : 'InstalaciónCQB', {}, [
    N('Entorno', 'Entorno', { cielo: abierto ? '#7DACC3' : '#111923', horizonte: abierto ? '#C7DACB' : '#273C4C', ambiente: abierto ? 0.65 : 0.5, niebla: abierto, densidad: 0.005, intensidad_resplandor: 0.2, exposicion_automatica: false }),
    N('Luz3D', 'Sol', { posicion: [12, 20, 8], rotacion: [-55, 25, 0], tipo_luz: 'sol', intensidad: abierto ? 2.4 : 0.4, color: '#FFE5BD', sombras: true }),
    N('Nodo3D', 'Arquitectura', {}, escenario(abierto)),
    N('Personaje3D', 'Jugador', { posicion: abierto ? [0, 0.05, 28] : [0, 0.05, 19], controles: abierto ? 'tercera_persona' : 'primera_persona', velocidad: 5, salto: 6, cambiar_vista: true, color: '#61C8C0' }, [N('Camara3D', 'Cámara', { posicion: [0.65, 2.7, 4.5], rotacion: [-12, 0, 0], fov: abierto ? 68 : 78 })], { script: 'scripts/jugador.agl', exportados: { total_enemigos: posiciones.length } }),
    N('Nodo3D', 'Enemigos', {}, posiciones.map((p, i) => enemigo(i, ...p, !abierto))), ui,
  ]));
}

export function plantillaShooter(nombre, vista = 'tercera_persona') {
  const datos = datosProyecto(nombre, '3D');
  datos.gravedad = 18; datos.acciones.recargar = ['KeyR']; datos.acciones.ayuda = ['KeyH'];
  datos.escena_principal = vista === 'primera_persona' ? 'escenas/cqb.fscn' : 'escenas/base_abierta.fscn';
  const archivos = {
    'escenas/base_abierta.fscn': escenaShooter(true), 'escenas/cqb.fscn': escenaShooter(false),
    'scripts/jugador.agl': SCRIPT_JUGADOR_SHOOTER, 'scripts/enemigo.agl': SCRIPT_ENEMIGO_SHOOTER,
    'sonidos/tiro.wav': sintetizar('golpe'), 'sonidos/baja.wav': sintetizar('moneda'),
    'GUIA_SHOOTER.md': `# Falcon Engine 1.1.0 — Shooter 3D de ejemplo

Dos mapas completos en el mismo proyecto: base_abierta.fscn (76 × 76 m, tercera persona) y cqb.fscn (32 × 44 m, primera persona). Elige la escena en el explorador y ejecútala. V cambia de vista en ambos mapas. Cada mapa tiene seis drones con tres impactos de 34 de daño para eliminarlos. Son prototipos didácticos con geometría editable, sin recursos externos.

## Jugar
E inicia combate. Haz clic para capturar el ratón; WASD mueve, ratón mira, Espacio salta, Shift corre, clic o J dispara, R recarga y H muestra/oculta ayuda. Escape libera el puntero. Retícula central = dirección de tiro. Cargador 12, reserva 72, recarga 1,4 s, intervalo entre disparos 0,22 s. Agotar la munición requiere volver a empezar desde el reproductor; no hay munición infinita. Elimina los seis drones para ganar; vida cero termina con derrota. El reproductor permite reintentar. Los mensajes de combate y el HUD incluyen inglés.

## Construir desde cero
1. Crea un Juego 3D y añade suelo y muros Malla3D con colisión caja.
2. Añade Personaje3D Jugador, controles primera_persona o tercera_persona y una Camara3D hija. Altura de ojos y cámara las gestionan los controles del motor.
3. Copia scripts/jugador.agl al proyecto y asígnalo a Jugador. Crea las etiquetas Estado, Objetivo, Aviso e Instrucciones dentro de Interfaz: el script usa esos nombres exactos.
4. Añade Personaje3D Drone con controles ninguno y grupo enemigos. Asigna scripts/enemigo.agl. Añade un Nodo3D hijo llamado Destino, que sirve de baliza invisible para patrullar. Configura las variables exportadas punto_ax, punto_az, punto_bx y punto_bz en coordenadas del mundo.
5. Ajusta total_enemigos del Jugador al número real de drones. Configura las acciones recargar = R y ayuda = H en ajustes del proyecto. Los demás controles ya vienen por defecto.
6. Copia los WAV de sonidos. Ejecuta, inicia con E, dispara tres veces a un drone y verifica que sube DRONES. Comprueba también que una pared impide hacer daño.

## Cómo funciona
disparar_rayo(100) devuelve el primer cuerpo sólido bajo la retícula o nulo. Primero resuelve el punto de cámara, luego comprueba el trayecto desde el personaje: la cobertura cercana puede detener el disparo incluso si la cámara ve el objetivo. No aplica daño automáticamente: el script comprueba el grupo enemigos y llama recibir_dano. Es hitscan, no proyectil físico, y usa las cajas de colisión del motor, incluidos los huecos de puertas.

ve_a(jugador, alcance) comprueba distancia y oclusión entre los cuerpos. No usa un cono de visión: estos drones detectan en 360 grados. perseguir(objetivo, velocidad) avanza con colisión; no calcula rutas ni rodea obstáculos. Las patrullas están colocadas en recorridos libres de cada sala. Los drones dejan de disparar al perder visión; daño 8 cada 1,25 s. Naranja = patrulla; rojo = enemigo con visión; amarillo = impacto recibido. Para una IA avanzada, añade memoria de posición, navegación y audición.

## Ejercicios
- Cambia velocidad, alcance y daño para comparar el combate abierto y CQB.
- Añade un drone, fija sus puntos de patrulla y aumenta total_enemigos.
- Cambia una cobertura a 2 m de alto y comprueba que corta visión y disparos.
- Amplía una sala cambiando escala y posición de sus paredes; conserva pasos de al menos 1,2 m.
- Conecta una recogida de vida con Blueprint: Al tocar → Es Jugador → Si → Emitir señal; recíbela en jugador.agl y limita vida a 100.
- Añade una tercera escena y selecciónala como principal en ajustes.

## Archivos
Los mapas se construyen con primitivas nativas para que cada muro, cubierta, luz, puerta y enemigo pueda editarse en el Inspector. CQB tiene un pasillo central, seis zonas laterales, puertas recortadas con modo hueco y iluminación de salas. La base tiene cuatro almacenes, siete coberturas, flancos y perímetro. Las mecánicas de combate y IA están comentadas en Águila porque el catálogo actual de Blueprint no ofrece bloques de rayos ni posición Z.
`,
  };
  return { datos, archivos, carpetas: ['escenas', 'scripts', 'sonidos'], abrir: [datos.escena_principal], importacion: {} };
}
