// Ajustes globales de los shaders de three.js para Lumbre.
// Se importa antes de compilar cualquier material.
import * as THREE from 'three';

export const INTENSIDAD_GI = { value: 1 };

const SC = THREE.ShaderChunk;
if (!SC.__lumbre) {
  SC.__lumbre = true;
  const original = 'irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );';
  if (SC.lights_fragment_begin.includes(original)) {
    // Intensidad de los rebotes ajustable desde el nodo Entorno.
    SC.lights_fragment_begin = SC.lights_fragment_begin.replace(original, 'irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal ) * LUMBRE_ESCALA;');
    SC.lightprobes_pars_fragment = '#ifdef USE_LUMBRE\nuniform float lumbreIntensidad;\n#define LUMBRE_ESCALA lumbreIntensidad\n#else\n#define LUMBRE_ESCALA 1.0\n#endif\n' + SC.lightprobes_pars_fragment;
  } else console.warn('Lumbre: no se pudo ajustar la intensidad de la iluminación global (versión de three.js distinta).');
  // Con iluminación global, la luz difusa del mapa de entorno ya la dan las sondas: se evita contarla dos veces.
  const ibl = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
  if (SC.lights_fragment_maps.includes(ibl)) SC.lights_fragment_maps = SC.lights_fragment_maps.replace(ibl, '#ifndef USE_LIGHT_PROBES_GRID\n\t\t\t' + ibl + '\n\t\t\t#endif');
  // Bombillas y focos: el texel de su mapa de sombras (en perspectiva) crece con la distancia a la
  // luz, así que el desplazamiento por la normal que evita el «acné» también debe crecer con ella.
  // Con un valor fijo sobraba cerca de la luz (la sombra se despegaba del objeto) y faltaba lejos.
  // Aquí normalBias pasa a ser «metros por metro de distancia» (ver Lumbre.ajustarSombras).
  const pv = 'shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );';
  const sv = 'shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;';
  if (SC.shadowmap_vertex.includes(pv) && SC.shadowmap_vertex.includes(sv)) {
    SC.shadowmap_vertex = SC.shadowmap_vertex
      .replace(pv, 'shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias * length( ( pointShadowMatrix[ i ] * worldPosition ).xyz ), 0 );')
      .replace(sv, 'shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias * max( ( spotLightMatrix[ i ] * worldPosition ).w, 0.0 );');
    SC.__lumbreSesgo = true;
  } else console.warn('Lumbre: no se pudo ajustar el sesgo de las sombras (versión de three.js distinta).');
}

/**
 * Sesgo de sombra de una luz, calculado con el tamaño real del texel de su mapa.
 * three.js dibuja en el mapa las caras TRASERAS de los objetos (vistas desde la luz): en un objeto
 * cerrado, la cara iluminada queda siempre delante de lo guardado en el mapa, así que no hay «acné»
 * y no hace falta sesgo de profundidad. Antes había uno fijo, y era lo que despegaba las sombras:
 *  · sol: −0,0006 de un rango de 99,5 m = 6 cm, más 2 cm por la normal;
 *  · bombillas y focos: −0,0005 en profundidad en perspectiva (no lineal), que en metros vale
 *    0,0005·z²·(lejos−cerca)/(lejos·cerca): 4,5 cm a 3 m de la luz y 50 cm a 10 m.
 * Ahora el sesgo de profundidad es 0 y solo queda un desplazamiento por la normal de SESGO_TEXELES
 * texeles, que quita el acné junto a la línea de sombra propia de las superficies curvas.
 */
export const SESGO_TEXELES = 0.6;
export function ajustarSesgo(l) {
  const sh = l.shadow;
  if (!sh) return;
  sh.bias = 0;
  if (l.isDirectionalLight) sh.normalBias = SESGO_TEXELES * (sh.camera.right - sh.camera.left) / sh.mapSize.x;
  // En perspectiva el texel mide 2·tan(ángulo/2)/tamaño por cada metro de distancia (cara de cubo de
  // 90° en las bombillas); el shader lo multiplica por la distancia (ver shadowmap_vertex arriba).
  else if (l.isPointLight) sh.normalBias = SESGO_TEXELES * 2 / sh.mapSize.x;
  else if (l.isSpotLight) sh.normalBias = SESGO_TEXELES * 2 * Math.tan(l.angle) / sh.mapSize.x;
}

// Se pone a 0 mientras se capturan sondas o reflejos, para que los espejos no se lean a sí mismos.
export const ESPEJOS_ACTIVOS = { value: 1 };

// Oclusión ambiental de pantalla (GTAO), calculada antes de dibujar la escena. Solo oscurece la luz
// indirecta (rebotes, cielo, reflejos del entorno), como el aoMap de three.js y como Lumen: la luz
// directa de una antorcha o del sol que llega a un rincón no la tapa el rincón. `intensidad` vale 0
// fuera del dibujado principal (capturas de sondas, reflejos, espejos), donde la textura no cuadra.
export const AO_PANTALLA = { textura: { value: null }, intensidad: { value: 0 }, inv: { value: new THREE.Vector2(1, 1) } };
const CODIGO_AO = `
	#ifdef USE_LUMBRE
	if ( lumbreAO > 0.0 ) {
		float aoPantalla = mix( 1.0, texture2D( lumbreAOTex, gl_FragCoord.xy * lumbreAOInv ).r, lumbreAO );
		reflectedLight.indirectDiffuse *= aoPantalla;
		#if defined( STANDARD )
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( saturate( dot( geometryNormal, geometryViewDir ) ), aoPantalla, material.roughness );
		#endif
	}
	#endif`;

/**
 * Convierte un material PBR en espejo plano: el reflejo de la escena (desde una cámara
 * reflejada) sustituye a la luz especular del entorno. Así se conservan el brillo
 * físico (Fresnel, metal) y la rugosidad, que desenfoca el reflejo.
 */
export function prepararEspejo(m, u) {
  if (!m.isMeshStandardMaterial || m.userData.espejoListo) return;
  m.userData.espejoListo = true;
  prepararMaterial(m);
  const previo = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (previo) previo.call(m, sh, r);
    Object.assign(sh.uniforms, { tEspejo: u.tEspejo, matEspejo: u.matEspejo, espejoIntensidad: u.espejoIntensidad, espejoDesenfoque: u.espejoDesenfoque, espejoMaxLod: u.espejoMaxLod, espejosActivos: ESPEJOS_ACTIVOS });
    sh.vertexShader = 'uniform mat4 matEspejo;\nvarying vec4 vEspejoUv;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvEspejoUv = matEspejo * ( modelMatrix * vec4( transformed, 1.0 ) );');
    sh.fragmentShader = 'uniform sampler2D tEspejo;\nuniform float espejoIntensidad;\nuniform float espejoDesenfoque;\nuniform float espejoMaxLod;\nuniform float espejosActivos;\nvarying vec4 vEspejoUv;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `
	#if defined( RE_IndirectSpecular )
	if ( espejosActivos > 0.5 && vEspejoUv.w > 0.0 ) {
		vec2 uvE = vEspejoUv.xy / vEspejoUv.w;
		// El relieve (mapa de normales) ondula un poco el reflejo.
		uvE += ( normal.xy - geometryNormal.xy ) * 0.04;
		float lod = clamp( material.roughness * espejoDesenfoque * espejoMaxLod, 0.0, espejoMaxLod );
		vec3 colorEspejo = textureLod( tEspejo, uvE, lod ).rgb;
		radiance = mix( radiance, colorEspejo, espejoIntensidad );
	}
	#endif
	#include <lights_fragment_end>`);
  };
  const clave = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.customProgramCacheKey = () => (clave ? clave() : '') + '|espejo';
  m.needsUpdate = true;
}

/** Engancha la intensidad de Lumbre a un material (una vez). */
export function prepararMaterial(m) {
  if (!m || m.userData.lumbre) return;
  if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshToonMaterial || m.isMeshPhongMaterial)) return;
  m.userData.lumbre = true;
  const previo = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (previo) previo.call(m, sh, r);
    sh.uniforms.lumbreIntensidad = INTENSIDAD_GI;
    sh.uniforms.lumbreAO = AO_PANTALLA.intensidad;
    sh.uniforms.lumbreAOTex = AO_PANTALLA.textura;
    sh.uniforms.lumbreAOInv = AO_PANTALLA.inv;
    sh.fragmentShader = '#define USE_LUMBRE\nuniform float lumbreAO;\nuniform sampler2D lumbreAOTex;\nuniform vec2 lumbreAOInv;\n'
      + sh.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>' + CODIGO_AO);
  };
  const clave = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.customProgramCacheKey = () => (clave ? clave() : '') + '|lumbre2';
  m.needsUpdate = true;
}
